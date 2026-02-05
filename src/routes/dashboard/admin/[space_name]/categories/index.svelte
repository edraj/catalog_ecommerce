<script lang="ts">
  import { onMount } from "svelte";
  import "./index.css";
  import { goto } from "@roxi/routify";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { ResourceType, ContentType } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    PlusOutline,
    EditOutline,
    TrashBinOutline,
    InfoCircleOutline,
  } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName, formatDate } from "@/lib/utils/adminUtils";
  import {
    isParentCategory,
    getSubCategories,
    getEntityContent,
  } from "@/lib/utils/entityUtils";
  import { formatNumber } from "@/lib/helpers";

  import {
    CreateCategoryModal,
    EditCategoryModal,
    DeleteCategoryModal,
  } from "@/components/modals";
  import type { CategoryFormData } from "@/components/modals/CreateCategoryModal.svelte";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let categories = $state([]);
  let specifications = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let showDetailsModal = $state(false);
  let selectedCategory = $state(null);
  let selectedCategoryForDetails = $state(null);
  let selectedParentFilter = $state("all");
  let expandedCategories = $state(new Set());
  let editFormData = $state<CategoryFormData | undefined>(undefined);
  let totalCategoriesCount = $state(0);
  let allCategoriesCache = $state([]);
  let searchTerm = $state("");
  let openDropdownId = $state<string | null>(null);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  onMount(async () => {
    await Promise.all([loadCategories(), loadSpecifications()]);
  });

  async function loadCategories() {
    isLoading = true;
    const offset = (currentPage - 1) * itemsPerPage;

    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        allCategoriesCache = response.records;
        totalCategoriesCount =
          response.attributes?.total || response.records.length;
        updateFilteredCategories();
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Failed to load categories");
    } finally {
      isLoading = false;
    }
  }

  function updateFilteredCategories() {
    let filtered = allCategoriesCache;

    if (selectedParentFilter === "root") {
      filtered = filtered.filter((c) => isParentCategory(c));
    } else if (selectedParentFilter !== "all") {
      filtered = getSubCategories(selectedParentFilter, allCategoriesCache);
    } else {
      filtered = filtered.filter((c) => isParentCategory(c));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((cat) => {
        const displayname = getLocalizedDisplayName(cat, $locale).toLowerCase();
        const shortname = cat.shortname?.toLowerCase() || "";
        const description = (
          cat.attributes?.payload?.body?.meta_description || ""
        ).toLowerCase();
        return (
          displayname.includes(term) ||
          shortname.includes(term) ||
          description.includes(term)
        );
      });
    }

    categories = filtered;
  }

  async function loadSpecifications() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "specifications",
        "managed",
        100,
        0,
        true,
      );

      if (response?.records) {
        specifications = response.records;
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Failed to load specifications");
    }
  }

  function openCreateModal() {
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(category) {
    selectedCategory = category;
    const content = getEntityContent(category);
    editFormData = {
      displayname: getLocalizedDisplayName(category, $locale),
      description: content?.description || "",
      parent_category_id: content?.parent_category_shortname || "",
      specification_shortnames: content?.specification_shortnames || [],
      boost_value: content?.boost_value || 0,
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedCategory = null;
    editFormData = undefined;
  }

  function openDeleteModal(category) {
    selectedCategory = category;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedCategory = null;
  }

  function openDetailsModal(category) {
    selectedCategoryForDetails = category;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    selectedCategoryForDetails = null;
  }

  function getCategoryLevel(category) {
    return category.attributes?.payload?.body?.level ?? 0;
  }

  function getCategoryOrder(category) {
    return category.attributes?.payload?.body?.order ?? 0;
  }

  function getCategorySpecifications(category) {
    return category.attributes?.payload?.body?.specification_shortnames || [];
  }

  function getLevelColor(level: number): string {
    const colors = {
      0: "#3b82f6",
      1: "#10b981",
      2: "#f59e0b",
      3: "#8b5cf6",
    };
    return colors[level] || "#6b7280";
  }

  async function handleCreateCategory(formData: CategoryFormData) {
    if (!formData.displayname.trim()) {
      errorToastMessage("Please enter a category name");
      return;
    }

    try {
      const categoryData = {
        displayname_en: formData.displayname,
        description_en: formData.description,
        body: {
          name: formData.displayname,
          description: formData.description,
          parent_category_shortname: formData.parent_category_id || null,
          specification_shortnames: formData.specification_shortnames || [],
          boost_value: formData.boost_value || 0,
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        categoryData,
        website.main_space,
        "/categories",
        ResourceType.content,
        "",
        "",
      );

      successToastMessage("Category created successfully!");
      closeCreateModal();
      await loadCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      errorToastMessage("Failed to create category");
    }
  }

  async function handleUpdateCategory(formData: CategoryFormData) {
    if (!formData.displayname.trim()) {
      errorToastMessage("Please enter a category name");
      return;
    }

    if (!selectedCategory) return;

    try {
      const categoryData = {
        displayname: formData.displayname,
        description: formData.description,
        body: {
          name: formData.displayname,
          description: formData.description,
          parent_category_shortname: formData.parent_category_id || null,
          specification_shortnames: formData.specification_shortnames || [],
          boost_value: formData.boost_value || 0,
        },
        content_type: "json",
        tags: selectedCategory.attributes?.tags || [],
        is_active: true,
      };

      await updateEntity(
        selectedCategory.shortname,
        website.main_space,
        selectedCategory.subpath,
        selectedCategory.resource_type,
        categoryData,
        "",
        "",
      );

      successToastMessage("Category updated successfully!");
      closeEditModal();
      await loadCategories();
    } catch (error) {
      console.error("Error updating category:", error);
      errorToastMessage("Failed to update category");
    }
  }

  async function handleDeleteCategory() {
    if (!selectedCategory) return;

    try {
      await deleteEntity(
        selectedCategory.shortname,
        website.main_space,
        selectedCategory.subpath,
        selectedCategory.resource_type,
      );

      successToastMessage("Category deleted successfully!");
      closeDeleteModal();
      await loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      errorToastMessage("Failed to delete category");
    }
  }

  function toggleCategory(categoryId) {
    if (expandedCategories.has(categoryId)) {
      expandedCategories.delete(categoryId);
      expandedCategories = new Set(expandedCategories);
    } else {
      expandedCategories.add(categoryId);
      expandedCategories = new Set(expandedCategories);
    }
  }

  function isExpanded(categoryId) {
    return expandedCategories.has(categoryId);
  }

  const parentCategories = $derived.by(() => {
    return allCategoriesCache.filter((c) => isParentCategory(c));
  });

  const activeCategories = $derived.by(() => {
    return allCategoriesCache.filter((c) => c.attributes?.is_active === true);
  });

  const inactiveCategories = $derived.by(() => {
    return allCategoriesCache.filter((c) => c.attributes?.is_active !== true);
  });

  let paginatedCategories = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return categories.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(categories.length / itemsPerPage);
  });

  function handlePageChange(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function handleSearchOrFilterChange() {
    currentPage = 1;
    updateFilteredCategories();
  }

  function toggleDropdown(shortname: string) {
    openDropdownId = openDropdownId === shortname ? null : shortname;
  }

  function closeDropdown() {
    openDropdownId = null;
  }

  $effect(() => {
    if (allCategoriesCache.length > 0) {
      handleSearchOrFilterChange();
    }
  });
</script>

<div class="categories-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon" style="background: #dbeafe;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">
          {$_("admin_dashboard.total_categories") || "Total Categories"}
        </p>
        <h3 class="stat-value">
          {formatNumber(allCategoriesCache.length, $locale)}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #d1fae5;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">
          {$_("admin_dashboard.active_categories") || "Active Categories"}
        </p>
        <h3 class="stat-value">
          {formatNumber(activeCategories.length, $locale)}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #fee2e2;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">
          {$_("admin_dashboard.inactive_categories") || "Inactive Categories"}
        </p>
        <h3 class="stat-value">
          {formatNumber(inactiveCategories.length, $locale)}
        </h3>
      </div>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="search-and-filters">
    <div class="search-bar">
      <input
        type="text"
        bind:value={searchTerm}
        oninput={handleSearchOrFilterChange}
        placeholder={$_("admin_dashboard.search_categories") ||
          "Search categories..."}
        class="search-input"
        class:rtl={$isRTL}
      />
      <button class="search-btn" aria-label={$_("common.search") || "Search"}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </div>

    <div class="filter-dropdown">
      <select
        bind:value={selectedParentFilter}
        onchange={handleSearchOrFilterChange}
        class="filter-select"
      >
        <option value="all"
          >{$_("common.all_categories") || "All Categories"}</option
        >
        <option value="root"
          >{$_("common.parent_categories_only") ||
            "Parent Categories Only"}</option
        >
        {#each parentCategories as parent}
          <option value={parent.shortname}>
            {getLocalizedDisplayName(parent, $locale)} ({formatNumber(
              getSubCategories(parent.shortname, categories).length,
              $locale,
            )})
          </option>
        {/each}
      </select>
    </div>

    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span>{$_("admin_dashboard.create_category") || "Create Category"}</span>
    </button>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if allCategoriesCache.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📂</div>
      <h3>{$_("admin_dashboard.no_categories") || "No categories found"}</h3>
      <p>
        {$_("admin_dashboard.create_first_category_desc") ||
          "Create your first category to get started"}
      </p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span
          >{$_("admin_dashboard.create_first_category") ||
            "Create First Category"}</span
        >
      </button>
    </div>
  {:else if categories.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>{$_("common.no_results") || "No results found"}</h3>
      <p>
        {$_("common.try_different_search") || "Try adjusting your search terms"}
      </p>
    </div>
  {:else}
    <div class="categories-table-container">
      <table class="categories-table">
        <thead>
          <tr>
            <th class="col-expand"></th>
            <th class="col-category">{$_("common.category") || "Category"}</th>
            <th class="col-level">{$_("common.level") || "Level"}</th>
            <th class="col-description"
              >{$_("common.description") || "Description"}</th
            >
            <th class="col-status">{$_("common.status") || "Status"}</th>
            <th class="col-created">{$_("common.created") || "Created"}</th>
            <th class="col-actions">{$_("common.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedCategories as category}
            {@const subCategories = getSubCategories(
              category.shortname,
              categories,
            )}
            {@const hasSubCategories = subCategories.length > 0}
            {@const expanded = isExpanded(category.shortname)}

            <!-- Parent Category Row -->
            <tr
              class="category-row"
              class:expanded
              class:has-children={hasSubCategories}
            >
              <td class="col-expand">
                {#if hasSubCategories}
                  <button
                    class="expand-btn"
                    onclick={() => toggleCategory(category.shortname)}
                    title={expanded
                      ? $_("common.collapse") || "Collapse"
                      : $_("common.expand") || "Expand"}
                  >
                    <svg
                      class="expand-icon"
                      class:rotated={expanded}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                {/if}
              </td>
              <td class="col-category">
                <div class="category-cell">
                  <div class="category-info">
                    <span class="category-name">
                      {getLocalizedDisplayName(category, $locale)}
                    </span>
                    <span class="category-shortname">{category.shortname}</span>
                  </div>
                  {#if hasSubCategories}
                    <span class="sub-count-badge"
                      >{formatNumber(subCategories.length, $locale)}</span
                    >
                  {/if}
                </div>
              </td>
              <td class="col-level">
                <span
                  class="level-badge"
                  style="background-color: {getLevelColor(
                    getCategoryLevel(category),
                  )}15; color: {getLevelColor(getCategoryLevel(category))};"
                >
                  L{getCategoryLevel(category)}
                </span>
              </td>
              <td class="col-description">
                <span class="description-text">
                  {category.attributes?.payload?.body?.description ||
                    $_("admin_dashboard.no_description_available") ||
                    "No description available"}
                </span>
              </td>
              <td class="col-status">
                {#if category.attributes?.is_active}
                  <span class="status-badge active"
                    >{$_("common.active") || "Active"}</span
                  >
                {:else}
                  <span class="status-badge inactive"
                    >{$_("common.inactive") || "Inactive"}</span
                  >
                {/if}
              </td>
              <td class="col-created">
                <span class="date-text"
                  >{formatDate(category.attributes?.created_at, $locale)}</span
                >
              </td>
              <td class="col-actions">
                <div class="actions-cell">
                  <button
                    class="action-btn info"
                    onclick={() => openDetailsModal(category)}
                    title={$_("common.details") || "Details"}
                  >
                    <InfoCircleOutline size="sm" />
                  </button>
                  <button
                    class="action-btn"
                    onclick={() => openEditModal(category)}
                    title={$_("common.edit") || "Edit"}
                  >
                    <EditOutline size="sm" />
                  </button>
                  <button
                    class="action-btn delete"
                    onclick={() => openDeleteModal(category)}
                    title={$_("common.delete") || "Delete"}
                  >
                    <TrashBinOutline size="sm" />
                  </button>
                </div>
              </td>
            </tr>

            <!-- Sub-Categories Rows (Expanded) -->
            {#if hasSubCategories && expanded}
              {#each subCategories as subCategory}
                <tr class="category-row sub-category">
                  <td class="col-expand"></td>
                  <td class="col-category">
                    <div class="category-cell sub">
                      <span class="sub-category-icon">↳</span>
                      <div class="category-info">
                        <span class="category-name">
                          {getLocalizedDisplayName(subCategory, $locale)}
                        </span>
                        <span class="category-shortname"
                          >{subCategory.shortname}</span
                        >
                      </div>
                    </div>
                  </td>
                  <td class="col-level">
                    <span
                      class="level-badge"
                      style="background-color: {getLevelColor(
                        getCategoryLevel(subCategory),
                      )}15; color: {getLevelColor(
                        getCategoryLevel(subCategory),
                      )};"
                    >
                      L{getCategoryLevel(subCategory)}
                    </span>
                  </td>
                  <td class="col-description">
                    <span class="description-text">
                      {subCategory.attributes?.payload?.body?.description ||
                        $_("admin_dashboard.no_description_available") ||
                        "No description available"}
                    </span>
                  </td>
                  <td class="col-status">
                    {#if subCategory.attributes?.is_active}
                      <span class="status-badge active"
                        >{$_("common.active") || "Active"}</span
                      >
                    {:else}
                      <span class="status-badge inactive"
                        >{$_("common.inactive") || "Inactive"}</span
                      >
                    {/if}
                  </td>
                  <td class="col-created">
                    <span class="date-text"
                      >{formatDate(
                        subCategory.attributes?.created_at,
                        $locale,
                      )}</span
                    >
                  </td>
                  <td class="col-actions">
                    <div class="actions-cell">
                      <button
                        class="action-btn info"
                        onclick={() => openDetailsModal(subCategory)}
                        title={$_("common.details") || "Details"}
                      >
                        <InfoCircleOutline size="sm" />
                      </button>
                      <button
                        class="action-btn"
                        onclick={() => openEditModal(subCategory)}
                        title={$_("common.edit") || "Edit"}
                      >
                        <EditOutline size="sm" />
                      </button>
                      <button
                        class="action-btn delete"
                        onclick={() => openDeleteModal(subCategory)}
                        title={$_("common.delete") || "Delete"}
                      >
                        <TrashBinOutline size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <div class="pagination-info">
          {$_("common.page") || "Page"}
          {currentPage}
          {$_("common.of") || "of"}
          {totalPages}
        </div>
        <div class="pagination-pages">
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
            {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
              <button
                class="page-btn"
                class:active={page === currentPage}
                onclick={() => handlePageChange(page)}
              >
                {page}
              </button>
            {:else if page === currentPage - 2 || page === currentPage + 2}
              <span class="page-ellipsis">...</span>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal Components -->
<CreateCategoryModal
  bind:show={showCreateModal}
  onClose={closeCreateModal}
  onSubmit={handleCreateCategory}
  {parentCategories}
  {specifications}
/>

<EditCategoryModal
  bind:show={showEditModal}
  onClose={closeEditModal}
  onSubmit={handleUpdateCategory}
  {parentCategories}
  {specifications}
  category={selectedCategory}
  initialData={editFormData}
/>

<DeleteCategoryModal
  bind:show={showDeleteModal}
  onClose={closeDeleteModal}
  onConfirm={handleDeleteCategory}
  category={selectedCategory}
/>

<!-- Category Details Modal -->
{#if showDetailsModal && selectedCategoryForDetails}
  <div
    class="modal-overlay"
    onclick={closeDetailsModal}
    onkeydown={(e) => e.key === "Escape" && closeDetailsModal()}
    role="button"
    tabindex="0"
    aria-label="Close modal"
  >
    <div
      class="modal-content details-modal"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-labelledby="modal-title"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">
          {$_("common.category_details") || "Category Details"}
        </h2>
        <button
          class="modal-close"
          onclick={closeDetailsModal}
          aria-label={$_("common.close") || "Close"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body details-content">
        <div class="detail-section">
          <h3 class="detail-section-title">
            {$_("common.basic_info") || "Basic Information"}
          </h3>

          <div class="detail-row">
            <span class="detail-label">{$_("common.name") || "Name"}:</span>
            <span class="detail-value"
              >{getLocalizedDisplayName(
                selectedCategoryForDetails,
                $locale,
              )}</span
            >
          </div>

          <div class="detail-row">
            <span class="detail-label"
              >{$_("common.shortname") || "Shortname"}:</span
            >
            <span class="detail-value mono"
              >{selectedCategoryForDetails.shortname}</span
            >
          </div>

          <div class="detail-row">
            <span class="detail-label"
              >{$_("common.description") || "Description"}:</span
            >
            <span class="detail-value">
              {selectedCategoryForDetails.attributes?.payload?.body
                ?.meta_description ||
                $_("admin_dashboard.no_description_available") ||
                "No description available"}
            </span>
          </div>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">
            {$_("common.hierarchy") || "Hierarchy"}
          </h3>

          <div class="detail-row">
            <span class="detail-label">{$_("common.level") || "Level"}:</span>
            <span class="detail-value">
              <span
                class="level-badge"
                style="background-color: {getLevelColor(
                  getCategoryLevel(selectedCategoryForDetails),
                )}15; color: {getLevelColor(
                  getCategoryLevel(selectedCategoryForDetails),
                )};"
              >
                Level {getCategoryLevel(selectedCategoryForDetails)}
              </span>
            </span>
          </div>

          <div class="detail-row">
            <span class="detail-label">{$_("common.order") || "Order"}:</span>
            <span class="detail-value"
              >{getCategoryOrder(selectedCategoryForDetails)}</span
            >
          </div>

          {#if selectedCategoryForDetails.attributes?.payload?.body?.parent_category_shortname}
            <div class="detail-row">
              <span class="detail-label"
                >{$_("common.parent_category") || "Parent Category"}:</span
              >
              <span class="detail-value mono"
                >{selectedCategoryForDetails.attributes.payload.body
                  .parent_category_shortname}</span
              >
            </div>
          {/if}
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">
            {$_("common.specifications") || "Specifications"}
          </h3>

          {#if getCategorySpecifications(selectedCategoryForDetails).length > 0}
            <div class="specifications-list">
              {#each getCategorySpecifications(selectedCategoryForDetails) as spec}
                <span class="specification-chip">{spec}</span>
              {/each}
            </div>
          {:else}
            <p class="empty-text">
              {$_("common.no_specifications") || "No specifications assigned"}
            </p>
          {/if}
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">
            {$_("common.metadata") || "Metadata"}
          </h3>

          <div class="detail-row">
            <span class="detail-label">{$_("common.status") || "Status"}:</span>
            <span class="detail-value">
              {#if selectedCategoryForDetails.attributes?.is_active}
                <span class="status-badge active"
                  >{$_("common.active") || "Active"}</span
                >
              {:else}
                <span class="status-badge inactive"
                  >{$_("common.inactive") || "Inactive"}</span
                >
              {/if}
            </span>
          </div>

          <div class="detail-row">
            <span class="detail-label"
              >{$_("common.created") || "Created"}:</span
            >
            <span class="detail-value"
              >{formatDate(
                selectedCategoryForDetails.attributes?.created_at,
                $locale,
              )}</span
            >
          </div>

          <div class="detail-row">
            <span class="detail-label"
              >{$_("common.updated") || "Updated"}:</span
            >
            <span class="detail-value"
              >{formatDate(
                selectedCategoryForDetails.attributes?.updated_at,
                $locale,
              )}</span
            >
          </div>

          <div class="detail-row">
            <span class="detail-label">{$_("common.owner") || "Owner"}:</span>
            <span class="detail-value mono"
              >{selectedCategoryForDetails.attributes?.owner_shortname ||
                "N/A"}</span
            >
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDetailsModal}>
          {$_("common.close") || "Close"}
        </button>
      </div>
    </div>
  </div>
{/if}

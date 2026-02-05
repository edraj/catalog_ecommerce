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
  import { ResourceType } from "@edraj/tsdmart";
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
    SearchOutline,
  } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName, formatDate } from "@/lib/utils/adminUtils";
  import { formatNumber } from "@/lib/helpers";
  import { Pagination } from "@/components/ui";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let brands = $state([]);
  let filteredBrands = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedBrand = $state(null);
  let searchTerm = $state("");
  let topBrandsFilter = $state("all");
  let totalBrandsCount = $state(0);
  let allBrandsCache = $state([]);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let paginatedBrands = $derived.by(() => {
    if (searchTerm || topBrandsFilter !== "all") {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      return filteredBrands.slice(start, end);
    }
    return brands;
  });

  let totalPages = $derived.by(() => {
    if (searchTerm || topBrandsFilter !== "all") {
      return Math.ceil(filteredBrands.length / itemsPerPage);
    }
    return Math.ceil(totalBrandsCount / itemsPerPage);
  });

  let createForm = $state({
    displayname_en: "",
    displayname_ar: "",
    displayname_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    meta_title_en: "",
    meta_description_en: "",
    isTop: false,
    boost_value: 0,
    logo: null,
  });

  let editForm = $state({
    displayname_en: "",
    displayname_ar: "",
    displayname_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    meta_title_en: "",
    meta_description_en: "",
    isTop: false,
    boost_value: 0,
    logo: null,
  });

  onMount(async () => {
    await loadBrands();
  });

  async function loadBrands() {
    isLoading = true;
    const offset = (currentPage - 1) * itemsPerPage;

    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        itemsPerPage,
        offset,
        true,
      );

      if (response?.records) {
        brands = response.records;
        totalBrandsCount =
          response.attributes?.total || response.records.length;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
      errorToastMessage("Failed to load brands");
    } finally {
      isLoading = false;
    }
  }

  async function loadAllBrandsForFiltering() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        allBrandsCache = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading brands for filtering:", error);
      errorToastMessage("Failed to load brands");
    }
  }

  function applyFilters() {
    let result = [...allBrandsCache];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((brand) => {
        const displayname = getLocalizedDisplayName(
          brand,
          $locale,
        ).toLowerCase();
        const shortname = brand.shortname?.toLowerCase() || "";
        const description =
          brand.attributes?.description?.[$locale]?.toLowerCase() || "";
        return (
          displayname.includes(searchLower) ||
          shortname.includes(searchLower) ||
          description.includes(searchLower)
        );
      });
    }

    if (topBrandsFilter === "top") {
      result = result.filter(
        (brand) => brand.attributes?.payload?.body?.top === true,
      );
    } else if (topBrandsFilter === "regular") {
      result = result.filter(
        (brand) => brand.attributes?.payload?.body?.top !== true,
      );
    }

    filteredBrands = result;
    currentPage = 1;
  }

  function openCreateModal() {
    createForm = {
      displayname_en: "",
      displayname_ar: "",
      displayname_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      meta_title_en: "",
      meta_description_en: "",
      isTop: false,
      boost_value: 0,
      logo: null,
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(brand) {
    selectedBrand = brand;
    editForm = {
      displayname_en: brand.attributes?.displayname?.en || "",
      displayname_ar: brand.attributes?.displayname?.ar || "",
      displayname_ku: brand.attributes?.displayname?.ku || "",
      description_en: brand.attributes?.description?.en || "",
      description_ar: brand.attributes?.description?.ar || "",
      description_ku: brand.attributes?.description?.ku || "",
      meta_title_en: brand.attributes?.payload?.body?.meta_title?.en || "",
      meta_description_en:
        brand.attributes?.payload?.body?.meta_description?.en || "",
      isTop: brand.attributes?.payload?.body?.top === true,
      boost_value: brand.attributes?.payload?.body?.boost_value || 0,
      logo: null,
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedBrand = null;
  }

  function openDeleteModal(brand) {
    selectedBrand = brand;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedBrand = null;
  }

  async function handleCreateBrand() {
    if (!createForm.displayname_en.trim()) {
      errorToastMessage("Please enter a brand name in English");
      return;
    }

    try {
      const brandData = {
        displayname_en: createForm.displayname_en,
        displayname_ar: createForm.displayname_ar || createForm.displayname_en,
        displayname_ku: createForm.displayname_ku || null,

        description_en: createForm.description_en,
        description_ar: createForm.description_ar || createForm.description_en,
        description_ku: createForm.description_ku || null,
        body: {
          top: createForm.isTop,
          boost_value: createForm.boost_value,
          meta_title: createForm.meta_title_en,
          meta_description: createForm.meta_description_en,
        },
        tags: [],
        is_active: true,
      };

      if (!brandData.body.meta_title) delete brandData.body.meta_title;
      if (!brandData.body.meta_description)
        delete brandData.body.meta_description;

      await createEntity(
        brandData,
        website.main_space,
        "/brands",
        ResourceType.content,
        "",
        "",
      );

      successToastMessage("Brand created successfully!");
      closeCreateModal();
      await loadBrands();
    } catch (error) {
      console.error("Error creating brand:", error);
      errorToastMessage("Failed to create brand");
    }
  }

  async function handleUpdateBrand() {
    if (!editForm.displayname_en.trim()) {
      errorToastMessage("Please enter a brand name in English");
      return;
    }

    if (!selectedBrand) return;

    try {
      const brandData = {
        displayname: {
          en: editForm.displayname_en,
          ar: editForm.displayname_ar || editForm.displayname_en,
          ku: editForm.displayname_ku || null,
        },
        description: {
          en: editForm.description_en,
          ar: editForm.description_ar || editForm.description_en,
          ku: editForm.description_ku || null,
        },
        body: {
          top: editForm.isTop,
          boost_value: editForm.boost_value,
          meta_title: editForm.meta_title_en,
          meta_description: editForm.meta_description_en,
        },
        tags: selectedBrand.attributes?.tags || [],
        is_active: true,
      };

      if (!brandData.body.meta_title) delete brandData.body.meta_title;
      if (!brandData.body.meta_description)
        delete brandData.body.meta_description;

      await updateEntity(
        selectedBrand.shortname,
        website.main_space,
        selectedBrand.subpath,
        selectedBrand.resource_type,
        brandData,
        "",
        "",
      );

      successToastMessage("Brand updated successfully!");
      closeEditModal();
      await loadBrands();
    } catch (error) {
      console.error("Error updating brand:", error);
      errorToastMessage("Failed to update brand");
    }
  }

  async function handleDeleteBrand() {
    if (!selectedBrand) return;

    try {
      await deleteEntity(
        selectedBrand.shortname,
        website.main_space,
        selectedBrand.subpath,
        selectedBrand.resource_type,
      );

      successToastMessage("Brand deleted successfully!");
      closeDeleteModal();
      await loadBrands();
    } catch (error) {
      console.error("Error deleting brand:", error);
      errorToastMessage("Failed to delete brand");
    }
  }

  function handlePageChange(page: number) {
    currentPage = page;
    if (!searchTerm && topBrandsFilter === "all") {
      loadBrands();
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      if (!searchTerm && topBrandsFilter === "all") {
        loadBrands();
      }
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      if (!searchTerm && topBrandsFilter === "all") {
        loadBrands();
      }
    }
  }

  $effect(() => {
    if (searchTerm || topBrandsFilter !== "all") {
      if (allBrandsCache.length === 0) {
        loadAllBrandsForFiltering();
      } else {
        applyFilters();
      }
    } else {
      loadBrands();
    }
  });
</script>

<div class="brands-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon" style="background: #dbeafe;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">{$_("brands.total") || "Total Brands"}</p>
        <h3 class="stat-value">
          {formatNumber(
            searchTerm || topBrandsFilter !== "all"
              ? allBrandsCache.length
              : totalBrandsCount,
            $locale,
          )}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #d1fae5;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">{$_("brands.top_brands") || "Top Brands"}</p>
        <h3 class="stat-value">
          {formatNumber(
            (searchTerm || topBrandsFilter !== "all"
              ? allBrandsCache
              : brands
            ).filter((b) => b.attributes?.payload?.body?.top === true).length,
            $locale,
          )}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #fef3c7;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M7 7h10v10H7z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">{$_("brands.regular") || "Regular Brands"}</p>
        <h3 class="stat-value">
          {formatNumber(
            (searchTerm || topBrandsFilter !== "all"
              ? allBrandsCache
              : brands
            ).filter((b) => b.attributes?.payload?.body?.top !== true).length,
            $locale,
          )}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #e0e7ff;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">{$_("brands.showing") || "Showing"}</p>
        <h3 class="stat-value">
          {formatNumber(
            searchTerm || topBrandsFilter !== "all"
              ? filteredBrands.length
              : Math.min(
                  itemsPerPage,
                  totalBrandsCount - (currentPage - 1) * itemsPerPage,
                ),
            $locale,
          )}
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
        placeholder={$_("brands.search_placeholder") || "Search brands..."}
        class="search-input"
        class:rtl={$isRTL}
      />
      <button class="search-btn">
        <SearchOutline size="sm" />
      </button>
    </div>

    <div class="filters">
      <select
        bind:value={topBrandsFilter}
        class="filter-select"
        class:rtl={$isRTL}
      >
        <option value="all">{$_("brands.all_brands") || "All Brands"}</option>
        <option value="top">{$_("brands.top_brands") || "Top Brands"}</option>
        <option value="regular"
          >{$_("brands.regular_brands") || "Regular Brands"}</option
        >
      </select>
    </div>

    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span>{$_("brands.create_brand") || "Create Brand"}</span>
    </button>
  </div>

  <!-- Content -->
  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("brands.loading") || "Loading brands..."}</p>
    </div>
  {:else if paginatedBrands.length === 0 && !searchTerm && topBrandsFilter === "all"}
    <div class="empty-state">
      <div class="empty-icon">🏷️</div>
      <h3>{$_("brands.no_brands") || "No brands found"}</h3>
      <p>
        {$_("brands.no_brands_description") ||
          "Create your first brand to get started"}
      </p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span
          >{$_("brands.create_first_brand") || "Create Your First Brand"}</span
        >
      </button>
    </div>
  {:else}
    <div class="brands-table-container">
      <table class="brands-table">
        <thead>
          <tr>
            <th>{$_("brands.name") || "Brand Name"}</th>
            <th>{$_("brands.description") || "Description"}</th>
            <th>{$_("brands.status") || "Status"}</th>
            <th>{$_("brands.boost") || "Boost"}</th>
            <th>{$_("brands.created") || "Created"}</th>
            <th>{$_("brands.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedBrands as brand (brand.shortname)}
            <tr class="brand-row">
              <td>
                <div class="brand-info">
                  <div class="brand-icon">
                    {getLocalizedDisplayName(brand, $locale)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div class="brand-name" class:rtl={$isRTL}>
                      {getLocalizedDisplayName(brand, $locale)}
                    </div>
                    <div class="brand-shortname">{brand.shortname}</div>
                  </div>
                </div>
              </td>
              <td>
                <p class="brand-description" class:rtl={$isRTL}>
                  {brand.attributes?.description?.[$locale] ||
                    brand.attributes?.description?.en ||
                    "-"}
                </p>
              </td>
              <td>
                {#if brand.attributes?.payload?.body?.top === true}
                  <span class="status-badge top">
                    <svg
                      class="badge-icon"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      />
                    </svg>
                    {$_("brands.top") || "Top Brand"}
                  </span>
                {:else}
                  <span class="status-badge regular">
                    {$_("brands.regular") || "Regular"}
                  </span>
                {/if}
              </td>
              <td>
                <span class="boost-value"
                  >{brand.attributes?.payload?.body?.boost_value || 0}</span
                >
              </td>
              <td>
                <span class="date-text"
                  >{formatDate(brand.attributes.created_at)}</span
                >
              </td>
              <td>
                <div class="actions-group">
                  <button
                    class="action-button edit"
                    onclick={() => openEditModal(brand)}
                    title={$_("brands.edit") || "Edit"}
                  >
                    <EditOutline size="sm" />
                  </button>
                  <button
                    class="action-button delete"
                    onclick={() => openDeleteModal(brand)}
                    title={$_("brands.delete") || "Delete"}
                  >
                    <TrashBinOutline size="sm" />
                  </button>
                </div>
              </td>
            </tr>
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

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={$isRTL}>
          {$_("brands.create_brand") || "Create Brand"}
        </h2>
        <button class="modal-close" onclick={closeCreateModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.basic_info") || "Basic Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_en") || "Brand Name (English)"}
              <span class="required">*</span>
            </label>
            <input
              type="text"
              bind:value={createForm.displayname_en}
              placeholder="e.g., Apple, Samsung"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_ar") || "Brand Name (Arabic)"}
            </label>
            <input
              type="text"
              bind:value={createForm.displayname_ar}
              placeholder="مثال: آبل، سامسونج"
              class="form-input rtl"
            />
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.descriptions") || "Descriptions"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_en") || "Description (English)"}
            </label>
            <textarea
              bind:value={createForm.description_en}
              rows="3"
              placeholder="Brief description of the brand..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_ar") || "Description (Arabic)"}
            </label>
            <textarea
              bind:value={createForm.description_ar}
              rows="3"
              placeholder="وصف مختصر للعلامة التجارية..."
              class="form-textarea rtl"
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.seo_info") || "SEO Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_title_en") || "Meta Title (English)"}
            </label>
            <input
              type="text"
              bind:value={createForm.meta_title_en}
              placeholder="SEO title for search engines..."
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_description_en") || "Meta Description (English)"}
            </label>
            <textarea
              bind:value={createForm.meta_description_en}
              rows="3"
              placeholder="SEO description for search engines..."
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            {$_("brands.boost_value") || "Boost Value"}
          </label>
          <input
            type="number"
            bind:value={createForm.boost_value}
            min="0"
            placeholder="0"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={createForm.isTop}
              class="form-checkbox"
            />
            <span class:rtl={$isRTL}>
              {$_("brands.mark_as_top") || "Mark as Top Brand"}
            </span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button-secondary" onclick={closeCreateModal}>
          {$_("brands.cancel") || "Cancel"}
        </button>
        <button class="button-primary" onclick={handleCreateBrand}>
          {$_("brands.create") || "Create Brand"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && selectedBrand}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={$isRTL}>
          {$_("brands.edit_brand") || "Edit Brand"}
        </h2>
        <button class="modal-close" onclick={closeEditModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.basic_info") || "Basic Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_en") || "Brand Name (English)"}
              <span class="required">*</span>
            </label>
            <input
              type="text"
              bind:value={editForm.displayname_en}
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_ar") || "Brand Name (Arabic)"}
            </label>
            <input
              type="text"
              bind:value={editForm.displayname_ar}
              class="form-input rtl"
            />
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.descriptions") || "Descriptions"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_en") || "Description (English)"}
            </label>
            <textarea
              bind:value={editForm.description_en}
              rows="3"
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_ar") || "Description (Arabic)"}
            </label>
            <textarea
              bind:value={editForm.description_ar}
              rows="3"
              class="form-textarea rtl"
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.seo_info") || "SEO Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_title_en") || "Meta Title (English)"}
            </label>
            <input
              type="text"
              bind:value={editForm.meta_title_en}
              placeholder="SEO title for search engines..."
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_description_en") || "Meta Description (English)"}
            </label>
            <textarea
              bind:value={editForm.meta_description_en}
              rows="3"
              placeholder="SEO description for search engines..."
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            {$_("brands.boost_value") || "Boost Value"}
          </label>
          <input
            type="number"
            bind:value={editForm.boost_value}
            min="0"
            placeholder="0"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={editForm.isTop}
              class="form-checkbox"
            />
            <span class:rtl={$isRTL}>
              {$_("brands.mark_as_top") || "Mark as Top Brand"}
            </span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button-secondary" onclick={closeEditModal}>
          {$_("brands.cancel") || "Cancel"}
        </button>
        <button class="button-primary" onclick={handleUpdateBrand}>
          {$_("brands.update") || "Update Brand"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && selectedBrand}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div class="modal-content small" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={$isRTL}>
          {$_("brands.delete_brand") || "Delete Brand"}
        </h2>
        <button class="modal-close" onclick={closeDeleteModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="delete-confirmation">
          <div class="delete-icon">
            <TrashBinOutline />
          </div>
          <p class="delete-message" class:rtl={$isRTL}>
            {$_("brands.delete_confirmation") ||
              "Are you sure you want to delete this brand?"}
          </p>
          <p class="delete-brand-name" class:rtl={$isRTL}>
            <strong>{getLocalizedDisplayName(selectedBrand, $locale)}</strong>
          </p>
          <p class="delete-warning" class:rtl={$isRTL}>
            {$_("brands.delete_warning") || "This action cannot be undone."}
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button-secondary" onclick={closeDeleteModal}>
          {$_("brands.cancel") || "Cancel"}
        </button>
        <button class="button-danger" onclick={handleDeleteBrand}>
          {$_("brands.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

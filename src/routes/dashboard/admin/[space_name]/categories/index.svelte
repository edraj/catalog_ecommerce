<script lang="ts">
  import { onMount } from "svelte";
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
  } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName, formatDate } from "@/lib/utils/adminUtils";
  import {
    getCategoryParentId,
    getParentCategoryName,
    isParentCategory,
    getSubCategories,
    getEntityContent,
    buildEntityPayload,
    countSubCategories,
  } from "@/lib/utils/entityUtils";
  import { validateCategoryForm } from "@/lib/utils/validationUtils";
  import {
    Button,
    IconButton,
    LoadingSpinner,
    EmptyState,
  } from "@/components/ui";
  import {
    CreateCategoryModal,
    EditCategoryModal,
    DeleteCategoryModal,
  } from "@/components/modals";
  import type { CategoryFormData } from "@/components/modals/CreateCategoryModal.svelte";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let categories = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedCategory = $state(null);
  let selectedParentFilter = $state("all");
  let expandedCategories = $state(new Set());
  let editFormData = $state<CategoryFormData | undefined>(undefined);

  onMount(async () => {
    await loadCategories();
  });

  async function loadCategories() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        categories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Failed to load categories");
    } finally {
      isLoading = false;
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
      parent_category_id: content?.parent_category_id || "",
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

  async function handleCreateCategory(formData: CategoryFormData) {
    if (!formData.displayname.trim()) {
      errorToastMessage("Please enter a category name");
      return;
    }

    try {
      const categoryData = {
        displayname: formData.displayname,
        description: formData.description,
        body: {
          content: {
            name: formData.displayname,
            description: formData.description,
            parent_category_id: formData.parent_category_id || null,
          },
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        categoryData,
        "e_commerce",
        "/categories",
        ResourceType.content,
        "",
        ""
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
        content: {
          name: formData.displayname,
          description: formData.description,
          parent_category_id: formData.parent_category_id || null,
        },
        content_type: "json",
        tags: selectedCategory.attributes?.tags || [],
        is_active: true,
      };

      await updateEntity(
        selectedCategory.shortname,
        "e_commerce",
        selectedCategory.subpath,
        selectedCategory.resource_type,
        categoryData,
        "",
        ""
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
        "e_commerce",
        selectedCategory.subpath,
        selectedCategory.resource_type
      );

      successToastMessage("Category deleted successfully!");
      closeDeleteModal();
      await loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      errorToastMessage("Failed to delete category");
    }
  }

  // Helper functions now imported from utility modules

  function toggleCategory(categoryId) {
    console.log("Toggling category:", categoryId);
    if (expandedCategories.has(categoryId)) {
      expandedCategories.delete(categoryId);
      expandedCategories = new Set(expandedCategories);
    } else {
      expandedCategories.add(categoryId);
      expandedCategories = new Set(expandedCategories);
    }
    console.log("Expanded categories:", expandedCategories);
  }

  function isExpanded(categoryId) {
    return expandedCategories.has(categoryId);
  }

  const parentCategories = $derived.by(() => {
    return categories.filter((c) => isParentCategory(c));
  });

  const filteredCategories = $derived.by(() => {
    if (selectedParentFilter === "all" || selectedParentFilter === "root") {
      return parentCategories;
    } else {
      return getSubCategories(selectedParentFilter, categories);
    }
  });
</script>

<div class="categories-page" class:rtl={$isRTL}>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1 class="page-title">
          {$_("admin_dashboard.categories") || "Categories"}
        </h1>
        <p class="page-description">
          {$_("admin_dashboard.categories_description") ||
            "Manage your product categories"}
        </p>
      </div>
      <Button variant="primary" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span>{$_("admin_dashboard.create_category") || "New Category"}</span>
      </Button>
    </div>

    {#if !isLoading && categories.length > 0}
      <div class="filters">
        <label for="parent-filter"
          >{$_("common.filter_by_parent") || "Filter by Parent"}:</label
        >
        <select
          id="parent-filter"
          bind:value={selectedParentFilter}
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
            <option value={parent.shortname}
              >{getLocalizedDisplayName(parent)} ({$_(
                "common.sub_categories"
              ) || "Sub-categories"})</option
            >
          {/each}
        </select>
      </div>
    {/if}

    {#if isLoading}
      <LoadingSpinner message={$_("common.loading") || "Loading..."} />
    {:else if categories.length === 0}
      <EmptyState
        icon="📂"
        title={$_("admin_dashboard.no_categories") || "No categories yet"}
        description="Create your first category to get started"
      >
        {#snippet action()}
          <Button variant="primary" onclick={openCreateModal}>
            <PlusOutline size="sm" />
            {$_("admin_dashboard.create_first_category") || "Create Category"}
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="categories-list">
        <div class="list-header">
          <div class="list-col col-name">Name</div>
          <div class="list-col col-description">Description</div>
          <div class="list-col col-date">Created</div>
          <div class="list-col col-actions">Actions</div>
        </div>
        {#each filteredCategories as category}
          {@const subCategories = getSubCategories(
            category.shortname,
            categories
          )}
          {@const hasSubCategories = subCategories.length > 0}
          {@const expanded = isExpanded(category.shortname)}

          <!-- Parent Category Row -->
          <div
            class="list-row"
            class:has-children={hasSubCategories}
            class:sub-category={!isParentCategory(category)}
          >
            <div class="list-col col-name">
              <div class="name-content">
                {#if hasSubCategories}
                  <button
                    class="expand-button"
                    onclick={() => toggleCategory(category.shortname)}
                    title={expanded ? "Collapse" : "Expand"}
                  >
                    <span class="expand-icon" class:expanded>▶</span>
                  </button>
                {:else if !isParentCategory(category)}
                  <span class="sub-category-icon">↳</span>
                {/if}
                <div class="name-wrapper">
                  <span class="category-name"
                    >{getLocalizedDisplayName(category, $locale)}</span
                  >
                  <span class="category-shortname">{category.shortname}</span>
                </div>
                {#if hasSubCategories}
                  <span class="sub-count-badge">{subCategories.length}</span>
                {/if}
              </div>
            </div>
            <div class="list-col col-description">
              {category.attributes?.payload.body.content.description ||
                "No description"}
            </div>
            <div class="list-col col-date">
              {formatDate(category.attributes?.created_at, $locale)}
            </div>
            <div class="list-col col-actions">
              <IconButton onclick={() => openEditModal(category)} title="Edit">
                <EditOutline size="sm" />
              </IconButton>
              <IconButton
                variant="delete"
                onclick={() => openDeleteModal(category)}
                title="Delete"
              >
                <TrashBinOutline size="sm" />
              </IconButton>
            </div>
          </div>

          <!-- Sub-Categories (Collapsible) -->
          {#if hasSubCategories && expanded}
            {#each subCategories as subCategory}
              <div class="list-row sub-category">
                <div class="list-col col-name">
                  <div class="name-content">
                    <span class="sub-category-icon">↳</span>
                    <div class="name-wrapper">
                      <span class="category-name"
                        >{getLocalizedDisplayName(subCategory, $locale)}</span
                      >
                      <span class="category-shortname"
                        >{subCategory.shortname}</span
                      >
                    </div>
                  </div>
                </div>
                <div class="list-col col-description">
                  {subCategory.attributes?.payload.body.content.description ||
                    "No description"}
                </div>
                <div class="list-col col-date">
                  {formatDate(subCategory.attributes?.created_at, $locale)}
                </div>
                <div class="list-col col-actions">
                  <IconButton
                    onclick={() => openEditModal(subCategory)}
                    title="Edit"
                  >
                    <EditOutline size="sm" />
                  </IconButton>
                  <IconButton
                    variant="delete"
                    onclick={() => openDeleteModal(subCategory)}
                    title="Delete"
                  >
                    <TrashBinOutline size="sm" />
                  </IconButton>
                </div>
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal Components -->
<CreateCategoryModal
  bind:show={showCreateModal}
  onClose={closeCreateModal}
  onSubmit={handleCreateCategory}
  {parentCategories}
/>

<EditCategoryModal
  bind:show={showEditModal}
  onClose={closeEditModal}
  onSubmit={handleUpdateCategory}
  {parentCategories}
  category={selectedCategory}
  initialData={editFormData}
/>

<DeleteCategoryModal
  bind:show={showDeleteModal}
  onClose={closeDeleteModal}
  onConfirm={handleDeleteCategory}
  category={selectedCategory}
/>

<style>
  .categories-page {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 2rem 1rem;
  }

  .rtl {
    direction: rtl;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .page-description {
    font-size: 0.95rem;
    color: #6b7280;
    margin: 0;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    background: white;
    padding: 1rem 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
  }

  .filters label {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    color: #1a1a1a;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 220px;
  }

  .filter-select:hover {
    border-color: #9ca3af;
  }

  .filter-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .categories-list {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    background: #f9fafb;
    padding: 1rem;
    border-bottom: 2px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .list-row {
    display: flex;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    transition: background-color 0.15s;
    align-items: center;
  }

  .list-row:last-child {
    border-bottom: none;
  }

  .list-row:hover {
    background: #f9fafb;
  }

  .list-row.sub-category {
    background: #f8faff;
  }

  .list-row.sub-category:hover {
    background: #eff6ff;
  }

  .list-row.has-children {
    font-weight: 500;
  }

  .list-col {
    padding: 0 0.5rem;
    font-size: 0.875rem;
  }

  .col-name {
    flex: 0 0 25%;
    min-width: 0;
  }

  .col-description {
    flex: 0 0 40%;
    min-width: 0;
    color: #6b7280;
    line-height: 1.5;
  }

  .col-date {
    flex: 0 0 17%;
    min-width: 0;
    color: #6b7280;
    font-size: 0.8rem;
  }

  .col-actions {
    flex: 0 0 15%;
    min-width: 0;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .name-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .expand-button {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    transition: all 0.2s ease;
    border-radius: 0.25rem;
  }

  .expand-button:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .expand-icon {
    font-size: 0.75rem;
    transition: transform 0.2s ease;
    display: inline-block;
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .sub-category-icon {
    color: #2563eb;
    font-size: 1.2rem;
    font-weight: bold;
    flex-shrink: 0;
  }

  .name-wrapper {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .category-name {
    display: block;
    font-weight: 600;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .category-shortname {
    display: block;
    font-size: 0.75rem;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: 0.5rem;
  }

  @media (max-width: 1024px) {
    .col-description {
      flex: 0 0 30%;
    }

    .col-name {
      flex: 0 0 28%;
    }
  }

  @media (max-width: 768px) {
    .categories-list {
      overflow-x: auto;
    }

    .list-header,
    .list-row {
      min-width: 700px;
    }
  }

  @media (max-width: 480px) {
    .list-header,
    .list-row {
      font-size: 0.75rem;
      padding: 0.75rem;
    }

    .list-col {
      padding: 0 0.25rem;
    }
  }

  .sub-category-icon {
    color: #2563eb;
    font-size: 1.2rem;
    font-weight: bold;
  }

  .category-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
    line-height: 1.4;
  }

  @media (max-width: 768px) {
    .categories-page {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
      margin-bottom: 1.5rem;
    }

    .page-title {
      font-size: 1.5rem;
    }
  }
</style>

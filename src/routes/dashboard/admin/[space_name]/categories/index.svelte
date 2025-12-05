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

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
  import { log } from "@/lib/logger";

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
   function getSelectedParentFilterLabel() {
    if (selectedParentFilter === "all")
      return $_("common.all_categories") || "All Categories";

    if (selectedParentFilter === "root")
      return $_("common.parent_categories_only") || "Parent Categories Only";

    const found = parentCategories?.find((c) => c.shortname === selectedParentFilter)
      ?? categories?.find((c) => c.shortname === selectedParentFilter);

    return found ? getLocalizedDisplayName(found, $locale) : selectedParentFilter;
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
  
  let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(item.id ?? item.shortname ?? crypto.randomUUID());
  }

  function toggleActions(item: any) {
    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeActions() {
    openActionsFor = null;
  }

  function onWindowClick() {
    if (openActionsFor) closeActions();
  }

  function formatDateDMY(value?: string) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getStatus(item: any): "pending" | "active" | "inactive" {
    const s = String(item?.attributes?.status ?? "").toLowerCase();
    if (s === "pending") return "pending";
    if (s === "active") return "active";
    if (s === "inactive") return "inactive";
    return item?.attributes?.is_active ? "active" : "inactive";
  }
</script>

<div class="categories-page" class:rtl={$isRTL}>
 
   <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.total_categories") || "Total Categories"}
        </h3>
        <p class="stat-value">{formatNumber(allCategoriesCache.length, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.active_categories") || "Active Categories"}
        </h3>
        <p class="stat-value">{formatNumber(activeCategories.length, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
       <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z" fill="#3C307F"/>
</svg>

      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.inactive_categories") || "Inactive Categories"}
        </h3>
        <p class="stat-value">{formatNumber(inactiveCategories.length, $locale)}</p>
      </div>
    </div>
  </div>
   <div
    class="flex flex-col search-table_header md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
  >
    <!-- SEARCH -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {$_("admin_dashboard.search_categories")}
      </label>

      <div class="relative w-[256px]">
        <div
          class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
        >
          <svg
            class="w-4 h-4 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin_dashboard.search_categories") }
          oninput={handleSearchOrFilterChange}
          class="w-full h-9 pl-9 pr-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm
               focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>

    <!-- CATEGORY FILTER DROPDOWN -->
    <div class="flex items-end">
      <!-- CREATE BUTTON -->
      <button
        onclick={openCreateModal}
        class="inline-flex items-center justify-center mx-2
            h-9 cursor-pointer
           px-3 py-2
           bg-[#3C307F] text-white text-sm font-medium
           rounded-[12px]
           shadow-[0px_1px_0.5px_0.05px_#1D293D05]
           hover:bg-[#2f2666]
           transition-colors duration-200"
      >
        <PlusOutline size="sm" />
        <span class="ml-2">
          {$_("admin_dashboard.create_category") || "Create Category"}
        </span>
      </button>
      <div class="mx-2">
        <details class="relative">
          <summary
            class="list-none cursor-pointer select-none
                h-9
               inline-flex items-center justify-between
               px-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm text-gray-700
               hover:bg-gray-50"
          >
            <span class="truncate">
              {getSelectedParentFilterLabel()}
            </span>
            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>

          <div
            class="absolute z-20 mt-2 w-[220px] h-[320px] overflow-y-scroll rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
          >
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => {
                selectedParentFilter = "all";
                handleSearchOrFilterChange();
              }}
            >
              {$_("common.all_categories") || "All Categories"}
            </button>

            <button  type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => {
                selectedParentFilter = "root";
                handleSearchOrFilterChange();
              }}
          >{$_("common.parent_categories_only") ||
            "Parent Categories Only"}</button
        >
            {#each categories as category}
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                onclick={() => {
                  selectedParentFilter = category.shortname;
                  handleSearchOrFilterChange();
                }}
              >
                {getLocalizedDisplayName(category)}
              </button>
            {/each}
          </div>
        </details>
      </div>

      
    </div>
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
    <tr
      class="category-row"
      class:expanded={isExpanded(category.shortname)}
      class:has-children={getSubCategories(category.shortname, categories).length > 0}
    >
      <!-- Expand -->
      <td class="col-expand">
        {#if getSubCategories(category.shortname, categories).length > 0}
          <button
            class="expand-btn"
            onclick={() => toggleCategory(category.shortname)}
            title={isExpanded(category.shortname)
              ? $_("common.collapse") || "Collapse"
              : $_("common.expand") || "Expand"}
          >
            <svg
              class="expand-icon"
              class:rotated={isExpanded(category.shortname)}
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

      <!-- Category (avatar + name + description) -->
      <td class="col-category">
        <div class="flex items-center gap-2.5" class:flex-row-reverse={$isRTL}>
          <div
            class="shrink-0 rounded-full flex items-center justify-center"
            style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
            aria-hidden="true"
          >
            <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
              {(getLocalizedDisplayName(category, $locale) || "C").charAt(0).toUpperCase()}
            </span>
          </div>

          <div class="min-w-0">
            <div
              class="truncate"
              style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
              title={getLocalizedDisplayName(category, $locale) || ""}
            >
              {getLocalizedDisplayName(category, $locale)}
            </div>
          </div>

          {#if getSubCategories(category.shortname, categories).length > 0}
            <span
              class="ml-auto"
              class:mr-auto={$isRTL}
              style="font-weight:500;font-size:12px;line-height:16px;color:#101828;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:8px;padding:2px 8px;"
            >
              {formatNumber(getSubCategories(category.shortname, categories).length, $locale)}
            </span>
          {/if}
        </div>
      </td>

      <!-- Level (keep your logic) -->
      <td class="col-level">
        <span
          class="level-badge"
          style="background-color: {getLevelColor(getCategoryLevel(category))}15; color: {getLevelColor(getCategoryLevel(category))};"
        >
          L{getCategoryLevel(category)}
        </span>
      </td>

      <!-- Description column (same content, styled) -->
      <td
        class="col-description"
        style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
      >
        <span class="truncate block" title={category.attributes?.payload?.body?.description || ""}>
          {category.attributes?.payload?.body?.description ||
            $_("admin_dashboard.no_description_available") ||
            "No description available"}
        </span>
      </td>

      <!-- Status pill -->
      <td class="col-status">
        {#if getStatus(category) === "pending"}
          <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
            style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2Z" fill="#1C398E"/>
            </svg>
            <span style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;">
              {$_("admin_dashboard.status.pending") || "Pending"}
            </span>
          </span>

        {:else if getStatus(category) === "active"}
          <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
            style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z" fill="#004F3B"/>
            </svg>
            <span style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;">
              {$_("common.active") || "Active"}
            </span>
          </span>

        {:else}
          <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
            style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M9.32268 2.64556C9.51843 2.84033 9.51922 3.15692 9.32445 3.35267L6.70534 5.98493L9.35444 8.64733C9.54921 8.84308 9.54842 9.15966 9.35267 9.35443C9.15692 9.5492 8.84033 9.54841 8.64556 9.35266L6 6.69381L3.35444 9.35266C3.15967 9.54841 2.84308 9.5492 2.64733 9.35443C2.45158 9.15966 2.45079 8.84308 2.64556 8.64733L5.29466 5.98493L2.67555 3.35267C2.48078 3.15692 2.48157 2.84034 2.67732 2.64556C2.87307 2.45079 3.18966 2.45159 3.38443 2.64734L6 5.27604L8.61557 2.64733C8.81035 2.45158 9.12693 2.45079 9.32268 2.64556Z" fill="#771D1D"/>
            </svg>
            <span style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;">
              {$_("common.inactive") || "Inactive"}
            </span>
          </span>
        {/if}
      </td>

      <!-- Created (icon + 15 Mar 2025) -->
      <td class="col-created">
        <div
          class="inline-flex items-center gap-2"
          style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
          class:flex-row-reverse={$isRTL}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2Z" fill="#6A7282"/>
          </svg>
          <span>{formatDateDMY(category.attributes?.created_at)}</span>
        </div>
      </td>

      <!-- Actions (... dropdown) -->
      <td class="col-actions">
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
            aria-label={$_("common.actions") || "Actions"}
            aria-haspopup="menu"
            aria-expanded={openActionsFor === getRowId(category)}
            onclick={() => toggleActions(category)}
          >
            <span class="text-xl leading-none">…</span>
          </button>

          {#if openActionsFor === getRowId(category)}
            <div
              class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
              style={$isRTL ? "right:-90px;" : "left:-90px;"}
              role="menu"
            >
              <button
                class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                class:text-right={$isRTL}
                onclick={() => {
                  closeActions();
                  openDetailsModal(category);
                }}
                role="menuitem"
              >
                {$_("common.details") || "Details"}
              </button>

              <button
                class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                class:text-right={$isRTL}
                onclick={() => {
                  closeActions();
                  openEditModal(category);
                }}
                role="menuitem"
              >
                {$_("common.edit") || "Edit"}
              </button>

              <button
                class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                class:text-right={$isRTL}
                onclick={() => {
                  closeActions();
                  openDeleteModal(category);
                }}
                role="menuitem"
              >
                {$_("common.delete") || "Delete"}
              </button>
            </div>
          {/if}
        </div>
      </td>
    </tr>

    <!-- Sub categories -->
    {#if isExpanded(category.shortname) && getSubCategories(category.shortname, categories).length > 0}
      {#each getSubCategories(category.shortname, categories) as subCategory}
        <tr class="category-row sub-category">
          <td class="col-expand"></td>

          <!-- repeat same layout for subCategory -->
          <td class="col-category">
            <div class="flex items-center gap-2.5" class:flex-row-reverse={$isRTL}>
              <div
                class="shrink-0 rounded-full flex items-center justify-center"
                style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
                aria-hidden="true"
              >
                <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
                  {(getLocalizedDisplayName(subCategory, $locale) || "C").charAt(0).toUpperCase()}
                </span>
              </div>

              <div class="min-w-0">
                <div
                  class="truncate"
                  style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
                  title={getLocalizedDisplayName(subCategory, $locale) || ""}
                >
                  {getLocalizedDisplayName(subCategory, $locale)}
                </div>

                <div
                  class="truncate mt-1"
                  style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                  title={subCategory.attributes?.payload?.body?.description || ""}
                >
                  {subCategory.attributes?.payload?.body?.description ||
                    $_("admin_dashboard.no_description_available") ||
                    "No description available"}
                </div>
              </div>
            </div>
          </td>

          <td class="col-level">
            <span
              class="level-badge"
              style="background-color: {getLevelColor(getCategoryLevel(subCategory))}15; color: {getLevelColor(getCategoryLevel(subCategory))};"
            >
              L{getCategoryLevel(subCategory)}
            </span>
          </td>

          <td
            class="col-description"
            style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
          >
            <span class="truncate block" title={subCategory.attributes?.payload?.body?.description || ""}>
              {subCategory.attributes?.payload?.body?.description ||
                $_("admin_dashboard.no_description_available") ||
                "No description available"}
            </span>
          </td>

          <td class="col-status">
            {#if getStatus(subCategory) === "pending"}
              <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
              >
                <span style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;">
                  {$_("admin_dashboard.status.pending") || "Pending"}
                </span>
              </span>
            {:else if getStatus(subCategory) === "active"}
              <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
              >
                <span style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;">
                  {$_("common.active") || "Active"}
                </span>
              </span>
            {:else}
              <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
              >
                <span style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;">
                  {$_("common.inactive") || "Inactive"}
                </span>
              </span>
            {/if}
          </td>

          <td class="col-created">
            <div
              class="inline-flex items-center gap-2"
              style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
              class:flex-row-reverse={$isRTL}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2Z" fill="#6A7282"/>
              </svg>
              <span>{formatDateDMY(subCategory.attributes?.created_at)}</span>
            </div>
          </td>

          <td class="col-actions">
            <div class="relative" onclick={(e) => e.stopPropagation()}>
              <button
                class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
                aria-label={$_("common.actions") || "Actions"}
                aria-haspopup="menu"
                aria-expanded={openActionsFor === getRowId(subCategory)}
                onclick={() => toggleActions(subCategory)}
              >
                <span class="text-xl leading-none">…</span>
              </button>

              {#if openActionsFor === getRowId(subCategory)}
                <div
                  class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                  style={$isRTL ? "right:0;" : "left:0;"}
                  role="menu"
                >
                  <button
                    class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                    class:text-right={$isRTL}
                    onclick={() => {
                      closeActions();
                      openDetailsModal(subCategory);
                    }}
                    role="menuitem"
                  >
                    {$_("common.details") || "Details"}
                  </button>

                  <button
                    class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                    class:text-right={$isRTL}
                    onclick={() => {
                      closeActions();
                      openEditModal(subCategory);
                    }}
                    role="menuitem"
                  >
                    {$_("common.edit") || "Edit"}
                  </button>

                  <button
                    class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                    class:text-right={$isRTL}
                    onclick={() => {
                      closeActions();
                      openDeleteModal(subCategory);
                    }}
                    role="menuitem"
                  >
                    {$_("common.delete") || "Delete"}
                  </button>
                </div>
              {/if}
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

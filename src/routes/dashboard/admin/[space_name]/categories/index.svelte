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

    const found =
      parentCategories?.find((c) => c.shortname === selectedParentFilter) ??
      categories?.find((c) => c.shortname === selectedParentFilter);

    return found
      ? getLocalizedDisplayName(found, $locale)
      : selectedParentFilter;
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
   function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      loadCategories();
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
      <div class="bg-icon rounded-lg flex items-center justify-center">
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
        <p class="stat-value">
          {formatNumber(allCategoriesCache.length, $locale)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
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
        <p class="stat-value">
          {formatNumber(activeCategories.length, $locale)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
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
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.inactive_categories") || "Inactive Categories"}
        </h3>
        <p class="stat-value">
          {formatNumber(inactiveCategories.length, $locale)}
        </p>
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
    <div
      class="flex flex-col search-table_header md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <!-- SEARCH -->
      <div>
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
            placeholder={$_("admin_dashboard.search_categories")}
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

              <button
                type="button"
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

        <!-- ACTIONS DROPDOWN -->
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
              <span>Actions</span>

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
              class="absolute z-20 mt-2 w-[180px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
            >
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              >
                Sort A → Z
              </button>

              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              >
                Sort Z → A
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>

    <div class="categories-table-container">
      <table class="categories-table">
        <thead>
          <tr>
            <th class="col-category">{$_("common.category") || "Category"}</th>
            <th class="col-level">{$_("common.level") || "Level"}</th>
            <th class="col-description"
              >{$_("common.description") || "Description"}</th
            >
            <th class="col-status">{$_("common.status") || "Status"}</th>
            <th class="col-created">{$_("common.created") || "Created"}</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedCategories as category}
            <tr
              class="category-row"
              class:expanded={isExpanded(category.shortname)}
              class:has-children={getSubCategories(
                category.shortname,
                categories,
              ).length > 0}
            >
              

              <!-- Category (avatar + name + description) -->
              <td class="col-category">
                <div
                  class="flex items-center gap-2.5"
                  class:flex-row-reverse={$isRTL}
                >
                  <div
                    class="shrink-0 rounded-full flex items-center justify-center"
                    style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
                    aria-hidden="true"
                  >
                    <span
                      style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                    >
                      {(getLocalizedDisplayName(category, $locale) || "C")
                        .charAt(0)
                        .toUpperCase()}
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
                      {formatNumber(
                        getSubCategories(category.shortname, categories).length,
                        $locale,
                      )}
                    </span>
                  {/if}
                </div>
              </td>

              <!-- Level (keep your logic) -->
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

              <!-- Description column (same content, styled) -->
              <td
                class="col-description"
                style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
              >
                <span
                  class="truncate block"
                  title={category.attributes?.payload?.body?.description || ""}
                >
                  {category.attributes?.payload?.body?.description ||
                    $_("admin_dashboard.no_description_available") ||
                    "No description available"}
                </span>
              </td>

              <!-- Status pill -->
              <td class="col-status">
                {#if getStatus(category) === "pending"}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2Z"
                        fill="#1C398E"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                    >
                      {$_("admin_dashboard.status.pending") || "Pending"}
                    </span>
                  </span>
                {:else if getStatus(category) === "active"}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z"
                        fill="#004F3B"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;"
                    >
                      {$_("common.active") || "Active"}
                    </span>
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.32268 2.64556C9.51843 2.84033 9.51922 3.15692 9.32445 3.35267L6.70534 5.98493L9.35444 8.64733C9.54921 8.84308 9.54842 9.15966 9.35267 9.35443C9.15692 9.5492 8.84033 9.54841 8.64556 9.35266L6 6.69381L3.35444 9.35266C3.15967 9.54841 2.84308 9.5492 2.64733 9.35443C2.45158 9.15966 2.45079 8.84308 2.64556 8.64733L5.29466 5.98493L2.67555 3.35267C2.48078 3.15692 2.48157 2.84034 2.67732 2.64556C2.87307 2.45079 3.18966 2.45159 3.38443 2.64734L6 5.27604L8.61557 2.64733C8.81035 2.45158 9.12693 2.45079 9.32268 2.64556Z"
                        fill="#771D1D"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;"
                    >
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z" fill="#6A7282"/>
</svg>

                  <span>{formatDateDMY(category.attributes?.created_at)}</span>
                </div>
              </td>

              <!-- Actions (... dropdown) -->
              <td class="col-actions">
                <div class="relative" onclick={(e) => e.stopPropagation()}>
                  <button
                    class="h-8 w-8 inline-flex items-center cursor-pointer justify-center rounded-md
       border border-transparent
       hover:bg-[#f4f5fe] hover:border-[#3C307F]
       transition"
                    aria-label={$_("common.actions") || "Actions"}
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(category)}
                    onclick={() => toggleActions(category)}
                  >
                    <span
                      class="text-xl leading-none flex justify-center items-center"
                      >…</span
                    >
                  </button>

                  {#if openActionsFor === getRowId(category)}
                    <div
                      class="absolute z-20 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                      style={$isRTL ? "right:-90px;" : "left:-90px;"}
                      role="menu"
                    >
                      <!-- Details -->
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-600"
                        class:flex-row-reverse={$isRTL}
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openDetailsModal(category);
                        }}
                        role="menuitem"
                      >
                        <svg
                          class="h-4 w-4 text-gray-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M4.0117 12C4.02312 12.0329 4.04406 12.0868 4.08184 12.1644C4.16842 12.3421 4.3101 12.5758 4.51263 12.851C4.91651 13.3997 5.51827 14.0535 6.2742 14.6801C7.80015 15.9449 9.83098 17 12 17C14.169 17 16.1999 15.9449 17.7258 14.6801C18.4817 14.0535 19.0835 13.3997 19.4874 12.851C19.6899 12.5758 19.8316 12.3421 19.9182 12.1644C19.9559 12.0868 19.9769 12.0329 19.9883 12C19.9769 11.9671 19.9559 11.9132 19.9182 11.8356C19.8316 11.6579 19.6899 11.4242 19.4874 11.149C19.0835 10.6003 18.4817 9.94649 17.7258 9.3199C16.1999 8.05506 14.169 7 12 7C9.83098 7 7.80015 8.05506 6.2742 9.3199C5.51827 9.94649 4.91651 10.6003 4.51263 11.149C4.3101 11.4242 4.16842 11.6579 4.08184 11.8356C4.04406 11.9132 4.02312 11.9671 4.0117 12ZM4.99787 7.7801C6.72929 6.34495 9.19846 5 12 5C14.8015 5 17.2707 6.34495 19.0021 7.7801C19.8749 8.50351 20.5911 9.2747 21.0981 9.96347C21.351 10.3071 21.5629 10.6452 21.7161 10.9597C21.8554 11.2456 22 11.6185 22 12C22 12.3815 21.8554 12.7544 21.7161 13.0403C21.5629 13.3548 21.351 13.6929 21.0981 14.0365C20.5911 14.7253 19.8749 15.4965 19.0021 16.2199C17.2707 17.6551 14.8015 19 12 19C9.19846 19 6.72929 17.6551 4.99787 16.2199C4.12513 15.4965 3.40886 14.7253 2.9019 14.0365C2.649 13.6929 2.43705 13.3548 2.28385 13.0403C2.14458 12.7544 2 12.3815 2 12C2 11.6185 2.14458 11.2456 2.28385 10.9597C2.43705 10.6452 2.649 10.3071 2.9019 9.96347C3.40886 9.2747 4.12513 8.50351 4.99787 7.7801ZM12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10ZM8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z"
                            fill="currentColor"
                          />
                        </svg>

                        <span>{$_("common.details") || "Details"}</span>
                      </button>

                      <!-- Edit -->
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-600"
                        class:flex-row-reverse={$isRTL}
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openEditModal(category);
                        }}
                        role="menuitem"
                      >
                        <!-- Pencil Icon -->
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          class="w-4 h-4 text-gray-500"
                        >
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M15.5763 5.55905L14.1547 7.028L15.5563 8.42618C15.5577 8.42761 15.5592 8.42904 15.5606 8.43048L17.0227 9.88908L18.4245 8.44058L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM15.6318 11.3265L14.8691 10.5657L10.0378 15.6235L10.7674 16.3531L15.6318 11.3265ZM8.92782 17.3419L7.95914 16.3732C7.95553 16.3699 7.95195 16.3665 7.94838 16.3631C7.93349 16.3489 7.91913 16.3343 7.90531 16.3194L6.93719 15.3513L5.9421 18.337L8.92782 17.3419ZM7.90282 13.4885L8.62322 14.2089L13.4529 9.15285L12.7638 8.46539L7.90282 13.4885ZM12.0308 6.34678C12.0319 6.34571 12.0329 6.34463 12.0339 6.34356L14.1455 4.16158L14.1573 4.14958C14.9124 3.39511 15.9362 2.97131 17.0036 2.97131C18.071 2.97131 19.0948 3.39511 19.8499 4.14958L19.8505 4.15018C20.605 4.90529 21.0288 5.92906 21.0288 6.99649C21.0288 8.06106 20.6072 9.0822 19.8566 9.83672L11.4977 18.4744C11.3859 18.59 11.2479 18.6768 11.0953 18.7277L4.67729 20.8667C4.31797 20.9864 3.92182 20.8929 3.654 20.6251C3.38618 20.3573 3.29266 19.9611 3.41241 19.6018L5.55141 13.1838C5.59875 13.0418 5.67738 12.9122 5.7815 12.8046L12.0308 6.34678Z"
                            fill="currentColor"
                          />
                        </svg>
                        <span>{$_("common.edit") || "Edit"}</span>
                      </button>

                      <!-- Delete -->
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                        class:flex-row-reverse={$isRTL}
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openDeleteModal(category);
                        }}
                        role="menuitem"
                      >
                        <!-- Trash Icon -->
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          x="0px"
                          y="0px"
                          class="w-4 h-4"
                          viewBox="0,0,256,256"
                        >
                          <g
                            fill="#fa5252"
                            fill-rule="nonzero"
                            stroke="none"
                            stroke-width="1"
                            stroke-linecap="butt"
                            stroke-linejoin="miter"
                            stroke-miterlimit="10"
                            stroke-dasharray=""
                            stroke-dashoffset="0"
                            font-family="none"
                            font-weight="none"
                            font-size="none"
                            text-anchor="none"
                            style="mix-blend-mode: normal"
                            ><g transform="scale(2,2)"
                              ><path
                                d="M49,1c-1.66,0 -3,1.34 -3,3c0,1.66 1.34,3 3,3h30c1.66,0 3,-1.34 3,-3c0,-1.66 -1.34,-3 -3,-3zM24,15c-7.17,0 -13,5.83 -13,13c0,7.17 5.83,13 13,13h77v63c0,9.37 -7.63,17 -17,17h-40c-9.37,0 -17,-7.63 -17,-17v-52c0,-1.66 -1.34,-3 -3,-3c-1.66,0 -3,1.34 -3,3v52c0,12.68 10.32,23 23,23h40c12.68,0 23,-10.32 23,-23v-63.35937c5.72,-1.36 10,-6.50062 10,-12.64062c0,-7.17 -5.83,-13 -13,-13zM24,21h80c3.86,0 7,3.14 7,7c0,3.86 -3.14,7 -7,7h-80c-3.86,0 -7,-3.14 -7,-7c0,-3.86 3.14,-7 7,-7zM50,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3zM78,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3z"
                              ></path></g
                            ></g
                          >
                        </svg>

                        <span>{$_("common.delete") || "Delete"}</span>
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
                    <div
                      class="flex items-center gap-2.5"
                      class:flex-row-reverse={$isRTL}
                    >
                      <div
                        class="shrink-0 rounded-full flex items-center justify-center"
                        style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
                        aria-hidden="true"
                      >
                        <span
                          style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                        >
                          {(
                            getLocalizedDisplayName(subCategory, $locale) || "C"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>

                      <div class="min-w-0">
                        <div
                          class="truncate"
                          style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
                          title={getLocalizedDisplayName(
                            subCategory,
                            $locale,
                          ) || ""}
                        >
                          {getLocalizedDisplayName(subCategory, $locale)}
                        </div>

                        <div
                          class="truncate mt-1"
                          style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                          title={subCategory.attributes?.payload?.body
                            ?.description || ""}
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
                      style="background-color: {getLevelColor(
                        getCategoryLevel(subCategory),
                      )}15; color: {getLevelColor(
                        getCategoryLevel(subCategory),
                      )};"
                    >
                      L{getCategoryLevel(subCategory)}
                    </span>
                  </td>

                  <td
                    class="col-description"
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  >
                    <span
                      class="truncate block"
                      title={subCategory.attributes?.payload?.body
                        ?.description || ""}
                    >
                      {subCategory.attributes?.payload?.body?.description ||
                        $_("admin_dashboard.no_description_available") ||
                        "No description available"}
                    </span>
                  </td>

                  <td class="col-status">
                    {#if getStatus(subCategory) === "pending"}
                      <span
                        class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                        style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                      >
                        <span
                          style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                        >
                          {$_("admin_dashboard.status.pending") || "Pending"}
                        </span>
                      </span>
                    {:else if getStatus(subCategory) === "active"}
                      <span
                        class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                        style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
                      >
                        <span
                          style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;"
                        >
                          {$_("common.active") || "Active"}
                        </span>
                      </span>
                    {:else}
                      <span
                        class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                        style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
                      >
                        <span
                          style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;"
                        >
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
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z" fill="#6A7282"/>
</svg>

                      <span
                        >{formatDateDMY(
                          subCategory.attributes?.created_at,
                        )}</span
                      >
                    </div>
                  </td>

                  <td class="col-actions">
                    <div class="relative" onclick={(e) => e.stopPropagation()}>
                      <button
                        class="h-8 w-8 inline-flex items-center justify-center rounded-md cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                        aria-label={$_("common.actions") || "Actions"}
                        aria-haspopup="menu"
                        aria-expanded={openActionsFor === getRowId(subCategory)}
                        onclick={() => toggleActions(subCategory)}
                      >
                        <svg
                          class="text-gray-500 w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M4.0117 12C4.02312 12.0329 4.04406 12.0868 4.08184 12.1644C4.16842 12.3421 4.3101 12.5758 4.51263 12.851C4.91651 13.3997 5.51827 14.0535 6.2742 14.6801C7.80015 15.9449 9.83098 17 12 17C14.169 17 16.1999 15.9449 17.7258 14.6801C18.4817 14.0535 19.0835 13.3997 19.4874 12.851C19.6899 12.5758 19.8316 12.3421 19.9182 12.1644C19.9559 12.0868 19.9769 12.0329 19.9883 12C19.9769 11.9671 19.9559 11.9132 19.9182 11.8356C19.8316 11.6579 19.6899 11.4242 19.4874 11.149C19.0835 10.6003 18.4817 9.94649 17.7258 9.3199C16.1999 8.05506 14.169 7 12 7C9.83098 7 7.80015 8.05506 6.2742 9.3199C5.51827 9.94649 4.91651 10.6003 4.51263 11.149C4.3101 11.4242 4.16842 11.6579 4.08184 11.8356C4.04406 11.9132 4.02312 11.9671 4.0117 12ZM4.99787 7.7801C6.72929 6.34495 9.19846 5 12 5C14.8015 5 17.2707 6.34495 19.0021 7.7801C19.8749 8.50351 20.5911 9.2747 21.0981 9.96347C21.351 10.3071 21.5629 10.6452 21.7161 10.9597C21.8554 11.2456 22 11.6185 22 12C22 12.3815 21.8554 12.7544 21.7161 13.0403C21.5629 13.3548 21.351 13.6929 21.0981 14.0365C20.5911 14.7253 19.8749 15.4965 19.0021 16.2199C17.2707 17.6551 14.8015 19 12 19C9.19846 19 6.72929 17.6551 4.99787 16.2199C4.12513 15.4965 3.40886 14.7253 2.9019 14.0365C2.649 13.6929 2.43705 13.3548 2.28385 13.0403C2.14458 12.7544 2 12.3815 2 12C2 11.6185 2.14458 11.2456 2.28385 10.9597C2.43705 10.6452 2.649 10.3071 2.9019 9.96347C3.40886 9.2747 4.12513 8.50351 4.99787 7.7801ZM12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10ZM8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z"
                            fill="currentColor"
                          />
                        </svg>

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
        <!-- Left text -->
        <div class="pagination-info">
          <span class="pagination-info__label">
            {$_("common.showing") || "Showing"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
            -
            {formatNumber(
              Math.min(currentPage * itemsPerPage, totalCategoriesCount),
              $locale,
            )}
          </span>

          <span class="pagination-info__label">
            {$_("common.of") || "of"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber(totalCategoriesCount, $locale)}
          </span>
        </div>

        <!-- Right controls -->
        <div class="pagination-controls">
          <!-- Prev -->
          <button
            class="pager-arrow pager-arrow--left"
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M4.86195 8.47132C4.6016 8.21097 4.6016 7.78886 4.86195 7.52851L9.52862 2.86185C9.78897 2.6015 10.2111 2.6015 10.4714 2.86185C10.7318 3.1222 10.7318 3.54431 10.4714 3.80466L6.27616 7.99992L10.4714 12.1952C10.7318 12.4555 10.7318 12.8776 10.4714 13.138C10.2111 13.3983 9.78897 13.3983 9.52862 13.138L4.86195 8.47132Z"
                fill="#101828"
              />
            </svg>
          </button>

          <!-- Pages -->
          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-chip"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                  type="button"
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <!-- 1 -->
              <button
                class="page-chip"
                class:active={currentPage === 1}
                onclick={() => goToPage(1)}
                type="button"
              >
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-chip"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                    type="button"
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <!-- last -->
              <button
                class="page-chip"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
                type="button"
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <!-- Next -->
          <button
            class="pager-arrow pager-arrow--right"
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M11.1381 7.52868C11.3985 7.78903 11.3985 8.21114 11.1381 8.47149L6.47145 13.1382C6.2111 13.3985 5.78899 13.3985 5.52864 13.1382C5.26829 12.8778 5.26829 12.4557 5.52864 12.1953L9.7239 8.00008L5.52864 3.80482C5.26829 3.54447 5.26829 3.12236 5.52864 2.86201C5.78899 2.60166 6.2111 2.60166 6.47145 2.86201L11.1381 7.52868Z"
                fill="#101828"
              />
            </svg>
          </button>
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

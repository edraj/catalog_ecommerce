<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import "../styles/index.css";
  import WarrantyModal from "@/components/sellers/WarrantyModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";
  import { formatNumber } from "@/lib/helpers";
  import "./index.css";
  $goto;

  // -----------------------------
  // Data
  // -----------------------------
  let items = $state<any[]>([]);
  let isLoading = $state(true);

  let searchTerm = $state("");

  // Filters (dropdown)
  let statusFilter = $state<"all" | "active" | "inactive">("all");
  let scopeFilter = $state<"all" | "global" | "brand">("all");
  let isFiltersOpen = $state(false);

  // Pagination
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  // Modals
  let showWarrantyModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToDelete = $state<any>(null);
  let editingItem = $state<any>(null);
  let isEditMode = $state(false);

  let warrantyForm = $state({
    displaynameEn: "",
    displaynameAr: "",
    displaynameKu: "",
    descriptionEn: "",
    descriptionAr: "",
    descriptionKu: "",
    isGlobal: true,
    brandShortname: "",
  });

  let brands = $state<any[]>([]);
  let isLoadingBrands = $state(false);

  let totalItemsCount = $derived.by(() => {
    return filteredItems.length;
  });



  $effect(() => {
    searchTerm; statusFilter; scopeFilter;
    currentPage = 1;
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  // Helpers
  function warrantyBody(item: any) {
    return item?.attributes?.payload?.body || {};
  }

  function isGlobalWarranty(item: any) {
    return !!warrantyBody(item)?.is_global;
  }

  function warrantyScopeLabel(item: any) {
    const b = warrantyBody(item);
    if (b?.is_global) return $_("admin.global") || "Global";
    return b?.brand_shortname || $_("admin.brand_specific") || "Brand Specific";
  }

  function isActiveWarranty(item: any) {
    return item?.attributes?.is_active !== false;
  }

  // -----------------------------
  // Stats
  // -----------------------------
  let filteredItems = $derived.by(() => {
    let list = [...items];

    const q = (searchTerm || "").trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const name = (getItemDisplayName(item) || "").toLowerCase();
        const desc = (
          item?.attributes?.description?.en ||
          item?.attributes?.description_en ||
          item?.attributes?.description?.ar ||
          item?.attributes?.description?.ku ||
          ""
        )
          .toString()
          .toLowerCase();
        const scope = (warrantyScopeLabel(item) || "").toLowerCase();
        return name.includes(q) || desc.includes(q) || scope.includes(q);
      });
    }

    if (statusFilter !== "all") {
      const wantActive = statusFilter === "active";
      list = list.filter((i) => isActiveWarranty(i) === wantActive);
    }

    if (scopeFilter !== "all") {
      const wantGlobal = scopeFilter === "global";
      list = list.filter((i) => isGlobalWarranty(i) === wantGlobal);
    }

    return list;
  });

  const totalWarrantiesStat = $derived.by(() => filteredItems.length);
  const globalWarrantiesStat = $derived.by(() => {
    return filteredItems.filter((i) => isGlobalWarranty(i)).length;
  });
  const otherWarrantiesStat = $derived.by(() => {
    return filteredItems.filter((i) => !isGlobalWarranty(i)).length;
  });

  // -----------------------------
  // Pagination derived
  // -----------------------------
  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  });

  let paginatedItems = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  });

  $effect(() => {
    // reset to page 1 whenever filters/search change
    searchTerm;
    statusFilter;
    scopeFilter;
    currentPage = 1;
  });

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) currentPage = page;
  }

  // -----------------------------
  // Lifecycle
  // -----------------------------
  onMount(async () => {
    await Promise.all([loadWarranties(), loadBrands()]);
  });

  async function loadWarranties() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/warranties/${$user.shortname}`,
        "managed",
        1000,
        0,
        true,
      );

      items = response?.records ? response.records : [];
    } catch (error) {
      console.error("Error loading warranties:", error);
      errorToastMessage("Error loading warranties");
      items = [];
    } finally {
      isLoading = false;
    }
  }

  async function loadBrands() {
    isLoadingBrands = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        1000,
        0,
        true,
      );
      if (response?.records) brands = response.records;
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      isLoadingBrands = false;
    }
  }

  // -----------------------------
  // Filters dropdown
  // -----------------------------
  function activeFiltersCount() {
    let n = 0;
    if (statusFilter !== "all") n++;
    if (scopeFilter !== "all") n++;
    return n;
  }

  function toggleFiltersDropdown(event?: Event) {
    event?.stopPropagation?.();
    isFiltersOpen = !isFiltersOpen;
  }

  function resetFilters() {
    statusFilter = "all";
    scopeFilter = "all";
  }

  // -----------------------------
  // Modal open/close
  // -----------------------------
  function openWarrantyModal() {
    closeAllDropdowns();

    showWarrantyModal = true;
    isEditMode = false;
    editingItem = null;
    warrantyForm = {
      displaynameEn: "",
      displaynameAr: "",
      displaynameKu: "",
      descriptionEn: "",
      descriptionAr: "",
      descriptionKu: "",
      isGlobal: true,
      brandShortname: "",
    };
  }

  function openEditModal(item: any) {
    closeAllDropdowns();

    editingItem = item;
    isEditMode = true;

    const b = warrantyBody(item);

    warrantyForm = {
      displaynameEn: item?.attributes?.displayname?.en || "",
      displaynameAr: item?.attributes?.displayname?.ar || "",
      displaynameKu: item?.attributes?.displayname?.ku || "",
      descriptionEn:
        item?.attributes?.description?.en ||
        item?.attributes?.description_en ||
        "",
      descriptionAr: item?.attributes?.description?.ar || "",
      descriptionKu: item?.attributes?.description?.ku || "",
      isGlobal: b?.is_global ?? true,
      brandShortname: b?.brand_shortname || "",
    };

    showWarrantyModal = true;
  }

  function closeWarrantyModal() {
    showWarrantyModal = false;
  }

  // -----------------------------
  // Create / Update
  // -----------------------------
  async function submitWarranty() {
    if (!warrantyForm.displaynameEn || !warrantyForm.descriptionEn) {
      errorToastMessage("Please fill in English name and description");
      return;
    }

    if (!warrantyForm.isGlobal && !warrantyForm.brandShortname) {
      errorToastMessage("Please select a brand for non-global warranty");
      return;
    }

    try {
      isLoading = true;

      const warrantyData = {
        displayname_en: warrantyForm.displaynameEn,
        displayname_ar: warrantyForm.displaynameAr || null,
        displayname_ku: warrantyForm.displaynameKu || null,
        description_en: warrantyForm.descriptionEn,
        description_ar: warrantyForm.descriptionAr || null,
        description_ku: warrantyForm.descriptionKu || null,
        body: {
          is_global: warrantyForm.isGlobal,
          brand_shortname: warrantyForm.isGlobal
            ? null
            : warrantyForm.brandShortname,
        },
        tags: editingItem?.attributes?.tags || [],
        is_active: editingItem?.attributes?.is_active ?? true,
      };

      if (isEditMode && editingItem) {
        await updateEntity(
          editingItem.shortname,
          website.main_space,
          `/warranties/${$user.shortname}`,
          ResourceType.content,
          warrantyData,
          "",
          "",
        );
        successToastMessage("Warranty updated successfully!");
      } else {
        await createEntity(
          warrantyData,
          website.main_space,
          `/warranties/${$user.shortname}`,
          ResourceType.content,
          "",
          "",
        );
        successToastMessage("Warranty created successfully!");
      }

      closeWarrantyModal();
      await loadWarranties();
    } catch (error) {
      console.error(
        isEditMode ? "Error updating warranty:" : "Error creating warranty:",
        error,
      );
      errorToastMessage(
        isEditMode ? "Failed to update warranty" : "Failed to create warranty",
      );
    } finally {
      isLoading = false;
    }
  }

  // -----------------------------
  // Delete
  // -----------------------------
  function openDeleteModal(item: any) {
    closeAllDropdowns();
    itemToDelete = item;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    itemToDelete = null;
  }

  async function confirmDelete() {
    if (!itemToDelete) return;

    try {
      isLoading = true;

      await deleteEntity(
        itemToDelete.shortname,
        itemToDelete.space_name,
        itemToDelete.subpath,
        itemToDelete.resource_type,
      );

      successToastMessage("Warranty deleted successfully!");
      closeDeleteModal();
      await loadWarranties();
    } catch (error) {
      console.error("Error deleting warranty:", error);
      errorToastMessage("Failed to delete warranty");
    } finally {
      isLoading = false;
    }
  }

  // -----------------------------
  // Actions dropdown (3 dots per row)
  // -----------------------------
  let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(
      item?.uuid ?? item?.id ?? item?.shortname ?? crypto.randomUUID(),
    );
  }

  function toggleTableActions(item: any, event?: Event) {
    event?.stopPropagation?.();
    isFiltersOpen = false;

    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeAllDropdowns() {
    isFiltersOpen = false;
    openActionsFor = null;
  }

  function onWindowClick() {
    closeAllDropdowns();
  }

  // Date formatter (optional, matches your admin style)
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
</script>

<svelte:window onclick={onWindowClick} />

<div class="seller-page-container">
  <!-- ✅ Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- Shield icon -->
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
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          {$_("admin.total_warranties") || "Total Warranties"}
        </h3>
        <p class="stat-value">{formatNumber(totalWarrantiesStat, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- Globe icon -->
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
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          {$_("admin.global_warranties") || "Global Warranties"}
        </h3>
        <p class="stat-value">{formatNumber(globalWarrantiesStat, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- Tag/label icon -->
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
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          {$_("admin.brand_specific") || "Other Warranties"}
        </h3>
        <p class="stat-value">{formatNumber(otherWarrantiesStat, $locale)}</p>
      </div>
    </div>
  </div>

  <!-- ✅ Main content -->
  <div class="seller-page-content" class:rtl={$isRTL}>
    <!-- Header controls -->
    <div
      class="flex flex-col md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <!-- SEARCH -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {$_("common.search") || "Search"}
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
            placeholder={$_("seller_dashboard.search_warranties") ||
              "Search warranties..."}
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

      <!-- RIGHT CONTROLS -->
      <div class="flex items-end gap-3 justify-end">
        <!-- Add -->
        <button
          onclick={openWarrantyModal}
          class="inline-flex items-center justify-center
               h-9 cursor-pointer
               px-3 py-2
               bg-[#3C307F] text-white text-sm font-medium
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               hover:bg-[#2f2666]
               transition-colors duration-200"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M10 5v10M5 10h10"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span class="ml-2"
            >{$_("seller_dashboard.add_warranty") || "Add Warranty"}</span
          >
        </button>

        <!-- Filters dropdown -->
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onclick={toggleFiltersDropdown}
            class="h-9 inline-flex items-center justify-between
              px-3 py-2 min-w-[160px]
              bg-[#F9FAFB] border border-[#E5E7EB]
              rounded-[12px]
              shadow-[0px_1px_0.5px_0.05px_#1D293D05]
              text-sm text-gray-700 hover:bg-gray-50"
          >
            <span class="truncate inline-flex items-center gap-2">
              {$_("common.filters") || "Filters"}
              {#if activeFiltersCount() > 0}
                <span
                  class="inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
                >
                  {activeFiltersCount()}
                </span>
              {/if}
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
          </button>

          {#if isFiltersOpen}
            <div
              class="absolute right-0 z-20 mt-2 w-[360px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <!-- Status -->
                <div>
                  <label
                    class="block text-xs font-medium text-gray-600 mb-1"
                    for="status-filter"
                  >
                    {$_("common.status") || "Status"}
                  </label>

                  <select
                    id="status-filter"
                    bind:value={statusFilter}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    <option value="all"
                      >{$_("admin.all_status") || "All Status"}</option
                    >
                    <option value="active"
                      >{$_("admin.active") || "Active"}</option
                    >
                    <option value="inactive"
                      >{$_("admin.inactive") || "Inactive"}</option
                    >
                  </select>
                </div>

                <!-- Scope -->
                <div>
                  <label
                    class="block text-xs font-medium text-gray-600 mb-1"
                    for="scope-filter"
                  >
                    {$_("admin.warranty_scope") || "Scope"}
                  </label>

                  <select
                    id="scope-filter"
                    bind:value={scopeFilter}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    <option value="all"
                      >{$_("admin.all_scopes") || "All Scopes"}</option
                    >
                    <option value="global"
                      >{$_("admin.global") || "Global"}</option
                    >
                    <option value="brand"
                      >{$_("admin.brand_specific") || "Brand Specific"}</option
                    >
                  </select>
                </div>
              </div>

              <div
                class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100"
              >
                <button
                  type="button"
                  onclick={resetFilters}
                  class="h-9 inline-flex items-center justify-center
                    px-3 py-2
                    bg-[#F9FAFB] text-gray-700 text-sm font-medium
                    border border-[#E5E7EB]
                    rounded-[12px]
                    hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>

                <button
                  type="button"
                  onclick={() => (isFiltersOpen = false)}
                  class="h-9 inline-flex items-center justify-center
                    px-3 py-2
                    bg-[#3C307F] text-white text-sm font-medium
                    rounded-[12px]
                    hover:bg-[#2f2666] transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Table / States -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <h3>{$_("seller_dashboard.no_warranties") || "No warranties found"}</h3>
        <p>
          {$_("seller_dashboard.add_first_warranty") ||
            "Start by creating your first warranty policy"}
        </p>
        <button class="btn-create-large" onclick={openWarrantyModal}>
          {$_("seller_dashboard.add_warranty") || "Add Warranty"}
        </button>
      </div>
    {:else}
      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("seller_dashboard.name") || "Name"}</th>
              <th>{$_("seller_dashboard.description") || "Description"}</th>
              <th>{$_("seller_dashboard.scope") || "Scope"}</th>
              <th>{$_("admin.created") || "Created"}</th>
              <th class="col-actions">{$_("common.actions") || "Actions"}</th>
            </tr>
          </thead>

          <tbody>
            {#each paginatedItems as item (item.shortname)}
              <tr
                class="item-row"
                onclick={() => openEditModal(item)}
                style="cursor: pointer;"
              >
                <td class="col-main">
                  <div class="item-title">
                    {#if (getItemDisplayName(item) || "").length > 32}
                      {getItemDisplayName(item).slice(0, 32)}...
                    {:else}
                      {getItemDisplayName(item)}
                    {/if}
                  </div>
                </td>

                <td>
                  <div class="product-info">
                    {#if (item?.attributes?.description_en || item?.attributes?.description?.en || "").length > 30}
                      {(
                        item?.attributes?.description_en ||
                        item?.attributes?.description?.en ||
                        ""
                      ).slice(0, 30)}...
                    {:else}
                      {item?.attributes?.description_en ||
                        item?.attributes?.description?.en ||
                        ""}
                    {/if}
                  </div>
                </td>

                <td>
                  <span
                    class="status-badge"
                    class:active={isGlobalWarranty(item)}
                    class:pending={!isGlobalWarranty(item)}
                  >
                    {#if isGlobalWarranty(item)}
                      <!-- globe icon -->
                      <svg
                        class="status-icon"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle cx="8" cy="8" r="6" stroke-width="1.5" />
                        <path
                          d="M2 8h12"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                        <path
                          d="M8 2c2.5 2.5 2.5 9.5 0 12"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                        <path
                          d="M8 2c-2.5 2.5-2.5 9.5 0 12"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    {:else}
                      <!-- tag icon -->
                      <svg
                        class="status-icon"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M2 6.5V3.5C2 2.7 2.7 2 3.5 2H7.2c.4 0 .8.2 1.1.4l5.3 5.3c.6.6.6 1.6 0 2.1l-3.8 3.8c-.6.6-1.6.6-2.1 0L2.4 8.3C2.2 8 2 7.7 2 7.2z"
                          stroke-width="1.5"
                          stroke-linejoin="round"
                        />
                        <circle cx="4.5" cy="4.5" r="1" stroke-width="1.5" />
                      </svg>
                    {/if}

                    <span class="status-text">{warrantyScopeLabel(item)}</span>
                  </span>
                </td>

                <td>
                  <div
                    class="inline-flex items-center gap-2"
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
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
                        d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333Z"
                        fill="#6A7282"
                      />
                    </svg>
                    <span>{formatDateDMY(item?.attributes?.created_at)}</span>
                  </div>
                </td>

                <!-- Actions (3 dots) -->
                <td class="col-actions" onclick={(e) => e.stopPropagation()}>
                  <div
                    class="relative flex justify-end"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <button
                      class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                      aria-label="Actions"
                      aria-haspopup="menu"
                      aria-expanded={openActionsFor === getRowId(item)}
                      onclick={(e) => toggleTableActions(item, e)}
                    >
                      <span class="text-xl leading-none">…</span>
                    </button>

                    {#if openActionsFor === getRowId(item)}
                      <div
                        class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                        role="menu"
                      >
                        <!-- Edit -->
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                          onclick={() => {
                            openActionsFor = null;
                            openEditModal(item);
                          }}
                          role="menuitem"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            class="w-4 h-4 text-gray-500"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M15.5763 5.55905L14.1547 7.028L15.5563 8.42618C15.5577 8.42761 15.5592 8.42904 15.5606 8.43048L17.0227 9.88908L18.4245 8.44058L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM12.0308 6.34678C12.0319 6.34571 12.0329 6.34463 12.0339 6.34356L14.1455 4.16158L14.1573 4.14958C14.9124 3.39511 15.9362 2.97131 17.0036 2.97131C18.071 2.97131 19.0948 3.39511 19.8499 4.14958L19.8505 4.15018C20.605 4.90529 21.0288 5.92906 21.0288 6.99649C21.0288 8.06106 20.6072 9.0822 19.8566 9.83672L11.4977 18.4744C11.3859 18.59 11.2479 18.6768 11.0953 18.7277L4.67729 20.8667C4.31797 20.9864 3.92182 20.8929 3.654 20.6251C3.38618 20.3573 3.29266 19.9611 3.41241 19.6018L5.55141 13.1838C5.59875 13.0418 5.67738 12.9122 5.7815 12.8046L12.0308 6.34678Z"
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
                            openActionsFor = null;
                            openDeleteModal(item);
                          }}
                          role="menuitem"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              d="M2 4h12M5 4V2h6v2M3 4h10l-1 10H4L3 4z"
                              stroke-width="1.5"
                              stroke-linejoin="round"
                            />
                          </svg>
                          <span>{$_("common.delete") || "Delete"}</span>
                        </button>
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
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
                Math.min(currentPage * itemsPerPage, totalItemsCount),
                $locale,
              )}
            </span>

            <span class="pagination-info__label">
              {$_("common.of") || "of"}
            </span>

            <span class="pagination-info__strong">
              {formatNumber(totalItemsCount, $locale)}
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

  <style>
    .seller-page-container,
    .seller-page-content {
      background: #f9fafb;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin: 1rem 0 1.5rem;
    }

    .stat-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: all 0.3s ease;
      box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.1);
    }

    .bg-icon {
      width: 56px;
      height: 56px;
      background: #f3f4ff;
      border: 1px solid #e5e7ff;
      border-radius: 12px;
    }

    .stat-title {
      margin: 0;
      font-size: 0.9rem;
      color: #6b7280;
      font-weight: 600;
    }

    .stat-value {
      margin: 0.25rem 0 0;
      font-size: 1.35rem;
      color: #111827;
      font-weight: 800;
    }

    /* Status badge icon */
    .status-icon {
      width: 14px;
      height: 14px;
      margin-right: 6px;
      flex: 0 0 auto;
    }

    .status-text {
      display: inline-block;
    }

    /* Make table body typography match other pages */
    .items-table tbody td {
      font-weight: 500;
      font-size: 0.875rem;
      line-height: 14px;
      letter-spacing: 0;
      color: #101828;
    }

    /* Pagination (copied from your admin layout) */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-top: 1px solid #e5e7eb;
      margin-top: 16px;
      gap: 20px;
      background: white;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }

    .pagination-pages {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
    }

    .page-btn {
      min-width: 36px;
      height: 36px;
      padding: 0 8px;
      border: 1px solid #d1d5db;
      background: white;
      color: #374151;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .page-btn:hover:not(.active) {
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    .page-btn.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
      font-weight: 600;
    }

    .page-ellipsis {
      padding: 0 8px;
      color: #9ca3af;
      font-weight: 600;
    }

    .pagination-info {
      color: #6b7280;
      font-size: 14px;
      white-space: nowrap;
      font-weight: 500;
    }
  </style>
</div>

<!-- Warranty Modal -->
<WarrantyModal
  bind:show={showWarrantyModal}
  isRTL={$isRTL}
  bind:warrantyForm
  {brands}
  {isLoadingBrands}
  onClose={closeWarrantyModal}
  onSubmit={submitWarranty}
  getLocalizedDisplayName={getItemDisplayName}
  {isEditMode}
/>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  show={showDeleteModal}
  item={itemToDelete}
  {isLoading}
  onClose={closeDeleteModal}
  onConfirm={confirmDelete}
/>

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { Pagination } from "@/components/ui";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import "./index.css";
  import DiscountModal from "@/components/sellers/DiscountModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";

  // -----------------------------
  // States
  // -----------------------------
  let items = $state<any[]>([]);
  let filteredItems = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state("");

  let searchTerm = $state("");
  let searchDebounce = $state<ReturnType<typeof setTimeout> | null>(null);

  // Pagination
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  // Filters (UI like admin page)
  let typeFilter = $state("all"); // brand | category | all
  let discountTypeFilter = $state("all"); // percentage | amount | all

  // Modals
  let showDiscountModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToDelete = $state<any | null>(null);
  let editingItem = $state<any | null>(null);
  let isEditMode = $state(false);

  // Modal form
  let discountForm = $state({
    type: "",
    typeShortname: "",
    value: "",
    discountType: "percentage",
    validFrom: "",
    validTo: "",
  });

  // Dropdowns data
  let brands = $state<any[]>([]);
  let discountCategories = $state<any[]>([]);
  let isLoadingBrands = $state(false);
  let isLoadingDiscountCategories = $state(false);

  // Header dropdowns + row actions
  let isFiltersOpen = $state(false);
  let openRowActionsFor = $state<string | null>(null);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  // Helper for translation with fallback
  function t(key: string, fallback: string = ""): string {
    return $_(key) || fallback;
  }

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  function scheduleApplyFilters() {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentPage = 1;
      applyFilters();
    }, 250);
  }

  function parseDiscountValue(item: any): number {
    const v = item?.discount_value;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function isExpired(toDate: string): boolean {
    if (!toDate) return false;
    return new Date(toDate) < new Date();
  }

  function isActive(validity: any): boolean {
    if (!validity?.from || !validity?.to) return false;
    const now = new Date();
    const from = new Date(validity.from);
    const to = new Date(validity.to);
    return now >= from && now <= to;
  }

  function statusLabel(item: any) {
    const active = isActive(item.validity);
    const expired = isExpired(item.validity?.to);
    if (active) return "Active";
    if (expired) return "Inactive";
    return "Scheduled";
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

  // Dropdown controls
  function closeAllDropdowns() {
    isFiltersOpen = false;
    openRowActionsFor = null;
  }

  function toggleHeaderFilters(e?: Event) {
    e?.stopPropagation();
    openRowActionsFor = null;
    isFiltersOpen = !isFiltersOpen;
  }

  function toggleRowActions(id: string, e?: Event) {
    e?.stopPropagation();
    isFiltersOpen = false;
    openRowActionsFor = openRowActionsFor === id ? null : id;
  }

  function activeFiltersCount() {
    let n = 0;
    if (typeFilter !== "all") n++;
    if (discountTypeFilter !== "all") n++;
    return n;
  }

  function resetFilters() {
    typeFilter = "all";
    discountTypeFilter = "all";
    currentPage = 1;
    applyFilters();
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }

  // -----------------------------
  // Derived lists (matches admin page behavior)
  // -----------------------------
  let computedFiltered = $derived.by(() => {
    let list = [...items];

    // search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter((item) => {
        const typeShortname = item.type_shortname || "";
        const type = item.type || "";
        return (
          typeShortname.toLowerCase().includes(s) ||
          type.toLowerCase().includes(s)
        );
      });
    }

    // filters
    if (typeFilter !== "all") list = list.filter((d) => d.type === typeFilter);
    if (discountTypeFilter !== "all") {
      list = list.filter((d) => d.discount_type === discountTypeFilter);
    }

    return list;
  });

  // keep filteredItems state for compatibility with your existing logic
  $effect(() => {
    // whenever computedFiltered changes, sync
    filteredItems = computedFiltered;
    // keep currentPage in range
    if (currentPage > totalPages) currentPage = totalPages;
  });

  let paginatedItems = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  });

  let totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(filteredItems.length / itemsPerPage)),
  );

  $effect(() => {
    // reset to page 1 when controls change
    searchTerm;
    typeFilter;
    discountTypeFilter;
    currentPage = 1;
  });

  // -----------------------------
  // Stats
  // -----------------------------
  let totalDiscounts = $derived.by(() => filteredItems.length);

  let activeDiscounts = $derived.by(
    () => filteredItems.filter((d) => statusLabel(d) === "Active").length,
  );

  let inactiveDiscounts = $derived.by(
    () => filteredItems.filter((d) => statusLabel(d) === "Inactive").length,
  );

  let avgDiscountStats = $derived.by(() => {
    if (!filteredItems.length) return "-";
    const types = new Set(filteredItems.map((d) => d.discount_type));
    if (types.size !== 1) return "-";

    const nums = filteredItems
      .map((d) => Number(d.discount_value ?? 0))
      .filter((n) => Number.isFinite(n));

    if (!nums.length) return "-";

    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const dt = filteredItems[0]?.discount_type;

    if (dt === "percentage") return `${avg.toFixed(1)}%`;
    return `${avg.toLocaleString()} ${$_("admin.currency") || "IQD"}`;
  });

  // -----------------------------
  // Load data
  // -----------------------------
  onMount(async () => {
    await Promise.all([
      loadDiscounts(),
      loadBrands(),
      loadDiscountCategories(),
    ]);
  });

  onDestroy(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
  });

  async function loadDiscounts() {
    isLoading = true;
    error = "";
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${$user.shortname}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find((r) => r.resource_type === "content") ||
        response?.records?.[0];

      if (configEntry?.attributes?.payload?.body?.items) {
        items = configEntry.attributes.payload.body.items.map(
          (item: any, index: number) => ({
            ...item,
            _key: item.key || `discount_${index}`,
            _configEntry: configEntry,
          }),
        );
      } else {
        items = [];
      }

      // initial apply
      filteredItems = computedFiltered;
    } catch (e) {
      console.error("Error loading discounts:", e);
      errorToastMessage(
        t(
          "seller_dashboard.error_loading_discounts",
          "Error loading discounts",
        ),
      );
      error = t(
        "seller_dashboard.failed_to_load_discounts",
        "Failed to load discounts",
      );
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
    } catch (e) {
      console.error("Error loading brands:", e);
    } finally {
      isLoadingBrands = false;
    }
  }

  async function loadDiscountCategories() {
    isLoadingDiscountCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true,
      );
      if (response?.records) discountCategories = response.records;
    } catch (e) {
      console.error("Error loading categories:", e);
    } finally {
      isLoadingDiscountCategories = false;
    }
  }

  // -----------------------------
  // Filters (kept for compatibility; computedFiltered already handles it)
  // -----------------------------
  function applyFilters() {
    // computedFiltered drives it; just sync
    filteredItems = computedFiltered;
  }

  // -----------------------------
  // Modal Open/Close
  // -----------------------------
  function openDiscountModal() {
    showDiscountModal = true;
    isEditMode = false;
    editingItem = null;
    discountForm = {
      type: "",
      typeShortname: "",
      value: "",
      discountType: "percentage",
      validFrom: "",
      validTo: "",
    };
  }

  function openEditModal(item: any) {
    editingItem = item;
    isEditMode = true;

    discountForm = {
      type: item.type || "",
      typeShortname: item.type_shortname || "",
      value: item.discount_value?.toString() || "",
      discountType: item.discount_type || "percentage",
      validFrom: item.validity?.from || "",
      validTo: item.validity?.to || "",
    };

    showDiscountModal = true;
  }

  function closeDiscountModal() {
    showDiscountModal = false;
  }

  // -----------------------------
  // Submit Create/Update
  // -----------------------------
  async function submitDiscount() {
    if (
      !discountForm.value ||
      !discountForm.validFrom ||
      !discountForm.validTo
    ) {
      errorToastMessage(
        t("admin.fill_required_fields", "Please fill in all required fields"),
      );
      return;
    }

    if (discountForm.type && !discountForm.typeShortname) {
      errorToastMessage(
        t(
          "admin.select_specific_target",
          "Please select a specific category or brand",
        ),
      );
      return;
    }

    try {
      isLoading = true;

      const itemKey = isEditMode
        ? editingItem.key
        : `discount_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const discountItem = {
        key: itemKey,
        type: discountForm.type || null,
        type_shortname: discountForm.typeShortname || null,
        states: [],
        validity: {
          from: discountForm.validFrom,
          to: discountForm.validTo,
        },
        discount_type: discountForm.discountType,
        discount_value: parseFloat(discountForm.value),
      };

      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${$user.shortname}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find((r) => r.resource_type === "content") ||
        response?.records?.[0];

      if (configEntry) {
        const currentItems = configEntry.attributes?.payload?.body?.items || [];

        const updatedItems = isEditMode
          ? currentItems.map((it: any) =>
              it.key === itemKey ? discountItem : it,
            )
          : [...currentItems, discountItem];

        await updateEntity(
          configEntry.shortname,
          website.main_space,
          `/discounts/${$user.shortname}`,
          ResourceType.content,
          {
            displayname_en: "Configuration",
            displayname_ar: null,
            displayname_ku: null,
            body: {
              items: updatedItems,
              seller_shortname: $user.shortname,
            },
            tags: [],
            is_active: true,
          },
          "",
          "",
        );
      } else {
        await createEntity(
          {
            displayname_en: "Configuration",
            displayname_ar: null,
            displayname_ku: null,
            body: {
              items: [discountItem],
              seller_shortname: $user.shortname,
            },
            tags: [],
            is_active: true,
          },
          website.main_space,
          `/discounts/${$user.shortname}`,
          ResourceType.content,
          "",
          "",
        );
      }

      successToastMessage(
        isEditMode
          ? t("admin.discount_updated", "Discount updated successfully!")
          : t("admin.discount_created", "Discount created successfully!"),
      );
      closeDiscountModal();
      await loadDiscounts();
    } catch (e) {
      console.error("Error creating/updating discount:", e);
      errorToastMessage(
        t("admin.discount_create_failed", "Failed to create discount"),
      );
    } finally {
      isLoading = false;
    }
  }

  // -----------------------------
  // Delete
  // -----------------------------
  function openDeleteModal(item: any) {
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

      const configEntry = itemToDelete._configEntry;
      if (!configEntry) {
        errorToastMessage(
          t(
            "admin.discount_config_not_found",
            "Discount configuration not found",
          ),
        );
        return;
      }

      const currentItems = configEntry.attributes?.payload?.body?.items || [];
      const updatedItems = currentItems.filter(
        (it: any) => it.key !== itemToDelete.key,
      );

      await updateEntity(
        configEntry.shortname,
        website.main_space,
        `/discounts/${$user.shortname}`,
        ResourceType.content,
        {
          displayname_en: "Configuration",
          displayname_ar: null,
          displayname_ku: null,
          body: {
            items: updatedItems,
            seller_shortname: $user.shortname,
          },
          tags: [],
          is_active: true,
        },
        "",
        "",
      );

      successToastMessage(
        t("admin.discount_deleted", "Discount deleted successfully!"),
      );
      closeDeleteModal();
      await loadDiscounts();
    } catch (e) {
      console.error("Error deleting discount:", e);
      errorToastMessage(
        t("admin.discount_delete_failed", "Failed to delete discount"),
      );
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:window onclick={closeAllDropdowns} />

<div class="admin-page-container" dir={$isRTL ? "rtl" : "ltr"}>
  <div class="admin-page-content">
    <!-- STATS CARDS -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Total Discounts</h3>
          <p class="stat-value">{totalDiscounts}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18Z"
              fill="#3C307F"
            />
            <path
              d="M23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Active Discounts</h3>
          <p class="stat-value">{activeDiscounts}</p>
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
          <h3 class="stat-title">Inactive Discounts</h3>
          <p class="stat-value">{inactiveDiscounts}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z"
              stroke="#3C307F"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Average Discounts</h3>
          <p class="stat-value">{avgDiscountStats}</p>
        </div>
      </div>
    </div>

    <!-- HEADER CONTROLS (EXACT layout style from admin page) -->
    <div class="bg-white search-table_header rounded-t-xl w-full p-6">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-3">
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
              oninput={scheduleApplyFilters}
              placeholder={$_("seller_dashboard.search_discounts") ||
                t("admin.search_discounts", "Search discounts...")}
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

        <!-- RIGHT SIDE -->
        <div class="flex flex-wrap items-end justify-end gap-3">
          <!-- ADD DISCOUNT -->
          <button
            type="button"
            onclick={openDiscountModal}
            class="inline-flex items-center justify-center
                h-9 px-3 py-2
                bg-[#3C307F] text-white text-sm font-medium
                rounded-[12px]
                shadow-[0px_1px_0.5px_0.05px_#1D293D05]
                hover:bg-[#2f2666]
                transition-colors duration-200"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="ml-2"
              >{$_("seller_dashboard.add_discount") ||
                t("admin.add_discount", "Add Discount")}</span
            >
          </button>

          <!-- FILTERS DROPDOWN -->
          <div class="relative">
            <button
              type="button"
              onclick={toggleHeaderFilters}
              class="h-9 inline-flex items-center justify-between
                px-3 py-2 min-w-[160px]
                bg-[#F9FAFB] border border-[#E5E7EB]
                rounded-[12px]
                shadow-[0px_1px_0.5px_0.05px_#1D293D05]
                text-sm text-gray-700 hover:bg-gray-50"
              aria-haspopup="true"
              aria-expanded={isFiltersOpen}
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
                class="absolute right-0 z-20 mt-2 w-[320px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
                onclick={(e) => e.stopPropagation()}
              >
                <div class="grid grid-cols-1 gap-3">
                  <div>
                    <label
                      class="block text-xs font-medium text-gray-600 mb-1"
                      for="type-filter"
                    >
                      {$_("admin.discount_target") || "Target Type"}
                    </label>
                    <select
                      id="type-filter"
                      bind:value={typeFilter}
                      class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                    >
                      <option value="all"
                        >{$_("admin.all_types") || "All Types"}</option
                      >
                      <option value="brand"
                        >{$_("admin.brand") || "Brand"}</option
                      >
                      <option value="category"
                        >{$_("admin.category") || "Category"}</option
                      >
                    </select>
                  </div>

                  <div>
                    <label
                      class="block text-xs font-medium text-gray-600 mb-1"
                      for="discount-type-filter"
                    >
                      {$_("admin.discount_type") || "Discount Type"}
                    </label>
                    <select
                      id="discount-type-filter"
                      bind:value={discountTypeFilter}
                      class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                    >
                      <option value="all"
                        >{$_("admin.all_discount_types") ||
                          "All Discount Types"}</option
                      >
                      <option value="percentage"
                        >{$_("admin.percentage") || "Percentage"}</option
                      >
                      <option value="amount"
                        >{$_("admin.amount") || "Fixed Amount"}</option
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
                    {t("admin.reset", "Reset")}
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
                    {t("admin.apply", "Apply")}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- CONTENT STATES + TABLE (match admin page states) -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if error}
      <div
        class="error-message bg-white border border-[#E5E7EB] rounded-b-xl p-6"
      >
        <p class="text-sm text-red-600">{error}</p>
        <button
          class="mt-3 h-9 inline-flex items-center justify-center px-3 py-2 bg-[#3C307F] text-white text-sm font-medium rounded-[12px] hover:bg-[#2f2666]"
          onclick={loadDiscounts}
        >
          {t("common.retry", "Retry")}
        </button>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
          <path
            d="M16 24h16M24 16v16"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>
          {$_("seller_dashboard.no_discounts") ||
            $_("admin.no_discounts") ||
            "No discounts found"}
        </h3>
        <p>
          {$_("seller_dashboard.no_discounts_hint") ||
            $_("admin.no_discounts_hint") ||
            "No discount rules yet"}
        </p>
      </div>
    {:else}
      <div class="items-table-container overflow-x-auto">
        <table class="items-table w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                class="px-6 py-3 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.discount_target") ||
                  $_("seller_dashboard.type") ||
                  "Target Type"}
              </th>
              <th
                class="px-6 py-3 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.target_name") ||
                  $_("seller_dashboard.target") ||
                  "Target Name"}
              </th>
              <th
                class="px-6 py-3 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.discount_type") || "Discount Type"}
              </th>
              <th
                class="px-6 py-3 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.discount_value") ||
                  $_("seller_dashboard.discount") ||
                  "Value"}
              </th>
              <th
                class="px-6 py-3 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.validity_period") ||
                  $_("seller_dashboard.validity") ||
                  "Validity"}
              </th>
              <th
                class="px-6 py-3 bg-white text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("common.status") || "Status"}
              </th>
            </tr>
          </thead>

          <tbody class="bg-white">
            {#each paginatedItems as item (item._key)}
              <tr class="hover:bg-gray-50 transition-colors duration-200">
                <!-- Target Type pill -->
                <td class="px-6 py-4">
                  <span
                    class="inline-flex items-center rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                  >
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                    >
                      {item.type === "brand"
                        ? $_("admin.brand") || "Brand"
                        : item.type === "category"
                          ? $_("admin.category") || "Category"
                          : item.type === "product"
                            ? $_("admin.product") || "Product"
                            : $_("admin.global") || "Global"}
                    </span>
                  </span>
                </td>

                <!-- Target name -->
                <td class="px-6 py-4">
                  <span
                    class="truncate max-w-[260px] block"
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                    title={item.type_shortname || "-"}
                  >
                    {item.type_shortname || "-"}
                  </span>
                </td>

                <!-- Discount type pill -->
                <td class="px-6 py-4">
                  <span
                    class="inline-flex items-center rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                  >
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                    >
                      {item.discount_type === "percentage"
                        ? $_("admin.percentage") || "Percentage"
                        : $_("admin.amount") || "Fixed Amount"}
                    </span>
                  </span>
                </td>

                <!-- Value -->
                <td class="px-6 py-4">
                  <span
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  >
                    {#if item.discount_type === "percentage"}
                      {parseDiscountValue(item)}%
                    {:else}
                      {Number(parseDiscountValue(item) || 0).toLocaleString()}
                      {$_("admin.currency") || "IQD"}
                    {/if}
                  </span>
                </td>

                <!-- Validity -->
                <td class="px-6 py-4">
                  <div class="flex flex-col gap-2">
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
                          d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z"
                          fill="#6A7282"
                        />
                      </svg>

                      <span
                        >{$_("admin.from") || "From"}: {formatDateDMY(
                          item.validity?.from,
                        )}</span
                      >
                    </div>

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
                          d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z"
                          fill="#6A7282"
                        />
                      </svg>

                      <span
                        >{$_("admin.to") || "To"}: {formatDateDMY(
                          item.validity?.to,
                        )}</span
                      >
                    </div>
                  </div>
                </td>

                <!-- Status pill -->
                <td class="px-6 py-4">
                  {#if statusLabel(item) === "Active"}
                    <span
                      class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                      style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
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
                        {t("admin.status_active", "Active")}
                      </span>
                    </span>
                  {:else if statusLabel(item) === "Inactive"}
                    <span
                      class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                      style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
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
                        {t("admin.status_inactive", "Inactive")}
                      </span>
                    </span>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                      style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
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
                        {t("admin.status_scheduled", "Scheduled")}
                      </span>
                    </span>
                  {/if}
                </td>

                <!-- Actions -->
                <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
                  <div class="relative flex justify-end" onclick={(e) => e.stopPropagation()}>
                    <button
                      class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                      aria-label="Actions"
                      aria-haspopup="menu"
                      aria-expanded={openRowActionsFor === item._key}
                      onclick={(e) => toggleRowActions(item._key, e)}
                    >
                      <span class="text-xl leading-none">…</span>
                    </button>

                    {#if openRowActionsFor === item._key}
                      <div
                        class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                        role="menu"
                      >
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                          onclick={() => {
                            closeAllDropdowns();
                            openEditModal(item);
                          }}
                          role="menuitem"
                        >
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

                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                          onclick={() => {
                            closeAllDropdowns();
                            openDeleteModal(item);
                          }}
                          role="menuitem"
                        >
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
            {/each}
          </tbody>
        </table>
      </div>

      <Pagination
        {currentPage}
        {totalPages}
        totalItems={filteredItems.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
      />
    {/if}
  </div>
</div>

<!-- Discount Modal -->
<DiscountModal
  bind:show={showDiscountModal}
  isRTL={$isRTL}
  bind:discountForm
  {brands}
  categories={discountCategories}
  {isLoadingBrands}
  isLoadingCategories={isLoadingDiscountCategories}
  onClose={closeDiscountModal}
  onSubmit={submitDiscount}
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

<style>
  /* Ensure borders show under each row */
  .items-table {
    border-collapse: collapse;
  }
  .items-table tbody tr td {
    border-bottom: 1px solid #e5e7eb;
  }
</style>

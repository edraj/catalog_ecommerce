<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import "../styles/index.css";
  import DiscountModal from "@/components/sellers/DiscountModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";

  $goto;

  // -----------------------------
  // State
  // -----------------------------
  let items = $state<any[]>([]);
  let filteredItems = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state("");

  let searchTerm = $state("");
  let searchDebounce = $state<ReturnType<typeof setTimeout> | null>(null);

  // Pagination (client-side) for this page
  let currentPage = $state(1);
  let itemsPerPage = $state(20);

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

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

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

  function isDiscountActive(item: any) {
    // You can refine this based on your backend rules:
    // Here: active if now within [from,to]
    const from = item?.validity?.from;
    const to = item?.validity?.to;
    if (!from || !to) return false;

    const now = new Date();
    const dFrom = new Date(`${from}T00:00:00`);
    const dTo = new Date(`${to}T23:59:59.999`);
    if (Number.isNaN(dFrom.getTime()) || Number.isNaN(dTo.getTime()))
      return false;

    return now >= dFrom && now <= dTo;
  }

  function parseDiscountValue(item: any): number {
    const v = item?.discount_value;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  // -----------------------------
  // Stats (based on filtered list BEFORE pagination)
  // -----------------------------
  let totalDiscounts = $derived.by(() => filteredItems.length);

  let activeDiscounts = $derived.by(() => {
    return filteredItems.reduce(
      (sum, item) => sum + (isDiscountActive(item) ? 1 : 0),
      0,
    );
  });

  let inactiveDiscounts = $derived.by(() => totalDiscounts - activeDiscounts);

  let avgDiscount = $derived.by(() => {
    if (filteredItems.length === 0) return 0;
    const sum = filteredItems.reduce(
      (acc, item) => acc + parseDiscountValue(item),
      0,
    );
    return sum / filteredItems.length;
  });

  // -----------------------------
  // Pagination (client-side)
  // -----------------------------
  let totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(filteredItems.length / itemsPerPage)),
  );

  let paginatedItems = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  });

  let visiblePageNumbers = $derived.by(() => {
    const total = totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const cur = currentPage;
    const pages: (number | "ellipsis")[] = [];

    if (cur <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(total);
    } else if (cur >= total - 2) {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = cur - 1; i <= cur + 1; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(total);
    }
    return pages;
  });

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }

  function nextPage() {
    if (currentPage < totalPages) currentPage++;
  }

  function previousPage() {
    if (currentPage > 1) currentPage--;
  }

  let paginationStart = $derived.by(() => {
    return filteredItems.length === 0
      ? 0
      : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    return Math.min(currentPage * itemsPerPage, filteredItems.length);
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
          (item, index) => ({
            ...item,
            _key: item.key || `discount_${index}`,
            _isDiscountItem: true,
            _configEntry: configEntry,
          }),
        );
        applyFilters();
      } else {
        items = [];
        filteredItems = [];
      }
    } catch (e) {
      console.error("Error loading discounts:", e);
      errorToastMessage("Error loading discounts");
      error = "Failed to load discounts";
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
  // Filters
  // -----------------------------
  function applyFilters() {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      filteredItems = [...items];
      return;
    }

    filteredItems = items.filter((item) => {
      const type = (item.type || "").toLowerCase();
      const typeShortname = (item.type_shortname || "").toLowerCase();

      // Optional: try to match display name of target (brand/category)
      // (Only if you have those lists and shortnames)
      return type.includes(q) || typeShortname.includes(q);
    });
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
      errorToastMessage("Please fill in all required fields");
      return;
    }

    if (discountForm.type && !discountForm.typeShortname) {
      errorToastMessage("Please select a specific category or brand");
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
          ? currentItems.map((it) => (it.key === itemKey ? discountItem : it))
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
          ? "Discount updated successfully!"
          : "Discount created successfully!",
      );
      closeDiscountModal();
      await loadDiscounts();
    } catch (e) {
      console.error("Error creating discount:", e);
      errorToastMessage("Failed to create discount");
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
        errorToastMessage("Configuration entry not found");
        return;
      }

      const currentItems = configEntry.attributes?.payload?.body?.items || [];
      const updatedItems = currentItems.filter(
        (it) => it.key !== itemToDelete.key,
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

      successToastMessage("Discount deleted successfully!");
      closeDeleteModal();
      await loadDiscounts();
    } catch (e) {
      console.error("Error deleting discount:", e);
      errorToastMessage("Failed to delete discount");
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    // re-apply filters when search changes or items changes
    searchTerm;
    items;
    applyFilters();
    // keep currentPage in range
    if (currentPage > totalPages) currentPage = totalPages;
  });

  // -----------------------------
  // UI helpers
  // -----------------------------
  type Tone = "pending" | "solved" | "inactive";

  function getTone(item: any): Tone {
    return isDiscountActive(item) ? "solved" : "inactive";
  }

  function formatDiscount(item: any) {
    if (item.discount_type === "percentage")
      return `${parseDiscountValue(item)}%`;
    return `${parseDiscountValue(item)} IQD`;
  }

  function safeText(v: any) {
    return v === null || v === undefined || v === "" ? "-" : String(v);
  }
</script>

<div class="discounts-container">
  <div class="header">

    <!-- Optional: keep this if you want to add new discounts -->
    
   
   
  </div>

  <!-- Stats Grid -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon" aria-hidden="true">
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
        <h3 class="stat-title">Total Discounts</h3>
        <p class="stat-value">{totalDiscounts}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon" aria-hidden="true">
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
        <h3 class="stat-title">Active Discounts</h3>
        <p class="stat-value">{activeDiscounts}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon" aria-hidden="true">
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
      <div class="bg-icon" aria-hidden="true">
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Avg Discount</h3>
        <p class="stat-value">{avgDiscount.toFixed(2)}</p>
      </div>
    </div>
  </div>

  <!-- Search -->
  <div class="topbar">
    <div class="search-wrap">
      <div class="search-icon" aria-hidden="true">
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
      </div>

      <input
        class="input-modern"
        type="text"
        bind:value={searchTerm}
        placeholder={$_("seller_dashboard.search_discounts")}
        oninput={scheduleApplyFilters}
      />
    </div>
    <button
          onclick={openDiscountModal}
          class="inline-flex items-center justify-center mx-2
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
            >{$_("seller_dashboard.add_discount")}</span
          >
        </button>
    
  </div>

  <!-- Table / States -->
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{$_("common.loading")}</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>{error}</p>
      <button class="btn-retry" onclick={loadDiscounts}>Retry</button>
    </div>
  {:else if filteredItems.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
        <circle cx="24" cy="24" r="16" stroke-width="2" />
        <path d="M24 16v8l4 4" stroke-width="2" stroke-linecap="round" />
      </svg>
      <h3>{$_("seller_dashboard.no_discounts")}</h3>
      <p class="empty-hint">Try adjusting your search</p>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th>{$_("seller_dashboard.type")}</th>
            <th>{$_("seller_dashboard.target")}</th>
            <th>{$_("seller_dashboard.discount")}</th>
            <th>{$_("seller_dashboard.validity")}</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {#each paginatedItems as item (item._key)}
            {@const tone = getTone(item)}
            <tr class="clickable-row" onclick={() => openEditModal(item)}>
              <td>
                <span class="type-pill">{item.type || "Global"}</span>
              </td>

              <td>
                <div
                  class="item-name"
                  title={safeText(item.type_shortname || "All")}
                >
                  {safeText(item.type_shortname || "All")}
                </div>
              </td>

              <td>
                <span class="money">{formatDiscount(item)}</span>
              </td>

              <td>
                <div class="product-info">
                  {safeText(item.validity?.from)} - {safeText(
                    item.validity?.to,
                  )}
                </div>
              </td>

              <td>
                <span class={"status-pill " + tone}>
                  {#if tone === "solved"}
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
                        fill="currentColor"
                      />
                    </svg>
                    <span>active</span>
                  {:else}
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
                        fill="currentColor"
                      />
                    </svg>
                    <span>inactive</span>
                  {/if}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <p class="pagination-text">
        Showing {paginationStart}-{paginationEnd} of {filteredItems.length}
      </p>

      <div class="pagination-controls">
        <button
          type="button"
          class="pagination-segment pagination-arrow"
          onclick={previousPage}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <svg
            class="pagination-arrow-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {#each visiblePageNumbers as segment}
          {#if segment === "ellipsis"}
            <span
              class="pagination-segment pagination-ellipsis"
              aria-hidden="true">…</span
            >
          {:else}
            <button
              type="button"
              class="pagination-segment pagination-num"
              class:active={currentPage === segment}
              onclick={() => goToPage(segment)}
              aria-label={"Page " + segment}
              aria-current={currentPage === segment ? "page" : undefined}
            >
              {segment}
            </button>
          {/if}
        {/each}

        <button
          type="button"
          class="pagination-segment pagination-arrow"
          onclick={nextPage}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <svg
            class="pagination-arrow-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  {/if}
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
  /* Page container */
  .discounts-container {
    min-height: 100vh;
    background: #f9fafb;
    padding: 24px;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }

  .header-left {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 8px 12px;
    border-radius: 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    color: #4a5565;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 1px 0.5px 0.05px rgba(29, 41, 61, 0.02);
  }
  .back-button:hover {
    background: #f3f4f6;
  }
  .back-button svg {
    width: 18px;
    height: 18px;
  }

  .page-title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #101828;
  }

  .page-subtitle {
    margin: 6px 0 0 0;
    font-size: 14px;
    color: #6a7282;
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .stat-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 1px 0.5px 0.05px rgba(27, 31, 36, 0.04);
  }

  .bg-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: #f3f4f6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .stat-title {
    font-size: 12px;
    font-weight: 500;
    color: #4a5565;
    margin: 0 0 6px 0;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: #101828;
    margin: 0;
  }

  /* Topbar */
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-bottom: none;
    border-radius: 12px 12px 0 0;
    padding: 16px;
  }

  .search-wrap {
    position: relative;
    width: 320px;
    max-width: 100%;
  }

  .search-icon {
    position: absolute;
    inset-block: 0;
    left: 10px;
    display: flex;
    align-items: center;
    color: #9ca3af;
    pointer-events: none;
  }

  .input-modern {
    width: 100%;
    height: 36px;
    padding: 8px 12px 8px 36px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0px 1px 0.5px 0.05px rgba(29, 41, 61, 0.02);
    font-size: 14px;
    outline: none;
  }

  .input-modern:focus {
    border-color: #a78bfa;
    box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.5);
  }

  .items-count {
    font-size: 14px;
    color: #4a5565;
  }

  /* Table */
  .table-wrap {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
  }

  .items-table thead th {
    text-align: left;
    font-size: 12px;
    font-weight: 500;
    color: #6a7282;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding: 14px 24px;
  }

  .items-table tbody td {
    padding: 16px 24px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }

  .clickable-row {
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .clickable-row:hover {
    background: #f9fafb;
  }

  .type-pill {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #4a5565;
    font-weight: 500;
    font-size: 12px;
    line-height: 16px;
    text-transform: lowercase;
  }

  .item-name {
    font-weight: 500;
    font-size: 14px;
    color: #101828;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
  }

  .money {
    font-weight: 500;
    font-size: 14px;
    color: #101828;
  }

  .product-info {
    font-size: 14px;
    color: #4a5565;
    white-space: nowrap;
  }

  /* Status pill (same tones) */
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid;
    font-weight: 500;
    font-size: 12px;
    line-height: 16px;
    text-transform: lowercase;
  }

  .status-pill.solved {
    background: #ecfdf5;
    border-color: #a4f4cf;
    color: #004f3b;
  }

  .status-pill.inactive {
    background: #fff8f1;
    border-color: #fcd9bd;
    color: #771d1d;
  }

  /* Loading/empty/error */
  .loading,
  .error-message,
  .empty-state {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    margin-top: 12px;
  }

  .empty-state h3 {
    margin: 10px 0 0 0;
    color: #101828;
  }

  .empty-hint {
    color: #6a7282;
    margin-top: 6px;
  }

  .btn-retry {
    margin-top: 10px;
    height: 36px;
    padding: 8px 12px;
    border-radius: 12px;
    background: #3c307f;
    border: 1px solid #3c307f;
    color: #fff;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-retry:hover {
    background: #2f2666;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: 14px 16px;
  }

  .pagination-text {
    font-size: 14px;
    color: #4a5565;
    margin: 0;
  }

  .pagination-controls {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .pagination-segment {
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #4a5565;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .pagination-segment:hover {
    background: #f3f4f6;
  }

  .pagination-num.active {
    background: #f4f5fe;
    border-color: #3c307f;
    color: #3c307f;
    font-weight: 600;
  }

  .pagination-arrow {
    padding: 0;
  }

  .pagination-arrow-icon {
    width: 18px;
    height: 18px;
  }

  .pagination-ellipsis {
    border: none;
    background: transparent;
    cursor: default;
    min-width: auto;
    padding: 0 6px;
  }

  .pagination-segment:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .discounts-container {
      padding: 16px;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-left {
      flex-direction: column;
      gap: 10px;
    }

    .topbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-wrap {
      width: 100%;
    }

    .pagination {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }

    .item-name {
      max-width: 180px;
    }
  }
</style>

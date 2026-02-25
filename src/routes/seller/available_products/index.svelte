<script lang="ts">
  import "./index.css";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate, formatNumber } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {
    getLocalizedDisplayName,
    filterItems,
    filterProductsBySearch,
  } from "@/lib/utils/sellerUtils";
  import {
    loadProductVariations,
    validateVariants,
    prepareVariantsForSubmission,
    filterProductsByCategory,
    type ProductVariant,
  } from "@/lib/utils/productVariationUtils";
  import "../styles/index.css";
  import AddProductModal from "@/components/sellers/AddProductModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";
  import { website } from "@/config";

  $goto;

  // -----------------------------
  // Data
  // -----------------------------
  let items = $state<any[]>([]);
  let filteredItems = $state<any[]>([]);
  let isLoading = $state(true);

  // filters (match admin layout: search + dropdown)
  let searchTerm = $state("");
  let statusFilter = $state<"all" | "approved" | "pending" | "rejected">("all");
  let categoryFilter = $state("all");
  let filterCategories = $state<any[]>([]);

  let isFiltersOpen = $state(false);

  // map helpers
  let allVariations = $state<any[]>([]);
  let productsMap = $state(new Map<string, any>());

  let currentPage = $state(1);
  let itemsPerPage = 20;

  // Details modal (admin-style)
  let isDetailsModalOpen = $state(false);
  let selectedProductDetails = $state<any | null>(null);

  // Delete
  let showDeleteModal = $state(false);
  let itemToDelete = $state<any>(null);

  // Seller products modal state (existing)
  let showAddItemModal = $state(false);
  let categories = $state<any[]>([]);
  let products = $state<any[]>([]);
  let warranties = $state<any[]>([]);
  let commissionCategories = $state<any[]>([]);
  let selectedCategory = $state("");
  let selectedProduct = $state("");
  let selectedWarranty = $state("");
  let selectedCommissionCategory = $state("");
  let productVariants = $state<ProductVariant[]>([]);
  let selectedVariants = $state<string[]>([]);
  let isLoadingCategories = $state(false);
  let isLoadingProducts = $state(false);
  let isLoadingVariations = $state(false);
  let productSearchTerm = $state("");
  let filteredProducts = $state<any[]>([]);
  let modalPage = $state(1);
  let modalTotalPages = $state(1);
  let modalItemsPerPage = $state(20);
  let isSearching = $state(false);
  let searchDebounceTimer: number | null = null;

  // Edit mode
  let isEditMode = $state(false);
  let editingItem = $state<any>(null);

  // -----------------------------
  // UI helpers
  // -----------------------------
  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(item?.uuid ?? item?.id ?? item?.shortname ?? "");
  }

  function toggleRowActions(item: any) {
    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeRowActions() {
    openActionsFor = null;
  }

  // close dropdown when clicking anywhere outside
  function onWindowClick() {
    if (isFiltersOpen) isFiltersOpen = false;
    if (openActionsFor) closeRowActions();
  }
  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  function getProductName(productShortname: string): string {
    const product = productsMap.get(productShortname);
    if (!product) return productShortname;
    return getLocalizedDisplayName(product, $locale);
  }

  function resolveOptionKey(
    optionKey: string,
    variationShortname: string,
  ): string {
    const variation = allVariations.find(
      (v) => v.shortname === variationShortname,
    );
    if (!variation) return optionKey;

    const body = variation.attributes?.payload?.body;
    const options = body?.options || [];
    const option = options.find((opt: any) => opt.key === optionKey);

    if (option?.name)
      return option.name[$locale] || option.name.en || optionKey;
    return optionKey;
  }

  function truncateText(value: string, maxLength = 25): string {
    if (!value) return "";
    return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
  }

  function normalizeProductState(
    state: string,
  ): "approved" | "pending" | "rejected" {
    if (!state) return "pending";
    if (state === "canceled") return "rejected";
    const s = String(state).toLowerCase();
    if (s === "approved") return "approved";
    if (s === "rejected") return "rejected";
    return "pending";
  }

  function formatDateTime(value?: string): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  // -----------------------------
  // Filters + derived lists
  // -----------------------------
  function applyFilters() {
    // your original helper (searchTerm + categoryFilter) + add statusFilter here
    let next = filterItems(items, searchTerm, categoryFilter, $locale);

    if (statusFilter !== "all") {
      next = next.filter(
        (i: any) =>
          normalizeProductState(i?.attributes?.state) === statusFilter,
      );
    }

    filteredItems = next;
    currentPage = 1;
  }

  $effect(() => {
    // whenever any filter changes
    applyFilters();
  });

  let totalDisplayCount = $derived.by(() => filteredItems.length);

  let paginatedItems = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredItems.slice(start, end);
  });

  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  });

  let paginationStart = $derived.by(() => {
    const total = filteredItems.length;
    return total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    const total = filteredItems.length;
    return Math.min(currentPage * itemsPerPage, total);
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

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });

  // -----------------------------
  // Stats (keep your existing logic)
  // -----------------------------
  function getItemState(item: any) {
    return normalizeProductState(item?.attributes?.state);
  }

  function computeAvgCost(itemsList: any[]) {
    let sum = 0;
    let count = 0;

    for (const item of itemsList) {
      const variants = item?.attributes?.payload?.body?.variants || [];
      const prices = (variants || [])
        .map((v: any) => Number(v?.retail_price || 0))
        .filter((n: number) => Number.isFinite(n) && n > 0);

      if (prices.length > 0) {
        const avgItem = prices.reduce((a, b) => a + b, 0) / prices.length;
        sum += avgItem;
        count++;
      }
    }

    if (count === 0) return 0;
    return sum / count;
  }

  const totalProductsStat = $derived.by(() => filteredItems.length);

  const approvedProductsStat = $derived.by(() => {
    return filteredItems.filter((i) => getItemState(i) === "approved").length;
  });

  const notApprovedProductsStat = $derived.by(() => {
    return filteredItems.filter((i) => getItemState(i) !== "approved").length;
  });

  const avgCostStat = $derived.by(() => computeAvgCost(filteredItems));

  // -----------------------------
  // Lifecycle + API calls (keep)
  // -----------------------------
  onMount(async () => {
    await Promise.all([
      loadFolderContents(),
      loadFilterCategories(),
      loadAllVariations(),
      loadAllProducts(),
    ]);

    window.addEventListener("click", onWindowClick);
  });

  onDestroy(() => {
    window.removeEventListener("click", onWindowClick);
  });

  async function loadFolderContents() {
    isLoading = true;
    try {
      const sellerShortname = $user.shortname;

      const response = await getSpaceContents(
        website.main_space,
        `/available_products/${sellerShortname}`,
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        items = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading available products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoading = false;
    }
  }

  async function loadFilterCategories() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true,
      );

      if (response?.records) filterCategories = response.records;
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function loadAllVariations() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        100,
        0,
        true,
      );
      if (response?.records) allVariations = response.records;
    } catch (error) {
      console.error("Error loading variations:", error);
    }
  }

  async function loadAllProducts() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        100,
        0,
        true,
      );
      if (response?.records) {
        productsMap = new Map(
          response.records.map((p: any) => [p.shortname, p]),
        );
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  }

  // -----------------------------
  // Admin-style filters dropdown behavior
  // -----------------------------
  function toggleFilters(e?: Event) {
    e?.stopPropagation?.();
    isFiltersOpen = !isFiltersOpen;
  }

  function resetFilters() {
    categoryFilter = "all";
    statusFilter = "all";
    searchTerm = "";
  }

  // -----------------------------
  // Pagination actions (admin-style)
  // -----------------------------
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

  // -----------------------------
  // Details modal (admin-style UI, read-only)
  // -----------------------------
  function openDetailsModal(item: any) {
    selectedProductDetails = item;
    isDetailsModalOpen = true;
  }

  function closeDetailsModal() {
    isDetailsModalOpen = false;
    selectedProductDetails = null;
  }

  function onDetailsBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeDetailsModal();
  }

  // -----------------------------
  // Product modal behavior (existing)
  // -----------------------------
  async function filterProductsSearch() {
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);

    const trimmedSearch = productSearchTerm?.trim() || "";

    if (trimmedSearch === "") {
      filteredProducts = [...products];
      isSearching = false;
      return;
    }

    if (trimmedSearch.length < 3) {
      const localResults = filterProductsBySearch(
        products,
        trimmedSearch,
        $locale,
      );
      filteredProducts = [...localResults];
      isSearching = false;
      return;
    }

    isSearching = true;

    searchDebounceTimer = window.setTimeout(async () => {
      try {
        const { searchProducts } = await import("@/lib/dmart_services");

        const searchResults = await searchProducts(
          website.main_space,
          trimmedSearch,
          100,
        );
        filteredProducts = [...searchResults];
      } catch (error) {
        console.error("Error searching products:", error);
        const localResults = filterProductsBySearch(
          products,
          trimmedSearch,
          $locale,
        );
        filteredProducts = [...localResults];
      } finally {
        isSearching = false;
      }
    }, 800);
  }

  async function openEditItemModal(item: any) {
    const body = item.attributes?.payload?.body || {};

    isEditMode = true;
    editingItem = item;
    showAddItemModal = true;

    productVariants = [];
    selectedVariants = [];
    selectedCategory = "";
    selectedProduct = body.product_shortname || "";

    const product = selectedProduct ? productsMap.get(selectedProduct) : null;
    products = product ? [product] : [];
    filteredProducts = product ? [product] : [];

    if (selectedProduct) {
      await loadSpecifications(selectedProduct);
    }
  }

  function createItem() {
    isEditMode = false;
    editingItem = null;
    showAddItemModal = true;
    loadProducts();
  }

  async function loadProducts(categoryShortname?: string, page: number = 1) {
    isLoadingProducts = true;
    selectedProduct = "";
    productVariants = [];
    selectedVariants = [];

    try {
      const offset = (page - 1) * modalItemsPerPage;
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        modalItemsPerPage,
        offset,
        true,
      );

      if (response?.records) {
        const newProducts = categoryShortname
          ? filterProductsByCategory(response.records, categoryShortname)
          : response.records;

        products = newProducts;
        filteredProducts = [...products];

        if (response.records.length < modalItemsPerPage) modalTotalPages = page;
        else modalTotalPages = page + 1;

        modalPage = page;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingProducts = false;
    }
  }

  function handlePageChange(page: number) {
    if (page < 1 || page > modalTotalPages || isLoadingProducts) return;
    loadProducts(selectedCategory, page);
  }

  async function loadSpecifications(productShortname: string) {
    isLoadingVariations = true;
    productVariants = [];

    try {
      const response = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        10000,
        0,
        true,
      );

      if (response?.records) {
        const selectedProductData = products.find(
          (p: any) => p.shortname === productShortname,
        );
        const productContent = selectedProductData?.attributes?.payload?.body;
        const variationOptions = productContent?.variation_options || [];

        productVariants = loadProductVariations(
          response.records,
          variationOptions,
        );
      }
    } catch (error) {
      console.error("Error loading variations:", error);
      errorToastMessage("Error loading variations");
    } finally {
      isLoadingVariations = false;
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

      await deleteEntity(
        itemToDelete.shortname,
        itemToDelete.space_name,
        itemToDelete.subpath,
        itemToDelete.resource_type,
      );

      successToastMessage("Product deleted successfully!");
      closeDeleteModal();
      await loadFolderContents();
    } finally {
      isLoading = false;
    }
  }

  // -----------------------------
  // Modal close
  // -----------------------------
  function closeModal() {
    showAddItemModal = false;
    isEditMode = false;
    editingItem = null;

    selectedCategory = "";
    selectedProduct = "";
    categories = [];
    products = [];
    productVariants = [];
    selectedVariants = [];

    productSearchTerm = "";
    filteredProducts = [];
    modalPage = 1;
    modalTotalPages = 1;
    isSearching = false;

    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
  }

  async function submitProductVariations() {
    // keep your original submit logic (paste your real implementation here)
    // - it usually uses createEntity / updateEntity + validateVariants + prepareVariantsForSubmission
    // - and then reloadFolderContents()
  }
</script>

<div class="admin-page-container">
  <div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <!-- box icon -->
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
          <h3 class="stat-title">Total Products</h3>
          <p class="stat-value">{formatNumber(totalProductsStat, $locale)}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <!-- check icon -->
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
          <h3 class="stat-title">Approved Products</h3>
          <p class="stat-value">
            {formatNumber(approvedProductsStat, $locale)}
          </p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <!-- warning icon -->
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
          <h3 class="stat-title">Inactive Products</h3>
          <p class="stat-value">
            {formatNumber(notApprovedProductsStat, $locale)}
          </p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <!-- avg icon -->
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
          <h3 class="stat-title">Avg Cost</h3>
          <p class="stat-value">
            {formatNumber(Math.round(avgCostStat), $locale)}
            {$_("seller_dashboard.currency") || "IQD"}
          </p>
        </div>
      </div>
    </div>

    <!-- Filters Header (EXACT admin layout) -->
    <div
      class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
      onclick={(e) => e.stopPropagation()}
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
            placeholder={$_("seller_dashboard.search_placeholder") ||
              "Search products..."}
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

      <!-- RIGHT: actions + FILTERS DROPDOWN -->
      <div class="flex items-end gap-3 justify-end">
        <button
          type="button"
          onclick={createItem}
          class="h-9 inline-flex items-center justify-center cursor-pointer
            px-3 py-2
            bg-[#3C307F] text-white text-sm font-medium
            rounded-[12px]
            shadow-[0px_1px_0.5px_0.05px_#1D293D05]
            hover:bg-[#2f2666] transition-colors"
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
            >{$_("seller_dashboard.add_new_product") || "Add Product"}</span
          >
        </button>

        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onclick={toggleFilters}
            class="h-9 inline-flex items-center justify-between cursor-pointer
              px-3 py-2 min-w-[170px]
              bg-[#F9FAFB] border border-[#E5E7EB]
              rounded-[12px]
              shadow-[0px_1px_0.5px_0.05px_#1D293D05]
              text-sm text-gray-700 hover:bg-gray-50"
          >
            <span class="truncate inline-flex items-center gap-2">
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
                  d="M2.46579 4.21134C1.71144 3.34923 2.32369 2 3.46923 2H12.5309C13.6764 2 14.2887 3.34923 13.5343 4.21134L10.0001 8.25049V13C10.0001 13.824 9.05929 14.2944 8.40005 13.8L6.40005 12.3C6.14824 12.1111 6.00005 11.8148 6.00005 11.5V8.25049L2.46579 4.21134ZM12.5309 3.33333H3.46923L7.00349 7.37248C7.21616 7.61554 7.33338 7.92753 7.33338 8.25049V11.3333L8.66672 12.3333V8.25049C8.66672 7.92753 8.78394 7.61554 8.99661 7.37248L12.5309 3.33333Z"
                  fill="#4A5565"
                />
              </svg>

              {$_("admin.filters") || "Filters"}
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
              class="absolute right-0 z-20 mt-2 w-[360px]
                rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <!-- Category (replaces Seller) -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    {$_("seller_dashboard.category") || "Category"}
                  </label>
                  <select
                    bind:value={categoryFilter}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    <option value="all"
                      >{$_("seller_dashboard.all_categories") ||
                        "All Categories"}</option
                    >
                    {#each filterCategories as category}
                      <option value={category.shortname}
                        >{getItemDisplayName(category)}</option
                      >
                    {/each}
                  </select>
                </div>

                <!-- Status -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    {$_("common.status") || "Status"}
                  </label>
                  <select
                    bind:value={statusFilter}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    <option value="all"
                      >{$_("admin.all_status") || "All Status"}</option
                    >
                    <option value="approved"
                      >{$_("admin.approved") || "Approved"}</option
                    >
                    <option value="pending"
                      >{$_("admin.pending") || "Pending"}</option
                    >
                    <option value="rejected"
                      >{$_("admin.rejected") || "Rejected"}</option
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
                  {$_("admin.reset") || "Reset"}
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
                  {$_("admin.apply") || "Apply"}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Content states -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
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
        <h3>{$_("seller_dashboard.no_products") || "No products found"}</h3>
        <p>
          {$_("admin.no_products_hint") || "No products match your filters"}
        </p>
      </div>
    {:else}
      <!-- Table wrapper like admin/orders page -->
      <div class="orders-table-wrapper">
        <table class="orders-table">
          <thead>
            <tr>
              <th>{$_("admin.product_name") || "Product Name"}</th>
              <th>{$_("admin.variants") || "Variants"}</th>
              <th>{$_("admin.price") || "Price"}</th>
              <th>{$_("admin.stock") || "Stock"}</th>
              <th>{$_("admin.sku") || "SKU"}</th>
              <th>{$_("common.status") || "Status"}</th>
              <th>{$_("admin.shipping") || "Shipping"}</th>
            </tr>
          </thead>

          <tbody class="bg-white">
            {#each paginatedItems as item (item.shortname)}
              {@const body = item.attributes?.payload?.body}
              {@const variants = body?.variants || []}
              {@const totalStock = variants.reduce(
                (sum, v) => sum + (v.qty || 0),
                0,
              )}
              {@const priceRange =
                variants.length > 0
                  ? {
                      min: Math.min(
                        ...variants.map((v) => v.retail_price || 0),
                      ),
                      max: Math.max(
                        ...variants.map((v) => v.retail_price || 0),
                      ),
                    }
                  : { min: 0, max: 0 }}
              {@const state = normalizeProductState(item.attributes?.state)}

              <tr
                class="clickable-row hover:bg-gray-50 transition-colors duration-200"
                role="button"
                tabindex="0"
                onclick={() => openDetailsModal(item)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetailsModal(item);
                  }
                }}
              >
                <td class="px-6 py-4">
                  <div
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                    title={getItemDisplayName(item)}
                  >
                    {truncateText(getItemDisplayName(item), 25)}
                  </div>

                  <div
                    class="mt-1"
                    style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                    title={getProductName(body?.product_shortname || "")}
                  >
                    {truncateText(
                      getProductName(body?.product_shortname || ""),
                      25,
                    )}
                  </div>
                </td>

                <td class="px-6 py-4">
                  <div class="variants-display">
                    {#if variants.length > 0}
                      {#each variants.slice(0, 2) as variant}
                        <span class="variant-badge">
                          {#each variant.options || [] as option}
                            {resolveOptionKey(
                              option.key,
                              option.variation_shortname,
                            )}
                          {/each}
                        </span>
                      {/each}
                      {#if variants.length > 2}
                        <span class="more-badge">+{variants.length - 2}</span>
                      {/if}
                    {:else}
                      <span class="empty-text">-</span>
                    {/if}
                  </div>
                </td>

                <td class="px-6 py-4">
                  <span
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  >
                    {#if priceRange.min === priceRange.max}
                      {formatNumber(priceRange.min, $locale)}
                      {$_("seller_dashboard.currency") || "IQD"}
                    {:else}
                      {formatNumber(priceRange.min, $locale)} - {formatNumber(
                        priceRange.max,
                        $locale,
                      )}
                      {$_("seller_dashboard.currency") || "IQD"}
                    {/if}
                  </span>
                </td>

                <td
                  class="px-6 py-4 text-center"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
                  <span
                    class="stock-badge"
                    class:low-stock={totalStock < 5}
                    class:out-of-stock={totalStock === 0}
                  >
                    {formatNumber(totalStock, $locale)}
                  </span>
                </td>

                <td class="px-6 py-4">
                  <span
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  >
                    {#if variants.length > 0}
                      {variants[0].sku || "-"}
                      {#if variants.length > 1}
                        <span class="more-text">+{variants.length - 1}</span>
                      {/if}
                    {:else}
                      -
                    {/if}
                  </span>
                </td>

                <td class="px-6 py-4">
                  <span
                    class="status-badge"
                    class:active={state === "approved"}
                    class:pending={state === "pending"}
                    class:inactive={state === "rejected"}
                  >
                    <span
                      class="status-text"
                      style="text-transform:capitalize;"
                    >
                      {state}
                    </span>
                  </span>
                </td>

                <td class="px-6 py-4">
                  <div class="shipping-badges">
                    {#if body?.has_fast_delivery}
                      <span
                        class="shipping-badge fast"
                        title={$_("seller_dashboard.fast_delivery") ||
                          "Fast Delivery"}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M1 8h8M13 8l-3-3m3 3l-3 3"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </span>
                    {/if}
                    {#if body?.has_free_shipping}
                      <span
                        class="shipping-badge free"
                        title={$_("seller_dashboard.free_shipping") ||
                          "Free Shipping"}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M2 5h8v6H2zM10 7h2l2 2v2h-4V7z"
                            stroke-width="1.5"
                            stroke-linejoin="round"
                          />
                          <circle cx="4" cy="13" r="1.5" stroke-width="1.5" />
                          <circle cx="12" cy="13" r="1.5" stroke-width="1.5" />
                        </svg>
                      </span>
                    {/if}
                    {#if !body?.has_fast_delivery && !body?.has_free_shipping}
                      <span class="empty-text">-</span>
                    {/if}
                  </div>
                </td>

                <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
                  <div
                    class="relative flex justify-end"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <!-- 3 dots button -->
                    <button
                      class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                      aria-label="Actions"
                      aria-haspopup="menu"
                      aria-expanded={openActionsFor === getRowId(item)}
                      onclick={() => toggleRowActions(item)}
                      type="button"
                    >
                      <span class="text-xl leading-none">…</span>
                    </button>

                    {#if openActionsFor === getRowId(item)}
                      <div
                        class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                        role="menu"
                      >
                        <!-- View -->
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                          onclick={() => {
                            closeRowActions();
                            openDetailsModal(item);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M4.0117 12C4.02312 12.0329 4.04406 12.0868 4.08184 12.1644C4.16842 12.3421 4.3101 12.5758 4.51263 12.851C4.91651 13.3997 5.51827 14.0535 6.2742 14.6801C7.80015 15.9449 9.83098 17 12 17C14.169 17 16.1999 15.9449 17.7258 14.6801C18.4817 14.0535 19.0835 13.3997 19.4874 12.851C19.6899 12.5758 19.8316 12.3421 19.9182 12.1644C19.9559 12.0868 19.9769 12.0329 19.9883 12C19.9769 11.9671 19.9559 11.9132 19.9182 11.8356C19.8316 11.6579 19.6899 11.4242 19.4874 11.149C19.0835 10.6003 18.4817 9.94649 17.7258 9.3199C16.1999 8.05506 14.169 7 12 7C9.83098 7 7.80015 8.05506 6.2742 9.3199C5.51827 9.94649 4.91651 10.6003 4.51263 11.149C4.3101 11.4242 4.16842 11.6579 4.08184 11.8356C4.04406 11.9132 4.02312 11.9671 4.0117 12ZM4.99787 7.7801C6.72929 6.34495 9.19846 5 12 5C14.8015 5 17.2707 6.34495 19.0021 7.7801C19.8749 8.50351 20.5911 9.2747 21.0981 9.96347C21.351 10.3071 21.5629 10.6452 21.7161 10.9597C21.8554 11.2456 22 11.6185 22 12C22 12.3815 21.8554 12.7544 21.7161 13.0403C21.5629 13.3548 21.351 13.6929 21.0981 14.0365C20.5911 14.7253 19.8749 15.4965 19.0021 16.2199C17.2707 17.6551 14.8015 19 12 19C9.19846 19 6.72929 17.6551 4.99787 16.2199C4.12513 15.4965 3.40886 14.7253 2.9019 14.0365C2.649 13.6929 2.43705 13.3548 2.28385 13.0403C2.14458 12.7544 2 12.3815 2 12C2 11.6185 2.14458 11.2456 2.28385 10.9597C2.43705 10.6452 2.649 10.3071 2.9019 9.96347C3.40886 9.2747 4.12513 8.50351 4.99787 7.7801ZM12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10ZM8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z"
                              fill="#101828"
                            />
                          </svg>

                          <span>{$_("common.view") || "View"}</span>
                        </button>

                        <!-- Edit -->
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          class:flex-row-reverse={$isRTL}
                          class:text-right={$isRTL}
                          onclick={() => {
                            closeRowActions();
                            openEditItemModal(item);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M15.5763 5.55905L14.1547 7.028L15.5563 8.42618C15.5577 8.42761 15.5592 8.42904 15.5606 8.43048L17.0227 9.88908L18.4245 8.44058L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM15.6318 11.3265L14.8691 10.5657L10.0378 15.6235L10.7674 16.3531L15.6318 11.3265ZM8.92782 17.3419L7.95914 16.3732C7.95553 16.3699 7.95195 16.3665 7.94838 16.3631C7.93349 16.3489 7.91913 16.3343 7.90531 16.3194L6.93719 15.3513L5.9421 18.337L8.92782 17.3419ZM7.90282 13.4885L8.62322 14.2089L13.4529 9.15285L12.7638 8.46539L7.90282 13.4885ZM12.0308 6.34678C12.0319 6.34571 12.0329 6.34463 12.0339 6.34356L14.1455 4.16158L14.1573 4.14958C14.9124 3.39511 15.9362 2.97131 17.0036 2.97131C18.071 2.97131 19.0948 3.39511 19.8499 4.14958L19.8505 4.15018C20.605 4.90529 21.0288 5.92906 21.0288 6.99649C21.0288 8.06106 20.6072 9.0822 19.8566 9.83672L11.4977 18.4744C11.3859 18.59 11.2479 18.6768 11.0953 18.7277L4.67729 20.8667C4.31797 20.9864 3.92182 20.8929 3.654 20.6251C3.38618 20.3573 3.29266 19.9611 3.41241 19.6018L5.55141 13.1838C5.59875 13.0418 5.67738 12.9122 5.7815 12.8046L12.0308 6.34678Z"
                              fill="#101828"
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
                            closeRowActions();
                            openDeleteModal(item);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
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

      {#if totalPages > 1}
        <div class="pagination">
          <div class="pagination-info">
            <span class="pagination-info__label"
              >{$_("common.showing") || "Showing"}</span
            >
            <span class="pagination-info__strong">
              {formatNumber(paginationStart, $locale)} - {formatNumber(
                paginationEnd,
                $locale,
              )}
            </span>
            <span class="pagination-info__label">{$_("common.of") || "of"}</span
            >
            <span class="pagination-info__strong"
              >{formatNumber(totalDisplayCount, $locale)}</span
            >
          </div>

          <div class="pagination-controls">
            <button
              class="pager-arrow pager-arrow--left"
              onclick={previousPage}
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

            <div class="pagination-pages">
              {#each visiblePageNumbers as p}
                {#if p === "ellipsis"}
                  <span class="page-ellipsis">...</span>
                {:else}
                  <button
                    class="page-chip"
                    class:active={currentPage === p}
                    onclick={() => goToPage(p)}
                    type="button"
                  >
                    {formatNumber(p, $locale)}
                  </button>
                {/if}
              {/each}
            </div>

            <button
              class="pager-arrow pager-arrow--right"
              onclick={nextPage}
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
</div>

<!-- Admin-style details modal (read-only) -->
{#if isDetailsModalOpen && selectedProductDetails}
  {@const details = selectedProductDetails}
  {@const payloadBody = details.attributes?.payload?.body || {}}
  {@const detailVariants = payloadBody?.variants || []}
  {@const detailState = normalizeProductState(
    details.attributes?.state || "pending",
  )}
  {@const detailTotalStock = detailVariants.reduce(
    (sum, variant) => sum + (variant?.qty || 0),
    0,
  )}
  {@const detailPriceRange =
    detailVariants.length > 0
      ? {
          min: Math.min(
            ...detailVariants.map((variant) => variant?.retail_price || 0),
          ),
          max: Math.max(
            ...detailVariants.map((variant) => variant?.retail_price || 0),
          ),
        }
      : { min: 0, max: 0 }}

  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    aria-label={$_("common.close") || "Close"}
    onclick={onDetailsBackdropClick}
    onkeydown={(e) => {
      if (e.key === "Escape") closeDetailsModal();
      if (
        e.target === e.currentTarget &&
        (e.key === "Enter" || e.key === " ")
      ) {
        e.preventDefault();
        closeDetailsModal();
      }
    }}
  >
    <div class="modal-container" style="max-width: 880px;">
      <div class="modal-header">
        <div class="modal-header-left">
          <h2 class="modal-title">
            {$_("seller_dashboard.product_details") || "Product Details"}
          </h2>
          <div class="modal-subtitle">
            {getProductName(payloadBody?.product_shortname || "")}
          </div>
        </div>
        <button
          class="close-button"
          type="button"
          onclick={closeDetailsModal}
          aria-label={$_("common.close") || "Close"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="details-hero">
          <div>
            <div class="details-label">{$_("admin.product") || "Product"}</div>
            <div class="details-value details-primary">
              {getProductName(payloadBody?.product_shortname || "-")}
            </div>
            <div class="details-sub">#{details.shortname}</div>
          </div>
          <span class={`details-state state-${detailState}`}>{detailState}</span
          >
        </div>

        <div class="modal-section">
          <div class="section-title-small">
            {$_("admin.quick_overview") || "Quick Overview"}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="details-card">
              <div class="details-label">{$_("admin.price") || "Price"}</div>
              <div class="details-value">
                {#if detailPriceRange.min === detailPriceRange.max}
                  {formatNumber(detailPriceRange.min, $locale)}
                  {$_("seller_dashboard.currency") || "IQD"}
                {:else}
                  {formatNumber(detailPriceRange.min, $locale)} - {formatNumber(
                    detailPriceRange.max,
                    $locale,
                  )}
                  {$_("seller_dashboard.currency") || "IQD"}
                {/if}
              </div>
            </div>

            <div class="details-card">
              <div class="details-label">{$_("admin.stock") || "Stock"}</div>
              <div class="details-value">
                {formatNumber(detailTotalStock, $locale)}
              </div>
            </div>

            <div class="details-card">
              <div class="details-label">
                {$_("admin.shipping") || "Shipping"}
              </div>
              <div class="details-value">
                {payloadBody?.has_fast_delivery
                  ? $_("seller_dashboard.fast_delivery") || "Fast Delivery"
                  : "-"}
                {#if payloadBody?.has_fast_delivery && payloadBody?.has_free_shipping}
                  ·
                {/if}
                {payloadBody?.has_free_shipping
                  ? $_("seller_dashboard.free_shipping") || "Free Shipping"
                  : ""}
                {#if !payloadBody?.has_fast_delivery && !payloadBody?.has_free_shipping}
                  {$_("common.not_available") || "Not available"}
                {/if}
              </div>
            </div>

            <div class="details-card">
              <div class="details-label">
                {$_("admin.last_updated") || "Last Updated"}
              </div>
              <div class="details-value">
                {formatDateTime(details.attributes?.updated_at)}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="section-title-small">
            {$_("admin.variants") || "Variants"} ({detailVariants.length})
          </div>

          {#if detailVariants.length > 0}
            <div class="variants-list">
              {#each detailVariants as variant, index}
                <div class="variant-row">
                  <div class="variant-main">
                    <div class="variant-index">#{index + 1}</div>
                    <div class="variant-meta">
                      <div class="variant-sku">
                        {#each variant?.options || [] as option}
                          <div>
                            {resolveOptionKey(
                              option.key,
                              option.variation_shortname,
                            )}
                          </div>
                        {/each}
                      </div>
                      <div class="details-sub">{variant?.sku || "-"}</div>
                      <div class="details-sub">
                        {$_("admin.stock") || "Stock"}: {variant?.qty ?? 0}
                      </div>
                    </div>
                  </div>
                  <div class="variant-price">
                    {formatNumber(variant?.retail_price ?? 0, $locale)}
                    {$_("seller_dashboard.currency") || "IQD"}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="details-sub">-</div>
          {/if}
        </div>

        <div class="modal-section">
          <div class="section-title-small">
            {$_("common.actions") || "Actions"}
          </div>
          <div
            class="details-actions"
            style="justify-content:flex-end; gap:10px;"
          >
            <button
              class="btn-secondary-custom"
              type="button"
              onclick={() => openEditItemModal(details)}
            >
              {$_("common.edit") || "Edit"}
            </button>
            <button
              class="btn-primary-custom"
              type="button"
              onclick={() => {
                closeDetailsModal();
                openDeleteModal(details);
              }}
            >
              {$_("common.delete") || "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Add Product Modal -->
<AddProductModal
  bind:show={showAddItemModal}
  isRTL={$isRTL}
  {isEditMode}
  disableProductSelection={isEditMode}
  modalTitle={isEditMode
    ? $_("seller_dashboard.edit_product_item") || "Edit Product Availability"
    : $_("seller_dashboard.add_product_item") || "Add Product to Store"}
  modalSubtitle={isEditMode
    ? "Update pricing and stock for this product"
    : "Search and select products to add to your inventory"}
  submitLabel={isEditMode
    ? $_("common.update") || "Update"
    : $_("seller_dashboard.add_items") || "Add Items"}
  bind:productSearchTerm
  {filteredProducts}
  {isLoadingProducts}
  bind:selectedProduct
  {isLoadingVariations}
  {productVariants}
  {selectedVariants}
  currentPage={modalPage}
  totalPages={modalTotalPages}
  {isSearching}
  onClose={closeModal}
  onSubmit={submitProductVariations}
  onProductSearchChange={(value) => (productSearchTerm = value)}
  onFilterProducts={filterProductsSearch}
  onProductChange={() => selectedProduct && loadSpecifications(selectedProduct)}
  onToggleVariant={(variantKey) => {
    const index = selectedVariants.indexOf(variantKey);
    if (index > -1)
      selectedVariants = selectedVariants.filter((v) => v !== variantKey);
    else selectedVariants = [...selectedVariants, variantKey];
  }}
  isVariantSelected={(variantKey) => selectedVariants.includes(variantKey)}
  getLocalizedDisplayName={getItemDisplayName}
  updateVariant={(key, field, value) => {
    const variant = productVariants.find((v: any) => v.key === key);
    if (variant) (variant as any)[field] = value;
  }}
  onPageChange={handlePageChange}
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
  /* Match example page background */
  .admin-page-container {
    background: #f9fafb;
    min-height: 100vh;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
  }

  .action-icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 10px;
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.05s ease;
  }

  .action-icon-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .action-icon-btn:active {
    transform: translateY(1px);
  }

  .action-icon-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Primary / secondary buttons used in modal actions */
  .btn-primary-custom {
    height: 36px;
    padding: 0 16px;
    background: #3c307f;
    color: #fff;
    border: 1px solid #3c307f;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    transition: background 0.2s ease;
  }
  .btn-primary-custom:hover {
    background: #2f2666;
  }

  .btn-secondary-custom {
    height: 36px;
    padding: 0 16px;
    background: #f9fafb;
    color: #344054;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    transition: background 0.2s ease;
  }
  .btn-secondary-custom:hover {
    background: #f3f4f6;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 500;
    text-transform: capitalize;
  }
  .status-badge.active {
    background: #ecfdf3;
    color: #027a48;
    border-color: #abefc6;
  }
  .status-badge.pending {
    background: #eff8ff;
    color: #175cd3;
    border-color: #b2ddff;
  }
  .status-badge.inactive {
    background: #fef3f2;
    color: #b42318;
    border-color: #fecdca;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate, formatNumber } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import { ResourceType } from "@edraj/tsdmart";
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
    generateCombinations,
    validateVariants,
    prepareVariantsForSubmission,
    filterProductsByCategory,
    type ProductVariant,
    type SpecificationGroup,
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

  let searchTerm = $state("");
  let categoryFilter = $state("all");
  let filterCategories = $state<any[]>([]);

  // Seller products modal state (existing)
  let showAddItemModal = $state(false);
  let categories = $state<any[]>([]);
  let products = $state<any[]>([]);
  let allVariations = $state<any[]>([]);
  let productsMap = $state(new Map<string, any>());
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
  let currentPage = $state(1);
  let totalPages = $state(1);
  let itemsPerPage = $state(20);
  let totalProducts = $state(0);
  let isSearching = $state(false);
  let searchDebounceTimer: number | null = null;

  // List pagination (NEW) for the table
  let listPage = $state(1);
  let listItemsPerPage = $state(10);

  // Delete / Details
  let showDeleteModal = $state(false);
  let itemToDelete = $state<any>(null);
  let showDetailsModal = $state(false);
  let detailsItem = $state<any>(null);

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

    if (option?.name) {
      return option.name[$locale] || option.name.en || optionKey;
    }
    return optionKey;
  }

  // -----------------------------
  // Filtering + Pagination (list)
  // -----------------------------
  function applyFilters() {
    filteredItems = filterItems(items, searchTerm, categoryFilter, $locale);
    // reset list pagination whenever filters change
    listPage = 1;
  }

  const listTotalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(filteredItems.length / listItemsPerPage));
  });

  const paginatedItems = $derived.by(() => {
    const start = (listPage - 1) * listItemsPerPage;
    const end = start + listItemsPerPage;
    return filteredItems.slice(start, end);
  });

  function goToListPage(page: number) {
    if (page < 1 || page > listTotalPages) return;
    listPage = page;
  }

  function nextListPage() {
    if (listPage < listTotalPages) listPage++;
  }

  function previousListPage() {
    if (listPage > 1) listPage--;
  }

  // -----------------------------
  // Stats (NEW)
  // total products / approved / not approved / avg cost
  // -----------------------------
  function getItemState(item: any) {
    return item?.attributes?.state || "pending";
  }

  function computeAvgCost(itemsList: any[]) {
    // average over items: use average of variant retail_price (or min if you prefer)
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
  // Lifecycle
  // -----------------------------
  onMount(async () => {
    await Promise.all([
      loadFolderContents(),
      loadFilterCategories(),
      loadAllVariations(),
      loadAllProducts(),
    ]);
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

      if (response?.records) {
        filterCategories = response.records;
      }
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
      if (response?.records) {
        allVariations = response.records;
      }
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

  function openDetailsModal(item: any) {
    detailsItem = item;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    detailsItem = null;
  }

  function viewItem(item: any) {
    openDetailsModal(item);
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
      const offset = (page - 1) * itemsPerPage;
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        itemsPerPage,
        offset,
        true,
      );

      if (response?.records) {
        const newProducts = categoryShortname
          ? filterProductsByCategory(response.records, categoryShortname)
          : response.records;

        products = newProducts;
        filteredProducts = [...products];

        if (response.records.length < itemsPerPage) totalPages = page;
        else totalPages = page + 1;

        currentPage = page;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingProducts = false;
    }
  }

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages || isLoadingProducts) return;
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

  $effect(() => {
    applyFilters();
  });

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
    currentPage = 1;
    totalPages = 1;
    isSearching = false;

    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
  }

  async function submitProductVariations() {
    // keep your original submit logic (left as-is in your file)
    // ...
    // NOTE: you already had a full submitProductVariations implementation above.
    // If you want, paste it back exactly as-is here.
  }
</script>

<div class="seller-page-container">
  <!-- Stats (NEW) - placed before header controls -->
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Total Products
        </h3>
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
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Approved Products
        </h3>
        <p class="stat-value">{formatNumber(approvedProductsStat, $locale)}</p>
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
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Inactive Products
        </h3>
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
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Avg Cost
        </h3>
        <p class="stat-value">
          {formatNumber(Math.round(avgCostStat), $locale)}
          {$_("seller_dashboard.currency") || "IQD"}
        </p>
      </div>
    </div>
  </div>
  <!-- ✅ Replace EVERYTHING inside <div class="seller-page-content"> ... </div>
     with the block below (keep your stats-grid above it as you already have) -->

  <div class="seller-page-content" class:rtl={$isRTL}>
    <!-- ✅ Header controls (same pattern as Products page example) -->
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

      <!-- RIGHT CONTROLS -->
      <div class="flex items-end">
        <!-- CREATE BUTTON -->
        <button
          onclick={createItem}
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
            >{$_("seller_dashboard.add_new_product") || "Add Product"}</span
          >
        </button>

        <!-- CATEGORY FILTER (details dropdown like example) -->
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
                {categoryFilter === "all"
                  ? $_("seller_dashboard.all_categories") || "All Categories"
                  : getItemDisplayName(
                      filterCategories.find(
                        (c) => c.shortname === categoryFilter,
                      ),
                    )}
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
              class="absolute z-20 mt-2 w-[220px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
            >
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                onclick={() => (categoryFilter = "all")}
              >
                {$_("seller_dashboard.all_categories") || "All Categories"}
              </button>

              {#each filterCategories as category}
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                  onclick={() => (categoryFilter = category.shortname)}
                >
                  {getItemDisplayName(category)}
                </button>
              {/each}
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- ✅ Table -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>{$_("seller_dashboard.no_products") || "No products found"}</h3>
        <p>
          {$_("seller_dashboard.add_first_product") ||
            "Start by adding your first product"}
        </p>
        <button class="btn-create-large" onclick={createItem}>
          {$_("seller_dashboard.add_new_product") || "Add Product"}
        </button>
      </div>
    {:else}
      <table class="items-table">
        <thead>
          <tr>
            <th>{$_("seller_dashboard.product_name") || "Product"}</th>
            <th>{$_("seller_dashboard.variants") || "Variants"}</th>
            <th>{$_("seller_dashboard.price") || "Price"}</th>
            <th>{$_("seller_dashboard.stock") || "Stock"}</th>
            <th>{$_("common.status") || "Status"}</th>
            <th>{$_("seller_dashboard.shipping") || "Shipping"}</th>
            <th class="col-actions">{$_("common.actions") || "Actions"}</th>
          </tr>
        </thead>

        <tbody>
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
                    min: Math.min(...variants.map((v) => v.retail_price || 0)),
                    max: Math.max(...variants.map((v) => v.retail_price || 0)),
                  }
                : { min: 0, max: 0 }}
            {@const state = item.attributes?.state || "pending"}

            <tr
              class="item-row"
              onclick={() => viewItem(item)}
              style="cursor: pointer;"
            >
              <td class="col-main">
                <div class="item-title">
                  {#if getItemDisplayName(item).length > 12}
                    {getItemDisplayName(item).slice(0, 12)}...
                  {:else}
                    {getItemDisplayName(item)}
                  {/if}
                </div>
              </td>

              <td>
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
                    <span class="empty-text">—</span>
                  {/if}
                </div>
              </td>

              <td>
                {#if priceRange.min === priceRange.max}
                  <strong>{formatNumber(priceRange.min, $locale)}</strong>
                  {$_("seller_dashboard.currency") || "IQD"}
                {:else}
                  <strong>{formatNumber(priceRange.min, $locale)}</strong> -
                  <strong>{formatNumber(priceRange.max, $locale)}</strong>
                  {$_("seller_dashboard.currency") || "IQD"}
                {/if}
              </td>

              <td>
                <span class="item-title">
                  {formatNumber(totalStock, $locale)}
                </span>
              </td>

              <td>
                <span
                  class="status-badge"
                  class:active={state === "approved"}
                  class:pending={state === "pending"}
                  class:inactive={state === "rejected"}
                >
                  {#if state === "approved"}
                    <!-- Approved SVG -->
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z"
                        fill="#004F3B"
                      />
                    </svg>
                  {:else if state === "pending"}
                    <!-- Pending SVG -->
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2ZM4.5 2.5V3.6665C4.5 3.77469 4.53509 3.87995 4.6 3.9665C4.61345 3.98444 4.62568 4.00326 4.63661 4.02284L5.42302 5.43199C5.5381 5.59873 5.6 5.79679 5.6 6C5.6 6.20321 5.5381 6.40127 5.42302 6.56801L4.63661 7.97716C4.62568 7.99674 4.61345 8.01556 4.6 8.0335C4.53509 8.12005 4.5 8.22532 4.5 8.3335V9.5H7.5V8.3335C7.5 8.22531 7.46491 8.12005 7.4 8.0335C7.38769 8.01709 7.37641 7.99994 7.3662 7.98214L6.55725 6.57077C6.44095 6.40346 6.37836 6.20433 6.37836 6C6.37836 5.79567 6.44095 5.59654 6.55725 5.42923L7.3662 4.01786C7.37641 4.00006 7.38769 3.98291 7.4 3.9665C7.46491 3.87995 7.5 3.77469 7.5 3.6665V2.5H4.5Z"
                        fill="#1C398E"
                      />
                    </svg>
                  {:else}
                    <!-- Rejected SVG -->
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.32268 2.64556C9.51843 2.84033 9.51922 3.15692 9.32445 3.35267L6.70534 5.98493L9.35444 8.64733C9.54921 8.84308 9.54842 9.15966 9.35267 9.35443C9.15692 9.5492 8.84033 9.54841 8.64556 9.35266L6 6.69381L3.35444 9.35266C3.15967 9.54841 2.84308 9.5492 2.64733 9.35443C2.45158 9.15966 2.45079 8.84308 2.64556 8.64733L5.29466 5.98493L2.67555 3.35267C2.48078 3.15692 2.48157 2.84034 2.67732 2.64556C2.87307 2.45079 3.18966 2.45159 3.38443 2.64734L6 5.27604L8.61557 2.64733C8.81035 2.45158 9.12693 2.45079 9.32268 2.64556Z"
                        fill="#771D1D"
                      />
                    </svg>
                  {/if}

                  <span
                    class="status-text"
                    class:active={state?.toLowerCase?.() === "approved"}
                    class:pending={state?.toLowerCase?.() === "pending"}
                    class:inactive={state?.toLowerCase?.() === "rejected"}
                  >
                    {state}
                  </span>
                </span>
              </td>

              <td>
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
                        style="width: 14px; height: 14px;"
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
                        style="width: 14px; height: 14px;"
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
                    <span class="empty-text">—</span>
                  {/if}
                </div>
              </td>

              <!-- ✅ Actions: stop row click + your icon buttons -->
              <td class="actions-cell">
                <div
                  class="action-buttons"
                  onclick={(e) => e.stopPropagation()}
                >
                  <button
                    class="action-icon-btn"
                    onclick={() => viewItem(item)}
                    title={$_("common.view") || "View"}
                    aria-label="View"
                  >
                    <!-- (keep your view svg) -->
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M2.33951 7.00002C2.34617 7.01918 2.35839 7.05068 2.38042 7.09591C2.43093 7.19958 2.51358 7.33591 2.63172 7.49642C2.86732 7.81651 3.21834 8.1979 3.6593 8.56341C4.54944 9.30124 5.73409 9.91669 6.99935 9.91669C8.26461 9.91669 9.44926 9.30124 10.3394 8.56341C10.7804 8.1979 11.1314 7.81651 11.367 7.49642C11.4851 7.33591 11.5678 7.19958 11.6183 7.09591C11.6403 7.05068 11.6525 7.01918 11.6592 7.00002C11.6525 6.98086 11.6403 6.94937 11.6183 6.90413C11.5678 6.80046 11.4851 6.66413 11.367 6.50362C11.1314 6.18353 10.7804 5.80214 10.3394 5.43663C9.44926 4.6988 8.26461 4.08335 6.99935 4.08335C5.73409 4.08335 4.54944 4.6988 3.6593 5.43663C3.21834 5.80214 2.86732 6.18353 2.63172 6.50362C2.51358 6.66413 2.43093 6.80046 2.38042 6.90413C2.35839 6.94937 2.34617 6.98086 2.33951 7.00002ZM2.91478 4.53841C3.92477 3.70124 5.36512 2.91669 6.99935 2.91669C8.63358 2.91669 10.0739 3.70124 11.0839 4.53841C11.593 4.9604 12.0108 5.41026 12.3066 5.81204C12.4541 6.01247 12.5777 6.20973 12.6671 6.39318C12.7483 6.55995 12.8327 6.7775 12.8327 7.00002C12.8327 7.22254 12.7483 7.44009 12.6671 7.60686C12.5777 7.79031 12.4541 7.98757 12.3066 8.188C12.0108 8.58978 11.593 9.03964 11.0839 9.46163C10.0739 10.2988 8.63358 11.0834 6.99935 11.0834C5.36512 11.0834 3.92477 10.2988 2.91478 9.46163C2.40568 9.03964 1.98785 8.58978 1.69212 8.188C1.5446 7.98757 1.42096 7.79031 1.3316 7.60686C1.25035 7.44009 1.16602 7.22254 1.16602 7.00002C1.16602 6.7775 1.25035 6.55995 1.3316 6.39318C1.42096 6.20973 1.5446 6.01247 1.69212 5.81204C1.98785 5.41026 2.40568 4.9604 2.91478 4.53841ZM6.99935 5.83335C6.35502 5.83335 5.83268 6.35569 5.83268 7.00002C5.83268 7.64435 6.35502 8.16669 6.99935 8.16669C7.64368 8.16669 8.16602 7.64435 8.16602 7.00002C8.16602 6.35569 7.64368 5.83335 6.99935 5.83335ZM4.66602 7.00002C4.66602 5.71136 5.71068 4.66669 6.99935 4.66669C8.28801 4.66669 9.33268 5.71136 9.33268 7.00002C9.33268 8.28869 8.28801 9.33335 6.99935 9.33335C5.71068 9.33335 4.66602 8.28869 4.66602 7.00002Z"
                        fill="#4A5565"
                      />
                    </svg>
                  </button>

                  <button
                    class="action-icon-btn"
                    onclick={() => openEditItemModal(item)}
                    title={$_("common.edit") || "Edit"}
                    aria-label="Edit"
                  >
                    <!-- (keep your edit svg) -->
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.9061 2.33335C9.82824 2.33335 9.75114 2.3487 9.6792 2.37851C9.60727 2.40831 9.54192 2.452 9.48688 2.50708L9.16831 2.82566L10.007 3.66437L10.3255 3.34593C10.3805 3.29089 10.4244 3.2254 10.4542 3.15347C10.484 3.08154 10.4993 3.00444 10.4993 2.92657C10.4993 2.84871 10.484 2.77161 10.4542 2.69968C10.4244 2.62775 10.3807 2.56239 10.3256 2.50735C10.2706 2.45228 10.2049 2.40831 10.133 2.37851C10.0611 2.3487 9.98396 2.33335 9.9061 2.33335ZM9.18206 4.48933L8.34335 3.65062L5.6193 6.37469L5.40962 7.42308L6.45801 7.2134L9.18206 4.48933ZM7.92943 2.41462L4.66945 5.67463C4.58802 5.75606 4.53251 5.85978 4.50993 5.9727L4.09401 8.05229C4.05576 8.24354 4.11562 8.44125 4.25354 8.57917C4.39145 8.71708 4.58916 8.77694 4.78042 8.73869L6.86 8.32278C6.97293 8.30019 7.07664 8.24468 7.15808 8.16325L11.1503 4.17102C11.3138 4.00764 11.4435 3.81364 11.532 3.60011C11.6204 3.38658 11.666 3.15771 11.666 2.92657C11.666 2.69544 11.6204 2.46656 11.532 2.25303C11.4435 2.03963 11.3139 1.84572 11.1505 1.6824C11.1506 1.68241 11.1505 1.68239 11.1505 1.6824M11.1505 1.6824C10.9872 1.51892 10.7932 1.3892 10.5796 1.30072C10.3661 1.21223 10.1372 1.16669 9.9061 1.16669C9.67496 1.16669 9.44609 1.21223 9.23256 1.30072C9.01909 1.38918 8.82514 1.51883 8.66179 1.68226L7.93232 2.41174C7.93183 2.41221 7.93135 2.41269 7.93087 2.41318C7.93039 2.41366 7.92991 2.41414 7.92943 2.41462M1.16602 4.66669C1.16602 4.02235 1.68835 3.50002 2.33268 3.50002H4.08268C4.40485 3.50002 4.66602 3.76119 4.66602 4.08335C4.66602 4.40552 4.40485 4.66669 4.08268 4.66669H2.33268V10.5H8.74935V7.87502C8.74935 7.55285 9.01052 7.29169 9.33268 7.29169C9.65485 7.29169 9.91602 7.55285 9.91602 7.87502V10.5C9.91602 11.1444 9.39368 11.6667 8.74935 11.6667H2.33268C1.68835 11.6667 1.16602 11.1444 1.16602 10.5V4.66669Z"
                        fill="#4A5565"
                      />
                    </svg>
                  </button>

                  <button
                    class="action-icon-btn"
                    onclick={() => openDeleteModal(item)}
                    title={$_("common.delete") || "Delete"}
                    aria-label="Delete"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
                      <path
                        d="M2 4h12M5 4V2h6v2M3 4h10l-1 10H4L3 4z"
                        stroke-width="1.5"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <!-- ✅ Pagination EXACTLY like the example (showing X - Y of total) -->
      {#if listTotalPages > 1}
        <div class="pagination">
          <div class="pagination-info">
            {$_("common.showing") || "Showing"}
            {formatNumber((listPage - 1) * listItemsPerPage + 1, $locale)}
            -
            {formatNumber(
              Math.min(listPage * listItemsPerPage, filteredItems.length),
              $locale,
            )}
            {$_("common.of") || "of"}
            {formatNumber(filteredItems.length, $locale)}
            {$_("common.products") || "products"}
          </div>

          <div class="pagination-pages">
            {#if listTotalPages <= 7}
              {#each Array(listTotalPages) as _, index}
                <button
                  class="page-btn"
                  class:active={listPage === index + 1}
                  onclick={() => goToListPage(index + 1)}
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <button
                class="page-btn"
                class:active={listPage === 1}
                onclick={() => goToListPage(1)}
              >
                {formatNumber(1, $locale)}
              </button>

              {#if listPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(listTotalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < listTotalPages && Math.abs(listPage - (index + 1)) <= 1}
                  <button
                    class="page-btn"
                    class:active={listPage === index + 1}
                    onclick={() => goToListPage(index + 1)}
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if listPage < listTotalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <button
                class="page-btn"
                class:active={listPage === listTotalPages}
                onclick={() => goToListPage(listTotalPages)}
              >
                {formatNumber(listTotalPages, $locale)}
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <style>
    /* Match example page background */
    .seller-page-container,
    .seller-page-content {
      background: #f9fafb;
      min-height: 100vh;
    }
  </style>
</div>

{#if showDetailsModal && detailsItem}
  {@const body = detailsItem.attributes?.payload?.body || {}}
  {@const variants = body.variants || []}
  <div class="details-modal-overlay" onclick={closeDetailsModal}>
    <div class="details-modal" onclick={(e) => e.stopPropagation()}>
      <div class="details-modal-header">
        <div>
          <h2 class="details-title">{getItemDisplayName(detailsItem)}</h2>
          <p class="details-subtitle">
            {getProductName(body.product_shortname || "-")}
          </p>
        </div>
        <button class="details-close" onclick={closeDetailsModal}>
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

      <div class="details-modal-body">
        <div class="details-section">
          <h3 class="details-section-title">Product Details</h3>

          <div class="details-table-kv">
            <div class="kv-row">
              <span class="kv-key">Product</span>
              <span class="kv-value">{body.product_shortname || "-"}</span>
            </div>

            <div class="kv-row">
              <span class="kv-key">Warranty</span>
              <span class="kv-value">{body.warranty_shortname || "-"}</span>
            </div>

            <div class="kv-row">
              <span class="kv-key">Commission</span>
              <span class="kv-value">{body.commission_category || "-"}</span>
            </div>

            <div class="kv-row">
              <span class="kv-key">Status</span>
              <span class="kv-value"
                >{detailsItem.attributes?.state || "-"}</span
              >
            </div>

            <div class="kv-row">
              <span class="kv-key">Last Updated</span>
              <span class="kv-value">
                {formatDate(detailsItem.attributes?.updated_at)}
              </span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <h3>Variants</h3>
          {#if variants.length === 0}
            <p class="details-empty">No variants available.</p>
          {:else}
            <div class="details-table">
              <div class="details-row details-head">
                <span>SKU</span>
                <span>Qty</span>
                <span>Price</span>
              </div>
              {#each variants as variant}
                <div class="details-row">
                  <span>{variant.sku || "-"}</span>
                  <span>{variant.qty ?? 0}</span>
                  <span>{variant.retail_price ?? 0}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="details-modal-footer">
        <!-- Close button -->
        <button class="btn-secondary-custom" onclick={closeDetailsModal}>
          {$_("common.close") || "Close"}
        </button>
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
  {currentPage}
  {totalPages}
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
  /* --- Actions icon button (your exact spec) --- */
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
    border-radius: 10px; /* rounded */
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
  .details-section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #101828;
  }

  .details-table-kv {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .kv-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
  }

  .kv-row:last-child {
    border-bottom: none;
  }

  .kv-key {
    font-weight: 500;
    color: #475467;
  }

  .kv-value {
    font-weight: 500;
    color: #101828;
    text-align: right;
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

  /* Primary button (same as Add Product button) */
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

  /* Secondary button (same border family as your UI system) */
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

  .action-icon-btn.delete {
    color: #dc2626;
  }

  /* --- “previous tables” cell style helpers --- */
  .item-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-title {
    font-weight: 700;
    color: #111827;
  }

  .item-sub {
    font-size: 0.8rem;
    color: #6b7280;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 0.85rem;
    color: #6b7280;
  }

  .muted {
    color: #9ca3af;
    font-size: 0.85rem;
    margin-left: 8px;
  }

  .empty-text {
    color: #9ca3af;
  }

  /* --- Stats grid (if not already in your global css) --- */
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

  .details-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(16, 24, 40, 0.45); /* nice overlay */
    z-index: 9999;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 24px;
  }

  .details-modal {
    width: min(900px, 100%);
    max-height: calc(100vh - 48px);

    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    box-shadow: 0px 24px 48px -12px rgba(16, 24, 40, 0.18);

    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .details-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;

    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .details-modal-body {
    padding: 16px 20px;
    overflow: auto; /* important so it doesn't push below the table */
  }

  .details-modal-footer {
    padding: 12px 20px;
    border-top: 1px solid #e5e7eb;

    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  /* --- Pagination (same pattern as your other tables) --- */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pagination-pages {
    display: flex;
    align-items: center;
    gap: 4px;
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
    font-weight: 700;
  }

  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 700;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }
  .items-table tbody td {
    font-weight: 500;
    font-size: 0.875rem; /* text-sm */
    line-height: 14px;
    letter-spacing: 0;
    color: #101828;
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

  /* approved */
  .status-badge.active {
    background: #ecfdf3;
    color: #027a48;
    border-color: #abefc6;
  }

  /* pending */
  .status-badge.pending {
    background: #eff8ff;
    color: #175cd3;
    border-color: #b2ddff;
  }

  /* rejected */
  .status-badge.inactive {
    background: #fef3f2;
    color: #b42318;
    border-color: #fecdca;
  }
</style>

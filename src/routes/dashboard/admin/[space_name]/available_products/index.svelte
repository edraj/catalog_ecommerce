<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    getSpaceContents,
    progressAvailableProductTicket,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import "./index.css";
  import { website } from "@/config";

  let sellers = $state<any[]>([]);
  let selectedSeller = $state("all");
  let previousSeller = $state("all");
  let products = $state<any[]>([]);
  let isLoadingSellers = $state(true);
  let isLoadingProducts = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let productsMap = $state<Map<string, any>>(new Map());
  let allVariations = $state<any[]>([]);
  let totalProductsCount = $state(0);

  let currentPage = $state(1);
  let itemsPerPage = 20;

  let isFiltersOpen = $state(false);
  let isDetailsModalOpen = $state(false);
  let selectedProductDetails = $state<any | null>(null);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function t(key: string, vars?: Record<string, unknown>) {
    return globalThis.$(_)(key, vars);
  }

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  function getSellerDisplayName(seller: any): string {
    if (seller.attributes?.displayname) return getItemDisplayName(seller);
    return seller.shortname;
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
  function truncateText(value: string, maxLength = 25): string {
    if (!value) return "";
    return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
  }

  function normalizeProductState(state: string): string {
    if (state === "canceled") return "rejected";
    return state || "pending";
  }

  function toWorkflowState(state: string): string {
    if (state === "rejected") return "canceled";
    return state;
  }

  function formatDateTime(value?: string): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function openDetailsModal(item: any) {
    selectedProductDetails = item;
    isDetailsModalOpen = true;
  }

  function closeDetailsModal() {
    isDetailsModalOpen = false;
    selectedProductDetails = null;
  }

  function onDetailsBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeDetailsModal();
    }
  }

  let filteredProducts = $derived.by(() => {
    let filtered = [...products];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getItemDisplayName(item).toLowerCase();
        const productName = getProductName(
          item.attributes?.payload?.body?.product_shortname || "",
        ).toLowerCase();
        return (
          displayName.includes(searchLower) || productName.includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (item) =>
          normalizeProductState(item.attributes?.state) === statusFilter,
      );
    }

    return filtered;
  });

  let paginatedProducts = $derived.by(() => {
    const source =
      searchTerm || statusFilter !== "all" ? filteredProducts : products;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return source.slice(start, end);
  });

  let totalPages = $derived.by(() => {
    if (searchTerm || statusFilter !== "all") {
      return Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
    }
    return Math.max(1, Math.ceil(totalProductsCount / itemsPerPage));
  });

  let paginationStart = $derived.by(() => {
    const total =
      searchTerm || statusFilter !== "all"
        ? filteredProducts.length
        : totalProductsCount;
    return total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    const total =
      searchTerm || statusFilter !== "all"
        ? filteredProducts.length
        : totalProductsCount;
    return Math.min(currentPage * itemsPerPage, total);
  });

  let totalDisplayCount = $derived.by(() => {
    return searchTerm || statusFilter !== "all"
      ? filteredProducts.length
      : totalProductsCount;
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

  let statsTotalProducts = $derived.by(() => totalDisplayCount);

  let statsTotalSellers = $derived.by(() => {
    // sellers are folders in available_products
    return sellers?.length || 0;
  });

  // define "active" as approved, "inactive" as everything else
  let statsActiveProducts = $derived.by(() => {
    const list =
      searchTerm || statusFilter !== "all" ? filteredProducts : products;
    return list.filter((p) => (p.attributes?.state || "pending") === "approved")
      .length;
  });

  let statsInactiveProducts = $derived.by(() => {
    const list =
      searchTerm || statusFilter !== "all" ? filteredProducts : products;
    return (
      list.length -
      list.filter((p) => (p.attributes?.state || "pending") === "approved")
        .length
    );
  });

  onMount(async () => {
    await Promise.all([loadSellers(), loadAllVariations(), loadAllProducts()]);
    await loadSellerProducts();
    window.addEventListener("click", onWindowClick);
  });

  onDestroy(() => {
    window.removeEventListener("click", onWindowClick);
  });

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "available_products",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        sellers = response.records.filter(
          (record) => record.resource_type === "folder",
        );
      }
    } catch (error) {
      console.error("Error loading sellers:", error);
      errorToastMessage("Error loading sellers");
    } finally {
      isLoadingSellers = false;
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
        productsMap = new Map(response.records.map((p) => [p.shortname, p]));
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  }

  async function loadSellerProducts() {
    isLoadingProducts = true;
    const offset = (currentPage - 1) * itemsPerPage;

    try {
      if (selectedSeller === "all") {
        const allProducts: any[] = [];
        let totalCount = 0;

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `available_products/${seller.shortname}`,
              "managed",
              itemsPerPage,
              offset,
              true,
            );

            if (response?.records) allProducts.push(...response.records);
            if (response?.attributes?.total)
              totalCount += response.attributes.total;
          } catch (error) {
            console.error(
              `Error loading products for ${seller.shortname}:`,
              error,
            );
          }
        }

        products = allProducts;
        totalProductsCount = totalCount || allProducts.length;
      } else {
        const response = await getSpaceContents(
          website.main_space,
          `available_products/${selectedSeller}`,
          "managed",
          itemsPerPage,
          offset,
          true,
        );

        if (response?.records) {
          products = response.records;
          totalProductsCount =
            response.attributes?.total || response.records.length;
        }
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingProducts = false;
    }
  }

  async function updateProductStatus(item: any, newStatus: string) {
    try {
      const currentState = normalizeProductState(item.attributes?.state);
      if (currentState === newStatus) {
        return;
      }

      if (newStatus === "pending") {
        errorToastMessage(
          "Pending is an initial state and cannot be selected from here",
        );
        return;
      }

      const sellerShortname = item.subpath?.split("/")?.[1];
      if (!sellerShortname) {
        errorToastMessage("Invalid seller path for product ticket");
        return;
      }

      const success = await progressAvailableProductTicket(
        website.main_space,
        sellerShortname,
        item.shortname,
        newStatus,
      );

      if (!success) {
        errorToastMessage("Failed to update product status");
        return;
      }

      const updatedAttributes = {
        ...item.attributes,
        state: toWorkflowState(newStatus),
      };

      successToastMessage(`Product status updated to ${newStatus}`);

      const productIndex = products.findIndex(
        (p) => p.shortname === item.shortname,
      );
      if (productIndex !== -1) {
        products[productIndex] = {
          ...products[productIndex],
          attributes: updatedAttributes,
        };
      }

      if (selectedProductDetails?.shortname === item.shortname) {
        selectedProductDetails = {
          ...selectedProductDetails,
          attributes: updatedAttributes,
        };
      }
    } catch (error) {
      console.error("Error updating product status:", error);
      errorToastMessage("Failed to update product status");
    }
  }

  // ---------------------------
  // Pagination actions (unchanged)
  // ---------------------------
  function goToPage(page: number) {
    currentPage = page;
    if (!searchTerm && statusFilter === "all") loadSellerProducts();
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      if (!searchTerm && statusFilter === "all") loadSellerProducts();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      if (!searchTerm && statusFilter === "all") loadSellerProducts();
    }
  }

  // ---------------------------
  // Effects (unchanged)
  // ---------------------------
  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      currentPage = 1;
      loadSellerProducts();
    }
  });

  $effect(() => {
    if (searchTerm || statusFilter !== "all") {
      currentPage = 1;
    }
  });

  // ---------------------------
  // Filters dropdown helpers (like orders page)
  // ---------------------------
  function toggleFilters(e?: Event) {
    e?.stopPropagation?.();
    isFiltersOpen = !isFiltersOpen;
  }

  function resetFilters() {
    selectedSeller = "all";
    statusFilter = "all";
  }

  function onWindowClick() {
    if (isFiltersOpen) isFiltersOpen = false;
  }

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });
</script>

<div class="admin-page-container">
  <div>
    <!-- Header -->

    {#if isLoadingSellers}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else}
      <!-- Stats Grid (like orders page) -->
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
              {$_("admin.total_products") || "Total Products"}
            </h3>
            <p class="stat-value">{statsTotalProducts}</p>
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
                d="M18 6C14.6863 6 12 8.68629 12 12C12 15.3137 14.6863 18 18 18C21.3137 18 24 15.3137 24 12C24 8.68629 21.3137 6 18 6ZM9 12C9 7.02944 13.0294 3 18 3C22.9706 3 27 7.02944 27 12C27 16.9706 22.9706 21 18 21C13.0294 21 9 16.9706 9 12ZM6 30C6 26.6863 8.68629 24 12 24H24C27.3137 24 30 26.6863 30 30V31.5H27V30C27 28.3431 25.6569 27 24 27H12C10.3431 27 9 28.3431 9 30V31.5H6V30Z"
                fill="#3C307F"
              />
            </svg>
          </div>
          <div class="stat-content">
            <h3 class="stat-title">
              {$_("admin.total_sellers") || "Total Sellers"}
            </h3>
            <p class="stat-value">{statsTotalSellers}</p>
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
              {$_("admin.active_products") || "Active Products"}
            </h3>
            <p class="stat-value">{statsActiveProducts}</p>
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
              {$_("admin.inactive_products") || "Inactive Products"}
            </h3>
            <p class="stat-value">{statsInactiveProducts}</p>
          </div>
        </div>
      </div>

      <!-- Filters Header (match orders layout) -->
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
              placeholder={$_("admin.search_products") || "Search products..."}
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

        <!-- RIGHT: FILTERS DROPDOWN -->
        <div class="flex items-end gap-3 justify-end">
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
                  <!-- Seller -->
                  <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">
                      {$_("admin.seller") || "Seller"}
                    </label>
                    <select
                      bind:value={selectedSeller}
                      class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                    >
                      <option value="all"
                        >{$_("admin.all_sellers") || "All Sellers"}</option
                      >
                      {#each sellers as seller}
                        <option value={seller.shortname}
                          >{getSellerDisplayName(seller)}</option
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
      {#if isLoadingProducts}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>{$_("common.loading") || "Loading products..."}</p>
        </div>
      {:else if filteredProducts.length === 0}
        <div class="empty-state">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
            <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
            <path
              d="M16 24h16M24 16v16"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <h3>{$_("admin.no_products") || "No products found"}</h3>
          <p>
            {$_("admin.no_products_hint") || "No products match your filters"}
          </p>
        </div>
      {:else}
        <!-- Table wrapper like orders page -->
        <div class="orders-table-wrapper">
          <table class="orders-table">
            <thead>
              <tr>
                <th>{$_("admin.product_name") || "Product Name"}</th>
                <th>{$_("admin.seller") || "Seller"}</th>
                <th>{$_("admin.variants") || "Variants"}</th>
                <th>{$_("admin.price") || "Price"}</th>
                <th>{$_("admin.stock") || "Stock"}</th>
                <th>{$_("admin.sku") || "SKU"}</th>
                <th>{$_("common.status") || "Status"}</th>
                <th>{$_("admin.shipping") || "Shipping"}</th>
              </tr>
            </thead>

            <tbody class="bg-white">
              {#each paginatedProducts as item (item.shortname)}
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
                {@const sellerShortname = item.subpath.split("/")[1]}
                {@const seller = sellers.find(
                  (s) => s.shortname === sellerShortname,
                )}

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
                    <span
                      class="inline-flex items-center rounded-sm border px-2 py-0.5"
                      style="height:20px;background:#F3F4F6;border-color:#E5E7EB;"
                      title={seller
                        ? getSellerDisplayName(seller)
                        : sellerShortname}
                    >
                      <span
                        style="font-weight:500;font-size:12px;line-height:16px;color:#101828;"
                      >
                        {seller
                          ? getSellerDisplayName(seller)
                          : sellerShortname}
                      </span>
                    </span>
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
                        {priceRange.min.toLocaleString()}
                        {$_("admin.currency") || "IQD"}
                      {:else}
                        {priceRange.min.toLocaleString()} - {priceRange.max.toLocaleString()}
                        {$_("admin.currency") || "IQD"}
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
                      {totalStock}
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
                    <select
                      class="status-select"
                      class:approved={state === "approved"}
                      class:pending={state === "pending"}
                      class:rejected={state === "rejected"}
                      value={state}
                      onclick={(e) => e.stopPropagation()}
                      onkeydown={(e) => e.stopPropagation()}
                      onchange={(e) =>
                        updateProductStatus(item, e.currentTarget.value)}
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
                  </td>

                  <td class="px-6 py-4">
                    <div class="shipping-badges">
                      {#if body?.has_fast_delivery}
                        <span
                          class="shipping-badge fast"
                          title={$_("admin.fast_delivery") || "Fast Delivery"}
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
                          title={$_("admin.free_shipping") || "Free Shipping"}
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
                            <circle
                              cx="12"
                              cy="13"
                              r="1.5"
                              stroke-width="1.5"
                            />
                          </svg>
                        </span>
                      {/if}
                      {#if !body?.has_fast_delivery && !body?.has_free_shipping}
                        <span class="empty-text">-</span>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination (same UI as orders page) -->
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
                  Math.min(currentPage * itemsPerPage, totalProductsCount),
                  $locale,
                )}
              </span>

              <span class="pagination-info__label">
                {$_("common.of") || "of"}
              </span>

              <span class="pagination-info__strong">
                {formatNumber(totalProductsCount, $locale)}
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
    {/if}
  </div>
</div>

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
            {$_("admin.available_product_details") ||
              "Available Product Details"}
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
          <span class={`details-state state-${detailState}`}>
            {detailState}
          </span>
        </div>

        <div class="modal-section">
          <div class="section-title-small">
            {$_("admin.quick_overview") || "Quick Overview"}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="details-card">
              <div class="details-label">{$_("admin.seller") || "Seller"}</div>
              <div class="details-value">
                {details.attributes?.owner_shortname ||
                  details.subpath?.split("/")?.[1] ||
                  "-"}
              </div>
            </div>
            <div class="details-card">
              <div class="details-label">{$_("admin.price") || "Price"}</div>
              <div class="details-value">
                {#if detailPriceRange.min === detailPriceRange.max}
                  {detailPriceRange.min.toLocaleString()}
                  {$_("admin.currency") || "IQD"}
                {:else}
                  {detailPriceRange.min.toLocaleString()} - {detailPriceRange.max.toLocaleString()}
                  {$_("admin.currency") || "IQD"}
                {/if}
              </div>
            </div>
            <div class="details-card">
              <div class="details-label">{$_("admin.stock") || "Stock"}</div>
              <div class="details-value">{detailTotalStock}</div>
            </div>
            <div class="details-card">
              <div class="details-label">
                {$_("admin.shipping") || "Shipping"}
              </div>
              <div class="details-value">
                {payloadBody?.has_fast_delivery
                  ? $_("admin.fast_delivery") || "Fast Delivery"
                  : "-"}
                {#if payloadBody?.has_fast_delivery && payloadBody?.has_free_shipping}
                  ·
                {/if}
                {payloadBody?.has_free_shipping
                  ? $_("admin.free_shipping") || "Free Shipping"
                  : ""}
                {#if !payloadBody?.has_fast_delivery && !payloadBody?.has_free_shipping}
                  {$_("common.not_available") || "Not available"}
                {/if}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="section-title-small">
            {$_("common.status") || "Status"}
          </div>
          <div class="details-actions">
            <select
              class="status-select"
              class:approved={detailState === "approved"}
              class:rejected={detailState === "rejected"}
              value={detailState}
              onchange={(e) =>
                updateProductStatus(details, e.currentTarget.value)}
            >
              <option value="approved"
                >{$_("admin.approved") || "Approved"}</option
              >
              <option value="rejected"
                >{$_("admin.rejected") || "Rejected"}</option
              >
            </select>
            <div class="details-sub">
              {$_("admin.last_updated") || "Last Updated"}: {formatDateTime(
                details.attributes?.updated_at,
              )}
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
                      <div class="details-sub">
                        {variant?.sku || "-"}
                      </div>
                      <div class="details-sub">
                        {$_("admin.stock") || "Stock"}: {variant?.qty ?? 0}
                      </div>
                    </div>
                  </div>
                  <div class="variant-price">
                    {(variant?.retail_price ?? 0).toLocaleString()}
                    {$_("admin.currency") || "IQD"}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="details-sub">-</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

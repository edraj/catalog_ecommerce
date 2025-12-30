<script lang="ts">
  import { onMount } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { getSpaceContents, updateEntity } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import "./index.css";
  import { website } from "@/config";

  let sellers = $state([]);
  let selectedSeller = $state("all");
  let previousSeller = $state("");
  let products = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingProducts = $state(false);
  let isLoadingMore = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let productsMap = $state(new Map());
  let allVariations = $state([]);
  let currentOffset = $state(0);
  let hasMoreProducts = $state(true);
  const PRODUCTS_PER_PAGE = 50;

  let filteredProducts = $derived.by(() => {
    let filtered = [...products];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getItemDisplayName(item).toLowerCase();
        const productName = getProductName(
          item.attributes?.payload?.body?.product_shortname || ""
        ).toLowerCase();
        return (
          displayName.includes(searchLower) || productName.includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.attributes?.state === statusFilter
      );
    }

    return filtered;
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  onMount(async () => {
    await Promise.all([loadSellers(), loadAllVariations(), loadAllProducts()]);
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
        true
      );

      if (response?.records) {
        sellers = response.records.filter(
          (record) => record.resource_type === "folder"
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
        true
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
        true
      );
      if (response?.records) {
        productsMap = new Map(response.records.map((p) => [p.shortname, p]));
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  }

  async function loadSellerProducts(reset = true) {
    if (reset) {
      currentOffset = 0;
      products = [];
      hasMoreProducts = true;
    }

    if (selectedSeller === "all") {
      isLoadingProducts = reset;
      isLoadingMore = !reset;
      try {
        const newProducts = [];
        let hasMore = false;

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `available_products/${seller.shortname}`,
              "managed",
              PRODUCTS_PER_PAGE,
              currentOffset,
              true
            );

            if (response?.records) {
              newProducts.push(...response.records);
              if (response.records.length === PRODUCTS_PER_PAGE) {
                hasMore = true;
              }
            }
          } catch (error) {
            console.error(
              `Error loading products for ${seller.shortname}:`,
              error
            );
          }
        }

        products = reset ? newProducts : [...products, ...newProducts];
        hasMoreProducts = hasMore;
        currentOffset += PRODUCTS_PER_PAGE;
      } catch (error) {
        console.error("Error loading products:", error);
        errorToastMessage("Error loading products");
      } finally {
        isLoadingProducts = false;
        isLoadingMore = false;
      }
      return;
    }

    isLoadingProducts = reset;
    isLoadingMore = !reset;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `available_products/${selectedSeller}`,
        "managed",
        PRODUCTS_PER_PAGE,
        currentOffset,
        true
      );

      if (response?.records) {
        products = reset
          ? response.records
          : [...products, ...response.records];
        hasMoreProducts = response.records.length === PRODUCTS_PER_PAGE;
        currentOffset += PRODUCTS_PER_PAGE;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingProducts = false;
      isLoadingMore = false;
    }
  }

  async function loadMoreProducts() {
    if (!hasMoreProducts || isLoadingMore) return;
    await loadSellerProducts(false);
  }

  function resolveOptionKey(
    optionKey: string,
    variationShortname: string
  ): string {
    const variation = allVariations.find(
      (v) => v.shortname === variationShortname
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

  function getProductName(productShortname: string): string {
    const product = productsMap.get(productShortname);
    if (!product) return productShortname;
    return getLocalizedDisplayName(product, $locale);
  }

  function getSellerDisplayName(seller: any): string {
    if (seller.attributes?.displayname) {
      return getItemDisplayName(seller);
    }
    return seller.shortname;
  }

  async function updateProductStatus(item: any, newStatus: string) {
    try {
      const updatedAttributes = {
        ...item.attributes,
        state: newStatus,
      };

      await updateEntity(
        item.shortname,
        website.main_space,
        item.subpath,
        item.resource_type,
        updatedAttributes,
        "",
        ""
      );

      successToastMessage(`Product status updated to ${newStatus}`);
      const productIndex = products.findIndex(
        (p) => p.shortname === item.shortname
      );
      if (productIndex !== -1) {
        products[productIndex] = {
          ...products[productIndex],
          attributes: updatedAttributes,
        };
      }
    } catch (error) {
      console.error("Error updating product status:", error);
      errorToastMessage("Failed to update product status");
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerProducts(true);
    }
  });
</script>

<div class="admin-page-container">
  <div class="admin-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.seller_products") || "Seller Products"}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.view_manage_sellers_products") ||
              "View and manage products from all sellers"}
          </p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters-group">
        <label for="seller-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
            />
          </svg>
          {$_("admin.select_seller") || "Select Seller"}
        </label>
        <select id="seller-filter" bind:value={selectedSeller}>
          <option value="all">{$_("admin.all_sellers") || "All Sellers"}</option
          >
          {#each sellers as seller}
            <option value={seller.shortname}>
              {getSellerDisplayName(seller)}
            </option>
          {/each}
        </select>
      </div>

      <div class="search-bar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" stroke-width="2" />
          <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin.search_products") || "Search products..."}
        />
      </div>

      <div class="filters-group">
        <label for="status-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("common.status") || "Status"}
        </label>
        <select id="status-filter" bind:value={statusFilter}>
          <option value="all">{$_("admin.all_status") || "All Status"}</option>
          <option value="approved">{$_("admin.approved") || "Approved"}</option>
          <option value="pending">{$_("admin.pending") || "Pending"}</option>
          <option value="rejected">{$_("admin.rejected") || "Rejected"}</option>
        </select>
      </div>
    </div>

    <!-- Products Table -->
    {#if isLoadingSellers}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if !selectedSeller}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <path
            d="M24 8v8m0 16v8m8-20h8m-24 0H8m28.364 14.364l5.656 5.656M5.636 5.636l5.656 5.656m22.708 0l5.656-5.656M5.636 30.364l5.656-5.656"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>
          {$_("admin.select_seller_prompt") ||
            "Select a seller to view their products"}
        </h3>
        <p>
          {$_("admin.select_seller_hint") ||
            "Choose a seller from the dropdown above"}
        </p>
      </div>
    {:else if isLoadingProducts}
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
          {$_("admin.no_products_hint") || "This seller has no products yet"}
        </p>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredProducts.length}</strong>
          {$_("admin.products") || "products"}
          {#if selectedSeller !== "all"}
            from <strong
              >{getSellerDisplayName(
                sellers.find((s) => s.shortname === selectedSeller)
              )}</strong
            >
          {/if}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
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
          <tbody>
            {#each filteredProducts as item (item.shortname)}
              {@const body = item.attributes?.payload?.body}
              {@const variants = body?.variants || []}
              {@const totalStock = variants.reduce(
                (sum, v) => sum + (v.qty || 0),
                0
              )}
              {@const priceRange =
                variants.length > 0
                  ? {
                      min: Math.min(
                        ...variants.map((v) => v.retail_price || 0)
                      ),
                      max: Math.max(
                        ...variants.map((v) => v.retail_price || 0)
                      ),
                    }
                  : { min: 0, max: 0 }}
              {@const state = item.attributes?.state || "pending"}
              {@const sellerShortname = item.subpath.split("/")[1]}
              {@const seller = sellers.find(
                (s) => s.shortname === sellerShortname
              )}
              <tr class="item-row">
                <td>
                  <div class="item-name">{getItemDisplayName(item)}</div>
                  <div class="product-info">
                    {getProductName(body?.product_shortname || "")}
                  </div>
                </td>
                <td>
                  <div class="seller-badge">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      style="width: 16px; height: 16px;"
                    >
                      <path
                        d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                      />
                    </svg>
                    {seller ? getSellerDisplayName(seller) : sellerShortname}
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
                              option.variation_shortname
                            )}
                          {/each}
                        </span>
                      {/each}
                      {#if variants.length > 2}
                        <span class="more-badge">
                          +{variants.length - 2}
                        </span>
                      {/if}
                    {:else}
                      <span class="empty-text">-</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="price-display">
                    {#if priceRange.min === priceRange.max}
                      <strong>{priceRange.min.toLocaleString()}</strong>
                      {$_("admin.currency") || "IQD"}
                    {:else}
                      <strong>{priceRange.min.toLocaleString()}</strong> -
                      <strong>{priceRange.max.toLocaleString()}</strong>
                      {$_("admin.currency") || "IQD"}
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="stock-display">
                    <span
                      class="stock-badge"
                      class:low-stock={totalStock < 5}
                      class:out-of-stock={totalStock === 0}
                    >
                      {totalStock}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="sku-display">
                    {#if variants.length > 0}
                      {variants[0].sku || "-"}
                      {#if variants.length > 1}
                        <span class="more-text">+{variants.length - 1}</span>
                      {/if}
                    {:else}
                      -
                    {/if}
                  </div>
                </td>
                <td>
                  <select
                    class="status-select"
                    class:approved={state === "approved"}
                    class:pending={state === "pending"}
                    class:rejected={state === "rejected"}
                    value={state}
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
                <td>
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
                          <circle cx="12" cy="13" r="1.5" stroke-width="1.5" />
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

      {#if hasMoreProducts && !searchTerm && statusFilter === "all"}
        <div class="load-more-container">
          <button
            class="load-more-btn"
            onclick={loadMoreProducts}
            disabled={isLoadingMore}
          >
            {#if isLoadingMore}
              <div class="spinner-small"></div>
              <span>{$_("common.loading") || "Loading..."}</span>
            {:else}
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{$_("admin.load_more") || "Load More Products"}</span>
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

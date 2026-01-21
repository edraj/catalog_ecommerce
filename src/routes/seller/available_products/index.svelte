<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate } from "@/lib/helpers";
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
    getContentPreview,
    getItemCategory,
    getResourceTypeLabel,
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
  let items = $state([]);
  let filteredItems = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");
  let categoryFilter = $state("all");
  let filterCategories = $state([]);

  let showAddItemModal = $state(false);
  let categories = $state([]);
  let products = $state([]);
  let allVariations = $state([]);
  let productsMap = $state(new Map());
  let warranties = $state([]);
  let commissionCategories = $state([]);
  let selectedCategory = $state("");
  let selectedProduct = $state("");
  let selectedWarranty = $state("");
  let selectedCommissionCategory = $state("");
  let productVariants = $state<ProductVariant[]>([]);
  let selectedVariants = $state([]);
  let isLoadingCategories = $state(false);
  let isLoadingProducts = $state(false);
  let isLoadingVariations = $state(false);
  let productSearchTerm = $state("");
  let filteredProducts = $state([]);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let itemsPerPage = $state(20);
  let totalProducts = $state(0);
  let isSearching = $state(false);
  let searchDebounceTimer: number | null = null;

  let availabilityForm = $state({
    hasFastDelivery: false,
    hasFreeShipping: false,
    estShippingFrom: 1,
    estShippingTo: 5,
  });

  let specificationGroups = $state<SpecificationGroup[]>([]);
  let generatedCombinations = $state<any[]>([]);
  let combinationPrices = $state<
    Record<string, { price: string; stock: string; sku: string }>
  >({});

  let showDeleteModal = $state(false);
  let itemToDelete = $state(null);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

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
        productsMap = new Map(response.records.map((p) => [p.shortname, p]));
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
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

  function getProductName(productShortname: string): string {
    const product = productsMap.get(productShortname);
    if (!product) return productShortname;
    return getLocalizedDisplayName(product, $locale);
  }

  function applyFilters() {
    filteredItems = filterItems(items, searchTerm, categoryFilter, $locale);
  }

  async function filterProductsSearch() {
    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
    }

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

  function viewItem(item) {
    sessionStorage.setItem("seller_previous_folder", "available_products");
    $goto("/seller/[shortname]/[resource_type]", {
      subpath: item.subpath.replace(/^\//, ""),
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function editItem(item) {
    $goto("/seller/[shortname]/[resource_type]/edit", {
      subpath: item.subpath.replace(/^\//, ""),
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function createItem() {
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

        if (response.records.length < itemsPerPage) {
          totalPages = page;
        } else {
          totalPages = page + 1;
        }
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
    generatedCombinations = [];
    combinationPrices = {};
    specificationGroups = [];

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
          (p) => p.shortname === productShortname,
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
    if (selectedCategory) {
      loadProducts(selectedCategory);
    } else {
      products = [];
      selectedProduct = "";
      productVariants = [];
    }
  });

  $effect(() => {
    if (selectedProduct) {
      loadSpecifications(selectedProduct);
    } else {
      productVariants = [];
      generatedCombinations = [];
      combinationPrices = {};
    }
  });

  function toggleVariantSelection(variantKey: string) {
    const index = selectedVariants.indexOf(variantKey);
    if (index > -1) {
      selectedVariants = selectedVariants.filter((v) => v !== variantKey);
    } else {
      selectedVariants = [...selectedVariants, variantKey];

      if (variantKey === "none" && productVariants.length === 0) {
        productVariants = [
          {
            key: "none",
            sku: "",
            qty: 0,
            retailPrice: 0,
            name: "No Variation",
            type: "none",
          } as any,
        ];
      }
    }
  }

  function isVariantSelected(variantKey: string): boolean {
    return selectedVariants.includes(variantKey);
  }

  function handleProductChange() {
    if (selectedProduct) {
      loadSpecifications(selectedProduct);
    } else {
      productVariants = [];
      generatedCombinations = [];
      combinationPrices = {};
      specificationGroups = [];
    }
  }

  function closeModal() {
    showAddItemModal = false;
    selectedCategory = "";
    selectedProduct = "";
    categories = [];
    products = [];
    productVariants = [];
    selectedVariants = [];
    generatedCombinations = [];
    combinationPrices = {};
    specificationGroups = [];
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
    if (selectedVariants.includes("none")) {
      if (!productVariants[0] || !productVariants[0].retailPrice) {
        errorToastMessage("Please enter price for the product");
        return;
      }
      if (!productVariants[0].qty) {
        errorToastMessage("Please enter stock quantity");
        return;
      }
    } else {
      const validation = validateVariants(productVariants, selectedVariants);
      if (!validation.isValid) {
        errorToastMessage(validation.error || "Validation failed");
        return;
      }
    }

    try {
      isLoading = true;

      const selectedProductData = products.find(
        (p) => p.shortname === selectedProduct,
      );

      if (!selectedProductData) {
        errorToastMessage("Selected product not found");
        return;
      }

      let variants;

      if (selectedVariants.includes("none")) {
        variants = [
          {
            sku: productVariants[0]?.sku || "",
            qty: productVariants[0]?.qty || 0,
            retail_price: productVariants[0]?.retailPrice || 0,
            options: [],
          },
        ];
      } else {
        variants = prepareVariantsForSubmission(
          productVariants,
          selectedVariants,
        );
      }

      const availabilityData = {
        displayname_en: getLocalizedDisplayName(selectedProductData, $locale),
        displayname_ar: selectedProductData.attributes?.displayname?.ar || "",
        displayname_ku: selectedProductData.attributes?.displayname?.ku || "",
        body: {
          sku: "",
          variants: variants,
          product_shortname: selectedProduct,
          warranty_shortname: selectedWarranty || "",
          commission_category: selectedCommissionCategory || "",
          has_fast_delivery: availabilityForm.hasFastDelivery,
          has_free_shipping: availabilityForm.hasFreeShipping,
          est_shipping_days: {
            from: availabilityForm.estShippingFrom || 1,
            to: availabilityForm.estShippingTo || 5,
          },
        },
        tags: [`product:${selectedProduct}`],
        is_active: true,
        workflow_shortname: "availability",
      };

      await createEntity(
        availabilityData,
        website.main_space,
        `/available_products/${$user.shortname}`,
        ResourceType.ticket,
        "availability",
        "",
      );

      successToastMessage(
        `Product availability with ${variants.length} variant(s) added successfully!`,
      );
      closeModal();
      await loadFolderContents();
    } catch (error) {
      console.error("Error creating product availability:", error);
      errorToastMessage("Failed to create product availability");
    } finally {
      isLoading = false;
    }
  }

  function openDeleteModal(item) {
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
    } catch (error) {
      console.error("Error deleting product:", error);
      errorToastMessage("Failed to delete product");
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    applyFilters();
  });
</script>

<div class="seller-page-container">
  <div class="seller-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <button class="back-button" onclick={() => $goto("/seller")}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M12 5l-5 5 5 5"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {$_("common.back")}
        </button>
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("seller_dashboard.available_products")}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            Manage your available products
          </p>
        </div>
        <button class="btn-primary" onclick={createItem}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M10 5v10M5 10h10"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          {$_("seller_dashboard.add_new_product")}
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="search-bar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" stroke-width="2" />
          <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("seller_dashboard.search_placeholder")}
        />
      </div>

      <div class="filters-group">
        <select bind:value={categoryFilter}>
          <option value="all">{$_("seller_dashboard.all_categories")}</option>
          {#each filterCategories as category}
            <option value={category.shortname}>
              {getItemDisplayName(category)}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Products Table -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading")}</p>
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
        <h3>{$_("seller_dashboard.no_products")}</h3>
        <p>{$_("seller_dashboard.add_first_product")}</p>
        <button class="btn-primary" onclick={createItem}>
          {$_("seller_dashboard.add_new_product")}
        </button>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("seller_dashboard.showing")}
          <strong>{filteredItems.length}</strong>
          {$_("seller_dashboard.products")}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("seller_dashboard.product_name")}</th>
              <th>{$_("seller_dashboard.variants")}</th>
              <th>{$_("seller_dashboard.price")}</th>
              <th>{$_("seller_dashboard.stock")}</th>
              <th>{$_("seller_dashboard.sku")}</th>
              <th>{$_("common.status")}</th>
              <th>{$_("seller_dashboard.shipping")}</th>
              <th>{$_("seller_dashboard.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredItems as item (item.shortname)}
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
              {@const state = item.attributes?.state || "pending"}
              <tr
                class="item-row"
                onclick={() => viewItem(item)}
                style="cursor: pointer;"
              >
                <td>
                  <div class="item-name">{getItemDisplayName(item)}</div>
                  <div
                    class="product-info"
                    style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;"
                  >
                    {getProductName(body?.product_shortname || "")}
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
                        <span class="more-badge">
                          +{variants.length - 2}
                        </span>
                      {/if}
                    {:else}
                      <span style="color: #9ca3af; font-size: 0.875rem;">-</span
                      >
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="price-display">
                    {#if priceRange.min === priceRange.max}
                      <strong>{priceRange.min.toLocaleString()}</strong>
                      {$_("seller_dashboard.currency")}
                    {:else}
                      <strong>{priceRange.min.toLocaleString()}</strong> -
                      <strong>{priceRange.max.toLocaleString()}</strong>
                      {$_("seller_dashboard.currency")}
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
                  <div
                    class="sku-display"
                    style="font-size: 0.875rem; color: #6b7280;"
                  >
                    {#if variants.length > 0}
                      {variants[0].sku || "-"}
                      {#if variants.length > 1}
                        <span style="color: #9ca3af;"
                          >+{variants.length - 1}</span
                        >
                      {/if}
                    {:else}
                      -
                    {/if}
                  </div>
                </td>
                <td>
                  <span
                    class="status-badge"
                    class:active={state === "approved"}
                    class:pending={state === "pending"}
                    class:inactive={state === "rejected"}
                  >
                    {state}
                  </span>
                </td>
                <td>
                  <div class="shipping-badges">
                    {#if body?.has_fast_delivery}
                      <span
                        class="shipping-badge fast"
                        title={$_("seller_dashboard.fast_delivery")}
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
                        title={$_("seller_dashboard.free_shipping")}
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
                      <span style="color: #9ca3af; font-size: 0.875rem;">-</span
                      >
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="action-buttons">
                    <button
                      class="btn-icon"
                      onclick={(e) => {
                        e.stopPropagation();
                        viewItem(item);
                      }}
                      title={$_("common.view")}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
                          stroke-width="1.5"
                        />
                        <circle cx="8" cy="8" r="2" stroke-width="1.5" />
                      </svg>
                    </button>
                    <button
                      class="btn-icon"
                      onclick={(e) => {
                        e.stopPropagation();
                        editItem(item);
                      }}
                      title={$_("common.edit")}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M11 2l3 3-9 9H2v-3l9-9z"
                          stroke-width="1.5"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      class="btn-icon"
                      onclick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(item);
                      }}
                      title={$_("common.delete")}
                    >
                      <svg
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
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Add Product Modal -->
<AddProductModal
  bind:show={showAddItemModal}
  isRTL={$isRTL}
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
  onProductChange={handleProductChange}
  onToggleVariant={toggleVariantSelection}
  {isVariantSelected}
  getLocalizedDisplayName={getItemDisplayName}
  updateVariant={(key, field, value) => {
    const variant = productVariants.find((v) => v.key === key);
    if (variant) variant[field] = value;
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

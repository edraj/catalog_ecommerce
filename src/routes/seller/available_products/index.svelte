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
  let showDetailsModal = $state(false);
  let detailsItem = $state(null);
  let isEditMode = $state(false);
  let editingItem = $state(null);

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

  function openDetailsModal(item) {
    detailsItem = item;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    detailsItem = null;
  }

  function viewItem(item) {
    openDetailsModal(item);
  }

  async function openEditItemModal(item) {
    const body = item.attributes?.payload?.body || {};

    isEditMode = true;
    editingItem = item;
    showAddItemModal = true;

    productVariants = [];
    selectedVariants = [];
    generatedCombinations = [];
    combinationPrices = {};

    selectedCategory = "";
    selectedProduct = body.product_shortname || "";
    selectedWarranty = body.warranty_shortname || "";
    selectedCommissionCategory = body.commission_category || "";
    availabilityForm = {
      hasFastDelivery: body.has_fast_delivery || false,
      hasFreeShipping: body.has_free_shipping || false,
      estShippingFrom: body.est_shipping_days?.from || 1,
      estShippingTo: body.est_shipping_days?.to || 5,
    };

    const product = selectedProduct ? productsMap.get(selectedProduct) : null;
    products = product ? [product] : [];
    filteredProducts = product ? [product] : [];

    if (selectedProduct) {
      await loadSpecifications(selectedProduct);
    }

    const savedVariants = body.variants || [];
    const optionKeys = savedVariants
      .flatMap((variant) => (variant.options || []).map((opt) => opt.key))
      .filter(Boolean);

    if (optionKeys.length === 0 && savedVariants.length > 0) {
      selectedVariants = ["none"];
      const saved = savedVariants[0];
      productVariants = [
        {
          key: "none",
          sku: saved.sku || "",
          qty: saved.qty || 0,
          retailPrice: saved.retail_price || 0,
          name: "No Variation",
          type: "none",
        } as any,
      ];
      return;
    }

    if (productVariants.length === 0 && optionKeys.length > 0) {
      productVariants = optionKeys.map((key) => {
        const saved = savedVariants.find(
          (entry) =>
            entry.key === key ||
            (entry.options || []).some((opt) => opt.key === key),
        );

        return {
          key,
          type: "storage",
          shortname: key,
          name: key,
          qty: saved?.qty || 0,
          retailPrice: saved?.retail_price || 0,
          sku: saved?.sku || "",
          discount: saved?.discount || { type: "amount", value: 0 },
        } as any;
      });
    }

    selectedVariants = Array.from(new Set(optionKeys));
    productVariants = productVariants.map((variant) => {
      const saved = savedVariants.find(
        (entry) =>
          entry.key === variant.key ||
          (entry.options || []).some((opt) => opt.key === variant.key),
      );

      if (!saved) {
        return variant;
      }

      return {
        ...variant,
        sku: saved.sku || "",
        qty: saved.qty || 0,
        retailPrice: saved.retail_price || 0,
        discount: saved.discount || variant.discount,
      };
    });
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
    isEditMode = false;
    editingItem = null;
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

      if (isEditMode && editingItem) {
        await updateEntity(
          editingItem.shortname,
          website.main_space,
          editingItem.subpath,
          editingItem.resource_type,
          {
            ...availabilityData,
            tags: editingItem.attributes?.tags || availabilityData.tags,
          },
          editingItem.attributes?.workflow_shortname || "availability",
          editingItem.attributes?.payload?.schema_shortname || "",
        );

        successToastMessage(
          `Product availability with ${variants.length} variant(s) updated successfully!`,
        );
      } else {
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
      }
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
                        openEditItemModal(item);
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
        <div class="details-grid">
          <div class="details-card">
            <h4>Product</h4>
            <p>{body.product_shortname || "-"}</p>
          </div>
          <div class="details-card">
            <h4>Warranty</h4>
            <p>{body.warranty_shortname || "-"}</p>
          </div>
          <div class="details-card">
            <h4>Commission</h4>
            <p>{body.commission_category || "-"}</p>
          </div>
          <div class="details-card">
            <h4>Shipping</h4>
            <p>
              {body.has_fast_delivery ? "Fast" : "Standard"} / {body.has_free_shipping
                ? "Free"
                : "Paid"}
            </p>
            <p>
              {body.est_shipping_days?.from || 1} -
              {body.est_shipping_days?.to || 5}
              {$_("seller_dashboard.days") || "days"}
            </p>
          </div>
          <div class="details-card">
            <h4>Status</h4>
            <p>{detailsItem.attributes?.state || "-"}</p>
          </div>
          <div class="details-card">
            <h4>Updated</h4>
            <p>{formatDate(detailsItem.attributes?.updated_at)}</p>
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
        <button class="btn-secondary" onclick={closeDetailsModal}>
          {$_("common.close") || "Close"}
        </button>
        <button
          class="btn-secondary"
          onclick={() => {
            closeDetailsModal();
            openEditItemModal(detailsItem);
          }}
        >
          {$_("common.edit") || "Edit"}
        </button>
        <button
          class="btn-danger"
          onclick={() => {
            closeDetailsModal();
            openDeleteModal(detailsItem);
          }}
        >
          {$_("common.delete") || "Delete"}
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

<style>
  .details-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9998;
    padding: 1.5rem;
  }

  .details-modal {
    background: #ffffff;
    border-radius: 16px;
    width: 100%;
    max-width: 960px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
    overflow: hidden;
  }

  .details-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
  }

  .details-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
  }

  .details-subtitle {
    margin: 0.25rem 0 0;
    color: #6b7280;
    font-size: 0.9rem;
  }

  .details-close {
    border: none;
    background: #e2e8f0;
    border-radius: 10px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .details-close:hover {
    background: #cbd5f5;
  }

  .details-close svg {
    width: 18px;
    height: 18px;
    stroke: #334155;
  }

  .details-modal-body {
    padding: 1.5rem 2rem;
    overflow-y: auto;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .details-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 0.75rem 1rem;
  }

  .details-card h4 {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  .details-card p {
    margin: 0.5rem 0 0;
    font-weight: 600;
    color: #111827;
  }

  .details-section h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    color: #111827;
  }

  .details-table {
    display: grid;
    gap: 0.5rem;
  }

  .details-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    background: #f8fafc;
  }

  .details-row.details-head {
    background: #e2e8f0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
  }

  .details-empty {
    color: #6b7280;
  }

  .details-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 2rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f8fafc;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #111827;
    border: 1px solid #d1d5db;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-danger {
    background: #dc2626;
    color: #ffffff;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .btn-danger:hover {
    background: #b91c1c;
  }
</style>

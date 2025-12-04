<script lang="ts">
  import { onMount } from "svelte";
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
    CheckOutline,
  } from "flowbite-svelte-icons";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let products = $state([]);
  let categories = $state([]);
  let variations = $state({ colors: [], storages: [] });
  let specifications = $state([]);
  let isLoading = $state(true);
  let isLoadingCategories = $state(false);
  let isLoadingVariations = $state(false);
  let isLoadingSpecifications = $state(false);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedProduct = $state(null);
  let selectedCategoryFilter = $state("all");

  let productForm = $state({
    displayname_en: "",
    displayname_ar: "",
    description_en: "",
    description_ar: "",
    unit: "PC",
    is_digital: false,
    meta_title: "",
    meta_description: "",
    brand_shortname: "",
    low_stock_quantity: 1,
    categories: [],
    main_category: "",
    variation_options: [],
    product_specifications: [],
    category_specifications: [],
    tags: [],
  });

  onMount(async () => {
    await Promise.all([
      loadCategories(),
      loadVariations(),
      loadSpecifications(),
      loadProducts(),
    ]);
  });

  async function loadCategories() {
    isLoadingCategories = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        categories = response.records;
      } else {
        console.error("No categories found in response:", response);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Failed to load categories");
    } finally {
      isLoadingCategories = false;
    }
  }

  async function loadVariations() {
    isLoadingVariations = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "variations",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        const colorsData = response.records.find(
          (v) => v.shortname === "colors"
        );
        const storagesData = response.records.find(
          (v) => v.shortname === "storages"
        );

        variations = {
          colors: colorsData?.attributes?.payload?.body?.options || [],
          storages: storagesData?.attributes?.payload?.body?.options || [],
        };
      }
    } catch (error) {
      console.error("Error loading variations:", error);
      errorToastMessage("Failed to load variations");
    } finally {
      isLoadingVariations = false;
    }
  }

  async function loadSpecifications() {
    isLoadingSpecifications = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "specifications",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        specifications = response.records;
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Failed to load specifications");
    } finally {
      isLoadingSpecifications = false;
    }
  }

  async function loadProducts() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "products",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        products = response.records;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Failed to load products");
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    productForm = {
      displayname_en: "",
      displayname_ar: "",
      description_en: "",
      description_ar: "",
      unit: "PC",
      is_digital: false,
      meta_title: "",
      meta_description: "",
      brand_shortname: "",
      low_stock_quantity: 1,
      categories: [],
      main_category: "",
      variation_options: [],
      product_specifications: [],
      category_specifications: [],
      tags: [],
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(product) {
    selectedProduct = product;
    const content = product.attributes?.payload?.body;
    const displayname = product.attributes?.displayname || {};
    const description = product.attributes?.description || {};

    productForm = {
      displayname_en: displayname.en || "",
      displayname_ar: displayname.ar || "",
      description_en: description.en || "",
      description_ar: description.ar || "",
      unit: content?.unit || "PC",
      is_digital: content?.is_digital || false,
      meta_title: content?.meta_title || "",
      meta_description: content?.meta_description || "",
      brand_shortname: content?.brand_shortname || "",
      low_stock_quantity: content?.low_stock_quantity || 1,
      categories: content?.categories_shortnames || [],
      main_category: content?.main_category_shortname || "",
      variation_options: content?.variation_options || [],
      product_specifications: content?.product_specifications || [],
      category_specifications: content?.category_specifications || [],
      tags: product.attributes?.tags || [],
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedProduct = null;
  }

  function openDeleteModal(product) {
    selectedProduct = product;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedProduct = null;
  }

  async function handleCreateProduct() {
    if (
      !productForm.displayname_en.trim() &&
      !productForm.displayname_ar.trim()
    ) {
      errorToastMessage("Please enter a product name");
      return;
    }

    if (!productForm.main_category) {
      errorToastMessage("Please select a main category");
      return;
    }

    if (productForm.categories.length === 0) {
      errorToastMessage("Please select at least one category");
      return;
    }

    try {
      console.log(productForm.displayname_en);

      const productData = {
        displayname_en: productForm.displayname_en,
        displayname_ar: productForm.displayname_ar,

        description_en: productForm.description_en,
        description_ar: productForm.description_ar,
        body: {
          unit: productForm.unit,
          is_digital: productForm.is_digital,
          meta_title: productForm.meta_title,
          meta_description: productForm.meta_description,
          brand_shortname: productForm.brand_shortname,
          low_stock_quantity: productForm.low_stock_quantity,
          variation_options: productForm.variation_options,
          categories_shortnames: productForm.categories,
          main_category_shortname: productForm.main_category,
          product_specifications: productForm.product_specifications,
          category_specifications: productForm.category_specifications,
          content_type: "json",
        },
        tags: productForm.tags,
        is_active: true,
      };

      await createEntity(
        productData,
        "e_commerce",
        "/products",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Product created successfully!");
      closeCreateModal();
      await loadProducts();
    } catch (error) {
      console.error("Error creating product:", error);
      errorToastMessage("Failed to create product");
    }
  }

  async function handleUpdateProduct() {
    if (
      !productForm.displayname_en.trim() &&
      !productForm.displayname_ar.trim()
    ) {
      errorToastMessage("Please enter a product name");
      return;
    }

    if (!productForm.main_category) {
      errorToastMessage("Please select a main category");
      return;
    }

    if (productForm.categories.length === 0) {
      errorToastMessage("Please select at least one category");
      return;
    }

    if (!selectedProduct) return;

    try {
      const productData = {
        displayname: {
          en: productForm.displayname_en,
          ar: productForm.displayname_ar,
        },
        description: {
          en: productForm.description_en,
          ar: productForm.description_ar,
        },
        content: {
          unit: productForm.unit,
          is_digital: productForm.is_digital,
          meta_title: productForm.meta_title,
          meta_description: productForm.meta_description,
          brand_shortname: productForm.brand_shortname,
          low_stock_quantity: productForm.low_stock_quantity,
          variation_options: productForm.variation_options,
          categories_shortnames: productForm.categories,
          main_category_shortname: productForm.main_category,
          product_specifications: productForm.product_specifications,
          category_specifications: productForm.category_specifications,
        },
        content_type: "json",
        tags: productForm.tags,
        is_active: true,
      };

      await updateEntity(
        selectedProduct.shortname,
        "e_commerce",
        selectedProduct.subpath,
        selectedProduct.resource_type,
        productData,
        "",
        ""
      );

      successToastMessage("Product updated successfully!");
      closeEditModal();
      await loadProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      errorToastMessage("Failed to update product");
    }
  }

  async function handleDeleteProduct() {
    if (!selectedProduct) return;

    try {
      await deleteEntity(
        selectedProduct.shortname,
        "e_commerce",
        selectedProduct.subpath,
        selectedProduct.resource_type
      );

      successToastMessage("Product deleted successfully!");
      closeDeleteModal();
      await loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      errorToastMessage("Failed to delete product");
    }
  }

  function getLocalizedDisplayName(item) {
    const displayname = item?.attributes?.displayname.en;

    if (!displayname) {
      return item?.shortname || "Untitled";
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item?.shortname || "Untitled";
  }

  function getProductMainCategory(product) {
    const content = product.attributes?.payload?.body;
    return content?.main_category_shortname || null;
  }

  function getProductCategories(product) {
    const content = product.attributes?.payload?.body;
    return content?.categories_shortnames || [];
  }

  function getCategoryName(categoryId) {
    const category = categories.find((c) => c.shortname === categoryId);
    return category ? getLocalizedDisplayName(category) : categoryId;
  }

  function getCategoryParentId(category) {
    const content = category.attributes?.payload?.body;
    return content?.parent_category_shortname || null;
  }

  function isParentCategory(category) {
    return !getCategoryParentId(category);
  }

  function getSubCategories(parentId) {
    return categories.filter((c) => getCategoryParentId(c) === parentId);
  }

  const parentCategories = $derived.by(() => {
    return categories.filter((c) => isParentCategory(c));
  });

  function toggleCategory(categoryId) {
    const index = productForm.categories.indexOf(categoryId);
    if (index > -1) {
      productForm.categories = productForm.categories.filter(
        (id) => id !== categoryId
      );
      if (productForm.main_category === categoryId) {
        productForm.main_category = "";
      }
    } else {
      productForm.categories = [...productForm.categories, categoryId];
      if (!productForm.main_category) {
        productForm.main_category = categoryId;
      }
    }
  }

  function setMainCategory(categoryId) {
    if (!productForm.categories.includes(categoryId)) {
      productForm.categories = [...productForm.categories, categoryId];
    }
    productForm.main_category = categoryId;
  }

  function toggleVariationValue(variationType: string, valueKey: string) {
    const existingOption = productForm.variation_options.find(
      (opt) => opt.variation_shortname === variationType
    );

    if (existingOption) {
      if (existingOption.values.includes(valueKey)) {
        existingOption.values = existingOption.values.filter(
          (v) => v !== valueKey
        );
        if (existingOption.values.length === 0) {
          productForm.variation_options = productForm.variation_options.filter(
            (opt) => opt.variation_shortname !== variationType
          );
        }
      } else {
        existingOption.values = [...existingOption.values, valueKey];
      }
      productForm.variation_options = [...productForm.variation_options];
    } else {
      productForm.variation_options = [
        ...productForm.variation_options,
        { variation_shortname: variationType, values: [valueKey] },
      ];
    }
  }

  function isVariationSelected(
    variationType: string,
    valueKey: string
  ): boolean {
    const option = productForm.variation_options.find(
      (opt) => opt.variation_shortname === variationType
    );
    return option ? option.values.includes(valueKey) : false;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString($locale);
  }

  const filteredProducts = $derived.by(() => {
    if (selectedCategoryFilter === "all") {
      return products;
    }
    return products.filter((p) => {
      const categories = getProductCategories(p);
      return categories.includes(selectedCategoryFilter);
    });
  });
</script>

<div class="products-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.products") || "Products Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.products_description") ||
          "Manage your products with categories, variations, and specifications"}
      </p>
    </div>
    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span>{$_("admin_dashboard.create_product") || "Create Product"}</span>
    </button>
  </div>

  <div class="filters">
    <label for="category-filter">
      {$_("common.filter_by_category") || "Filter by Category"}:
    </label>
    <select
      id="category-filter"
      bind:value={selectedCategoryFilter}
      class="filter-select"
    >
      <option value="all">
        {$_("common.all_categories") || "All Categories"}
      </option>
      {#each categories as category}
        <option value={category.shortname}>
          {getLocalizedDisplayName(category)}
        </option>
      {/each}
    </select>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <h3>{$_("admin_dashboard.no_products") || "No products found"}</h3>
      <p>
        {selectedCategoryFilter === "all"
          ? $_("admin_dashboard.no_products_description") ||
            "Start by creating your first product"
          : $_("admin_dashboard.no_products_in_category") ||
            "No products in this category"}
      </p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="md" />
        {$_("admin_dashboard.create_first_product") || "Create First Product"}
      </button>
    </div>
  {:else}
    <div class="products-grid">
      {#each filteredProducts as product}
        <div class="product-card">
          <div class="product-header">
            <div class="product-info">
              <h3 class="product-name">{getLocalizedDisplayName(product)}</h3>
              <span class="product-shortname">{product.shortname}</span>
            </div>
            <div class="product-actions">
              <button
                class="btn-icon"
                onclick={() => openEditModal(product)}
                title="Edit"
              >
                <EditOutline size="sm" />
              </button>
              <button
                class="btn-icon delete"
                onclick={() => openDeleteModal(product)}
                title="Delete"
              >
                <TrashBinOutline size="sm" />
              </button>
            </div>
          </div>

          <div class="product-body">
            {#if getProductMainCategory(product)}
              <div class="product-main-category">
                <span class="label">Main Category:</span>
                <span class="category-badge main">
                  {getCategoryName(getProductMainCategory(product))}
                </span>
              </div>
            {/if}

            {#if getProductCategories(product).length > 1}
              <div class="product-categories">
                <span class="label">Categories:</span>
                <div class="category-tags">
                  {#each getProductCategories(product) as categoryId}
                    {#if categoryId !== getProductMainCategory(product)}
                      <span class="category-badge">
                        {getCategoryName(categoryId)}
                      </span>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <div class="product-footer">
            <span class="product-date">
              {formatDate(product.attributes?.created_at)}
            </span>
            <span
              class="product-status"
              class:active={product.attributes?.is_active}
            >
              {product.attributes?.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div
    class="modal-overlay"
    onclick={showCreateModal ? closeCreateModal : closeEditModal}
  >
    <div class="modal-container large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {showCreateModal
            ? $_("admin_dashboard.create_product") || "Create Product"
            : $_("admin_dashboard.edit_product") || "Edit Product"}
        </h2>
        <button
          class="modal-close"
          onclick={showCreateModal ? closeCreateModal : closeEditModal}
        >
          &times;
        </button>
      </div>

      <div class="modal-body">
        <!-- Basic Information -->
        <div class="form-section">
          <h3 class="section-title">Basic Information</h3>

          <div class="form-row">
            <div class="form-group">
              <label for="displayname-en">Display Name (English) *</label>
              <input
                id="displayname-en"
                type="text"
                bind:value={productForm.displayname_en}
                placeholder="Enter product name in English"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="displayname-ar">Display Name (Arabic) *</label>
              <input
                id="displayname-ar"
                type="text"
                bind:value={productForm.displayname_ar}
                placeholder="أدخل اسم المنتج بالعربية"
                class="form-input"
                dir="rtl"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="description-en">Description (English)</label>
              <textarea
                id="description-en"
                bind:value={productForm.description_en}
                placeholder="Enter product description in English"
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="description-ar">Description (Arabic)</label>
              <textarea
                id="description-ar"
                bind:value={productForm.description_ar}
                placeholder="أدخل وصف المنتج بالعربية"
                class="form-textarea"
                rows="3"
                dir="rtl"
              ></textarea>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="unit">Unit *</label>
              <select
                id="unit"
                bind:value={productForm.unit}
                class="form-input"
              >
                <option value="PC">PC (Piece)</option>
                <option value="KG">KG (Kilogram)</option>
                <option value="M">M (Meter)</option>
                <option value="L">L (Liter)</option>
                <option value="BOX">BOX</option>
              </select>
            </div>

            <div class="form-group">
              <label for="low-stock">Low Stock Quantity</label>
              <input
                id="low-stock"
                type="number"
                min="0"
                bind:value={productForm.low_stock_quantity}
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={productForm.is_digital} />
              <span>Digital Product</span>
            </label>
          </div>
        </div>

        <!-- Categories -->
        <div class="form-section">
          <h3 class="section-title">Categories *</h3>
          <p class="section-description">
            Select one or more categories. Mark one as main category.
          </p>

          {#if isLoadingCategories}
            <div class="loading-message">Loading categories...</div>
          {:else if categories.length === 0}
            <div class="warning-message">
              <p>⚠️ No categories found. Please create categories first.</p>
            </div>
          {:else}
            <div class="categories-selection">
              {#each parentCategories as category}
                <div class="category-item">
                  <label class="category-checkbox">
                    <input
                      type="checkbox"
                      checked={productForm.categories.includes(
                        category.shortname
                      )}
                      onchange={() => toggleCategory(category.shortname)}
                    />
                    <span>{getLocalizedDisplayName(category)}</span>
                  </label>

                  {#if productForm.categories.includes(category.shortname)}
                    <button
                      type="button"
                      class="btn-main-category"
                      class:is-main={productForm.main_category ===
                        category.shortname}
                      onclick={() => setMainCategory(category.shortname)}
                      title="Set as main category"
                    >
                      {#if productForm.main_category === category.shortname}
                        <CheckOutline size="xs" /> Main
                      {:else}
                        Set as Main
                      {/if}
                    </button>
                  {/if}
                </div>

                <!-- Sub-categories -->
                {#each getSubCategories(category.shortname) as subCategory}
                  <div class="category-item sub">
                    <label class="category-checkbox">
                      <input
                        type="checkbox"
                        checked={productForm.categories.includes(
                          subCategory.shortname
                        )}
                        onchange={() => toggleCategory(subCategory.shortname)}
                      />
                      <span>└ {getLocalizedDisplayName(subCategory)}</span>
                    </label>

                    {#if productForm.categories.includes(subCategory.shortname)}
                      <button
                        type="button"
                        class="btn-main-category"
                        class:is-main={productForm.main_category ===
                          subCategory.shortname}
                        onclick={() => setMainCategory(subCategory.shortname)}
                        title="Set as main category"
                      >
                        {#if productForm.main_category === subCategory.shortname}
                          <CheckOutline size="xs" /> Main
                        {:else}
                          Set as Main
                        {/if}
                      </button>
                    {/if}
                  </div>
                {/each}
              {/each}
            </div>
          {/if}
        </div>

        <!-- Variations -->
        <div class="form-section">
          <h3 class="section-title">Variations (Optional)</h3>

          {#if variations.colors.length > 0}
            <div class="variation-group">
              <h4 class="variation-title">Colors</h4>
              <div class="variation-options">
                {#each variations.colors as color}
                  <button
                    type="button"
                    class="variation-option color"
                    class:selected={isVariationSelected("colors", color.key)}
                    onclick={() => toggleVariationValue("colors", color.key)}
                    title={color.name?.en || color.name?.ar}
                  >
                    <span
                      class="color-swatch"
                      style="background-color: {color.value}"
                    ></span>
                    <span class="color-name"
                      >{color.name?.en || color.name?.ar}</span
                    >
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if variations.storages.length > 0}
            <div class="variation-group">
              <h4 class="variation-title">Storage</h4>
              <div class="variation-options">
                {#each variations.storages as storage}
                  <button
                    type="button"
                    class="variation-option"
                    class:selected={isVariationSelected(
                      "storages",
                      storage.key
                    )}
                    onclick={() =>
                      toggleVariationValue("storages", storage.key)}
                  >
                    {storage.name?.en || storage.name?.ar}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- SEO Meta -->
        <div class="form-section">
          <h3 class="section-title">SEO & Meta Information</h3>

          <div class="form-group">
            <label for="meta-title">Meta Title</label>
            <input
              id="meta-title"
              type="text"
              bind:value={productForm.meta_title}
              placeholder="SEO meta title"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="meta-description">Meta Description</label>
            <textarea
              id="meta-description"
              bind:value={productForm.meta_description}
              placeholder="SEO meta description"
              class="form-textarea"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="brand">Brand Shortname</label>
            <input
              id="brand"
              type="text"
              bind:value={productForm.brand_shortname}
              placeholder="Brand identifier"
              class="form-input"
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={showCreateModal ? closeCreateModal : closeEditModal}
        >
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          class="btn-primary"
          onclick={showCreateModal ? handleCreateProduct : handleUpdateProduct}
        >
          {showCreateModal
            ? $_("common.create") || "Create"
            : $_("common.update") || "Update"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div class="modal-container small" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin_dashboard.delete_product") || "Delete Product"}</h2>
        <button class="modal-close" onclick={closeDeleteModal}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="delete-warning">
          <div class="warning-icon">⚠️</div>
          <p>Are you sure you want to delete this product?</p>
          <p class="product-name-highlight">
            {selectedProduct ? getLocalizedDisplayName(selectedProduct) : ""}
          </p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" onclick={handleDeleteProduct}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .products-page {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 2rem 1rem;
  }

  .rtl {
    direction: rtl;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .page-description {
    font-size: 0.95rem;
    color: #6b7280;
    margin: 0;
  }

  .btn-create,
  .btn-create-large {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-create-large {
    padding: 1rem 2rem;
    font-size: 1rem;
  }

  .btn-create:hover,
  .btn-create-large:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    background: white;
    padding: 1rem 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
  }

  .filters label {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    color: #1a1a1a;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 220px;
  }

  .filter-select:hover {
    border-color: #9ca3af;
  }

  .filter-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
    background: white;
    border-radius: 1rem;
    padding: 3rem;
  }

  .empty-state {
    text-align: center;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: #6b7280;
    margin: 0 0 1.5rem 0;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-state p {
    color: #6b7280;
    font-size: 0.95rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .product-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .product-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .product-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .product-info {
    flex: 1;
    min-width: 0;
  }

  .product-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 0.25rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-shortname {
    font-size: 0.75rem;
    color: #9ca3af;
    display: block;
  }

  .product-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-icon {
    padding: 0.5rem;
    background: #f3f4f6;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .btn-icon.delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .product-body {
    margin-bottom: 1rem;
  }

  .product-main-category,
  .product-categories {
    margin-bottom: 0.75rem;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-bottom: 0.5rem;
  }

  .category-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .category-badge.main {
    background: #2563eb;
    color: white;
  }

  .category-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .product-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.75rem;
  }

  .product-date {
    color: #9ca3af;
  }

  .product-status {
    padding: 0.25rem 0.5rem;
    background: #fee2e2;
    color: #dc2626;
    border-radius: 0.25rem;
    font-weight: 600;
  }

  .product-status.active {
    background: #d1fae5;
    color: #065f46;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    padding: 1rem;
  }

  .modal-container {
    background: white;
    border-radius: 0.75rem;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }

  .modal-container.large {
    max-width: 900px;
  }

  .modal-container.small {
    max-width: 420px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #f3f4f6;
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .modal-body {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }

  .form-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .form-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    color: #1a1a1a;
    transition: all 0.2s;
    box-sizing: border-box;
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .checkbox-label input[type="checkbox"] {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
  }

  .categories-selection {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .category-item:hover {
    background: #f3f4f6;
  }

  .category-item.sub {
    margin-left: 2rem;
    background: #f3f4f6;
  }

  .category-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    flex: 1;
  }

  .category-checkbox input[type="checkbox"] {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
  }

  .btn-main-category {
    padding: 0.375rem 0.75rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .btn-main-category:hover {
    border-color: #2563eb;
    color: #2563eb;
  }

  .btn-main-category.is-main {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  .variation-group {
    margin-bottom: 1.5rem;
  }

  .variation-group:last-child {
    margin-bottom: 0;
  }

  .variation-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.75rem 0;
  }

  .variation-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .variation-option {
    padding: 0.5rem 1rem;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .variation-option:hover {
    border-color: #2563eb;
  }

  .variation-option.selected {
    background: #eff6ff;
    border-color: #2563eb;
    color: #1e40af;
  }

  .variation-option.color {
    min-width: 120px;
  }

  .color-swatch {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 0 1px #e5e7eb;
  }

  .color-name {
    font-size: 0.75rem;
  }

  .loading-message,
  .warning-message {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    color: #6b7280;
    text-align: center;
  }

  .warning-message {
    background: #fef3c7;
    color: #92400e;
  }

  .delete-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .delete-warning p {
    color: #6b7280;
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .product-name-highlight {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 1.125rem;
    margin: 1rem 0 !important;
  }

  .warning-text {
    font-size: 0.875rem;
    color: #dc2626;
    margin-top: 1rem !important;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #f3f4f6;
    flex-shrink: 0;
  }

  .btn-secondary,
  .btn-primary,
  .btn-danger {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }

  .btn-danger:hover {
    background: #b91c1c;
  }

  @media (max-width: 768px) {
    .products-page {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .products-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .modal-container {
      margin: 0;
      border-radius: 0;
      max-height: 100vh;
    }

    .category-item.sub {
      margin-left: 1rem;
    }
  }
</style>

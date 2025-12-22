<script lang="ts">
  import { onMount } from "svelte";
  import { Dmart, QueryType } from "@edraj/tsdmart";
  import { _ } from "@/i18n";
  import { website } from "@/config";

  let {
    formData = $bindable(),
    validateFn = $bindable(),
  }: {
    formData: any;
    validateFn: () => boolean;
  } = $props();

  let form;
  let availableProducts = $state([]);
  let loading = $state(true);
  let searchTerm = $state("");
  let showProductSearch = $state(false);

  // Initialize form data
  formData = {
    ...formData,
    shortname: formData.shortname || "",
    title: {
      en: formData.title?.en || "",
      ar: formData.title?.ar || "",
      ku: formData.title?.ku || "",
    },
    description: {
      en: formData.description?.en || "",
      ar: formData.description?.ar || "",
      ku: formData.description?.ku || "",
    },
    image_url: formData.image_url || "",
    background_color: formData.background_color || "#ffffff",
    collection_type: formData.collection_type || "banner",
    banner_url: formData.banner_url || "",
    products: formData.products || [],
    product_card_type: formData.product_card_type || "basic",
    is_active: formData.is_active ?? true,
  };

  onMount(async () => {
    await loadProducts();
  });

  async function loadProducts() {
    try {
      const response: any = await Dmart.query({
        space_name: website.main_space,
        subpath: "/products",
        type: QueryType.search,
        search: "",
        limit: 200,
      });
      if (response && response.records) {
        availableProducts = response.records;
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      loading = false;
    }
  }

  function validate() {
    const isValid = form?.checkValidity();
    if (!isValid) {
      form?.reportValidity();
      return false;
    }

    // Additional validation
    if (formData.collection_type === "banner" && !formData.banner_url) {
      alert($_("validation.bannerUrlRequired"));
      return false;
    }

    if (formData.collection_type === "product_cards") {
      if (formData.products.length === 0) {
        alert($_("validation.selectAtLeastOneProduct"));
        return false;
      }
      if (formData.products.length > 20) {
        alert($_("validation.maxProductsExceeded"));
        return false;
      }
    }

    return true;
  }

  validateFn = validate;

  function addProduct(product: any) {
    if (formData.products.length >= 20) {
      alert($_("validation.maxProductsExceeded"));
      return;
    }

    const exists = formData.products.find(
      (p) => p.product_shortname === product.shortname
    );
    if (exists) {
      alert($_("validation.productAlreadyAdded"));
      return;
    }

    formData.products = [
      ...formData.products,
      {
        product_shortname: product.shortname,
        order: formData.products.length + 1,
        discount_message: { en: "", ar: "", ku: "" },
        custom_message: { en: "", ar: "", ku: "" },
      },
    ];
    searchTerm = "";
    showProductSearch = false;
  }

  function removeProduct(index: number) {
    formData.products = formData.products.filter((_, i) => i !== index);
    // Reorder products
    formData.products = formData.products.map((p, i) => ({
      ...p,
      order: i + 1,
    }));
  }

  function moveProduct(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.products.length) return;

    const temp = formData.products[index];
    formData.products[index] = formData.products[newIndex];
    formData.products[newIndex] = temp;

    // Update order
    formData.products = formData.products.map((p, i) => ({
      ...p,
      order: i + 1,
    }));
  }

  $effect(() => {
    if (searchTerm) {
      showProductSearch = true;
    }
  });

  let filteredProducts = $derived(
    availableProducts.filter((p) =>
      p.shortname?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
</script>

<form bind:this={form} class="collection-form">
  <div class="card">
    <h2 class="card-title">{$_("collection.typeConfig")}</h2>

    <div class="form-group">
      <label class="form-label" for="collection_type">
        <span class="required">*</span>
        {$_("collection.type")}
      </label>
      <select
        id="collection_type"
        class="form-select"
        bind:value={formData.collection_type}
        required
      >
        <option value="banner">{$_("collection.typeBanner")}</option>
        <option value="product_cards"
          >{$_("collection.typeProductCards")}</option
        >
      </select>
    </div>

    {#if formData.collection_type === "banner"}
      <div class="form-group">
        <label class="form-label" for="banner_url">
          <span class="required">*</span>
          {$_("collection.bannerUrl")}
        </label>
        <input
          id="banner_url"
          type="url"
          class="form-input"
          bind:value={formData.banner_url}
          required
          placeholder="https://example.com/banner"
        />
      </div>
    {:else if formData.collection_type === "product_cards"}
      <div class="form-group">
        <label class="form-label" for="product_card_type">
          <span class="required">*</span>
          {$_("collection.productCardType")}
        </label>
        <select
          id="product_card_type"
          class="form-select"
          bind:value={formData.product_card_type}
          required
        >
          <option value="basic">{$_("collection.cardTypeBasic")}</option>
          <option value="discount">{$_("collection.cardTypeDiscount")}</option>
          <option value="withMessage"
            >{$_("collection.cardTypeWithMessage")}</option
          >
        </select>
        <small class="form-hint">
          {#if formData.product_card_type === "basic"}
            {$_("collection.cardTypeBasicHint")}
          {:else if formData.product_card_type === "discount"}
            {$_("collection.cardTypeDiscountHint")}
          {:else if formData.product_card_type === "withMessage"}
            {$_("collection.cardTypeWithMessageHint")}
          {/if}
        </small>
      </div>

      <div class="form-group">
        <div class="form-label">
          <span class="required">*</span>
          {$_("collection.products")} ({formData.products.length}/20)
        </div>

        {#if loading}
          <div class="loading-skeleton">
            <div class="skeleton-line"></div>
          </div>
        {:else}
          <div class="product-search">
            <input
              type="text"
              class="form-input"
              bind:value={searchTerm}
              placeholder={$_("collection.searchProducts")}
              onfocus={() => (showProductSearch = true)}
            />
            {#if showProductSearch && searchTerm}
              <div class="search-results">
                {#each filteredProducts.slice(0, 10) as product}
                  <button
                    type="button"
                    class="search-result-item"
                    onclick={() => addProduct(product)}
                  >
                    {product.shortname}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="products-list">
            {#each formData.products as product, index}
              <div class="product-item">
                <div class="product-header">
                  <span class="product-order">#{product.order}</span>
                  <span class="product-name">{product.product_shortname}</span>
                  <div class="product-actions">
                    <button
                      type="button"
                      class="btn-icon"
                      onclick={() => moveProduct(index, "up")}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="btn-icon"
                      onclick={() => moveProduct(index, "down")}
                      disabled={index === formData.products.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="btn-icon btn-delete"
                      onclick={() => removeProduct(index)}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {#if formData.product_card_type === "discount"}
                  <div class="product-details">
                    <input
                      type="text"
                      class="form-input-sm"
                      bind:value={product.discount_message.en}
                      placeholder={$_("collection.discountMessageEn")}
                    />
                  </div>
                {:else if formData.product_card_type === "withMessage"}
                  <div class="product-details">
                    <input
                      type="text"
                      class="form-input-sm"
                      bind:value={product.custom_message.en}
                      placeholder={$_("collection.customMessageEn")}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
  <div class="card">
    <h2 class="card-title">{$_("collection.basicInfo")}</h2>

    <div class="form-group">
      <label class="form-label" for="shortname">
        <span class="required">*</span>
        {$_("collection.shortname")}
      </label>
      <input
        id="shortname"
        type="text"
        class="form-input"
        bind:value={formData.shortname}
        pattern="^[a-zA-Z0-9_]&#123;1,64&#125;$"
        required
        placeholder={$_("collection.shortnamePlaceholder")}
      />
    </div>

    <div class="form-group">
      <label class="form-label" for="title_en">
        <span class="required">*</span>
        {$_("collection.titleEn")}
      </label>
      <input
        id="title_en"
        type="text"
        class="form-input"
        bind:value={formData.title.en}
        required
        placeholder={$_("collection.titlePlaceholder")}
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="title_ar">
          {$_("collection.titleAr")}
        </label>
        <input
          id="title_ar"
          type="text"
          class="form-input"
          bind:value={formData.title.ar}
          placeholder={$_("collection.titlePlaceholder")}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="title_ku">
          {$_("collection.titleKu")}
        </label>
        <input
          id="title_ku"
          type="text"
          class="form-input"
          bind:value={formData.title.ku}
          placeholder={$_("collection.titlePlaceholder")}
        />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="description_en">
        {$_("collection.descriptionEn")}
      </label>
      <textarea
        id="description_en"
        class="form-textarea"
        bind:value={formData.description.en}
        rows="3"
        placeholder={$_("collection.descriptionPlaceholder")}
      ></textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="description_ar">
          {$_("collection.descriptionAr")}
        </label>
        <textarea
          id="description_ar"
          class="form-textarea"
          bind:value={formData.description.ar}
          rows="3"
          placeholder={$_("collection.descriptionPlaceholder")}
        ></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" for="description_ku">
          {$_("collection.descriptionKu")}
        </label>
        <textarea
          id="description_ku"
          class="form-textarea"
          bind:value={formData.description.ku}
          rows="3"
          placeholder={$_("collection.descriptionPlaceholder")}
        ></textarea>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="image_url">
          {$_("collection.imageUrl")}
        </label>
        <input
          id="image_url"
          type="url"
          class="form-input"
          bind:value={formData.image_url}
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="background_color">
          {$_("collection.backgroundColor")}
        </label>
        <input
          id="background_color"
          type="color"
          class="form-input-color"
          bind:value={formData.background_color}
        />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" bind:checked={formData.is_active} />
        {$_("common.isActive")}
      </label>
    </div>
  </div>
</form>

<style>
  .collection-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    color: #1f2937;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .required {
    color: #ef4444;
    margin-right: 0.25rem;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input-color {
    width: 80px;
    height: 40px;
    padding: 0.25rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
  }

  .form-input-sm {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .product-search {
    position: relative;
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    margin-top: 0.25rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .search-result-item {
    width: 100%;
    padding: 0.625rem;
    text-align: left;
    border: none;
    background: white;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .search-result-item:hover {
    background-color: #f3f4f6;
  }

  .products-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .product-item {
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
  }

  .product-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .product-order {
    font-weight: 600;
    color: #6b7280;
    min-width: 30px;
  }

  .product-name {
    flex: 1;
    font-weight: 500;
  }

  .product-actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-icon:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .btn-icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-delete {
    color: #ef4444;
    font-size: 1.5rem;
    font-weight: bold;
    line-height: 1;
  }

  .btn-delete:hover {
    background: #fee2e2;
  }

  .product-details {
    margin-top: 0.75rem;
  }

  .loading-skeleton {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-line {
    width: 100%;
    height: 40px;
    background: #281f51;
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>

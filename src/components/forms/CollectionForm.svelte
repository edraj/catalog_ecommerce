<script lang="ts">
  import { onMount } from "svelte";
  import { Dmart, QueryType, ResourceType } from "@edraj/tsdmart";
  import { _ } from "@/i18n";
  import { website } from "@/config";
  import { getSpaceContents } from "@/lib/dmart_services";

  let {
    formData = $bindable(),
    validateFn = $bindable(),
  }: {
    formData: any;
    validateFn: () => boolean;
  } = $props();

  let form;
  let sellers = $state([]);
  let loading = $state(true);
  let searchTerm = $state("");
  let showSellerSearch = $state(false);
  let selectedSeller = $state(null);
  let showProductSelector = $state(false);
  let showVariantSelector = $state(false);
  let currentItemIndex = $state(-1);
  let availableProducts = $state([]);
  let loadingProducts = $state(false);
  let selectedAvailableProduct = $state(null);

  formData = {
    ...formData,
    shortname: formData.shortname || "",
    displayname: {
      en: formData.displayname?.en || "",
      ar: formData.displayname?.ar || "",
      ku: formData.displayname?.ku || "",
    },
    description: {
      en: formData.description?.en || "",
      ar: formData.description?.ar || "",
      ku: formData.description?.ku || "",
    },
    items: formData.items || [],
    is_active: formData.is_active ?? true,
  };

  onMount(async () => {
    await loadSellers();
  });

  async function loadSellers() {
    try {
      const usersResponse: any = await getSpaceContents(
        "management",
        "/users",
        "managed",
        100,
        0,
        false
      );

      const userMap = new Map();
      if (usersResponse && usersResponse.records) {
        usersResponse.records.forEach((user) => {
          userMap.set(
            user.shortname,
            user.attributes?.displayname?.en ||
              user.attributes?.displayname?.ar ||
              user.shortname
          );
        });
      }

      const response: any = await getSpaceContents(
        website.main_space,
        "/available_products",
        "managed",
        100,
        0,
        false
      );

      if (response && response.records) {
        const sellerSet = new Set();
        response.records.forEach((record) => {
          const parts = record.subpath.split("/");
          if (parts.length >= 2 && parts[0] === "available_products") {
            sellerSet.add(parts[1]);
          }
        });
        sellers = Array.from(sellerSet).map((shortname) => ({
          shortname,
          displayname: userMap.get(shortname) || shortname,
        }));
      }
    } catch (error) {
      console.error("Failed to load sellers:", error);
    } finally {
      loading = false;
    }
  }

  async function loadSellerProducts(sellerShortname: string) {
    loadingProducts = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        `/available_products/${sellerShortname}`,
        "managed",
        100,
        0,
        true
      );

      if (response && response.records) {
        availableProducts = response.records;
      }
    } catch (error) {
      console.error("Failed to load seller products:", error);
      availableProducts = [];
    } finally {
      loadingProducts = false;
    }
  }

  function validate() {
    const isValid = form?.checkValidity();
    if (!isValid) {
      form?.reportValidity();
      return false;
    }

    if (formData.items.length === 0) {
      alert($_("validation.selectAtLeastOneProduct"));
      return false;
    }

    if (formData.items.length > 20) {
      alert($_("validation.maxProductsExceeded"));
      return false;
    }

    for (const item of formData.items) {
      if (
        !item.product_shortname ||
        !item.variant_key ||
        !item.available_product_shortname
      ) {
        alert($_("validation.incompleteItem"));
        return false;
      }
    }

    return true;
  }

  validateFn = validate;

  async function startAddingItem(seller: any) {
    selectedSeller = seller;
    showSellerSearch = false;
    searchTerm = "";

    await loadSellerProducts(seller.shortname);
    showProductSelector = true;
  }

  function selectAvailableProduct(availableProduct: any) {
    selectedAvailableProduct = availableProduct;
    showProductSelector = false;

    const variants = availableProduct.attributes?.payload?.body?.variants || [];
    if (variants.length > 0) {
      showVariantSelector = true;
    } else {
      alert($_("validation.noVariantsAvailable"));
    }
  }

  function selectVariant(variant: any) {
    showVariantSelector = false;

    formData.items = [
      ...formData.items,
      {
        product_shortname:
          selectedAvailableProduct.attributes.payload.body.product_shortname,
        variant_key: variant.key,
        available_product_shortname: selectedAvailableProduct.shortname,
      },
    ];

    selectedSeller = null;
    selectedAvailableProduct = null;
  }

  function cancelItemAddition() {
    showSellerSearch = false;
    showProductSelector = false;
    showVariantSelector = false;
    selectedSeller = null;
    selectedAvailableProduct = null;
    currentItemIndex = -1;
  }

  function removeItem(index: number) {
    formData.items = formData.items.filter((_, i) => i !== index);
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.items.length) return;

    const temp = formData.items[index];
    formData.items[index] = formData.items[newIndex];
    formData.items[newIndex] = temp;

    formData.items = [...formData.items];
  }

  $effect(() => {
    if (sellers.length > 0 && !searchTerm) {
      showSellerSearch = true;
    }
  });

  let filteredSellers = $derived(
    searchTerm
      ? sellers.filter((s) => {
          const lowerSearch = searchTerm.toLowerCase();
          return (
            s.shortname?.toLowerCase().includes(lowerSearch) ||
            s.displayname?.toLowerCase().includes(lowerSearch)
          );
        })
      : sellers
  );
</script>

<form bind:this={form} class="collection-form">
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
      <label class="form-label" for="displayname_en">
        <span class="required">*</span>
        {$_("collection.titleEn")}
      </label>
      <input
        id="displayname_en"
        type="text"
        class="form-input"
        bind:value={formData.displayname.en}
        required
        placeholder={$_("collection.titlePlaceholder")}
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="displayname_ar">
          {$_("collection.titleAr")}
        </label>
        <input
          id="displayname_ar"
          type="text"
          class="form-input"
          bind:value={formData.displayname.ar}
          placeholder={$_("collection.titlePlaceholder")}
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="displayname_ku">
          {$_("collection.titleKu")}
        </label>
        <input
          id="displayname_ku"
          type="text"
          class="form-input"
          bind:value={formData.displayname.ku}
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

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" bind:checked={formData.is_active} />
        {$_("common.isActive")}
      </label>
    </div>
  </div>

  <div class="card">
    <h2 class="card-title">
      {$_("collection.items")} ({formData.items.length}/20)
    </h2>

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
          placeholder={$_("collection.searchSellers")}
          onfocus={() => (showSellerSearch = true)}
        />
        {#if showSellerSearch}
          <div class="search-results">
            {#each filteredSellers.slice(0, 10) as seller}
              <button
                type="button"
                class="search-result-item"
                onclick={() => startAddingItem(seller)}
              >
                <div class="seller-search-item">
                  <div class="seller-search-name">
                    {seller.displayname || seller.shortname}
                  </div>
                  {#if seller.displayname && seller.displayname !== seller.shortname}
                    <div class="seller-search-shortname">
                      @{seller.shortname}
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
            {#if filteredSellers.length === 0}
              <div class="empty-search-message">
                {$_("collection.noSellersAvailable")}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="items-list">
        {#each formData.items as item, index}
          <div class="item-card">
            <div class="item-header">
              <span class="item-order">#{index + 1}</span>
              <div class="item-info">
                <div class="item-name">
                  {#if item.product_displayname}
                    {item.product_displayname}
                  {:else}
                    {item.product_shortname}
                  {/if}
                </div>
                <div class="item-meta">
                  <span class="meta-badge"
                    >Variant: {item.variant_key.substring(0, 8)}...</span
                  >
                  <span class="meta-badge"
                    >Seller: {item.seller_displayname ||
                      item.seller_shortname ||
                      item.available_product_shortname}</span
                  >
                </div>
              </div>
              <div class="item-actions">
                <button
                  type="button"
                  class="btn-icon"
                  onclick={() => moveItem(index, "up")}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn-icon"
                  onclick={() => moveItem(index, "down")}
                  disabled={index === formData.items.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="btn-icon btn-delete"
                  onclick={() => removeItem(index)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        {/each}

        {#if formData.items.length === 0}
          <div class="empty-state">
            <p>{$_("collection.noItemsYet")}</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</form>

<!-- Product Selector Modal -->
{#if showProductSelector && selectedSeller}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={cancelItemAddition}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("collection.selectProduct")}</h2>
        <button class="modal-close" onclick={cancelItemAddition}>×</button>
      </div>
      <div class="modal-body">
        <p class="modal-subtitle">
          {$_("collection.seller")}: {selectedSeller.displayname ||
            selectedSeller.shortname}
        </p>
        {#if loadingProducts}
          <div class="loading-skeleton">
            <div class="skeleton-line"></div>
          </div>
        {:else if availableProducts.length === 0}
          <p class="empty-message">{$_("collection.noProductsAvailable")}</p>
        {:else}
          <div class="product-list">
            {#each availableProducts as availableProduct}
              <button
                type="button"
                class="product-item-btn"
                onclick={() => selectAvailableProduct(availableProduct)}
              >
                <div class="product-item-name">
                  {availableProduct.attributes?.displayname?.en ||
                    availableProduct.shortname}
                </div>
                <div class="product-item-meta">
                  <span class="meta-badge">
                    {availableProduct.attributes?.payload?.body?.variants
                      ?.length || 0} variants
                  </span>
                  <span class="meta-badge">
                    {availableProduct.attributes?.payload?.body
                      ?.product_shortname}
                  </span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Variant Selector Modal -->
{#if showVariantSelector && selectedAvailableProduct}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={cancelItemAddition}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("collection.selectVariant")}</h2>
        <button class="modal-close" onclick={cancelItemAddition}>×</button>
      </div>
      <div class="modal-body">
        <p class="modal-subtitle">
          {$_("collection.product")}: {selectedAvailableProduct.attributes
            ?.displayname?.en || selectedAvailableProduct.shortname}
        </p>
        <div class="variant-list">
          {#each selectedAvailableProduct.attributes?.payload?.body?.variants || [] as variant}
            <button
              type="button"
              class="variant-item"
              onclick={() => selectVariant(variant)}
            >
              <div class="variant-header">
                <span class="variant-key">{variant.key}</span>
                <span class="variant-price">{variant.retail_price} IQD</span>
              </div>
              <div class="variant-details">
                <span class="variant-detail">Qty: {variant.qty}</span>
                {#if variant.sku}
                  <span class="variant-detail">SKU: {variant.sku}</span>
                {/if}
                {#if variant.discount?.value > 0}
                  <span class="variant-detail discount">
                    Discount: {variant.discount.value}
                    {variant.discount.type === "percentage" ? "%" : "IQD"}
                  </span>
                {/if}
              </div>
              {#if variant.options && variant.options.length > 0}
                <div class="variant-options">
                  {#each variant.options as option}
                    <span class="option-badge">
                      {option.variation_shortname}: {option.key}
                    </span>
                  {/each}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

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

  .product-search {
    position: relative;
    margin-bottom: 1rem;
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

  .seller-search-item {
    width: 100%;
  }

  .seller-search-name {
    font-weight: 500;
    color: #1f2937;
  }

  .seller-search-shortname {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .empty-search-message {
    padding: 1rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 500px;
    overflow-y: auto;
  }

  .item-card {
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
  }

  .item-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .item-order {
    font-weight: 600;
    color: #6b7280;
    min-width: 30px;
  }

  .item-info {
    flex: 1;
  }

  .item-name {
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #1f2937;
  }

  .item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .meta-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: #e5e7eb;
    border-radius: 4px;
    color: #374151;
  }

  .item-actions {
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

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
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
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
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
  }

  .modal {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-sm {
    max-width: 500px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    transition: color 0.2s;
  }

  .modal-close:hover {
    color: #1f2937;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .modal-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1rem;
  }

  .variant-list,
  .seller-list,
  .product-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .product-item-btn {
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .product-item-btn:hover {
    background: #f9fafb;
    border-color: #3b82f6;
  }

  .product-item-name {
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #1f2937;
  }

  .product-item-meta {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .variant-item {
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .variant-item:hover {
    background: #f9fafb;
    border-color: #3b82f6;
  }

  .variant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .variant-key {
    font-weight: 600;
    color: #1f2937;
    word-break: break-all;
    font-size: 0.875rem;
  }

  .variant-price {
    font-weight: 600;
    color: #059669;
    font-size: 0.875rem;
  }

  .variant-details {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .variant-detail {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .variant-detail.discount {
    color: #dc2626;
    font-weight: 500;
  }

  .variant-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .option-badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    background: #dbeafe;
    border-radius: 4px;
    color: #1e40af;
  }

  .empty-message {
    text-align: center;
    color: #6b7280;
    padding: 1rem;
  }
</style>

<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    productSearchTerm: string;
    filteredProducts: any[];
    isLoadingProducts: boolean;
    selectedProduct: string;
    isLoadingVariations: boolean;
    productVariants: any[];
    selectedVariants: string[];
    onClose: () => void;
    onSubmit: () => void;
    onProductSearchChange: (value: string) => void;
    onFilterProducts: () => void;
    onProductChange: () => void;
    onToggleVariant: (variantKey: string) => void;
    isVariantSelected: (variantKey: string) => boolean;
    getLocalizedDisplayName: (item: any) => string;
    updateVariant: (key: string, field: string, value: any) => void;
  };

  let {
    show = $bindable(),
    isRTL,
    productSearchTerm = $bindable(),
    filteredProducts,
    isLoadingProducts,
    selectedProduct = $bindable(),
    isLoadingVariations,
    productVariants,
    selectedVariants,
    onClose,
    onSubmit,
    onProductSearchChange,
    onFilterProducts,
    onProductChange,
    onToggleVariant,
    isVariantSelected,
    getLocalizedDisplayName,
    updateVariant,
  }: Props = $props();
</script>

{#if show}
  <div class="modal-overlay" onclick={onClose}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="header-content">
          <div class="icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h2 class="modal-title">
              {$_("seller_dashboard.add_product_item") || "Add Product to Store"}
            </h2>
            <p class="modal-subtitle">Search and select products to add to your inventory</p>
          </div>
        </div>
        <button class="modal-close" onclick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Product Search -->
        <div class="search-section">
          <div class="search-wrapper">
            <svg class="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <circle cx="8" cy="8" r="5" stroke-width="2" />
              <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
            </svg>
            <input
              type="text"
              bind:value={productSearchTerm}
              oninput={onFilterProducts}
              placeholder={$_("seller_dashboard.search_placeholder") || "Search by product name..."}
              class="search-input"
              class:rtl={isRTL}
            />
            {#if productSearchTerm}
              <button class="clear-search" onclick={() => { productSearchTerm = ""; onFilterProducts(); }}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L6.707 5.293a1 1 0 00-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586z" />
                </svg>
              </button>
            {/if}
          </div>
          {#if filteredProducts.length > 0}
            <div class="results-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
            </div>
          {/if}
        </div>

        <!-- Product List -->
        {#if isLoadingProducts}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{$_("seller_dashboard.loading") || "Loading products..."}</p>
          </div>
        {:else if filteredProducts.length === 0}
          <div class="empty-state-card">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
              <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
              <path d="M16 24h16M24 16v16" stroke-width="2" stroke-linecap="round" />
            </svg>
            <p class="empty-message">{$_("seller_dashboard.no_products_found") || "No products found"}</p>
            <p class="empty-hint">Try adjusting your search terms</p>
          </div>
        {:else}
          <div class="products-grid">
            {#each filteredProducts as product}
              <button
                class="product-card"
                class:selected={selectedProduct === product.shortname}
                onclick={() => {
                  selectedProduct = product.shortname;
                  onProductChange();
                }}
              >
                <div class="product-card-header">
                  <div class="product-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  {#if selectedProduct === product.shortname}
                    <div class="selected-badge">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                    </div>
                  {/if}
                </div>
                <h3 class="product-name">{getLocalizedDisplayName(product)}</h3>
                <div class="product-meta">
                  <span class="product-id">ID: {product.shortname}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}

        <!-- Variations Selection -->
        {#if selectedProduct}
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <svg
                class="label-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span
                >{$_("seller_dashboard.select_variations") ||
                  "Select Variations to Add"}</span
              >
            </label>
            {#if isLoadingVariations}
              <div class="loading-select">
                <div class="mini-spinner"></div>
                <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
              </div>
            {:else if productVariants.length === 0}
              <div class="info-message">
                <p>
                  {$_("seller_dashboard.no_variations") ||
                    "No variations available for this product at the moment"}
                </p>
              </div>
            {:else}
              <!-- Variants Selection with Checkboxes -->
              <div class="variants-selection-grid">
                {#each productVariants as variant}
                  <div class="variant-checkbox-item">
                    <label class="variant-checkbox-label">
                      <input
                        type="checkbox"
                        checked={isVariantSelected(variant.key)}
                        onchange={() => onToggleVariant(variant.key)}
                        class="variant-checkbox"
                      />
                      <div class="variant-info">
                        <div class="variant-name">
                          {#if variant.type === "color" && variant.hex}
                            <span
                              class="color-swatch"
                              style="background-color: {variant.hex}"
                            ></span>
                          {/if}
                          <span>{variant.name?.en || variant.shortname}</span>
                        </div>
                        <div class="variant-type-badge">
                          {variant.type === "color"
                            ? $_("seller_dashboard.color") || "Color"
                            : $_("seller_dashboard.storage") || "Storage"}
                        </div>
                      </div>
                    </label>
                  </div>
                {/each}
              </div>

              <!-- Details for Selected Variants -->
              {#if selectedVariants.length > 0}
                <div class="selected-variants-details">
                  <h4 class="details-title">
                    {$_("seller_dashboard.enter_details") ||
                      "Enter Details for Selected Variations"}
                  </h4>
                  <div class="variations-table-wrapper">
                    <table class="variations-table">
                      <thead>
                        <tr>
                          <th class:rtl={isRTL}>
                            {$_("seller_dashboard.variation") || "Variation"}
                          </th>
                          <th class:rtl={isRTL}>
                            {$_("seller_dashboard.sku") || "SKU"}
                          </th>
                          <th class:rtl={isRTL}>
                            {$_("seller_dashboard.stock") || "Stock"}
                          </th>
                          <th class:rtl={isRTL}>
                            {$_("seller_dashboard.price") || "Price"} (IQD)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each productVariants.filter( (v) => isVariantSelected(v.key) ) as variant}
                          <tr>
                            <td class="variation-name-cell" class:rtl={isRTL}>
                              <div class="variation-name-wrapper">
                                {#if variant.type === "color" && variant.hex}
                                  <span
                                    class="color-swatch-small"
                                    style="background-color: {variant.hex}"
                                  ></span>
                                {/if}
                                <span
                                  >{variant.name?.en || variant.shortname}</span
                                >
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                bind:value={variant.sku}
                                placeholder={$_("seller_dashboard.enter_sku") ||
                                  "Enter SKU..."}
                                class="table-input sku-input-field"
                                class:rtl={isRTL}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                bind:value={variant.qty}
                                placeholder="0"
                                class="table-input stock-input-field"
                                class:rtl={isRTL}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                bind:value={variant.retailPrice}
                                placeholder="0.00"
                                class="table-input price-input-field"
                                class:rtl={isRTL}
                              />
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={onSubmit}
          disabled={!selectedProduct ||
            selectedVariants.length === 0 ||
            !productVariants
              .filter((v) => isVariantSelected(v.key))
              .some((v) => v.retailPrice)}
        >
          {$_("seller_dashboard.add_items") || "Add Items"}
        </button>
      </div>
    </div>
  </div>
{/if}

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
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.add_product_item") || "Add Product to Store"}
        </h2>
        <button class="modal-close" onclick={onClose}>
          <svg
            class="close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Product Search and Selection -->
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span
              >{$_("seller_dashboard.search_products") ||
                "Search Products"}</span
            >
          </label>
          <input
            type="text"
            bind:value={productSearchTerm}
            oninput={onFilterProducts}
            placeholder={$_("seller_dashboard.search_placeholder") ||
              "Search by product name..."}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- Product List -->
        {#if isLoadingProducts}
          <div class="loading-select">
            <div class="mini-spinner"></div>
            <span
              >{$_("seller_dashboard.loading") || "Loading products..."}</span
            >
          </div>
        {:else if filteredProducts.length === 0}
          <p class="empty-message">
            {$_("seller_dashboard.no_products_found") || "No products found"}
          </p>
        {:else}
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span
                >{$_("seller_dashboard.select_product") ||
                  "Select Product"}</span
              >
            </label>
            <select
              bind:value={selectedProduct}
              onchange={onProductChange}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value="">
                {$_("seller_dashboard.choose_product") || "Choose a product..."}
              </option>
              {#each filteredProducts as product}
                <option value={product.shortname}>
                  {getLocalizedDisplayName(product)}
                </option>
              {/each}
            </select>
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
                            {$_("seller_dashboard.price") || "Price"} ($)
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

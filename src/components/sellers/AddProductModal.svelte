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
    currentPage: number;
    totalPages: number;
    isSearching: boolean;
    onClose: () => void;
    onSubmit: () => void;
    onProductSearchChange: (value: string) => void;
    onFilterProducts: () => void;
    onProductChange: () => void;
    onToggleVariant: (variantKey: string) => void;
    isVariantSelected: (variantKey: string) => boolean;
    getLocalizedDisplayName: (item: any) => string;
    updateVariant: (key: string, field: string, value: any) => void;
    onPageChange: (page: number) => void;
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
    currentPage,
    totalPages,
    isSearching,
    onClose,
    onSubmit,
    onProductSearchChange,
    onFilterProducts,
    onProductChange,
    onToggleVariant,
    isVariantSelected,
    getLocalizedDisplayName,
    updateVariant,
    onPageChange,
  }: Props = $props();
</script>

{#if show}
  <div class="modern-modal-overlay" onclick={onClose}>
    <div class="modern-modal-container" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="modern-modal-header">
        <div class="header-content">
          <div class="icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div>
            <h2 class="modal-title">
              {$_("seller_dashboard.add_product_item") ||
                "Add Product to Store"}
            </h2>
            <p class="modal-subtitle">
              Search and select products to add to your inventory
            </p>
          </div>
        </div>
        <button class="modern-modal-close" onclick={onClose}>
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

      <!-- Body -->
      <div class="modern-modal-body">
        <!-- Search Section -->
        <div class="search-section">
          <div class="search-wrapper">
            {#if isSearching}
              <div class="search-icon spinner-icon">
                <div class="spinner-small"></div>
              </div>
            {:else}
              <svg
                class="search-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="8" cy="8" r="5" stroke-width="2" />
                <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
              </svg>
            {/if}
            <input
              type="text"
              bind:value={productSearchTerm}
              oninput={onFilterProducts}
              placeholder={$_("seller_dashboard.search_placeholder") ||
                "Search by product name..."}
              class="search-input"
              class:rtl={isRTL}
            />
            {#if productSearchTerm && !isSearching}
              <button
                class="clear-search"
                onclick={() => {
                  productSearchTerm = "";
                  onFilterProducts();
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M10 8.586L6.707 5.293a1 1 0 00-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586z"
                  />
                </svg>
              </button>
            {/if}
          </div>
          {#if filteredProducts.length > 0}
            <div class="results-count">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                style="width: 16px; height: 16px;"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fill-rule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clip-rule="evenodd"
                />
              </svg>
              {filteredProducts.length}
              {filteredProducts.length === 1 ? "product" : "products"} found
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
              <rect
                x="8"
                y="8"
                width="32"
                height="32"
                rx="4"
                stroke-width="2"
              />
              <path
                d="M16 24h16M24 16v16"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <p class="empty-message">
              {$_("seller_dashboard.no_products_found") || "No products found"}
            </p>
            <p class="empty-hint">Try adjusting your search terms</p>
          </div>
        {:else}
          <div class="products-table-container">
            <table class="products-table">
              <thead>
                <tr>
                  <th style="width: 50px;"></th>
                  <th
                    >{$_("seller_dashboard.product_name") || "Product Name"}</th
                  >
                  <th style="width: 200px;"
                    >{$_("seller_dashboard.product_id") || "Product ID"}</th
                  >
                  <th style="width: 150px;"
                    >{$_("common.category") || "Category"}</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each filteredProducts as product}
                  <tr
                    class="product-row"
                    class:selected={selectedProduct === product.shortname}
                    onclick={() => {
                      selectedProduct = product.shortname;
                      onProductChange();
                    }}
                  >
                    <td class="radio-cell">
                      <div class="radio-wrapper">
                        <input
                          type="radio"
                          name="product-select"
                          checked={selectedProduct === product.shortname}
                          onchange={() => {
                            selectedProduct = product.shortname;
                            onProductChange();
                          }}
                        />
                        <div class="radio-custom"></div>
                      </div>
                    </td>
                    <td class="product-name-cell">
                      <div class="product-name-content">
                        <div class="product-icon-small">
                          <svg
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
                        </div>
                        <span class="product-name-text"
                          >{getLocalizedDisplayName(product)}</span
                        >
                      </div>
                    </td>
                    <td class="product-id-cell">
                      <code class="product-id-code">{product.shortname}</code>
                    </td>
                    <td class="product-category-cell">
                      <span class="category-badge">
                        {product.attributes?.payload?.body?.category ||
                          "General"}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          {#if totalPages > 1 && !isSearching}
            <div class="pagination-container">
              <button
                class="pagination-btn"
                onclick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoadingProducts}
                title={$_("common.previous") || "Previous"}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <div class="pagination-numbers">
                {#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum}
                  {#if pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)}
                    <button
                      class="pagination-number"
                      class:active={pageNum === currentPage}
                      onclick={() => onPageChange(pageNum)}
                      disabled={isLoadingProducts}
                    >
                      {pageNum}
                    </button>
                  {:else if pageNum === currentPage - 2 || pageNum === currentPage + 2}
                    <span class="pagination-ellipsis">...</span>
                  {/if}
                {/each}
              </div>

              <button
                class="pagination-btn"
                onclick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoadingProducts}
                title={$_("common.next") || "Next"}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          {/if}
        {/if}

        <!-- Variations Section -->
        {#if selectedProduct}
          <div class="variations-section">
            <div class="section-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3>
                {$_("seller_dashboard.select_variations") ||
                  "Select Variations"}
              </h3>
            </div>

            {#if isLoadingVariations}
              <div class="loading-state">
                <div class="spinner"></div>
                <p>
                  {$_("seller_dashboard.loading") || "Loading variations..."}
                </p>
              </div>
            {:else if productVariants.length === 0}
              <div class="info-message warning">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  />
                </svg>
                <div>
                  <p class="warning-title">
                    {$_("seller_dashboard.no_variations") ||
                      "No variations available for this product"}
                  </p>
                  <p class="warning-subtitle">
                    You can still add this product by selecting "No Variation"
                    below
                  </p>
                </div>
              </div>

              <!-- No Variation Option -->
              <div class="variants-grid">
                <label
                  class="variant-card"
                  class:selected={isVariantSelected("none")}
                >
                  <input
                    type="checkbox"
                    checked={isVariantSelected("none")}
                    onchange={() => onToggleVariant("none")}
                    class="variant-checkbox-hidden"
                  />
                  <div class="variant-card-content">
                    <div class="variant-header">
                      <div class="variant-icon none-icon">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                      {#if isVariantSelected("none")}
                        <div class="check-icon">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            />
                          </svg>
                        </div>
                      {/if}
                    </div>
                    <h4 class="variant-name">No Variation</h4>
                    <span class="variant-type">Standard Product</span>
                  </div>
                </label>
              </div>

              <!-- Details for No Variation -->
              {#if isVariantSelected("none")}
                <div class="details-section">
                  <h4 class="details-title">
                    {$_("seller_dashboard.enter_details") || "Enter Details"}
                  </h4>
                  <div class="details-table-wrapper">
                    <table class="details-table">
                      <thead>
                        <tr>
                          <th>{$_("seller_dashboard.sku") || "SKU"}</th>
                          <th>{$_("seller_dashboard.stock") || "Stock"}</th>
                          <th
                            >{$_("seller_dashboard.price") || "Price"} (IQD)</th
                          >
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <input
                              type="text"
                              value={productVariants[0]?.sku || ""}
                              oninput={(e) => {
                                if (!productVariants[0]) {
                                  productVariants[0] = {
                                    key: "none",
                                    sku: "",
                                    qty: 0,
                                    retailPrice: 0,
                                  };
                                }
                                productVariants[0].sku = e.currentTarget.value;
                                updateVariant(
                                  "none",
                                  "sku",
                                  e.currentTarget.value,
                                );
                              }}
                              placeholder="Enter SKU"
                              class="table-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={productVariants[0]?.qty || 0}
                              oninput={(e) => {
                                if (!productVariants[0]) {
                                  productVariants[0] = {
                                    key: "none",
                                    sku: "",
                                    qty: 0,
                                    retailPrice: 0,
                                  };
                                }
                                const val =
                                  parseInt(e.currentTarget.value) || 0;
                                productVariants[0].qty = val;
                                updateVariant("none", "qty", val);
                              }}
                              placeholder="0"
                              class="table-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={productVariants[0]?.retailPrice || 0}
                              oninput={(e) => {
                                if (!productVariants[0]) {
                                  productVariants[0] = {
                                    key: "none",
                                    sku: "",
                                    qty: 0,
                                    retailPrice: 0,
                                  };
                                }
                                const val =
                                  parseFloat(e.currentTarget.value) || 0;
                                productVariants[0].retailPrice = val;
                                updateVariant("none", "retailPrice", val);
                              }}
                              placeholder="0.00"
                              class="table-input"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              {/if}
            {:else}
              <!-- Variants Grid -->
              <div class="variants-grid">
                {#each productVariants as variant}
                  <label
                    class="variant-card"
                    class:selected={isVariantSelected(variant.key)}
                  >
                    <input
                      type="checkbox"
                      checked={isVariantSelected(variant.key)}
                      onchange={() => onToggleVariant(variant.key)}
                      class="variant-checkbox-hidden"
                    />
                    <div class="variant-card-content">
                      <div class="variant-header">
                        {#if variant.type === "color" && variant.hex}
                          <span
                            class="color-swatch"
                            style="background-color: {variant.hex}"
                          ></span>
                        {:else}
                          <div class="variant-icon">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path
                                d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                              />
                            </svg>
                          </div>
                        {/if}
                        {#if isVariantSelected(variant.key)}
                          <div class="check-icon">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              />
                            </svg>
                          </div>
                        {/if}
                      </div>
                      <h4 class="variant-name">
                        {variant.name?.en || variant.shortname}
                      </h4>
                      <span class="variant-type"
                        >{variant.type === "color" ? "Color" : "Storage"}</span
                      >
                    </div>
                  </label>
                {/each}
              </div>

              <!-- Selected Variants Details -->
              {#if selectedVariants.length > 0}
                <div class="details-section">
                  <h4 class="details-title">
                    {$_("seller_dashboard.enter_details") || "Enter Details"} ({selectedVariants.length}
                    selected)
                  </h4>
                  <div class="details-table-wrapper">
                    <table class="details-table">
                      <thead>
                        <tr>
                          <th
                            >{$_("seller_dashboard.variation") ||
                              "Variation"}</th
                          >
                          <th>{$_("seller_dashboard.sku") || "SKU"}</th>
                          <th>{$_("seller_dashboard.stock") || "Stock"}</th>
                          <th
                            >{$_("seller_dashboard.price") || "Price"} (IQD)</th
                          >
                        </tr>
                      </thead>
                      <tbody>
                        {#each productVariants.filter( (v) => isVariantSelected(v.key), ) as variant}
                          <tr>
                            <td class="variant-cell">
                              {#if variant.type === "color" && variant.hex}
                                <span
                                  class="color-swatch-small"
                                  style="background-color: {variant.hex}"
                                ></span>
                              {/if}
                              <span
                                >{variant.name?.en || variant.shortname}</span
                              >
                            </td>
                            <td>
                              <input
                                type="text"
                                bind:value={variant.sku}
                                placeholder="Enter SKU"
                                class="table-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                bind:value={variant.qty}
                                placeholder="0"
                                class="table-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                bind:value={variant.retailPrice}
                                placeholder="0.00"
                                class="table-input"
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

      <!-- Footer -->
      <div class="modern-modal-footer">
        <button class="btn-secondary" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="btn-primary"
          onclick={onSubmit}
          disabled={!selectedProduct ||
            selectedVariants.length === 0 ||
            (!productVariants
              .filter((v) => isVariantSelected(v.key))
              .some((v) => v.retailPrice) &&
              !isVariantSelected("none")) ||
            (isVariantSelected("none") &&
              (!productVariants[0] || !productVariants[0].retailPrice))}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            />
          </svg>
          {$_("seller_dashboard.add_items") || "Add Items"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modern-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modern-modal-container {
    background: white;
    border-radius: 1rem;
    width: 100%;
    max-width: 1400px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modern-modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(to bottom, #fafafa, #ffffff);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #281f51 0%, #3d2f6a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-wrapper svg {
    width: 24px;
    height: 24px;
    stroke: white;
    stroke-width: 2;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .modal-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0.25rem 0 0;
  }

  .modern-modal-close {
    width: 36px;
    height: 36px;
    border: none;
    background: #f3f4f6;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .modern-modal-close:hover {
    background: #e5e7eb;
    transform: scale(1.05);
  }

  .modern-modal-close svg {
    width: 20px;
    height: 20px;
    stroke: #6b7280;
  }

  .modern-modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .search-section {
    margin-bottom: 2rem;
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    width: 20px;
    height: 20px;
    stroke: #9ca3af;
    pointer-events: none;
  }

  .products-table-container {
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    background: white;
    max-height: 400px;
    overflow-y: auto;
  }

  .products-table-container::-webkit-scrollbar {
    width: 8px;
  }

  .products-table-container::-webkit-scrollbar-track {
    background: #f3f4f6;
  }

  .products-table-container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  .products-table-container::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  .products-table {
    width: 100%;
    border-collapse: collapse;
  }

  .products-table thead {
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .products-table th {
    padding: 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .products-table tbody tr {
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    transition: all 0.2s;
  }

  .products-table tbody tr:hover {
    background: #f9fafb;
  }

  .products-table tbody tr.selected {
    background: #f0f4ff;
    border-left: 3px solid #281f51;
  }

  .products-table tbody tr.selected:hover {
    background: #e8f0ff;
  }

  .products-table td {
    padding: 1rem;
    font-size: 0.875rem;
    color: #374151;
  }

  .radio-cell {
    width: 50px;
    text-align: center;
  }

  .radio-wrapper {
    position: relative;
    display: inline-block;
  }

  .radio-wrapper input[type="radio"] {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .radio-custom {
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-radius: 50%;
    position: relative;
    transition: all 0.2s;
  }

  .radio-wrapper input[type="radio"]:checked + .radio-custom {
    border-color: #281f51;
    background: #281f51;
  }

  .radio-wrapper input[type="radio"]:checked + .radio-custom::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
  }

  .product-name-cell {
    font-weight: 500;
  }

  .product-name-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .product-icon-small {
    width: 36px;
    height: 36px;
    border-radius: 0.5rem;
    background: linear-gradient(135deg, #281f51 0%, #3d2f6a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .product-icon-small svg {
    width: 18px;
    height: 18px;
    stroke: white;
    stroke-width: 2;
  }

  .product-name-text {
    color: #111827;
    font-weight: 500;
  }

  .product-id-cell {
    font-family: "Monaco", "Courier New", monospace;
  }

  .product-id-code {
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: #4b5563;
    font-family: "Monaco", "Courier New", monospace;
  }

  .category-badge {
    padding: 0.25rem 0.75rem;
    background: #ede9fe;
    color: #6d28d9;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #e5e7eb;
    border-top-color: #281f51;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .spinner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pagination-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 1rem 0;
  }

  .pagination-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination-btn:hover:not(:disabled) {
    border-color: #281f51;
    background: #f8f7fb;
  }

  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pagination-btn svg {
    width: 18px;
    height: 18px;
    fill: #6b7280;
  }

  .pagination-numbers {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .pagination-number {
    min-width: 36px;
    height: 36px;
    padding: 0 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination-number:hover:not(:disabled):not(.active) {
    border-color: #281f51;
    background: #f8f7fb;
  }

  .pagination-number.active {
    border-color: #281f51;
    background: #281f51;
    color: white;
  }

  .pagination-number:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pagination-ellipsis {
    padding: 0 0.25rem;
    color: #9ca3af;
    font-weight: 500;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #6b7280;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #281f51;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  .empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    background: #f9fafb;
    border: 2px dashed #e5e7eb;
    border-radius: 0.75rem;
    color: #6b7280;
  }

  .empty-state-card svg {
    width: 64px;
    height: 64px;
    stroke: #d1d5db;
    margin-bottom: 1rem;
  }

  .empty-message {
    font-size: 1rem;
    font-weight: 500;
    color: #374151;
    margin: 0 0 0.5rem;
  }

  .empty-hint {
    font-size: 0.875rem;
    color: #9ca3af;
    margin: 0;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 3rem 0.875rem 3rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
  }

  .search-input.rtl {
    text-align: right;
    padding: 0.875rem 3rem 0.875rem 3rem;
  }

  .clear-search {
    position: absolute;
    right: 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .clear-search:hover {
    background: #f3f4f6;
  }

  .clear-search svg {
    width: 18px;
    height: 18px;
    color: #9ca3af;
  }

  .results-count {
    margin-top: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .variations-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #e5e7eb;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .section-header svg {
    width: 24px;
    height: 24px;
    stroke: #281f51;
  }

  .section-header h3 {
    font-size: 1.125rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .info-message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef3c7;
    border-radius: 0.5rem;
    border: 1px solid #fbbf24;
  }

  .info-message.warning {
    background: #fef3c7;
    border-color: #fbbf24;
  }

  .info-message svg {
    width: 20px;
    height: 20px;
    fill: #f59e0b;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .info-message p {
    margin: 0;
    font-size: 0.875rem;
    color: #92400e;
  }

  .warning-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .warning-subtitle {
    font-size: 0.8125rem;
    opacity: 0.9;
  }

  .none-icon {
    background: #f3f4f6 !important;
  }

  .none-icon svg {
    fill: #9ca3af !important;
  }

  .variants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }

  .variant-card {
    position: relative;
    padding: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .variant-card:hover {
    border-color: #281f51;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .variant-card.selected {
    border-color: #281f51;
    background: #f8f7fb;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
  }

  .variant-checkbox-hidden {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .variant-card-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .variant-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .color-swatch {
    width: 32px;
    height: 32px;
    border-radius: 0.5rem;
    border: 2px solid #e5e7eb;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .variant-icon {
    width: 32px;
    height: 32px;
    border-radius: 0.5rem;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .variant-icon svg {
    width: 18px;
    height: 18px;
    fill: #6b7280;
  }

  .check-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 0.2s ease;
  }

  @keyframes scaleIn {
    from {
      transform: scale(0);
    }
    to {
      transform: scale(1);
    }
  }

  .check-icon svg {
    width: 12px;
    height: 12px;
    fill: white;
  }

  .variant-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .variant-type {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .details-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: #f9fafb;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
  }

  .details-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem;
  }

  .details-table-wrapper {
    overflow-x: auto;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .details-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  .details-table thead {
    background: #f3f4f6;
  }

  .details-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }

  .details-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .details-table tbody tr:last-child td {
    border-bottom: none;
  }

  .variant-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-swatch-small {
    width: 20px;
    height: 20px;
    border-radius: 0.25rem;
    border: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .table-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .table-input:focus {
    outline: none;
    border-color: #281f51;
  }

  .modern-modal-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    background: #fafafa;
  }

  .btn-secondary {
    padding: 0.625rem 1.25rem;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-primary {
    padding: 0.625rem 1.25rem;
    border: none;
    background: linear-gradient(135deg, #281f51 0%, #3d2f6a 100%);
    color: white;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(40, 31, 81, 0.3);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

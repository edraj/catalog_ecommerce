<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    bundleForm: {
      selectedProducts: string[];
      price: string;
    };
    bundleProductSearch: string;
    bundleCategoryFilter: string;
    isLoadingSellerProducts: boolean;
    sellerProducts: any[];
    filteredSellerProducts: any[];
    productCategories: string[];
    onClose: () => void;
    onSubmit: () => void;
    onToggleProduct: (shortname: string) => void;
    onFilterProducts: () => void;
    getLocalizedDisplayName: (item: any) => string;
  };

  let {
    show = $bindable(),
    isRTL,
    bundleForm = $bindable(),
    bundleProductSearch = $bindable(),
    bundleCategoryFilter = $bindable(),
    isLoadingSellerProducts,
    sellerProducts,
    filteredSellerProducts,
    productCategories,
    onClose,
    onSubmit,
    onToggleProduct,
    onFilterProducts,
    getLocalizedDisplayName,
  }: Props = $props();
</script>

{#if show}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_bundle") || "Add Bundle"}
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
        <!-- Product Selection -->
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
              >{$_("seller_dashboard.select_products") ||
                "Select Products (min. 2)"}</span
            >
          </label>

          {#if isLoadingSellerProducts}
            <div class="loading-select">
              <div class="mini-spinner"></div>
              <span>{$_("seller_dashboard.loading") || "Loading..."}</span>
            </div>
          {:else if sellerProducts.length === 0}
            <p class="empty-message">
              {$_("seller_dashboard.no_products_found") ||
                "No products found. Create products first."}
            </p>
          {:else}
            <!-- Search and Filter Controls -->
            <div class="bundle-filters">
              <!-- Search Input -->
              <div class="bundle-search">
                <svg
                  class="search-icon-small"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="8" stroke-width="2" />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="m21 21-4.35-4.35"
                  />
                </svg>
                <input
                  type="text"
                  bind:value={bundleProductSearch}
                  oninput={onFilterProducts}
                  placeholder={$_("seller_dashboard.search_products") ||
                    "Search products..."}
                  class="bundle-search-input"
                  class:rtl={isRTL}
                />
                {#if bundleProductSearch}
                  <button
                    class="clear-search"
                    onclick={() => {
                      bundleProductSearch = "";
                      onFilterProducts();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                {/if}
              </div>

              <!-- Category Filter -->
              {#if productCategories.length > 0}
                <div class="bundle-category-filter">
                  <svg
                    class="filter-icon-small"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 4h18M3 8h12M3 12h6"
                    />
                  </svg>
                  <select
                    bind:value={bundleCategoryFilter}
                    onchange={onFilterProducts}
                    class="bundle-filter-select"
                    class:rtl={isRTL}
                  >
                    <option value="all"
                      >{$_("seller_dashboard.all_categories") ||
                        "All Categories"}</option
                    >
                    {#each productCategories as category}
                      <option value={category}>{category}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>

            <!-- Products List -->
            <div class="products-checkboxes">
              {#if filteredSellerProducts.length === 0}
                <p class="no-results-message">
                  {$_("seller_dashboard.no_products_match") ||
                    "No products match your search criteria"}
                </p>
              {:else}
                {#each filteredSellerProducts as product}
                  <label class="checkbox-item">
                    <input
                      type="checkbox"
                      checked={bundleForm.selectedProducts.includes(
                        product.shortname
                      )}
                      onchange={() => onToggleProduct(product.shortname)}
                      class="checkbox-input"
                    />
                    <span class="checkbox-label">
                      {getLocalizedDisplayName(product)}
                    </span>
                    <span class="checkbox-badge">
                      {product.shortname}
                    </span>
                  </label>
                {/each}
              {/if}
            </div>

            {#if bundleForm.selectedProducts.length > 0}
              <p class="selected-count">
                {bundleForm.selectedProducts.length}
                {bundleForm.selectedProducts.length === 1
                  ? "product"
                  : "products"} selected
                {#if bundleForm.selectedProducts.length < 2}
                  <span class="text-warning">(min. 2 required)</span>
                {/if}
              </p>
            {/if}
          {/if}
        </div>

        <!-- Price -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.bundle_price") || "Bundle Price"}</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={bundleForm.price}
            placeholder={$_("seller_dashboard.enter_price") || "Enter price"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={onSubmit}
          disabled={bundleForm.selectedProducts.length < 2 || !bundleForm.price}
        >
          {$_("seller_dashboard.add") || "Add"}
        </button>
      </div>
    </div>
  </div>
{/if}

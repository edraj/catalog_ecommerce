<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    itemToEdit: any;
    couponForm: {
      code: string;
      type: string;
      discountType: string;
      discountValue: string;
      minimumSpend: string;
      maximumAmount: string;
      maximumUses: string;
      maximumPerUser: string;
      validFrom: string;
      validTo: string;
      brandShortnames: string[];
    };
    discountForm?: {
      type: string;
      typeShortname: string;
      value: string;
      discountType: string;
      validFrom: string;
      validTo: string;
    };
    branchForm: {
      name: string;
      country: string;
      state: string;
      city: string;
      address: string;
    };
    bundleForm: {
      selectedProducts: string[];
      price: string;
    };
    brands?: any[];
    categories?: any[];
    isLoadingBrands?: boolean;
    isLoadingCategories?: boolean;
    isLoadingSellerProducts: boolean;
    sellerProducts: any[];
    onClose: () => void;
    onSubmit: () => void;
    onToggleProduct: (shortname: string) => void;
    getLocalizedDisplayName: (item: any, locale?: string) => string;
  };

  let {
    show = $bindable(),
    isRTL,
    itemToEdit,
    couponForm = $bindable(),
    discountForm = $bindable(),
    branchForm = $bindable(),
    bundleForm = $bindable(),
    brands = [],
    categories = [],
    isLoadingBrands = false,
    isLoadingCategories = false,
    isLoadingSellerProducts,
    sellerProducts,
    onClose,
    onSubmit,
    onToggleProduct,
    getLocalizedDisplayName,
  }: Props = $props();

  function toggleBrand(brandShortname: string) {
    if (couponForm.brandShortnames.includes(brandShortname)) {
      couponForm.brandShortnames = couponForm.brandShortnames.filter(
        (b) => b !== brandShortname
      );
    } else {
      couponForm.brandShortnames = [
        ...couponForm.brandShortnames,
        brandShortname,
      ];
    }
  }
</script>

{#if show && itemToEdit}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.edit_item") || "Edit Item"}
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
        {#if itemToEdit.subpath.includes("/coupons") || itemToEdit.subpath.includes("/coupons")}
          <!-- Coupon Edit Form - Same structure as Create -->
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.coupon_code") || "Coupon Code"} *</span
              >
            </label>
            <input
              type="text"
              bind:value={couponForm.code}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.coupon_type") || "Type"}</span>
            </label>
            <select
              bind:value={couponForm.type}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value="individual"
                >{$_("seller_dashboard.individual") || "Individual"}</option
              >
              <option value="bulk"
                >{$_("seller_dashboard.bulk") || "Bulk"}</option
              >
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.discount_type") ||
                    "Discount Type"}</span
                >
              </label>
              <select
                bind:value={couponForm.discountType}
                class="form-select"
                class:rtl={isRTL}
              >
                <option value="percentage"
                  >{$_("seller_dashboard.percentage") || "Percentage"}</option
                >
                <option value="fixed"
                  >{$_("seller_dashboard.fixed") || "Fixed Amount"}</option
                >
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.discount_value") || "Discount Value"} *</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.discountValue}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.minimum_spend") ||
                    "Minimum Spend"}</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.minimumSpend}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.maximum_amount") ||
                    "Maximum Amount"}</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.maximumAmount}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.maximum_uses") ||
                    "Maximum Total Uses"}</span
                >
              </label>
              <input
                type="number"
                min="1"
                bind:value={couponForm.maximumUses}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.maximum_per_user") ||
                    "Maximum Per User"}</span
                >
              </label>
              <input
                type="number"
                min="1"
                bind:value={couponForm.maximumPerUser}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.valid_from") || "Valid From"} *</span
                >
              </label>
              <input
                type="date"
                bind:value={couponForm.validFrom}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span>{$_("seller_dashboard.valid_to") || "Valid To"} *</span>
              </label>
              <input
                type="date"
                bind:value={couponForm.validTo}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.applies_to_brands") ||
                  "Applies To Brands"}</span
              >
            </label>
            {#if isLoadingBrands}
              <p class="loading-text">Loading brands...</p>
            {:else if brands && brands.length > 0}
              <div class="brands-list">
                {#each brands.slice(0, 20) as brand (brand.shortname)}
                  <label class="brand-checkbox">
                    <input
                      type="checkbox"
                      checked={couponForm.brandShortnames.includes(
                        brand.shortname
                      )}
                      onchange={() => toggleBrand(brand.shortname)}
                    />
                    <span class:rtl={isRTL}>
                      {getLocalizedDisplayName(brand, "en")}
                    </span>
                  </label>
                {/each}
              </div>
            {:else}
              <p class="info-text">No brands available</p>
            {/if}
          </div>
        {:else if itemToEdit.subpath.includes("/discounts")}
          <!-- Discount Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.discount_applies_to") ||
                  "Discount Applies To"}</span
              >
            </label>
            <select
              bind:value={discountForm.type}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value=""
                >{$_("seller_dashboard.general_discount") ||
                  "General Discount (All)"}</option
              >
              <option value="brand"
                >{$_("seller_dashboard.brand") || "Brand"}</option
              >
              <option value="category"
                >{$_("seller_dashboard.category") || "Category"}</option
              >
              <option value="product"
                >{$_("seller_dashboard.product") || "Product"}</option
              >
            </select>
          </div>

          {#if discountForm.type === "brand"}
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.select_brand") || "Select Brand"}</span
                >
              </label>
              {#if isLoadingBrands}
                <p class="loading-text">Loading brands...</p>
              {:else}
                <select
                  bind:value={discountForm.typeShortname}
                  class="form-select"
                  class:rtl={isRTL}
                >
                  <option value=""
                    >{$_("seller_dashboard.choose_brand") ||
                      "Choose a brand..."}</option
                  >
                  {#each brands as brand (brand.shortname)}
                    <option value={brand.shortname}>
                      {getLocalizedDisplayName(brand)}
                    </option>
                  {/each}
                </select>
              {/if}
            </div>
          {:else if discountForm.type === "category"}
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.select_category") ||
                    "Select Category"}</span
                >
              </label>
              {#if isLoadingCategories}
                <p class="loading-text">Loading categories...</p>
              {:else}
                <select
                  bind:value={discountForm.typeShortname}
                  class="form-select"
                  class:rtl={isRTL}
                >
                  <option value=""
                    >{$_("seller_dashboard.choose_category") ||
                      "Choose a category..."}</option
                  >
                  {#each categories as category (category.shortname)}
                    <option value={category.shortname}>
                      {getLocalizedDisplayName(category)}
                    </option>
                  {/each}
                </select>
              {/if}
            </div>
          {:else if discountForm.type === "product"}
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.product_shortname") ||
                    "Product Shortname"}</span
                >
              </label>
              <input
                type="text"
                bind:value={discountForm.typeShortname}
                class="form-input"
                class:rtl={isRTL}
                placeholder={$_("seller_dashboard.enter_product_shortname") ||
                  "Enter product shortname..."}
              />
            </div>
          {/if}

          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.discount_calculation_type") ||
                  "Discount Type"} *</span
              >
            </label>
            <select
              bind:value={discountForm.discountType}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value="percentage"
                >{$_("seller_dashboard.percentage_discount") ||
                  "Percentage (%)"}</option
              >
              <option value="amount"
                >{$_("seller_dashboard.fixed_amount_discount") ||
                  "Fixed Amount (IQD)"}</option
              >
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{discountForm.discountType === "percentage"
                  ? $_("seller_dashboard.discount_value_percentage") ||
                    "Discount Value (%)"
                  : $_("seller_dashboard.discount_value_amount") ||
                    "Discount Amount (IQD)"} *</span
              >
            </label>
            <input
              type="number"
              min={discountForm.discountType === "percentage" ? "1" : "100"}
              max={discountForm.discountType === "percentage" ? "100" : ""}
              step={discountForm.discountType === "percentage" ? "1" : "100"}
              bind:value={discountForm.value}
              class="form-input"
              class:rtl={isRTL}
              placeholder={discountForm.discountType === "percentage"
                ? $_("seller_dashboard.enter_discount_percentage") ||
                  "Enter discount percentage (e.g., 10 for 10%)..."
                : $_("seller_dashboard.enter_discount_amount") ||
                  "Enter discount amount (e.g., 5000 IQD)..."}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span
                  >{$_("seller_dashboard.valid_from") || "Valid From"} *</span
                >
              </label>
              <input
                type="date"
                bind:value={discountForm.validFrom}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={isRTL}>
                <span>{$_("seller_dashboard.valid_to") || "Valid To"} *</span>
              </label>
              <input
                type="date"
                bind:value={discountForm.validTo}
                class="form-input"
                class:rtl={isRTL}
              />
            </div>
          </div>
        {:else if itemToEdit.subpath.includes("/branch")}
          <!-- Branch Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.branch_name") || "Branch Name"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.name}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.country") || "Country"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.country}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.state") || "State (Optional)"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.state}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.city") || "City"}</span>
            </label>
            <input
              type="text"
              bind:value={branchForm.city}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.address") || "Address"}</span>
            </label>
            <textarea
              bind:value={branchForm.address}
              class="form-textarea"
              class:rtl={isRTL}
              rows="3"
            ></textarea>
          </div>
        {:else if itemToEdit.subpath.includes("/bundles")}
          <!-- Bundle Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
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
              <p class="empty-message">No products found</p>
            {:else}
              <div class="products-checkboxes">
                {#each sellerProducts as product}
                  <label class="checkbox-item">
                    <input
                      type="checkbox"
                      checked={bundleForm.selectedProducts.includes(
                        product.shortname
                      )}
                      onchange={() => onToggleProduct(product.shortname)}
                      class="checkbox-input"
                    />
                    <span class="checkbox-label"
                      >{getLocalizedDisplayName(product)}</span
                    >
                  </label>
                {/each}
              </div>
              {#if bundleForm.selectedProducts.length > 0}
                <p class="selected-count">
                  {bundleForm.selectedProducts.length} products selected
                  {#if bundleForm.selectedProducts.length < 2}
                    <span class="text-warning">(min. 2 required)</span>
                  {/if}
                </p>
              {/if}
            {/if}
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.bundle_price") || "Bundle Price"}</span
              >
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={bundleForm.price}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button class="modal-button submit" onclick={onSubmit}>
          {$_("seller_dashboard.save") || "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .brands-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .brand-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    cursor: pointer;
  }

  .brand-checkbox input[type="checkbox"] {
    cursor: pointer;
  }

  .loading-text,
  .info-text {
    font-size: 0.875rem;
    color: #666;
    padding: 0.5rem;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

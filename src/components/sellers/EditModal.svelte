<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    itemToEdit: any;
    couponForm: {
      type: string;
      minValue: string;
      maxValue: string;
      amount: string;
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
    isLoadingSellerProducts: boolean;
    sellerProducts: any[];
    onClose: () => void;
    onSubmit: () => void;
    onToggleProduct: (shortname: string) => void;
    getLocalizedDisplayName: (item: any) => string;
  };

  let {
    show = $bindable(),
    isRTL,
    itemToEdit,
    couponForm = $bindable(),
    branchForm = $bindable(),
    bundleForm = $bindable(),
    isLoadingSellerProducts,
    sellerProducts,
    onClose,
    onSubmit,
    onToggleProduct,
    getLocalizedDisplayName,
  }: Props = $props();
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
        {#if itemToEdit.subpath.includes("/coupons")}
          <!-- Coupon Edit Form -->
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.coupon_type") || "Type"}</span>
            </label>
            <select
              bind:value={couponForm.type}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value="value"
                >{$_("seller_dashboard.value") || "Value"}</option
              >
              <option value="percentage"
                >{$_("seller_dashboard.percentage") || "Percentage"}</option
              >
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.min_value") || "Minimum Value"}</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.minValue}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.max_value") ||
                  "Maximum Value (Optional)"}</span
              >
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.maxValue}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.amount") || "Amount"}</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.amount}
              class="form-input"
              class:rtl={isRTL}
            />
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

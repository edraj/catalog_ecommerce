<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
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
    brands?: any[];
    isLoadingBrands?: boolean;
    onClose: () => void;
    onSubmit: () => void;
    getLocalizedDisplayName?: (item: any, locale: string) => string;
  };

  let {
    show = $bindable(),
    isRTL,
    couponForm = $bindable(),
    brands = [],
    isLoadingBrands = false,
    onClose,
    onSubmit,
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

{#if show}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_coupon") || "Create Coupon"}
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
        <!-- Coupon Code -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.coupon_code") || "Coupon Code"} *</span>
          </label>
          <input
            type="text"
            bind:value={couponForm.code}
            placeholder="e.g., SELLER15, SAVE20"
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- Coupon Type -->
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
            <option value="bulk">{$_("seller_dashboard.bulk") || "Bulk"}</option
            >
          </select>
        </div>

        <!-- Discount Type & Value -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.discount_type") || "Discount Type"}</span
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
              max={couponForm.discountType === "percentage" ? "100" : undefined}
              bind:value={couponForm.discountValue}
              placeholder={couponForm.discountType === "percentage"
                ? "e.g., 15"
                : "e.g., 10.00"}
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
        </div>

        <!-- Minimum Spend & Maximum Amount -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.minimum_spend") || "Minimum Spend"}</span
              >
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={couponForm.minimumSpend}
              placeholder="e.g., 30.00"
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
              placeholder="e.g., 50.00"
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
        </div>

        <!-- Usage Limits -->
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
              placeholder="e.g., 200"
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
              placeholder="e.g., 1"
              class="form-input"
              class:rtl={isRTL}
            />
          </div>
        </div>

        <!-- Validity Dates -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.valid_from") || "Valid From"} *</span>
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

        <!-- Applies To Brands -->
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
                    {getLocalizedDisplayName
                      ? getLocalizedDisplayName(brand, "en")
                      : brand.shortname}
                  </span>
                </label>
              {/each}
            </div>
          {:else}
            <p class="info-text">No brands available</p>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={onSubmit}
          disabled={!couponForm.code ||
            !couponForm.discountValue ||
            !couponForm.validFrom ||
            !couponForm.validTo}
        >
          {$_("seller_dashboard.create") || "Create"}
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
    gap: 0.75rem;
    max-height: 200px;
    overflow-y: auto;
    padding: 1rem;
    background: #f7fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .brand-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .brand-checkbox:hover {
    background: #edf2f7;
  }

  .brand-checkbox input[type="checkbox"] {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
    accent-color: #667eea;
  }

  .brand-checkbox span {
    font-size: 0.9rem;
    color: #2d3748;
  }

  .brand-checkbox span.rtl {
    text-align: right;
  }

  .loading-text,
  .info-text {
    color: #718096;
    font-size: 0.9rem;
    margin: 0;
    padding: 1rem;
    text-align: center;
    background: #f7fafc;
    border-radius: 8px;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .brands-list {
      grid-template-columns: 1fr;
    }
  }
</style>

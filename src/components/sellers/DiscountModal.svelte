<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    discountForm: {
      type: string;
      typeShortname: string;
      value: string;
      validFrom: string;
      validTo: string;
    };
    brands: any[];
    categories: any[];
    isLoadingBrands: boolean;
    isLoadingCategories: boolean;
    onClose: () => void;
    onSubmit: () => void;
    getLocalizedDisplayName: (item: any) => string;
  };

  let {
    show = $bindable(),
    isRTL,
    discountForm = $bindable(),
    brands = [],
    categories = [],
    isLoadingBrands = false,
    isLoadingCategories = false,
    onClose,
    onSubmit,
    getLocalizedDisplayName,
  }: Props = $props();

  function handleSubmit(e: Event) {
    e.preventDefault();
    onSubmit();
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={onClose}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={isRTL}>
          {$_("seller_dashboard.create_discount") || "Create Discount"}
        </h2>
        <button class="modal-close-button" onclick={onClose}>
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

      <form class="modal-body" onsubmit={handleSubmit}>
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span
              >{$_("seller_dashboard.discount_type") || "Discount Type"} *</span
            >
          </label>
          <select
            bind:value={discountForm.type}
            class="form-select"
            class:rtl={isRTL}
            required
          >
            <option value=""
              >{$_("seller_dashboard.select_type") || "Select Type"}</option
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
                >{$_("seller_dashboard.select_brand") || "Select Brand"} *</span
              >
            </label>
            {#if isLoadingBrands}
              <p class="loading-text">Loading brands...</p>
            {:else}
              <select
                bind:value={discountForm.typeShortname}
                class="form-select"
                class:rtl={isRTL}
                required
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
                >{$_("seller_dashboard.select_category") || "Select Category"} *</span
              >
            </label>
            {#if isLoadingCategories}
              <p class="loading-text">Loading categories...</p>
            {:else}
              <select
                bind:value={discountForm.typeShortname}
                class="form-select"
                class:rtl={isRTL}
                required
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
                  "Product Shortname"} *</span
              >
            </label>
            <input
              type="text"
              bind:value={discountForm.typeShortname}
              class="form-input"
              class:rtl={isRTL}
              placeholder={$_("seller_dashboard.enter_product_shortname") ||
                "Enter product shortname..."}
              required
            />
          </div>
        {/if}

        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span
              >{$_("seller_dashboard.discount_value") || "Discount Value (%)"} *</span
            >
          </label>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            bind:value={discountForm.value}
            class="form-input"
            class:rtl={isRTL}
            placeholder={$_("seller_dashboard.enter_discount_value") ||
              "Enter discount percentage..."}
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span>{$_("seller_dashboard.valid_from") || "Valid From"} *</span>
            </label>
            <input
              type="date"
              bind:value={discountForm.validFrom}
              class="form-input"
              class:rtl={isRTL}
              required
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
              required
            />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="modal-button cancel" onclick={onClose}>
            {$_("seller_dashboard.cancel") || "Cancel"}
          </button>
          <button type="submit" class="modal-button submit">
            {$_("seller_dashboard.create") || "Create"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .loading-text {
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

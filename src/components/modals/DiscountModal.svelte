<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";

  type Props = {
    show: boolean;
    isRTL: boolean;
    discountForm: {
      sellerShortname: string;
      type: string;
      typeShortname: string;
      value: string;
      discountType: string;
      validFrom: string;
      validTo: string;
    };
    sellers: any[];
    brands: any[];
    categories: any[];
    isLoadingBrands: boolean;
    isLoadingCategories: boolean;
    onClose: () => void;
    onSubmit: () => void;
    getLocalizedDisplayName: (item: any) => string;
    isEditMode?: boolean;
  };

  let {
    show = $bindable(),
    isRTL,
    discountForm = $bindable(),
    sellers = [],
    brands = [],
    categories = [],
    isLoadingBrands = false,
    isLoadingCategories = false,
    onClose,
    onSubmit,
    getLocalizedDisplayName,
    isEditMode = false,
  }: Props = $props();

  function handleSubmit(event?: Event) {
    event?.preventDefault();
    onSubmit();
  }
</script>

<Modal
  bind:show
  size="small"
  title={isEditMode
    ? $_("seller_dashboard.edit_discount") || "Edit Discount"
    : $_("seller_dashboard.create_discount") || "Create Discount"}
  {onClose}
>
  {#snippet body()}
    <div class="discount-form">
      <!-- SELLER SELECTION -->
      <div class="form-group">
        <label class="form-label" class:rtl={isRTL}>
          <span>
            {$_("admin.seller") || "Seller"} *
          </span>
        </label>
        <select
          bind:value={discountForm.sellerShortname}
          class="form-select"
          class:rtl={isRTL}
          disabled={isEditMode}
          required
        >
          <option value="">
            {$_("admin.choose_seller") || "Choose a seller..."}
          </option>
          {#each sellers as seller (seller.shortname)}
            <option value={seller.shortname}>
              {getLocalizedDisplayName(seller)}
            </option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" class:rtl={isRTL}>
          <span>
            {$_("seller_dashboard.discount_applies_to") ||
              "Discount Applies To"}
          </span>
        </label>
        <select
          bind:value={discountForm.type}
          class="form-select"
          class:rtl={isRTL}
        >
          <option value="">
            {$_("seller_dashboard.general_discount") ||
              "General Discount (All)"}
          </option>
          <option value="brand">
            {$_("seller_dashboard.brand") || "Brand"}
          </option>
          <option value="category">
            {$_("seller_dashboard.category") || "Category"}
          </option>
          <option value="product">
            {$_("seller_dashboard.product") || "Product"}
          </option>
        </select>
      </div>

      {#if discountForm.type === "brand"}
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>
              {$_("seller_dashboard.select_brand") || "Select Brand"} *
            </span>
          </label>
          {#if isLoadingBrands}
            <p class="loading-text">Loading brands...</p>
          {:else}
            <select
              bind:value={discountForm.typeShortname}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value="">
                {$_("seller_dashboard.choose_brand") || "Choose a brand..."}
              </option>
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
            <span>
              {$_("seller_dashboard.select_category") || "Select Category"} *
            </span>
          </label>
          {#if isLoadingCategories}
            <p class="loading-text">Loading categories...</p>
          {:else}
            <select
              bind:value={discountForm.typeShortname}
              class="form-select"
              class:rtl={isRTL}
            >
              <option value="">
                {$_("seller_dashboard.choose_category") ||
                  "Choose a category..."}
              </option>
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
            <span>
              {$_("seller_dashboard.product_shortname") || "Product Shortname"} *
            </span>
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
          <span>
            {$_("seller_dashboard.discount_calculation_type") ||
              "Discount Type"} *
          </span>
        </label>
        <select
          bind:value={discountForm.discountType}
          class="form-select"
          class:rtl={isRTL}
          required
        >
          <option value="percentage">
            {$_("seller_dashboard.percentage_discount") || "Percentage (%)"}
          </option>
          <option value="amount">
            {$_("seller_dashboard.fixed_amount_discount") ||
              "Fixed Amount (IQD)"}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" class:rtl={isRTL}>
          <span>
            {discountForm.discountType === "percentage"
              ? $_("seller_dashboard.discount_value_percentage") ||
                "Discount Value (%)"
              : $_("seller_dashboard.discount_value_amount") ||
                "Discount Amount (IQD)"} *
          </span>
        </label>
        <input
          type="number"
          min={discountForm.discountType === "percentage" ? "1" : "100"}
          max={discountForm.discountType === "percentage" ? "100" : ""}
          step={discountForm.discountType === "percentage" ? "1" : "100"}
          bind:value={discountForm.value}
          oninput={(e) => {
            if (discountForm.discountType === "percentage") {
              const val = parseFloat(e.currentTarget.value);
              if (val > 100) e.currentTarget.value = "100";
              if (val < 0) e.currentTarget.value = "0";
            }
          }}
          class="form-input"
          class:rtl={isRTL}
          placeholder={discountForm.discountType === "percentage"
            ? $_("seller_dashboard.enter_discount_percentage") ||
              "Enter discount percentage (e.g., 10 for 10%)..."
            : $_("seller_dashboard.enter_discount_amount") ||
              "Enter discount amount (e.g., 5000 IQD)..."}
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
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="primary" class="w-full" onclick={handleSubmit}>
      {isEditMode
        ? $_("common.save") || "Save"
        : $_("seller_dashboard.create") || "Create"}
    </Button>
  {/snippet}
</Modal>

<style>
  .discount-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    color: #1a1a1a;
    transition: all 0.2s;
    box-sizing: border-box;
    font-family: inherit;
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
  }

  .form-input.rtl,
  .form-select.rtl {
    direction: rtl;
    text-align: right;
  }

  .form-select:disabled {
    background-color: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .loading-text {
    font-size: 0.875rem;
    color: #666;
    padding: 0.5rem 0;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

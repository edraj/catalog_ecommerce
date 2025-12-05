<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    selectedCategory: string;
    categories: any[];
    isLoadingCategories: boolean;
    variationProducts: any[];
    isLoadingVariationProducts: boolean;
    variationRequestForm: {
      product: string;
      variations: Array<{ attribute_name: string; attribute_value: string }>;
      justification: string;
    };
    onClose: () => void;
    onSubmit: () => void;
    onCategoryChange: () => void;
    onAddAttribute: () => void;
    onRemoveAttribute: (index: number) => void;
    getLocalizedDisplayName: (item: any) => string;
  };

  let {
    show = $bindable(),
    isRTL,
    selectedCategory = $bindable(),
    categories,
    isLoadingCategories,
    variationProducts,
    isLoadingVariationProducts,
    variationRequestForm = $bindable(),
    onClose,
    onSubmit,
    onCategoryChange,
    onAddAttribute,
    onRemoveAttribute,
    getLocalizedDisplayName,
  }: Props = $props();
</script>

{#if show}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.request_variation") || "Request New Variation"}
        </h2>
        <button class="modal-close" onclick={onClose} aria-label="Close">
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span>{$_("seller_dashboard.category") || "Category"}</span>
          </label>
          <select
            bind:value={selectedCategory}
            onchange={onCategoryChange}
            class="form-select"
            class:rtl={isRTL}
            disabled={isLoadingCategories}
          >
            <option value=""
              >{$_("seller_dashboard.select_category") ||
                "Select a category"}</option
            >
            {#if isLoadingCategories}
              <option disabled
                >{$_("seller_dashboard.loading") || "Loading..."}</option
              >
            {:else}
              {#each categories as category (category.shortname)}
                <option value={category.shortname}>
                  {getLocalizedDisplayName(category)}
                </option>
              {/each}
            {/if}
          </select>
        </div>

        {#if selectedCategory}
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
              <span>{$_("seller_dashboard.product") || "Product"}</span>
            </label>
            <select
              bind:value={variationRequestForm.product}
              class="form-select"
              class:rtl={isRTL}
              disabled={isLoadingVariationProducts}
            >
              <option value=""
                >{$_("seller_dashboard.select_product") ||
                  "Select a product"}</option
              >
              {#if isLoadingVariationProducts}
                <option disabled
                  >{$_("seller_dashboard.loading") || "Loading..."}</option
                >
              {:else}
                {#each variationProducts as product (product.shortname)}
                  <option value={product.shortname}>
                    {getLocalizedDisplayName(product)}
                  </option>
                {/each}
              {/if}
            </select>
          </div>
        {/if}

        {#if variationRequestForm.product}
          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.requested_variations") ||
                  "Requested Variations"}</span
              >
            </label>

            {#each variationRequestForm.variations as variation, index}
              <div class="variation-attribute-row">
                <input
                  type="text"
                  bind:value={variation.attribute_name}
                  placeholder={$_("seller_dashboard.attribute_name") ||
                    "Attribute Name (e.g., Size, Color)"}
                  class="form-input variation-input"
                  class:rtl={isRTL}
                />
                <input
                  type="text"
                  bind:value={variation.attribute_value}
                  placeholder={$_("seller_dashboard.attribute_value") ||
                    "Value (e.g., Large, Red)"}
                  class="form-input variation-input"
                  class:rtl={isRTL}
                />
                {#if variationRequestForm.variations.length > 1}
                  <button
                    class="remove-attribute-btn"
                    onclick={() => onRemoveAttribute(index)}
                    aria-label="Remove"
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
            {/each}

            <button class="add-attribute-btn" onclick={onAddAttribute}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span
                >{$_("seller_dashboard.add_attribute") ||
                  "Add Another Attribute"}</span
              >
            </button>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={isRTL}>
              <span
                >{$_("seller_dashboard.justification") || "Justification"}</span
              >
            </label>
            <textarea
              bind:value={variationRequestForm.justification}
              placeholder={$_("seller_dashboard.justification_placeholder") ||
                "Explain why this variation is needed..."}
              class="form-textarea"
              class:rtl={isRTL}
              rows="4"
            ></textarea>
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
          disabled={!variationRequestForm.product ||
            variationRequestForm.variations.some(
              (v) => !v.attribute_name || !v.attribute_value
            ) ||
            !variationRequestForm.justification}
        >
          {$_("seller_dashboard.submit_request") || "Submit Request"}
        </button>
      </div>
    </div>
  </div>
{/if}

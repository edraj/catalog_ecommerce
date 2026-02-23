<script lang="ts">
  import { _, locale } from "@/i18n";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";

  interface Props {
    show: boolean;
    form: any;
    sellers: any[];
    categories: any[];
    brands: any[];
    isLoading: boolean;
    isEditMode: boolean;
    sellerDisabled?: boolean;
    onClose: () => void;
    onSubmit: () => void;
  }

  let {
    show = $bindable(),
    form = $bindable(),
    sellers = [],
    categories = [],
    brands = [],
    isLoading = false,
    isEditMode = false,
    sellerDisabled = false,
    onClose,
    onSubmit,
  }: Props = $props();

  let brandSearch = $state("");
  let categorySearch = $state("");
  let showBrandDropdown = $state(false);
  let showCategoryDropdown = $state(false);

  let filteredBrands = $derived.by(() => {
    if (!brandSearch) return brands;
    return brands.filter((b) =>
      (getLocalizedDisplayName(b, $locale) || b.shortname)
        .toLowerCase()
        .includes(brandSearch.toLowerCase()),
    );
  });

  let filteredCategories = $derived.by(() => {
    if (!categorySearch) return categories;
    return categories.filter((c) =>
      (getLocalizedDisplayName(c, $locale) || c.shortname)
        .toLowerCase()
        .includes(categorySearch.toLowerCase()),
    );
  });

  function toggleBrand(brandShortname: string) {
    if (!form.brand_shortnames) form.brand_shortnames = [];

    const index = form.brand_shortnames.indexOf(brandShortname);
    if (index > -1) {
      form.brand_shortnames.splice(index, 1);
    } else {
      form.brand_shortnames = [...form.brand_shortnames, brandShortname];
    }
  }

  function toggleCategory(categoryShortname: string) {
    if (!form.category_shortnames) form.category_shortnames = [];

    const index = form.category_shortnames.indexOf(categoryShortname);
    if (index > -1) {
      form.category_shortnames.splice(index, 1);
    } else {
      form.category_shortnames = [
        ...form.category_shortnames,
        categoryShortname,
      ];
    }
  }

  function removeBrand(brandShortname: string) {
    if (form.brand_shortnames) {
      form.brand_shortnames = form.brand_shortnames.filter(
        (b: string) => b !== brandShortname,
      );
    }
  }

  function removeCategory(categoryShortname: string) {
    if (form.category_shortnames) {
      form.category_shortnames = form.category_shortnames.filter(
        (c: string) => c !== categoryShortname,
      );
    }
  }

  function getBrandDisplayName(brand: any): string {
    return getLocalizedDisplayName(brand, $locale) || brand.shortname || "";
  }

  function getCategoryDisplayName(category: any): string {
    return (
      getLocalizedDisplayName(category, $locale) || category.shortname || ""
    );
  }

  function handleClose() {
    show = false;
    onClose();
  }

  function handleSubmit() {
    onSubmit();
  }

  function handleBrandInputClick(e: MouseEvent) {
    e.stopPropagation();
    showBrandDropdown = !showBrandDropdown;
  }

  function handleCategoryInputClick(e: MouseEvent) {
    e.stopPropagation();
    showCategoryDropdown = !showCategoryDropdown;
  }

  function handleDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Close dropdowns if clicked outside
    if (!target.closest(".brand-container")) {
      showBrandDropdown = false;
    }
    if (!target.closest(".category-container")) {
      showCategoryDropdown = false;
    }
  }

  $effect(() => {
    if (show) {
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }
  });
</script>

{#if show}
  <div
    class="modal-overlay"
    role="presentation"
    onclick={handleClose}
    onkeydown={(e) => e.key === "Escape" && handleClose()}
  >
    <div
      class="modal-content"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="modal-header">
        <h2>
          {isEditMode
            ? $_("admin.edit_shipping_note") || "Edit Shipping Note"
            : $_("admin.create_shipping_note") || "Create Shipping Note"}
        </h2>
        <button
          type="button"
          class="close-btn"
          onclick={handleClose}
          aria-label="Close"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Seller Selection -->
        {#if !isEditMode}
          <div class="form-group">
            <label for="seller-select">
              {$_("admin.seller") || "Seller"} <span class="required">*</span>
            </label>
            <select
              id="seller-select"
              bind:value={form.sellerShortname}
              disabled={sellerDisabled || isEditMode}
              class="form-select"
            >
              <option value="">
                {$_("admin.choose_seller") || "Choose a seller..."}
              </option>
              {#each sellers as seller}
                <option value={seller.shortname}>
                  {getLocalizedDisplayName(seller, $locale)}
                </option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Shipping Note (EN) -->
        <div class="form-group">
          <label for="note-en">
            {$_("admin.shipping_note_en") || "Shipping Note (English)"}
            <span class="required">*</span>
          </label>
          <textarea
            id="note-en"
            bind:value={form.shipping_note_en}
            placeholder={$_("admin.enter_shipping_note") ||
              "Enter shipping note..."}
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>

        <!-- Shipping Note (AR) -->
        <div class="form-group">
          <label for="note-ar">
            {$_("admin.shipping_note_ar") || "Shipping Note (Arabic)"}
          </label>
          <textarea
            id="note-ar"
            bind:value={form.shipping_note_ar}
            placeholder="أدخل ملاحظة الشحن..."
            class="form-textarea"
            rows="3"
          ></textarea>
        </div>

        <!-- Selected Brands and Categories Display -->
        <div class="selected-items">
          {#if form.brand_shortnames && form.brand_shortnames.length > 0}
            <div class="selected-section">
              <div class="selected-label">
                {$_("admin.selected_brands") || "Selected Brands"}:
              </div>
              <div class="selected-tags">
                {#each form.brand_shortnames as brandShortname}
                  <div class="tag">
                    {brands.find((b) => b.shortname === brandShortname)
                      ? getBrandDisplayName(
                          brands.find((b) => b.shortname === brandShortname),
                        )
                      : brandShortname}
                    <button
                      type="button"
                      onclick={() => removeBrand(brandShortname)}
                      class="tag-remove"
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if form.category_shortnames && form.category_shortnames.length > 0}
            <div class="selected-section">
              <div class="selected-label">
                {$_("admin.selected_categories") || "Selected Categories"}:
              </div>
              <div class="selected-tags">
                {#each form.category_shortnames as categoryShortname}
                  <div class="tag">
                    {categories.find((c) => c.shortname === categoryShortname)
                      ? getCategoryDisplayName(
                          categories.find(
                            (c) => c.shortname === categoryShortname,
                          ),
                        )
                      : categoryShortname}
                    <button
                      type="button"
                      onclick={() => removeCategory(categoryShortname)}
                      class="tag-remove"
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Brands Selection -->
        <div class="form-group">
          <label for="brand-search">
            {$_("admin.brands") || "Brands"}
            <span class="required">*</span>
            <span class="note">
              ({$_("admin.at_least_one") ||
                "at least one brand or category required"})
            </span>
          </label>
          <div class="multiselect-container brand-container">
            <input
              id="brand-search"
              type="text"
              placeholder={$_("admin.search_brands") || "Search brands..."}
              bind:value={brandSearch}
              onfocus={() => (showBrandDropdown = true)}
              onclick={handleBrandInputClick}
              class="multiselect-input"
            />
            {#if showBrandDropdown && filteredBrands.length > 0}
              <div class="multiselect-dropdown">
                {#each filteredBrands as brand}
                  <label class="multiselect-option">
                    <input
                      type="checkbox"
                      checked={form.brand_shortnames?.includes(brand.shortname)}
                      onchange={() => toggleBrand(brand.shortname)}
                      onclick={(e) => e.stopPropagation()}
                      onkeydown={(e) => e.stopPropagation()}
                    />
                    <span>{getBrandDisplayName(brand)}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Categories Selection -->
        <div class="form-group">
          <label for="category-search">
            {$_("admin.categories") || "Categories"}
            <span class="required">*</span>
            <span class="note">
              ({$_("admin.at_least_one") ||
                "at least one brand or category required"})
            </span>
          </label>
          <div class="multiselect-container category-container">
            <input
              id="category-search"
              type="text"
              placeholder={$_("admin.search_categories") ||
                "Search categories..."}
              bind:value={categorySearch}
              onfocus={() => (showCategoryDropdown = true)}
              onclick={handleCategoryInputClick}
              class="multiselect-input"
            />
            {#if showCategoryDropdown && filteredCategories.length > 0}
              <div class="multiselect-dropdown">
                {#each filteredCategories as category}
                  <label class="multiselect-option">
                    <input
                      type="checkbox"
                      checked={form.category_shortnames?.includes(
                        category.shortname,
                      )}
                      onchange={() => toggleCategory(category.shortname)}
                      onclick={(e) => e.stopPropagation()}
                      onkeydown={(e) => e.stopPropagation()}
                    />
                    <span>{getCategoryDisplayName(category)}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button
          type="button"
          class="btn-secondary"
          onclick={handleClose}
          disabled={isLoading}
        >
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          type="button"
          class="btn-primary"
          onclick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading
            ? $_("common.saving") || "Saving..."
            : isEditMode
              ? $_("common.update") || "Update"
              : $_("common.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal-content {
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background-color: transparent;
    color: #6b7280;
    cursor: pointer;
    border-radius: 6px;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .modal-body {
    padding: 24px;
    flex: 1;
    overflow-y: auto;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 16px 24px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
    background-color: #f9fafb;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .required {
    color: #dc2626;
  }

  .note {
    font-size: 12px;
    color: #6b7280;
    font-weight: 400;
  }

  .form-select,
  .form-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    color: #1f2937;
    background-color: #fff;
    transition: border-color 0.2s;
  }

  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3c307f;
    box-shadow: 0 0 0 1px #3c307f;
  }

  .form-select:disabled {
    background-color: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .selected-items {
    margin-bottom: 20px;
    padding: 16px;
    background-color: #f9fafb;
    border-radius: 8px;
  }

  .selected-section {
    margin-bottom: 12px;
  }

  .selected-section:last-child {
    margin-bottom: 0;
  }

  .selected-label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background-color: #ede9fe;
    color: #3c307f;
    border-radius: 6px;
    font-size: 12px;
    max-width: 200px;
  }

  .tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    background-color: transparent;
    color: #3c307f;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    transition: background-color 0.2s;
    border-radius: 3px;
  }

  .tag-remove:hover {
    background-color: rgba(60, 48, 127, 0.2);
  }

  .multiselect-container {
    position: relative;
    z-index: 10;
  }

  .brand-container {
    position: relative;
    z-index: 20;
  }

  .category-container {
    position: relative;
    z-index: 10;
  }

  .multiselect-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    color: #1f2937;
    background-color: #fff;
  }

  .multiselect-input:focus {
    outline: none;
    border-color: #3c307f;
  }

  .multiselect-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background-color: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .multiselect-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background-color 0.2s;
    border-bottom: 1px solid #f3f4f6;
  }

  .multiselect-option:last-child {
    border-bottom: none;
  }

  .multiselect-option:hover {
    background-color: #f9fafb;
  }

  .multiselect-option input {
    cursor: pointer;
  }

  .multiselect-option span {
    flex: 1;
    font-size: 14px;
    color: #374151;
  }

  .btn-primary,
  .btn-secondary {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background-color: #3c307f;
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2f2666;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #e5e7eb;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #d1d5db;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .modal-overlay {
      padding: 0;
    }

    .modal-content {
      max-width: 100%;
      border-radius: 12px;
      max-height: 100vh;
    }

    .modal-body {
      padding: 16px;
    }

    .modal-footer {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
    }
  }
</style>

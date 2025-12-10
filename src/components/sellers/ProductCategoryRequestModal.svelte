<script lang="ts">
  import { _ } from "@/i18n";

  let {
    show = $bindable(false),
    isRTL = false,
    categories = [],
    brands = [],
    isLoadingCategories = false,
    isLoadingBrands = false,
    requestType = $bindable("product"),
    productRequestForm = $bindable({
      name_en: "",
      name_ar: "",
      name_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      category_shortname: "",
      brand_shortname: "",
      specifications: [{ key: "", value: "" }],
      justification: "",
    }),
    categoryRequestForm = $bindable({
      name_en: "",
      name_ar: "",
      name_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      parent_category: "",
      justification: "",
    }),
    onClose = (e?: MouseEvent) => {},
    onSubmit = (e?: MouseEvent) => {},
    onAddSpecification = (e?: MouseEvent) => {},
    onRemoveSpecification = (index: number) => {},
    getLocalizedDisplayName = (item: any) => "",
  } = $props();

  // Type-safe wrapper functions
  const handleClose = (e: MouseEvent) => onClose(e);
  const handleSubmit = (e: MouseEvent) => onSubmit(e);
  const handleAddSpec = (e: MouseEvent) => onAddSpecification(e);
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- @ts-expect-error: Svelte 5 runes type inference issue -->
  <div class="modal-overlay" onclick={handleClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-content large-modal"
      onclick={(e) => e.stopPropagation()}
      class:rtl={isRTL}
    >
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.request_product_category") ||
            "Request Product or Category"}
        </h2>
        <!-- @ts-expect-error: Svelte 5 runes type inference issue -->
        <button
          class="modal-close"
          onclick={handleClose}
          aria-label="Close modal"
          type="button"
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
      </div>

      <div class="modal-body">
        <!-- Request Type Selection -->
        <div class="request-type-selection">
          <button
            class="request-type-card"
            class:active={requestType === "product"}
            onclick={() => (requestType = "product")}
          >
            <div class="type-icon product-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div class="type-content">
              <h3 class="type-title">
                {$_("seller_dashboard.request_product") || "Request Product"}
              </h3>
              <p class="type-description">
                {$_("seller_dashboard.request_product_desc") ||
                  "Request a new product to be added to the catalog"}
              </p>
            </div>
          </button>

          <button
            class="request-type-card"
            class:active={requestType === "category"}
            onclick={() => (requestType = "category")}
          >
            <div class="type-icon category-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <div class="type-content">
              <h3 class="type-title">
                {$_("seller_dashboard.request_category") || "Request Category"}
              </h3>
              <p class="type-description">
                {$_("seller_dashboard.request_category_desc") ||
                  "Request a new category to organize products"}
              </p>
            </div>
          </button>
        </div>

        <!-- Product Request Form -->
        {#if requestType === "product"}
          <div class="request-form">
            <div class="form-section">
              <h3 class="section-title">
                {$_("seller_dashboard.product_details") || "Product Details"}
              </h3>

              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="product-name-en">
                    {$_("seller_dashboard.name_english") || "Name (English)"}
                    <span class="required">*</span>
                  </label>
                  <input
                    id="product-name-en"
                    type="text"
                    bind:value={productRequestForm.name_en}
                    placeholder={$_("seller_dashboard.enter_product_name") ||
                      "Enter product name..."}
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.name_arabic") || "Name (Arabic)"}
                  </label>
                  <input
                    type="text"
                    bind:value={productRequestForm.name_ar}
                    placeholder={$_("seller_dashboard.enter_product_name") ||
                      "Enter product name..."}
                    class="form-input rtl"
                    dir="rtl"
                  />
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.name_kurdish") || "Name (Kurdish)"}
                  </label>
                  <input
                    type="text"
                    bind:value={productRequestForm.name_ku}
                    placeholder={$_("seller_dashboard.enter_product_name") ||
                      "Enter product name..."}
                    class="form-input rtl"
                    dir="rtl"
                  />
                </div>
              </div>

              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="form-label">
                  {$_("seller_dashboard.description_english") ||
                    "Description (English)"}
                  <span class="required">*</span>
                </label>
                <textarea
                  bind:value={productRequestForm.description_en}
                  placeholder={$_("seller_dashboard.enter_description") ||
                    "Enter product description..."}
                  class="form-textarea"
                  rows="3"
                ></textarea>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.description_arabic") ||
                      "Description (Arabic)"}
                  </label>
                  <textarea
                    bind:value={productRequestForm.description_ar}
                    placeholder={$_("seller_dashboard.enter_description") ||
                      "Enter product description..."}
                    class="form-textarea rtl"
                    dir="rtl"
                    rows="3"
                  ></textarea>
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.description_kurdish") ||
                      "Description (Kurdish)"}
                  </label>
                  <textarea
                    bind:value={productRequestForm.description_ku}
                    placeholder={$_("seller_dashboard.enter_description") ||
                      "Enter product description..."}
                    class="form-textarea rtl"
                    dir="rtl"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.category") || "Category"}
                    <span class="required">*</span>
                  </label>
                  <select
                    bind:value={productRequestForm.category_shortname}
                    class="form-select"
                  >
                    <option value="">
                      {$_("seller_dashboard.choose_category") ||
                        "Choose a category..."}
                    </option>
                    {#if isLoadingCategories}
                      <option disabled>
                        {$_("seller_dashboard.loading") || "Loading..."}
                      </option>
                    {:else}
                      {#each categories as category (category.shortname)}
                        <option value={category.shortname}>
                          {getLocalizedDisplayName(category)}
                        </option>
                      {/each}
                    {/if}
                  </select>
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.brand") || "Brand"}
                    <span class="required">*</span>
                  </label>
                  <select
                    bind:value={productRequestForm.brand_shortname}
                    class="form-select"
                  >
                    <option value="">
                      {$_("seller_dashboard.choose_brand") ||
                        "Choose a brand..."}
                    </option>
                    {#if isLoadingBrands}
                      <option disabled>
                        {$_("seller_dashboard.loading") || "Loading..."}
                      </option>
                    {:else}
                      {#each brands as brand (brand.shortname)}
                        <option value={brand.shortname}>
                          {getLocalizedDisplayName(brand)}
                        </option>
                      {/each}
                    {/if}
                  </select>
                </div>
              </div>
            </div>

            <!-- Specifications -->
            <div class="form-section">
              <div class="section-header">
                <h3 class="section-title">
                  {$_("seller_dashboard.specifications") || "Specifications"}
                </h3>
                <!-- @ts-expect-error: Svelte 5 runes type inference issue -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <button
                  class="add-spec-btn"
                  onclick={handleAddSpec}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  {$_("seller_dashboard.add_specification") ||
                    "Add Specification"}
                </button>
              </div>

              <div class="specifications-list">
                {#each productRequestForm.specifications as spec, index (index)}
                  <div class="specification-item">
                    <div class="spec-inputs">
                      <input
                        type="text"
                        bind:value={spec.key}
                        placeholder={$_("seller_dashboard.spec_key") ||
                          "Specification key (e.g., Color, Size)"}
                        class="form-input"
                      />
                      <input
                        type="text"
                        bind:value={spec.value}
                        placeholder={$_("seller_dashboard.spec_value") ||
                          "Specification value"}
                        class="form-input"
                      />
                    </div>
                    {#if productRequestForm.specifications.length > 1}
                      <button
                        class="remove-spec-btn"
                        onclick={() => onRemoveSpecification(index)}
                        type="button"
                        aria-label="Remove specification"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Justification -->
            <div class="form-section">
              <h3 class="section-title">
                {$_("seller_dashboard.justification") || "Justification"}
              </h3>
              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="form-label">
                  {$_("seller_dashboard.why_request") ||
                    "Why do you need this product?"}
                  <span class="required">*</span>
                </label>
                <textarea
                  bind:value={productRequestForm.justification}
                  placeholder={$_(
                    "seller_dashboard.justification_placeholder"
                  ) || "Explain why this product should be added..."}
                  class="form-textarea"
                  rows="4"
                ></textarea>
              </div>
            </div>
          </div>
        {/if}

        <!-- Category Request Form -->
        {#if requestType === "category"}
          <div class="request-form">
            <div class="form-section">
              <h3 class="section-title">
                {$_("seller_dashboard.category_details") || "Category Details"}
              </h3>

              <div class="form-grid">
                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.name_english") || "Name (English)"}
                    <span class="required">*</span>
                  </label>
                  <input
                    type="text"
                    bind:value={categoryRequestForm.name_en}
                    placeholder={$_("seller_dashboard.enter_category_name") ||
                      "Enter category name..."}
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.name_arabic") || "Name (Arabic)"}
                  </label>
                  <input
                    type="text"
                    bind:value={categoryRequestForm.name_ar}
                    placeholder={$_("seller_dashboard.enter_category_name") ||
                      "Enter category name..."}
                    class="form-input rtl"
                    dir="rtl"
                  />
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.name_kurdish") || "Name (Kurdish)"}
                  </label>
                  <input
                    type="text"
                    bind:value={categoryRequestForm.name_ku}
                    placeholder={$_("seller_dashboard.enter_category_name") ||
                      "Enter category name..."}
                    class="form-input rtl"
                    dir="rtl"
                  />
                </div>
              </div>

              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="form-label">
                  {$_("seller_dashboard.description_english") ||
                    "Description (English)"}
                  <span class="required">*</span>
                </label>
                <textarea
                  bind:value={categoryRequestForm.description_en}
                  placeholder={$_("seller_dashboard.enter_description") ||
                    "Enter category description..."}
                  class="form-textarea"
                  rows="3"
                ></textarea>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.description_arabic") ||
                      "Description (Arabic)"}
                  </label>
                  <textarea
                    bind:value={categoryRequestForm.description_ar}
                    placeholder={$_("seller_dashboard.enter_description") ||
                      "Enter category description..."}
                    class="form-textarea rtl"
                    dir="rtl"
                    rows="3"
                  ></textarea>
                </div>

                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label class="form-label">
                    {$_("seller_dashboard.description_kurdish") ||
                      "Description (Kurdish)"}
                  </label>
                  <textarea
                    bind:value={categoryRequestForm.description_ku}
                    placeholder={$_("seller_dashboard.enter_description") ||
                      "Enter category description..."}
                    class="form-textarea rtl"
                    dir="rtl"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="form-label">
                  {$_("seller_dashboard.parent_category") || "Parent Category"}
                  <span class="help-text">
                    ({$_("seller_dashboard.optional") || "Optional"})
                  </span>
                </label>
                <select
                  bind:value={categoryRequestForm.parent_category}
                  class="form-select"
                >
                  <option value="">
                    {$_("seller_dashboard.no_parent") ||
                      "No parent (Top level category)"}
                  </option>
                  {#if isLoadingCategories}
                    <option disabled>
                      {$_("seller_dashboard.loading") || "Loading..."}
                    </option>
                  {:else}
                    {#each categories as category (category.shortname)}
                      <option value={category.shortname}>
                        {getLocalizedDisplayName(category)}
                      </option>
                    {/each}
                  {/if}
                </select>
              </div>
            </div>

            <!-- Justification -->
            <div class="form-section">
              <h3 class="section-title">
                {$_("seller_dashboard.justification") || "Justification"}
              </h3>
              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="form-label">
                  {$_("seller_dashboard.why_request_category") ||
                    "Why do you need this category?"}
                  <span class="required">*</span>
                </label>
                <textarea
                  bind:value={categoryRequestForm.justification}
                  placeholder={$_(
                    "seller_dashboard.category_justification_placeholder"
                  ) || "Explain why this category should be added..."}
                  class="form-textarea"
                  rows="4"
                ></textarea>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <!-- @ts-expect-error: Svelte 5 runes type inference issue -->
        <button class="btn-secondary" onclick={handleClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <!-- @ts-expect-error: Svelte 5 runes type inference issue -->
        <button class="btn-primary" onclick={handleSubmit}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {$_("seller_dashboard.submit_request") || "Submit Request"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
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
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: white;
    border-radius: 20px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-content.large-modal {
    max-width: 1000px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .modal-close {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .modal-close:hover {
    background: #fee2e2;
    border-color: #f56565;
  }

  .modal-close svg {
    width: 1.25rem;
    height: 1.25rem;
    color: #718096;
    stroke-width: 2;
  }

  .modal-close:hover svg {
    color: #f56565;
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    background: #f7fafc;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-weight: 600;
    color: #4a5568;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: #f7fafc;
    border-color: #cbd5e0;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 10px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    justify-content: center;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
  }

  .btn-primary svg {
    width: 1.125rem;
    height: 1.125rem;
    stroke-width: 2.5;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-label {
    display: block;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    transition: all 0.2s ease;
    background: white;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-input.rtl,
  .form-textarea.rtl {
    direction: rtl;
    text-align: right;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .request-type-selection {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .request-type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: center;
  }

  .request-type-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
  }

  .request-type-card.active {
    border-color: #667eea;
    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
  }

  .type-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .product-icon {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .category-icon {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  .type-icon svg {
    width: 32px;
    height: 32px;
    color: white;
    stroke-width: 2;
  }

  .type-content {
    flex: 1;
  }

  .type-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 0.5rem 0;
  }

  .type-description {
    font-size: 0.9rem;
    color: #718096;
    margin: 0;
    line-height: 1.5;
  }

  .request-form {
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .form-section {
    margin-bottom: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 1rem 0;
  }

  .add-spec-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .add-spec-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .add-spec-btn svg {
    width: 16px;
    height: 16px;
    stroke-width: 2.5;
  }

  .specifications-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .specification-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .spec-inputs {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .remove-spec-btn {
    padding: 0.75rem;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .remove-spec-btn:hover {
    background: #fee2e2;
    border-color: #f56565;
  }

  .remove-spec-btn svg {
    width: 18px;
    height: 18px;
    color: #718096;
    stroke-width: 2;
  }

  .remove-spec-btn:hover svg {
    color: #f56565;
  }

  .help-text {
    font-size: 0.85rem;
    color: #718096;
    font-weight: 400;
  }

  .required {
    color: #f56565;
    margin-left: 0.25rem;
  }

  @media (max-width: 768px) {
    .request-type-selection {
      grid-template-columns: 1fr;
    }

    .spec-inputs {
      grid-template-columns: 1fr;
    }
  }
</style>

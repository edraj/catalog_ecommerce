<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";

  type Props = {
    show: boolean;
    isRTL: boolean;
    warrantyForm: {
      displaynameEn: string;
      displaynameAr: string;
      displaynameKu: string;
      descriptionEn: string;
      descriptionAr: string;
      descriptionKu: string;
      isGlobal: boolean;
      brandShortname: string;
    };
    brands: any[];
    isLoadingBrands: boolean;
    onClose: () => void;
    onSubmit: () => void;
    getLocalizedDisplayName: (item: any) => string;
    isEditMode?: boolean;
  };

  let {
    show = $bindable(),
    isRTL,
    warrantyForm = $bindable(),
    brands = [],
    isLoadingBrands = false,
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
  size="medium"
  title={isEditMode
    ? $_("seller_dashboard.edit_warranty") || "Edit Warranty"
    : $_("seller_dashboard.create_warranty") || "Create Warranty"}
  {onClose}
>
  {#snippet body()}
    <div class="warranty-form">
      <div class="form-section">
        <h3 class="section-title">
          {$_("seller_dashboard.warranty_name") || "Warranty Name"}
        </h3>

        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>
              {$_("seller_dashboard.name_english") || "Name (English)"} *
            </span>
          </label>
          <input
            type="text"
            bind:value={warrantyForm.displaynameEn}
            class="form-input"
            placeholder="e.g., 1 Year - Al-Nabaa"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.name_arabic") || "Name (Arabic)"}</span>
          </label>
          <input
            type="text"
            bind:value={warrantyForm.displaynameAr}
            class="form-input"
            class:rtl={true}
            placeholder="مثال: سنة واحدة - النبأ"
          />
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">
          {$_("seller_dashboard.warranty_description") ||
            "Warranty Description"}
        </h3>

        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>
              {$_("seller_dashboard.description_english") ||
                "Description (English)"} *
            </span>
          </label>
          <textarea
            bind:value={warrantyForm.descriptionEn}
            class="form-textarea"
            rows="4"
            placeholder="Enter warranty terms and conditions..."
            required
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>
              {$_("seller_dashboard.description_arabic") ||
                "Description (Arabic)"}
            </span>
          </label>
          <textarea
            bind:value={warrantyForm.descriptionAr}
            class="form-textarea"
            class:rtl={true}
            rows="4"
            placeholder="أدخل شروط وأحكام الضمان..."
          ></textarea>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">
          {$_("seller_dashboard.warranty_scope") || "Warranty Scope"}
        </h3>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={warrantyForm.isGlobal}
              class="form-checkbox"
            />
            <span>
              {$_("seller_dashboard.is_global_warranty") ||
                "Global Warranty (applies to all products)"}
            </span>
          </label>
        </div>

        {#if !warrantyForm.isGlobal}
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
                bind:value={warrantyForm.brandShortname}
                class="form-select"
                class:rtl={isRTL}
                required={!warrantyForm.isGlobal}
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
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" onclick={onClose}>
      {$_("seller_dashboard.cancel") || "Cancel"}
    </Button>
    <Button variant="primary" onclick={handleSubmit}>
      {isEditMode
        ? $_("common.save") || "Save"
        : $_("seller_dashboard.create") || "Create"}
    </Button>
  {/snippet}
</Modal>

<style>
  .warranty-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-section {
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .form-section:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .form-input,
  .form-textarea,
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
  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: #3c307f;
    box-shadow: 0 0 0 3px rgba(60, 48, 127, 0.1);
  }

  .form-textarea {
    resize: vertical;
  }

  .form-textarea.rtl,
  .form-input.rtl,
  .form-select.rtl {
    direction: rtl;
    text-align: right;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9375rem;
  }

  .form-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .loading-text {
    font-size: 0.875rem;
    color: #666;
    padding: 0.5rem 0;
  }
</style>

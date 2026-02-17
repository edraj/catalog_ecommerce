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

  type LangKey = "ar" | "en";
  let activeLang = $state<LangKey>("en");

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
      <!-- Language Tabs (match your product modal layout) -->
      <div class="lang-tabs">
        <button
          class="lang-tab"
          class:active={activeLang === "ar"}
          onclick={() => (activeLang = "ar")}
          type="button"
        >
          Arabic
        </button>

        <button
          class="lang-tab"
          class:active={activeLang === "en"}
          onclick={() => (activeLang = "en")}
          type="button"
        >
        English
        </button>
      </div>

      <!-- Fields -->
      <div class="form-content">
        <div class="form-section">
          <h3 class="section-title">
            {$_("seller_dashboard.warranty_name") || "Warranty Name"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={activeLang === "ar"}>
              <span>
                {activeLang === "ar"
                  ? $_("seller_dashboard.name_arabic") || "Name (Arabic)"
                  : $_("seller_dashboard.name_english") || "Name (English)"} *
              </span>
            </label>

            {#if activeLang === "ar"}
              <input
                type="text"
                bind:value={warrantyForm.displaynameAr}
                class="form-input rtl"
                placeholder="مثال: سنة واحدة - النبأ"
                required
              />
            {:else}
              <input
                type="text"
                bind:value={warrantyForm.displaynameEn}
                class="form-input"
                placeholder="e.g., 1 Year - Al-Nabaa"
                required
              />
            {/if}
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("seller_dashboard.warranty_description") ||
              "Warranty Description"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={activeLang === "ar"}>
              <span>
                {activeLang === "ar"
                  ? $_("seller_dashboard.description_arabic") ||
                    "Description (Arabic)"
                  : $_("seller_dashboard.description_english") ||
                    "Description (English)"} *
              </span>
            </label>

            {#if activeLang === "ar"}
              <textarea
                bind:value={warrantyForm.descriptionAr}
                class="form-textarea rtl"
                rows="4"
                placeholder="أدخل شروط وأحكام الضمان..."
                required
              ></textarea>
            {:else}
              <textarea
                bind:value={warrantyForm.descriptionEn}
                class="form-textarea"
                rows="4"
                placeholder="Enter warranty terms and conditions..."
                required
              ></textarea>
            {/if}
          </div>
        </div>

        <!-- Shared (Scope) -->
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
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="primary" class='w-full' onclick={handleSubmit}>
      {isEditMode ? $_("common.save") || "Save" : $_("seller_dashboard.create") || "Create"}
    </Button>
  {/snippet}
</Modal>

<style>
  .warranty-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* === Language Tabs (same structure as your product modal) === */
  .lang-tabs {
    display: inline-flex;
    gap: 8px;
    width: 100%;
    padding: 6px;
    border-radius: 12px;
  }

  .lang-tab {
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: #4a5565;
    font-weight: 600;
    width: 50%;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
     background: #f9fafb;
    border-color: #e5e7eb;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
  }

  .lang-tab:hover {
    background: rgba(255, 255, 255, 0.75);
  }

  .lang-tab.active {
    background: #ffffff;
    border-color: #e5e7eb;
    color: #111827;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
  }

  /* Content */
  .form-content {
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

  .rtl {
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

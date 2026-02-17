<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";

  export type BrandTabKey = "basic_info" | "meta_info";
  type LangTabKey = "en" | "ar";
    let selectedFile = $state<File | null>(null);
  export interface BrandFormData {
  displayname_en: string;
  displayname_ar: string;
  description_en: string;
  description_ar: string;
  meta_title_en: string;
  meta_description_en: string;
  isTop: boolean;
  boost_value?: number;
}


  interface Props {
    show: boolean;
    mode?: "create" | "edit";
    title?: string;
    submitLabel?: string;
    logoFile?: File | null;
    value: BrandFormData;

    onClose: () => void;
    onSubmit: () => void;

    resetOnClose?: boolean;
  }

  let {
    show = $bindable(),
    mode = "create",
    title = "",
    submitLabel = "",
    logoFile = $bindable<File | null>(null),
    value = $bindable<BrandFormData>(),
    onClose,
    onSubmit,
    resetOnClose = true,
  }: Props = $props();

  let activeTab = $state<BrandTabKey>("basic_info");
  let langTab = $state<LangTabKey>("en");

 function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    logoFile = file;
  }

  function clearLogo() {
    logoFile = null;
  }

  $effect(() => {
    if (!show && resetOnClose) {
      activeTab = "basic_info";
      langTab = "en";
    }
  });

  $effect(() => {
    if (!title) {
      title =
        mode === "edit"
          ? $_("brands.edit_brand") || "Edit Brand"
          : $_("brands.create_brand") || "Create Brand";
    }
    if (!submitLabel) {
      submitLabel =
        mode === "edit"
          ? $_("brands.update") || "Update Brand"
          : $_("brands.create") || "Create Brand";
    }
  });
</script>

<Modal bind:show title="" {onClose} size="medium">
  {#snippet body()}
    <div class="brand-modal-shell" onclick={(e) => e.stopPropagation()}>
      <!-- Sticky Header -->
      <div class="brand-modal-header">
        <h2 class="brand-modal-title">{title}</h2>

        <button
          class="brand-modal-close"
          onclick={onClose}
          aria-label="Close"
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M15.5378 4.40935C15.864 4.73397 15.8653 5.26161 15.5407 5.58786L11.1755 9.97496L15.5907 14.4123C15.9153 14.7385 15.914 15.2662 15.5877 15.5908C15.2615 15.9154 14.7339 15.9141 14.4092 15.5878L9.99996 11.1564L5.59069 15.5878C5.26607 15.9141 4.73843 15.9154 4.41218 15.5908C4.08593 15.2662 4.08461 14.7385 4.40923 14.4123L8.82439 9.97496L4.45921 5.58786C4.13459 5.26161 4.13591 4.73398 4.46216 4.40936C4.78842 4.08474 5.31605 4.08606 5.64067 4.41231L9.99996 8.79348L14.3592 4.4123C14.6839 4.08605 15.2115 4.08473 15.5378 4.40935Z"
              fill="#3C307F"
            />
          </svg>
        </button>
      </div>

      <!-- Sticky Tabs -->
      <div class="brand-modal-tabs">
        <button
          class="brand-tab"
          class:active={activeTab === "basic_info"}
          onclick={() => (activeTab = "basic_info")}
          type="button"
        >
          {$_("admin_dashboard.basic_info") || "Basic info"}
        </button>

        <button
          class="brand-tab"
          class:active={activeTab === "meta_info"}
          onclick={() => (activeTab = "meta_info")}
          type="button"
        >
          {$_("brands.seo_info") || "Meta info"}
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="brand-modal-body">
        {#if activeTab === "basic_info"}
          <div class="form-content">
            <!-- ✅ Language Tabs inside Basic Info -->
            <div class="lang-tabs">
              <button
                class="lang-tab"
                class:active={langTab === "en"}
                onclick={() => (langTab = "en")}
                type="button"
              >
                English
              </button>
              <button
                class="lang-tab"
                class:active={langTab === "ar"}
                onclick={() => (langTab = "ar")}
                type="button"
              >
                العربية
              </button>
            </div>

            <div class="form-grid">
              {#if langTab === "en"}
                <div class="field">
                  <label class="field-label" for="brand-name-en">
                    {$_("brands.name_en") || "Brand Name (English)"}
                    <span class="required">*</span>
                  </label>
                  <input
                    id="brand-name-en"
                    type="text"
                    bind:value={value.displayname_en}
                    placeholder="e.g., Apple, Samsung"
                    class="text-input"
                  />
                </div>

                <div class="field">
                  <label class="field-label" for="brand-desc-en">
                    {$_("brands.description_en") || "Description (English)"}
                  </label>
                  <textarea
                    id="brand-desc-en"
                    bind:value={value.description_en}
                    rows="3"
                    placeholder="Brief description of the brand..."
                    class="textarea-input"
                  ></textarea>
                </div>
              {:else}
                <div class="field">
                  <label class="field-label" for="brand-name-ar">
                    {$_("brands.name_ar") || "Brand Name (Arabic)"}
                  </label>
                  <input
                    id="brand-name-ar"
                    type="text"
                    bind:value={value.displayname_ar}
                    placeholder="مثال: آبل، سامسونج"
                    class="text-input rtl"
                  />
                </div>

                <div class="field">
                  <label class="field-label" for="brand-desc-ar">
                    {$_("brands.description_ar") || "Description (Arabic)"}
                  </label>
                  <textarea
                    id="brand-desc-ar"
                    bind:value={value.description_ar}
                    rows="3"
                    placeholder="وصف مختصر للعلامة التجارية..."
                    class="textarea-input rtl"
                  ></textarea>
                </div>
              {/if}

              <!-- Non-language fields -->
              <div class="field">
                <label class="field-label" for="brand-boost">
                  {$_("brands.boost_value") || "Boost Value"}
                </label>
                <input
                  id="brand-boost"
                  type="number"
                  min="0"
                  bind:value={value.boost_value}
                  placeholder="0"
                  class="text-input"
                />
              </div>

              <div class="field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={value.isTop}
                    class="form-checkbox"
                  />
                  <span>{$_("brands.mark_as_top") || "Mark as Top Brand"}</span>
                </label>
              </div>

              <!-- Image Drop Field (END of Basic Info) -->
              <div class="field">
                <label class="field-label" for="brand-logo-input">
                  {$_("brands.brand_image") || "Brand Image"}
                  <span class="optional"
                    >({$_("common.optional") || "Optional"})</span
                  >
                </label>

                <label class="dropzone" for="brand-logo-input">
                  <div class="dropzone-inner">
                    <div class="dropzone-icon-slot">
                      <slot name="dropIcon" />
                    </div>
                  </div>

                  {#if selectedFile}
                    <div class="dropzone-file">
                      <span class="file-name">{selectedFile.name}</span>

                      <button
                        type="button"
                        class="file-remove"
                        onclick={clearLogo}
                      >
                        {$_("common.remove") || "Remove"}
                      </button>
                    </div>
                  {/if}
                </label>

                <input
                  id="brand-logo-input"
                  type="file"
                  accept="image/*"
                  class="file-input-hidden"
                  onchange={handleFileChange}
                />
              </div>
            </div>
          </div>
        {:else}
          <div class="form-content">
            <h3 class="section-title">
              {$_("brands.seo_info") || "SEO Information"}
            </h3>

            <div class="form-grid">
              <div class="field">
                <label class="field-label" for="meta-title-en">
                  {$_("brands.meta_title_en") || "Meta Title (English)"}
                </label>
                <input
                  id="meta-title-en"
                  type="text"
                  bind:value={value.meta_title_en}
                  placeholder="SEO title for search engines..."
                  class="text-input"
                />
              </div>

              <div class="field">
                <label class="field-label" for="meta-desc-en">
                  {$_("brands.meta_description_en") ||
                    "Meta Description (English)"}
                </label>
                <textarea
                  id="meta-desc-en"
                  bind:value={value.meta_description_en}
                  rows="3"
                  placeholder="SEO description for search engines..."
                  class="textarea-input"
                ></textarea>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sticky Footer -->
      <div class="brand-modal-footer w-full">
        <Button variant="primary" onclick={onSubmit} class="w-full">
          {submitLabel}
        </Button>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .rtl {
    direction: rtl;
  }

  .brand-modal-shell {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    overflow: hidden;
    background: #fff;
    border-radius: 12px;
  }

  .brand-modal-header {
    position: sticky;
    top: 0;
    z-index: 30;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px;
  }

  .brand-modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .brand-modal-close {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .brand-modal-tabs {
    padding-top: 10px;
    padding-bottom: 10px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding-left: 16px;
    padding-right: 16px;
  }

  .brand-tab {
    padding: 12px 16px;
    font-size: 14px;
    color: #4a5565;
    cursor: pointer;
    transition: 0.15s ease;
    width: 48%;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
  }

  .brand-tab.active {
    background: #ffffff;
    color: #3c307f;
    border-color: #c7c3ff;
  }

  .brand-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .brand-modal-footer {
    position: sticky;
    bottom: 0;
    z-index: 30;
    background: #fff;
    border-top: 1px solid #e5e7eb;

    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .optional {
    font-weight: 500;
    color: #6b7280;
    margin-left: 6px;
    font-size: 12px;
  }

  .form-grid {
    display: grid;
    gap: 14px;
  }

  .field-label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .required {
    color: #dc2626;
  }

  .text-input,
  .textarea-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 16px;
    font-size: 0.95rem;
    color: #1a1a1a;
    transition: all 0.2s;
    box-sizing: border-box;
    font-family: inherit;
    background: #fff;
  }

  .text-input:hover,
  .textarea-input:hover {
    border-color: #9ca3af;
  }

  .text-input:focus,
  .textarea-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .textarea-input {
    resize: vertical;
    line-height: 1.5;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
    color: #111827;
    font-size: 14px;
  }

  .form-checkbox {
    cursor: pointer;
  }

  /* ✅ Language tabs */
  .lang-tabs {
    display: flex;
    gap: 8px;
    padding: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f9fafb;
  }

  .lang-tab {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    cursor: pointer;
    font-size: 14px;
    color: #4a5565;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    transition: 0.15s ease;
  }

  .lang-tab.active {
    color: #3c307f;
    border-color: #c7c3ff;
    background: #ffffff;
  }

  /* Dropzone */
  .file-input-hidden {
    display: none;
  }

  .dropzone {
    display: flex;
    flex-direction: column;
    gap: 10px;
    justify-content: center;
    align-items: center;
    padding: 14px;
    border-radius: 12px;
    border: 1px dashed #d1d5db;
    background: #f9fafb;
    cursor: pointer;
    transition: 0.15s ease;
    min-height: 140px;
  }

  .dropzone:hover {
    border-color: #9ca3af;
    background: #f3f4f6;
  }

  .dropzone-inner {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dropzone-icon-slot {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
  }

  .dropzone-file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid #e5e7eb;
    width: 100%;
  }

  .file-name {
    font-size: 13px;
    color: #111827;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 240px;
  }

  .file-remove {
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 12px;
    color: #4a5565;
    cursor: pointer;
  }

  .file-remove:hover {
    background: #f3f4f6;
  }
</style>

<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";
  import type { CategoryFormData } from "./CreateCategoryModal.svelte";

  interface Props {
    show: boolean;
    onClose: () => void;
    onSubmit: (data: CategoryFormData) => void;
    parentCategories: any[];
    specifications: any[];
    category: any;
    initialData?: CategoryFormData;
  }

  let {
    show = $bindable(),
    onClose,
    onSubmit,
    parentCategories = [],
    specifications = [],
    category,
    initialData,
  }: Props = $props();

  type TabKey = "basic_info" | "specifications";
  let activeTab = $state<TabKey>("basic_info");

  let formData = $state<CategoryFormData>({
    displayname: "",
    description: "",
    parent_category_id: "",
    specification_shortnames: [],
    boost_value: 0,
  });

  // Filter out current category (avoid circular parent)
  const availableParentCategories = $derived(
    parentCategories.filter((p) => p.shortname !== category?.shortname),
  );

  // Update form when modal opens / initialData changes
  $effect(() => {
    if (show && initialData) {
      activeTab = "basic_info";
      formData = { ...initialData };
    }
  });

  function handleSubmit() {
    onSubmit(formData);
  }

  function getLocalizedDisplayName(item: any): string {
    return (
      item?.displayname ||
      item?.attributes?.displayname?.en ||
      item?.shortname ||
      ""
    );
  }

  function toggleSpecification(shortname: string) {
    if (formData.specification_shortnames.includes(shortname)) {
      formData.specification_shortnames =
        formData.specification_shortnames.filter((s) => s !== shortname);
    } else {
      formData.specification_shortnames = [
        ...formData.specification_shortnames,
        shortname,
      ];
    }
  }

  function getSpecificationDisplayName(spec: any): string {
    const displayname = spec?.attributes?.displayname;
    if (displayname) {
      return displayname.en || displayname.ar || displayname.ku || spec.shortname;
    }
    return spec?.shortname || "";
  }
</script>

<Modal bind:show title="" {onClose} size="small">
  {#snippet body()}
    <div class="category-modal-shell" onclick={(e) => e.stopPropagation()}>
      <!-- Sticky Header -->
      <div class="category-modal-header">
        <h2 class="category-modal-title">
          {$_("admin_dashboard.edit_category") || "Edit Category"}
        </h2>

        <button
          class="category-modal-close"
          onclick={onClose}
          aria-label="Close"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd"
              d="M15.5378 4.40935C15.864 4.73397 15.8653 5.26161 15.5407 5.58786L11.1755 9.97496L15.5907 14.4123C15.9153 14.7385 15.914 15.2662 15.5877 15.5908C15.2615 15.9154 14.7339 15.9141 14.4092 15.5878L9.99996 11.1564L5.59069 15.5878C5.26607 15.9141 4.73843 15.9154 4.41218 15.5908C4.08593 15.2662 4.08461 14.7385 4.40923 14.4123L8.82439 9.97496L4.45921 5.58786C4.13459 5.26161 4.13591 4.73398 4.46216 4.40936C4.78842 4.08474 5.31605 4.08606 5.64067 4.41231L9.99996 8.79348L14.3592 4.4123C14.6839 4.08605 15.2115 4.08473 15.5378 4.40935Z"
              fill="#3C307F" />
          </svg>
        </button>
      </div>

      <!-- Sticky Tabs -->
      <div class="category-modal-tabs">
        <button
          class="category-tab"
          class:active={activeTab === "basic_info"}
          onclick={() => (activeTab = "basic_info")}
          type="button"
        >
          {$_("admin_dashboard.basic_info") || "Basic info"}
        </button>

        <button
          class="category-tab"
          class:active={activeTab === "specifications"}
          onclick={() => (activeTab = "specifications")}
          type="button"
        >
          {$_("admin_dashboard.specifications") || "Specifications"}
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="category-modal-body">
        {#if activeTab === "basic_info"}
          <div class="form-content">
            <div class="form-grid">
              <div class="field">
                <label class="field-label" for="edit-category-name">
                  {$_("common.name") || "Name"} <span class="required">*</span>
                </label>
                <input
                  id="edit-category-name"
                  type="text"
                  bind:value={formData.displayname}
                  placeholder={$_("admin_dashboard.enter_category_name") ||
                    "Enter category name"}
                  class="text-input"
                />
              </div>

              <div class="field">
                <select
                  id="edit-parent-category"
                  bind:value={formData.parent_category_id}
                  class="text-input"
                >
                  <option value="">
                    {$_("common.none_top_level") || "None (Top-level category)"}
                  </option>

                  {#each availableParentCategories as parent}
                    <option value={parent.shortname}>
                      {getLocalizedDisplayName(parent)}
                    </option>
                  {/each}
                </select>
              </div>

              <div class="field">
                <label class="field-label" for="edit-category-description">
                  {$_("common.description") || "Description"}
                </label>
                <textarea
                  id="edit-category-description"
                  bind:value={formData.description}
                  placeholder={$_("admin_dashboard.enter_category_description") ||
                    "Enter category description"}
                  class="textarea-input"
                  rows="4"
                ></textarea>
              </div>

              <div class="field">
                <label class="field-label" for="edit-boost-value">
                  {$_("admin_dashboard.boost_value") || "Boost Value"}
                </label>
                <input
                  id="edit-boost-value"
                  type="number"
                  min="0"
                  bind:value={formData.boost_value}
                  placeholder="0"
                  class="text-input"
                />
              </div>
            </div>
          </div>

        {:else if activeTab === "specifications"}
          <div class="form-content">
            <h3 class="section-title">
              {$_("admin_dashboard.specifications") || "Specifications"}
              <span class="optional">
                ({$_("common.optional") || "Optional"})
              </span>
            </h3>

            <p class="section-description">
              {$_("admin_dashboard.specifications_hint") ||
                "Select specifications that apply to products in this category."}
            </p>

            {#if specifications.length === 0}
              <div class="info-message">
                {$_("admin_dashboard.no_specifications_available") ||
                  "ℹ️ No specifications available"}
              </div>
            {:else}
              <div class="categories-selection">
                {#each specifications as spec}
                  <div class="category-item">
                    <label class="category-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.specification_shortnames.includes(
                          spec.shortname
                        )}
                        onchange={() => toggleSpecification(spec.shortname)}
                      />
                      <span>{getSpecificationDisplayName(spec)}</span>
                    </label>

                    <span class="spec-shortname">({spec.shortname})</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Sticky Footer (same as Create Category: single full-width button) -->
      <div class="category-modal-footer w-full">
        <Button variant="primary" onclick={handleSubmit} class="w-full">
          {$_("common.save") || "Save Changes"}
        </Button>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .category-modal-shell {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    overflow: hidden;
    background: #fff;
    border-radius: 12px;
  }

  /* match your create category rounded inputs */
  #edit-parent-category,
  #edit-category-name {
    border-radius: 16px;
  }

  .category-modal-header {
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

  .category-modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .category-modal-close {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    display: grid;
    place-items: center;
    cursor: pointer;
  }


.category-modal-tabs{
  padding-top:10px;
  padding-bottom:10px;
}
  .category-tab {

    border-bottom: 1px solid #e5e7eb;
    padding: 10px 12px;
    font-size: 14px;
    color: #4a5565;
    cursor: pointer;
    padding: 12px 16px;
    transition: 0.15s ease;
    width: 48%;
  }

  .category-tab.active {
    background: #ffffff;
    color: #3c307f;
    border-color: #c7c3ff;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
  }

  .category-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .category-modal-footer {
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

  .section-description {
    margin: 0;
    font-size: 13px;
    color: #6b7280;
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
    border-radius: 0.5rem;
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

  .categories-selection {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f9fafb;
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 10px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid #e5e7eb;
  }

  .category-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
    color: #111827;
    font-size: 14px;
  }

  .category-checkbox input[type="checkbox"] {
    cursor: pointer;
  }

  .spec-shortname {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
  }

  .info-message {
    padding: 12px 14px;
    border-radius: 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 13px;
  }
</style>
d
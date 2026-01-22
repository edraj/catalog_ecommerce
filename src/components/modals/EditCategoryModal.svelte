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

  let formData = $state<CategoryFormData>({
    displayname: "",
    description: "",
    parent_category_id: "",
    specification_shortnames: [],
    boost_value: 0,
  });

  // Update form when initialData changes
  $effect(() => {
    if (initialData && show) {
      formData = { ...initialData };
    }
  });

  function handleSubmit() {
    onSubmit(formData);
  }

  function getLocalizedDisplayName(item: any): string {
    return item?.displayname || item?.shortname || "";
  }

  // Filter out the current category from parent options to prevent circular references
  const availableParentCategories = $derived(
    parentCategories.filter((p) => p.shortname !== category?.shortname),
  );

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
      return (
        displayname.en || displayname.ar || displayname.ku || spec.shortname
      );
    }
    return spec?.shortname || "";
  }
</script>

<Modal
  bind:show
  title={$_("admin_dashboard.edit_category") || "Edit Category"}
  {onClose}
>
  {#snippet body()}
    <div class="form-group">
      <label for="edit-category-name">
        {$_("common.name") || "Name"}
        <span class="required">*</span>
      </label>
      <input
        id="edit-category-name"
        type="text"
        bind:value={formData.displayname}
        placeholder={$_("admin_dashboard.enter_category_name") ||
          "Enter category name"}
        class="form-input"
      />
    </div>

    <div class="form-group">
      <label for="edit-parent-category">
        {$_("common.parent_category") || "Parent Category"}
        ({$_("common.optional") || "Optional"})
      </label>
      <select
        id="edit-parent-category"
        bind:value={formData.parent_category_id}
        class="form-input"
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
      <p class="form-hint">
        {$_("admin_dashboard.parent_category_hint") ||
          "Select a parent category to make this a sub-category"}
      </p>
    </div>

    <div class="form-group">
      <label for="edit-category-description">
        {$_("common.description") || "Description"}
      </label>
      <textarea
        id="edit-category-description"
        bind:value={formData.description}
        placeholder={$_("admin_dashboard.enter_category_description") ||
          "Enter category description"}
        class="form-textarea"
        rows="4"
      ></textarea>
    </div>

    <div class="form-group">
      <label for="edit-boost-value">
        {$_("admin_dashboard.boost_value") || "Boost Value"}
      </label>
      <input
        id="edit-boost-value"
        type="number"
        min="0"
        bind:value={formData.boost_value}
        placeholder="0"
        class="form-input"
      />
    </div>

    <div class="form-group">
      <div class="form-label">
        {$_("admin_dashboard.specifications") || "Specifications"}
        ({$_("common.optional") || "Optional"})
      </div>
      <div class="specifications-list">
        {#if specifications.length === 0}
          <p class="empty-message">
            {$_("admin_dashboard.no_specifications_available") ||
              "No specifications available"}
          </p>
        {:else}
          {#each specifications as spec}
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={formData.specification_shortnames.includes(
                  spec.shortname,
                )}
                onchange={() => toggleSpecification(spec.shortname)}
              />
              <span>{getSpecificationDisplayName(spec)}</span>
              <span class="spec-shortname">({spec.shortname})</span>
            </label>
          {/each}
        {/if}
      </div>
      <p class="form-hint">
        {$_("admin_dashboard.specifications_hint") ||
          "Select specifications that apply to products in this category"}
      </p>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" onclick={onClose}>
      {$_("common.cancel") || "Cancel"}
    </Button>
    <Button variant="primary" onclick={handleSubmit}>
      {$_("common.save") || "Save Changes"}
    </Button>
  {/snippet}
</Modal>

<style>
  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .required {
    color: #dc2626;
  }

  .form-hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #6b7280;
    font-style: italic;
  }

  .form-input,
  .form-textarea {
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

  .form-input:hover,
  .form-textarea:hover {
    border-color: #9ca3af;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-textarea {
    resize: vertical;
    line-height: 1.5;
  }

  .specifications-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 0.75rem;
    background-color: #f9fafb;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    margin-bottom: 0.25rem;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }

  .checkbox-label:hover {
    background-color: #e5e7eb;
  }

  .checkbox-label input[type="checkbox"] {
    margin-right: 0.5rem;
    cursor: pointer;
  }

  .spec-shortname {
    margin-left: 0.5rem;
    font-size: 0.8rem;
    color: #6b7280;
  }

  .empty-message {
    text-align: center;
    color: #6b7280;
    font-style: italic;
    margin: 0;
  }
</style>

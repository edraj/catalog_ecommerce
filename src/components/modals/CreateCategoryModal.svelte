<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";
  import type { Snippet } from "svelte";

  interface Props {
    show: boolean;
    onClose: () => void;
    onSubmit: (data: CategoryFormData) => void;
    parentCategories: any[];
  }

  export interface CategoryFormData {
    displayname: string;
    description: string;
    parent_category_id: string;
  }

  let {
    show = $bindable(),
    onClose,
    onSubmit,
    parentCategories = [],
  }: Props = $props();

  let formData = $state<CategoryFormData>({
    displayname: "",
    description: "",
    parent_category_id: "",
  });

  function handleSubmit() {
    onSubmit(formData);
  }

  function getLocalizedDisplayName(item: any): string {
    return item?.displayname || item?.shortname || "";
  }

  // Reset form when modal closes
  $effect(() => {
    if (!show) {
      formData = {
        displayname: "",
        description: "",
        parent_category_id: "",
      };
    }
  });
</script>

<Modal
  bind:show
  title={$_("admin_dashboard.create_category") || "Create Category"}
  {onClose}
>
  {#snippet body()}
    <div class="form-group">
      <label for="category-name">
        {$_("common.name") || "Name"}
        <span class="required">*</span>
      </label>
      <input
        id="category-name"
        type="text"
        bind:value={formData.displayname}
        placeholder={$_("admin_dashboard.enter_category_name") ||
          "Enter category name"}
        class="form-input"
      />
    </div>

    <div class="form-group">
      <label for="parent-category">
        {$_("common.parent_category") || "Parent Category"}
        ({$_("common.optional") || "Optional"})
      </label>
      <select
        id="parent-category"
        bind:value={formData.parent_category_id}
        class="form-input"
      >
        <option value="">
          {$_("common.none_top_level") || "None (Top-level category)"}
        </option>
        {#each parentCategories as parent}
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
      <label for="category-description">
        {$_("common.description") || "Description"}
      </label>
      <textarea
        id="category-description"
        bind:value={formData.description}
        placeholder={$_("admin_dashboard.enter_category_description") ||
          "Enter category description"}
        class="form-textarea"
        rows="4"
      ></textarea>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" onclick={onClose}>
      {$_("common.cancel") || "Cancel"}
    </Button>
    <Button variant="primary" onclick={handleSubmit}>
      {$_("common.create") || "Create Category"}
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
</style>

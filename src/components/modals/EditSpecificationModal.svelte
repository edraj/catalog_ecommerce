<script lang="ts">
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { Modal, Button } from "@/components/ui";
  import { PlusOutline, TrashBinOutline } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName } from "@/lib/utils/adminUtils";
  import type { SpecificationFormData } from "./CreateSpecificationModal.svelte";

  interface Props {
    show: boolean;
    onClose: () => void;
    onSubmit: (formData: SpecificationFormData) => void;
    specification: any;
    initialData?: SpecificationFormData;
  }

  let {
    show = $bindable(),
    onClose,
    onSubmit,
    specification,
    initialData,
  }: Props = $props();

  let formData = $state<SpecificationFormData>({
    displayname: "",
    displayname_ar: "",
    displayname_ku: "",
    options: [{ key: generateKey(), name: { en: "", ar: "", ku: "" } }],
  });

  function generateKey(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  function addOption() {
    formData.options = [
      ...formData.options,
      { key: generateKey(), name: { en: "", ar: "", ku: "" } },
    ];
  }

  function removeOption(index: number) {
    formData.options = formData.options.filter((_, i) => i !== index);
  }

  function handleSubmit() {
    onSubmit(formData);
  }

  // Update form when initialData changes
  $effect(() => {
    if (initialData) {
      formData = { ...initialData };
    }
  });
</script>

<Modal
  bind:show
  title={$_("admin_dashboard.edit_specification") || "Edit Specification"}
  size="large"
  {onClose}
>
  {#snippet body()}
    <div class="form-group">
      <label for="edit-specification-name-en"
        >{$_("common.name") || "Name"} (English) *</label
      >
      <input
        id="edit-specification-name-en"
        type="text"
        bind:value={formData.displayname}
        placeholder={$_("admin_dashboard.enter_specification_name") ||
          "Enter specification name (e.g., 'RAM', 'Operating System')"}
        class="form-input"
      />
    </div>

    <div class="form-group">
      <label for="edit-specification-name-ar"
        >{$_("common.name") || "Name"} (Arabic)</label
      >
      <input
        id="edit-specification-name-ar"
        type="text"
        bind:value={formData.displayname_ar}
        placeholder="أدخل اسم المواصفة"
        class="form-input"
        dir="rtl"
      />
    </div>

    <div class="form-group">
      <label for="edit-specification-name-ku"
        >{$_("common.name") || "Name"} (Kurdish)</label
      >
      <input
        id="edit-specification-name-ku"
        type="text"
        bind:value={formData.displayname_ku}
        placeholder="ناوی تایبەتمەندی"
        class="form-input"
        dir="rtl"
      />
    </div>

    <div class="form-group">
      <label>{$_("common.options") || "Options"} *</label>
      <p class="form-help">
        {$_("admin_dashboard.options_help") ||
          "Define the available options for this specification"}
      </p>
      {#each formData.options as option, index}
        <div class="option-group">
          <div class="option-header">
            <span class="option-label">Option {index + 1}</span>
            <button
              class="btn-icon-small delete"
              onclick={() => removeOption(index)}
              disabled={formData.options.length === 1}
              title="Remove"
            >
              <TrashBinOutline size="xs" />
            </button>
          </div>
          <div class="option-fields">
            <input
              type="text"
              bind:value={option.name.en}
              placeholder="English"
              class="form-input"
            />
            <input
              type="text"
              bind:value={option.name.ar}
              placeholder="Arabic"
              class="form-input"
              dir="rtl"
            />
            <input
              type="text"
              bind:value={option.name.ku}
              placeholder="Kurdish"
              class="form-input"
              dir="rtl"
            />
          </div>
        </div>
      {/each}
      <button class="btn-add-attribute" onclick={addOption}>
        <PlusOutline size="xs" />
        <span>{$_("common.add_option") || "Add Option"}</span>
      </button>
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

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }

  .form-input {
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

  .form-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-help {
    font-size: 0.85rem;
    color: #6b7280;
    margin-bottom: 0.75rem;
  }

  .option-group {
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .option-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .option-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .option-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn-icon-small {
    padding: 0.5rem;
    background: #f3f4f6;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn-icon-small:hover:not(:disabled) {
    background: #e5e7eb;
    color: #374151;
  }

  .btn-icon-small.delete:hover:not(:disabled) {
    background: #fee2e2;
    color: #dc2626;
  }

  .btn-icon-small:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-add-attribute {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px dashed #d1d5db;
    border-radius: 0.5rem;
    color: #374151;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
  }

  .btn-add-attribute:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
    color: #1a1a1a;
  }
</style>

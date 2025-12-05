<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";

  export interface OptionFormData {
    name_en: string;
    name_ar: string;
    value: string;
  }

  interface Props {
    show: boolean;
    onClose: () => void;
    onSubmit: (formData: OptionFormData) => void;
    variationType: string;
  }

  let {
    show = $bindable(),
    onClose,
    onSubmit,
    variationType,
  }: Props = $props();

  let formData = $state<OptionFormData>({
    name_en: "",
    name_ar: "",
    value: variationType === "colors" ? "#000000" : "",
  });

  function handleSubmit() {
    onSubmit(formData);
  }

  // Reset form when modal closes
  $effect(() => {
    if (!show) {
      formData = {
        name_en: "",
        name_ar: "",
        value: variationType === "colors" ? "#000000" : "",
      };
    }
  });

  // Update value when variationType changes
  $effect(() => {
    if (variationType === "colors" && !formData.value) {
      formData.value = "#000000";
    }
  });
</script>

<Modal
  bind:show
  title="Add {variationType === 'colors' ? 'Color' : 'Storage'} Option"
  {onClose}
>
  {#snippet body()}
    <div class="form-row">
      <div class="form-group">
        <label for="name-en">Name (English) *</label>
        <input
          id="name-en"
          type="text"
          bind:value={formData.name_en}
          placeholder="Enter name in English"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="name-ar">Name (Arabic) *</label>
        <input
          id="name-ar"
          type="text"
          bind:value={formData.name_ar}
          placeholder="أدخل الاسم بالعربية"
          class="form-input"
          dir="rtl"
        />
      </div>
    </div>

    {#if variationType === "colors"}
      <div class="form-group">
        <label for="color-value">Color Value (Hex) *</label>
        <div class="color-input-wrapper">
          <input
            id="color-value"
            type="color"
            bind:value={formData.value}
            class="color-picker"
          />
          <input
            type="text"
            bind:value={formData.value}
            placeholder="#000000"
            class="form-input"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </div>
        <p class="form-hint">
          Select a color or enter a hex code (e.g., #FF5733)
        </p>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" onclick={onClose}>
      {$_("common.cancel") || "Cancel"}
    </Button>
    <Button variant="primary" onclick={handleSubmit}>
      {$_("common.add") || "Add"}
    </Button>
  {/snippet}
</Modal>

<style>
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
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

  .color-input-wrapper {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .color-picker {
    width: 4rem;
    height: 3rem;
    padding: 0.25rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .color-picker:hover {
    border-color: #9ca3af;
  }

  .color-picker:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #6b7280;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

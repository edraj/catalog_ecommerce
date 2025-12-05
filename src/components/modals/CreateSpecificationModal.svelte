<script lang="ts">
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { Modal, Button } from "@/components/ui";
  import { PlusOutline, TrashBinOutline } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName } from "@/lib/utils/adminUtils";

  export interface SpecificationFormData {
    displayname: string;
    product: string;
    attributes: Record<string, any>;
    customAttributes: Array<{ key: string; value: string }>;
  }

  interface Props {
    show: boolean;
    onClose: () => void;
    onSubmit: (formData: SpecificationFormData) => void;
    products: Array<any>;
    isLoadingProducts: boolean;
  }

  let {
    show = $bindable(),
    onClose,
    onSubmit,
    products,
    isLoadingProducts,
  }: Props = $props();

  let formData = $state<SpecificationFormData>({
    displayname: "",
    product: "",
    attributes: {},
    customAttributes: [{ key: "", value: "" }],
  });

  function addCustomAttribute() {
    formData.customAttributes = [
      ...formData.customAttributes,
      { key: "", value: "" },
    ];
  }

  function removeCustomAttribute(index: number) {
    formData.customAttributes = formData.customAttributes.filter(
      (_, i) => i !== index
    );
  }

  function handleSubmit() {
    onSubmit(formData);
  }

  // Reset form when modal closes
  $effect(() => {
    if (!show) {
      formData = {
        displayname: "",
        product: "",
        attributes: {},
        customAttributes: [{ key: "", value: "" }],
      };
    }
  });
</script>

<Modal
  bind:show
  title={$_("admin_dashboard.create_specification") || "Create Specification"}
  size="large"
  {onClose}
>
  {#snippet body()}
    <div class="form-group">
      <label for="specification-name">{$_("common.name") || "Name"} *</label>
      <input
        id="specification-name"
        type="text"
        bind:value={formData.displayname}
        placeholder={$_("admin_dashboard.enter_specification_name") ||
          "Enter specification name (e.g., 'iPhone 15 - 128GB - Blue')"}
        class="form-input"
      />
    </div>
    <div class="form-group">
      <label for="specification-product"
        >{$_("common.product") || "Product"} *</label
      >
      {#if isLoadingProducts}
        <div class="loading-message">Loading products...</div>
      {:else if products.length === 0}
        <div class="warning-message">
          <p>⚠️ No products found. Please create products first.</p>
          <button
            class="btn-link"
            onclick={() => window.open("/dashboard/admin/products", "_blank")}
            type="button"
          >
            Go to Products Management
          </button>
        </div>
      {:else}
        <select
          id="specification-product"
          bind:value={formData.product}
          class="form-input"
        >
          <option value=""
            >{$_("common.select_product") || "Select a product"}</option
          >
          {#each products as product}
            <option value={product.shortname}
              >{getLocalizedDisplayName(product, $locale)}</option
            >
          {/each}
        </select>
      {/if}
    </div>
    <div class="form-group">
      <label>{$_("common.attributes") || "Attributes"} *</label>
      <p class="form-help">
        {$_("admin_dashboard.attributes_help") ||
          "Define the variations (e.g., Color: Blue, Storage: 128GB)"}
      </p>
      {#each formData.customAttributes as attr, index}
        <div class="attribute-row">
          <input
            type="text"
            bind:value={attr.key}
            placeholder={$_("common.attribute_name") ||
              "Attribute name (e.g., Color)"}
            class="form-input attribute-key-input"
          />
          <input
            type="text"
            bind:value={attr.value}
            placeholder={$_("common.attribute_value") || "Value (e.g., Blue)"}
            class="form-input attribute-value-input"
          />
          <button
            class="btn-icon-small delete"
            onclick={() => removeCustomAttribute(index)}
            disabled={formData.customAttributes.length === 1}
            title="Remove"
          >
            <TrashBinOutline size="xs" />
          </button>
        </div>
      {/each}
      <button class="btn-add-attribute" onclick={addCustomAttribute}>
        <PlusOutline size="xs" />
        <span>{$_("common.add_attribute") || "Add Attribute"}</span>
      </button>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" onclick={onClose}>
      {$_("common.cancel") || "Cancel"}
    </Button>
    <Button variant="primary" onclick={handleSubmit}>
      {$_("common.create") || "Create"}
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

  .loading-message {
    padding: 1rem;
    text-align: center;
    color: #6b7280;
    background: #f9fafb;
    border-radius: 0.5rem;
  }

  .warning-message {
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 0.5rem;
    text-align: center;
  }

  .warning-message p {
    margin: 0 0 0.75rem 0;
    color: #92400e;
  }

  .btn-link {
    color: #2563eb;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .attribute-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    align-items: center;
  }

  .attribute-key-input {
    flex: 1;
  }

  .attribute-value-input {
    flex: 1.5;
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

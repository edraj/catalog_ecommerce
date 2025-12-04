<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    PlusOutline,
    EditOutline,
    TrashBinOutline,
  } from "flowbite-svelte-icons";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let variations = $state([]);
  let isLoading = $state(true);
  let selectedVariation = $state(null);
  let showAddOptionModal = $state(false);
  let showEditOptionModal = $state(false);
  let showDeleteOptionModal = $state(false);
  let selectedOption = $state(null);

  let optionForm = $state({
    name_en: "",
    name_ar: "",
    value: "",
  });

  function generateKey(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let key = "";
    for (let i = 0; i < 26; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  onMount(async () => {
    await loadVariations();
  });

  async function loadVariations() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "variations",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        variations = response.records;
      }
    } catch (error) {
      console.error("Error loading variations:", error);
      errorToastMessage("Failed to load variations");
    } finally {
      isLoading = false;
    }
  }

  function openAddOptionModal(variation) {
    selectedVariation = variation;
    optionForm = {
      name_en: "",
      name_ar: "",
      value: variation.shortname === "colors" ? "#000000" : "",
    };
    showAddOptionModal = true;
  }

  function closeAddOptionModal() {
    showAddOptionModal = false;
    selectedVariation = null;
  }

  function openEditOptionModal(variation, option) {
    selectedVariation = variation;
    selectedOption = option;
    optionForm = {
      name_en: option.name?.en || "",
      name_ar: option.name?.ar || "",
      value: option.value || "",
    };
    showEditOptionModal = true;
  }

  function closeEditOptionModal() {
    showEditOptionModal = false;
    selectedVariation = null;
    selectedOption = null;
  }

  function openDeleteOptionModal(variation, option) {
    selectedVariation = variation;
    selectedOption = option;
    showDeleteOptionModal = true;
  }

  function closeDeleteOptionModal() {
    showDeleteOptionModal = false;
    selectedVariation = null;
    selectedOption = null;
  }

  async function handleAddOption() {
    if (!optionForm.name_en.trim() && !optionForm.name_ar.trim()) {
      errorToastMessage("Please enter an option name");
      return;
    }

    if (selectedVariation.shortname === "colors" && !optionForm.value.trim()) {
      errorToastMessage("Please enter a color value");
      return;
    }

    try {
      const currentOptions = getVariationOptions(selectedVariation);

      const newOption: any = {
        key: generateKey(),
        name: {
          en: optionForm.name_en,
          ar: optionForm.name_ar,
        },
      };

      if (selectedVariation.shortname === "colors") {
        newOption.value = optionForm.value;
      }

      const updatedOptions = [...currentOptions, newOption];

      const payloadBody = selectedVariation.attributes?.payload?.body || {};

      const variationData = {
        ...payloadBody,
        payload: {
          body: {
            options: updatedOptions,
          },
          content_type: "json",
        },
      };

      await updateEntity(
        selectedVariation.shortname,
        "e_commerce",
        selectedVariation.subpath,
        selectedVariation.resource_type,
        JSON.stringify(variationData),
        "",
        ""
      );

      successToastMessage("Option added successfully!");
      closeAddOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error adding option:", error);
      errorToastMessage("Failed to add option");
    }
  }

  async function handleUpdateOption() {
    if (!optionForm.name_en.trim() && !optionForm.name_ar.trim()) {
      errorToastMessage("Please enter an option name");
      return;
    }

    if (selectedVariation.shortname === "colors" && !optionForm.value.trim()) {
      errorToastMessage("Please enter a color value");
      return;
    }

    try {
      const currentOptions = getVariationOptions(selectedVariation);

      const updatedOptions = currentOptions.map((opt) => {
        if (opt.key === selectedOption.key) {
          const updated: any = {
            key: opt.key,
            name: {
              en: optionForm.name_en,
              ar: optionForm.name_ar,
            },
          };

          if (selectedVariation.shortname === "colors") {
            updated.value = optionForm.value;
          }

          return updated;
        }
        return opt;
      });

      const payloadBody = selectedVariation.attributes?.payload?.body || {};

      const variationData = {
        ...payloadBody,
        payload: {
          body: {
            options: updatedOptions,
          },
          content_type: "json",
        },
      };

      await updateEntity(
        selectedVariation.shortname,
        "e_commerce",
        selectedVariation.subpath,
        selectedVariation.resource_type,
        JSON.stringify(variationData),
        "",
        ""
      );

      successToastMessage("Option updated successfully!");
      closeEditOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error updating option:", error);
      errorToastMessage("Failed to update option");
    }
  }

  async function handleDeleteOption() {
    try {
      const currentOptions = getVariationOptions(selectedVariation);

      const updatedOptions = currentOptions.filter(
        (opt) => opt.key !== selectedOption.key
      );

      const payloadBody = selectedVariation.attributes?.payload?.body || {};

      const variationData = {
        ...payloadBody,
        payload: {
          body: {
            options: updatedOptions,
          },
          content_type: "json",
        },
      };

      await updateEntity(
        selectedVariation.shortname,
        "e_commerce",
        selectedVariation.subpath,
        selectedVariation.resource_type,
        JSON.stringify(variationData),
        "",
        ""
      );

      successToastMessage("Option deleted successfully!");
      closeDeleteOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error deleting option:", error);
      errorToastMessage("Failed to delete option");
    }
  }

  function getLocalizedDisplayName(item) {
    const displayname = item?.attributes?.displayname;

    if (!displayname) {
      return item?.shortname || "Untitled";
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item?.shortname || "Untitled";
  }

  function getOptionName(option) {
    const name = option?.name;
    if (!name) return "Unnamed";

    return name[$locale] || name.en || name.ar || "Unnamed";
  }

  function getVariationOptions(variation) {
    return variation.attributes?.payload?.body?.options || [];
  }
</script>

<div class="variations-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.variations") || "Variations Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.variations_description") ||
          "Manage product variations like colors and storage options"}
      </p>
    </div>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if variations.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎨</div>
      <h3>{$_("admin_dashboard.no_variations") || "No variations found"}</h3>
      <p>
        {$_("admin_dashboard.no_variations_description") ||
          "Variations should be created at the backend level"}
      </p>
    </div>
  {:else}
    <div class="variations-grid">
      {#each variations as variation}
        <div class="variation-card">
          <div class="variation-header">
            <div class="variation-info">
              <h3 class="variation-name">
                {getLocalizedDisplayName(variation)}
              </h3>
              <span class="variation-shortname">{variation.shortname}</span>
            </div>
            <button
              class="btn-add"
              onclick={() => openAddOptionModal(variation)}
              title="Add option"
            >
              <PlusOutline size="sm" />
              <span>Add Option</span>
            </button>
          </div>

          <div class="variation-body">
            {#if getVariationOptions(variation).length === 0}
              <div class="no-options">
                <p>No options available. Click "Add Option" to create one.</p>
              </div>
            {:else}
              <div class="options-list">
                {#each getVariationOptions(variation) as option}
                  <div class="option-item">
                    <div class="option-content">
                      {#if variation.shortname === "colors" && option.value}
                        <span
                          class="color-preview"
                          style="background-color: {option.value}"
                          title={option.value}
                        ></span>
                      {/if}
                      <div class="option-details">
                        <span class="option-name">{getOptionName(option)}</span>
                        {#if variation.shortname === "colors" && option.value}
                          <span class="option-value">{option.value}</span>
                        {/if}
                      </div>
                    </div>
                    <div class="option-actions">
                      <button
                        class="btn-icon"
                        onclick={() => openEditOptionModal(variation, option)}
                        title="Edit"
                      >
                        <EditOutline size="xs" />
                      </button>
                      <button
                        class="btn-icon delete"
                        onclick={() => openDeleteOptionModal(variation, option)}
                        title="Delete"
                      >
                        <TrashBinOutline size="xs" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="variation-footer">
            <span class="options-count">
              {getVariationOptions(variation).length} option(s)
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Option Modal -->
{#if showAddOptionModal}
  <div class="modal-overlay" onclick={closeAddOptionModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          Add {selectedVariation?.shortname === "colors" ? "Color" : "Storage"} Option
        </h2>
        <button class="modal-close" onclick={closeAddOptionModal}>
          &times;
        </button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label for="name-en">Name (English) *</label>
            <input
              id="name-en"
              type="text"
              bind:value={optionForm.name_en}
              placeholder="Enter name in English"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="name-ar">Name (Arabic) *</label>
            <input
              id="name-ar"
              type="text"
              bind:value={optionForm.name_ar}
              placeholder="أدخل الاسم بالعربية"
              class="form-input"
              dir="rtl"
            />
          </div>
        </div>

        {#if selectedVariation?.shortname === "colors"}
          <div class="form-group">
            <label for="color-value">Color Value (Hex) *</label>
            <div class="color-input-wrapper">
              <input
                id="color-value"
                type="color"
                bind:value={optionForm.value}
                class="color-picker"
              />
              <input
                type="text"
                bind:value={optionForm.value}
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
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeAddOptionModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleAddOption}>
          {$_("common.add") || "Add"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Option Modal -->
{#if showEditOptionModal}
  <div class="modal-overlay" onclick={closeEditOptionModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          Edit {selectedVariation?.shortname === "colors" ? "Color" : "Storage"}
          Option
        </h2>
        <button class="modal-close" onclick={closeEditOptionModal}>
          &times;
        </button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label for="edit-name-en">Name (English) *</label>
            <input
              id="edit-name-en"
              type="text"
              bind:value={optionForm.name_en}
              placeholder="Enter name in English"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="edit-name-ar">Name (Arabic) *</label>
            <input
              id="edit-name-ar"
              type="text"
              bind:value={optionForm.name_ar}
              placeholder="أدخل الاسم بالعربية"
              class="form-input"
              dir="rtl"
            />
          </div>
        </div>

        {#if selectedVariation?.shortname === "colors"}
          <div class="form-group">
            <label for="edit-color-value">Color Value (Hex) *</label>
            <div class="color-input-wrapper">
              <input
                id="edit-color-value"
                type="color"
                bind:value={optionForm.value}
                class="color-picker"
              />
              <input
                type="text"
                bind:value={optionForm.value}
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
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeEditOptionModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={handleUpdateOption}>
          {$_("common.update") || "Update"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Option Modal -->
{#if showDeleteOptionModal}
  <div class="modal-overlay" onclick={closeDeleteOptionModal}>
    <div class="modal-container small" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin_dashboard.delete_option") || "Delete Option"}</h2>
        <button class="modal-close" onclick={closeDeleteOptionModal}>
          &times;
        </button>
      </div>

      <div class="modal-body">
        <div class="delete-warning">
          <div class="warning-icon">⚠️</div>
          <p>Are you sure you want to delete this option?</p>
          <p class="option-name-highlight">
            {selectedOption ? getOptionName(selectedOption) : ""}
          </p>
          <p class="warning-text">
            This action cannot be undone and may affect products using this
            option.
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDeleteOptionModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" onclick={handleDeleteOption}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .variations-page {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 2rem 1rem;
  }

  .rtl {
    direction: rtl;
  }

  .header {
    margin-bottom: 2rem;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .page-description {
    font-size: 0.95rem;
    color: #6b7280;
    margin: 0;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
    background: white;
    border-radius: 1rem;
    padding: 3rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .empty-state {
    text-align: center;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: #6b7280;
    margin: 0;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-state p {
    color: #6b7280;
    font-size: 0.95rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .variations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .variation-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    transition: all 0.2s;
  }

  .variation-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .variation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .variation-info {
    flex: 1;
    min-width: 0;
  }

  .variation-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 0.25rem 0;
  }

  .variation-shortname {
    font-size: 0.75rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-add:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
  }

  .variation-body {
    padding: 1.5rem;
    min-height: 200px;
  }

  .no-options {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 150px;
    text-align: center;
  }

  .no-options p {
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .option-item:hover {
    background: #f3f4f6;
  }

  .option-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .color-preview {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.375rem;
    border: 2px solid white;
    box-shadow: 0 0 0 1px #e5e7eb;
    flex-shrink: 0;
  }

  .option-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .option-name {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-value {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: monospace;
  }

  .option-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-icon {
    padding: 0.375rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon:hover {
    background: #f9fafb;
    color: #374151;
    border-color: #d1d5db;
  }

  .btn-icon.delete:hover {
    background: #fee2e2;
    color: #dc2626;
    border-color: #fca5a5;
  }

  .variation-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .options-count {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    padding: 1rem;
  }

  .modal-container {
    background: white;
    border-radius: 0.75rem;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }

  .modal-container.small {
    max-width: 420px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #f3f4f6;
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .modal-body {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }

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

  .delete-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .delete-warning p {
    color: #6b7280;
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .option-name-highlight {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 1.125rem;
    margin: 1rem 0 !important;
  }

  .warning-text {
    font-size: 0.875rem;
    color: #dc2626;
    margin-top: 1rem !important;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #f3f4f6;
    flex-shrink: 0;
  }

  .btn-secondary,
  .btn-primary,
  .btn-danger {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }

  .btn-danger:hover {
    background: #b91c1c;
  }

  @media (max-width: 768px) {
    .variations-page {
      padding: 1rem;
    }

    .variations-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .modal-container {
      margin: 0;
      border-radius: 0;
      max-height: 100vh;
    }

    .variation-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .btn-add {
      width: 100%;
      justify-content: center;
    }
  }
</style>

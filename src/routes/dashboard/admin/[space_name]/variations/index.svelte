<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
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
  import { getLocalizedDisplayName, generateKey } from "@/lib/utils/adminUtils";
  import { getVariationOptions, getOptionName } from "@/lib/utils/entityUtils";
  import { validateOptionForm } from "@/lib/utils/validationUtils";
  import { formatNumber } from "@/lib/helpers";
  import {
    Button,
    IconButton,
    FormInput,
    LoadingSpinner,
    EmptyState,
  } from "@/components/ui";
  import {
    AddOptionModal,
    EditOptionModal,
    DeleteOptionModal,
  } from "@/components/modals";
  import type { OptionFormData } from "@/components/modals/AddOptionModal.svelte";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let variations = $state([]);
  let isLoading = $state(true);
  let selectedVariation = $state(null);
  let showAddOptionModal = $state(false);
  let showEditOptionModal = $state(false);
  let showDeleteOptionModal = $state(false);
  let selectedOption = $state(null);
  let editFormData = $state<OptionFormData | undefined>(undefined);

  let searchQueries = $state<Record<string, string>>({});
  let expandedVariations = $state<Record<string, boolean>>({});
  const INITIAL_DISPLAY_COUNT = 10;

  function getFilteredOptions(variation: any) {
    const options = getVariationOptions(variation);
    const searchQuery = searchQueries[variation.shortname]?.toLowerCase() || "";

    if (!searchQuery) return options;

    return options.filter((option: any) => {
      const nameEn = option.name?.en?.toLowerCase() || "";
      const nameAr = option.name?.ar?.toLowerCase() || "";
      const value = option.value?.toLowerCase() || "";
      return (
        nameEn.includes(searchQuery) ||
        nameAr.includes(searchQuery) ||
        value.includes(searchQuery)
      );
    });
  }

  function getDisplayedOptions(variation: any) {
    const filtered = getFilteredOptions(variation);
    const isExpanded = expandedVariations[variation.shortname];

    if (isExpanded || filtered.length <= INITIAL_DISPLAY_COUNT) {
      return filtered;
    }

    return filtered.slice(0, INITIAL_DISPLAY_COUNT);
  }

  function toggleExpanded(shortname: string) {
    expandedVariations[shortname] = !expandedVariations[shortname];
  }

  function updateSearch(shortname: string, value: string) {
    searchQueries[shortname] = value;
  }

  onMount(async () => {
    await loadVariations();
  });

  async function loadVariations() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        100,
        0,
        true,
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
    showAddOptionModal = true;
  }

  function closeAddOptionModal() {
    showAddOptionModal = false;
    selectedVariation = null;
  }

  function openEditOptionModal(variation, option) {
    selectedVariation = variation;
    selectedOption = option;
    editFormData = {
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

  async function handleAddOption(formData: OptionFormData) {
    if (!formData.name_en.trim() && !formData.name_ar.trim()) {
      errorToastMessage("Please enter an option name");
      return;
    }

    if (selectedVariation.shortname === "colors" && !formData.value.trim()) {
      errorToastMessage("Please enter a color value");
      return;
    }

    try {
      const currentOptions = getVariationOptions(selectedVariation);

      const newOption: any = {
        key: generateKey(),
        name: {
          en: formData.name_en,
          ar: formData.name_ar,
        },
      };

      if (selectedVariation.shortname === "colors") {
        newOption.value = formData.value;
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
        website.main_space,
        selectedVariation.subpath,
        selectedVariation.resource_type,
        JSON.stringify(variationData),
        "",
        "",
      );

      successToastMessage("Option added successfully!");
      closeAddOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error adding option:", error);
      errorToastMessage("Failed to add option");
    }
  }

  async function handleUpdateOption(formData: OptionFormData) {
    if (!formData.name_en.trim() && !formData.name_ar.trim()) {
      errorToastMessage("Please enter an option name");
      return;
    }

    if (selectedVariation.shortname === "colors" && !formData.value.trim()) {
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
              en: formData.name_en,
              ar: formData.name_ar,
            },
          };

          if (selectedVariation.shortname === "colors") {
            updated.value = formData.value;
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
        website.main_space,
        selectedVariation.subpath,
        selectedVariation.resource_type,
        JSON.stringify(variationData),
        "",
        "",
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
        (opt) => opt.key !== selectedOption.key,
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
        website.main_space,
        selectedVariation.subpath,
        selectedVariation.resource_type,
        JSON.stringify(variationData),
        "",
        "",
      );

      successToastMessage("Option deleted successfully!");
      closeDeleteOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error deleting option:", error);
      errorToastMessage("Failed to delete option");
    }
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
    <LoadingSpinner message={$_("common.loading") || "Loading..."} />
  {:else if variations.length === 0}
    <EmptyState
      icon="🎨"
      title={$_("admin_dashboard.no_variations") || "No variations found"}
      description={$_("admin_dashboard.no_variations_description") ||
        "Variations should be created at the backend level"}
    />
  {:else}
    <div class="variations-grid">
      {#each variations as variation}
        <div class="variation-card">
          <div class="variation-header">
            <div class="variation-info">
              <h3 class="variation-name">
                {getLocalizedDisplayName(variation, $locale)}
              </h3>
              <span class="variation-shortname">{variation.shortname}</span>
            </div>
            <Button
              variant="primary"
              onclick={() => openAddOptionModal(variation)}
            >
              <PlusOutline size="sm" />
              <span>{$_("admin_dashboard.add_option") || "Add Option"}</span>
            </Button>
          </div>

          <div class="variation-body">
            {#if getVariationOptions(variation).length === 0}
              <div class="no-options">
                <p>
                  {$_("admin_dashboard.no_options_available") ||
                    'No options available. Click "Add Option" to create one.'}
                </p>
              </div>
            {:else}
              <!-- Search Bar -->
              {#if getVariationOptions(variation).length > 5}
                <div class="search-container">
                  <input
                    type="text"
                    placeholder={$_("admin_dashboard.search_options") ||
                      "Search options..."}
                    value={searchQueries[variation.shortname] || ""}
                    oninput={(e) =>
                      updateSearch(
                        variation.shortname,
                        (e.target as HTMLInputElement).value,
                      )}
                    class="search-input"
                  />
                  <span class="search-icon">🔍</span>
                </div>
              {/if}

              <!-- Options List -->
              {#if getFilteredOptions(variation).length === 0}
                <div class="no-results">
                  <p>
                    {$_("admin_dashboard.no_options_found") ||
                      "No options found matching your search."}
                  </p>
                </div>
              {:else}
                <div class="options-list">
                  {#each getDisplayedOptions(variation) as option}
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
                          <span class="option-name"
                            >{getOptionName(option, $locale)}</span
                          >
                          {#if variation.shortname === "colors" && option.value}
                            <span class="option-value">{option.value}</span>
                          {/if}
                        </div>
                      </div>
                      <div class="option-actions">
                        <IconButton
                          onclick={() => openEditOptionModal(variation, option)}
                          title={$_("Edit") || "Edit"}
                        >
                          <EditOutline size="xs" />
                        </IconButton>
                        <IconButton
                          variant="delete"
                          onclick={() =>
                            openDeleteOptionModal(variation, option)}
                          title={$_("common.delete") || "Delete"}
                        >
                          <TrashBinOutline size="xs" />
                        </IconButton>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Show More/Less Button -->
                {#if getFilteredOptions(variation).length > INITIAL_DISPLAY_COUNT}
                  <button
                    class="show-more-btn"
                    onclick={() => toggleExpanded(variation.shortname)}
                  >
                    {#if expandedVariations[variation.shortname]}
                      <span
                        >{$_("admin_dashboard.show_less") || "Show Less"}</span
                      >
                      <span class="arrow">▲</span>
                    {:else}
                      <span
                        >{$_("admin_dashboard.show_more") || "Show More"} ({getFilteredOptions(
                          variation,
                        ).length - INITIAL_DISPLAY_COUNT}
                        {$_("common.more") || "more"})</span
                      >
                      <span class="arrow">▼</span>
                    {/if}
                  </button>
                {/if}
              {/if}
            {/if}
          </div>

          <div class="variation-footer">
            <span class="options-count">
              {#if searchQueries[variation.shortname]}
                {getFilteredOptions(variation).length}
                {$_("of") || "of"}
                {getVariationOptions(variation).length}
                {$_("admin_dashboard.options_count") || "option(s)"}
              {:else}
                {getVariationOptions(variation).length}
                {$_("admin_dashboard.options_count") || "option(s)"}
              {/if}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Components -->
<AddOptionModal
  bind:show={showAddOptionModal}
  onClose={closeAddOptionModal}
  onSubmit={handleAddOption}
  variationType={selectedVariation?.shortname || ""}
/>

<EditOptionModal
  bind:show={showEditOptionModal}
  onClose={closeEditOptionModal}
  onSubmit={handleUpdateOption}
  variationType={selectedVariation?.shortname || ""}
  option={selectedOption}
  initialData={editFormData}
/>

<DeleteOptionModal
  bind:show={showDeleteOptionModal}
  onClose={closeDeleteOptionModal}
  onConfirm={handleDeleteOption}
  option={selectedOption}
/>

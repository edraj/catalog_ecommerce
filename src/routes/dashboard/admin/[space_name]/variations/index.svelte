<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
  import { getSpaceContents, updateEntity } from "@/lib/dmart_services";
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
  import { formatNumber } from "@/lib/helpers";
  import {
    Button,
    IconButton,
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

  const isRTL = derived(locale, ($l) => $l === "ar" || $l === "ku");

  let variations = $state<any[]>([]);
  let isLoading = $state(true);

  // Tabs: only colors + storages
  type TabKey = "colors" | "storages";
  let activeTab = $state<TabKey>("colors");

  // Search (single input filters active tab)
  let searchQuery = $state("");

  // Modals
  let selectedVariation = $state<any>(null);
  let showAddOptionModal = $state(false);
  let showEditOptionModal = $state(false);
  let showDeleteOptionModal = $state(false);
  let selectedOption = $state<any>(null);
  let editFormData = $state<OptionFormData | undefined>(undefined);

  // -------- helpers ----------
  function getVariationByShortname(shortname: string) {
    return variations.find((v) => v?.shortname === shortname) || null;
  }

  let colorsVariation = $derived.by(() => getVariationByShortname("colors"));
  let storagesVariation = $derived.by(() =>
    getVariationByShortname("storages"),
  );

  function getOptionsSafe(variation: any) {
    return getVariationOptions(variation) || [];
  }

  function filterOptions(variation: any) {
    const options = getOptionsSafe(variation);
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return options;

    return options.filter((option: any) => {
      const nameEn = option.name?.en?.toLowerCase() || "";
      const nameAr = option.name?.ar?.toLowerCase() || "";
      const value = option.value?.toLowerCase?.() || "";
      return nameEn.includes(q) || nameAr.includes(q) || value.includes(q);
    });
  }

  let activeVariation = $derived.by(() =>
    activeTab === "colors" ? colorsVariation : storagesVariation,
  );

  let activeOptions = $derived.by(() => filterOptions(activeVariation));
  let totalColors = $derived.by(() => getOptionsSafe(colorsVariation).length);
  let totalStorages = $derived.by(
    () => getOptionsSafe(storagesVariation).length,
  );

  // Stats shows totals (as requested)
  let statLeftLabel = $derived.by(() => "Total Colors");
  let statLeftValue = $derived.by(() => totalColors);
  let statRightLabel = $derived.by(() => "Total Storages");
  let statRightValue = $derived.by(() => totalStorages);

  onMount(async () => {
    await loadVariations();
  });

  async function loadVariations() {
    isLoading = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        100,
        0,
        true,
      );

      if (response?.records) {
        variations = response.records;

        // Default tab if one is missing
        if (
          !getVariationByShortname("colors") &&
          getVariationByShortname("storages")
        ) {
          activeTab = "storages";
        } else {
          activeTab = "colors";
        }
      }
    } catch (error) {
      console.error("Error loading variations:", error);
      errorToastMessage("Failed to load variations");
    } finally {
      isLoading = false;
    }
  }

  function setTab(tab: TabKey) {
    activeTab = tab;
    searchQuery = "";
  }

  // ---------- Modals ----------
  function openAddOptionModal(variation: any) {
    selectedVariation = variation;
    showAddOptionModal = true;
  }
  function closeAddOptionModal() {
    showAddOptionModal = false;
    selectedVariation = null;
  }

  function openEditOptionModal(variation: any, option: any) {
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

  function openDeleteOptionModal(variation: any, option: any) {
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
    if (!selectedVariation) return;

    if (!formData.name_en.trim() && !formData.name_ar.trim()) {
      errorToastMessage("Please enter an option name");
      return;
    }

    if (selectedVariation.shortname === "colors" && !formData.value.trim()) {
      errorToastMessage("Please enter a color value");
      return;
    }

    try {
      const currentOptions = getOptionsSafe(selectedVariation);

      const newOption: any = {
        key: generateKey(),
        name: { en: formData.name_en, ar: formData.name_ar },
      };

      if (selectedVariation.shortname === "colors")
        newOption.value = formData.value;

      const updatedOptions = [...currentOptions, newOption];

      const payloadBody = selectedVariation.attributes?.payload?.body || {};
      const variationData = {
        ...payloadBody,
        payload: {
          body: { options: updatedOptions },
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
    if (!selectedVariation || !selectedOption) return;

    if (!formData.name_en.trim() && !formData.name_ar.trim()) {
      errorToastMessage("Please enter an option name");
      return;
    }

    if (selectedVariation.shortname === "colors" && !formData.value.trim()) {
      errorToastMessage("Please enter a color value");
      return;
    }

    try {
      const currentOptions = getOptionsSafe(selectedVariation);

      const updatedOptions = currentOptions.map((opt: any) => {
        if (opt.key !== selectedOption.key) return opt;

        const updated: any = {
          key: opt.key,
          name: { en: formData.name_en, ar: formData.name_ar },
        };

        if (selectedVariation.shortname === "colors")
          updated.value = formData.value;
        return updated;
      });

      const payloadBody = selectedVariation.attributes?.payload?.body || {};
      const variationData = {
        ...payloadBody,
        payload: {
          body: { options: updatedOptions },
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
    if (!selectedVariation || !selectedOption) return;

    try {
      const currentOptions = getOptionsSafe(selectedVariation);
      const updatedOptions = currentOptions.filter(
        (opt: any) => opt.key !== selectedOption.key,
      );

      const payloadBody = selectedVariation.attributes?.payload?.body || {};
      const variationData = {
        ...payloadBody,
        payload: {
          body: { options: updatedOptions },
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

  function activeTabTitle() {
    return activeTab === "colors"
      ? $_("admin_dashboard.colors") || "Colors"
      : $_("admin_dashboard.storages") || "Storages";
  }

  function activeTabEmptyIcon() {
    return activeTab === "colors" ? "🎨" : "💾";
  }

  function activeTabEmptyText() {
    return activeTab === "colors" ? "No colors found" : "No storages found";
  }
  let totalVariationsAvailable = $derived.by(() => {
    const hasColors = !!colorsVariation;
    const hasStorages = !!storagesVariation;
    return (hasColors ? 1 : 0) + (hasStorages ? 1 : 0);
  });
  let openDropdownKey = $state<string | null>(null);

  function toggleDropdown(key: string) {
    openDropdownKey = openDropdownKey === key ? null : key;
  }

  function closeDropdown() {
    openDropdownKey = null;
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
  {:else if !colorsVariation && !storagesVariation}
    <EmptyState
      icon="⚠️"
      title={$_("admin_dashboard.no_variations") || "Variations not found"}
      description={"Expected variations: colors, storages"}
    />
  {:else}
    <!-- Stats (totals only) -->
    <div class="stats-grid" style="margin-bottom: 16px;">
      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">{statLeftLabel}</h3>
          <p class="stat-value">{statLeftValue}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">{statRightLabel}</h3>
          <p class="stat-value">{statRightValue}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M18.4612 7.5C18.4611 7.5 18.4612 7.5 18.4612 7.5V7.5ZM18.4744 7.50001L27.0568 7.51047C27.0578 7.51048 27.0588 7.51049 27.0598 7.5105C27.4433 7.51362 27.8101 7.66835 28.0799 7.94096C28.3505 8.21429 28.5016 8.58379 28.5 8.96838L28.5 17.2208C28.4868 17.2332 28.4738 17.2458 28.461 17.2587L17.328 28.483L7.50172 18.57L18.4744 7.50001ZM18.4688 4.50001C18.4684 4.50001 18.4692 4.50001 18.4688 4.50001L27.0751 4.51051C28.2543 4.51769 29.3824 4.99241 30.212 5.83046C31.0409 6.66778 31.504 7.79948 31.5 8.97757C31.5 8.97859 31.5 8.97961 31.5 8.98063L30 8.9745H31.5V8.97757V17.2243C31.5 17.6346 31.4156 18.0407 31.2521 18.417C31.093 18.7829 30.8624 19.1131 30.574 19.3884L30.591 19.3713L29.526 18.315L30.5491 19.4119C30.5575 19.4041 30.5658 19.3963 30.574 19.3884L19.4336 30.6201L18.3676 29.5652L19.4325 30.6213C19.1575 30.8989 18.8303 31.1193 18.4698 31.2699C18.1087 31.4207 17.7214 31.4985 17.3301 31.4987C16.9389 31.499 16.5514 31.4218 16.1902 31.2715C15.8289 31.1212 15.501 30.9009 15.2254 30.6232L5.36657 20.6774L6.43048 19.62L5.36517 20.676C4.80937 20.116 4.49744 19.359 4.49744 18.57C4.49744 17.7807 4.80962 17.0234 5.36584 16.4633L16.3644 5.36719C16.6409 5.09132 16.9691 4.87273 17.3302 4.72392C17.6909 4.57526 18.0786 4.49918 18.4688 4.50001ZM21.8745 12.6672C21.8745 11.8388 22.5461 11.1672 23.3745 11.1672H23.3895C24.2179 11.1672 24.8895 11.8388 24.8895 12.6672C24.8895 13.4957 24.2179 14.1672 23.3895 14.1672H23.3745C22.5461 14.1672 21.8745 13.4957 21.8745 12.6672Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Total Variations Available</h3>
          <p class="stat-value">{totalVariationsAvailable}</p>
        </div>
      </div>
    </div>

    <!-- Tabs + Search + Add -->
    <div class="bg-white rounded-t-xl w-full p-6" style="margin-bottom: 0;">
      <div class="flex flex-col gap-4">
        <!-- Tabs -->
        <div class="tabs-row">
          <button
            type="button"
            class="tab-btn"
            class:active={activeTab === "colors"}
            onclick={() => setTab("colors")}
          >
            {$_("admin_dashboard.colors") || "Colors"}
            <span class="tab-badge">{totalColors}</span>
          </button>

          <button
            type="button"
            class="tab-btn"
            class:active={activeTab === "storages"}
            onclick={() => setTab("storages")}
          >
            {$_("admin_dashboard.storages") || "Storages"}
            <span class="tab-badge">{totalStorages}</span>
          </button>
        </div>

        <!-- Controls -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <!-- Search (only filter) -->
          <div class="search-bar">
            <input
              type="text"
              placeholder={$_("admin_dashboard.search_options") || "Search..."}
              bind:value={searchQuery}
              class="search-input"
            />
            <span class="search-icon">🔍</span>
          </div>

          <!-- Add (based on active tab) -->
          {#if activeVariation}
            <Button
              variant="primary"
              onclick={() => openAddOptionModal(activeVariation)}
            >
              <PlusOutline size="sm" />
              <span>
                {$_("admin_dashboard.add_option") || "Add Option"} ({activeTabTitle()})
              </span>
            </Button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="items-table-container">
      {#if !activeVariation}
        <EmptyState
          icon="⚠️"
          title={"Variation not found"}
          description={activeTab === "colors"
            ? "Missing 'colors' variation"
            : "Missing 'storages' variation"}
        />
      {:else if activeOptions.length === 0}
        <EmptyState
          icon={activeTabEmptyIcon()}
          title={activeTabEmptyText()}
          description={searchQuery
            ? "No results match your search."
            : "Click “Add Option” to create one."}
        />
      {:else}
        <div class="items-table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-name">
                  {activeTab === "colors" ? "Color" : "Storage"}
                </th>

                {#if activeTab === "colors"}
                  <th class="col-value">Value</th>
                  <th class="col-preview">Preview</th>
                {/if}

                <th class="col-actions">{$_("common.actions") || "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {#each activeOptions as option (option.key)}
                <tr class="item-row">
                  <td class="col-name">
                    <div class="option-cell">
                      <div
                        class="option-title"
                        title={getOptionName(option, $locale)}
                      >
                        {getOptionName(option, $locale)}
                      </div>
                      <div class="option-sub mono" title={option.key}>
                        {option.key}
                      </div>
                    </div>
                  </td>

                  {#if activeTab === "colors"}
                    <td class="col-value">
                      <span class="mono">{option.value || "-"}</span>
                    </td>

                    <td class="col-preview">
                      {#if option.value}
                        <span
                          class="color-preview"
                          style="background-color: {option.value}"
                          title={option.value}
                        ></span>
                      {:else}
                        <span class="empty-text">-</span>
                      {/if}
                    </td>
                  {/if}

                  <td class="col-actions">
                    <div class="actions-dropdown position-relative">
                      <button
                        class="dropdown-trigger flex items-center jusitfy-center cursor-pointer"
                        onclick={() => toggleDropdown(option.key)}
                      >
                        ⋯
                      </button>

                      {#if openDropdownKey === option.key}
                        <div
                          class="absolute flex flex-col z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                          style={$isRTL ? "right:-90px;" : "left:-90px;"}
                          role="menu"
                        >
                          <button
                            class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                            class:text-right={$isRTL}
                            onclick={() => {
                              closeDropdown();
                              openEditOptionModal(activeVariation, option);
                            }}
                            role="menuitem"
                          >
                            {$_("common.edit") || "Edit"}
                          </button>

                          <button
                            class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                            class:text-right={$isRTL}
                            onclick={() => {
                              closeDropdown();
                              openDeleteOptionModal(activeVariation, option);
                            }}
                            role="menuitem"
                          >
                            {$_("common.delete") || "Delete"}
                          </button>
                        </div>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="table-footer">
          <span class="options-count">
            {activeOptions.length}
            {$_("admin_dashboard.options_count") || "option(s)"}
            {#if searchQuery}
              ({$_("common.filtered") || "filtered"})
            {/if}
          </span>
        </div>
      {/if}
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

<style>
  /* Tabs (lightweight, matches your current style) */
  .tabs-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    color: #374151;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .tab-btn.active {
    background: rgba(60, 48, 127, 0.08);
    border-color: rgba(60, 48, 127, 0.35);
    color: #3c307f;
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 999px;
    background: #f3f4f6;
    color: #111827;
    font-size: 12px;
    font-weight: 800;
  }

  /* Table cells */
  .option-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-title {
    font-weight: 700;
    color: #111827;
  }

  .option-sub {
    font-size: 12px;
    color: #6b7280;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    color: #374151;
  }

  .color-preview {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: inline-block;
    border: 1px solid #e5e7eb;
    vertical-align: middle;
  }

  .table-footer {
    padding: 12px 16px;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 13px;
  }
</style>

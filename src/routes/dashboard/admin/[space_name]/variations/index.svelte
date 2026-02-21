<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
  import { getSpaceContents, updateEntity } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { PlusOutline } from "flowbite-svelte-icons";
  import { generateKey } from "@/lib/utils/adminUtils";
  import { getVariationOptions, getOptionName } from "@/lib/utils/entityUtils";
  import { formatNumber } from "@/lib/helpers";
  import { Button, LoadingSpinner, EmptyState } from "@/components/ui";
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

  // "Filter" (variation type) instead of visible tabs
  type TabKey = "colors" | "storages";
  let activeTab = $state<TabKey>("colors");

  // Search (single input filters active tab)
  let searchQuery = $state("");

  // Pagination
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  // Modals
  let selectedVariation = $state<any>(null);
  let showAddOptionModal = $state(false);
  let showEditOptionModal = $state(false);
  let showDeleteOptionModal = $state(false);
  let selectedOption = $state<any>(null);
  let editFormData = $state<OptionFormData | undefined>(undefined);

  // Dropdowns (like Orders page)
  let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);

  // Row actions dropdown
  let openDropdownKey = $state<string | null>(null);

  // -------- helpers ----------
  function getVariationByShortname(shortname: string) {
    return variations.find((v) => v?.shortname === shortname) || null;
  }

  let colorsVariation = $derived.by(() => getVariationByShortname("colors"));
  let storagesVariation = $derived.by(() =>
    getVariationByShortname("storages"),
  );

  function getOptionsSafe(variation: any) {
    if (!variation) return [];
    return getVariationOptions(variation) || [];
  }

  function filterOptions(variation: any) {
    if (!variation) return [];
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

  let totalOptionsCount = $derived.by(() => activeOptions.length);

  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(totalOptionsCount / itemsPerPage));
  });

  let paginatedOptions = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return activeOptions.slice(start, end);
  });

  let paginationStart = $derived.by(() => {
    return totalOptionsCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    return Math.min(currentPage * itemsPerPage, totalOptionsCount);
  });

  /** Page numbers to show in the pagination bar (numbers or "ellipsis") */
  let visiblePageNumbers = $derived.by(() => {
    const total = totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const cur = currentPage;
    const pages: (number | "ellipsis")[] = [];
    if (cur <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(total);
    } else if (cur >= total - 2) {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = cur - 1; i <= cur + 1; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(total);
    }
    return pages;
  });

  let totalColors = $derived.by(() => getOptionsSafe(colorsVariation).length);
  let totalStorages = $derived.by(
    () => getOptionsSafe(storagesVariation).length,
  );

  // Stats (keep info)
  let statLeftLabel = $derived.by(
    () => $_("admin_dashboard.total_colors_label") || "Total Colors",
  );
  let statLeftValue = $derived.by(() => totalColors);
  let statRightLabel = $derived.by(
    () => $_("admin_dashboard.total_storages_label") || "Total Storages",
  );
  let statRightValue = $derived.by(() => totalStorages);
  let totalVariationsLabel = $derived.by(
    () =>
      $_("admin_dashboard.total_variations_available") ||
      "Total Variations Available",
  );

  let totalVariationsAvailable = $derived.by(() => {
    const hasColors = !!colorsVariation;
    const hasStorages = !!storagesVariation;
    return (hasColors ? 1 : 0) + (hasStorages ? 1 : 0);
  });

  onMount(async () => {
    await loadVariations();
    window.addEventListener("click", onWindowClick);
  });

  onDestroy(() => {
    window.removeEventListener("click", onWindowClick);
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
      errorToastMessage(
        $_("admin_dashboard.error_loading_variations") ||
          "Failed to load variations",
      );
    } finally {
      isLoading = false;
    }
  }

  function setTab(tab: TabKey) {
    activeTab = tab;
    searchQuery = "";
    currentPage = 1;
  }

  // ---------- Dropdown controls (Orders-like) ----------
  function closeAllDropdowns() {
    isFiltersOpen = false;
    isActionsOpen = false;
    openDropdownKey = null;
  }

  function toggleFilters(e?: Event) {
    e?.stopPropagation?.();
    isActionsOpen = false;
    isFiltersOpen = !isFiltersOpen;
  }

  function toggleActions(e?: Event) {
    e?.stopPropagation?.();
    isFiltersOpen = false;
    isActionsOpen = !isActionsOpen;
  }

  function onWindowClick() {
    if (isFiltersOpen || isActionsOpen || openDropdownKey) closeAllDropdowns();
  }

  function activeFiltersCount() {
    // only one "filter": the variation type (colors/storages)
    return 1;
  }

  function resetFilters() {
    activeTab = "colors";
    searchQuery = "";
    currentPage = 1;
  }

  // ---------- Row actions dropdown ----------
  function toggleDropdown(key: string, e?: Event) {
    e?.stopPropagation?.();
    openDropdownKey = openDropdownKey === key ? null : key;
  }

  function closeDropdown() {
    openDropdownKey = null;
  }

  // ---------- Pagination ----------
  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }

  function nextPage() {
    if (currentPage < totalPages) currentPage++;
  }

  function previousPage() {
    if (currentPage > 1) currentPage--;
  }

  $effect(() => {
    // keep page in range
    if (currentPage > totalPages) currentPage = totalPages;
  });

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
      errorToastMessage(
        $_("admin_dashboard.validation.option_name_required") ||
          "Please enter an option name",
      );
      return;
    }

    if (selectedVariation.shortname === "colors" && !formData.value.trim()) {
      errorToastMessage(
        $_("admin_dashboard.validation.color_value_required") ||
          "Please enter a color value",
      );
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
        variationData.payload.body,
        "",
        "",
      );

      successToastMessage(
        $_("admin_dashboard.option_added_success") ||
          "Option added successfully!",
      );
      closeAddOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error adding option:", error);
      errorToastMessage(
        $_("admin_dashboard.option_add_failed") || "Failed to add option",
      );
    }
  }

  async function handleUpdateOption(formData: OptionFormData) {
    if (!selectedVariation || !selectedOption) return;

    if (!formData.name_en.trim() && !formData.name_ar.trim()) {
      errorToastMessage(
        $_("admin_dashboard.validation.option_name_required") ||
          "Please enter an option name",
      );
      return;
    }

    if (selectedVariation.shortname === "colors" && !formData.value.trim()) {
      errorToastMessage(
        $_("admin_dashboard.validation.color_value_required") ||
          "Please enter a color value",
      );
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

      successToastMessage(
        $_("admin_dashboard.option_updated_success") ||
          "Option updated successfully!",
      );
      closeEditOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error updating option:", error);
      errorToastMessage(
        $_("admin_dashboard.option_update_failed") || "Failed to update option",
      );
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

      successToastMessage(
        $_("admin_dashboard.option_deleted_success") ||
          "Option deleted successfully!",
      );
      closeDeleteOptionModal();
      await loadVariations();
    } catch (error) {
      console.error("Error deleting option:", error);
      errorToastMessage(
        $_("admin_dashboard.option_delete_failed") || "Failed to delete option",
      );
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
    return activeTab === "colors"
      ? $_("admin_dashboard.no_colors_found") || "No colors found"
      : $_("admin_dashboard.no_storages_found") || "No storages found";
  }
</script>

<div class="variations-page" class:rtl={$isRTL}>
  {#if isLoading}
    <LoadingSpinner message={$_("common.loading") || "Loading..."} />
  {:else if !colorsVariation && !storagesVariation}
    <EmptyState
      icon="⚠️"
      title={$_("admin_dashboard.no_variations") || "Variations not found"}
      description={$_("admin_dashboard.expected_variations") ||
        "Expected variations: colors, storages"}
    />
  {:else}
    <!-- Stats (keep info) -->
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
              d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
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
              d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z"
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
              d="M18.4744 7.50001L27.0568 7.51047C27.4433 7.51362 27.8101 7.66835 28.0799 7.94096C28.3505 8.21429 28.5016 8.58379 28.5 8.96838L28.5 17.2208L17.328 28.483L7.50172 18.57L18.4744 7.50001ZM18.4688 4.50001L27.0751 4.51051C28.2543 4.51769 29.3824 4.99241 30.212 5.83046C31.0409 6.66778 31.504 7.79948 31.5 8.97757L31.5 17.2243C31.5 17.6346 31.4156 18.0407 31.2521 18.417C31.093 18.7829 30.8624 19.1131 30.574 19.3884L19.4325 30.6213C19.1575 30.8989 18.8303 31.1193 18.4698 31.2699C18.1087 31.4207 17.7214 31.4985 17.3301 31.4987C16.5514 31.4218 15.501 30.9009 15.2254 30.6232L5.36584 20.4633C4.80962 19.9034 4.49744 19.1461 4.49744 18.357C4.49744 17.568 4.80937 16.811 5.36517 16.251L16.3644 5.36719C16.9691 4.87273 17.6909 4.57526 18.4688 4.50001Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">{totalVariationsLabel}</h3>
          <p class="stat-value">{totalVariationsAvailable}</p>
        </div>
      </div>
    </div>

    <!-- Controls header (Orders layout) -->
    <div
      class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <!-- SEARCH -->
      <div>
        <div class="relative w-[256px]">
          <div
            class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
          >
            <svg
              class="w-4 h-4 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          <input
            type="text"
            bind:value={searchQuery}
            oninput={() => (currentPage = 1)}
            placeholder={$_("admin_dashboard.search_options") || "Search..."}
            class="w-full h-9 pl-9 pr-3 py-2
              bg-[#F9FAFB]
              border border-[#E5E7EB]
              rounded-[12px]
              shadow-[0px_1px_0.5px_0.05px_#1D293D05]
              text-sm
              focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      <!-- RIGHT: FILTERS + ACTIONS -->
      <div class="flex items-end gap-3 justify-end">
        {#if activeVariation}
          <button
            type="button"
            class="inline-flex items-center justify-center mx-2 h-9 cursor-pointer px-3 py-2 bg-[#3C307F] text-white text-sm font-medium rounded-[12px] shadow-[0px_1px_0.5px_0.05px_#1D293D05] hover:bg-[#2f2666] transition-colors duration-200 s-YJT1Gee9Kcm3"
            onclick={() => {
              isActionsOpen = false;
              openAddOptionModal(activeVariation);
            }}
          >
            <PlusOutline size="sm" />
            <span>
              {$_("admin_dashboard.add_option") || "Add Option"} ({activeTabTitle()})
            </span>
          </button>
        {/if}

        <!-- FILTERS DROPDOWN -->
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onclick={(e) => toggleFilters(e)}
            class="h-9 inline-flex items-center justify-between cursor-pointer
              px-3 py-2 min-w-[170px]
              bg-[#F9FAFB] border border-[#E5E7EB]
              rounded-[12px]
              shadow-[0px_1px_0.5px_0.05px_#1D293D05]
              text-sm text-gray-700 hover:bg-gray-50"
          >
            <span class="truncate inline-flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M2.46579 4.21134C1.71144 3.34923 2.32369 2 3.46923 2H12.5309C13.6764 2 14.2887 3.34923 13.5343 4.21134L10.0001 8.25049V13C10.0001 13.824 9.05929 14.2944 8.40005 13.8L6.40005 12.3C6.14824 12.1111 6.00005 11.8148 6.00005 11.5V8.25049L2.46579 4.21134ZM12.5309 3.33333H3.46923L7.00349 7.37248C7.21616 7.61554 7.33338 7.92753 7.33338 8.25049V11.3333L8.66672 12.3333V8.25049C8.66672 7.92753 8.78394 7.61554 8.99661 7.37248L12.5309 3.33333Z"
                  fill="#4A5565"
                />
              </svg>

              {$_("admin.filters") || "Filters"}
              <span
                class="inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
              >
                {activeFiltersCount()}
              </span>
            </span>

            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if isFiltersOpen}
            <div
              class="absolute right-0 z-20 mt-2 w-[320px]
                rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
            >
              <div class="grid grid-cols-1 gap-3">
                <!-- Variation Type -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    {$_("admin_dashboard.variation_type") || "Variation Type"}
                  </label>
                  <select
                    bind:value={activeTab}
                    onchange={() => setTab(activeTab)}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    {#if colorsVariation}
                      <option value="colors">
                        {$_("admin_dashboard.colors") || "Colors"} ({totalColors})
                      </option>
                    {/if}
                    {#if storagesVariation}
                      <option value="storages">
                        {$_("admin_dashboard.storages") || "Storages"} ({totalStorages})
                      </option>
                    {/if}
                  </select>
                </div>
              </div>

              <div
                class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100"
              >
                <button
                  type="button"
                  onclick={() => {
                    resetFilters();
                    isFiltersOpen = false;
                  }}
                  class="h-9 inline-flex items-center justify-center
                    px-3 py-2
                    bg-[#F9FAFB] text-gray-700 text-sm font-medium
                    border border-[#E5E7EB]
                    rounded-[12px]
                    hover:bg-gray-50 transition-colors"
                >
                  {$_("admin.reset") || "Reset"}
                </button>

                <button
                  type="button"
                  onclick={() => (isFiltersOpen = false)}
                  class="h-9 inline-flex items-center justify-center
                    px-3 py-2
                    bg-[#3C307F] text-white text-sm font-medium
                    rounded-[12px]
                    hover:bg-[#2f2666] transition-colors"
                >
                  {$_("admin.apply") || "Apply"}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="items-table-container">
      {#if !activeVariation}
        <EmptyState
          icon="⚠️"
          title={$_("admin_dashboard.variation_not_found") ||
            "Variation not found"}
          description={activeTab === "colors"
            ? $_("admin_dashboard.missing_colors_variation") ||
              "Missing 'colors' variation"
            : $_("admin_dashboard.missing_storages_variation") ||
              "Missing 'storages' variation"}
        />
      {:else if activeOptions.length === 0}
        <EmptyState
          icon={activeTabEmptyIcon()}
          title={activeTabEmptyText()}
          description={searchQuery
            ? $_("admin_dashboard.no_search_results") ||
              "No results match your search."
            : $_("admin_dashboard.add_option_hint") ||
              "Use Actions → Add Option to create one."}
        />
      {:else}
        <div class="items-table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-name">
                  {activeTab === "colors"
                    ? $_("admin_dashboard.table_color") || "Color"
                    : $_("admin_dashboard.table_storage") || "Storage"}
                </th>

                {#if activeTab === "colors"}
                  <th class="col-value">
                    {$_("admin_dashboard.table_value") || "Value"}
                  </th>
                  <th class="col-preview">
                    {$_("admin_dashboard.table_preview") || "Preview"}
                  </th>
                {/if}

                <th class="col-actions">{$_("common.actions") || "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {#each paginatedOptions as option (option.key)}
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
                        />
                      {:else}
                        <span class="empty-text">-</span>
                      {/if}
                    </td>
                  {/if}

                  <td class="col-actions" onclick={(e) => e.stopPropagation()}>
                    <div
                      class="relative flex justify-end"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <button
                        class="h-8 w-8 inline-flex items-center justify-center rounded-md cursor-pointer hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                        aria-label={$_("admin.actions") || "Actions"}
                        onclick={(e) => toggleDropdown(option.key, e)}
                      >
                        <span class="text-xl leading-none">…</span>
                      </button>

                      {#if openDropdownKey === option.key}
                        <div
                          class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                          style={$isRTL
                            ? "right:0; top:22px;"
                            : "right:0; top:22px;"}
                          role="menu"
                        >
                          <button
                            class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-600"
                            onclick={() => {
                              closeDropdown();
                              openEditOptionModal(activeVariation, option);
                            }}
                            role="menuitem"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              class="w-4 h-4 text-gray-500"
                            >
                              <path
                                fill-rule="evenodd"
                                clip-rule="evenodd"
                                d="M15.5763 5.55905L14.1547 7.028L15.5606 8.43048L17.0227 9.88908L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM10.0378 15.6235L14.8691 10.5657L15.6318 11.3265L10.7674 16.3531L10.0378 15.6235ZM7.95914 16.3732L8.92782 17.3419L5.9421 18.337L6.93719 15.3513L7.90531 16.3194C7.91913 16.3343 7.93349 16.3489 7.94838 16.3631C7.95195 16.3665 7.95553 16.3699 7.95914 16.3732ZM8.62322 14.2089L7.90282 13.4885L12.7638 8.46539L13.4529 9.15285L8.62322 14.2089ZM14.1455 4.16158L12.0339 6.34356C12.0329 6.34463 12.0319 6.34571 12.0308 6.34678L5.7815 12.8046C5.67738 12.9122 5.59875 13.0418 5.55141 13.1838L3.41241 19.6018C3.29266 19.9611 3.38618 20.3573 3.654 20.6251C3.92182 20.8929 4.31797 20.9864 4.67729 20.8667L11.0953 18.7277C11.2479 18.6768 11.3859 18.59 11.4977 18.4744L19.8566 9.83672C20.6072 9.0822 21.0288 8.06106 21.0288 6.99649C21.0288 5.92906 20.605 4.90529 19.8505 4.15018L19.8499 4.14958C19.0948 3.39511 18.071 2.97131 17.0036 2.97131C15.9362 2.97131 14.9124 3.39511 14.1573 4.14958L14.1455 4.16158Z"
                                fill="currentColor"
                              />
                            </svg>
                            <span>{$_("common.edit") || "Edit"}</span>
                          </button>

                          <button
                            class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                            onclick={() => {
                              closeDropdown();
                              openDeleteOptionModal(activeVariation, option);
                            }}
                            role="menuitem"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path
                                d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"
                              />
                            </svg>
                            <span>{$_("common.delete") || "Delete"}</span>
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

        <!-- Pagination (Orders style) -->
        {#if totalPages > 1}
          <div class="pagination">
            <!-- Left info -->
            <div class="pagination-info">
              <span class="pagination-info__label">
                {$_("common.showing") || "Showing"}
              </span>

              <span class="pagination-info__strong">
                {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
              </span>

              <span class="pagination-info__label">-</span>

              <span class="pagination-info__strong">
                {formatNumber(
                  Math.min(currentPage * itemsPerPage, totalOptionsCount),
                  $locale,
                )}
              </span>

              <span class="pagination-info__label">
                {$_("common.of") || "of"}
              </span>

              <span class="pagination-info__strong">
                {formatNumber(totalOptionsCount, $locale)}
              </span>

              <span class="pagination-info__label">
                {activeTab === "colors"
                  ? $_("admin_dashboard.colors") || "colors"
                  : $_("admin_dashboard.storages") || "storages"}
              </span>
            </div>

            <!-- Right controls -->
            <div
              class="pagination-controls"
              onclick={(e) => e.stopPropagation()}
            >
              <!-- Left arrow -->
              <button
                class="pager-arrow pager-arrow--left"
                onclick={previousPage}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M12.5 15L7.5 10L12.5 5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>

              <!-- Page numbers -->
              <div class="pagination-pages">
                {#each visiblePageNumbers as p}
                  {#if p === "ellipsis"}
                    <span class="page-ellipsis">...</span>
                  {:else}
                    <button
                      class="page-chip"
                      class:active={currentPage === p}
                      onclick={() => goToPage(p)}
                    >
                      {formatNumber(p, $locale)}
                    </button>
                  {/if}
                {/each}
              </div>

              <!-- Right arrow -->
              <button
                class="pager-arrow pager-arrow--right"
                onclick={nextPage}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M7.5 5L12.5 10L7.5 15"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        {/if}
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
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    background: white;
    border-radius: 0 0 12px 12px;
    border: 1px solid #e5e7eb;
  }

  /* Left text */
  .pagination-info {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .pagination-info__label {
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);
  }

  .pagination-info__strong {
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);
  }

  /* Right side */
  .pagination-controls {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }

  /* Arrow buttons */
  .pager-arrow {
    width: 36px;
    height: 36px;
    padding: 0;
    background: var(--colors-background-bg-primary-soft, #ffffff);
    border: 1px solid var(--colors-border-border-base, #e5e7eb);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  }

  .pager-arrow--left {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .pager-arrow--right {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .pager-arrow:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Pages group (keeps borders aligned with arrows) */
  .pagination-pages {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }

  .page-chip {
    width: 36px;
    height: 36px;
    padding: 8px 12px;
    background: var(--colors-background-bg-primary-soft, #ffffff);
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-left: 0;
    border-right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);

    cursor: pointer;
  }

  /* Add a vertical separator between page chips (like individual boxes) */
  .page-chip + .page-chip {
    border-left: 1px solid var(--colors-border-border-base, #e5e7eb);
  }

  .page-chip.active {
    color: var(--colors-text-text-fg-brand, #1447e6);
  }

  .page-chip:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .page-ellipsis {
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-left: 1px solid var(--colors-border-border-base, #e5e7eb);
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    color: var(--colors-text-text-body, #4a5565);
  }
  .color-preview {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: inline-block;
    border: 1px solid #e5e7eb;
    vertical-align: middle;
  }
</style>

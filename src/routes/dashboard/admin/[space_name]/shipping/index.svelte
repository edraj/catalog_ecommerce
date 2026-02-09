<script lang="ts">
  import { onMount } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { ResourceType } from "@edraj/tsdmart";
  import "./index.css";
  import { website } from "@/config";
  import ShippingItemModal from "@/components/sellers/ShippingItemModal.svelte";

  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let shippingOptions = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingShipping = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let typeFilter = $state("all");
  let totalShippingCount = $state(0);

  let shippingConfig = $state(null);
  let showShippingItemModal = $state(false);
  let editingShippingItemIndex = $state<number | null>(null);
  let showFilters = $state(false);
  let shippingItemForm = $state({
    states: [],
    settings: [
      {
        min: "",
        max: "",
        cost: "",
        minimum_retail: "",
        note: "",
        is_active: true,
      },
    ],
  });
  let isSavingShipping = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let filteredShippingOptions = $derived.by(() => {
    let filtered = [...shippingOptions];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const states = item.states?.join(", ") || "";
        return states.toLowerCase().includes(searchLower);
      });
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter((item) => item.is_active === isActive);
    }

    if (typeFilter !== "all") {
      const isGlobal = typeFilter === "global";
      filtered = filtered.filter((item) => {
        const hasStates = item.states && item.states.length > 0;
        return isGlobal ? !hasStates : hasStates;
      });
    }

    return filtered;
  });

  let paginatedShippingOptions = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredShippingOptions.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredShippingOptions.length / itemsPerPage);
  });

  $effect(() => {
    searchTerm;
    statusFilter;
    typeFilter;
    totalShippingCount = filteredShippingOptions.length;
    currentPage = 1;
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getSellerDisplayName(seller: any): string {
    if (!seller) return "";
    return getLocalizedDisplayName(seller, $locale);
  }

  function resolveShippingItems(record: any) {
    const directItems = record?.attributes?.payload?.body?.items;
    if (Array.isArray(directItems)) {
      return directItems;
    }

    return [];
  }

  function buildShippingOptions(
    records: any[],
    sellerShortname: string,
    sellerDisplayname: string,
  ) {
    const options = [];

    for (const record of records) {
      const items = resolveShippingItems(record);

      if (items.length > 0) {
        for (const [itemIndex, item] of items.entries()) {
          if (item.settings && Array.isArray(item.settings)) {
            for (const setting of item.settings) {
              options.push({
                ...setting,
                states: item.states || [],
                seller_shortname: sellerShortname,
                seller_displayname: sellerDisplayname,
                record_shortname: record.shortname,
                item_index: itemIndex,
              });
            }
          }
        }
      }
    }

    return options;
  }

  function ensureShippingConfigBody(config: any) {
    if (!config.attributes) {
      config.attributes = { payload: { body: { items: [] } } };
    }
    if (!config.attributes.payload) {
      config.attributes.payload = { body: { items: [] } };
    }
    if (!config.attributes.payload.body) {
      config.attributes.payload.body = { items: [] };
    }
    if (!config.attributes.payload.body.items) {
      config.attributes.payload.body.items = [];
    }
  }

  onMount(async () => {
    await loadSellers();
    if (!selectedSeller) {
      selectedSeller = "all";
      await loadSellerShipping(true);
    }
  });

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "shipping",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        sellers = response.records.filter(
          (record) => record.resource_type === "folder",
        );
      }
    } catch (error) {
      console.error("Error loading sellers:", error);
      errorToastMessage("Error loading sellers");
    } finally {
      isLoadingSellers = false;
    }
  }

  async function loadSellerShipping(reset = true) {
    if (reset) {
      shippingOptions = [];
    }

    if (!selectedSeller) {
      shippingConfig = null;
      return;
    }

    if (selectedSeller === "all") {
      isLoadingShipping = true;
      try {
        const allShippingOptions = [];

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `shipping/${seller.shortname}`,
              "managed",
              100,
              0,
              true,
            );

            if (response?.records) {
              allShippingOptions.push(
                ...buildShippingOptions(
                  response.records,
                  seller.shortname,
                  getSellerDisplayName(seller),
                ),
              );
            }
          } catch (error) {
            console.error(
              `Error loading shipping for ${seller.shortname}:`,
              error,
            );
          }
        }

        shippingOptions = allShippingOptions;
      } catch (error) {
        console.error("Error loading shipping options:", error);
        errorToastMessage("Error loading shipping options");
      } finally {
        isLoadingShipping = false;
      }
      return;
    }

    isLoadingShipping = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `shipping/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const processedShipping = [];

      if (response?.records) {
        shippingConfig = response.records[0] || {
          attributes: { payload: { body: { items: [] } } },
        };
        const seller = sellers.find((s) => s.shortname === selectedSeller);
        processedShipping.push(
          ...buildShippingOptions(
            response.records,
            selectedSeller,
            getSellerDisplayName(seller),
          ),
        );
      } else {
        shippingConfig = { attributes: { payload: { body: { items: [] } } } };
      }

      shippingOptions = processedShipping;
    } catch (error) {
      console.error("Error loading shipping options:", error);
      errorToastMessage("Error loading shipping options");
    } finally {
      isLoadingShipping = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerShipping(true);
    }
  });

  function formatCurrency(amount: number): string {
    return amount.toLocaleString();
  }

  function formatWeight(weight: number): string {
    return weight.toFixed(1);
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  function toggleFilters(event: Event) {
    event.stopPropagation();
    showFilters = !showFilters;
  }

  function closeFilters() {
    if (showFilters) {
      showFilters = false;
    }
  }

  function handleFiltersPanelClick(event: Event) {
    event.stopPropagation();
  }

  async function loadSellerShippingConfig(sellerShortname: string) {
    const response = await getSpaceContents(
      website.main_space,
      `shipping/${sellerShortname}`,
      "managed",
      100,
      0,
      true,
    );

    if (response?.records && response.records.length > 0) {
      return response.records[0];
    }

    return { attributes: { payload: { body: { items: [] } } } };
  }

  async function saveShippingConfigForSeller(
    sellerShortname: string,
    config: any,
  ) {
    ensureShippingConfigBody(config);

    const configData = {
      displayname_en: "Configuration",
      displayname_ar: null,
      displayname_ku: null,
      body: config.attributes.payload.body,
      tags: [],
      is_active: true,
    };

    if (config?.uuid) {
      await updateEntity(
        config.shortname,
        website.main_space,
        `shipping/${sellerShortname}`,
        config.resource_type,
        configData,
        "",
        "",
      );
    } else {
      await createEntity(
        configData,
        website.main_space,
        `shipping/${sellerShortname}`,
        ResourceType.content,
        "",
        "",
      );
    }
  }

  function openShippingItemModal(itemIndex: number | null = null) {
    if (!shippingConfig || selectedSeller === "all") {
      errorToastMessage("Select a seller to manage shipping options");
      return;
    }

    editingShippingItemIndex = itemIndex;
    showShippingItemModal = true;

    ensureShippingConfigBody(shippingConfig);

    if (itemIndex !== null) {
      const item = shippingConfig.attributes.payload.body.items[itemIndex];
      shippingItemForm = {
        states: item.states || [],
        settings: item.settings.map((s) => ({
          min: s.min?.toString() || "",
          max: s.max?.toString() || "",
          cost: s.cost?.toString() || "",
          minimum_retail: s.minimum_retail?.toString() || "",
          note: s.note || "",
          is_active: s.is_active ?? true,
        })),
      };
    } else {
      shippingItemForm = {
        states: [],
        settings: [
          {
            min: "",
            max: "",
            cost: "",
            minimum_retail: "",
            note: "",
            is_active: true,
          },
        ],
      };
    }
  }

  function closeShippingItemModal() {
    showShippingItemModal = false;
    editingShippingItemIndex = null;
  }

  async function submitShippingItem() {
    if (shippingItemForm.settings.some((s) => !s.min || !s.max || !s.cost)) {
      errorToastMessage("Please fill in all required fields (min, max, cost)");
      return;
    }

    if (!selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to manage shipping options");
      return;
    }

    try {
      isSavingShipping = true;

      const newItem = {
        ...(shippingItemForm.states.length > 0
          ? { states: shippingItemForm.states }
          : {}),
        settings: shippingItemForm.settings.map((s) => ({
          min: parseFloat(s.min),
          max: parseFloat(s.max),
          cost: parseFloat(s.cost),
          minimum_retail: s.minimum_retail ? parseFloat(s.minimum_retail) : 0,
          note: s.note || "TRANSLATION_KEY_ONLY",
          is_active: s.is_active,
        })),
      };

      ensureShippingConfigBody(shippingConfig);

      if (editingShippingItemIndex !== null) {
        shippingConfig.attributes.payload.body.items[editingShippingItemIndex] =
          newItem;
      } else {
        shippingConfig.attributes.payload.body.items.push(newItem);
      }

      await saveShippingConfigForSeller(selectedSeller, shippingConfig);
      successToastMessage("Shipping options saved successfully!");

      closeShippingItemModal();
      await loadSellerShipping(true);
    } catch (error) {
      console.error("Error saving shipping options:", error);
      errorToastMessage("Failed to save shipping options");
    } finally {
      isSavingShipping = false;
    }
  }

  async function deleteShippingItem(itemIndex: number) {
    if (!shippingConfig || !selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to manage shipping options");
      return;
    }

    try {
      isSavingShipping = true;

      ensureShippingConfigBody(shippingConfig);
      shippingConfig.attributes.payload.body.items =
        shippingConfig.attributes.payload.body.items.filter(
          (_: any, i: number) => i !== itemIndex,
        );

      await saveShippingConfigForSeller(selectedSeller, shippingConfig);
      successToastMessage("Shipping option deleted successfully!");
      await loadSellerShipping(true);
    } catch (error) {
      console.error("Error deleting shipping option:", error);
      errorToastMessage("Failed to delete shipping option");
    } finally {
      isSavingShipping = false;
    }
  }
</script>

<svelte:window onclick={closeFilters} />

<div class="admin-page-container">
  <div class="admin-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.seller_shipping") || "Seller Shipping Options"}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.view_manage_sellers_shipping") ||
              "View and manage shipping configurations from all sellers"}
          </p>
        </div>
        {#if selectedSeller && selectedSeller !== "all"}
          <div class="header-actions">
            <button
              class="btn-add-shipping"
              type="button"
              onclick={() => openShippingItemModal()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {$_("admin.add_shipping_rule") || "Add Shipping Rule"}
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Filters -->
    <div class="search-and-filters">
      <div class="search-bar">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin.search_shipping") || "Search by state..."}
          class="search-input"
        />
        <button
          type="button"
          class="search-btn"
          aria-label={$_("admin.search_shipping") || "Search by state..."}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div class="filters-left">
        <div class="seller-select">
          <label class="filter-label" for="seller-filter">
            {$_("admin.select_seller") || "Select Seller"}
          </label>
          <select
            id="seller-filter"
            bind:value={selectedSeller}
            class="filter-select"
          >
            <option value="">
              {$_("admin.choose_seller") || "Choose a seller..."}
            </option>
            <option value="all">
              {$_("admin.all_sellers") || "All Sellers"}
            </option>
            {#each sellers as seller}
              <option value={seller.shortname}>
                {getSellerDisplayName(seller)}
              </option>
            {/each}
          </select>
        </div>
        <div class="filters-dropdown">
          <button
            type="button"
            class="filters-trigger"
            aria-haspopup="true"
            aria-expanded={showFilters}
            onclick={toggleFilters}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 6a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 5a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
              />
            </svg>
            {$_("common.filters") || "Filters"}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          {#if showFilters}
            <div class="filters-panel" onclick={handleFiltersPanelClick}>
              <div class="filter-group">
                <label class="filter-label" for="type-filter">
                  {$_("admin.shipping_type") || "Type"}
                </label>
                <select id="type-filter" bind:value={typeFilter}>
                  <option value="all">
                    {$_("admin.all_types") || "All Types"}
                  </option>
                  <option value="global">
                    {$_("admin.global") || "Global"}
                  </option>
                  <option value="state">
                    {$_("admin.state_specific") || "State Specific"}
                  </option>
                </select>
              </div>

              <div class="filter-group">
                <label class="filter-label" for="status-filter">
                  {$_("common.status") || "Status"}
                </label>
                <select id="status-filter" bind:value={statusFilter}>
                  <option value="all">
                    {$_("admin.all_status") || "All Status"}
                  </option>
                  <option value="active"
                    >{$_("admin.active") || "Active"}</option
                  >
                  <option value="inactive">
                    {$_("admin.inactive") || "Inactive"}
                  </option>
                </select>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Shipping Table -->
    {#if isLoadingSellers}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if !selectedSeller}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <path
            d="M24 8v8m0 16v8m8-20h8m-24 0H8m28.364 14.364l5.656 5.656M5.636 5.636l5.656 5.656m22.708 0l5.656-5.656M5.636 30.364l5.656-5.656"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>
          {$_("admin.select_seller_prompt") ||
            "Select a seller to view their shipping options"}
        </h3>
        <p>
          {$_("admin.select_seller_hint_shipping") ||
            "Choose a seller from the dropdown above"}
        </p>
      </div>
    {:else if isLoadingShipping}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading shipping options..."}</p>
      </div>
    {:else if filteredShippingOptions.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
          <path
            d="M16 24h16M24 16v16"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>{$_("admin.no_shipping") || "No shipping options found"}</h3>
        <p>
          {$_("admin.no_shipping_hint") ||
            "This seller has no shipping configurations yet"}
        </p>
        {#if selectedSeller && selectedSeller !== "all"}
          <button
            class="btn-add-shipping"
            type="button"
            onclick={() => openShippingItemModal()}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            {$_("admin.add_shipping_rule") || "Add Shipping Rule"}
          </button>
        {/if}
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredShippingOptions.length}</strong>
          {$_("admin.shipping_options") || "shipping options"}
          {#if selectedSeller !== "all"}
            from <strong
              >{getSellerDisplayName(
                sellers.find((s) => s.shortname === selectedSeller),
              )}</strong
            >
          {/if}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("admin.seller") || "Seller"}</th>
              <th>{$_("admin.shipping_type") || "Type"}</th>
              <th>{$_("admin.states") || "States"}</th>
              <th>{$_("admin.weight_range") || "Weight Range (kg)"}</th>
              <th>{$_("admin.shipping_cost") || "Shipping Cost"}</th>
              <th>{$_("admin.minimum_order") || "Min. Order"}</th>
              <th>{$_("common.status") || "Status"}</th>
              <th>{$_("common.actions") || "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedShippingOptions as option, i (option.record_shortname + "-" + i)}
              {@const hasStates = option.states && option.states.length > 0}
              {@const isActive = option.is_active === true}
              <tr class="item-row">
                <td>
                  <div class="seller-badge">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      style="width: 16px; height: 16px;"
                    >
                      <path
                        d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                      />
                    </svg>
                    {option.seller_displayname || option.seller_shortname}
                  </div>
                </td>
                <td>
                  <div
                    class="type-badge"
                    class:global={!hasStates}
                    class:state={hasStates}
                  >
                    {#if hasStates}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path
                          d="M8 0a8 8 0 100 16A8 8 0 008 0zM2.04 4.326c.325 1.329 2.532 2.54 3.717 3.19.48.263.793.434.743.484-.08.08-.162.158-.242.234-.416.396-.787.749-.758 1.266.035.634.618.824 1.214 1.017.577.188 1.168.38 1.286.983.082.417-.075.988-.22 1.52-.215.782-.406 1.48.22 1.48 1.5-.5 3.798-3.186 4-5 .138-1.243-2-2-3.5-2.5-.478-.16-.755.081-.99.284-.172.15-.322.279-.51.216-.445-.148-2.5-2-1.5-2.5.78-.39.952-.171 1.227.182.078.099.163.208.273.318.609.304.662-.132.723-.633.039-.322.081-.671.277-.867.434-.434 1.265-.791 2.028-1.12.712-.306 1.365-.587 1.579-.88A7 7 0 002.04 4.327zm7.5 4.674a1 1 0 110 2 1 1 0 010-2z"
                        />
                      </svg>
                      {$_("admin.state_specific") || "State Specific"}
                    {:else}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M8 15A7 7 0 108 1a7 7 0 000 14zm0 1A8 8 0 108 0a8 8 0 000 16z"
                          clip-rule="evenodd"
                        />
                        <path
                          d="M4.285 7.714a.5.5 0 01.5-.5h6.43a.5.5 0 010 1h-6.43a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6.43a.5.5 0 010 1h-6.43a.5.5 0 01-.5-.5z"
                        />
                      </svg>
                      {$_("admin.global") || "Global"}
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="states-display">
                    {#if hasStates}
                      {#each option.states.slice(0, 3) as state}
                        <span class="state-tag">{state}</span>
                      {/each}
                      {#if option.states.length > 3}
                        <span class="more-badge">
                          +{option.states.length - 3}
                        </span>
                      {/if}
                    {:else}
                      <span class="empty-text"
                        >{$_("admin.all_states") || "All States"}</span
                      >
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="weight-range">
                    <strong>{formatWeight(option.min)}</strong>
                    -
                    <strong>{formatWeight(option.max)}</strong>
                    {$_("admin.kg") || "kg"}
                  </div>
                </td>
                <td>
                  <div class="cost-display">
                    <strong>{formatCurrency(option.cost)}</strong>
                    {$_("admin.currency") || "IQD"}
                  </div>
                </td>
                <td>
                  <div class="minimum-display">
                    {#if option.minimum_retail > 0}
                      <strong>{formatCurrency(option.minimum_retail)}</strong>
                      {$_("admin.currency") || "IQD"}
                    {:else}
                      <span class="empty-text"
                        >{$_("admin.no_minimum") || "No minimum"}</span
                      >
                    {/if}
                  </div>
                </td>
                <td>
                  <div
                    class="status-badge"
                    class:active={isActive}
                    class:inactive={!isActive}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="8" cy="8" r="8" />
                    </svg>
                    {#if isActive}
                      {$_("admin.active") || "Active"}
                    {:else}
                      {$_("admin.inactive") || "Inactive"}
                    {/if}
                  </div>
                </td>
                <td>
                  {#if selectedSeller && selectedSeller !== "all"}
                    <div class="action-buttons">
                      <button
                        type="button"
                        class="action-btn edit"
                        onclick={() => openShippingItemModal(option.item_index)}
                      >
                        {$_("common.edit") || "Edit"}
                      </button>
                      <button
                        type="button"
                        class="action-btn delete"
                        onclick={() => deleteShippingItem(option.item_index)}
                      >
                        {$_("common.delete") || "Delete"}
                      </button>
                    </div>
                  {:else}
                    <span class="empty-text">-</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if totalPages > 1}
        <div class="pagination">
          <button
            class="btn btn-secondary btn-small"
            onclick={previousPage}
            disabled={currentPage === 1}
          >
            {$_("previous")}
          </button>

          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-btn"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <button
                class="page-btn"
                class:active={currentPage === 1}
                onclick={() => goToPage(1)}
              >
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-btn"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <button
                class="page-btn"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <div class="pagination-info">
            <span
              >{formatNumber(filteredShippingOptions.length, $locale)}
              {$_("total_items")}</span
            >
          </div>

          <button
            class="btn btn-secondary btn-small"
            onclick={nextPage}
            disabled={currentPage === totalPages}
          >
            {$_("next")}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<ShippingItemModal
  bind:show={showShippingItemModal}
  bind:form={shippingItemForm}
  isLoading={isSavingShipping}
  onClose={closeShippingItemModal}
  onSubmit={submitShippingItem}
/>

<style>
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pagination-pages {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .page-btn {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-btn:hover:not(.active) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .page-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
    font-weight: 600;
  }

  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 600;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    border-color: #9ca3af;
    background: #f9fafb;
  }

  .action-btn.edit {
    color: #1d4ed8;
    border-color: rgba(29, 78, 216, 0.35);
  }

  .action-btn.delete {
    color: #dc2626;
    border-color: rgba(220, 38, 38, 0.35);
  }
</style>

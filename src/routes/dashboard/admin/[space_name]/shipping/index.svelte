<script lang="ts">
  import { onMount } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import "./index.css";
  import { website } from "@/config";

  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let shippingOptions = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingShipping = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let typeFilter = $state("all");

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

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function getSellerDisplayName(seller: any): string {
    if (!seller) return "";
    return getLocalizedDisplayName(seller, $locale);
  }

  onMount(async () => {
    await loadSellers();
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
        true
      );

      if (response?.records) {
        sellers = response.records.filter(
          (record) => record.resource_type === "folder"
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
              true
            );

            if (response?.records) {
              for (const record of response.records) {
                const body = record.attributes?.payload?.body;

                if (body?.items && Array.isArray(body.items)) {
                  for (const item of body.items) {
                    if (item.settings && Array.isArray(item.settings)) {
                      for (const setting of item.settings) {
                        allShippingOptions.push({
                          ...setting,
                          states: item.states || [],
                          seller_shortname: seller.shortname,
                          seller_displayname: getSellerDisplayName(seller),
                          record_shortname: record.shortname,
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(
              `Error loading shipping for ${seller.shortname}:`,
              error
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
        true
      );

      const processedShipping = [];

      if (response?.records) {
        const seller = sellers.find((s) => s.shortname === selectedSeller);

        for (const record of response.records) {
          const body = record.attributes?.payload?.body;

          if (body?.items && Array.isArray(body.items)) {
            for (const item of body.items) {
              if (item.settings && Array.isArray(item.settings)) {
                for (const setting of item.settings) {
                  processedShipping.push({
                    ...setting,
                    states: item.states || [],
                    seller_shortname: selectedSeller,
                    seller_displayname: getSellerDisplayName(seller),
                    record_shortname: record.shortname,
                  });
                }
              }
            }
          }
        }
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
</script>

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
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters-group">
        <label for="seller-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
            />
          </svg>
          {$_("admin.select_seller") || "Select Seller"}
        </label>
        <select id="seller-filter" bind:value={selectedSeller}>
          <option value=""
            >{$_("admin.choose_seller") || "Choose a seller..."}</option
          >
          <option value="all">{$_("admin.all_sellers") || "All Sellers"}</option
          >
          {#each sellers as seller}
            <option value={seller.shortname}>
              {getSellerDisplayName(seller)}
            </option>
          {/each}
        </select>
      </div>

      <div class="search-bar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" stroke-width="2" />
          <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin.search_shipping") || "Search by state..."}
        />
      </div>

      <div class="filters-group">
        <label for="type-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fill-rule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("admin.shipping_type") || "Type"}
        </label>
        <select id="type-filter" bind:value={typeFilter}>
          <option value="all">{$_("admin.all_types") || "All Types"}</option>
          <option value="global">{$_("admin.global") || "Global"}</option>
          <option value="state"
            >{$_("admin.state_specific") || "State Specific"}</option
          >
        </select>
      </div>

      <div class="filters-group">
        <label for="status-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("common.status") || "Status"}
        </label>
        <select id="status-filter" bind:value={statusFilter}>
          <option value="all">{$_("admin.all_status") || "All Status"}</option>
          <option value="active">{$_("admin.active") || "Active"}</option>
          <option value="inactive">{$_("admin.inactive") || "Inactive"}</option>
        </select>
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
                sellers.find((s) => s.shortname === selectedSeller)
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
            </tr>
          </thead>
          <tbody>
            {#each filteredShippingOptions as option, i (option.record_shortname + "-" + i)}
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
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

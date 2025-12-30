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
  let discounts = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingDiscounts = $state(false);
  let searchTerm = $state("");
  let typeFilter = $state("all");
  let discountTypeFilter = $state("all");

  let filteredDiscounts = $derived.by(() => {
    let filtered = [...discounts];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const typeShortname = item.type_shortname || "";
        const type = item.type || "";
        return (
          typeShortname.toLowerCase().includes(searchLower) ||
          type.toLowerCase().includes(searchLower)
        );
      });
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    if (discountTypeFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.discount_type === discountTypeFilter
      );
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
        "discounts",
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

  async function loadSellerDiscounts(reset = true) {
    if (reset) {
      discounts = [];
    }

    if (selectedSeller === "all") {
      isLoadingDiscounts = true;
      try {
        const allDiscounts = [];

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `discounts/${seller.shortname}`,
              "managed",
              100,
              0,
              true
            );

            if (response?.records) {
              for (const record of response.records) {
                const body = record.attributes?.payload?.body;

                if (body?.items && Array.isArray(body.items)) {
                  const processedItems = body.items.map((item) => ({
                    ...item,
                    seller_shortname: seller.shortname,
                    seller_displayname: getSellerDisplayName(seller),
                    record_shortname: record.shortname,
                  }));
                  allDiscounts.push(...processedItems);
                } else if (body?.type && body?.type_shortname) {
                  allDiscounts.push({
                    type: body.type,
                    type_shortname: body.type_shortname,
                    discount_type: body.value ? "percentage" : "amount",
                    discount_value: body.value || 0,
                    validity: body.validity,
                    states: [],
                    seller_shortname: seller.shortname,
                    seller_displayname: getSellerDisplayName(seller),
                    record_shortname: record.shortname,
                  });
                }
              }
            }
          } catch (error) {
            console.error(
              `Error loading discounts for ${seller.shortname}:`,
              error
            );
          }
        }

        discounts = allDiscounts;
      } catch (error) {
        console.error("Error loading discounts:", error);
        errorToastMessage("Error loading discounts");
      } finally {
        isLoadingDiscounts = false;
      }
      return;
    }

    isLoadingDiscounts = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `discounts/${selectedSeller}`,
        "managed",
        100,
        0,
        true
      );

      const processedDiscounts = [];

      if (response?.records) {
        for (const record of response.records) {
          const body = record.attributes?.payload?.body;
          const seller = sellers.find((s) => s.shortname === selectedSeller);

          if (body?.items && Array.isArray(body.items)) {
            const processedItems = body.items.map((item) => ({
              ...item,
              seller_shortname: selectedSeller,
              seller_displayname: getSellerDisplayName(seller),
              record_shortname: record.shortname,
            }));
            processedDiscounts.push(...processedItems);
          } else if (body?.type && body?.type_shortname) {
            processedDiscounts.push({
              type: body.type,
              type_shortname: body.type_shortname,
              discount_type: body.value ? "percentage" : "amount",
              discount_value: body.value || 0,
              validity: body.validity,
              states: [],
              seller_shortname: selectedSeller,
              seller_displayname: getSellerDisplayName(seller),
              record_shortname: record.shortname,
            });
          }
        }
      }

      discounts = processedDiscounts;
    } catch (error) {
      console.error("Error loading discounts:", error);
      errorToastMessage("Error loading discounts");
    } finally {
      isLoadingDiscounts = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerDiscounts(true);
    }
  });

  function formatDate(dateString: string): string {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString($locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  function isExpired(toDate: string): boolean {
    if (!toDate) return false;
    return new Date(toDate) < new Date();
  }

  function isActive(validity: any): boolean {
    if (!validity?.from || !validity?.to) return false;
    const now = new Date();
    const from = new Date(validity.from);
    const to = new Date(validity.to);
    return now >= from && now <= to;
  }
</script>

<div class="admin-page-container">
  <div class="admin-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.seller_discounts") || "Seller Discounts"}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.view_manage_sellers_discounts") ||
              "View and manage discount rules from all sellers"}
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
          placeholder={$_("admin.search_discounts") || "Search discounts..."}
        />
      </div>

      <div class="filters-group">
        <label for="type-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              fill-rule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("admin.discount_target") || "Target Type"}
        </label>
        <select id="type-filter" bind:value={typeFilter}>
          <option value="all">{$_("admin.all_types") || "All Types"}</option>
          <option value="brand">{$_("admin.brand") || "Brand"}</option>
          <option value="category">{$_("admin.category") || "Category"}</option>
        </select>
      </div>

      <div class="filters-group">
        <label for="discount-type-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"
            />
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("admin.discount_type") || "Discount Type"}
        </label>
        <select id="discount-type-filter" bind:value={discountTypeFilter}>
          <option value="all"
            >{$_("admin.all_discount_types") || "All Discount Types"}</option
          >
          <option value="percentage"
            >{$_("admin.percentage") || "Percentage"}</option
          >
          <option value="amount">{$_("admin.amount") || "Fixed Amount"}</option>
        </select>
      </div>
    </div>

    <!-- Discounts Table -->
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
            "Select a seller to view their discounts"}
        </h3>
        <p>
          {$_("admin.select_seller_hint_discounts") ||
            "Choose a seller from the dropdown above"}
        </p>
      </div>
    {:else if isLoadingDiscounts}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading discounts..."}</p>
      </div>
    {:else if filteredDiscounts.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
          <path
            d="M16 24h16M24 16v16"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>{$_("admin.no_discounts") || "No discounts found"}</h3>
        <p>
          {$_("admin.no_discounts_hint") ||
            "This seller has no discount rules yet"}
        </p>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredDiscounts.length}</strong>
          {$_("admin.discounts") || "discounts"}
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
              <th>{$_("admin.discount_target") || "Target Type"}</th>
              <th>{$_("admin.target_name") || "Target Name"}</th>
              <th>{$_("admin.discount_type") || "Discount Type"}</th>
              <th>{$_("admin.discount_value") || "Value"}</th>
              <th>{$_("admin.validity_period") || "Validity Period"}</th>
              <th>{$_("common.status") || "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredDiscounts as discount (discount.key || discount.record_shortname)}
              {@const isActiveNow = isActive(discount.validity)}
              {@const isExpiredNow = isExpired(discount.validity?.to)}
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
                    {discount.seller_displayname || discount.seller_shortname}
                  </div>
                </td>
                <td>
                  <div
                    class="type-badge"
                    class:brand={discount.type === "brand"}
                    class:category={discount.type === "category"}
                  >
                    {discount.type === "brand"
                      ? $_("admin.brand") || "Brand"
                      : $_("admin.category") || "Category"}
                  </div>
                </td>
                <td>
                  <div class="target-name">
                    {discount.type_shortname || "-"}
                  </div>
                </td>
                <td>
                  <div
                    class="discount-type-badge"
                    class:percentage={discount.discount_type === "percentage"}
                    class:amount={discount.discount_type === "amount"}
                  >
                    {discount.discount_type === "percentage"
                      ? $_("admin.percentage") || "Percentage"
                      : $_("admin.amount") || "Fixed Amount"}
                  </div>
                </td>
                <td>
                  <div class="discount-value">
                    {#if discount.discount_type === "percentage"}
                      <strong>{discount.discount_value}%</strong>
                    {:else}
                      <strong>{discount.discount_value.toLocaleString()}</strong
                      >
                      {$_("admin.currency") || "IQD"}
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="validity-period">
                    <div class="date-range">
                      <span class="date-label"
                        >{$_("admin.from") || "From"}:</span
                      >
                      <span class="date-value"
                        >{formatDate(discount.validity?.from)}</span
                      >
                    </div>
                    <div class="date-range">
                      <span class="date-label">{$_("admin.to") || "To"}:</span>
                      <span class="date-value"
                        >{formatDate(discount.validity?.to)}</span
                      >
                    </div>
                  </div>
                </td>
                <td>
                  <div
                    class="status-badge"
                    class:active={isActiveNow}
                    class:expired={isExpiredNow}
                    class:scheduled={!isActiveNow && !isExpiredNow}
                  >
                    {#if isActiveNow}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="8" r="8" />
                      </svg>
                      {$_("admin.active") || "Active"}
                    {:else if isExpiredNow}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="8" r="8" />
                      </svg>
                      {$_("admin.expired") || "Expired"}
                    {:else}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="8" r="8" />
                      </svg>
                      {$_("admin.scheduled") || "Scheduled"}
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

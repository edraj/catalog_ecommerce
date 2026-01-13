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
  import { formatNumber } from "@/lib/helpers";
  import "./index.css";
  import { website } from "@/config";

  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let warranties = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingWarranties = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let scopeFilter = $state("all");

  // Pagination state
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let filteredWarranties = $derived.by(() => {
    let filtered = [...warranties];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getItemDisplayName(item).toLowerCase();
        const brandShortname =
          item.attributes?.payload?.body?.brand_shortname || "";
        return (
          displayName.includes(searchLower) ||
          brandShortname.toLowerCase().includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter(
        (item) => item.attributes?.is_active === isActive
      );
    }

    if (scopeFilter !== "all") {
      const isGlobal = scopeFilter === "global";
      filtered = filtered.filter(
        (item) => item.attributes?.payload?.body?.is_global === isGlobal
      );
    }

    return filtered;
  });

  let paginatedWarranties = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredWarranties.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredWarranties.length / itemsPerPage);
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  function getItemDescription(item: any): string {
    const description = item.attributes?.description;
    if (!description) return "-";
    return description[$locale] || description.en || description.ar || "-";
  }

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
        "warranties",
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

  async function loadSellerWarranties(reset = true) {
    if (reset) {
      warranties = [];
    }

    if (selectedSeller === "all") {
      isLoadingWarranties = true;
      try {
        const allWarranties = [];

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `warranties/${seller.shortname}`,
              "managed",
              100,
              0,
              true
            );

            if (response?.records) {
              const processedRecords = response.records.map((record) => ({
                ...record,
                seller_shortname: seller.shortname,
                seller_displayname: getSellerDisplayName(seller),
              }));
              allWarranties.push(...processedRecords);
            }
          } catch (error) {
            console.error(
              `Error loading warranties for ${seller.shortname}:`,
              error
            );
          }
        }

        warranties = allWarranties;
      } catch (error) {
        console.error("Error loading warranties:", error);
        errorToastMessage("Error loading warranties");
      } finally {
        isLoadingWarranties = false;
      }
      return;
    }

    isLoadingWarranties = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `warranties/${selectedSeller}`,
        "managed",
        100,
        0,
        true
      );

      const processedWarranties = [];

      if (response?.records) {
        const seller = sellers.find((s) => s.shortname === selectedSeller);
        const processedRecords = response.records.map((record) => ({
          ...record,
          seller_shortname: selectedSeller,
          seller_displayname: getSellerDisplayName(seller),
        }));
        processedWarranties.push(...processedRecords);
      }

      warranties = processedWarranties;
    } catch (error) {
      console.error("Error loading warranties:", error);
      errorToastMessage("Error loading warranties");
    } finally {
      isLoadingWarranties = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerWarranties(true);
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

  function truncateText(text: string, maxLength: number = 100): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
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
</script>

<div class="admin-page-container">
  <div class="admin-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.seller_warranties") || "Seller Warranties"}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.view_manage_sellers_warranties") ||
              "View and manage warranty policies from all sellers"}
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
          placeholder={$_("admin.search_warranties") || "Search warranties..."}
        />
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

      <div class="filters-group">
        <label for="scope-filter">
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
          {$_("admin.warranty_scope") || "Scope"}
        </label>
        <select id="scope-filter" bind:value={scopeFilter}>
          <option value="all">{$_("admin.all_scopes") || "All Scopes"}</option>
          <option value="global">{$_("admin.global") || "Global"}</option>
          <option value="brand"
            >{$_("admin.brand_specific") || "Brand Specific"}</option
          >
        </select>
      </div>
    </div>

    <!-- Warranties Table -->
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
            "Select a seller to view their warranties"}
        </h3>
        <p>
          {$_("admin.select_seller_hint_warranties") ||
            "Choose a seller from the dropdown above"}
        </p>
      </div>
    {:else if isLoadingWarranties}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading warranties..."}</p>
      </div>
    {:else if filteredWarranties.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
          <path
            d="M16 24h16M24 16v16"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>{$_("admin.no_warranties") || "No warranties found"}</h3>
        <p>
          {$_("admin.no_warranties_hint") ||
            "This seller has no warranty policies yet"}
        </p>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredWarranties.length}</strong>
          {$_("admin.warranties") || "warranties"}
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
              <th>{$_("admin.warranty_name") || "Warranty Name"}</th>
              <th>{$_("admin.warranty_scope") || "Scope"}</th>
              <th>{$_("admin.brand") || "Brand"}</th>
              <th>{$_("admin.warranty_terms") || "Terms"}</th>
              <th>{$_("common.status") || "Status"}</th>
              <th>{$_("admin.created") || "Created"}</th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedWarranties as warranty (warranty.uuid)}
              {@const body = warranty.attributes?.payload?.body}
              {@const isGlobal = body?.is_global === true}
              {@const brandShortname = body?.brand_shortname || ""}
              {@const isActive = warranty.attributes?.is_active === true}
              {@const description = getItemDescription(warranty)}
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
                    {warranty.seller_displayname || warranty.seller_shortname}
                  </div>
                </td>
                <td>
                  <div class="warranty-name">
                    {getItemDisplayName(warranty)}
                  </div>
                </td>
                <td>
                  <div
                    class="scope-badge"
                    class:global={isGlobal}
                    class:brand={!isGlobal}
                  >
                    {#if isGlobal}
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
                    {:else}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path
                          d="M8.186 1.113a.5.5 0 00-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6z"
                        />
                      </svg>
                      {$_("admin.brand_specific") || "Brand Specific"}
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="brand-name">
                    {#if !isGlobal && brandShortname}
                      <span class="brand-tag">{brandShortname}</span>
                    {:else}
                      <span class="empty-text">-</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="warranty-terms" title={description}>
                    {truncateText(description, 80)}
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
                  <div class="date-display">
                    {formatDate(warranty.attributes?.created_at)}
                  </div>
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
            <span>{formatNumber(filteredWarranties.length, $locale)} {$_("total_items")}</span>
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
</style>

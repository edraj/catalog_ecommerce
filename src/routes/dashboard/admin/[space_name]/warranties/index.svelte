<script lang="ts">
  import { onMount } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { getSpaceContents, createEntity } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { ResourceType } from "@edraj/tsdmart";
  import "./index.css";
  import { website } from "@/config";
  import WarrantyModal from "@/components/modals/WarrantyModal.svelte";

  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let warranties = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingWarranties = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let scopeFilter = $state("all");
  let totalWarrantiesCount = $state(0);

  let showCreateModal = $state(false);
  let showFilters = $state(false);
  let warrantyForm = $state({
    displaynameEn: "",
    displaynameAr: "",
    displaynameKu: "",
    descriptionEn: "",
    descriptionAr: "",
    descriptionKu: "",
    isGlobal: true,
    brandShortname: "",
  });
  let brands = $state([]);
  let isLoadingBrands = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(20);

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
        (item) => item.attributes?.is_active === isActive,
      );
    }

    if (scopeFilter !== "all") {
      const isGlobal = scopeFilter === "global";
      filtered = filtered.filter(
        (item) => item.attributes?.payload?.body?.is_global === isGlobal,
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

  $effect(() => {
    searchTerm;
    statusFilter;
    scopeFilter;
    totalWarrantiesCount = filteredWarranties.length;
    currentPage = 1;
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
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
    await Promise.all([loadSellers(), loadBrands()]);
    // Load all warranties on page load
    await loadSellerWarranties(true);
  });

  async function loadBrands() {
    isLoadingBrands = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        1000,
        0,
        true,
      );
      if (response?.records) {
        brands = response.records;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      isLoadingBrands = false;
    }
  }

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "warranties",
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

  async function loadSellerWarranties(reset = true) {
    if (reset) {
      warranties = [];
    }

    if (selectedSeller === "global") {
      isLoadingWarranties = true;
      try {
        const response = await getSpaceContents(
          website.main_space,
          "warranties/global",
          "managed",
          1000,
          0,
          true,
        );

        if (response?.records) {
          warranties = response.records.map((record) => ({
            ...record,
            seller_shortname: "global",
            seller_displayname: $_("admin.global_admin") || "Global (Admin)",
          }));
        }
      } catch (error) {
        console.error("Error loading global warranties:", error);
        errorToastMessage("Error loading global warranties");
      } finally {
        isLoadingWarranties = false;
      }
      return;
    }

    if (selectedSeller === "all") {
      isLoadingWarranties = true;
      try {
        const allWarranties = [];

        const globalResponse = await getSpaceContents(
          website.main_space,
          "warranties/global",
          "managed",
          1000,
          0,
          true,
        ).catch(() => null);
        if (globalResponse?.records) {
          const processed = globalResponse.records.map((record) => ({
            ...record,
            seller_shortname: "global",
            seller_displayname: $_("admin.global_admin") || "Global (Admin)",
          }));
          allWarranties.push(...processed);
        }

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `warranties/${seller.shortname}`,
              "managed",
              100,
              0,
              true,
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
              error,
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
        true,
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

  function openCreateModal() {
    warrantyForm = {
      displaynameEn: "",
      displaynameAr: "",
      displaynameKu: "",
      descriptionEn: "",
      descriptionAr: "",
      descriptionKu: "",
      isGlobal: true,
      brandShortname: "",
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
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

  async function submitCreateWarranty() {
    if (!warrantyForm.displaynameEn || !warrantyForm.descriptionEn) {
      errorToastMessage("Please fill in English name and description");
      return;
    }

    try {
      isLoadingWarranties = true;
      const warrantyData = {
        displayname_en: warrantyForm.displaynameEn,
        displayname_ar: warrantyForm.displaynameAr || null,
        displayname_ku: warrantyForm.displaynameKu || null,
        description_en: warrantyForm.descriptionEn,
        description_ar: warrantyForm.descriptionAr || null,
        description_ku: warrantyForm.descriptionKu || null,
        body: {
          is_global: true,
          brand_shortname: null,
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        warrantyData,
        website.main_space,
        "warranties/global",
        ResourceType.content,
        "",
        "",
      );
      successToastMessage("Warranty created successfully!");
      closeCreateModal();
      await loadSellerWarranties(true);
    } catch (error) {
      console.error("Error creating warranty:", error);
      errorToastMessage("Failed to create warranty");
    } finally {
      isLoadingWarranties = false;
    }
  }
</script>

<svelte:window onclick={closeFilters} />

<div class="warranties-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon" style="background: #dbeafe;">
        <svg
          class="w-6 h-6"
          style="color: #3b82f6;"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.total_warranties") || "Total Warranties"}
        </h3>
        <p class="stat-value">{formatNumber(warranties.length, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #d1fae5;">
        <svg
          class="w-6 h-6"
          style="color: #10b981;"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.active_warranties") || "Active"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            warranties.filter((w) => w.attributes?.is_active).length,
            $locale,
          )}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #dbeafe;">
        <svg
          class="w-6 h-6"
          style="color: #3b82f6;"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.global_warranties") || "Global"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            warranties.filter((w) => w.attributes?.payload?.body?.is_global)
              .length,
            $locale,
          )}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #fef3c7;">
        <svg
          class="w-6 h-6"
          style="color: #f59e0b;"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.brand_specific") || "Brand Specific"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            warranties.filter((w) => !w.attributes?.payload?.body?.is_global)
              .length,
            $locale,
          )}
        </p>
      </div>
    </div>
  </div>

  <div class="search-and-filters">
    <div class="search-bar">
      <input
        type="text"
        bind:value={searchTerm}
        placeholder={$_("admin.search_warranties") || "Search warranties..."}
        class="search-input"
      />
      <button
        type="button"
        class="search-btn"
        aria-label={$_("admin.search_warranties") || "Search warranties"}
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
              <label class="filter-label" for="seller-filter">
                {$_("admin.seller") || "Seller"}
              </label>
              <select
                id="seller-filter"
                bind:value={selectedSeller}
                class="filter-select"
              >
                <option value=""
                  >{$_("admin.choose_seller") || "Choose a seller..."}</option
                >
                <option value="all">
                  {$_("admin.all_sellers") || "All Sellers"}
                </option>
                <option value="global">
                  {$_("admin.global_admin") || "Global (Admin)"}
                </option>
                {#each sellers as seller}
                  <option value={seller.shortname}>
                    {getSellerDisplayName(seller)}
                  </option>
                {/each}
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label" for="status-filter">
                {$_("common.status") || "Status"}
              </label>
              <select
                id="status-filter"
                bind:value={statusFilter}
                class="filter-select"
              >
                <option value="all">
                  {$_("admin.all_status") || "All Status"}
                </option>
                <option value="active">{$_("admin.active") || "Active"}</option>
                <option value="inactive">
                  {$_("admin.inactive") || "Inactive"}
                </option>
              </select>
            </div>

            <div class="filter-group">
              <label class="filter-label" for="scope-filter">
                {$_("admin.warranty_scope") || "Scope"}
              </label>
              <select
                id="scope-filter"
                bind:value={scopeFilter}
                class="filter-select"
              >
                <option value="all">
                  {$_("admin.all_scopes") || "All Scopes"}
                </option>
                <option value="global">
                  {$_("admin.global") || "Global"}
                </option>
                <option value="brand">
                  {$_("admin.brand_specific") || "Brand Specific"}
                </option>
              </select>
            </div>
          </div>
        {/if}
      </div>

      {#if selectedSeller === "global" || selectedSeller === "all"}
        <button
          type="button"
          class="btn-create-warranty"
          onclick={openCreateModal}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" class="btn-create-icon">
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("admin.create_warranty") || "Create warranty"}
        </button>
      {/if}
    </div>
  </div>

  <!-- Warranties Table -->
  {#if isLoadingSellers}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if !selectedSeller}
    <div class="empty-state">
      <div class="empty-icon">🛡️</div>
      <h3>
        {$_("admin.select_seller_prompt") ||
          "Select a seller or Global (Admin) to view warranties"}
      </h3>
      <p>
        {$_("admin.select_seller_hint_warranties") ||
          "Choose a seller or Global (Admin) from the dropdown above"}
      </p>
    </div>
  {:else if isLoadingWarranties}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading warranties..."}</p>
    </div>
  {:else if filteredWarranties.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>{$_("admin.no_warranties") || "No warranties found"}</h3>
      <p>
        {$_("admin.no_warranties_hint") ||
          "This seller has no warranty policies yet"}
      </p>
    </div>
  {:else}
    <div class="warranties-table-container">
      <table class="warranties-table">
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
            <tr>
              <td>
                <div class="seller-badge">
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
                {#if !isGlobal && brandShortname}
                  <span class="brand-tag">{brandShortname}</span>
                {:else}
                  <span class="empty-text">-</span>
                {/if}
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
        <div class="pagination-info">
          {$_("common.showing") || "Showing"}
          {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
          -
          {formatNumber(
            Math.min(currentPage * itemsPerPage, filteredWarranties.length),
            $locale,
          )}
          {$_("common.of") || "of"}
          {formatNumber(filteredWarranties.length, $locale)}
          {$_("admin.warranties") || "warranties"}
        </div>

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
      </div>
    {/if}
  {/if}
</div>

<WarrantyModal
  bind:show={showCreateModal}
  isRTL={$isRTL}
  bind:warrantyForm
  {brands}
  {isLoadingBrands}
  onClose={closeCreateModal}
  onSubmit={submitCreateWarranty}
  getLocalizedDisplayName={getItemDisplayName}
  isEditMode={false}
/>

<style>
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 20px;
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
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
    font-weight: 500;
  }

  .btn-create-warranty {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #3c307f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-create-warranty:hover {
    background: #2f2567;
    transform: translateY(-1px);
  }

  .btn-create-icon {
    width: 1.25rem;
    height: 1.25rem;
  }
</style>

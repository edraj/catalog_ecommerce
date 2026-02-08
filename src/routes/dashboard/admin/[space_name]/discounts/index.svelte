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
  import { Pagination } from "@/components/ui";
  import { ResourceType } from "@edraj/tsdmart";
  import "./index.css";
  import { website } from "@/config";
  import DiscountModal from "@/components/modals/DiscountModal.svelte";
  import { DeleteDiscountModal } from "@/components/modals";

  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let discounts = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingDiscounts = $state(false);
  let searchTerm = $state("");
  let typeFilter = $state("all");
  let discountTypeFilter = $state("all");
  let totalDiscountsCount = $state(0);
  let showFilters = $state(false);

  let showDiscountModal = $state(false);
  let showEditDiscountModal = $state(false);
  let showDeleteDiscountModal = $state(false);
  let selectedDiscount = $state(null);
  let discountForm = $state({
    type: "",
    typeShortname: "",
    value: "",
    discountType: "percentage",
    validFrom: "",
    validTo: "",
  });
  let brands = $state([]);
  let discountCategories = $state([]);
  let isLoadingBrands = $state(false);
  let isLoadingDiscountCategories = $state(false);
  let isSavingDiscount = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

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
        (item) => item.discount_type === discountTypeFilter,
      );
    }

    return filtered;
  });

  let paginatedDiscounts = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDiscounts.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredDiscounts.length / itemsPerPage);
  });

  $effect(() => {
    searchTerm;
    typeFilter;
    discountTypeFilter;
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

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  function resolveDiscountItems(record: any) {
    const directItems = record?.attributes?.payload?.body?.items;
    if (Array.isArray(directItems)) {
      return directItems;
    }

    return [];
  }

  function buildDiscountItems(
    records: any[],
    sellerShortname: string,
    sellerDisplayname: string,
  ) {
    const items = [];

    for (const record of records) {
      const bodyItems = resolveDiscountItems(record);

      if (bodyItems.length > 0) {
        const processedItems = bodyItems.map((item, index) => ({
          ...item,
          seller_shortname: sellerShortname,
          seller_displayname: sellerDisplayname,
          record_shortname: record.shortname,
          item_key: item.key || `${record.shortname}-${index}`,
          item_source: "items",
        }));
        items.push(...processedItems);
      } else {
        const body = record.attributes?.payload?.body;
        if (body?.type && body?.type_shortname) {
          items.push({
            key: record.shortname,
            type: body.type,
            type_shortname: body.type_shortname,
            discount_type: body.value ? "percentage" : "amount",
            discount_value: body.value || 0,
            validity: body.validity,
            states: [],
            seller_shortname: sellerShortname,
            seller_displayname: sellerDisplayname,
            record_shortname: record.shortname,
            item_key: record.shortname,
            item_source: "record",
          });
        }
      }
    }

    return items;
  }

  onMount(async () => {
    await Promise.all([loadSellers(), loadBrands(), loadDiscountCategories()]);
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

  async function loadDiscountCategories() {
    isLoadingDiscountCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true,
      );

      if (response?.records) {
        discountCategories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      isLoadingDiscountCategories = false;
    }
  }

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "discounts",
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
              true,
            );

            if (response?.records) {
              allDiscounts.push(
                ...buildDiscountItems(
                  response.records,
                  seller.shortname,
                  getSellerDisplayName(seller),
                ),
              );
            }
          } catch (error) {
            console.error(
              `Error loading discounts for ${seller.shortname}:`,
              error,
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
        true,
      );

      if (response?.records) {
        const seller = sellers.find((s) => s.shortname === selectedSeller);
        discounts = buildDiscountItems(
          response.records,
          selectedSeller,
          getSellerDisplayName(seller),
        );
      } else {
        discounts = [];
      }
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

  function handlePageChange(page: number) {
    currentPage = page;
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

  function openDiscountModal() {
    showDiscountModal = true;
    discountForm = {
      type: "",
      typeShortname: "",
      value: "",
      discountType: "percentage",
      validFrom: "",
      validTo: "",
    };
  }

  function openEditDiscountModal(discount: any) {
    selectedDiscount = discount;
    discountForm = {
      type: discount.type || "",
      typeShortname: discount.type_shortname || "",
      value: discount.discount_value?.toString() || "",
      discountType: discount.discount_type || "percentage",
      validFrom: discount.validity?.from || "",
      validTo: discount.validity?.to || "",
    };
    showEditDiscountModal = true;
  }

  function closeEditDiscountModal() {
    showEditDiscountModal = false;
    selectedDiscount = null;
  }

  function openDeleteDiscountModal(discount: any) {
    selectedDiscount = discount;
    showDeleteDiscountModal = true;
  }

  function closeDeleteDiscountModal() {
    showDeleteDiscountModal = false;
    selectedDiscount = null;
  }

  function closeDiscountModal() {
    showDiscountModal = false;
  }

  function normalizeDiscountItems(record: any) {
    const items = resolveDiscountItems(record);
    if (items.length > 0) {
      return items.map((item, index) => ({
        ...item,
        key: item.key || `${record.shortname}-${index}`,
      }));
    }

    const body = record.attributes?.payload?.body || {};
    if (body?.type && body?.type_shortname) {
      return [
        {
          key: record.shortname,
          type: body.type,
          type_shortname: body.type_shortname,
          discount_type: body.value ? "percentage" : "amount",
          discount_value: body.value || 0,
          validity: body.validity,
          states: [],
        },
      ];
    }

    return [];
  }

  function buildDiscountItemFromForm(itemKey: string) {
    return {
      key: itemKey,
      type: discountForm.type || null,
      type_shortname: discountForm.typeShortname || null,
      states: [],
      validity: {
        from: discountForm.validFrom,
        to: discountForm.validTo,
      },
      discount_type: discountForm.discountType,
      discount_value: parseFloat(discountForm.value),
    };
  }

  async function submitDiscount() {
    if (
      !discountForm.value ||
      !discountForm.validFrom ||
      !discountForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    if (discountForm.type && !discountForm.typeShortname) {
      errorToastMessage("Please select a specific category or brand");
      return;
    }

    if (!selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to add discounts");
      return;
    }

    try {
      isSavingDiscount = true;

      const itemKey = `discount_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const discountItem = buildDiscountItemFromForm(itemKey);

      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find((r) => r.resource_type === "content") ||
        response?.records?.[0];

      const currentItems = configEntry
        ? normalizeDiscountItems(configEntry)
        : [];
      const updatedItems = [...currentItems, discountItem];

      if (configEntry) {
        await updateEntity(
          configEntry.shortname,
          website.main_space,
          `/discounts/${selectedSeller}`,
          ResourceType.content,
          {
            displayname_en: "Configuration",
            displayname_ar: null,
            displayname_ku: null,
            body: {
              items: updatedItems,
              seller_shortname: selectedSeller,
            },
            tags: [],
            is_active: true,
          },
          "",
          "",
        );
      } else {
        await createEntity(
          {
            shortname: "config",
            displayname_en: "Configuration",
            displayname_ar: null,
            displayname_ku: null,
            body: {
              items: [discountItem],
              seller_shortname: selectedSeller,
            },
            tags: [],
            is_active: true,
          },
          website.main_space,
          `/discounts/${selectedSeller}`,
          ResourceType.content,
          "",
          "",
        );
      }

      successToastMessage("Discount created successfully!");
      closeDiscountModal();
      await loadSellerDiscounts(true);
    } catch (error) {
      console.error("Error creating discount:", error);
      errorToastMessage("Failed to create discount");
    } finally {
      isSavingDiscount = false;
    }
  }

  async function submitUpdateDiscount() {
    if (!selectedDiscount) return;

    if (
      !discountForm.value ||
      !discountForm.validFrom ||
      !discountForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    if (discountForm.type && !discountForm.typeShortname) {
      errorToastMessage("Please select a specific category or brand");
      return;
    }

    if (!selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to edit discounts");
      return;
    }

    try {
      isSavingDiscount = true;

      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find(
          (r) => r.shortname === selectedDiscount.record_shortname,
        ) || response?.records?.[0];

      if (!configEntry) {
        errorToastMessage("Discount configuration not found");
        return;
      }

      const items = normalizeDiscountItems(configEntry);
      const itemKey = selectedDiscount.item_key || selectedDiscount.key;
      const nextItems = items.map((item) =>
        item.key === itemKey ? buildDiscountItemFromForm(itemKey) : item,
      );

      await updateEntity(
        configEntry.shortname,
        website.main_space,
        `/discounts/${selectedSeller}`,
        ResourceType.content,
        {
          displayname_en: "Configuration",
          displayname_ar: null,
          displayname_ku: null,
          body: {
            items: nextItems,
            seller_shortname: selectedSeller,
          },
          tags: [],
          is_active: true,
        },
        "",
        "",
      );

      successToastMessage("Discount updated successfully!");
      closeEditDiscountModal();
      await loadSellerDiscounts(true);
    } catch (error) {
      console.error("Error updating discount:", error);
      errorToastMessage("Failed to update discount");
    } finally {
      isSavingDiscount = false;
    }
  }

  async function handleDeleteDiscount() {
    if (!selectedDiscount) return;

    if (!selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to delete discounts");
      return;
    }

    try {
      isSavingDiscount = true;

      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find(
          (r) => r.shortname === selectedDiscount.record_shortname,
        ) || response?.records?.[0];

      if (!configEntry) {
        errorToastMessage("Discount configuration not found");
        return;
      }

      const items = normalizeDiscountItems(configEntry);
      const itemKey = selectedDiscount.item_key || selectedDiscount.key;
      const nextItems = items.filter((item) => item.key !== itemKey);

      await updateEntity(
        configEntry.shortname,
        website.main_space,
        `/discounts/${selectedSeller}`,
        ResourceType.content,
        {
          displayname_en: "Configuration",
          displayname_ar: null,
          displayname_ku: null,
          body: {
            items: nextItems,
            seller_shortname: selectedSeller,
          },
          tags: [],
          is_active: true,
        },
        "",
        "",
      );

      successToastMessage("Discount deleted successfully!");
      closeDeleteDiscountModal();
      await loadSellerDiscounts(true);
    } catch (error) {
      console.error("Error deleting discount:", error);
      errorToastMessage("Failed to delete discount");
    } finally {
      isSavingDiscount = false;
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
    <div class="search-and-filters">
      <div class="search-bar">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin.search_discounts") || "Search discounts..."}
          class="search-input"
        />
        <button
          type="button"
          class="search-btn"
          aria-label={$_("admin.search_discounts") || "Search discounts..."}
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
                  {$_("admin.select_seller") || "Select Seller"}
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
                  {#each sellers as seller}
                    <option value={seller.shortname}>
                      {getSellerDisplayName(seller)}
                    </option>
                  {/each}
                </select>
              </div>

              <div class="filter-group">
                <label class="filter-label" for="type-filter">
                  {$_("admin.discount_target") || "Target Type"}
                </label>
                <select
                  id="type-filter"
                  bind:value={typeFilter}
                  class="filter-select"
                >
                  <option value="all"
                    >{$_("admin.all_types") || "All Types"}</option
                  >
                  <option value="brand">{$_("admin.brand") || "Brand"}</option>
                  <option value="category"
                    >{$_("admin.category") || "Category"}</option
                  >
                </select>
              </div>

              <div class="filter-group">
                <label class="filter-label" for="discount-type-filter">
                  {$_("admin.discount_type") || "Discount Type"}
                </label>
                <select
                  id="discount-type-filter"
                  bind:value={discountTypeFilter}
                  class="filter-select"
                >
                  <option value="all">
                    {$_("admin.all_discount_types") || "All Discount Types"}
                  </option>
                  <option value="percentage">
                    {$_("admin.percentage") || "Percentage"}
                  </option>
                  <option value="amount">
                    {$_("admin.amount") || "Fixed Amount"}
                  </option>
                </select>
              </div>
            </div>
          {/if}
        </div>

        {#if selectedSeller && selectedSeller !== "all"}
          <button
            class="btn-add-discount"
            type="button"
            onclick={openDiscountModal}
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
            {$_("admin.add_discount") || "Add Discount"}
          </button>
        {/if}
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
              <th>{$_("admin.discount_target") || "Target Type"}</th>
              <th>{$_("admin.target_name") || "Target Name"}</th>
              <th>{$_("admin.discount_type") || "Discount Type"}</th>
              <th>{$_("admin.discount_value") || "Value"}</th>
              <th>{$_("admin.validity_period") || "Validity Period"}</th>
              <th>{$_("common.status") || "Status"}</th>
              <th>{$_("common.actions") || "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedDiscounts as discount (discount.key || discount.record_shortname)}
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
                <td>
                  {#if selectedSeller && selectedSeller !== "all"}
                    <div class="action-buttons">
                      <button
                        type="button"
                        class="action-btn edit"
                        onclick={() => openEditDiscountModal(discount)}
                      >
                        {$_("common.edit") || "Edit"}
                      </button>
                      <button
                        type="button"
                        class="action-btn delete"
                        onclick={() => openDeleteDiscountModal(discount)}
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

      <Pagination
        {currentPage}
        {totalPages}
        totalItems={filteredDiscounts.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
      />
    {/if}
  </div>
</div>

<DiscountModal
  bind:show={showDiscountModal}
  isRTL={$isRTL}
  bind:discountForm
  {brands}
  categories={discountCategories}
  {isLoadingBrands}
  isLoadingCategories={isLoadingDiscountCategories}
  onClose={closeDiscountModal}
  onSubmit={submitDiscount}
  getLocalizedDisplayName={getItemDisplayName}
  isEditMode={false}
/>

<DiscountModal
  bind:show={showEditDiscountModal}
  isRTL={$isRTL}
  bind:discountForm
  {brands}
  categories={discountCategories}
  {isLoadingBrands}
  isLoadingCategories={isLoadingDiscountCategories}
  onClose={closeEditDiscountModal}
  onSubmit={submitUpdateDiscount}
  getLocalizedDisplayName={getItemDisplayName}
  isEditMode={true}
/>

<DeleteDiscountModal
  bind:show={showDeleteDiscountModal}
  onClose={closeDeleteDiscountModal}
  onConfirm={handleDeleteDiscount}
  discount={selectedDiscount}
/>

<style>
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

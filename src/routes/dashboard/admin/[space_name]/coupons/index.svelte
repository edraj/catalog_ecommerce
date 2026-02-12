<script lang="ts">
  import { onMount } from "svelte";
  import {
    getSpaceFolders,
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";

  import "./index.css";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import { _, locale } from "@/i18n";
  import { Pagination } from "@/components/ui";
  import { formatNumber } from "@/lib/helpers";

  let activeTab = $state<"all" | "global">("global");
  let allCoupons = $state<any[]>([]);
  let globalCoupons = $state<any[]>([]);
  let filteredCoupons = $state<any[]>([]);
  let loading = $state(false);
  let selectedFilter = $state("all");
  let searchQuery = $state("");
  let totalCouponsCount = $state(0);
  let allCouponsTotal = $state(0);
  let globalCouponsTotal = $state(0);
  let showFilters = $state(false);
  let couponFolders = $state<any[]>([]);
  let previousSelectedFilter = $state("");
  let previousSearchQuery = $state("");
  let showCreateModal = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let paginatedCoupons = $derived.by(() => {
    return filteredCoupons;
  });

  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(totalCouponsCount / itemsPerPage));
  });

  let newCoupon = $state({
    code: "",
    type: "global",
    discount_type: "percentage",
    discount_value: 0,
    minimum_spend: 0,
    maximum_amount: 0,
    maximum_uses: 0,
    maximum_per_user: 1,
    is_shipping: false,
    validity: {
      from: "",
      to: "",
    },
    applies_to: {
      products: [] as string[],
      services_keys: [] as string[],
      users_shortnames: [] as string[],
      brands_shortnames: [] as string[],
      sellers_shortname: [] as string[],
      categories_shortnames: [] as string[],
    },
  });

  let editModalOpen = $state(false);
  let editingCoupon = $state<any>(null);
  let editFormData = $state<any>({});

  let deleteModalOpen = $state(false);
  let deletingCoupon = $state<any>(null);

  onMount(async () => {
    if (website.main_space) {
      await loadCouponFolders();
      await loadCouponsPage();
    }
  });

  async function loadCouponFolders() {
    const foldersResponse = await getSpaceFolders(
      website.main_space,
      "coupons",
      "managed",
      100,
      0,
    );
    couponFolders = foldersResponse?.records || [];
  }

  function getFolderDisplayname(shortname: string) {
    const folder = couponFolders.find((f) => f.shortname === shortname);
    return folder?.attributes?.displayname?.en || shortname;
  }

  function mapCoupons(records: any[], folderShortname: string) {
    return records.map((coupon) => ({
      ...coupon,
      folderName: folderShortname,
      folderDisplayname: getFolderDisplayname(folderShortname),
      isGlobal: folderShortname === "global",
    }));
  }

  function applySearch(coupons: any[]) {
    if (!searchQuery.trim()) {
      return coupons;
    }

    const query = searchQuery.toLowerCase();
    return coupons.filter(
      (c) =>
        c.attributes.payload?.body?.code?.toLowerCase().includes(query) ||
        c.folderDisplayname?.toLowerCase().includes(query),
    );
  }

  async function loadCouponsPage() {
    if (!website.main_space) {
      return;
    }

    loading = true;
    try {
      if (!couponFolders.length) {
        await loadCouponFolders();
      }

      const limit = itemsPerPage;
      const offset = (currentPage - 1) * itemsPerPage;

      if (activeTab === "global") {
        const response = await getSpaceContents(
          website.main_space,
          "coupons/global",
          "managed",
          limit,
          offset,
          false,
        );

        globalCoupons = response?.records
          ? mapCoupons(response.records, "global")
          : [];
        globalCouponsTotal =
          response?.attributes?.total ?? response?.records?.length ?? 0;

        filteredCoupons = applySearch(globalCoupons);
        totalCouponsCount = searchQuery.trim()
          ? filteredCoupons.length
          : globalCouponsTotal;
        return;
      }

      let coupons = [];
      let total = 0;

      if (selectedFilter === "all") {
        const sellers = getUniqueSellers();
        const pageItems = [];
        let remainingOffset = offset;

        for (const seller of sellers) {
          if (pageItems.length >= limit) {
            break;
          }

          let sellerOffset = 0;

          while (pageItems.length < limit) {
            let response;
            try {
              response = await getSpaceContents(
                website.main_space,
                `coupons/${seller.shortname}`,
                "managed",
                limit,
                sellerOffset,
                false,
              );
            } catch (error) {
              console.error(
                `Error loading coupons for ${seller.shortname}:`,
                error,
              );
              break;
            }

            const records = response?.records || [];
            if (records.length === 0) {
              break;
            }

            if (remainingOffset >= records.length) {
              remainingOffset -= records.length;
              sellerOffset += records.length;
              if (records.length < limit) {
                break;
              }
              continue;
            }

            const usableRecords = records.slice(remainingOffset);
            remainingOffset = 0;

            const processed = mapCoupons(usableRecords, seller.shortname);
            const availableSlots = limit - pageItems.length;
            pageItems.push(...processed.slice(0, availableSlots));

            if (pageItems.length >= limit) {
              break;
            }

            sellerOffset += records.length;
            if (records.length < limit) {
              break;
            }
          }
        }

        coupons = pageItems;
        total =
          offset + pageItems.length + (pageItems.length === limit ? 1 : 0);
      } else if (selectedFilter) {
        const response = await getSpaceContents(
          website.main_space,
          `coupons/${selectedFilter}`,
          "managed",
          limit,
          offset,
          false,
        );

        coupons = response?.records
          ? mapCoupons(response.records, selectedFilter)
          : [];
        total = response?.attributes?.total ?? response?.records?.length ?? 0;
      } else {
        filteredCoupons = [];
        totalCouponsCount = 0;
        allCoupons = [];
        allCouponsTotal = 0;
        return;
      }

      allCoupons = coupons;
      allCouponsTotal = total;

      filteredCoupons = applySearch(coupons);
      totalCouponsCount = searchQuery.trim() ? filteredCoupons.length : total;
    } catch (error) {
      console.error("Error loading coupons:", error);
      errorToastMessage("Failed to load coupons");
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    activeTab;
    selectedFilter;
    searchQuery;
    currentPage;
    itemsPerPage;
    loadCouponsPage();
  });

  $effect(() => {
    if (selectedFilter !== previousSelectedFilter) {
      previousSelectedFilter = selectedFilter;
      currentPage = 1;
    }
  });

  $effect(() => {
    activeTab;
    selectedFilter;
    if (activeTab === "global") {
      selectedFilter = "";
    } else if (!selectedFilter) {
      selectedFilter = "all";
    }
  });

  $effect(() => {
    if (searchQuery !== previousSearchQuery) {
      previousSearchQuery = searchQuery;
      currentPage = 1;
    }
  });

  async function handleCreateCoupon() {
    if (!newCoupon.code.trim()) {
      errorToastMessage("Coupon code is required");
      return;
    }

    if (!newCoupon.validity.from || !newCoupon.validity.to) {
      errorToastMessage("Validity dates are required");
      return;
    }

    loading = true;
    try {
      const result = await createEntity(
        {
          body: newCoupon,
          is_active: true,
        },
        website.main_space,

        "coupons/global",
        ResourceType.content,
        "",
        "",
        "json",
      );

      if (result) {
        successToastMessage("Coupon created successfully");
        resetForm();
        activeTab = "global";
        await loadCouponsPage();
      } else {
        errorToastMessage("Failed to create coupon");
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage("Failed to create coupon");
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    newCoupon = {
      code: "",
      type: "global",
      discount_type: "percentage",
      discount_value: 0,
      minimum_spend: 0,
      maximum_amount: 0,
      maximum_uses: 0,
      maximum_per_user: 1,
      is_shipping: false,
      validity: {
        from: "",
        to: "",
      },
      applies_to: {
        products: [],
        services_keys: [],
        users_shortnames: [],
        brands_shortnames: [],
        sellers_shortname: [],
        categories_shortnames: [],
      },
    };
  }

  function openEditModal(coupon: any) {
    editingCoupon = coupon;
    editFormData = JSON.parse(JSON.stringify(coupon.attributes.payload.body));
    editModalOpen = true;
  }

  async function handleUpdateCoupon() {
    if (!editingCoupon) return;

    loading = true;
    try {
      const success = await updateEntity(
        editingCoupon.shortname,
        website.main_space,
        editingCoupon.subpath,
        ResourceType.content,
        {
          body: editFormData,
          is_active: true,
          content_type: "json",
        },
        "",
        "",
      );

      if (success) {
        successToastMessage("Coupon updated successfully");
        editModalOpen = false;
        await loadCouponsPage();
      } else {
        errorToastMessage("Failed to update coupon");
      }
    } catch (error) {
      console.error("Error updating coupon:", error);
      errorToastMessage("Failed to update coupon");
    } finally {
      loading = false;
    }
  }

  function openDeleteModal(coupon: any) {
    deletingCoupon = coupon;
    deleteModalOpen = true;
  }

  async function handleDeleteCoupon() {
    if (!deletingCoupon) return;

    loading = true;
    try {
      const success = await deleteEntity(
        deletingCoupon.shortname,
        website.main_space,

        deletingCoupon.subpath,
        ResourceType.content,
      );

      if (success) {
        successToastMessage("Coupon deleted successfully");
        deleteModalOpen = false;
        await loadCouponsPage();
      } else {
        errorToastMessage("Failed to delete coupon");
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
      errorToastMessage("Failed to delete coupon");
    } finally {
      loading = false;
    }
  }

  function getUniqueSellers() {
    return couponFolders
      .filter((folder) => folder.shortname !== "global")
      .map((folder) => ({
        shortname: folder.shortname,
        displayname: getFolderDisplayname(folder.shortname),
      }));
  }

  function formatDate(dateString: string) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function addAppliesTo(
    field: keyof typeof newCoupon.applies_to,
    value: string,
  ) {
    if (value.trim()) {
      newCoupon.applies_to[field] = [
        ...newCoupon.applies_to[field],
        value.trim(),
      ];
    }
  }

  function removeAppliesTo(
    field: keyof typeof newCoupon.applies_to,
    index: number,
  ) {
    newCoupon.applies_to[field] = newCoupon.applies_to[field].filter(
      (_, i) => i !== index,
    );
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function closeFilters() {
    if (showFilters) {
      showFilters = false;
    }
  }

  function handleFiltersPanelClick(event: Event) {
    event.stopPropagation();
  }

  function openCreateModal() {
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function handleScopeChange() {
    currentPage = 1;
    if (activeTab === "all" && !selectedFilter) {
      selectedFilter = "all";
    }
    loadCouponsPage();
  }

  function handleSellerChange() {
    currentPage = 1;
    loadCouponsPage();
  }

   let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);

  function closeAllDropdowns() {
    isFiltersOpen = false;
    isActionsOpen = false;
  }

  function toggleFilters() {
    isActionsOpen = false;
    isFiltersOpen = !isFiltersOpen;
  }

  function toggleActions() {
    isFiltersOpen = false;
    isActionsOpen = !isActionsOpen;
  }

  function activeFiltersCount() {
    let n = 0;
    if (activeTab && activeTab !== "all") n++;
    if (selectedFilter && selectedFilter !== "all") n++;
    return n;
  }

  function resetFilters() {
    activeTab = "all";
    selectedFilter = "all";
  }

  function onWindowClick() {
    closeAllDropdowns();
  }

  let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(item.uuid ?? item.id ?? item.shortname ?? item.attributes?.id ?? crypto.randomUUID());
  }

  function toggleTableActions(item: any) {
    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeActions() {
    openActionsFor = null;
  }

  function formatDateDMY(value?: string) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
</script>

<svelte:window onclick={closeFilters} />

<div class="coupons-container">
  <div class="header">
    <div class="header-content">
      <div class="header-left">
        <h1>Coupon Management</h1>
        <p>Manage global and seller-specific coupons</p>
      </div>
    </div>
  </div>

 <div class="flex flex-col md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6">
  <!-- LEFT: SEARCH -->
  <div>
    <div class="relative w-[256px]">
      <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
        <svg class="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
      </div>

      <input
        id="search"
        type="text"
        bind:value={searchQuery}
        placeholder="Search by code or seller..."
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

  <!-- RIGHT: FILTERS + ACTIONS + CREATE -->
  <div class="flex flex-wrap items-end justify-end gap-3">
    <!-- FILTERS DROPDOWN -->
    <div class="relative">
      <button
        type="button"
        onclick={toggleFilters}
        class="h-9 inline-flex items-center justify-between
          px-3 py-2 min-w-[160px]
          bg-[#F9FAFB] border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm text-gray-700 hover:bg-gray-50"
        aria-haspopup="true"
        aria-expanded={isFiltersOpen}
      >
        <span class="truncate inline-flex items-center gap-2">
          {$_("common.filters") || "Filters"}
          {#if activeFiltersCount() > 0}
            <span class="inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              {activeFiltersCount()}
            </span>
          {/if}
        </span>

        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if isFiltersOpen}
        <div class="absolute right-0 z-20 mt-2 w-[320px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-3">
          <div class="grid grid-cols-1 gap-3">
            <!-- Scope -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1" for="scope-filter">
                Scope
              </label>
              <select
                id="scope-filter"
                bind:value={activeTab}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                onchange={() => {
                  handleScopeChange();
                }}
              >
                <option value="all">Seller Coupons</option>
                <option value="global">Global Coupons</option>
              </select>
            </div>

            <!-- Seller -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1" for="seller-filter">
                Filter by Seller
              </label>
              <select
                id="seller-filter"
                bind:value={selectedFilter}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm disabled:opacity-60"
                disabled={activeTab === "global"}
                onchange={() => {
                  handleSellerChange();
                }}
              >
                <option value="" disabled>Select a seller</option>
                <option value="all">All Sellers</option>
                {#each getUniqueSellers() as seller}
                  <option value={seller.shortname}>{seller.displayname}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onclick={() => {
                resetFilters();
              }}
              class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#F9FAFB] text-gray-700 text-sm font-medium
                border border-[#E5E7EB]
                rounded-[12px]
                hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>

            <button
              type="button"
              onclick={() => {
                isFiltersOpen = false;
              }}
              class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#3C307F] text-white text-sm font-medium
                rounded-[12px]
                hover:bg-[#2f2666] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- CREATE COUPON -->
    <button
      type="button"
      onclick={openCreateModal}
      class="inline-flex items-center justify-center
        h-9 px-3 py-2
        bg-[#3C307F] text-white text-sm font-medium
        rounded-[12px]
        shadow-[0px_1px_0.5px_0.05px_#1D293D05]
        hover:bg-[#2f2666]
        transition-colors duration-200"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      <span class="ml-2">Create Coupon</span>
    </button>
  </div>
</div>


  <!-- Coupons Table -->
  {#if loading}
    <div class="loading">Loading coupons...</div>
  {:else if filteredCoupons.length === 0}
    <div class="empty-state">
      {#if activeTab === "all" && !selectedFilter}
        <p>Select a seller to view coupons.</p>
      {:else if activeTab === "global"}
        <p>No global coupons found.</p>
      {:else if searchQuery.trim()}
        <p>No coupons match your search.</p>
      {:else}
        <p>No coupons found.</p>
      {/if}
    </div>
  {:else}
    <div class="table-container">
      <table class="coupons-table w-full">
  <thead class="bg-gray-50 border-b border-gray-200">
    <tr>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid From</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid To</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
    </tr>
  </thead>

  <tbody class="bg-white">
    {#each paginatedCoupons as coupon}
      <tr class="hover:bg-gray-50 transition-colors duration-200">
        <!-- Code main cell -->
        <td class="px-6 py-4">
          <div class="flex items-center gap-2.5">
            <div
              class="shrink-0 rounded-full flex items-center justify-center"
              style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
              aria-hidden="true"
            >
              <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
                {(coupon.attributes?.payload?.body?.code || "C").charAt(0).toUpperCase()}
              </span>
            </div>

            <div class="min-w-0">
              <div
                class="truncate"
                style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
                title={coupon.attributes?.payload?.body?.code || "N/A"}
              >
                {coupon.attributes?.payload?.body?.code || "N/A"}
              </div>

              <div
                class="truncate mt-1"
                style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
              >
                {coupon.isGlobal ? "Global coupon" : "Seller coupon"}
              </div>
            </div>
          </div>
        </td>

        <!-- Type pill -->
        <td class="px-6 py-4">
          <span
            class="inline-flex items-center rounded-sm border px-2 py-0.5"
            style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
          >
            <span style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;">
              {coupon.attributes?.payload?.body?.discount_type === "percentage" ? "%" : "$"}
            </span>
          </span>
        </td>

        <!-- Seller -->
        <td class="px-6 py-4">
          <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
            {coupon.folderDisplayname || "-"}
          </span>
        </td>

        <!-- Discount -->
        <td class="px-6 py-4">
          <div style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
            {#if coupon.attributes?.payload?.body?.discount_type === "percentage"}
              {coupon.attributes?.payload?.body?.discount_value ?? 0}%
            {:else}
              ${coupon.attributes?.payload?.body?.discount_value ?? 0}
            {/if}

            {#if coupon.attributes?.payload?.body?.maximum_amount}
              <span class="ml-2" style="font-weight:400;color:#4A5565;">
                (max: ${coupon.attributes.payload.body.maximum_amount})
              </span>
            {/if}
          </div>
        </td>

        <!-- Valid From -->
        <td class="px-6 py-4">
          <div
            class="inline-flex items-center gap-2"
            style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z" fill="#6A7282"/>
</svg>

            <span>{formatDateDMY(coupon.attributes?.payload?.body?.validity?.from)}</span>
          </div>
        </td>

        <!-- Valid To -->
        <td class="px-6 py-4">
          <div
            class="inline-flex items-center gap-2"
            style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z" fill="#6A7282"/>
</svg>

            <span>{formatDateDMY(coupon.attributes?.payload?.body?.validity?.to)}</span>
          </div>
        </td>

        <!-- Usage -->
        <td class="px-6 py-4">
          <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
            {coupon.attributes?.payload?.body?.usage_count || 0} / {coupon.attributes?.payload?.body?.maximum_uses || "∞"}
          </span>
        </td>

        <!-- Status pill -->
        <td class="px-6 py-4">
          {#if coupon.attributes?.is_active}
            <span
              class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
              style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z" fill="#004F3B"/>
                </svg>
              <span style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;">Active</span>
            </span>
          {:else}
            <span
              class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
              style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M9.32268 2.64556C9.51843 2.84033 9.51922 3.15692 9.32445 3.35267L6.70534 5.98493L9.35444 8.64733C9.54921 8.84308 9.54842 9.15966 9.35267 9.35443C9.15692 9.5492 8.84033 9.54841 8.64556 9.35266L6 6.69381L3.35444 9.35266C3.15967 9.54841 2.84308 9.5492 2.64733 9.35443C2.45158 9.15966 2.45079 8.84308 2.64556 8.64733L5.29466 5.98493L2.67555 3.35267C2.48078 3.15692 2.48157 2.84034 2.67732 2.64556C2.87307 2.45079 3.18966 2.45159 3.38443 2.64734L6 5.27604L8.61557 2.64733C8.81035 2.45158 9.12693 2.45079 9.32268 2.64556Z" fill="#771D1D"/>
              </svg>
              <span style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;">Inactive</span>
            </span>
          {/if}
        </td>

        <!-- Actions (...) dropdown -->
        <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
          <div class="relative" onclick={(e) => e.stopPropagation()}>
            <button
              class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
              aria-label="Actions"
              aria-haspopup="menu"
              aria-expanded={openActionsFor === getRowId(coupon)}
              onclick={() => toggleTableActions(coupon)}
            >
              <span class="text-xl leading-none">…</span>
            </button>

            {#if openActionsFor === getRowId(coupon)}
              <div class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0" role="menu">
                {#if coupon.isGlobal}
                  <button
                    class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    onclick={() => {
                      closeActions();
                      openEditModal(coupon);
                    }}
                    role="menuitem"
                  >
                    Edit
                  </button>

                  <button
                    class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-red-600"
                    onclick={() => {
                      closeActions();
                      openDeleteModal(coupon);
                    }}
                    role="menuitem"
                  >
                    Delete
                  </button>
                {:else}
                  <button
                    class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    onclick={() => {
                      closeActions();
                    }}
                    role="menuitem"
                  >
                    View only
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

    </div>

    <Pagination
      {currentPage}
      {totalPages}
      totalItems={totalCouponsCount}
      {itemsPerPage}
      onPageChange={handlePageChange}
    />
  {/if}
</div>

{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal">
      <div class="modal-header">
        <h2>Create New Global Coupon</h2>
        <button class="close-btn" onclick={closeCreateModal}> × </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label for="code">Coupon Code *</label>
            <input
              id="code"
              type="text"
              bind:value={newCoupon.code}
              placeholder="e.g., SAVE25"
              required
            />
          </div>

          <div class="form-group">
            <label for="discount_type">Discount Type *</label>
            <select id="discount_type" bind:value={newCoupon.discount_type}>
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>

          <div class="form-group">
            <label for="discount_value">Discount Value *</label>
            <input
              id="discount_value"
              type="number"
              bind:value={newCoupon.discount_value}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="minimum_spend">Minimum Spend</label>
            <input
              id="minimum_spend"
              type="number"
              bind:value={newCoupon.minimum_spend}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="maximum_amount">Maximum Discount Amount</label>
            <input
              id="maximum_amount"
              type="number"
              bind:value={newCoupon.maximum_amount}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="maximum_uses">Maximum Uses</label>
            <input
              id="maximum_uses"
              type="number"
              bind:value={newCoupon.maximum_uses}
              min="0"
            />
          </div>

          <div class="form-group">
            <label for="maximum_per_user">Maximum Per User</label>
            <input
              id="maximum_per_user"
              type="number"
              bind:value={newCoupon.maximum_per_user}
              min="1"
            />
          </div>

          <div class="form-group">
            <label for="is_shipping">
              <input
                id="is_shipping"
                type="checkbox"
                bind:checked={newCoupon.is_shipping}
              />
              Is Shipping Coupon
            </label>
          </div>

          <div class="form-group">
            <label for="valid_from">Valid From *</label>
            <input
              id="valid_from"
              type="date"
              bind:value={newCoupon.validity.from}
              required
            />
          </div>

          <div class="form-group">
            <label for="valid_to">Valid To *</label>
            <input
              id="valid_to"
              type="date"
              bind:value={newCoupon.validity.to}
              required
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={resetForm}> Reset </button>
        <button
          class="btn-primary"
          onclick={handleCreateCoupon}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Coupon"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if editModalOpen && editingCoupon}
  <div class="modal-overlay" onclick={() => (editModalOpen = false)}>
    <div class="modal">
      <div class="modal-header">
        <h2>Edit Coupon</h2>
        <button class="close-btn" onclick={() => (editModalOpen = false)}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Coupon Code</label>
            <input type="text" bind:value={editFormData.code} />
          </div>

          <div class="form-group">
            <label>Discount Type</label>
            <select bind:value={editFormData.discount_type}>
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>

          <div class="form-group">
            <label>Discount Value</label>
            <input
              type="number"
              bind:value={editFormData.discount_value}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>Minimum Spend</label>
            <input
              type="number"
              bind:value={editFormData.minimum_spend}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>Maximum Amount</label>
            <input
              type="number"
              bind:value={editFormData.maximum_amount}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>Maximum Uses</label>
            <input
              type="number"
              bind:value={editFormData.maximum_uses}
              min="0"
            />
          </div>

          <div class="form-group">
            <label>Valid From</label>
            <input type="date" bind:value={editFormData.validity.from} />
          </div>

          <div class="form-group">
            <label>Valid To</label>
            <input type="date" bind:value={editFormData.validity.to} />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (editModalOpen = false)}>
          Cancel
        </button>
        <button
          class="btn-primary"
          onclick={handleUpdateCoupon}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Coupon"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteModalOpen && deletingCoupon}
  <div class="modal-overlay" onclick={() => (deleteModalOpen = false)}>
    <div class="modal modal-small">
      <div class="modal-header">
        <h2>Delete Coupon</h2>
        <button class="close-btn" onclick={() => (deleteModalOpen = false)}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <p>
          Are you sure you want to delete the coupon
          <strong>{deletingCoupon.attributes.payload?.body?.code}</strong>?
        </p>
        <p class="warning">This action cannot be undone.</p>
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={() => (deleteModalOpen = false)}
        >
          Cancel
        </button>
        <button
          class="btn-danger"
          onclick={handleDeleteCoupon}
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

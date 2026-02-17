<script lang="ts">
  import { onMount } from "svelte";
  import { derived } from "svelte/store";
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

  // i18n helper function
  function t(key: string, fallback: string = ""): string {
    return $_(key) || fallback;
  }

  // RTL support
  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  // ------- stats (coupons) -------
  let totalCouponsStat = $derived.by(() => {
    // use totals when available (not searching), otherwise fall back to what’s currently loaded
    if (searchQuery.trim()) return filteredCoupons.length;

    // when browsing "global" tab, globalCouponsTotal is the actual total count
    if (activeTab === "global")
      return globalCouponsTotal || globalCoupons.length;

    // when browsing sellers tab, allCouponsTotal is the page total you’re tracking
    if (activeTab === "all") return allCouponsTotal || filteredCoupons.length;

    return filteredCoupons.length;
  });

  let globalCouponsStat = $derived.by(() => {
    // if you are on global tab => global total, else count from current view
    if (!searchQuery.trim() && activeTab === "global")
      return globalCouponsTotal || globalCoupons.length;

    // otherwise count visible items that are global
    return (filteredCoupons || []).filter((c) => c?.isGlobal === true).length;
  });

  let activeCouponsStat = $derived.by(() => {
    return (filteredCoupons || []).filter(
      (c) => c?.attributes?.is_active === true,
    ).length;
  });

  let inactiveCouponsStat = $derived.by(() => {
    return (filteredCoupons || []).filter(
      (c) => c?.attributes?.is_active !== true,
    ).length;
  });

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
      errorToastMessage(
        t("admin.error_loading_coupons", "Failed to load coupons"),
      );
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
      errorToastMessage(
        t("admin.coupon_code_required", "Coupon code is required"),
      );
      return;
    }

    if (!newCoupon.validity.from || !newCoupon.validity.to) {
      errorToastMessage(
        t("admin.validity_dates_required", "Validity dates are required"),
      );
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
        successToastMessage(
          t("admin.coupon_created", "Coupon created successfully"),
        );
        resetForm();
        activeTab = "global";
        await loadCouponsPage();
      } else {
        errorToastMessage(
          t("admin.coupon_create_failed", "Failed to create coupon"),
        );
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage(
        t("admin.coupon_create_failed", "Failed to create coupon"),
      );
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
        successToastMessage(
          t("admin.coupon_updated", "Coupon updated successfully"),
        );
        editModalOpen = false;
        await loadCouponsPage();
      } else {
        errorToastMessage(
          t("admin.coupon_update_failed", "Failed to update coupon"),
        );
      }
    } catch (error) {
      console.error("Error updating coupon:", error);
      errorToastMessage(
        t("admin.coupon_update_failed", "Failed to update coupon"),
      );
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
        successToastMessage(
          t("admin.coupon_deleted", "Coupon deleted successfully"),
        );
        deleteModalOpen = false;
        await loadCouponsPage();
      } else {
        errorToastMessage(
          t("admin.coupon_delete_failed", "Failed to delete coupon"),
        );
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
      errorToastMessage(
        t("admin.coupon_delete_failed", "Failed to delete coupon"),
      );
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
    return String(
      item.uuid ??
        item.id ??
        item.shortname ??
        item.attributes?.id ??
        crypto.randomUUID(),
    );
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

<div class="coupons-container" dir={$isRTL ? "rtl" : "ltr"}>
  <!-- Stats (matches your css classes) -->
  <div class="stats-grid">
    <!-- Total Coupons -->
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
        <h3 class="stat-title">Total Coupons</h3>
        <p class="stat-value">{formatNumber(totalCouponsStat, $locale)}</p>
      </div>
    </div>

    <!-- Global Coupons -->
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
        <h3 class="stat-title">Global Coupons</h3>
        <p class="stat-value">{formatNumber(globalCouponsStat, $locale)}</p>
      </div>
    </div>

    <!-- Active Coupons -->
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
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Active Coupons</h3>
        <p class="stat-value">{formatNumber(activeCouponsStat, $locale)}</p>
      </div>
    </div>

    <!-- Inactive Coupons -->
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
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Inactive Coupons</h3>
        <p class="stat-value">{formatNumber(inactiveCouponsStat, $locale)}</p>
      </div>
    </div>
  </div>

  <div
    class="flex flex-col md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
  >
    <!-- LEFT: SEARCH -->
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
          id="search"
          type="text"
          bind:value={searchQuery}
          placeholder={t(
            "admin.search_by_code_or_seller",
            "Search by code or seller...",
          )}
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
        <span class="ml-2">{t("admin.create_coupon", "Create Coupon")}</span>
      </button>
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
              <span
                class="inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
              >
                {activeFiltersCount()}
              </span>
            {/if}
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
            class="absolute right-0 z-20 mt-2 w-[320px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
          >
            <div class="grid grid-cols-1 gap-3">
              <!-- Scope -->
              <div>
                <label
                  class="block text-xs font-medium text-gray-600 mb-1"
                  for="scope-filter"
                >
                  {t("admin.scope", "Scope")}
                </label>
                <select
                  id="scope-filter"
                  bind:value={activeTab}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  onchange={() => {
                    handleScopeChange();
                  }}
                >
                  <option value="all"
                    >{t("admin.seller_coupons", "Seller Coupons")}</option
                  >
                  <option value="global"
                    >{t("admin.global_coupons", "Global Coupons")}</option
                  >
                </select>
              </div>

              <!-- Seller -->
              <div>
                <label
                  class="block text-xs font-medium text-gray-600 mb-1"
                  for="seller-filter"
                >
                  {t("admin.filter_by_seller", "Filter by Seller")}
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
                  <option value="" disabled
                    >{t(
                      "admin.select_seller_coupons",
                      "Select a seller",
                    )}</option
                  >
                  <option value="all"
                    >{t("admin.all_sellers_coupons", "All Sellers")}</option
                  >
                  {#each getUniqueSellers() as seller}
                    <option value={seller.shortname}
                      >{seller.displayname}</option
                    >
                  {/each}
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
                }}
                class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#F9FAFB] text-gray-700 text-sm font-medium
                border border-[#E5E7EB]
                rounded-[12px]
                hover:bg-gray-50 transition-colors"
              >
                {t("admin.reset", "Reset")}
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
                {t("admin.apply", "Apply")}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Coupons Table -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>{t("common.loading", "Loading...")}</p>
    </div>
  {:else if filteredCoupons.length === 0}
    <div class="empty-state">
      {#if activeTab === "all" && !selectedFilter}
        <p>
          {t(
            "admin.select_seller_to_view_coupons",
            "Select a seller to view coupons.",
          )}
        </p>
      {:else if activeTab === "global"}
        <p>{t("admin.no_global_coupons", "No global coupons found.")}</p>
      {:else if searchQuery.trim()}
        <p>
          {t("admin.no_coupons_match_search", "No coupons match your search.")}
        </p>
      {:else}
        <p>{t("admin.no_coupons_found", "No coupons found.")}</p>
      {/if}
    </div>
  {:else}
    <div class="table-container">
      <table class="coupons-table w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.code", "Code")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.type", "Type")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.seller", "Seller")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.discount", "Discount")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.valid_from", "Valid From")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.valid_to", "Valid To")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.usage", "Usage")}</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >{t("admin.status", "Status")}</th
            >
          </tr>
        </thead>

        <tbody class="bg-white">
          {#each paginatedCoupons as coupon}
            <tr class="hover:bg-gray-50 transition-colors duration-200">
              <!-- Code main cell -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-2.5">
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
                      {coupon.isGlobal
                        ? t("admin.global_coupon", "Global coupon")
                        : t("admin.seller_coupon", "Seller coupon")}
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
                  <span
                    style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                  >
                    {coupon.attributes?.payload?.body?.discount_type ===
                    "percentage"
                      ? "%"
                      : "$"}
                  </span>
                </span>
              </td>

              <!-- Seller -->
              <td class="px-6 py-4">
                <span
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
                  {coupon.folderDisplayname || "-"}
                </span>
              </td>

              <!-- Discount -->
              <td class="px-6 py-4">
                <div
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
                  {#if coupon.attributes?.payload?.body?.discount_type === "percentage"}
                    {coupon.attributes?.payload?.body?.discount_value ?? 0}%
                  {:else}
                    ${coupon.attributes?.payload?.body?.discount_value ?? 0}
                  {/if}

                  {#if coupon.attributes?.payload?.body?.maximum_amount}
                    <span class="ml-2" style="font-weight:400;color:#4A5565;">
                      ({t("admin.max", "max")}: ${coupon.attributes.payload.body
                        .maximum_amount})
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
                      d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z"
                      fill="#6A7282"
                    />
                  </svg>

                  <span
                    >{formatDateDMY(
                      coupon.attributes?.payload?.body?.validity?.from,
                    )}</span
                  >
                </div>
              </td>

              <!-- Valid To -->
              <td class="px-6 py-4">
                <div
                  class="inline-flex items-center gap-2"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
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
                      d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z"
                      fill="#6A7282"
                    />
                  </svg>

                  <span
                    >{formatDateDMY(
                      coupon.attributes?.payload?.body?.validity?.to,
                    )}</span
                  >
                </div>
              </td>

              <!-- Usage -->
              <td class="px-6 py-4">
                <span
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
                  {coupon.attributes?.payload?.body?.usage_count || 0} / {coupon
                    .attributes?.payload?.body?.maximum_uses || "∞"}
                </span>
              </td>

              <!-- Status pill -->
              <td class="px-6 py-4">
                {#if coupon.attributes?.is_active}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z"
                        fill="#004F3B"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;"
                      >{t("admin.status_active", "Active")}</span
                    >
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.32268 2.64556C9.51843 2.84033 9.51922 3.15692 9.32445 3.35267L6.70534 5.98493L9.35444 8.64733C9.54921 8.84308 9.54842 9.15966 9.35267 9.35443C9.15692 9.5492 8.84033 9.54841 8.64556 9.35266L6 6.69381L3.35444 9.35266C3.15967 9.54841 2.84308 9.5492 2.64733 9.35443C2.45158 9.15966 2.45079 8.84308 2.64556 8.64733L5.29466 5.98493L2.67555 3.35267C2.48078 3.15692 2.48157 2.84034 2.67732 2.64556C2.87307 2.45079 3.18966 2.45159 3.38443 2.64734L6 5.27604L8.61557 2.64733C8.81035 2.45158 9.12693 2.45079 9.32268 2.64556Z"
                        fill="#771D1D"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;"
                      >{t("admin.status_inactive", "Inactive")}</span
                    >
                  </span>
                {/if}
              </td>

              <!-- Actions (...) dropdown -->
              <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
                <div
                  class="relative flex justify-end"
                  onclick={(e) => e.stopPropagation()}
                >
                  <button
                    class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                    aria-label="Actions"
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(coupon)}
                    onclick={() => toggleTableActions(coupon)}
                  >
                    <span class="text-xl leading-none">…</span>
                  </button>

                  {#if openActionsFor === getRowId(coupon)}
                    <div
                      class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                      role="menu"
                    >
                      {#if coupon.isGlobal}
                        <!-- Edit -->
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          onclick={() => {
                            closeActions();
                            openEditModal(coupon);
                          }}
                          role="menuitem"
                        >
                          <!-- Pencil Icon -->
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-4 h-4 text-gray-500"
                          >
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M15.5763 5.55905L14.1547 7.028L15.5563 8.42618C15.5577 8.42761 15.5592 8.42904 15.5606 8.43048L17.0227 9.88908L18.4245 8.44058L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM15.6318 11.3265L14.8691 10.5657L10.0378 15.6235L10.7674 16.3531L15.6318 11.3265ZM8.92782 17.3419L7.95914 16.3732C7.95553 16.3699 7.95195 16.3665 7.94838 16.3631C7.93349 16.3489 7.91913 16.3343 7.90531 16.3194L6.93719 15.3513L5.9421 18.337L8.92782 17.3419ZM7.90282 13.4885L8.62322 14.2089L13.4529 9.15285L12.7638 8.46539L7.90282 13.4885ZM12.0308 6.34678C12.0319 6.34571 12.0329 6.34463 12.0339 6.34356L14.1455 4.16158L14.1573 4.14958C14.9124 3.39511 15.9362 2.97131 17.0036 2.97131C18.071 2.97131 19.0948 3.39511 19.8499 4.14958L19.8505 4.15018C20.605 4.90529 21.0288 5.92906 21.0288 6.99649C21.0288 8.06106 20.6072 9.0822 19.8566 9.83672L11.4977 18.4744C11.3859 18.59 11.2479 18.6768 11.0953 18.7277L4.67729 20.8667C4.31797 20.9864 3.92182 20.8929 3.654 20.6251C3.38618 20.3573 3.29266 19.9611 3.41241 19.6018L5.55141 13.1838C5.59875 13.0418 5.67738 12.9122 5.7815 12.8046L12.0308 6.34678Z"
                              fill="currentColor"
                            />
                          </svg>

                          <span>{$_("common.edit") || "Edit"}</span>
                        </button>

                        <!-- Delete -->
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                          onclick={() => {
                            closeActions();
                            openDeleteModal(coupon);
                          }}
                          role="menuitem"
                        >
                          <!-- Trash Icon -->
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            x="0px"
                            y="0px"
                            class="w-4 h-4"
                            viewBox="0,0,256,256"
                          >
                            <g
                              fill="#fa5252"
                              fill-rule="nonzero"
                              stroke="none"
                              stroke-width="1"
                              stroke-linecap="butt"
                              stroke-linejoin="miter"
                              stroke-miterlimit="10"
                              stroke-dasharray=""
                              stroke-dashoffset="0"
                              font-family="none"
                              font-weight="none"
                              font-size="none"
                              text-anchor="none"
                              style="mix-blend-mode: normal"
                              ><g transform="scale(2,2)"
                                ><path
                                  d="M49,1c-1.66,0 -3,1.34 -3,3c0,1.66 1.34,3 3,3h30c1.66,0 3,-1.34 3,-3c0,-1.66 -1.34,-3 -3,-3zM24,15c-7.17,0 -13,5.83 -13,13c0,7.17 5.83,13 13,13h77v63c0,9.37 -7.63,17 -17,17h-40c-9.37,0 -17,-7.63 -17,-17v-52c0,-1.66 -1.34,-3 -3,-3c-1.66,0 -3,1.34 -3,3v52c0,12.68 10.32,23 23,23h40c12.68,0 23,-10.32 23,-23v-63.35937c5.72,-1.36 10,-6.50062 10,-12.64062c0,-7.17 -5.83,-13 -13,-13zM24,21h80c3.86,0 7,3.14 7,7c0,3.86 -3.14,7 -7,7h-80c-3.86,0 -7,-3.14 -7,-7c0,-3.86 3.14,-7 7,-7zM50,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3zM78,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3z"
                                ></path></g
                              ></g
                            >
                          </svg>

                          <span>{$_("common.delete") || "Delete"}</span>
                        </button>
                      {:else}
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-600"
                          onclick={() => {
                            closeActions();
                          }}
                          role="menuitem"
                        >
                          <svg
                            class="h-4 w-4 text-gray-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M4.0117 12C4.02312 12.0329 4.04406 12.0868 4.08184 12.1644C4.16842 12.3421 4.3101 12.5758 4.51263 12.851C4.91651 13.3997 5.51827 14.0535 6.2742 14.6801C7.80015 15.9449 9.83098 17 12 17C14.169 17 16.1999 15.9449 17.7258 14.6801C18.4817 14.0535 19.0835 13.3997 19.4874 12.851C19.6899 12.5758 19.8316 12.3421 19.9182 12.1644C19.9559 12.0868 19.9769 12.0329 19.9883 12C19.9769 11.9671 19.9559 11.9132 19.9182 11.8356C19.8316 11.6579 19.6899 11.4242 19.4874 11.149C19.0835 10.6003 18.4817 9.94649 17.7258 9.3199C16.1999 8.05506 14.169 7 12 7C9.83098 7 7.80015 8.05506 6.2742 9.3199C5.51827 9.94649 4.91651 10.6003 4.51263 11.149C4.3101 11.4242 4.16842 11.6579 4.08184 11.8356C4.04406 11.9132 4.02312 11.9671 4.0117 12ZM4.99787 7.7801C6.72929 6.34495 9.19846 5 12 5C14.8015 5 17.2707 6.34495 19.0021 7.7801C19.8749 8.50351 20.5911 9.2747 21.0981 9.96347C21.351 10.3071 21.5629 10.6452 21.7161 10.9597C21.8554 11.2456 22 11.6185 22 12C22 12.3815 21.8554 12.7544 21.7161 13.0403C21.5629 13.3548 21.351 13.6929 21.0981 14.0365C20.5911 14.7253 19.8749 15.4965 19.0021 16.2199C17.2707 17.6551 14.8015 19 12 19C9.19846 19 6.72929 17.6551 4.99787 16.2199C4.12513 15.4965 3.40886 14.7253 2.9019 14.0365C2.649 13.6929 2.43705 13.3548 2.28385 13.0403C2.14458 12.7544 2 12.3815 2 12C2 11.6185 2.14458 11.2456 2.28385 10.9597C2.43705 10.6452 2.649 10.3071 2.9019 9.96347C3.40886 9.2747 4.12513 8.50351 4.99787 7.7801ZM12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10ZM8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z"
                              fill="currentColor"
                            />
                          </svg>

                          <span>{t("admin.view_only", "View only")}</span>
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
        <h2>
          {t("admin.create_new_global_coupon", "Create New Global Coupon")}
        </h2>
        <button class="close-btn" onclick={closeCreateModal}> × </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label for="code">{t("admin.coupon_code", "Coupon Code")} *</label>
            <input
              id="code"
              type="text"
              bind:value={newCoupon.code}
              placeholder={t("admin.coupon_code_placeholder", "e.g., SAVE25")}
              required
            />
          </div>

          <div class="form-group">
            <label for="discount_type"
              >{t("admin.discount_type", "Discount Type")} *</label
            >
            <select id="discount_type" bind:value={newCoupon.discount_type}>
              <option value="percentage"
                >{t("admin.percentage", "Percentage")}</option
              >
              <option value="fixed_amount"
                >{t("admin.fixed_amount", "Fixed Amount")}</option
              >
            </select>
          </div>

          <div class="form-group">
            <label for="discount_value"
              >{t("admin.discount_value", "Discount Value")} *</label
            >
            <input
              id="discount_value"
              type="number"
              bind:value={newCoupon.discount_value}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="minimum_spend"
              >{t("admin.minimum_spend", "Minimum Spend")}</label
            >
            <input
              id="minimum_spend"
              type="number"
              bind:value={newCoupon.minimum_spend}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="maximum_amount"
              >{t(
                "admin.maximum_discount_amount",
                "Maximum Discount Amount",
              )}</label
            >
            <input
              id="maximum_amount"
              type="number"
              bind:value={newCoupon.maximum_amount}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="maximum_uses"
              >{t("admin.maximum_uses", "Maximum Uses")}</label
            >
            <input
              id="maximum_uses"
              type="number"
              bind:value={newCoupon.maximum_uses}
              min="0"
            />
          </div>

          <div class="form-group">
            <label for="maximum_per_user"
              >{t("admin.maximum_per_user", "Maximum Per User")}</label
            >
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
              {t("admin.is_shipping_coupon", "Is Shipping Coupon")}
            </label>
          </div>

          <div class="form-group">
            <label for="valid_from"
              >{t("admin.valid_from", "Valid From")} *</label
            >
            <input
              id="valid_from"
              type="date"
              bind:value={newCoupon.validity.from}
              required
            />
          </div>

          <div class="form-group">
            <label for="valid_to">{t("admin.valid_to", "Valid To")} *</label>
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
        <button
          class="btn-primary w-full"
          onclick={handleCreateCoupon}
          disabled={loading}
        >
          {loading
            ? t("admin.creating", "Creating...")
            : t("admin.create_coupon", "Create Coupon")}
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
        <h2>{t("admin.edit_coupon", "Edit Coupon")}</h2>
        <button class="close-btn" onclick={() => (editModalOpen = false)}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>{t("admin.coupon_code", "Coupon Code")}</label>
            <input type="text" bind:value={editFormData.code} />
          </div>

          <div class="form-group">
            <label>{t("admin.discount_type", "Discount Type")}</label>
            <select bind:value={editFormData.discount_type}>
              <option value="percentage"
                >{t("admin.percentage", "Percentage")}</option
              >
              <option value="fixed_amount"
                >{t("admin.fixed_amount", "Fixed Amount")}</option
              >
            </select>
          </div>

          <div class="form-group">
            <label>{t("admin.discount_value", "Discount Value")}</label>
            <input
              type="number"
              bind:value={editFormData.discount_value}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>{t("admin.minimum_spend", "Minimum Spend")}</label>
            <input
              type="number"
              bind:value={editFormData.minimum_spend}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>{t("admin.maximum_amount", "Maximum Amount")}</label>
            <input
              type="number"
              bind:value={editFormData.maximum_amount}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>{t("admin.maximum_uses", "Maximum Uses")}</label>
            <input
              type="number"
              bind:value={editFormData.maximum_uses}
              min="0"
            />
          </div>

          <div class="form-group">
            <label>{t("admin.valid_from", "Valid From")}</label>
            <input type="date" bind:value={editFormData.validity.from} />
          </div>

          <div class="form-group">
            <label>{t("admin.valid_to", "Valid To")}</label>
            <input type="date" bind:value={editFormData.validity.to} />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn-primary w-full"
          onclick={handleUpdateCoupon}
          disabled={loading}
        >
          {loading
            ? t("admin.updating", "Updating...")
            : t("admin.update_coupon", "Update Coupon")}
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
        <h2>{t("admin.delete_coupon", "Delete Coupon")}</h2>
        <button class="close-btn" onclick={() => (deleteModalOpen = false)}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <p>
          {t(
            "admin.delete_coupon_confirmation",
            "Are you sure you want to delete the coupon",
          )}
          <strong>{deletingCoupon.attributes.payload?.body?.code}</strong>?
        </p>
        <p class="warning">
          {t("admin.action_cannot_be_undone", "This action cannot be undone.")}
        </p>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (deleteModalOpen = false)}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          class="btn-danger"
          onclick={handleDeleteCoupon}
          disabled={loading}
        >
          {loading
            ? t("admin.deleting", "Deleting...")
            : $_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

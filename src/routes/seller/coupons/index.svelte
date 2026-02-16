<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate, formatNumber } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import { ResourceType } from "@edraj/tsdmart";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import "../styles/index.css";
  import CouponModal from "@/components/sellers/CouponModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";
  import { website } from "@/config";

  $goto;

  // -----------------------------
  // Data
  // -----------------------------
  let items = $state<any[]>([]);
  let filteredItems = $state<any[]>([]);
  let isLoading = $state(true);
  let searchTerm = $state("");

  // List pagination (table)
  let listPage = $state(1);
  let listItemsPerPage = $state(10);

  // Modals
  let showCouponModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToEdit = $state<any>(null);
  let itemToDelete = $state<any>(null);

  let couponForm = $state({
    code: "",
    type: "individual",
    discountType: "percentage",
    discountValue: "",
    minimumSpend: "",
    maximumAmount: "",
    maximumUses: "",
    maximumPerUser: "1",
    validFrom: "",
    validTo: "",
    brandShortnames: [] as string[],
  });

  let brands = $state<any[]>([]);
  let isLoadingBrands = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  // -----------------------------
  // Lifecycle
  // -----------------------------
  onMount(async () => {
    await Promise.all([loadCoupons(), loadBrands()]);
  });

  async function loadCoupons() {
    isLoading = true;
    try {
      const sellerShortname = $user.shortname;
      const response = await getSpaceContents(
        website.main_space,
        `/coupons/${sellerShortname}`,
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        items = response.records;
        applyFilters();
      } else {
        items = [];
        filteredItems = [];
      }
    } catch (error) {
      console.error("Error loading coupons:", error);
      errorToastMessage("Error loading coupons");
    } finally {
      isLoading = false;
    }
  }

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

  // -----------------------------
  // Filtering + Pagination
  // -----------------------------
  function applyFilters() {
    if (!searchTerm.trim()) {
      filteredItems = [...items];
      listPage = 1;
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    filteredItems = items.filter((item) => {
      const displayname = getItemDisplayName(item).toLowerCase();
      const code = item.attributes?.payload?.body?.code?.toLowerCase() || "";
      return displayname.includes(searchLower) || code.includes(searchLower);
    });

    listPage = 1;
  }

  const listTotalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(filteredItems.length / listItemsPerPage));
  });

  const paginatedItems = $derived.by(() => {
    const start = (listPage - 1) * listItemsPerPage;
    const end = start + listItemsPerPage;
    return filteredItems.slice(start, end);
  });

  function goToListPage(page: number) {
    if (page < 1 || page > listTotalPages) return;
    listPage = page;
  }

  // -----------------------------
  // Stats (NEW)
  // total coupons / individual / other / avg discount
  // -----------------------------
  function getCouponBody(item: any) {
    return item?.attributes?.payload?.body || {};
  }

  function getDiscountNumber(item: any) {
    const body = getCouponBody(item);
    const v = Number(body?.discount_value ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  const totalCouponsStat = $derived.by(() => filteredItems.length);

  const individualCouponsStat = $derived.by(() => {
    return filteredItems.filter(
      (i) => (getCouponBody(i)?.type || "").toLowerCase() === "individual",
    ).length;
  });

  const otherCouponsStat = $derived.by(() => {
    return filteredItems.filter(
      (i) => (getCouponBody(i)?.type || "").toLowerCase() !== "individual",
    ).length;
  });

  const avgDiscountStat = $derived.by(() => {
    if (filteredItems.length === 0) return 0;
    const sum = filteredItems.reduce((acc, i) => acc + getDiscountNumber(i), 0);
    return sum / filteredItems.length;
  });

  // -----------------------------
  // Create
  // -----------------------------
  function openCouponModal() {
    showCouponModal = true;
    couponForm = {
      code: "",
      type: "individual",
      discountType: "percentage",
      discountValue: "",
      minimumSpend: "",
      maximumAmount: "",
      maximumUses: "",
      maximumPerUser: "1",
      validFrom: "",
      validTo: "",
      brandShortnames: [],
    };
  }

  function closeCouponModal() {
    showCouponModal = false;
  }

  async function submitCoupon() {
    if (
      !couponForm.code ||
      !couponForm.discountValue ||
      !couponForm.validFrom ||
      !couponForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;

      const couponData = {
        displayname_en: `${couponForm.code} - ${
          couponForm.discountType === "percentage"
            ? couponForm.discountValue + "%"
            : "IQD" + couponForm.discountValue
        }`,
        displayname_ar: `${couponForm.code} - ${
          couponForm.discountType === "percentage"
            ? couponForm.discountValue + "%"
            : "IQD" + couponForm.discountValue
        }`,
        displayname_ku: null,
        body: {
          code: couponForm.code.toUpperCase(),
          type: couponForm.type,
          discount_type: couponForm.discountType,
          discount_value: parseFloat(couponForm.discountValue),
          minimum_spend: couponForm.minimumSpend
            ? parseFloat(couponForm.minimumSpend)
            : 0,
          maximum_amount: couponForm.maximumAmount
            ? parseFloat(couponForm.maximumAmount)
            : null,
          maximum_uses: couponForm.maximumUses
            ? parseInt(couponForm.maximumUses)
            : null,
          maximum_per_user: parseInt(couponForm.maximumPerUser) || 1,
          usage_count: 0,
          validity: {
            from: couponForm.validFrom,
            to: couponForm.validTo,
          },
          applies_to: {
            brand_shortnames: couponForm.brandShortnames,
          },
          seller_shortname: $user.shortname,
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        couponData,
        website.main_space,
        `/coupons/${$user.shortname}`,
        ResourceType.content,
        "",
        "",
      );

      successToastMessage("Coupon created successfully!");
      closeCouponModal();
      await loadCoupons();
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage("Failed to create coupon");
    } finally {
      isLoading = false;
    }
  }

  // -----------------------------
  // Edit
  // -----------------------------
  async function openEditModal(item: any) {
    itemToEdit = item;
    const content = item.attributes?.payload?.body || {};

    couponForm = {
      code: content.code || "",
      type: content.type || "individual",
      discountType: content.discount_type || "percentage",
      discountValue: content.discount_value?.toString() || "",
      minimumSpend: content.minimum_spend?.toString() || "",
      maximumAmount: content.maximum_amount?.toString() || "",
      maximumUses: content.maximum_uses?.toString() || "",
      maximumPerUser: content.maximum_per_user?.toString() || "1",
      validFrom: content.validity?.from || "",
      validTo: content.validity?.to || "",
      brandShortnames: content.applies_to?.brand_shortnames || [],
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    itemToEdit = null;
  }

  async function submitEdit() {
    if (!itemToEdit) return;

    if (
      !couponForm.code ||
      !couponForm.discountValue ||
      !couponForm.validFrom ||
      !couponForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;

      const updateData = {
        displayname_en: `${couponForm.code} - ${
          couponForm.discountType === "percentage"
            ? couponForm.discountValue + "%"
            : "IQD" + couponForm.discountValue
        }`,
        displayname_ar: `${couponForm.code} - ${
          couponForm.discountType === "percentage"
            ? couponForm.discountValue + "%"
            : "IQD" + couponForm.discountValue
        }`,
        displayname_ku: null,
        body: {
          code: couponForm.code.toUpperCase(),
          type: couponForm.type,
          discount_type: couponForm.discountType,
          discount_value: parseFloat(couponForm.discountValue),
          minimum_spend: couponForm.minimumSpend
            ? parseFloat(couponForm.minimumSpend)
            : 0,
          maximum_amount: couponForm.maximumAmount
            ? parseFloat(couponForm.maximumAmount)
            : null,
          maximum_uses: couponForm.maximumUses
            ? parseInt(couponForm.maximumUses)
            : null,
          maximum_per_user: parseInt(couponForm.maximumPerUser) || 1,
          usage_count: itemToEdit.attributes?.payload?.body?.usage_count || 0,
          validity: {
            from: couponForm.validFrom,
            to: couponForm.validTo,
          },
          applies_to: {
            brand_shortnames: couponForm.brandShortnames,
          },
          seller_shortname: $user.shortname,
        },
        tags: [],
        is_active: true,
      };

      await updateEntity(
        itemToEdit.shortname,
        website.main_space,
        itemToEdit.subpath,
        itemToEdit.resource_type,
        updateData,
        "",
        "",
      );

      successToastMessage("Coupon updated successfully!");
      closeEditModal();
      await loadCoupons();
    } catch (error) {
      console.error("Error updating coupon:", error);
      errorToastMessage("Failed to update coupon");
    } finally {
      isLoading = false;
    }
  }

  // -----------------------------
  // Delete
  // -----------------------------
  function openDeleteModal(item: any) {
    itemToDelete = item;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    itemToDelete = null;
  }

  async function confirmDelete() {
    if (!itemToDelete) return;

    try {
      isLoading = true;

      await deleteEntity(
        itemToDelete.shortname,
        itemToDelete.space_name,
        itemToDelete.subpath,
        itemToDelete.resource_type,
      );

      successToastMessage("Coupon deleted successfully!");
      closeDeleteModal();
      await loadCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      errorToastMessage("Failed to delete coupon");
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    applyFilters();
  });
    function couponBody(item: any) {
    return item?.attributes?.payload?.body || {};
  }

  function couponTypeState(item: any) {
    return (couponBody(item)?.type || "individual").toLowerCase();
  }

  function couponCode(item: any) {
    return couponBody(item)?.code || "-";
  }
</script>

<div class="seller-page-container">
  <!-- ✅ Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- total icon -->
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z" fill="#3C307F"/>
</svg>

      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">
          Total Coupons
        </h3>
        <p class="stat-value">{formatNumber(totalCouponsStat, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- individual icon -->
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C14.6863 6 12 8.68629 12 12C12 15.3137 14.6863 18 18 18C21.3137 18 24 15.3137 24 12C24 8.68629 21.3137 6 18 6ZM9 27C9 23.6863 11.6863 21 15 21H21C24.3137 21 27 23.6863 27 27V30H9V27Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">
          Individual Coupons
        </h3>
        <p class="stat-value">{formatNumber(individualCouponsStat, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- other icon -->
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M12 10.5C12 8.84315 13.3431 7.5 15 7.5H27C28.6569 7.5 30 8.84315 30 10.5V25.5C30 27.1569 28.6569 28.5 27 28.5H15C13.3431 28.5 12 27.1569 12 25.5V10.5ZM6 12C6 10.3431 7.34315 9 9 9H10.5V27H9C7.34315 27 6 25.6569 6 24V12Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">
          Other Coupons
        </h3>
        <p class="stat-value">{formatNumber(otherCouponsStat, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- avg icon -->
       <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z" stroke="#3C307F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">
          Avg Discount
        </h3>
        <p class="stat-value">
          {formatNumber(Math.round(avgDiscountStat), $locale)}
        </p>
      </div>
    </div>
  </div>

  <div class="seller-page-content" class:rtl={$isRTL}>
    <!-- ✅ Header controls (search + add) -->
    <div
      class="flex flex-col md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {$_("common.search") || "Search"}
        </label>

        <div class="relative w-[256px]">
          <div
            class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
          >
            <svg class="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          <input
            type="text"
            bind:value={searchTerm}
            placeholder={$_("seller_dashboard.search_coupons") || "Search coupons..."}
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

      <div class="flex items-end">
        <button
          onclick={openCouponModal}
          class="inline-flex items-center justify-center mx-2
               h-9 cursor-pointer
               px-3 py-2
               bg-[#3C307F] text-white text-sm font-medium
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               hover:bg-[#2f2666]
               transition-colors duration-200"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path d="M10 5v10M5 10h10" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span class="ml-2">{$_("seller_dashboard.add_coupon") || "Add Coupon"}</span>
        </button>
      </div>
    </div>

    <!-- ✅ Table -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="12" width="32" height="24" rx="2" stroke-width="2" />
          <circle cx="14" cy="24" r="2" fill="currentColor" />
          <circle cx="34" cy="24" r="2" fill="currentColor" />
          <path
            d="M20 24h8"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray="2 2"
          />
        </svg>
        <h3>{$_("seller_dashboard.no_coupons") || "No coupons found"}</h3>
      </div>
    {:else}
      <table class="items-table">
        <thead>
          <tr>
            <th>{$_("seller_dashboard.code") || "Code"}</th>
            <th>{$_("seller_dashboard.type") || "Type"}</th>
            <th>{$_("seller_dashboard.discount") || "Discount"}</th>
            <th>{$_("seller_dashboard.validity") || "Validity"}</th>
            <th>{$_("seller_dashboard.usage") || "Usage"}</th>
            <th class="col-actions">{$_("common.actions") || "Actions"}</th>
          </tr>
        </thead>

        <tbody>
  {#each paginatedItems as item (item.shortname)}
    <tr class="item-row">
      <td>
        <div class="item-title">
          {#if couponCode(item).length > 12}
            {couponCode(item).slice(0, 12)}...
          {:else}
            {couponCode(item)}
          {/if}
        </div>
      </td>

      <!-- Type badge WITH SVG icon -->
      <td>
        <span
          class="status-badge"
          class:active={couponTypeState(item) === "individual"}
          class:pending={couponTypeState(item) !== "individual"}
        >
          {#if couponTypeState(item) === "individual"}
            <!-- user icon -->
            <svg
              class="status-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M8 8a3 3 0 100-6 3 3 0 000 6z"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M2 14c1-3 3-4 6-4s5 1 6 4"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {:else}
            <!-- group icon -->
            <svg
              class="status-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M6 7a2 2 0 100-4 2 2 0 000 4zM10 7a2 2 0 100-4 2 2 0 000 4z"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M2 14c.5-2 2-3 4-3M14 14c-.5-2-2-3-4-3M6 11c1.5 0 2.5.5 3 3"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {/if}

          <span class="status-text">{couponBody(item)?.type || "individual"}</span>
        </span>
      </td>

      <td>
        {#if couponBody(item)?.discount_type === "percentage"}
          {couponBody(item)?.discount_value}% 
        {:else}
          {couponBody(item)?.discount_value} {$_("seller_dashboard.currency") || "IQD"}
        {/if}
      </td>

      <td>
        <div class="product-info">
          {formatDate(couponBody(item)?.validity?.from)} - {formatDate(
            couponBody(item)?.validity?.to,
          )}
        </div>
      </td>

      <td>
        {couponBody(item)?.usage_count || 0}
        {#if couponBody(item)?.maximum_uses}
          / {couponBody(item)?.maximum_uses}
        {/if}
      </td>

      <td class="actions-cell">
        <div class="action-buttons" onclick={(e) => e.stopPropagation()}>
          <button
            class="action-icon-btn"
            onclick={() => openEditModal(item)}
            title={$_("common.edit") || "Edit"}
            aria-label="Edit"
          >
            <!-- edit svg -->
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M9.9061 2.33335C9.82824 2.33335 9.75114 2.3487 9.6792 2.37851C9.60727 2.40831 9.54192 2.452 9.48688 2.50708L9.16831 2.82566L10.007 3.66437L10.3255 3.34593C10.3805 3.29089 10.4244 3.2254 10.4542 3.15347C10.484 3.08154 10.4993 3.00444 10.4993 2.92657C10.4993 2.84871 10.484 2.77161 10.4542 2.69968C10.4244 2.62775 10.3807 2.56239 10.3256 2.50735C10.2706 2.45228 10.2049 2.40831 10.133 2.37851C10.0611 2.3487 9.98396 2.33335 9.9061 2.33335ZM9.18206 4.48933L8.34335 3.65062L5.6193 6.37469L5.40962 7.42308L6.45801 7.2134L9.18206 4.48933ZM7.92943 2.41462L4.66945 5.67463C4.58802 5.75606 4.53251 5.85978 4.50993 5.9727L4.09401 8.05229C4.05576 8.24354 4.11562 8.44125 4.25354 8.57917C4.39145 8.71708 4.58916 8.77694 4.78042 8.73869L6.86 8.32278C6.97293 8.30019 7.07664 8.24468 7.15808 8.16325L11.1503 4.17102C11.3138 4.00764 11.4435 3.81364 11.532 3.60011C11.6204 3.38658 11.666 3.15771 11.666 2.92657C11.666 2.69544 11.6204 2.46656 11.532 2.25303C11.4435 2.03963 11.3139 1.84572 11.1505 1.6824M1.16602 4.66669C1.16602 4.02235 1.68835 3.50002 2.33268 3.50002H4.08268C4.40485 3.50002 4.66602 3.76119 4.66602 4.08335C4.66602 4.40552 4.40485 4.66669 4.08268 4.66669H2.33268V10.5H8.74935V7.87502C8.74935 7.55285 9.01052 7.29169 9.33268 7.29169C9.65485 7.29169 9.91602 7.55285 9.91602 7.87502V10.5C9.91602 11.1444 9.39368 11.6667 8.74935 11.6667H2.33268C1.68835 11.6667 1.16602 11.1444 1.16602 10.5V4.66669Z"
                fill="#4A5565"
              />
            </svg>
          </button>

          <button
            class="action-icon-btn"
            onclick={() => openDeleteModal(item)}
            title={$_("common.delete") || "Delete"}
            aria-label="Delete"
          >
            <!-- delete svg -->
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
              <path
                d="M2 4h12M5 4V2h6v2M3 4h10l-1 10H4L3 4z"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  {/each}
</tbody>

      </table>

      <!-- ✅ Pagination (same pattern as your other tables) -->
      {#if listTotalPages > 1}
        <div class="pagination">
          <div class="pagination-info">
            {$_("common.showing") || "Showing"}
            {formatNumber((listPage - 1) * listItemsPerPage + 1, $locale)}
            -
            {formatNumber(
              Math.min(listPage * listItemsPerPage, filteredItems.length),
              $locale,
            )}
            {$_("common.of") || "of"}
            {formatNumber(filteredItems.length, $locale)}
            {$_("seller_dashboard.coupons") || "coupons"}
          </div>

          <div class="pagination-pages">
            {#if listTotalPages <= 7}
              {#each Array(listTotalPages) as _, index}
                <button
                  class="page-btn"
                  class:active={listPage === index + 1}
                  onclick={() => goToListPage(index + 1)}
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <button
                class="page-btn"
                class:active={listPage === 1}
                onclick={() => goToListPage(1)}
              >
                {formatNumber(1, $locale)}
              </button>

              {#if listPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(listTotalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < listTotalPages && Math.abs(listPage - (index + 1)) <= 1}
                  <button
                    class="page-btn"
                    class:active={listPage === index + 1}
                    onclick={() => goToListPage(index + 1)}
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if listPage < listTotalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <button
                class="page-btn"
                class:active={listPage === listTotalPages}
                onclick={() => goToListPage(listTotalPages)}
              >
                {formatNumber(listTotalPages, $locale)}
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Coupon Modal -->
<CouponModal
  bind:show={showCouponModal}
  isRTL={$isRTL}
  bind:couponForm
  {brands}
  {isLoadingBrands}
  onClose={closeCouponModal}
  onSubmit={submitCoupon}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Edit Modal -->
{#if showEditModal && itemToEdit}
  <CouponModal
    bind:show={showEditModal}
    isRTL={$isRTL}
    bind:couponForm
    {brands}
    {isLoadingBrands}
    onClose={closeEditModal}
    onSubmit={submitEdit}
    getLocalizedDisplayName={getItemDisplayName}
  />
{/if}

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  show={showDeleteModal}
  item={itemToDelete}
  {isLoading}
  onClose={closeDeleteModal}
  onConfirm={confirmDelete}
/>

<style>
  /* Background like other pages */
  .seller-page-container,
  .seller-page-content {
    background: #f9fafb;
    min-height: 100vh;
  }

  /* --- Stats grid (same pattern) --- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin: 1rem 0 1.5rem;
  }

  .stat-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s ease;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.1);
  }

  .bg-icon {
    width: 56px;
    height: 56px;
    background: #f3f4ff;
    border: 1px solid #e5e7ff;
  }

  .stat-value {
    margin: 0.25rem 0 0;
    font-size: 1.35rem;
    color: #111827;
    font-weight: 800;
  }

  /* --- Type badge (same system as status badges) --- */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid transparent;
    text-transform: capitalize;
    line-height: 1;
    white-space: nowrap;
  }

  .status-icon {
    width: 14px;
    height: 14px;
  }

  /* "individual" -> green */
  .status-badge.active {
    background: #ecfdf3;
    color: #027a48;
    border-color: #abefc6;
  }

  /* "other" -> blue */
  .status-badge.pending {
    background: #eff8ff;
    color: #175cd3;
    border-color: #b2ddff;
  }

  /* --- Actions icon button (your exact spec) --- */
  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
  }

  .action-icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 10px;
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.05s ease;
  }

  .action-icon-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .action-icon-btn:active {
    transform: translateY(1px);
  }

  .action-icon-btn svg {
    width: 14px;
    height: 14px;
  }

  /* --- Pagination --- */
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
    font-weight: 700;
  }

  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 700;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
  }
</style>

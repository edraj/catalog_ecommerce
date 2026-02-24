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
  import './index.css'
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

  let openActionsFor = $state<string | null>(null);

  let currentPage = $derived.by(() => listPage);
  let itemsPerPage = $derived.by(() => listItemsPerPage);
  let totalPages = $derived.by(() => listTotalPages);
  let totalItemsCount = $derived.by(() => filteredItems.length);

  function goToPage(page: number) {
    if (page < 1 || page > listTotalPages) return;
    listPage = page;
  }
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

<div class="coupons-container" dir={$isRTL ? "rtl" : "ltr"}>
  <!-- ================= STATS ================= -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- same icon as layout page -->
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
        <p class="stat-value">
          {formatNumber(totalCouponsStat, $locale)}
        </p>
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
            d="M18 9C16.3431 9 15 10.3431 15 12C15 13.6569 16.3431 15 18 15C19.6569 15 21 13.6569 21 12C21 10.3431 19.6569 9 18 9ZM12 12C12 8.68629 14.6863 6 18 6C21.3137 6 24 8.68629 24 12C24 15.3137 21.3137 18 18 18C14.6863 18 12 15.3137 12 12ZM15 22.5C13.3431 22.5 12 23.8431 12 25.5V27H24V25.5C24 23.8431 22.6569 22.5 21 22.5H15ZM9 25.5C9 22.1863 11.6863 19.5 15 19.5H21C24.3137 19.5 27 22.1863 27 25.5V27C27 28.6569 25.6569 30 24 30H12C10.3431 30 9 28.6569 9 27V25.5Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Individual</h3>
        <p class="stat-value">
          {formatNumber(individualCouponsStat, $locale)}
        </p>
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
            d="M18.4612 7.5C18.4611 7.5 18.4612 7.5 18.4612 7.5V7.5ZM18.4744 7.50001L27.0568 7.51047C27.0578 7.51048 27.0588 7.51049 27.0598 7.5105C27.4433 7.51362 27.8101 7.66835 28.0799 7.94096C28.3505 8.21429 28.5016 8.58379 28.5 8.96838L28.5 17.2208C28.4868 17.2332 28.4738 17.2458 28.461 17.2587L17.328 28.483L7.50172 18.57L18.4744 7.50001ZM18.4688 4.50001C18.4684 4.50001 18.4692 4.50001 18.4688 4.50001L27.0751 4.51051C28.2543 4.51769 29.3824 4.99241 30.212 5.83046C31.0409 6.66778 31.504 7.79948 31.5 8.97757C31.5 8.97859 31.5 8.97961 31.5 8.98063L30 8.9745H31.5V8.97757V17.2243C31.5 17.6346 31.4156 18.0407 31.2521 18.417C31.093 18.7829 30.8624 19.1131 30.574 19.3884L30.591 19.3713L29.526 18.315L30.5491 19.4119C30.5575 19.4041 30.5658 19.3963 30.574 19.3884L19.4336 30.6201L18.3676 29.5652L19.4325 30.6213C19.1575 30.8989 18.8303 31.1193 18.4698 31.2699C18.1087 31.4207 17.7214 31.4985 17.3301 31.4987C16.9389 31.499 16.5514 31.4218 16.1902 31.2715C15.8289 31.1212 15.501 30.9009 15.2254 30.6232L5.36657 20.6774L6.43048 19.62L5.36517 20.676C4.80937 20.116 4.49744 19.359 4.49744 18.57C4.49744 17.7807 4.80962 17.0234 5.36584 16.4633L16.3644 5.36719C16.6409 5.09132 16.9691 4.87273 17.3302 4.72392C17.6909 4.57526 18.0786 4.49918 18.4688 4.50001ZM21.8745 12.6672C21.8745 11.8388 22.5461 11.1672 23.3745 11.1672H23.3895C24.2179 11.1672 24.8895 11.8388 24.8895 12.6672C24.8895 13.4957 24.2179 14.1672 23.3895 14.1672H23.3745C22.5461 14.1672 21.8745 13.4957 21.8745 12.6672Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Other</h3>
        <p class="stat-value">
          {formatNumber(otherCouponsStat, $locale)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z"
            stroke="#3C307F"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Avg Discount</h3>
        <p class="stat-value">
          {formatNumber(Math.round(avgDiscountStat), $locale)}
        </p>
      </div>
    </div>
  </div>

  <!-- ================= HEADER ================= -->
  <div
    class="flex flex-col md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
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
          bind:value={searchTerm}
          placeholder="Search coupons..."
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

    <!-- CREATE BUTTON -->
    <button
      type="button"
      onclick={openCouponModal}
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
      <span class="ml-2">Add Coupon</span>
    </button>
  </div>

  <!-- ================= TABLE ================= -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
    </div>
  {:else if filteredItems.length === 0}
    <div class="empty-state">
      <p>No coupons found.</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="coupons-table w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >Code</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >Type</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >Discount</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >Validity</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >Usage</th
            >
            <th
              class="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
            ></th>
          </tr>
        </thead>

        <tbody class="bg-white">
          {#each paginatedItems as item}
            <tr class="hover:bg-gray-50 transition-colors duration-200">
              <td class="px-6 py-4 font-medium text-gray-900">
                {couponCode(item)}
              </td>

              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center rounded-sm border px-2 py-0.5 bg-[#EEF6FF] border-[#BEDBFF] text-[#1C398E] text-xs"
                >
                  {couponTypeState(item)}
                </span>
              </td>

              <td class="px-6 py-4">
                {#if couponBody(item)?.discount_type === "percentage"}
                  {couponBody(item)?.discount_value}%
                {:else}
                  {couponBody(item)?.discount_value} IQD
                {/if}
              </td>

              <td class="px-6 py-4">
                {formatDate(couponBody(item)?.validity?.from)} -
                {formatDate(couponBody(item)?.validity?.to)}
              </td>

              <td class="px-6 py-4">
                {couponBody(item)?.usage_count || 0}
                {#if couponBody(item)?.maximum_uses}
                  / {couponBody(item)?.maximum_uses}
                {/if}
              </td>

              <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
                <div
                  class="relative flex justify-end"
                  onclick={(e) => e.stopPropagation()}
                >
                  <button
                    class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                    aria-label="Actions"
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(item)}
                    onclick={() => toggleTableActions(item)}
                    type="button"
                  >
                    <span class="text-xl leading-none">…</span>
                  </button>

                  {#if openActionsFor === getRowId(item)}
                    <div
                      class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                      role="menu"
                    >
                      <!-- View details (optional) -->

                      <!-- Edit -->
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                        onclick={() => {
                          closeActions();
                          openEditModal(item); // use your existing edit handler
                        }}
                        role="menuitem"
                        type="button"
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
                          openDeleteModal(item); // use your existing delete handler
                        }}
                        role="menuitem"
                        type="button"
                      >
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
                          >
                            <g transform="scale(2,2)">
                              <path
                                d="M49,1c-1.66,0 -3,1.34 -3,3c0,1.66 1.34,3 3,3h30c1.66,0 3,-1.34 3,-3c0,-1.66 -1.34,-3 -3,-3zM24,15c-7.17,0 -13,5.83 -13,13c0,7.17 5.83,13 13,13h77v63c0,9.37 -7.63,17 -17,17h-40c-9.37,0 -17,-7.63 -17,-17v-52c0,-1.66 -1.34,-3 -3,-3c-1.66,0 -3,1.34 -3,3v52c0,12.68 10.32,23 23,23h40c12.68,0 23,-10.32 23,-23v-63.35937c5.72,-1.36 10,-6.50062 10,-12.64062c0,-7.17 -5.83,-13 -13,-13zM24,21h80c3.86,0 7,3.14 7,7c0,3.86 -3.14,7 -7,7h-80c-3.86,0 -7,-3.14 -7,-7c0,-3.86 3.14,-7 7,-7zM50,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3zM78,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3z"
                              ></path>
                            </g>
                          </g>
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

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <!-- Left text -->
        <div class="pagination-info">
          <span class="pagination-info__label">
            {$_("common.showing") || "Showing"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
            -
            {formatNumber(
              Math.min(currentPage * itemsPerPage, totalItemsCount),
              $locale,
            )}
          </span>

          <span class="pagination-info__label">
            {$_("common.of") || "of"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber(totalItemsCount, $locale)}
          </span>
        </div>

        <!-- Right controls -->
        <div class="pagination-controls">
          <!-- Prev -->
          <button
            class="pager-arrow pager-arrow--left"
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            type="button"
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
                d="M4.86195 8.47132C4.6016 8.21097 4.6016 7.78886 4.86195 7.52851L9.52862 2.86185C9.78897 2.6015 10.2111 2.6015 10.4714 2.86185C10.7318 3.1222 10.7318 3.54431 10.4714 3.80466L6.27616 7.99992L10.4714 12.1952C10.7318 12.4555 10.7318 12.8776 10.4714 13.138C10.2111 13.3983 9.78897 13.3983 9.52862 13.138L4.86195 8.47132Z"
                fill="#101828"
              />
            </svg>
          </button>

          <!-- Pages -->
          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-chip"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                  type="button"
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <!-- 1 -->
              <button
                class="page-chip"
                class:active={currentPage === 1}
                onclick={() => goToPage(1)}
                type="button"
              >
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-chip"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                    type="button"
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <!-- last -->
              <button
                class="page-chip"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
                type="button"
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <!-- Next -->
          <button
            class="pager-arrow pager-arrow--right"
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            type="button"
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
                d="M11.1381 7.52868C11.3985 7.78903 11.3985 8.21114 11.1381 8.47149L6.47145 13.1382C6.2111 13.3985 5.78899 13.3985 5.52864 13.1382C5.26829 12.8778 5.26829 12.4557 5.52864 12.1953L9.7239 8.00008L5.52864 3.80482C5.26829 3.54447 5.26829 3.12236 5.52864 2.86201C5.78899 2.60166 6.2111 2.60166 6.47145 2.86201L11.1381 7.52868Z"
                fill="#101828"
              />
            </svg>
          </button>
        </div>
      </div>
    {/if}
  {/if}
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

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { _ } from "svelte-i18n";
  import { getSellerOrders, updateOrderState } from "@/lib/dmart_services";
  import type { Order } from "@/lib/types";
  import OrderDetailsModal from "@/components/modals/OrderDetailsModal.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { user } from "@/stores/user";
  import { website } from "@/config";

  let orders: any[] = [];
  let filteredOrders = $state<any[]>([]);
  let loading = $state(false);
  let itemsPerPage = $state(20);
  let totalOrders = $state(0);
  let error = $state("");
  let currentPage = $state(1);

  let selectedState = $state("all");
  let selectedPaymentStatus = $state("all");
  let searchQuery = $state("");
  let phoneFilter = $state("");
  let governorateFilter = $state("");
  let dateFrom = $state("");
  let dateTo = $state("");
  let searchDebounce = $state<ReturnType<typeof setTimeout> | null>(null);

  let showOrderDetails = $state(false);
  let selectedOrder = $state<any | null>(null);

  let sellerShortname = $state("");
  let initialized = false;

  // dropdowns (top bar)
  let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);

  // row actions
  let openActionsFor = $state<string | null>(null);

  const orderStates = [
    { value: "all", label: "All Orders" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "processing", label: "Processing" },
    { value: "delivered", label: "Delivered" },
    { value: "delivery_confirmed", label: "Delivery Confirmed" },
    { value: "issue_reported", label: "Issue Reported" },
    { value: "refund_pending", label: "Refund Pending" },
    { value: "refunded", label: "Refunded" },
    { value: "resolved", label: "Resolved" },
    { value: "cancel", label: "Customer Cancelled" },
    { value: "customer_cancelled", label: "Customer Cancel" },
  ];

  const paymentStatuses = [
    { value: "all", label: "All Payment Status" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "unpaid", label: "Unpaid" },
    { value: "nopaid", label: "Not Paid" },
    { value: "failed", label: "Failed" },
  ];

  $effect(() => {
    if ($user && $user.shortname && !initialized) {
      sellerShortname = $user.shortname;
      initialized = true;
      loadOrders();
    }
  });

  function scheduleLoadOrders() {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentPage = 1;
      loadOrders();
    }, 400);
  }

  async function loadOrders() {
    if (!sellerShortname) {
      error = "Seller information not found";
      loading = false;
      return;
    }

    loading = true;
    error = "";

    try {
      const offset = (currentPage - 1) * itemsPerPage;

      const stateFilter = selectedState !== "all" ? selectedState : undefined;
      const paymentFilter =
        selectedPaymentStatus !== "all" ? selectedPaymentStatus : undefined;

      const phoneValue = phoneFilter.trim() || undefined;
      const governorateValue = governorateFilter.trim() || undefined;
      const searchValue = searchQuery.trim() || undefined;

      const response = await getSellerOrders(
        website.main_space,
        sellerShortname,
        itemsPerPage,
        offset,
        stateFilter,
        paymentFilter,
        phoneValue,
        governorateValue,
        searchValue,
      );

      if (response.status === "success") {
        orders = response.records || [];
        totalOrders = response.attributes?.total || 0;
        applyClientFilters();
      } else {
        error = "Failed to load orders";
      }
    } catch (e) {
      error = "An error occurred while loading orders";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  // NOTE: dateFrom/dateTo are applied client-side (like your old page)
  function applyClientFilters() {
    filteredOrders = orders.filter((order) => {
      const payload = order.attributes?.payload?.body;
      if (!payload) return false;

      // payment status (client-side as extra safety)
      if (
        selectedPaymentStatus !== "all" &&
        payload.payment_status !== selectedPaymentStatus
      ) {
        return false;
      }

      // search (client-side; server already filters too)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesOrderCode = payload.order_code?.toLowerCase().includes(q);
        const matchesCustomer = payload.user?.displayname
          ?.toLowerCase()
          .includes(q);
        const matchesTracking = payload.tracking_code
          ?.toLowerCase()
          .includes(q);
        const matchesPhone = payload.user?.phone?.toString().includes(q);

        if (
          !matchesOrderCode &&
          !matchesCustomer &&
          !matchesTracking &&
          !matchesPhone
        ) {
          return false;
        }
      }

      // date range (client-side)
      if (dateFrom) {
        if (!order.attributes?.created_at) return false;
        const orderDate = new Date(order.attributes.created_at);
        const from = new Date(`${dateFrom}T00:00:00`);
        if (orderDate < from) return false;
      }

      if (dateTo) {
        if (!order.attributes?.created_at) return false;
        const orderDate = new Date(order.attributes.created_at);
        const to = new Date(`${dateTo}T23:59:59.999`);
        if (orderDate > to) return false;
      }

      return true;
    });
  }

  async function handleStateChange(order: Order, newState: string) {
    const confirmed = confirm(
      `Are you sure you want to change the order state to "${newState}"?`,
    );
    if (!confirmed) return;

    loading = true;
    try {
      const success = await updateOrderState(
        website.main_space,
        sellerShortname,
        order.shortname,
        newState,
      );

      if (success) {
        successToastMessage("Order state updated successfully");
        await loadOrders();
      } else {
        errorToastMessage("Failed to update order state");
      }
    } catch (e) {
      errorToastMessage("An error occurred while updating the order");
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function viewOrderDetails(order: any) {
    selectedOrder = order;
    showOrderDetails = true;
  }

  function closeOrderDetails() {
    showOrderDetails = false;
    selectedOrder = null;
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function calculateOrderTotal(order: any): number {
    const payload = order.attributes?.payload?.body;
    if (!payload) return 0;

    const itemsTotal =
      payload?.items?.reduce(
        (sum: number, item: any) => sum + (item.subtotal || 0),
        0,
      ) || 0;
    const shippingCost = payload.shipping?.cost || 0;
    const couponDiscount = payload.coupon?.discount_amount || 0;

    return itemsTotal + shippingCost - couponDiscount;
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

  // ----- Design pills (3 tones) -----
  type Tone = "pending" | "solved" | "inactive";

  function getStateTone(state?: string): Tone {
    const s = (state || "").toLowerCase();

    // pending-ish
    if (
      s.includes("pending") ||
      s === "processing" ||
      s === "confirmed" ||
      s === "delivery_confirmed"
    ) {
      return "pending";
    }

    // solved-ish
    if (s === "delivered" || s === "resolved" || s === "refunded") {
      return "solved";
    }

    // inactive-ish
    if (
      s.includes("cancel") ||
      s === "issue_reported" ||
      s === "refund_pending"
    ) {
      return "inactive";
    }

    return "pending";
  }

  // ----- Top dropdown logic -----
  function closeTopDropdowns() {
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

  function resetFilters() {
    selectedState = "all";
    selectedPaymentStatus = "all";
    searchQuery = "";
    phoneFilter = "";
    governorateFilter = "";
    dateFrom = "";
    dateTo = "";
    currentPage = 1;
    closeTopDropdowns();
    loadOrders();
  }

  function activeFiltersCount() {
    let n = 0;
    if (selectedState !== "all") n++;
    if (selectedPaymentStatus !== "all") n++;
    if (phoneFilter.trim()) n++;
    if (governorateFilter.trim()) n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    return n;
  }

  // ----- Row actions logic -----
  function getRowId(item: any) {
    return String(item?.id ?? item?.shortname ?? crypto.randomUUID());
  }

  function toggleRowActions(order: any) {
    const id = getRowId(order);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeRowActions() {
    openActionsFor = null;
  }

  function onWindowClick() {
    // close both top dropdowns and row actions on outside click
    closeTopDropdowns();
    closeRowActions();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeTopDropdowns();
      closeRowActions();
    }
  }

  onMount(() => {
    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onKeydown);
  });

  onDestroy(() => {
    window.removeEventListener("click", onWindowClick);
    window.removeEventListener("keydown", onKeydown);
  });

  // prevent outside close when clicking inside dropdowns
  function stop(e: Event) {
    e.stopPropagation();
  }

  // ----- Pagination -----
  let totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(totalOrders / itemsPerPage)),
  );

  let visiblePageNumbers = $derived.by(() => {
    const total = totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const cur = currentPage;
    const pages: (number | "ellipsis")[] = [];

    if (cur <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(total);
    } else if (cur >= total - 2) {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("ellipsis");
      for (let i = cur - 1; i <= cur + 1; i++) pages.push(i);
      pages.push("ellipsis");
      pages.push(total);
    }
    return pages;
  });

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadOrders();
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadOrders();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      loadOrders();
    }
  }

  // When filters change locally, re-apply client filters for dates/search etc.
  $effect(() => {
    dateFrom;
    dateTo;
    // (server filters are handled by scheduleLoadOrders / onchange handlers)
    if (orders.length > 0) applyClientFilters();
  });

  // ---- Stats (based on filteredOrders, matching the desired page) ----
  let totalRevenue = $derived.by(() => {
    return filteredOrders.reduce(
      (sum, order) => sum + calculateOrderTotal(order),
      0,
    );
  });

  let totalItems = $derived.by(() => {
    return filteredOrders.reduce((sum, order) => {
      const payload = order.attributes?.payload?.body;
      return sum + (payload?.items?.length || 0);
    }, 0);
  });

  let averageOrder = $derived.by(() => {
    if (filteredOrders.length === 0) return 0;
    return totalRevenue / filteredOrders.length;
  });

  // Pagination summary (based on server totals)
  let paginationStart = $derived.by(() => {
    return totalOrders === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    return Math.min(currentPage * itemsPerPage, totalOrders);
  });

  // Optional: CSV export from current page rows
  function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadOrdersCsv() {
    const header = [
      "order_code",
      "tracking_code",
      "customer",
      "phone",
      "payment_status",
      "payment_type",
      "items",
      "total",
      "state",
      "created_at",
    ];
    const rows = filteredOrders.map((o) => {
      const p = o.attributes?.payload?.body || {};
      const total = calculateOrderTotal(o);
      return [
        p.order_code || o.shortname,
        p.tracking_code || "",
        p.user?.displayname || p.user?.shortname || "",
        p.user?.phone || "",
        p.payment_status || "",
        p.payment_type || "",
        p.items?.length || 0,
        total,
        o.attributes?.state || "",
        o.attributes?.created_at || "",
      ].map(escapeCsvValue);
    });

    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
</script>

<div class="orders-container">
  <div class="header">
    <h1>My Orders</h1>
  </div>

  <!-- Stats Grid -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon">
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
        <h3 class="stat-title">Total Orders</h3>
        <p class="stat-value">{filteredOrders.length}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon">
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
        <h3 class="stat-title">Total Revenue</h3>
        <p class="stat-value">{formatCurrency(totalRevenue)} IQD</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon">
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
        <h3 class="stat-title">Total Items</h3>
        <p class="stat-value">{totalItems}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon">
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">Average Order</h3>
        <p class="stat-value">{formatCurrency(averageOrder)} IQD</p>
      </div>
    </div>
  </div>

  <!-- Search + Filters + Actions (top bar) -->
  <div class="topbar" onclick={stop}>
    <!-- SEARCH -->
    <div class="search-wrap">
      <div class="search-icon" aria-hidden="true">
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
      </div>

      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Order code, customer, phone..."
        class="input-modern"
        oninput={scheduleLoadOrders}
      />
    </div>

    <!-- RIGHT: FILTERS + ACTIONS -->
    <div class="topbar-right">
      <!-- FILTERS -->
      <div class="relative">
        <button
          type="button"
          class="btn-modern"
          onclick={(e) => {
            e.stopPropagation();
            toggleFilters();
          }}
        >
          <span class="btn-label">
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
                d="M2.46579 4.21134C1.71144 3.34923 2.32369 2 3.46923 2H12.5309C13.6764 2 14.2887 3.34923 13.5343 4.21134L10.0001 8.25049V13C10.0001 13.824 9.05929 14.2944 8.40005 13.8L6.40005 12.3C6.14824 12.1111 6.00005 11.8148 6.00005 11.5V8.25049L2.46579 4.21134Z"
                fill="#4A5565"
              />
            </svg>
            Filters
            {#if activeFiltersCount() > 0}
              <span class="count-badge">{activeFiltersCount()}</span>
            {/if}
          </span>

          <svg
            class="chev"
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
          <div class="dropdown-panel" onclick={stop}>
            <div class="dropdown-grid">
              <div>
                <label class="field-label">Order State</label>
                <select
                  bind:value={selectedState}
                  class="field-control"
                  onchange={() => {
                    currentPage = 1;
                    loadOrders();
                  }}
                >
                  {#each orderStates as st}
                    <option value={st.value}>{st.label}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label class="field-label">Payment Status</label>
                <select
                  bind:value={selectedPaymentStatus}
                  class="field-control"
                  onchange={() => {
                    currentPage = 1;
                    loadOrders();
                  }}
                >
                  {#each paymentStatuses as ps}
                    <option value={ps.value}>{ps.label}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label class="field-label">Phone</label>
                <input
                  type="text"
                  class="field-control"
                  placeholder="9647..."
                  bind:value={phoneFilter}
                  oninput={scheduleLoadOrders}
                />
              </div>

              <div>
                <label class="field-label">Governorate</label>
                <input
                  type="text"
                  class="field-control"
                  placeholder="Baghdad"
                  bind:value={governorateFilter}
                  oninput={scheduleLoadOrders}
                />
              </div>

              <div>
                <label class="field-label">Date From</label>
                <input
                  type="date"
                  class="field-control"
                  bind:value={dateFrom}
                />
              </div>

              <div>
                <label class="field-label">Date To</label>
                <input type="date" class="field-control" bind:value={dateTo} />
              </div>
            </div>

            <div class="dropdown-footer">
              <button type="button" class="btn-reset" onclick={resetFilters}>
                Reset
              </button>

              <button
                type="button"
                class="btn-apply"
                onclick={() => {
                  // Apply here just closes; date filters are applied client-side automatically
                  isFiltersOpen = false;
                  applyClientFilters();
                }}
              >
                Apply
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- ACTIONS -->
      <div class="relative">
        <button
          type="button"
          class="btn-modern"
          onclick={(e) => {
            e.stopPropagation();
            toggleActions();
          }}
        >
          <span class="btn-label">Actions</span>
          <svg
            class="chev"
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

        {#if isActionsOpen}
          <div class="dropdown-panel-small" onclick={stop}>
            <button
              type="button"
              class="menu-item"
              onclick={() => {
                isActionsOpen = false;
                downloadOrdersCsv();
              }}
            >
              Download CSV
            </button>

            <button
              type="button"
              class="menu-item"
              onclick={() => {
                isActionsOpen = false;
                loadOrders();
              }}
            >
              Refresh
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading orders...</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>{error}</p>
      <button class="btn-retry" onclick={loadOrders}>Retry</button>
    </div>
  {:else if filteredOrders.length === 0}
    <div class="empty-state">
      <p>No orders found</p>
      {#if searchQuery || selectedState !== "all" || selectedPaymentStatus !== "all" || phoneFilter || governorateFilter || dateFrom || dateTo}
        <p class="empty-hint">Try adjusting your filters</p>
      {/if}
    </div>
  {:else}
    <!-- Orders Table -->
    <div class="orders-table-wrapper">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th class="center">Items</th>
            <th class="right">Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody class="bg-white">
          {#each filteredOrders as order (order.shortname)}
            {@const payload = order.attributes?.payload?.body}
            {@const total = calculateOrderTotal(order)}
            {@const state = (order.attributes?.state || "pending").toString()}
            {@const tone = getStateTone(state)}

            <tr
              class="row clickable-row"
              onclick={() => viewOrderDetails(order)}
            >
              <!-- ORDER -->
              <td class="px-6 py-4">
                <div class="flex-row">
                  <div class="order-icon" aria-hidden="true">
                    <span class="hash">#</span>
                  </div>

                  <div class="minw0">
                    <div
                      class="title"
                      title={payload?.order_code || order.shortname}
                    >
                      {payload?.order_code || order.shortname}
                    </div>

                    <div class="sub">
                      {payload?.tracking_code || "Tracking: N/A"}
                    </div>
                  </div>
                </div>
              </td>

              <!-- CUSTOMER -->
              <td class="px-6 py-4">
                <div class="minw0">
                  <div
                    class="title-sm"
                    title={payload?.user?.displayname ||
                      payload?.user?.shortname ||
                      "N/A"}
                  >
                    {payload?.user?.displayname ||
                      payload?.user?.shortname ||
                      "N/A"}
                  </div>
                  <div class="sub" title={payload?.user?.phone || "N/A"}>
                    {payload?.user?.phone || "N/A"}
                  </div>
                </div>
              </td>

              <!-- ITEMS -->
              <td class="px-6 py-4 center mono">
                {payload?.items?.length || 0}
              </td>

              <!-- TOTAL -->
              <td class="px-6 py-4 right">
                <span class="money">{formatCurrency(total)} IQD</span>
              </td>

              <!-- PAYMENT -->
              <td class="px-6 py-4">
                <div class="stack">
                  <span class="mini-pill">
                    {payload?.payment_status || "pending"}
                  </span>
                  <span class="sub">{payload?.payment_type || "N/A"}</span>
                </div>
              </td>

              <!-- STATUS (your spec: pending/solved/inactive) -->
              <td class="px-6 py-4">
                <span class={"status-pill " + tone}>
                  {#if tone === "pending"}
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
                        d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2Z"
                        fill="currentColor"
                      />
                    </svg>
                  {:else if tone === "solved"}
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
                        fill="currentColor"
                      />
                    </svg>
                  {:else}
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
                        fill="currentColor"
                      />
                    </svg>
                  {/if}

                  <span class="cap">{state}</span>
                </span>
              </td>

              <!-- DATE -->
              <td class="px-6 py-4">
                <div class="datecell">
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

                  <span>{formatDateDMY(order.attributes?.created_at)}</span>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <p class="pagination-text">
        Showing {paginationStart}-{paginationEnd} of {totalOrders}
      </p>

      <div class="pagination-controls" onclick={stop}>
        <button
          type="button"
          class="pagination-segment pagination-arrow"
          onclick={previousPage}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <svg
            class="pagination-arrow-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {#each visiblePageNumbers as segment}
          {#if segment === "ellipsis"}
            <span
              class="pagination-segment pagination-ellipsis"
              aria-hidden="true">…</span
            >
          {:else}
            <button
              type="button"
              class="pagination-segment pagination-num"
              class:active={currentPage === segment}
              onclick={() => goToPage(segment)}
              aria-label={"Page " + segment}
              aria-current={currentPage === segment ? "page" : undefined}
            >
              {segment}
            </button>
          {/if}
        {/each}

        <button
          type="button"
          class="pagination-segment pagination-arrow"
          onclick={nextPage}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <svg
            class="pagination-arrow-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

{#if showOrderDetails && selectedOrder}
  <OrderDetailsModal
    order={selectedOrder}
    {sellerShortname}
    on:close={closeOrderDetails}
    on:stateChange={async () => {
      await loadOrders();
      closeOrderDetails();
    }}
  />
{/if}

<style>
  /* Page container */
  .orders-container {
    min-height: 100vh;
    background: #f9fafb;
    padding: 24px;
  }

  .header h1 {
    font-size: 24px;
    font-weight: 600;
    color: #101828;
    margin-bottom: 16px;
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .stat-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 1px 0.5px 0.05px rgba(27, 31, 36, 0.04);
  }

  .bg-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: #f3f4f6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .stat-title {
    font-size: 12px;
    font-weight: 500;
    color: #4a5565;
    margin: 0 0 6px 0;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: #101828;
    margin: 0;
  }

  /* Topbar (search + dropdowns) */
  .topbar {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: end;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-bottom: none;
    border-radius: 12px 12px 0 0;
    padding: 16px;
  }

  .search-wrap {
    position: relative;
    width: 256px;
  }

  .search-icon {
    position: absolute;
    inset-block: 0;
    left: 10px;
    display: flex;
    align-items: center;
    color: #9ca3af;
    pointer-events: none;
  }

  .input-modern {
    width: 100%;
    height: 36px;
    padding: 8px 12px 8px 36px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0px 1px 0.5px 0.05px rgba(29, 41, 61, 0.02);
    font-size: 14px;
    outline: none;
  }

  .input-modern:focus {
    border-color: #a78bfa;
    box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.5);
  }

  .topbar-right {
    display: flex;
    gap: 12px;
    align-items: end;
    justify-content: flex-end;
  }

  .btn-modern {
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    min-width: 140px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0px 1px 0.5px 0.05px rgba(29, 41, 61, 0.02);
    font-size: 14px;
    color: #4a5565;
    cursor: pointer;
  }

  .btn-modern:hover {
    background: #f3f4f6;
  }

  .btn-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .chev {
    width: 16px;
    height: 16px;
    color: #6b7280;
    flex: 0 0 auto;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    height: 20px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    background: #ede9fe;
    color: #6d28d9;
  }

  .relative {
    position: relative;
  }

  .dropdown-panel {
    position: absolute;
    right: 0;
    z-index: 20;
    margin-top: 8px;
    width: 360px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
    padding: 12px;
  }

  .dropdown-panel-small {
    position: absolute;
    right: 0;
    z-index: 20;
    margin-top: 8px;
    width: 220px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
    padding: 8px;
  }

  .dropdown-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr;
  }

  @media (min-width: 768px) {
    .dropdown-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .field-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #4a5565;
    margin-bottom: 6px;
  }

  .field-control {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 14px;
    outline: none;
  }

  .dropdown-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f3f4f6;
  }

  .btn-reset {
    height: 36px;
    padding: 8px 12px;
    border-radius: 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    color: #4a5565;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-reset:hover {
    background: #f3f4f6;
  }

  .btn-apply {
    height: 36px;
    padding: 8px 12px;
    border-radius: 12px;
    background: #3c307f;
    border: 1px solid #3c307f;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-apply:hover {
    background: #2f2666;
  }

  .menu-item {
    width: 100%;
    text-align: left;
    padding: 10px 10px;
    border-radius: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #4a5565;
  }

  .menu-item:hover {
    background: #f9fafb;
  }

  /* Table */
  .orders-table-wrapper {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
  }

  .orders-table {
    width: 100%;
    border-collapse: collapse;
  }

  .orders-table thead th {
    text-align: left;
    font-size: 12px;
    font-weight: 500;
    color: #6a7282;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding: 14px 24px;
  }

  .orders-table thead th.center {
    text-align: center;
  }
  .orders-table thead th.right {
    text-align: right;
  }

  .row td {
    border-bottom: 1px solid #f3f4f6;
  }

  .row:hover {
    background: #f9fafb;
  }

  .clickable-row {
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .px-6 {
    padding-left: 24px;
    padding-right: 24px;
  }
  .py-4 {
    padding-top: 16px;
    padding-bottom: 16px;
  }

  .center {
    text-align: center;
  }
  .right {
    text-align: right;
  }

  .flex-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .order-icon {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: #f3f4f6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .hash {
    font-weight: 500;
    font-size: 14px;
    line-height: 14px;
    color: #101828;
  }

  .minw0 {
    min-width: 0;
  }

  .title {
    font-weight: 500;
    font-size: 16px;
    line-height: 16px;
    color: #101828;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
  }

  .title-sm {
    font-weight: 500;
    font-size: 14px;
    line-height: 14px;
    color: #101828;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
  }

  .sub {
    font-weight: 400;
    font-size: 14px;
    line-height: 14px;
    color: #4a5565;
    margin-top: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mono {
    font-weight: 500;
    font-size: 14px;
    line-height: 14px;
    color: #101828;
  }

  .money {
    font-weight: 500;
    font-size: 14px;
    line-height: 14px;
    color: #101828;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mini-pill {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid #bedbff;
    background: #eef6ff;
    color: #1c398e;
    font-weight: 500;
    font-size: 12px;
    line-height: 16px;
    width: fit-content;
    text-transform: lowercase;
  }

  /* STATUS pill (your spec) */
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 12px;
    border-radius: 6px; /* rounded-sm */
    border: 1px solid;
    font-family: inherit;
    font-weight: 500;
    font-size: 12px; /* text-xs */
    line-height: 16px;
    letter-spacing: 0;
    text-align: center;
    width: fit-content;
    text-transform: lowercase;
  }

  .status-pill.pending {
    background: #eef6ff;
    border-color: #bedbff;
    color: #1c398e;
  }

  .status-pill.solved {
    background: #ecfdf5;
    border-color: #a4f4cf;
    color: #004f3b;
  }

  .status-pill.inactive {
    background: #fff8f1;
    border-color: #fcd9bd;
    color: #771d1d;
  }

  .cap {
    display: inline-block;
    max-width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .datecell {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    font-size: 14px;
    line-height: 14px;
    color: #101828;
  }

  /* Row actions */
  .row-actions-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .row-actions-btn:hover {
    background: #f4f5fe;
    border-color: #3c307f;
  }

  .dots {
    font-size: 18px;
    line-height: 1;
    color: #4a5565;
  }

  .row-menu {
    position: absolute;
    right: 0;
    margin-top: 8px;
    z-index: 30;
    width: 220px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #fff;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
    padding: 8px;
  }

  .row-menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #4a5565;
    font-size: 14px;
  }

  .row-menu-item:hover {
    background: #f9fafb;
  }

  .row-menu-sep {
    height: 1px;
    background: #f3f4f6;
    margin: 8px 0;
  }

  .row-menu-group {
    padding: 6px 6px 2px 6px;
  }

  .row-menu-label {
    font-size: 12px;
    font-weight: 500;
    color: #6a7282;
    margin-bottom: 6px;
  }

  .row-state-select {
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 14px;
    outline: none;
  }

  /* Loading/empty/error */
  .loading,
  .error-message,
  .empty-state {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    margin-top: 12px;
  }

  .btn-retry {
    margin-top: 10px;
    height: 36px;
    padding: 8px 12px;
    border-radius: 12px;
    background: #3c307f;
    border: 1px solid #3c307f;
    color: #fff;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-retry:hover {
    background: #2f2666;
  }

  .empty-hint {
    color: #6a7282;
    margin-top: 6px;
  }

  /* Pagination (segmented) */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: 14px 16px;
  }

  .pagination-text {
    font-size: 14px;
    color: #4a5565;
    margin: 0;
  }

  .pagination-controls {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .pagination-segment {
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #4a5565;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .pagination-segment:hover {
    background: #f3f4f6;
  }

  .pagination-num.active {
    background: #f4f5fe;
    border-color: #3c307f;
    color: #3c307f;
    font-weight: 600;
  }

  .pagination-arrow {
    padding: 0;
  }

  .pagination-arrow-icon {
    width: 18px;
    height: 18px;
  }

  .pagination-ellipsis {
    border: none;
    background: transparent;
    cursor: default;
    min-width: auto;
    padding: 0 6px;
  }

  .pagination-segment:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .orders-container {
      padding: 16px;
    }
    .topbar {
      flex-direction: column;
      align-items: stretch;
    }
    .search-wrap {
      width: 100%;
    }
    .btn-modern {
      width: 100%;
    }
    .topbar-right {
      width: 100%;
      justify-content: stretch;
      flex-direction: column;
    }
    .dropdown-panel,
    .dropdown-panel-small {
      width: 100%;
    }
    .title {
      max-width: 180px;
    }
    .title-sm {
      max-width: 160px;
    }
    .pagination {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
  }
</style>

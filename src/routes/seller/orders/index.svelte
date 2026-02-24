<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { _, locale } from "svelte-i18n";
  import { getSellerOrders, updateOrderState } from "@/lib/dmart_services";
  import type { Order } from "@/lib/types";
  import OrderDetailsModal from "@/components/modals/OrderDetailsModal.svelte";
  import { errorToastMessage, successToastMessage } from "@/lib/toasts_messages";
  import { user } from "@/stores/user";
  import { website } from "@/config";
   import { formatNumber } from "@/lib/helpers";
import { get } from "svelte/store";
import './index.css';

  // ---- data ----
  let orders: any[] = [];
  let filteredOrders = $state<any[]>([]);
  let loading = $state(false);
  let itemsPerPage = $state(20);
  let totalOrders = $state(0);
  let error = $state("");
  let currentPage = $state(1);

  // ---- filters ----
  let selectedState = $state("all");
  let selectedPaymentStatus = $state("all");
  let searchQuery = $state("");
  let phoneFilter = $state("");
  let governorateFilter = $state("");
  let dateFrom = $state("");
  let dateTo = $state("");
  let searchDebounce = $state<ReturnType<typeof setTimeout> | null>(null);

  // ---- modal ----
  let showOrderDetails = $state(false);
  let selectedOrder = $state<any | null>(null);

  // ---- seller ----
  let sellerShortname = $state("");
  let initialized = false;

  // ---- dropdowns (top bar) ----
  let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);

  // ---- row actions ----
  let openActionsFor = $state<string | null>(null);

 const t = (key: string, vars?: Record<string, unknown>) => get(_)(key, vars);

  const orderStates = [
    { value: "all", label: t("admin.all_orders") || "All Orders" },
    { value: "pending", label: t("admin.pending") || "Pending" },
    { value: "confirmed", label: t("admin.confirmed") || "Confirmed" },
    { value: "processing", label: t("admin.processing") || "Processing" },
    { value: "delivered", label: t("admin.delivered") || "Delivered" },
    {
      value: "delivery_confirmed",
      label: t("admin.delivery_confirmed") || "Delivery Confirmed",
    },
    { value: "issue_reported", label: t("admin.issue_reported") || "Issue Reported" },
    { value: "refund_pending", label: t("admin.refund_pending") || "Refund Pending" },
    { value: "refunded", label: t("admin.refunded") || "Refunded" },
    { value: "resolved", label: t("admin.resolved") || "Resolved" },
    { value: "cancel", label: t("admin.customer_cancelled") || "Customer Cancelled" },
    { value: "customer_cancelled", label: t("admin.customer_cancel") || "Customer Cancel" },
  ];

  const paymentStatuses = [
    {
      value: "all",
      labelKey: "admin.all_payment_statuses",
      fallback: "All Payment Statuses",
    },
    { value: "pending", labelKey: "admin.payment_pending", fallback: "Pending" },
    { value: "completed", labelKey: "admin.payment_completed", fallback: "Completed" },
    { value: "unpaid", labelKey: "admin.payment_unpaid", fallback: "Unpaid" },
    { value: "nopaid", labelKey: "admin.payment_not_paid", fallback: "Not Paid" },
    { value: "failed", labelKey: "admin.payment_failed", fallback: "Failed" },
  ];

  // ---- init seller ----
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
      error = t("admin.seller_not_found") || "Seller information not found";
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
        error = t("admin.orders_load_failed") || "Failed to load orders";
      }
    } catch (e) {
      error = t("admin.orders_load_error") || "An error occurred while loading orders";
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
        String(payload.payment_status || "").toLowerCase() !==
          String(selectedPaymentStatus).toLowerCase()
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
        const matchesTracking = payload.tracking_code?.toLowerCase().includes(q);
        const matchesPhone =
          payload.user?.phone?.toString().toLowerCase().includes(q) ||
          payload.phone?.toString().toLowerCase().includes(q);

        if (!matchesOrderCode && !matchesCustomer && !matchesTracking && !matchesPhone) {
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
      (t("admin.confirm_change_state") as string) ||
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
        successToastMessage(t("admin.order_state_updated") || "Order state updated successfully");
        await loadOrders();
      } else {
        errorToastMessage(t("admin.order_state_update_failed") || "Failed to update order state");
      }
    } catch (e) {
      errorToastMessage(t("admin.order_update_error") || "An error occurred while updating the order");
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

  // ---- Payment badge helpers (same feel as combined-orders page) ----
  function normalizePaymentStatus(value: unknown): string {
    return value?.toString().trim().toLowerCase() || "";
  }

  function getPaymentStatusClass(status: string): string {
    const normalized = normalizePaymentStatus(status);
    const statusClasses: Record<string, string> = {
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      completed: "bg-green-50 text-green-700 border-green-200",
      paid: "bg-green-50 text-green-700 border-green-200",
      success: "bg-green-50 text-green-700 border-green-200",
      nopaid: "bg-gray-100 text-gray-700 border-gray-200",
      unpaid: "bg-gray-100 text-gray-700 border-gray-200",
      failed: "bg-red-50 text-red-700 border-red-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return statusClasses[normalized] || "bg-gray-100 text-gray-700 border-gray-200";
  }

  function getPaymentStatusLabel(status: string): string {
    const normalized = normalizePaymentStatus(status);
    if (!normalized) return $_("common.not_available") || "N/A";
    if (normalized === "pending") return $_("admin.payment_pending") || "Pending";
    if (["completed", "paid", "success"].includes(normalized))
      return $_("admin.payment_completed") || "Completed";
    if (["nopaid", "unpaid"].includes(normalized))
      return $_("admin.payment_not_paid") || "Not Paid";
    if (normalized === "failed") return $_("admin.payment_failed") || "Failed";
    return normalized;
  }

  // ---- State pill tone (like your old page, but used inline) ----
  type Tone = "pending" | "solved" | "inactive";
  function getStateTone(state?: string): Tone {
    const s = (state || "").toLowerCase();

    if (
      s.includes("pending") ||
      s === "processing" ||
      s === "confirmed" ||
      s === "delivery_confirmed"
    ) {
      return "pending";
    }

    if (s === "delivered" || s === "resolved" || s === "refunded") {
      return "solved";
    }

    if (s.includes("cancel") || s === "issue_reported" || s === "refund_pending") {
      return "inactive";
    }

    return "pending";
  }

  // ---- Top dropdown logic (same UX as combined-orders page) ----
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

  // ---- Row actions logic ----
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

  function stop(e: Event) {
    e.stopPropagation();
  }

  // ---- Pagination (server total) ----
  let totalPages = $derived.by(() => Math.max(1, Math.ceil(totalOrders / itemsPerPage)));

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

  $effect(() => {
    dateFrom;
    dateTo;
    if (orders.length > 0) applyClientFilters();
  });

  // ---- Stats (based on filteredOrders) ----
  let totalRevenue = $derived.by(() => {
    return filteredOrders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
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

  // ---- CSV export ----
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
  <!-- Stats Grid (same layout as combined-orders page) -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("admin.stats_total_orders") || "Total Orders"}</h3>
        <p class="stat-value">{filteredOrders.length}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("admin.stats_total_revenue") || "Total Revenue"}</h3>
        <p class="stat-value">
          {formatCurrency(totalRevenue)} {$_("admin.currency") || "IQD"}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("admin.stats_total_items") || "Total Items"}</h3>
        <p class="stat-value">{totalItems}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2ZM4.5 2.5V3.6665C4.5 3.77469 4.53509 3.87995 4.6 3.9665C4.61345 3.98444 4.62568 4.00326 4.63661 4.02284L5.42302 5.43199C5.5381 5.59873 5.6 5.79679 5.6 6C5.6 6.20321 5.5381 6.40127 5.42302 6.56801L4.63661 7.97716C4.62568 7.99674 4.61345 8.01556 4.6 8.0335C4.53509 8.12005 4.5 8.22532 4.5 8.3335V9.5H7.5V8.3335C7.5 8.22531 7.46491 8.12005 7.4 8.0335C7.38769 8.01709 7.37641 7.99994 7.3662 7.98214L6.55725 6.57077C6.44095 6.40346 6.37836 6.20433 6.37836 6C6.37836 5.79567 6.44095 5.59654 6.55725 5.42923L7.3662 4.01786C7.37641 4.00006 7.38769 3.98291 7.4 3.9665C7.46491 3.87995 7.5 3.77469 7.5 3.6665V2.5H4.5Z"
            fill="#1C398E"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("admin.stats_average_order") || "Average Order"}</h3>
        <p class="stat-value">
          {formatCurrency(averageOrder)} {$_("admin.currency") || "IQD"}
        </p>
      </div>
    </div>
  </div>

  <!-- Filters Section (same topbar layout as combined-orders page) -->
  <div
    class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    onclick={stop}
  >
    <!-- SEARCH -->
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
          type="text"
          bind:value={searchQuery}
          placeholder={$_("admin.search_orders_placeholder") || "Order code, customer, phone..."}
          class="w-full h-9 pl-9 pr-3 py-2
          bg-[#F9FAFB]
          border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm
          focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          oninput={scheduleLoadOrders}
        />
      </div>
    </div>

    <!-- RIGHT: FILTERS + ACTIONS -->
    <div class="flex items-end gap-3 justify-end">
      <!-- FILTERS DROPDOWN -->
      <div class="relative">
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            toggleFilters();
          }}
          class="h-9 inline-flex items-center justify-between cursor-pointer
          px-3 py-2 min-w-[170px]
          bg-[#F9FAFB] border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm text-gray-700 hover:bg-gray-50"
        >
          <span class="truncate inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M2.46579 4.21134C1.71144 3.34923 2.32369 2 3.46923 2H12.5309C13.6764 2 14.2887 3.34923 13.5343 4.21134L10.0001 8.25049V13C10.0001 13.824 9.05929 14.2944 8.40005 13.8L6.40005 12.3C6.14824 12.1111 6.00005 11.8148 6.00005 11.5V8.25049L2.46579 4.21134ZM12.5309 3.33333H3.46923L7.00349 7.37248C7.21616 7.61554 7.33338 7.92753 7.33338 8.25049V11.3333L8.66672 12.3333V8.25049C8.66672 7.92753 8.78394 7.61554 8.99661 7.37248L12.5309 3.33333Z"
                fill="#4A5565"
              />
            </svg>

            {$_("admin.filters") || "Filters"}
            {#if activeFiltersCount() > 0}
              <span
                class="inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
              >
                {activeFiltersCount()}
              </span>
            {/if}
          </span>

          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if isFiltersOpen}
          <div
            class="absolute right-0 z-20 mt-2 w-[360px]
            rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
            onclick={stop}
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <!-- Order State -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  {$_("admin.order_status") || "Order State"}
                </label>
                <select
                  bind:value={selectedState}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
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

              <!-- Payment Status -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  {$_("admin.payment_status") || "Payment Status"}
                </label>
                <select
                  bind:value={selectedPaymentStatus}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  onchange={() => {
                    currentPage = 1;
                    loadOrders();
                  }}
                >
                  {#each paymentStatuses as status}
                    <option value={status.value}>
                      {$_(status.labelKey) || status.fallback}
                    </option>
                  {/each}
                </select>
              </div>

              <!-- Phone -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  {$_("admin.phone") || "Phone"}
                </label>
                <input
                  type="text"
                  bind:value={phoneFilter}
                  placeholder="9647..."
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  oninput={scheduleLoadOrders}
                />
              </div>

              <!-- Governorate -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  {$_("admin.governorate") || "Governorate"}
                </label>
                <input
                  type="text"
                  bind:value={governorateFilter}
                  placeholder="Baghdad"
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  oninput={scheduleLoadOrders}
                />
              </div>

              <!-- Date From -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  {$_("admin.date_from") || "Date From"}
                </label>
                <input
                  type="date"
                  bind:value={dateFrom}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                />
              </div>

              <!-- Date To -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  {$_("admin.date_to") || "Date To"}
                </label>
                <input
                  type="date"
                  bind:value={dateTo}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                />
              </div>
            </div>

            <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onclick={resetFilters}
                class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#F9FAFB] text-gray-700 text-sm font-medium
                border border-[#E5E7EB]
                rounded-[12px]
                hover:bg-gray-50 transition-colors"
              >
                {$_("admin.reset") || "Reset"}
              </button>

              <button
                type="button"
                onclick={() => {
                  isFiltersOpen = false;
                  applyClientFilters(); // apply date filters immediately
                }}
                class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#3C307F] text-white text-sm font-medium
                rounded-[12px]
                hover:bg-[#2f2666] transition-colors"
              >
                {$_("admin.apply") || "Apply"}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- ACTIONS DROPDOWN -->
      <div class="relative">
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            toggleActions();
          }}
          class="h-9 inline-flex items-center justify-between
          px-3 py-2 min-w-[140px]
          bg-[#F9FAFB] border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm text-gray-700 hover:bg-gray-50"
        >
          <span class="truncate">{$_("admin.actions") || "Actions"}</span>
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if isActionsOpen}
          <div
            class="absolute right-0 z-20 mt-2 w-[220px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
            onclick={stop}
          >
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => {
                isActionsOpen = false;
                downloadOrdersCsv();
              }}
            >
              {$_("admin.download_csv") || "Download CSV"}
            </button>

            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => {
                isActionsOpen = false;
                loadOrders();
              }}
            >
              {$_("common.refresh") || "Refresh"}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{$_("admin.loading_orders") || "Loading orders..."}</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>{error}</p>
      <button class="btn-retry" onclick={loadOrders}>{$_("common.retry") || "Retry"}</button>
    </div>
  {:else if filteredOrders.length === 0}
    <div class="empty-state">
      <p>{$_("admin.no_orders_found") || "No orders found"}</p>
      {#if searchQuery || selectedState !== "all" || selectedPaymentStatus !== "all" || phoneFilter || governorateFilter || dateFrom || dateTo}
        <p class="empty-hint">{$_("admin.adjust_filters_hint") || "Try adjusting your filters"}</p>
      {/if}
    </div>
  {:else}
    <!-- Orders Table -->
    <div class="orders-table-wrapper">
      <table class="orders-table">
        <thead>
          <tr>
            <th>{$_("admin.table_order") || "Order"}</th>
            <th>{$_("admin.customer") || "Customer"}</th>
            <th class="text-center">{$_("admin.items") || "Items"}</th>
            <th class="text-right">{$_("admin.total") || "Total"}</th>
            <th>{$_("admin.payment_status") || "Payment"}</th>
            <th>{$_("admin.order_status") || "Status"}</th>
            <th>{$_("admin.date") || "Date"}</th>
          </tr>
        </thead>

        <tbody class="bg-white">
          {#each filteredOrders as order (order.shortname)}
            {@const payload = order.attributes?.payload?.body}
            {@const total = calculateOrderTotal(order)}
            {@const state = (order.attributes?.state || "pending").toString()}
            {@const tone = getStateTone(state)}
            {@const paymentStatus = payload?.payment_status || ""}
            {@const paymentType = payload?.payment_type || ""}

            <tr
              class="clickable-row hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
              onclick={() => viewOrderDetails(order)}
            >
              <!-- ORDER -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-2.5">
                  <div
                    class="h-11 w-11 rounded-full flex items-center justify-center"
                    style="background:#F3F4F6;"
                    aria-hidden="true"
                  >
                    <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">#</span>
                  </div>

                  <div class="min-w-0">
                    <div
                      class="truncate"
                      style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
                      title={payload?.order_code || order.shortname}
                    >
                      {payload?.order_code || order.shortname}
                    </div>

                    <div
                      class="truncate mt-1"
                      style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                      title={payload?.tracking_code || "Tracking: N/A"}
                    >
                      {payload?.tracking_code || "Tracking: N/A"}
                    </div>
                  </div>
                </div>
              </td>

              <!-- CUSTOMER -->
              <td class="px-6 py-4">
                <div class="min-w-0">
                  <div
                    class="truncate"
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                    title={payload?.user?.displayname || payload?.user?.shortname || "N/A"}
                  >
                    {payload?.user?.displayname || payload?.user?.shortname || "N/A"}
                  </div>
                  <div
                    class="truncate mt-1"
                    style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                    title={payload?.user?.phone || "N/A"}
                  >
                    {payload?.user?.phone || "N/A"}
                  </div>
                </div>
              </td>

              <!-- ITEMS -->
              <td
                class="px-6 py-4 text-center"
                style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
              >
                {payload?.items?.length || 0}
              </td>

              <!-- TOTAL -->
              <td class="px-6 py-4 text-right">
                <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
                  {formatCurrency(total)} {$_("admin.currency") || "IQD"}
                </span>
              </td>

              <!-- PAYMENT -->
              <td class="px-6 py-4">
                <div class="flex flex-col gap-1">
                  <span
                    class={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 w-fit ${getPaymentStatusClass(paymentStatus)}`}
                    style="height:20px;"
                  >
                    <span style="font-weight:500;font-size:12px;line-height:16px;">
                      {getPaymentStatusLabel(paymentStatus)}
                    </span>
                  </span>

                  <span style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;">
                    {paymentType || $_("common.not_available") || "N/A"}
                  </span>
                </div>
              </td>

              <!-- STATUS -->
              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 w-fit"
                  style={`height:20px;${
                    tone === "pending"
                      ? "background:#EEF6FF;border-color:#BEDBFF;color:#1C398E;"
                      : tone === "solved"
                        ? "background:#ECFDF5;border-color:#A4F4CF;color:#004F3B;"
                        : "background:#FFF8F1;border-color:#FCD9BD;color:#771D1D;"
                  }`}
                >
                  <span style="font-weight:500;font-size:12px;line-height:16px;text-transform:lowercase;">
                    {state}
                  </span>
                </span>
              </td>

              <!-- DATE -->
              <td class="px-6 py-4">
                <div
                  class="inline-flex items-center gap-2"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333Z"
                      fill="#6A7282"
                    />
                  </svg>
                  <span>{formatDateDMY(order.attributes?.created_at)}</span>
                </div>
              </td>

              <!-- ACTIONS (... dropdown) -->
              <td class="px-6 py-4 text-right" onclick={(e) => e.stopPropagation()}>
                <div class="relative inline-flex justify-end" onclick={(e) => e.stopPropagation()}>
                  <button
                    class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                    aria-label={$_("admin.actions") || "Actions"}
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(order)}
                    onclick={() => toggleRowActions(order)}
                  >
                    <span class="text-xl leading-none">…</span>
                  </button>

                  {#if openActionsFor === getRowId(order)}
                    <div
                      class="absolute z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                      role="menu"
                      style="top:22px;"
                      onclick={stop}
                    >
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-600"
                        onclick={() => {
                          closeRowActions();
                          viewOrderDetails(order);
                        }}
                        role="menuitem"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4.0117 12C4.02312 12.0329 4.04406 12.0868 4.08184 12.1644C4.16842 12.3421 4.3101 12.5758 4.51263 12.851C4.91651 13.3997 5.51827 14.0535 6.2742 14.6801C7.80015 15.9449 9.83098 17 12 17C14.169 17 16.1999 15.9449 17.7258 14.6801C18.4817 14.0535 19.0835 13.3997 19.4874 12.851C19.6899 12.5758 19.8316 12.3421 19.9182 12.1644C19.9559 12.0868 19.9769 12.0329 19.9883 12C19.9769 11.9671 19.9559 11.9132 19.9182 11.8356C19.8316 11.6579 19.6899 11.4242 19.4874 11.149C19.0835 10.6003 18.4817 9.94649 17.7258 9.3199C16.1999 8.05506 14.169 7 12 7C9.83098 7 7.80015 8.05506 6.2742 9.3199C5.51827 9.94649 4.91651 10.6003 4.51263 11.149C4.3101 11.4242 4.16842 11.6579 4.08184 11.8356C4.04406 11.9132 4.02312 11.9671 4.0117 12ZM4.99787 7.7801C6.72929 6.34495 9.19846 5 12 5C14.8015 5 17.2707 6.34495 19.0021 7.7801C19.8749 8.50351 20.5911 9.2747 21.0981 9.96347C21.351 10.3071 21.5629 10.6452 21.7161 10.9597C21.8554 11.2456 22 11.6185 22 12C22 12.3815 21.8554 12.7544 21.7161 13.0403C21.5629 13.3548 21.351 13.6929 21.0981 14.0365C20.5911 14.7253 19.8749 15.4965 19.0021 16.2199C17.2707 17.6551 14.8015 19 12 19C9.19846 19 6.72929 17.6551 4.99787 16.2199C4.12513 15.4965 3.40886 14.7253 2.9019 14.0365C2.649 13.6929 2.43705 13.3548 2.28385 13.0403C2.14458 12.7544 2 12.3815 2 12C2 11.6185 2.14458 11.2456 2.28385 10.9597C2.43705 10.6452 2.649 10.3071 2.9019 9.96347C3.40886 9.2747 4.12513 8.50351 4.99787 7.7801ZM12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10ZM8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z" fill="#101828"/>
</svg>

                        <span>{$_("view") || "View"}</span>
                      </button>

                      <div class="h-px bg-gray-100 my-1"></div>

                      <div class="px-3 py-2">
                        <div class="text-xs font-medium text-gray-600 mb-1">
                          {$_("admin.change_state") || "Change state"}
                        </div>

                        <select
                          class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                          value={state}
                          onchange={(e) => {
                            const next = (e.currentTarget as HTMLSelectElement).value;
                            closeRowActions();
                            handleStateChange(order, next);
                          }}
                        >
                          {#each orderStates.filter((s) => s.value !== "all") as st}
                            <option value={st.value}>{st.label}</option>
                          {/each}
                        </select>
                      </div>
                    </div>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

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
              Math.min(currentPage * itemsPerPage, totalOrders),
              $locale,
            )}
          </span>

          <span class="pagination-info__label">
            {$_("common.of") || "of"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber(totalOrders, $locale)}
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
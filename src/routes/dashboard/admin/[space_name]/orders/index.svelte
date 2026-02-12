<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    getCombinedOrders,
    getCombinedOrderDetails,
    getSpaceContents,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { website } from "@/config";
  import OrderDetailsModal from "./OrderDetailsModal.svelte";

  let combinedOrders = $state([]);
  let filteredOrders = $state([]);
  let loading = $state(false);
  let error = $state("");
  let totalOrders = $state(0);

  let currentPage = $state(1);
  let itemsPerPage = 20;

  let selectedPaymentStatus = $state("all");
  let selectedOrderStatus = $state("all");
  let selectedSeller = $state("all");
  let selectedGovernorate = $state("all");
  let selectedBnpl = $state("all");
  let dateFrom = $state("");
  let dateTo = $state("");
  let searchQuery = $state("");

  let isModalOpen = $state(false);
  let selectedCombinedOrder = $state(null);
  let selectedCombinedOrderDetails = $state(null);

  const paymentStatuses = [
    { value: "all", label: "All Payment Status" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "nopaid", label: "Not Paid" },
    { value: "failed", label: "Failed" },
  ];

  const bnplFilterOptions = [
    { value: "all", label: "All" },
    { value: "bnpl", label: "BNPL" },
    { value: "non_bnpl", label: "Non-BNPL" },
  ];

  onMount(() => {
    loadCombinedOrders();
  });

  async function loadCombinedOrders() {
    loading = true;
    error = "";

    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getCombinedOrders(
        website.main_space,
        undefined,
        itemsPerPage,
        offset,
      );

      if (response.status === "success") {
        combinedOrders = response.records || [];
        totalOrders = response.attributes?.total || 0;
        applyFilters();
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

  function applyFilters() {
    filteredOrders = combinedOrders.filter((order) => {
      const orderPayload = order.attributes?.payload?.body;
      if (!orderPayload) return false;

      const orderStatus = getCombinedOrderStatus(order);
      if (
        selectedOrderStatus !== "all" &&
        orderStatus !== selectedOrderStatus
      ) {
        return false;
      }

      const sellers = getCombinedOrderSellers(order);
      if (selectedSeller !== "all" && !sellers.includes(selectedSeller)) {
        return false;
      }

      const governorate = getCombinedOrderGovernorate(order);
      if (
        selectedGovernorate !== "all" &&
        governorate !== selectedGovernorate
      ) {
        return false;
      }

      if (selectedBnpl !== "all") {
        const isBnpl = isBnplOrder(orderPayload);
        if (selectedBnpl === "bnpl" && !isBnpl) return false;
        if (selectedBnpl === "non_bnpl" && isBnpl) return false;
      }

      if (dateFrom || dateTo) {
        const createdAt = order.attributes?.created_at;
        if (!createdAt) return false;
        const createdDate = new Date(createdAt);
        if (dateFrom) {
          const start = new Date(`${dateFrom}T00:00:00`);
          if (createdDate < start) return false;
        }
        if (dateTo) {
          const end = new Date(`${dateTo}T23:59:59.999`);
          if (createdDate > end) return false;
        }
      }

      if (
        selectedPaymentStatus !== "all" &&
        orderPayload.payment_status !== selectedPaymentStatus
      ) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesOrderId = orderPayload.combined_order_id
          ?.toString()
          .includes(query);
        const matchesUserShortname = orderPayload.user_shortname
          ?.toLowerCase()
          .includes(query);
        const matchesPhone = [
          orderPayload.phone,
          orderPayload.user_phone,
          orderPayload.phone_number,
          orderPayload.customer_phone,
        ]
          .filter(Boolean)
          .some((value) => value.toString().toLowerCase().includes(query));

        if (!matchesOrderId && !matchesUserShortname && !matchesPhone) {
          return false;
        }
      }

      return true;
    });
  }

  async function viewCombinedOrder(order: any) {
    selectedCombinedOrder = order;

    const payload = order.attributes?.payload?.body;
    const ordersShortnames = payload?.orders_shortnames || [];

    if (ordersShortnames.length === 0) {
      errorToastMessage("No orders found in this combined order");
      return;
    }

    selectedCombinedOrderDetails = {
      ...order,
      individualOrders: [],
      isLoadingOrders: true,
    };
    isModalOpen = true;

    try {
      const sellersResponse = await getSpaceContents(
        website.main_space,
        "orders",
        "managed",
        1000,
        0,
        false,
      );

      const individualOrders = [];

      if (sellersResponse?.records) {
        const sellers = sellersResponse.records.filter(
          (r) => r.resource_type === "folder",
        );

        const sellerPromises = sellers.map(async (seller) => {
          try {
            const sellerOrdersResponse = await getSpaceContents(
              website.main_space,
              `orders/${seller.shortname}`,
              "managed",
              1000,
              0,
              true,
            );

            const foundOrders = [];
            if (sellerOrdersResponse?.records) {
              for (const orderShortname of ordersShortnames) {
                const orderRecord = sellerOrdersResponse.records.find(
                  (r) => r.shortname === orderShortname,
                );
                if (orderRecord) {
                  foundOrders.push({
                    ...orderRecord,
                    seller_shortname: seller.shortname,
                  });
                }
              }
            }
            return foundOrders;
          } catch (err) {
            console.error(
              `Error loading orders for seller ${seller.shortname}:`,
              err,
            );
            return [];
          }
        });

        const results = await Promise.all(sellerPromises);
        results.forEach((orders) => {
          individualOrders.push(...orders);
        });
      }

      selectedCombinedOrderDetails = {
        ...order,
        individualOrders,
        isLoadingOrders: false,
      };
    } catch (error) {
      console.error("Error loading combined order details:", error);
      errorToastMessage("Error loading order details");
      selectedCombinedOrderDetails = {
        ...order,
        individualOrders: [],
        isLoadingOrders: false,
      };
    }
  }

  function closeOrderDetails() {
    isModalOpen = false;
    selectedCombinedOrder = null;
    selectedCombinedOrderDetails = null;
  }

  async function handleIndividualOrderStateChange(
    sellerShortname: string,
    orderShortname: string,
    newState: string,
  ) {
    if (selectedCombinedOrder) {
      await viewCombinedOrder(selectedCombinedOrder);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getPaymentStatusClass(status: string): string {
    const statusClasses: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      nopaid: "bg-gray-100 text-gray-800",
      failed: "bg-red-100 text-red-800",
    };
    return statusClasses[status] || "bg-gray-100 text-gray-800";
  }

  function getCombinedOrderStatus(order: any): string {
    return (
      order.attributes?.state ||
      order.attributes?.payload?.body?.order_status ||
      order.attributes?.payload?.body?.state ||
      ""
    );
  }

  function getCombinedOrderSellers(order: any): string[] {
    const payload = order.attributes?.payload?.body || {};
    const possibleLists = [
      payload.sellers,
      payload.seller_shortnames,
      payload.sellers_shortnames,
    ];
    const list = possibleLists.find((value) => Array.isArray(value));
    const directSeller = payload.seller_shortname || payload.seller;
    if (list && list.length > 0) {
      return list.map((value) => value?.toString()).filter(Boolean);
    }
    return directSeller ? [directSeller.toString()] : [];
  }

  function getCombinedOrderGovernorate(order: any): string {
    const payload = order.attributes?.payload?.body || {};
    return (
      payload.governorate ||
      payload.governrate ||
      payload.governorate_name ||
      ""
    );
  }

  function isBnplOrder(payload: any): boolean {
    return payload?.payment_type?.toString().toLowerCase() === "bnpl";
  }

  function isSameDayDelivery(payload: any): boolean {
    const shipping = payload?.shipping || {};
    const shippingType =
      shipping?.type || payload?.shipping_type || payload?.shippingType || "";
    return shippingType.toString().toLowerCase() === "ssd";
  }

  function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  function downloadOrdersCsv() {
    const header = [
      "combined_order_id",
      "order_shortname",
      "customer_shortname",
      "customer_phone",
      "payment_status",
      "payment_type",
      "total_amount",
      "order_from",
      "created_at",
    ];
    const rows = filteredOrders.map((order) => {
      const payload = order.attributes?.payload?.body || {};
      return [
        payload.combined_order_id || order.shortname,
        order.shortname,
        payload.user_shortname || "",
        payload.phone ||
          payload.user_phone ||
          payload.phone_number ||
          payload.customer_phone ||
          "",
        payload.payment_status || "",
        payload.payment_type || "",
        payload.total_amount || 0,
        payload.order_from || "",
        order.attributes?.created_at || "",
      ].map(escapeCsvValue);
    });

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `combined_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  let totalRevenue = $derived.by(() => {
    return filteredOrders.reduce((sum, order) => {
      const payload = order.attributes?.payload?.body;
      return sum + (payload?.total_amount || 0);
    }, 0);
  });

  let totalItems = $derived.by(() => {
    return filteredOrders.reduce((sum, order) => {
      const payload = order.attributes?.payload?.body;
      const ordersCount = payload?.orders_shortnames?.length || 0;
      return sum + ordersCount;
    }, 0);
  });

  let averageOrder = $derived.by(() => {
    if (filteredOrders.length === 0) return 0;
    return totalRevenue / filteredOrders.length;
  });

  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(totalOrders / itemsPerPage));
  });

  let paginationStart = $derived.by(() => {
    return totalOrders === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    return Math.min(currentPage * itemsPerPage, totalOrders);
  });

  let availableOrderStatuses = $derived.by(() => {
    const statuses = new Set<string>();
    combinedOrders.forEach((order) => {
      const status = getCombinedOrderStatus(order);
      if (status) statuses.add(status);
    });
    return ["all", ...Array.from(statuses)];
  });

  let availableSellers = $derived.by(() => {
    const sellers = new Set<string>();
    combinedOrders.forEach((order) => {
      getCombinedOrderSellers(order).forEach((seller) => sellers.add(seller));
    });
    return ["all", ...Array.from(sellers)];
  });

  let availableGovernorates = $derived.by(() => {
    const governorates = new Set<string>();
    combinedOrders.forEach((order) => {
      const governorate = getCombinedOrderGovernorate(order);
      if (governorate) governorates.add(governorate);
    });
    return ["all", ...Array.from(governorates)];
  });

  /** Page numbers to show in the pagination bar (numbers or "ellipsis") */
  let visiblePageNumbers = $derived.by(() => {
    const total = totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
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
    currentPage = page;
    loadCombinedOrders();
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadCombinedOrders();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      loadCombinedOrders();
    }
  }

  $effect(() => {
    selectedPaymentStatus;
    selectedOrderStatus;
    selectedSeller;
    selectedGovernorate;
    selectedBnpl;
    dateFrom;
    dateTo;
    searchQuery;
    if (combinedOrders.length > 0) {
      applyFilters();
    }
  });

   // dropdown states
  let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);

  function closeAllDropdowns() {
    isFiltersOpen = false;
    isActionsOpen = false;
  }

  function toggleFilters() {
    // close the other dropdown then toggle this one
    isActionsOpen = false;
    isFiltersOpen = !isFiltersOpen;
  }

  function toggleActions() {
    isFiltersOpen = false;
    isActionsOpen = !isActionsOpen;
  }

  function resetFilters() {
    selectedPaymentStatus = "all";
    selectedOrderStatus = "all";
    selectedSeller = "all";
    selectedGovernorate = "all";
    selectedBnpl = "all";
    dateFrom = "";
    dateTo = "";
  }

  // optional: show a count badge on the Filters button
  function activeFiltersCount() {
    let n = 0;
    if (selectedPaymentStatus !== "all") n++;
    if (selectedOrderStatus !== "all") n++;
    if (selectedSeller !== "all") n++;
    if (selectedGovernorate !== "all") n++;
    if (selectedBnpl !== "all") n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    return n;
  }

  // click outside closes
   let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(item.id ?? item.shortname ?? crypto.randomUUID());
  }

  function toggleTableActions(item: any) {
    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeActions() {
    openActionsFor = null;
  }

  function onWindowClick() {
    if (openActionsFor) closeActions();
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

<div class="orders-container">
  <div class="header">
    <h1>Combined Orders</h1>
  </div>

  
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
       <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z" fill="#3C307F"/>
</svg>

      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          Total Orders
        </h3>

        <p class="stat-value">
          {filteredOrders.length}
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
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          Total Revenue
        </h3>
        <p class="stat-value">
          {formatCurrency(totalRevenue)} IQD
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          Total Items
        </h3>
        <p class="stat-value">
          {totalItems}
        </p>
      </div>
    </div>
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2ZM4.5 2.5V3.6665C4.5 3.77469 4.53509 3.87995 4.6 3.9665C4.61345 3.98444 4.62568 4.00326 4.63661 4.02284L5.42302 5.43199C5.5381 5.59873 5.6 5.79679 5.6 6C5.6 6.20321 5.5381 6.40127 5.42302 6.56801L4.63661 7.97716C4.62568 7.99674 4.61345 8.01556 4.6 8.0335C4.53509 8.12005 4.5 8.22532 4.5 8.3335V9.5H7.5V8.3335C7.5 8.22531 7.46491 8.12005 7.4 8.0335C7.38769 8.01709 7.37641 7.99994 7.3662 7.98214L6.55725 6.57077C6.44095 6.40346 6.37836 6.20433 6.37836 6C6.37836 5.79567 6.44095 5.59654 6.55725 5.42923L7.3662 4.01786C7.37641 4.00006 7.38769 3.98291 7.4 3.9665C7.46491 3.87995 7.5 3.77469 7.5 3.6665V2.5H4.5Z"
            fill="#1C398E"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          Average Order
        </h3>
        <p class="stat-value">
         {formatCurrency(averageOrder)} IQD
        </p>
      </div>
    </div>

    
  </div>
  <!-- Filters Section -->
<div class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6">
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
        placeholder="Order ID, username, phone..."
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

  <!-- RIGHT: FILTERS + ACTIONS -->
  <div class="flex items-end gap-3 justify-end">
    <!-- FILTERS DROPDOWN -->
    <div class="relative">
      <button
        type="button"
        onclick={toggleFilters}
        class="h-9 inline-flex items-center justify-between cursor-pointer
          px-3 py-2 min-w-[170px]
          bg-[#F9FAFB] border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm text-gray-700 hover:bg-gray-50"
      >
      
        <span class="truncate inline-flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M2.46579 4.21134C1.71144 3.34923 2.32369 2 3.46923 2H12.5309C13.6764 2 14.2887 3.34923 13.5343 4.21134L10.0001 8.25049V13C10.0001 13.824 9.05929 14.2944 8.40005 13.8L6.40005 12.3C6.14824 12.1111 6.00005 11.8148 6.00005 11.5V8.25049L2.46579 4.21134ZM12.5309 3.33333H3.46923L7.00349 7.37248C7.21616 7.61554 7.33338 7.92753 7.33338 8.25049V11.3333L8.66672 12.3333V8.25049C8.66672 7.92753 8.78394 7.61554 8.99661 7.37248L12.5309 3.33333Z" fill="#4A5565"/>
</svg>

          Filters
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
        <div
          class="absolute right-0 z-20 mt-2 w-[360px]
            rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- Payment -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
              <select
                bind:value={selectedPaymentStatus}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
              >
                {#each paymentStatuses as status}
                  <option value={status.value}>{status.label}</option>
                {/each}
              </select>
            </div>

            <!-- Order Status -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Order Status</label>
              <select
                bind:value={selectedOrderStatus}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
              >
                {#each availableOrderStatuses as status}
                  <option value={status}>
                    {status === "all" ? "All Statuses" : status}
                  </option>
                {/each}
              </select>
            </div>

            <!-- Seller -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Seller</label>
              <select
                bind:value={selectedSeller}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
              >
                {#each availableSellers as seller}
                  <option value={seller}>
                    {seller === "all" ? "All Sellers" : seller}
                  </option>
                {/each}
              </select>
            </div>

            <!-- Governorate -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Governorate</label>
              <select
                bind:value={selectedGovernorate}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
              >
                {#each availableGovernorates as governorate}
                  <option value={governorate}>
                    {governorate === "all" ? "All Governorates" : governorate}
                  </option>
                {/each}
              </select>
            </div>

            <!-- BNPL -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">BNPL</label>
              <select
                bind:value={selectedBnpl}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
              >
                {#each bnplFilterOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>

            <!-- Date From -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Date From</label>
              <input
                type="date"
                bind:value={dateFrom}
                class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
              />
            </div>

            <!-- Date To -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Date To</label>
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
              Reset
            </button>

            <button
              type="button"
              onclick={() => {
                // close filters dropdown after applying if you want
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

    <!-- ACTIONS DROPDOWN -->
    <div class="relative">
      <button
        type="button"
        onclick={toggleActions}
        class="h-9 inline-flex items-center justify-between
          px-3 py-2 min-w-[140px]
          bg-[#F9FAFB] border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm text-gray-700 hover:bg-gray-50"
      >
        <span class="truncate">Actions</span>
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if isActionsOpen}
        <div class="absolute right-0 z-20 mt-2 w-[220px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-2">
          <button
            type="button"
            class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
            onclick={() => {
              isActionsOpen = false;
              downloadOrdersCsv();
            }}
          >
            Download CSV
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
      <button class="btn-retry" onclick={loadCombinedOrders}>Retry</button>
    </div>
  {:else if filteredOrders.length === 0}
    <div class="empty-state">
      <p>No combined orders found</p>
      {#if searchQuery || selectedPaymentStatus !== "all"}
        <p class="empty-hint">Try adjusting your filters</p>
      {/if}
    </div>
  {:else}
    <!-- Orders Table -->
    <div class="orders-table-wrapper">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order Code</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Sellers</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white">
  {#each filteredOrders as order (order.shortname)}
    <tr
      class="clickable-row hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
      onclick={() => viewCombinedOrder(order)}
    >
      <!-- ORDER (icon + code + badges) -->
      <td class="px-6 py-4">
        <div class="flex items-center gap-2.5">
          <!-- 44x44 icon -->
          <div
            class="shrink-0 rounded-full flex items-center justify-center"
            style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
            aria-hidden="true"
          >
            <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
              #
            </span>
          </div>

          <div class="min-w-0">
            <div
              class="truncate"
              style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
              title={"#" + ((order.attributes?.payload?.body?.combined_order_id) || order.shortname)}
            >
              #{order.attributes?.payload?.body?.combined_order_id || order.shortname}
            </div>

            <div class="flex items-center gap-2 mt-1">
              {#if isBnplOrder(order.attributes?.payload?.body)}
                <span
                  class="inline-flex items-center rounded-sm border px-2 py-0.5"
                  style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                >
                  <span style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;">BNPL</span>
                </span>
              {/if}

              {#if isSameDayDelivery(order.attributes?.payload?.body)}
                <span
                  class="inline-flex items-center rounded-sm border px-2 py-0.5"
                  style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
                >
                  <span style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;">SSD</span>
                </span>
              {/if}
            </div>
          </div>
        </div>
      </td>

      <!-- CUSTOMER (name + from) -->
      <td class="px-6 py-4">
        <div class="min-w-0">
          <div
            class="truncate"
            style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
            title={order.attributes?.payload?.body?.user_shortname || "N/A"}
          >
            {order.attributes?.payload?.body?.user_shortname || "N/A"}
          </div>
          <div
            class="truncate mt-1"
            style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
            title={order.attributes?.payload?.body?.order_from || "N/A"}
          >
            {order.attributes?.payload?.body?.order_from || "N/A"}
          </div>
        </div>
      </td>

      <!-- ITEMS -->
      <td
        class="px-6 py-4 text-center"
        style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
      >
        {order.attributes?.payload?.body?.orders_shortnames?.length || 0}
      </td>

      <!-- SELLERS -->
      <td class="px-6 py-4">
        <span
          class="inline-flex items-center rounded-sm border px-2 py-0.5"
          style="height:20px;background:#F3F4F6;border-color:#E5E7EB;"
        >
          <span style="font-weight:500;font-size:12px;line-height:16px;color:#101828;">
            {(order.attributes?.payload?.body?.orders_shortnames?.length || 0)}
            {(order.attributes?.payload?.body?.orders_shortnames?.length || 0) === 1 ? " seller" : " sellers"}
          </span>
        </span>
      </td>

      <!-- TOTAL -->
      <td class="px-6 py-4 text-right">
        <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
          {formatCurrency(order.attributes?.payload?.body?.total_amount || 0)} IQD
        </span>
      </td>

      <!-- PAYMENT (status pill + type) -->
      <td class="px-6 py-4">
        <div class="flex flex-col gap-1">
          <span
            class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 w-fit"
            style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
          >
            <!-- You can keep your getPaymentStatusClass if you want; here is a design pill -->
            <span style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;">
              {order.attributes?.payload?.body?.payment_status || "pending"}
            </span>
          </span>

          <span style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;">
            {order.attributes?.payload?.body?.payment_type || "N/A"}
          </span>
        </div>
      </td>

      <!-- DATE (calendar icon + 15 Mar 2025) -->
      <td class="px-6 py-4">
        <div
          class="inline-flex items-center gap-2"
          style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z" fill="#6A7282"/>
</svg>

          <span>{formatDateDMY(order.attributes?.created_at)}</span>
        </div>
      </td>

      <!-- ACTIONS (... dropdown) -->
      <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
            aria-label="Actions"
            aria-haspopup="menu"
            aria-expanded={openActionsFor === getRowId(order)}
            onclick={() => toggleTableActions(order)}
          >
            <span class="text-xl leading-none">…</span>
          </button>

          {#if openActionsFor === getRowId(order)}
            <div
              class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
              role="menu"
            >
              <button
                class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                onclick={() => {
                  closeActions();
                  viewCombinedOrder(order);
                }}
                role="menuitem"
              >
                View
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
    <div class="pagination">
      <p class="pagination-text">
        Showing {paginationStart}-{paginationEnd} of {totalOrders}
      </p>
      <div class="pagination-controls">
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
              aria-label="Page {segment}"
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

{#if isModalOpen && selectedCombinedOrderDetails}
  <OrderDetailsModal
    bind:isOpen={isModalOpen}
    combinedOrder={selectedCombinedOrderDetails}
    onClose={closeOrderDetails}
    onStateChange={handleIndividualOrderStateChange}
  />
{/if}

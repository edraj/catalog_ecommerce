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
  let combinedOrderSuborders = $state(new Map());

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
  let phoneQuery = $state("");

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
      const allOrders = await fetchAllCombinedOrders();
      combinedOrders = allOrders;
      totalOrders = combinedOrders.length;
      await loadSubordersForCombinedOrders(combinedOrders);
      applyFilters();
    } catch (e) {
      error = "An error occurred while loading orders";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function fetchAllCombinedOrders(): Promise<any[]> {
    const pageSize = 200;
    let offset = 0;
    let total = 0;
    const allOrders: any[] = [];

    while (true) {
      const response = await getCombinedOrders(
        website.main_space,
        undefined,
        pageSize,
        offset,
      );

      if (response.status !== "success") {
        error = "Failed to load orders";
        break;
      }

      const records = response.records || [];
      allOrders.push(...records);
      total = response.attributes?.total || allOrders.length;
      offset += pageSize;

      if (records.length === 0 || allOrders.length >= total) {
        break;
      }
    }

    return allOrders;
  }

  async function loadSubordersForCombinedOrders(orders: any[]) {
    const shortnameToCombinedKeys = new Map();
    orders.forEach((order) => {
      const payload = order.attributes?.payload?.body || {};
      const orderShortnames = payload.orders_shortnames || [];
      const combinedKey = getCombinedOrderKey(order);
      orderShortnames.forEach((shortname: string) => {
        const existing = shortnameToCombinedKeys.get(shortname) || [];
        existing.push(combinedKey);
        shortnameToCombinedKeys.set(shortname, existing);
      });
    });

    if (shortnameToCombinedKeys.size === 0) {
      combinedOrderSuborders = new Map();
      return;
    }

    const subordersMap = new Map();

    try {
      const sellersResponse = await getSpaceContents(
        website.main_space,
        "orders",
        "managed",
        1000,
        0,
        false,
      );

      if (sellersResponse?.records) {
        const sellers = sellersResponse.records.filter(
          (record) => record.resource_type === "folder",
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

            if (!sellerOrdersResponse?.records) return;

            sellerOrdersResponse.records.forEach((orderRecord) => {
              const combinedKeys = shortnameToCombinedKeys.get(
                orderRecord.shortname,
              );
              if (!combinedKeys) return;
              combinedKeys.forEach((combinedKey: string) => {
                const list = subordersMap.get(combinedKey) || [];
                list.push({
                  ...orderRecord,
                  seller_shortname: seller.shortname,
                });
                subordersMap.set(combinedKey, list);
              });
            });
          } catch (err) {
            console.error(
              `Error loading orders for seller ${seller.shortname}:`,
              err,
            );
          }
        });

        await Promise.all(sellerPromises);
      }
    } catch (err) {
      console.error("Error loading suborders for combined orders:", err);
    }

    combinedOrderSuborders = subordersMap;
  }

  function applyFilters() {
    filteredOrders = combinedOrders.filter((order) => {
      const orderPayload = order.attributes?.payload?.body;
      if (!orderPayload) return false;

      const combinedKey = getCombinedOrderKey(order);
      const suborders = combinedOrderSuborders.get(combinedKey) || [];

      if (selectedOrderStatus !== "all") {
        const hasMatchingStatus = suborders.some(
          (suborder) =>
            getOrderStatusFromSuborder(suborder) === selectedOrderStatus,
        );
        if (!hasMatchingStatus) return false;
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
        const isBnpl = isCombinedOrderBnpl(order);
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

      if (phoneQuery) {
        const query = phoneQuery.toLowerCase();
        const combinedPhoneMatches = getCombinedOrderPhones(order).some(
          (value) => value.toLowerCase().includes(query),
        );
        const suborderPhoneMatches = suborders.some((suborder) =>
          getOrderPhones(suborder).some((value) =>
            value.toLowerCase().includes(query),
          ),
        );
        if (!combinedPhoneMatches && !suborderPhoneMatches) {
          return false;
        }
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesOrderId = orderPayload.combined_order_id
          ?.toString()
          .includes(query);
        const matchesUserShortname = orderPayload.user_shortname
          ?.toLowerCase()
          .includes(query);
        const matchesPhone = getCombinedOrderPhones(order).some((value) =>
          value.toLowerCase().includes(query),
        );
        const matchesSuborders = suborders.some((suborder) => {
          const subPayload = suborder.attributes?.payload?.body || {};
          const subUserShortname = subPayload.user?.shortname || "";
          const subOrderCode = subPayload.order_code || "";
          const subMatchOrderId = suborder.shortname
            ?.toString()
            .includes(query);
          const subMatchUser = subUserShortname
            .toString()
            .toLowerCase()
            .includes(query);
          const subMatchCode = subOrderCode
            .toString()
            .toLowerCase()
            .includes(query);
          const subMatchPhone = getOrderPhones(suborder).some((value) =>
            value.toLowerCase().includes(query),
          );
          return (
            subMatchOrderId || subMatchUser || subMatchCode || subMatchPhone
          );
        });

        if (
          !matchesOrderId &&
          !matchesUserShortname &&
          !matchesPhone &&
          !matchesSuborders
        ) {
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
    const combinedKey = getCombinedOrderKey(order);
    const suborders = combinedOrderSuborders.get(combinedKey) || [];
    if (suborders.length > 0) {
      return suborders
        .map((suborder) => getOrderSellerShortname(suborder))
        .filter(Boolean);
    }

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
    const combinedKey = getCombinedOrderKey(order);
    const suborders = combinedOrderSuborders.get(combinedKey) || [];
    const suborderGovernorates = suborders
      .map((suborder) => getOrderGovernorate(suborder))
      .filter(Boolean);
    if (suborderGovernorates.length > 0) {
      return suborderGovernorates[0];
    }

    const payload = order.attributes?.payload?.body || {};
    return (
      payload.governorate ||
      payload.governrate ||
      payload.governorate_name ||
      ""
    );
  }

  function isBnplOrder(payload: any): boolean {
    const info = payload?.info?.toString().toLowerCase() || "";
    const paymentType = payload?.payment_type?.toString().toLowerCase() || "";
    return paymentType === "bnpl" || info.includes("bnpl");
  }

  function isCombinedOrderBnpl(order: any): boolean {
    const payload = order.attributes?.payload?.body || {};
    if (isBnplOrder(payload)) return true;
    const combinedKey = getCombinedOrderKey(order);
    const suborders = combinedOrderSuborders.get(combinedKey) || [];
    return suborders.some((suborder) =>
      isBnplOrder(suborder.attributes?.payload?.body),
    );
  }

  function getCombinedOrderKey(order: any): string {
    const payload = order.attributes?.payload?.body || {};
    return (payload.combined_order_id || order.shortname).toString();
  }

  function getOrderStatusFromSuborder(order: any): string {
    return (
      order.attributes?.state ||
      order.attributes?.payload?.body?.order_status ||
      order.attributes?.payload?.body?.state ||
      ""
    );
  }

  function getOrderSellerShortname(order: any): string {
    if (order.seller_shortname) return order.seller_shortname.toString();
    if (order.attributes?.seller_shortname) {
      return order.attributes.seller_shortname.toString();
    }
    const subpath = order.subpath || "";
    const segments = subpath.split("/");
    return segments[1] || "";
  }

  function getOrderGovernorate(order: any): string {
    const payload = order.attributes?.payload?.body || {};
    return payload.user?.state || payload.user?.address || "";
  }

  function getCombinedOrderPhones(order: any): string[] {
    const payload = order.attributes?.payload?.body || {};
    return [
      payload.phone,
      payload.user_phone,
      payload.phone_number,
      payload.customer_phone,
    ]
      .filter(Boolean)
      .map((value) => value.toString());
  }

  function getOrderPhones(order: any): string[] {
    const payload = order.attributes?.payload?.body || {};
    return [
      payload.phone,
      payload.user_phone,
      payload.phone_number,
      payload.customer_phone,
      payload.user?.phone,
    ]
      .filter(Boolean)
      .map((value) => value.toString());
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

  let filteredTotal = $derived.by(() => {
    return filteredOrders.length;
  });

  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(filteredTotal / itemsPerPage));
  });

  let paginationStart = $derived.by(() => {
    return filteredTotal === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    return Math.min(currentPage * itemsPerPage, filteredTotal);
  });

  let paginatedOrders = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  });

  let availableOrderStatuses = $derived.by(() => {
    const statuses = new Set<string>();
    combinedOrders.forEach((order) => {
      const combinedKey = getCombinedOrderKey(order);
      const suborders = combinedOrderSuborders.get(combinedKey) || [];
      if (suborders.length > 0) {
        suborders.forEach((suborder) => {
          const status = getOrderStatusFromSuborder(suborder);
          if (status) statuses.add(status);
        });
      } else {
        const status = getCombinedOrderStatus(order);
        if (status) statuses.add(status);
      }
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

  $effect(() => {
    selectedPaymentStatus;
    selectedOrderStatus;
    selectedSeller;
    selectedGovernorate;
    selectedBnpl;
    dateFrom;
    dateTo;
    searchQuery;
    phoneQuery;
    if (combinedOrders.length > 0) {
      applyFilters();
    }
  });

  $effect(() => {
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
  });
</script>

<div class="orders-container">
  <div class="header">
    <h1>Combined Orders</h1>
  </div>

  <!-- Stats Cards -->
  <div class="stats-section">
    <div class="stat-card">
      <div class="stat-icon orders">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-label">Total Orders</p>
        <p class="stat-value">{filteredOrders.length}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon revenue">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"
          />
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-label">Total Revenue</p>
        <p class="stat-value">{formatCurrency(totalRevenue)} IQD</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon items">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-label">Total Items</p>
        <p class="stat-value">{totalItems}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon average">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-label">Average Order</p>
        <p class="stat-value">{formatCurrency(averageOrder)} IQD</p>
      </div>
    </div>
  </div>

  <!-- Filters Section -->
  <div class="filters-section">
    <div class="filters-row">
      <div class="filter-group">
        <label for="payment-filter">Payment Status</label>
        <select id="payment-filter" bind:value={selectedPaymentStatus}>
          {#each paymentStatuses as status}
            <option value={status.value}>{status.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="order-status-filter">Order Status</label>
        <select id="order-status-filter" bind:value={selectedOrderStatus}>
          {#each availableOrderStatuses as status}
            <option value={status}>
              {status === "all" ? "All Statuses" : status}
            </option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="seller-filter">Seller</label>
        <select id="seller-filter" bind:value={selectedSeller}>
          {#each availableSellers as seller}
            <option value={seller}>
              {seller === "all" ? "All Sellers" : seller}
            </option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="governorate-filter">Governorate</label>
        <select id="governorate-filter" bind:value={selectedGovernorate}>
          {#each availableGovernorates as governorate}
            <option value={governorate}>
              {governorate === "all" ? "All Governorates" : governorate}
            </option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="bnpl-filter">BNPL</label>
        <select id="bnpl-filter" bind:value={selectedBnpl}>
          {#each bnplFilterOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="date-from">Date From</label>
        <input id="date-from" type="date" bind:value={dateFrom} />
      </div>

      <div class="filter-group">
        <label for="date-to">Date To</label>
        <input id="date-to" type="date" bind:value={dateTo} />
      </div>

      <div class="filter-group">
        <label for="search">Search</label>
        <input
          id="search"
          type="text"
          placeholder="Order ID, username, phone..."
          bind:value={searchQuery}
        />
      </div>

      <div class="filter-group">
        <label for="phone">Phone</label>
        <input
          id="phone"
          type="text"
          placeholder="Customer phone"
          bind:value={phoneQuery}
        />
      </div>

      <div class="filter-group">
        <button
          class="btn-reset"
          onclick={() => {
            selectedPaymentStatus = "all";
            selectedOrderStatus = "all";
            selectedSeller = "all";
            selectedGovernorate = "all";
            selectedBnpl = "all";
            dateFrom = "";
            dateTo = "";
            searchQuery = "";
            phoneQuery = "";
          }}
        >
          Reset Filters
        </button>
      </div>

      <div class="filter-group">
        <button class="btn-download" onclick={downloadOrdersCsv}>
          Download CSV
        </button>
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
        <tbody>
          {#each paginatedOrders as order (order.shortname)}
            {@const payload = order.attributes?.payload?.body}
            {@const ordersCount = payload?.orders_shortnames?.length || 0}
            <tr class="clickable-row" onclick={() => viewCombinedOrder(order)}>
              <td>
                <div class="order-code">
                  <strong
                    >#{payload?.combined_order_id || order.shortname}</strong
                  >
                  <div class="order-badges">
                    {#if isCombinedOrderBnpl(order)}
                      <span class="badge badge-bnpl">BNPL</span>
                    {/if}
                    {#if isSameDayDelivery(payload)}
                      <span class="badge badge-ssd">SSD</span>
                    {/if}
                  </div>
                </div>
              </td>
              <td>
                <div class="customer-info">
                  <span>{payload?.user_shortname || "N/A"}</span>
                  <small>{payload?.order_from || "N/A"}</small>
                </div>
              </td>
              <td class="text-center">{ordersCount}</td>
              <td>
                <div class="sellers-list">
                  <span class="seller-badge"
                    >{ordersCount}
                    {ordersCount === 1 ? "seller" : "sellers"}</span
                  >
                </div>
              </td>
              <td class="text-right">
                <strong>{formatCurrency(payload?.total_amount || 0)} IQD</strong
                >
              </td>
              <td>
                <div class="payment-info">
                  <span
                    class="badge {getPaymentStatusClass(
                      payload?.payment_status || 'pending',
                    )}"
                  >
                    {payload?.payment_status || "pending"}
                  </span>
                  <small>{payload?.payment_type || "N/A"}</small>
                </div>
              </td>
              <td>
                <small>{formatDate(order.attributes.created_at)}</small>
              </td>
              <td onclick={(e) => e.stopPropagation()}>
                <div class="action-buttons">
                  <button
                    class="btn-view"
                    onclick={() => viewCombinedOrder(order)}
                  >
                    View
                  </button>
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
        Showing {paginationStart}-{paginationEnd} of {filteredTotal}
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

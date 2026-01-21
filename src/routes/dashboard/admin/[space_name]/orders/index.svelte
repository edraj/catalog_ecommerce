<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { Pagination } from "@/components/ui";
  import "./index.css";
  import { website } from "@/config";
  import OrderDetailsModal from "./OrderDetailsModal.svelte";

  $goto;
  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let orders = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingOrders = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let paymentStatusFilter = $state("all");

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let isModalOpen = $state(false);
  let selectedOrderShortname = $state("");
  let selectedOrderSeller = $state("");

  let filteredOrders = $derived.by(() => {
    let filtered = [...orders];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((order) => {
        const orderNumber = order.order_number || "";
        const customerName = order.customer_name || "";
        const buyerShortname = order.buyer_shortname || "";
        return (
          orderNumber.toLowerCase().includes(searchLower) ||
          customerName.toLowerCase().includes(searchLower) ||
          buyerShortname.toLowerCase().includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter(
        (order) => order.payment_status === paymentStatusFilter,
      );
    }

    return filtered;
  });

  let paginatedOrders = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredOrders.length / itemsPerPage);
  });

  let totalRevenue = $derived.by(() => {
    return filteredOrders.reduce(
      (sum, order) => sum + (order.total_amount || 0),
      0,
    );
  });

  $effect(() => {
    searchTerm;
    statusFilter;
    paymentStatusFilter;
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

  onMount(async () => {
    await loadSellers();
  });

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "orders",
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

  async function loadSellerOrders(reset = true) {
    if (reset) {
      orders = [];
    }

    if (selectedSeller === "all") {
      isLoadingOrders = true;
      try {
        const allOrders = [];

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `orders/${seller.shortname}`,
              "managed",
              1000,
              0,
              true,
            );

            if (response?.records) {
              for (const record of response.records) {
                const body = record.attributes?.payload?.body;
                const state = record.attributes?.state || "pending";

                if (body) {
                  const itemsTotal =
                    body.items?.reduce(
                      (sum, item) => sum + (item.subtotal || 0),
                      0,
                    ) || 0;
                  const shippingCost = body.shipping?.cost || 0;
                  const couponDiscount = body.coupon?.discount_amount || 0;
                  const totalAmount =
                    itemsTotal + shippingCost - couponDiscount;

                  allOrders.push({
                    order_number: body.order_code || record.shortname,
                    buyer_shortname: body.user?.shortname || "",
                    customer_name:
                      body.user?.displayname || body.user?.shortname || "",
                    status: state,
                    payment_status: body.payment_status || "pending",
                    total_amount: totalAmount,
                    items_count: body.items?.length || 0,
                    created_at: record.attributes?.created_at || "",
                    seller_shortname: seller.shortname,
                    seller_displayname: getSellerDisplayName(seller),
                    record_shortname: record.shortname,
                    subpath: record.subpath,
                    resource_type: record.resource_type,
                  });
                }
              }
            }
          } catch (error) {
            console.error(
              `Error loading orders for ${seller.shortname}:`,
              error,
            );
          }
        }

        orders = allOrders.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      } catch (error) {
        console.error("Error loading orders:", error);
        errorToastMessage("Error loading orders");
      } finally {
        isLoadingOrders = false;
      }
      return;
    }

    isLoadingOrders = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `orders/${selectedSeller}`,
        "managed",
        1000,
        0,
        true,
      );

      const processedOrders = [];

      if (response?.records) {
        const seller = sellers.find((s) => s.shortname === selectedSeller);

        for (const record of response.records) {
          const body = record.attributes?.payload?.body;
          const state = record.attributes?.state || "pending";

          if (body) {
            const itemsTotal =
              body.items?.reduce(
                (sum, item) => sum + (item.subtotal || 0),
                0,
              ) || 0;
            const shippingCost = body.shipping?.cost || 0;
            const couponDiscount = body.coupon?.discount_amount || 0;
            const totalAmount = itemsTotal + shippingCost - couponDiscount;

            processedOrders.push({
              order_number: body.order_code || record.shortname,
              buyer_shortname: body.user?.shortname || "",
              customer_name:
                body.user?.displayname || body.user?.shortname || "",
              status: state,
              payment_status: body.payment_status || "pending",
              total_amount: totalAmount,
              items_count: body.items?.length || 0,
              created_at: record.attributes?.created_at || "",
              seller_shortname: selectedSeller,
              seller_displayname: getSellerDisplayName(seller),
              record_shortname: record.shortname,
              subpath: record.subpath,
              resource_type: record.resource_type,
            });
          }
        }
      }

      orders = processedOrders.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } catch (error) {
      console.error("Error loading orders:", error);
      errorToastMessage("Error loading orders");
    } finally {
      isLoadingOrders = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerOrders(true);
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
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  }

  function getStatusColor(status: string): string {
    const statusMap: Record<string, string> = {
      pending: "pending",
      processing: "processing",
      shipped: "shipped",
      delivered: "delivered",
      cancelled: "cancelled",
      approved: "delivered",
      rejected: "cancelled",
    };
    return statusMap[status] || "pending";
  }

  function getPaymentStatusColor(status: string): string {
    const statusMap: Record<string, string> = {
      paid: "paid",
      completed: "paid",
      pending: "pending",
      nopaid: "pending",
      failed: "failed",
      refunded: "refunded",
    };
    return statusMap[status] || "pending";
  }

  function viewOrder(order: any) {
    selectedOrderShortname = order.record_shortname;
    selectedOrderSeller = order.seller_shortname;
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
    selectedOrderShortname = "";
    selectedOrderSeller = "";
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }
</script>

<div class="admin-page-container">
  <div class="admin-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.seller_orders") || "Seller Orders"}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.view_manage_sellers_orders") ||
              "View and manage orders from all sellers"}
          </p>
        </div>
      </div>
    </div>

    <!-- Stats Summary -->
    {#if selectedSeller && filteredOrders.length > 0}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon orders">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
              />
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-label">
              {$_("admin.total_orders") || "Total Orders"}
            </p>
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
            <p class="stat-label">
              {$_("admin.total_revenue") || "Total Revenue"}
            </p>
            <p class="stat-value">
              {totalRevenue.toLocaleString()}
              {$_("admin.currency") || "IQD"}
            </p>
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
            <p class="stat-label">
              {$_("admin.total_items") || "Total Items"}
            </p>
            <p class="stat-value">
              {filteredOrders.reduce((sum, o) => sum + o.items_count, 0)}
            </p>
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
            <p class="stat-label">
              {$_("admin.average_order") || "Average Order"}
            </p>
            <p class="stat-value">
              {filteredOrders.length > 0
                ? Math.round(
                    totalRevenue / filteredOrders.length,
                  ).toLocaleString()
                : 0}
              {$_("admin.currency") || "IQD"}
            </p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters-group">
        <label for="seller-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
            />
          </svg>
          {$_("admin.select_seller") || "Select Seller"}
        </label>
        <select id="seller-filter" bind:value={selectedSeller}>
          <option value=""
            >{$_("admin.choose_seller") || "Choose a seller..."}</option
          >
          <option value="all">{$_("admin.all_sellers") || "All Sellers"}</option
          >
          {#each sellers as seller}
            <option value={seller.shortname}>
              {getSellerDisplayName(seller)}
            </option>
          {/each}
        </select>
      </div>

      <div class="search-bar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" stroke-width="2" />
          <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin.search_orders") ||
            "Search by order number or customer..."}
        />
      </div>

      <div class="filters-group">
        <label for="status-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("admin.order_status") || "Order Status"}
        </label>
        <select id="status-filter" bind:value={statusFilter}>
          <option value="all"
            >{$_("admin.all_statuses") || "All Statuses"}</option
          >
          <option value="pending">{$_("admin.pending") || "Pending"}</option>
          <option value="processing"
            >{$_("admin.processing") || "Processing"}</option
          >
          <option value="shipped">{$_("admin.shipped") || "Shipped"}</option>
          <option value="delivered"
            >{$_("admin.delivered") || "Delivered"}</option
          >
          <option value="cancelled"
            >{$_("admin.cancelled") || "Cancelled"}</option
          >
          <option value="approved">{$_("admin.approved") || "Approved"}</option>
          <option value="rejected">{$_("admin.rejected") || "Rejected"}</option>
        </select>
      </div>

      <div class="filters-group">
        <label for="payment-status-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path
              fill-rule="evenodd"
              d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("admin.payment_status") || "Payment Status"}
        </label>
        <select id="payment-status-filter" bind:value={paymentStatusFilter}>
          <option value="all"
            >{$_("admin.all_payment_statuses") ||
              "All Payment Statuses"}</option
          >
          <option value="paid">{$_("admin.paid") || "Paid"}</option>
          <option value="pending"
            >{$_("admin.payment_pending") || "Pending"}</option
          >
          <option value="failed">{$_("admin.failed") || "Failed"}</option>
          <option value="refunded">{$_("admin.refunded") || "Refunded"}</option>
        </select>
      </div>
    </div>

    <!-- Orders Table -->
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
            "Select a seller to view their orders"}
        </h3>
        <p>
          {$_("admin.select_seller_hint_orders") ||
            "Choose a seller from the dropdown above"}
        </p>
      </div>
    {:else if isLoadingOrders}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading orders..."}</p>
      </div>
    {:else if filteredOrders.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
          <path
            d="M16 24h16M24 16v16"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>{$_("admin.no_orders") || "No orders found"}</h3>
        <p>
          {$_("admin.no_orders_hint") || "This seller has no orders yet"}
        </p>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredOrders.length}</strong>
          {$_("admin.orders") || "orders"}
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
              <th>{$_("admin.order_number") || "Order #"}</th>
              <th>{$_("admin.seller") || "Seller"}</th>
              <th>{$_("admin.customer") || "Customer"}</th>
              <th>{$_("admin.items") || "Items"}</th>
              <th>{$_("admin.total_amount") || "Total Amount"}</th>
              <th>{$_("admin.order_status") || "Status"}</th>
              <th>{$_("admin.payment_status") || "Payment"}</th>
              <th>{$_("admin.order_date") || "Order Date"}</th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedOrders as order (order.order_number)}
              <tr class="item-row clickable" onclick={() => viewOrder(order)}>
                <td>
                  <div class="order-number">
                    <code>{order.order_number}</code>
                  </div>
                </td>
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
                    {order.seller_displayname || order.seller_shortname}
                  </div>
                </td>
                <td>
                  <div class="customer-info">
                    <div class="customer-name">{order.customer_name}</div>
                    <div class="customer-id">{order.buyer_shortname}</div>
                  </div>
                </td>
                <td>
                  <div class="items-count">
                    {order.items_count}
                    {order.items_count === 1
                      ? $_("admin.item") || "item"
                      : $_("admin.items") || "items"}
                  </div>
                </td>
                <td>
                  <div class="amount">
                    <strong>{order.total_amount.toLocaleString()}</strong>
                    {$_("admin.currency") || "IQD"}
                  </div>
                </td>
                <td>
                  <div
                    class="status-badge"
                    class:pending={getStatusColor(order.status) === "pending"}
                    class:processing={getStatusColor(order.status) ===
                      "processing"}
                    class:shipped={getStatusColor(order.status) === "shipped"}
                    class:delivered={getStatusColor(order.status) ===
                      "delivered"}
                    class:cancelled={getStatusColor(order.status) ===
                      "cancelled"}
                  >
                    <svg viewBox="0 0 8 8" fill="currentColor">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1)}
                  </div>
                </td>
                <td>
                  <div
                    class="payment-badge"
                    class:paid={getPaymentStatusColor(order.payment_status) ===
                      "paid"}
                    class:pending={getPaymentStatusColor(
                      order.payment_status,
                    ) === "pending"}
                    class:failed={getPaymentStatusColor(
                      order.payment_status,
                    ) === "failed"}
                    class:refunded={getPaymentStatusColor(
                      order.payment_status,
                    ) === "refunded"}
                  >
                    {order.payment_status.charAt(0).toUpperCase() +
                      order.payment_status.slice(1)}
                  </div>
                </td>
                <td>
                  <div class="order-date">{formatDate(order.created_at)}</div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <Pagination
        {currentPage}
        {totalPages}
        totalItems={filteredOrders.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
      />
    {/if}
  </div>
</div>

<OrderDetailsModal
  bind:isOpen={isModalOpen}
  orderShortname={selectedOrderShortname}
  sellerShortname={selectedOrderSeller}
  onClose={closeModal}
/>

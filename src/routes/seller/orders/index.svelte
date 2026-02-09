<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    getSellerOrders,
    updateOrderState,
    getCombinedOrderDetails,
    getPaymentByCombinedOrder,
  } from "@/lib/dmart_services";
  import type { Order } from "@/lib/types";
  import OrderDetailsModal from "@/components/modals/OrderDetailsModal.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { user } from "@/stores/user";
  import { website } from "@/config";
  import "./index.css";
  let orders = [];
  let filteredOrders = $state([]);
  let loading = $state(false);
  let itemsPerPage = $state(20);
  let totalOrders = $state(0);
  let error = $state("");
  let currentPage = $state(1);

  let selectedState = $state("all");
  let selectedPaymentStatus = $state("all");
  let searchQuery = $state("");
  let dateFrom = $state("");
  let dateTo = $state("");

  let showOrderDetails = $state(false);
  let selectedOrder = $state(null);
  let orderPayment: any = $state(null);
  let combinedOrderDetails: any = $state(null);

  let sellerShortname = $state("");
  let initialized = false;

  $effect(() => {
    if ($user && $user.shortname && !initialized) {
      sellerShortname = $user.shortname;
      initialized = true;
      loadOrders();
    }
  });

  const orderStates = [
    { value: "all", label: "All Orders" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "out_for_delivery", label: "Out for Delivery" },
    { value: "confirm_delivery", label: "Confirm Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "returned", label: "Returned" },
  ];

  const paymentStatuses = [
    { value: "all", label: "All Payment Status" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "nopaid", label: "Not Paid" },
    { value: "failed", label: "Failed" },
  ];

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

      const response = await getSellerOrders(
        website.main_space,
        sellerShortname,
        itemsPerPage,
        offset,
        stateFilter,
      );

      if (response.status === "success") {
        orders = response.records || [];
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
    filteredOrders = orders.filter((order) => {
      const orderPayload = order.attributes?.payload?.body;
      if (!orderPayload) return false;

      if (
        selectedPaymentStatus !== "all" &&
        orderPayload.payment_status !== selectedPaymentStatus
      ) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesOrderCode = orderPayload.order_code
          ?.toLowerCase()
          .includes(query);
        const matchesCustomer = orderPayload.user?.displayname
          ?.toLowerCase()
          .includes(query);
        const matchesTracking = orderPayload.tracking_code
          ?.toLowerCase()
          .includes(query);
        const matchesPhone = orderPayload.user?.phone?.includes(query);

        if (
          !matchesOrderCode &&
          !matchesCustomer &&
          !matchesTracking &&
          !matchesPhone
        ) {
          return false;
        }
      }

      if (dateFrom) {
        const orderDate = new Date(order.attributes.created_at);
        const fromDate = new Date(dateFrom);
        if (orderDate < fromDate) return false;
      }

      if (dateTo) {
        const orderDate = new Date(order.attributes.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (orderDate > toDate) return false;
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

  async function viewOrderDetails(order) {
    selectedOrder = order;
    loading = true;

    try {
      const combinedOrderId =
        order.attributes?.payload?.body?.combined_order_id?.toString();

      if (!combinedOrderId) {
        errorToastMessage("Order data is incomplete");
        loading = false;
        return;
      }

      combinedOrderDetails = await getCombinedOrderDetails(
        website.main_space,
        combinedOrderId,
      );

      orderPayment = await getPaymentByCombinedOrder(
        website.main_space,
        combinedOrderId,
      );

      showOrderDetails = true;
    } catch (e) {
      errorToastMessage("Failed to load order details");
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function closeOrderDetails() {
    showOrderDetails = false;
    selectedOrder = null;
    orderPayment = null;
    combinedOrderDetails = null;
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

  function calculateOrderTotal(order): number {
    const payload = order.attributes?.payload?.body;
    if (!payload) return 0;

    const itemsTotal =
      payload?.items?.reduce((sum, item) => sum + item.subtotal, 0) || 0;
    const shippingCost = payload.shipping?.cost || 0;
    const couponDiscount = payload.coupon?.discount_amount || 0;

    return itemsTotal + shippingCost - couponDiscount;
  }

  function getStateClass(state: string): string {
    const stateClasses: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-purple-100 text-purple-800",
      shipped: "bg-indigo-100 text-indigo-800",
      out_for_delivery: "bg-teal-100 text-teal-800",
      confirm_delivery: "bg-orange-100 text-orange-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      returned: "bg-gray-100 text-gray-800",
    };
    return stateClasses[state] || "bg-gray-100 text-gray-800";
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

  let totalPages = $state(0);
  $effect(() => {
    totalPages = Math.ceil(totalOrders / itemsPerPage);
  });

  function goToPage(page: number) {
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
    selectedState;
    selectedPaymentStatus;
    searchQuery;
    dateFrom;
    dateTo;
    if (orders.length > 0) {
      applyFilters();
    }
  });
</script>

<div class="orders-container">
  <div class="header">
    <h1>My Orders</h1>
  </div>

  <!-- Filters Section -->
  <div class="filters-section">
    <div class="filters-row">
      <div class="filter-group">
        <label for="state-filter">Order State</label>
        <select
          id="state-filter"
          bind:value={selectedState}
          onchange={() => {
            currentPage = 1;
            loadOrders();
          }}
        >
          {#each orderStates as state}
            <option value={state.value}>{state.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="payment-filter">Payment Status</label>
        <select id="payment-filter" bind:value={selectedPaymentStatus}>
          {#each paymentStatuses as status}
            <option value={status.value}>{status.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="search">Search</label>
        <input
          id="search"
          type="text"
          placeholder="Order code, customer, phone..."
          bind:value={searchQuery}
        />
      </div>
    </div>

    <div class="filters-row">
      <div class="filter-group">
        <label for="date-from">Date From</label>
        <input id="date-from" type="date" bind:value={dateFrom} />
      </div>

      <div class="filter-group">
        <label for="date-to">Date To</label>
        <input id="date-to" type="date" bind:value={dateTo} />
      </div>

      <div class="filter-group">
        <button
          class="btn-reset"
          onclick={() => {
            selectedState = "all";
            selectedPaymentStatus = "all";
            searchQuery = "";
            dateFrom = "";
            dateTo = "";
          }}
        >
          Reset Filters
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
      <button class="btn-retry" onclick={loadOrders}>Retry</button>
    </div>
  {:else if filteredOrders.length === 0}
    <div class="empty-state">
      <p>No orders found</p>
      {#if searchQuery || selectedState !== "all" || selectedPaymentStatus !== "all"}
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
            <th>Total</th>
            <th>Payment</th>
            <th>State</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredOrders as order (order.shortname)}
            {@const payload = order.attributes?.payload?.body}
            {@const total = calculateOrderTotal(order)}
            <tr class="clickable-row" onclick={() => viewOrderDetails(order)}>
              <td>
                <div class="order-code">
                  <strong>{payload?.order_code || "N/A"}</strong>
                  <small>{payload?.tracking_code || "N/A"}</small>
                </div>
              </td>
              <td>
                <div class="customer-info">
                  <span
                    >{payload?.user?.displayname ||
                      payload?.user?.shortname ||
                      "N/A"}</span
                  >
                  <small>{payload?.user?.phone || "N/A"}</small>
                </div>
              </td>
              <td class="text-center">{payload?.items?.length || 0}</td>
              <td class="text-right">
                <strong>{formatCurrency(total)} IQD</strong>
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
                <span class="badge {getStateClass(order.attributes.state)}">
                  {order.attributes.state}
                </span>
              </td>
              <td>
                <small>{formatDate(order.attributes.created_at)}</small>
              </td>
              <td onclick={(e) => e.stopPropagation()}>
                <div class="action-buttons">
                  <select
                    class="state-select"
                    value={order.attributes.state}
                    onchange={(e) =>
                      handleStateChange(order, e.currentTarget.value)}
                  >
                    {#each orderStates.slice(1) as state}
                      <option value={state.value}>{state.label}</option>
                    {/each}
                  </select>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <button
        class="btn-page"
        onclick={previousPage}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span class="page-info">
        Page {currentPage} of {totalPages}
      </span>
      <button
        class="btn-page"
        onclick={nextPage}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  {/if}
</div>

{#if showOrderDetails && selectedOrder}
  <OrderDetailsModal
    order={selectedOrder}
    payment={orderPayment}
    combinedOrder={combinedOrderDetails}
    {sellerShortname}
    on:close={closeOrderDetails}
    on:stateChange={async () => {
      await loadOrders();
      closeOrderDetails();
    }}
  />
{/if}

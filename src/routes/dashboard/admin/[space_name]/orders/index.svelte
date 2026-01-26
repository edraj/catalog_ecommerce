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

  let combinedOrders = [];
  let filteredOrders = $state([]);
  let loading = $state(false);
  let error = $state("");
  let totalOrders = 0;

  let currentPage = $state(1);
  let itemsPerPage = 15;

  let selectedPaymentStatus = $state("all");
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
        1000,
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

        if (!matchesOrderId && !matchesUserShortname) {
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

    // Open modal immediately with loading state
    selectedCombinedOrderDetails = {
      ...order,
      individualOrders: [],
      isLoadingOrders: true,
    };
    isModalOpen = true;

    // Load individual orders in the background
    try {
      // Fetch all seller folders
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
        // Filter to get only folders (sellers)
        const sellers = sellersResponse.records.filter(
          (r) => r.resource_type === "folder",
        );

        // Parallelize seller order fetching for better performance
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
              // Find orders that match the orders_shortnames
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

        // Wait for all seller requests to complete in parallel
        const results = await Promise.all(sellerPromises);
        results.forEach((orders) => {
          individualOrders.push(...orders);
        });
      }

      // Update modal with loaded orders
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
    // Reload the combined order to refresh the state
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

  // Calculate stats
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
    return Math.ceil(totalOrders / itemsPerPage);
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
    searchQuery;
    if (combinedOrders.length > 0) {
      applyFilters();
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
        <label for="search">Search</label>
        <input
          id="search"
          type="text"
          placeholder="Order ID, customer username..."
          bind:value={searchQuery}
        />
      </div>

      <div class="filter-group">
        <button
          class="btn-reset"
          onclick={() => {
            selectedPaymentStatus = "all";
            searchQuery = "";
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
          {#each filteredOrders as order (order.shortname)}
            {@const payload = order.attributes?.payload?.body}
            {@const ordersCount = payload?.orders_shortnames?.length || 0}
            <tr class="clickable-row" onclick={() => viewCombinedOrder(order)}>
              <td>
                <div class="order-code">
                  <strong
                    >#{payload?.combined_order_id || order.shortname}</strong
                  >
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

{#if isModalOpen && selectedCombinedOrderDetails}
  <OrderDetailsModal
    bind:isOpen={isModalOpen}
    combinedOrder={selectedCombinedOrderDetails}
    onClose={closeOrderDetails}
    onStateChange={handleIndividualOrderStateChange}
  />
{/if}

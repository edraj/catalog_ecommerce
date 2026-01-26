<script lang="ts">
  import { _ } from "@/i18n";
  import { updateOrderState } from "@/lib/dmart_services";
  import { website } from "@/config";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import "./index.css";
  interface Props {
    isOpen: boolean;
    combinedOrder: any;
    onClose: () => void;
    onStateChange?: (
      sellerShortname: string,
      orderShortname: string,
      newState: string,
    ) => void;
  }

  let {
    isOpen = $bindable(false),
    combinedOrder,
    onClose,
    onStateChange,
  }: Props = $props();

  const orderStates = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "confirm_delivery",
    "delivered",
    "cancelled",
    "returned",
  ];

  async function handleStateChange(
    sellerShortname: string,
    orderShortname: string,
    newState: string,
  ) {
    try {
      const success = await updateOrderState(
        website.main_space,
        sellerShortname,
        orderShortname,
        newState,
      );

      if (success) {
        successToastMessage("Order state updated successfully");
        if (onStateChange) {
          onStateChange(sellerShortname, orderShortname, newState);
        }
      } else {
        errorToastMessage("Failed to update order state");
      }
    } catch (error) {
      console.error("Error updating order state:", error);
      errorToastMessage("An error occurred while updating order");
    }
  }

  function handleClose() {
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
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
      confirmed: "processing",
      processing: "processing",
      shipped: "shipped",
      out_for_delivery: "shipped",
      confirm_delivery: "delivered",
      delivered: "delivered",
      cancelled: "cancelled",
      returned: "cancelled",
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
</script>

{#if isOpen}
  <div class="modal-overlay" onclick={handleBackdropClick}>
    <div class="modal-container">
      <div class="modal-header">
        <div class="header-title">
          <h2>
            {$_("admin.combined_order_details") || "Combined Order Details"}
          </h2>
          {#if combinedOrder}
            {@const payload = combinedOrder.attributes?.payload?.body}
            <div class="order-code-badge">
              <code
                >#{payload?.combined_order_id || combinedOrder.shortname}</code
              >
            </div>
          {/if}
        </div>
        <button class="close-button" onclick={handleClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        {#if combinedOrder}
          {@const payload = combinedOrder.attributes?.payload?.body}
          {@const customerShortname = payload?.user_shortname}
          {@const individualOrders = combinedOrder.individualOrders || []}
          {@const isLoadingOrders = combinedOrder.isLoadingOrders || false}

          <!-- Combined Order Summary -->
          <div class="section">
            <div class="section-header-inline">
              <h3>{$_("admin.order_information") || "Order Information"}</h3>
              <div
                class="payment-badge {getPaymentStatusColor(
                  payload?.payment_status || 'pending',
                )}"
              >
                {payload?.payment_status || "pending"}
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.order_id") || "Order ID"}</span
                >
                <span class="info-value">
                  <strong>#{payload?.combined_order_id || "N/A"}</strong>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.order_date") || "Order Date"}</span
                >
                <span class="info-value"
                  >{formatDate(combinedOrder.attributes.created_at)}</span
                >
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.customer") || "Customer"}</span
                >
                <span class="info-value">
                  <strong>{customerShortname || "N/A"}</strong>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.order_from") || "Order From"}</span
                >
                <span class="info-value">
                  {payload?.order_from || "-"}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.payment_type") || "Payment Type"}</span
                >
                <span class="info-value">{payload?.payment_type || "-"}</span>
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.total_amount") || "Total Amount"}</span
                >
                <span class="info-value">
                  <strong
                    >{(payload?.total_amount || 0).toLocaleString()}
                    {$_("admin.currency") || "IQD"}</strong
                  >
                </span>
              </div>
            </div>
          </div>

          <!-- Individual Seller Orders -->
          {#if isLoadingOrders}
            <div class="section">
              <h3>
                {$_("admin.individual_orders") || "Individual Seller Orders"}
              </h3>
              <div class="loading-orders">
                <div class="spinner-inline"></div>
                <p>Loading individual orders...</p>
              </div>
            </div>
          {:else if individualOrders.length > 0}
            <div class="section">
              <h3>
                {$_("admin.individual_orders") || "Individual Seller Orders"} ({individualOrders.length})
              </h3>

              {#each individualOrders as order, index}
                {@const orderPayload = order.attributes?.payload?.body}
                {@const orderState = order.attributes?.state || "pending"}
                {@const itemsTotal =
                  orderPayload?.items?.reduce(
                    (sum, item) => sum + (item.subtotal || 0),
                    0,
                  ) || 0}
                {@const shippingCost = orderPayload?.shipping?.cost || 0}
                {@const couponDiscount =
                  orderPayload?.coupon?.discount_amount || 0}
                {@const orderTotal = itemsTotal + shippingCost - couponDiscount}

                <div class="order-card">
                  <div class="order-card-header">
                    <div class="order-card-title">
                      <span class="order-number">#{index + 1}</span>
                      <div>
                        <div class="seller-name">
                          {$_("admin.seller") || "Seller"}:
                          <strong>{order.seller_shortname}</strong>
                        </div>
                        <div class="order-shortname">{order.shortname}</div>
                      </div>
                    </div>
                    <div class="order-card-status">
                      <span class="status-badge {getStatusColor(orderState)}">
                        <svg viewBox="0 0 8 8" fill="currentColor">
                          <circle cx="4" cy="4" r="3" />
                        </svg>
                        {orderState}
                      </span>
                      <select
                        class="state-select-inline"
                        value={orderState}
                        onchange={(e) =>
                          handleStateChange(
                            order.seller_shortname,
                            order.shortname,
                            e.currentTarget.value,
                          )}
                      >
                        {#each orderStates as state}
                          <option value={state}>{state}</option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <!-- Order Items -->
                  {#if orderPayload?.items && orderPayload.items.length > 0}
                    <div class="order-items-list">
                      {#each orderPayload.items as item, itemIndex}
                        <div class="order-item">
                          <div class="item-row">
                            <span class="item-number">{itemIndex + 1}</span>
                            <div class="item-details">
                              <div class="item-name">
                                {item.product_shortname || item.sku}
                              </div>
                              <div class="item-sku">SKU: {item.sku}</div>
                              {#if item.options && item.options.length > 0}
                                <div class="item-options">
                                  {#each item.options as option}
                                    <span class="option-badge"
                                      >{option.variation_shortname}</span
                                    >
                                  {/each}
                                </div>
                              {/if}
                            </div>
                            <div class="item-quantity">×{item.quantity}</div>
                            <div class="item-price">
                              {(item.subtotal || 0).toLocaleString()} IQD
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <!-- Order Summary -->
                  <div class="order-summary">
                    <div class="summary-row">
                      <span>{$_("admin.items_subtotal") || "Items"}</span>
                      <span
                        >{itemsTotal.toLocaleString()}
                        {$_("admin.currency") || "IQD"}</span
                      >
                    </div>
                    {#if shippingCost > 0}
                      <div class="summary-row">
                        <span>{$_("admin.shipping") || "Shipping"}</span>
                        <span
                          >{shippingCost.toLocaleString()}
                          {$_("admin.currency") || "IQD"}</span
                        >
                      </div>
                    {/if}
                    {#if couponDiscount > 0}
                      <div class="summary-row discount">
                        <span>{$_("admin.discount") || "Discount"}</span>
                        <span
                          >-{couponDiscount.toLocaleString()}
                          {$_("admin.currency") || "IQD"}</span
                        >
                      </div>
                    {/if}
                    <div class="summary-row total">
                      <span>{$_("admin.total") || "Total"}</span>
                      <span
                        >{orderTotal.toLocaleString()}
                        {$_("admin.currency") || "IQD"}</span
                      >
                    </div>
                  </div>

                  <!-- Shipping Info -->
                  {#if orderPayload?.shipping}
                    <div class="shipping-info">
                      <div class="shipping-label">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                          />
                          <path
                            d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"
                          />
                        </svg>
                        {$_("admin.shipping_information") ||
                          "Shipping Information"}
                      </div>
                      <div class="shipping-details">
                        Delivery: {orderPayload.shipping.min}-{orderPayload
                          .shipping.max} days
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <p>No individual orders found for this combined order</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-container {
    background: white;
    border-radius: 1rem;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-title h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  .order-code-badge {
    padding: 0.375rem 0.75rem;
    background: #f3f4f6;
    border-radius: 0.5rem;
  }

  .order-code-badge code {
    font-size: 0.875rem;
    color: #374151;
    font-family: "Monaco", "Courier New", monospace;
  }

  .close-button {
    width: 40px;
    height: 40px;
    border-radius: 0.5rem;
    border: none;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #e5e7eb;
    color: #111827;
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section h3 {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  .section-header-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .section-header-inline h3 {
    margin: 0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.8125rem;
    color: #6b7280;
    font-weight: 500;
  }

  .info-value {
    font-size: 0.9375rem;
    color: #111827;
    font-weight: 500;
  }

  .payment-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .payment-badge.paid {
    background: #d1fae5;
    color: #065f46;
  }

  .payment-badge.pending {
    background: #fef3c7;
    color: #92400e;
  }

  .payment-badge.failed {
    background: #fee2e2;
    color: #991b1b;
  }

  .customer-card {
    background: #f9fafb;
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .customer-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .customer-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .customer-avatar svg {
    width: 28px;
    height: 28px;
  }

  .customer-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  .customer-id {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .customer-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #374151;
  }

  .detail-row svg {
    width: 18px;
    height: 18px;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .order-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  .order-card:last-child {
    margin-bottom: 0;
  }

  .order-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .order-card-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .order-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #281f51;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .seller-name {
    font-size: 0.9375rem;
    color: #374151;
  }

  .order-shortname {
    font-size: 0.8125rem;
    color: #6b7280;
    font-family: monospace;
  }

  .order-card-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-badge svg {
    width: 8px;
    height: 8px;
  }

  .status-badge.pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-badge.processing {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-badge.shipped {
    background: #e0e7ff;
    color: #5b21b6;
  }

  .status-badge.delivered {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.cancelled {
    background: #fee2e2;
    color: #991b1b;
  }

  .state-select-inline {
    padding: 0.375rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    background: white;
    cursor: pointer;
  }

  .state-select-inline:hover {
    border-color: #9ca3af;
  }

  .order-items-list {
    margin-bottom: 1rem;
  }

  .order-item {
    background: white;
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .order-item:last-child {
    margin-bottom: 0;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .item-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #e0e7ff;
    color: #4338ca;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .item-details {
    flex: 1;
  }

  .item-name {
    font-weight: 600;
    color: #111827;
    font-size: 0.875rem;
  }

  .item-sku {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .item-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .option-badge {
    padding: 0.125rem 0.5rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: #374151;
  }

  .item-quantity {
    font-weight: 600;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .item-price {
    font-weight: 600;
    color: #111827;
    font-size: 0.875rem;
  }

  .order-summary {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.375rem 0;
    font-size: 0.875rem;
    color: #374151;
  }

  .summary-row.discount {
    color: #dc2626;
  }

  .summary-row.total {
    font-weight: 700;
    color: #111827;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
    margin-top: 0.5rem;
  }

  .shipping-info {
    background: white;
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .shipping-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .shipping-label svg {
    width: 18px;
    height: 18px;
    color: #6b7280;
  }

  .shipping-details {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  .loading-orders {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .loading-orders p {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .spinner-inline {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #281f51;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .modal-overlay {
      padding: 1rem;
    }

    .modal-header {
      padding: 1rem 1.5rem;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .header-title {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .order-card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .order-card-status {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>

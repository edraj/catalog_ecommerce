<script lang="ts">
  import { _ } from "@/i18n";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { website } from "@/config";

  interface Props {
    isOpen: boolean;
    orderShortname: string;
    sellerShortname: string;
    onClose: () => void;
  }

  let {
    isOpen = $bindable(false),
    orderShortname,
    sellerShortname,
    onClose,
  }: Props = $props();

  let orderDetails = $state<any>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (isOpen && orderShortname && sellerShortname) {
      loadOrderDetails();
    }
  });

  async function loadOrderDetails() {
    isLoading = true;
    error = null;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `orders/${sellerShortname}`,
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        const record = response.records.find(
          (r) => r.shortname === orderShortname,
        );

        if (record) {
          const body = record.attributes?.payload?.body;
          const itemsTotal =
            body.items?.reduce((sum, item) => sum + (item.subtotal || 0), 0) ||
            0;
          const shippingCost = body.shipping?.cost || 0;
          const couponDiscount = body.coupon?.discount_amount || 0;
          const totalAmount = itemsTotal + shippingCost - couponDiscount;

          orderDetails = {
            ...record,
            body,
            calculated_total: totalAmount,
            items_subtotal: itemsTotal,
            shipping_cost: shippingCost,
            coupon_discount: couponDiscount,
          };
        } else {
          error = "Order not found";
        }
      }
    } catch (err) {
      console.error("Error loading order details:", err);
      error = "Failed to load order details";
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    orderDetails = null;
    error = null;
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
</script>

{#if isOpen}
  <div class="modal-overlay" onclick={handleBackdropClick}>
    <div class="modal-container">
      <div class="modal-header">
        <div class="header-title">
          <h2>{$_("admin.order_details") || "Order Details"}</h2>
          {#if orderDetails}
            <div class="order-code-badge">
              <code>{orderDetails.body.order_code}</code>
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
        {#if isLoading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{$_("common.loading") || "Loading order details..."}</p>
          </div>
        {:else if error}
          <div class="error-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2" />
              <path
                d="M12 8v4M12 16h.01"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <p>{error}</p>
          </div>
        {:else if orderDetails}
          <!-- Order Status Section -->
          <div class="section">
            <div class="section-header-inline">
              <h3>{$_("admin.order_status") || "Order Status"}</h3>
              <div class="status-badges">
                <div
                  class="status-badge"
                  class:pending={getStatusColor(
                    orderDetails.attributes.state,
                  ) === "pending"}
                  class:processing={getStatusColor(
                    orderDetails.attributes.state,
                  ) === "processing"}
                  class:shipped={getStatusColor(
                    orderDetails.attributes.state,
                  ) === "shipped"}
                  class:delivered={getStatusColor(
                    orderDetails.attributes.state,
                  ) === "delivered"}
                  class:cancelled={getStatusColor(
                    orderDetails.attributes.state,
                  ) === "cancelled"}
                >
                  <svg viewBox="0 0 8 8" fill="currentColor">
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  {orderDetails.attributes.state.charAt(0).toUpperCase() +
                    orderDetails.attributes.state.slice(1)}
                </div>
                <div
                  class="payment-badge"
                  class:paid={getPaymentStatusColor(
                    orderDetails.body.payment_status,
                  ) === "paid"}
                  class:pending={getPaymentStatusColor(
                    orderDetails.body.payment_status,
                  ) === "pending"}
                  class:failed={getPaymentStatusColor(
                    orderDetails.body.payment_status,
                  ) === "failed"}
                  class:refunded={getPaymentStatusColor(
                    orderDetails.body.payment_status,
                  ) === "refunded"}
                >
                  {orderDetails.body.payment_status.charAt(0).toUpperCase() +
                    orderDetails.body.payment_status.slice(1)}
                </div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.order_date") || "Order Date"}</span
                >
                <span class="info-value"
                  >{formatDate(orderDetails.attributes.created_at)}</span
                >
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.tracking_code") || "Tracking Code"}</span
                >
                <span class="info-value">
                  <code>{orderDetails.body.tracking_code || "-"}</code>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.payment_type") || "Payment Type"}</span
                >
                <span class="info-value"
                  >{orderDetails.body.payment_type || "-"}</span
                >
              </div>
              <div class="info-item">
                <span class="info-label"
                  >{$_("admin.order_from") || "Order From"}</span
                >
                <span class="info-value"
                  >{orderDetails.body.order_from || "-"}</span
                >
              </div>
            </div>
          </div>

          <!-- Customer Information -->
          <div class="section">
            <h3>
              {$_("admin.customer_information") || "Customer Information"}
            </h3>
            <div class="customer-card">
              <div class="customer-header">
                <div class="customer-avatar">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                    />
                  </svg>
                </div>
                <div>
                  <div class="customer-name">
                    {orderDetails.body.user.displayname ||
                      orderDetails.body.user.shortname}
                  </div>
                  <div class="customer-id">
                    @{orderDetails.body.user.shortname}
                  </div>
                </div>
              </div>
              <div class="customer-details">
                {#if orderDetails.body.user.phone}
                  <div class="detail-row">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
                      />
                    </svg>
                    <span>{orderDetails.body.user.phone}</span>
                  </div>
                {/if}
                {#if orderDetails.body.user.email}
                  <div class="detail-row">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                      />
                      <path
                        d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                      />
                    </svg>
                    <span>{orderDetails.body.user.email}</span>
                  </div>
                {/if}
                {#if orderDetails.body.user.address}
                  <div class="detail-row">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span>{orderDetails.body.user.address}</span>
                  </div>
                {/if}
                {#if orderDetails.body.user.state}
                  <div class="detail-row">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span>{orderDetails.body.user.state}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- Order Items -->
          <div class="section">
            <h3>{$_("admin.order_items") || "Order Items"}</h3>
            <div class="items-list">
              {#each orderDetails.body.items as item, index}
                <div class="item-card">
                  <div class="item-header">
                    <div class="item-index">{index + 1}</div>
                    <div class="item-info">
                      <div class="item-name">
                        {item.product_shortname || item.sku}
                      </div>
                      <div class="item-sku">SKU: {item.sku}</div>
                    </div>
                    <div class="item-quantity">
                      <span class="quantity-label">×{item.quantity}</span>
                    </div>
                  </div>

                  {#if item.options && item.options.length > 0}
                    <div class="item-options">
                      {#each item.options as option}
                        <span class="option-badge"
                          >{option.variation_shortname}</span
                        >
                      {/each}
                    </div>
                  {/if}

                  <div class="item-pricing">
                    <div class="pricing-row">
                      <span>{$_("admin.price") || "Price"}</span>
                      <span
                        >{item.price_at_purchase?.toLocaleString()}
                        {$_("admin.currency") || "IQD"}</span
                      >
                    </div>
                    {#if item.discount && item.discount.value > 0}
                      <div class="pricing-row discount">
                        <span>{$_("admin.discount") || "Discount"}</span>
                        <span>
                          -{item.discount.value}
                          {item.discount.type === "percentage"
                            ? "%"
                            : $_("admin.currency") || "IQD"}
                        </span>
                      </div>
                    {/if}
                    <div class="pricing-row total">
                      <span>{$_("admin.subtotal") || "Subtotal"}</span>
                      <span
                        >{item.subtotal?.toLocaleString()}
                        {$_("admin.currency") || "IQD"}</span
                      >
                    </div>
                  </div>

                  <div class="item-meta">
                    <span class="meta-tag">{item.brand_shortname || "-"}</span>
                    <span class="meta-tag"
                      >{item.main_category_shortname || "-"}</span
                    >
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Shipping Information -->
          {#if orderDetails.body.shipping}
            <div class="section">
              <h3>
                {$_("admin.shipping_information") || "Shipping Information"}
              </h3>
              <div class="shipping-card">
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label"
                      >{$_("admin.shipping_cost") || "Shipping Cost"}</span
                    >
                    <span class="info-value"
                      >{orderDetails.shipping_cost.toLocaleString()}
                      {$_("admin.currency") || "IQD"}</span
                    >
                  </div>
                  <div class="info-item">
                    <span class="info-label"
                      >{$_("admin.delivery_time") || "Delivery Time"}</span
                    >
                    <span class="info-value"
                      >{orderDetails.body.shipping.min}-{orderDetails.body
                        .shipping.max}
                      {$_("admin.days") || "days"}</span
                    >
                  </div>
                  {#if orderDetails.body.shipping.minimum_retail}
                    <div class="info-item">
                      <span class="info-label"
                        >{$_("admin.minimum_order") || "Minimum Order"}</span
                      >
                      <span class="info-value"
                        >{orderDetails.body.shipping.minimum_retail.toLocaleString()}
                        {$_("admin.currency") || "IQD"}</span
                      >
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          <!-- Coupon Information -->
          {#if orderDetails.body.coupon}
            <div class="section">
              <h3>{$_("admin.coupon_applied") || "Coupon Applied"}</h3>
              <div class="coupon-card">
                <div class="coupon-code">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z"
                      clip-rule="evenodd"
                    />
                    <path
                      d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"
                    />
                  </svg>
                  <code>{orderDetails.body.coupon.code}</code>
                </div>
                <div class="coupon-details">
                  <div class="detail-row">
                    <span>{$_("admin.discount_type") || "Discount Type"}</span>
                    <span>{orderDetails.body.coupon.discount_type}</span>
                  </div>
                  <div class="detail-row">
                    <span>{$_("admin.discount_value") || "Discount Value"}</span
                    >
                    <span>
                      {orderDetails.body.coupon.discount_value}
                      {orderDetails.body.coupon.discount_type === "percentage"
                        ? "%"
                        : $_("admin.currency") || "IQD"}
                    </span>
                  </div>
                  <div class="detail-row total">
                    <span>{$_("admin.total_discount") || "Total Discount"}</span
                    >
                    <span
                      >{orderDetails.coupon_discount.toLocaleString()}
                      {$_("admin.currency") || "IQD"}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Order Summary -->
          <div class="section summary-section">
            <h3>{$_("admin.order_summary") || "Order Summary"}</h3>
            <div class="summary-card">
              <div class="summary-row">
                <span>{$_("admin.items_subtotal") || "Items Subtotal"}</span>
                <span
                  >{orderDetails.items_subtotal.toLocaleString()}
                  {$_("admin.currency") || "IQD"}</span
                >
              </div>
              <div class="summary-row">
                <span>{$_("admin.shipping_cost") || "Shipping"}</span>
                <span
                  >{orderDetails.shipping_cost.toLocaleString()}
                  {$_("admin.currency") || "IQD"}</span
                >
              </div>
              {#if orderDetails.coupon_discount > 0}
                <div class="summary-row discount">
                  <span>{$_("admin.discount") || "Discount"}</span>
                  <span
                    >-{orderDetails.coupon_discount.toLocaleString()}
                    {$_("admin.currency") || "IQD"}</span
                  >
                </div>
              {/if}
              <div class="summary-divider"></div>
              <div class="summary-row total">
                <span>{$_("admin.total_amount") || "Total Amount"}</span>
                <span class="total-amount"
                  >{orderDetails.calculated_total.toLocaleString()}
                  {$_("admin.currency") || "IQD"}</span
                >
              </div>
            </div>
          </div>
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

  .status-badges {
    display: flex;
    gap: 0.5rem;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
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

  .payment-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 600;
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

  .payment-badge.refunded {
    background: #e0e7ff;
    color: #3730a3;
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

  .info-value code {
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    color: #374151;
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

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item-card {
    background: #f9fafb;
    border-radius: 0.75rem;
    padding: 1.25rem;
    border: 1px solid #e5e7eb;
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .item-index {
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
    flex-shrink: 0;
  }

  .item-info {
    flex: 1;
  }

  .item-name {
    font-weight: 600;
    color: #111827;
    font-size: 0.9375rem;
  }

  .item-sku {
    font-size: 0.8125rem;
    color: #6b7280;
    margin-top: 0.125rem;
  }

  .item-quantity {
    font-size: 1rem;
    font-weight: 600;
    color: #281f51;
  }

  .quantity-label {
    padding: 0.375rem 0.75rem;
    background: white;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .item-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .option-badge {
    padding: 0.25rem 0.625rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    color: #374151;
  }

  .item-pricing {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: white;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .pricing-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #374151;
  }

  .pricing-row.discount {
    color: #dc2626;
  }

  .pricing-row.total {
    font-weight: 600;
    color: #111827;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .item-meta {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .meta-tag {
    padding: 0.25rem 0.625rem;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .shipping-card,
  .coupon-card {
    background: #f9fafb;
    border-radius: 0.75rem;
    padding: 1.25rem;
    border: 1px solid #e5e7eb;
  }

  .coupon-code {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .coupon-code svg {
    width: 24px;
    height: 24px;
    color: #667eea;
  }

  .coupon-code code {
    padding: 0.5rem 1rem;
    background: white;
    border: 2px dashed #667eea;
    border-radius: 0.5rem;
    font-size: 1rem;
    color: #667eea;
    font-weight: 600;
  }

  .coupon-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-card {
    background: #f9fafb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    font-size: 0.9375rem;
    color: #374151;
  }

  .summary-row.discount {
    color: #dc2626;
  }

  .summary-row.total {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    padding-top: 1rem;
  }

  .summary-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 0.5rem 0;
  }

  .total-amount {
    color: #281f51;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
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

  .error-state svg {
    width: 48px;
    height: 48px;
    color: #dc2626;
  }

  .error-state p {
    color: #6b7280;
    text-align: center;
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
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import "@/routes/seller/orders/index.css";
  export let order;
  export let payment: any = null;
  export let combinedOrder: any = null;

  const dispatch = createEventDispatcher();

  $: payload = order.attributes.payload.body;
  $: orderTotal = calculateTotal();

  function calculateTotal(): number {
    if (!payload || !payload.items) return 0;
    const itemsTotal = payload.items.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    const shippingCost = payload.shipping?.cost || 0;
    const couponDiscount = payload.coupon?.discount_amount || 0;
    return itemsTotal + shippingCost - couponDiscount;
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  function close() {
    dispatch("close");
  }

  function changeState(newState: string) {
    dispatch("stateChange", newState);
  }

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
</script>

<div class="modal-overlay" on:click={close}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>Order Details</h2>
      <button class="btn-close" on:click={close}>&times;</button>
    </div>

    <div class="modal-body">
      <!-- Order Information -->
      <section class="section">
        <h3>Order Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Order Code</label>
            <span>{payload?.order_code || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Tracking Code</label>
            <span>{payload?.tracking_code || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Combined Order ID</label>
            <span>{payload?.combined_order_id || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Order From</label>
            <span>{payload?.order_from || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Created At</label>
            <span>{formatDate(order.attributes.created_at)}</span>
          </div>
          <div class="info-item">
            <label>Updated At</label>
            <span>{formatDate(order.attributes.updated_at)}</span>
          </div>
          {#if payload?.activated_at}
            <div class="info-item">
              <label>Activated At</label>
              <span>{formatDate(payload.activated_at)}</span>
            </div>
          {/if}
          <div class="info-item">
            <label>Status</label>
            <span class="badge badge-{order.attributes.state}">
              {order.attributes.state}
            </span>
          </div>
        </div>
      </section>

      <!-- Customer Information -->
      <section class="section">
        <h3>Customer Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Name</label>
            <span>{payload?.user?.displayname || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Phone</label>
            <span>{payload?.user?.phone || "N/A"}</span>
          </div>
          {#if payload?.user?.email}
            <div class="info-item">
              <label>Email</label>
              <span>{payload.user.email}</span>
            </div>
          {/if}
          <div class="info-item">
            <label>State/City</label>
            <span>{payload?.user?.state || "N/A"}</span>
          </div>
          <div class="info-item full-width">
            <label>Address</label>
            <span>{payload?.user?.address || "N/A"}</span>
          </div>
        </div>
      </section>

      <!-- Order Items -->
      <section class="section">
        <h3>Order Items ({payload?.items?.length || 0})</h3>
        <div class="items-table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Brand</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Discount</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {#each payload?.items || [] as item}
                <tr>
                  <td>
                    <div class="product-info">
                      <strong>{item.product_shortname}</strong>
                      {#if item.options && item.options.length > 0}
                        <small>
                          Options: {item.options
                            .map((opt) => opt.variation_shortname)
                            .join(", ")}
                        </small>
                      {/if}
                    </div>
                  </td>
                  <td><code>{item.sku}</code></td>
                  <td>{item.brand_shortname}</td>
                  <td>{formatCurrency(item.price_at_purchase)} IQD</td>
                  <td class="text-center">{item.quantity}</td>
                  <td>
                    {#if item.discount.value > 0}
                      <span class="discount">
                        {item.discount.type === "percentage"
                          ? `${item.discount.value}%`
                          : `${formatCurrency(item.discount.value)} IQD`}
                      </span>
                    {:else}
                      -
                    {/if}
                  </td>
                  <td class="text-right">
                    <strong>{formatCurrency(item.subtotal)} IQD</strong>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Shipping Information -->
      <section class="section">
        <h3>Shipping Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Shipping Key</label>
            <span>{payload?.shipping?.key || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Shipping Cost</label>
            <span>{formatCurrency(payload?.shipping?.cost || 0)} IQD</span>
          </div>
          <div class="info-item">
            <label>Estimated Delivery</label>
            <span
              >{payload?.shipping?.min || 0} - {payload?.shipping?.max || 0} days</span
            >
          </div>
          <div class="info-item">
            <label>Minimum Retail</label>
            <span
              >{formatCurrency(payload?.shipping?.minimum_retail || 0)} IQD</span
            >
          </div>
        </div>
      </section>

      <!-- Payment Information -->
      <section class="section">
        <h3>Payment Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Payment Type</label>
            <span>{payload?.payment_type || "N/A"}</span>
          </div>
          <div class="info-item">
            <label>Payment Status</label>
            <span class="badge badge-{payload?.payment_status || 'pending'}">
              {payload?.payment_status || "pending"}
            </span>
          </div>
          {#if payload?.payment_transaction_id}
            <div class="info-item">
              <label>Transaction ID</label>
              <span><code>{payload.payment_transaction_id}</code></span>
            </div>
          {/if}
          {#if payment}
            {@const paymentBody = payment.attributes.payload.body}
            <div class="info-item">
              <label>Amount Paid</label>
              <span
                >{formatCurrency(paymentBody.amount)}
                {paymentBody.currency}</span
              >
            </div>
            {#if paymentBody.completed_at}
              <div class="info-item">
                <label>Completed At</label>
                <span>{formatDate(paymentBody.completed_at)}</span>
              </div>
            {/if}
            {#if paymentBody.failed_at}
              <div class="info-item">
                <label>Failed At</label>
                <span>{formatDate(paymentBody.failed_at)}</span>
              </div>
            {/if}
            {#if paymentBody.failure_reason}
              <div class="info-item full-width">
                <label>Failure Reason</label>
                <span class="error-text">{paymentBody.failure_reason}</span>
              </div>
            {/if}
          {/if}
        </div>
      </section>

      <!-- Coupon Information -->
      {#if payload?.coupon}
        <section class="section">
          <h3>Coupon Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Coupon Code</label>
              <span><code>{payload.coupon.code}</code></span>
            </div>
            <div class="info-item">
              <label>Coupon Type</label>
              <span>{payload.coupon.type}</span>
            </div>
            <div class="info-item">
              <label>Discount Type</label>
              <span>{payload.coupon.discount_type}</span>
            </div>
            <div class="info-item">
              <label>Discount Value</label>
              <span>
                {payload.coupon.discount_type === "percentage"
                  ? `${payload.coupon.discount_value}%`
                  : `${formatCurrency(payload.coupon.discount_value)} IQD`}
              </span>
            </div>
            <div class="info-item">
              <label>Discount Amount</label>
              <span class="discount-amount">
                -{formatCurrency(payload.coupon.discount_amount)} IQD
              </span>
            </div>
            <div class="info-item">
              <label>For Shipping</label>
              <span>{payload.coupon.is_shipping ? "Yes" : "No"}</span>
            </div>
          </div>
        </section>
      {/if}

      <!-- Order Summary -->
      <section class="section">
        <h3>Order Summary</h3>
        <div class="summary-grid">
          <div class="summary-row">
            <span>Items Subtotal</span>
            <span>
              {formatCurrency(
                payload?.items?.reduce((sum, item) => sum + item.subtotal, 0) ||
                  0,
              )} IQD
            </span>
          </div>
          <div class="summary-row">
            <span>Shipping Cost</span>
            <span>{formatCurrency(payload?.shipping?.cost || 0)} IQD</span>
          </div>
          {#if payload?.coupon}
            <div class="summary-row discount">
              <span>Coupon Discount</span>
              <span>-{formatCurrency(payload.coupon.discount_amount)} IQD</span>
            </div>
          {/if}
          <div class="summary-row total">
            <span>Total</span>
            <span>{formatCurrency(orderTotal)} IQD</span>
          </div>
        </div>
      </section>

      <!-- Additional Info -->
      {#if payload?.info}
        <section class="section">
          <h3>Additional Notes</h3>
          <p class="notes">{payload.info}</p>
        </section>
      {/if}

      <!-- Change State Section -->
      <section class="section">
        <h3>Change Order State</h3>
        <div class="state-change">
          <p class="current-state">
            Current State: <span class="badge badge-{order.attributes.state}">
              {order.attributes.state}
            </span>
          </p>
          <div class="state-buttons">
            {#each orderStates as state}
              {#if state !== order.attributes.state}
                <button class="btn-state" on:click={() => changeState(state)}>
                  {state.replace(/_/g, " ")}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      </section>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" on:click={close}>Close</button>
    </div>
  </div>
</div>

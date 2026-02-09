<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    createOrderComment,
    deleteComment,
    getOrderDetails,
    progressOrderTicket,
  } from "@/lib/dmart_services";
  import { website } from "@/config";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import "@/routes/seller/orders/index.css";

  export let order;
  export let payment: any = null;
  export let combinedOrder: any = null;
  export let sellerShortname: string = "";

  const dispatch = createEventDispatcher();

  $: payload = order?.attributes?.payload?.body;
  $: orderTotal = calculateTotal();

  const orderWorkflow = {
    name: "order_processing",
    states: [
      {
        name: "Pending",
        state: "pending",
        next: [
          {
            roles: ["super_admin"],
            state: "confirmed",
            action: "confirm",
          },
          {
            roles: ["super_admin", "zm_customer", "customer"],
            state: "customer_cancelled",
            action: "customer_cancel",
          },
        ],
      },
      {
        name: "Confirmed",
        state: "confirmed",
        next: [
          {
            roles: ["super_admin"],
            state: "processing",
            action: "start_processing",
          },
          {
            roles: ["super_admin"],
            state: "pending",
            action: "move_to_pending",
          },
        ],
      },
      {
        name: "Processing",
        state: "processing",
        next: [
          {
            roles: ["super_admin"],
            state: "delivered",
            action: "mark_delivered",
          },
          {
            roles: ["super_admin"],
            state: "confirmed",
            action: "move_to_confirmed",
          },
        ],
      },
      {
        name: "Delivered",
        state: "delivered",
        next: [
          {
            roles: ["super_admin"],
            state: "delivery_confirmed",
            action: "confirm_delivery",
          },
          {
            roles: ["super_admin"],
            state: "issue_reported",
            action: "report_issue",
          },
        ],
      },
      {
        name: "Delivery Confirmed",
        state: "delivery_confirmed",
      },
      {
        name: "Issue Reported",
        state: "issue_reported",
        next: [
          {
            roles: ["super_admin"],
            state: "processing",
            action: "process_replacement",
          },
          {
            roles: ["super_admin"],
            state: "refund_pending",
            action: "process_refund",
          },
          {
            roles: ["super_admin"],
            state: "resolved",
            action: "resolve_issue",
          },
          {
            roles: ["super_admin"],
            state: "cancel",
            action: "cancel",
          },
          {
            roles: ["super_admin"],
            state: "delivered",
            action: "reject_issue",
          },
        ],
      },
      {
        name: "Refund Pending",
        state: "refund_pending",
        next: [
          {
            roles: ["super_admin"],
            state: "refunded",
            action: "complete_refund",
          },
        ],
      },
      {
        name: "Refunded",
        state: "refunded",
      },
      {
        name: "Resolved",
        state: "resolved",
      },
      {
        name: "Customer Cancelled",
        state: "cancel",
        next: [
          {
            roles: ["super_admin"],
            state: "refund_pending",
            action: "process_cancellation_refund",
          },
        ],
      },
      {
        name: "Customer Cancel",
        state: "customer_cancelled",
        resolutions: [
          {
            en: "No agreement",
            key: "no_agreement",
          },
          {
            en: "Price issue",
            key: "price_issue",
          },
          {
            en: "Changed mind",
            key: "changed_mind",
          },
          {
            en: "Duplicate order",
            key: "duplicate_order",
          },
          {
            en: "Others",
            key: "others",
          },
        ],
      },
    ],
  };

  let progressComment = "";
  let commentText = "";
  let commentState = "general";
  let commentLoading = false;
  let commentDeleteLoading: Record<string, boolean> = {};
  let pendingCancellation: { reasonKey: string; reasonLabel: string } | null =
    null;
  let orderState = "pending";
  let transitions: Array<{ action: string; state: string }> = [];
  let orderComments: any[] = [];
  let combinedOrderId = "";

  $: if (
    order?.attributes?.state &&
    commentState === "general" &&
    !commentText
  ) {
    commentState = order.attributes.state;
  }
  $: orderState = order?.attributes?.state || "pending";
  $: transitions = getTransitions(orderState);
  $: orderComments = order?.attachments?.comment || [];
  $: combinedOrderId =
    combinedOrder?.shortname || payload?.combined_order_id || "N/A";

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

  async function refreshOrderDetails() {
    if (!order?.shortname || !sellerShortname) return;
    const refreshed = await getOrderDetails(
      website.main_space,
      sellerShortname,
      order.shortname,
      true,
    );
    if (refreshed) {
      order.attributes = refreshed.attributes;
      order.attachments = refreshed.attachments;
    }
  }

  onMount(async () => {
    await refreshOrderDetails();
  });

  function close() {
    dispatch("close");
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      close();
    }
  }

  function getWorkflowState(state: string) {
    return orderWorkflow.states.find((item) => item.state === state);
  }

  function getStateLabel(state: string): string {
    return getWorkflowState(state)?.name || state;
  }

  function getTransitions(state: string) {
    return getWorkflowState(state)?.next || [];
  }

  function formatActionLabel(action: string, state: string): string {
    const label = action ? action.replace(/_/g, " ") : getStateLabel(state);
    return `${label} -> ${getStateLabel(state)}`;
  }

  function getCancellationResolutions() {
    return getWorkflowState("customer_cancelled")?.resolutions || [];
  }

  async function handleStateChange(
    action: string,
    targetState: string,
    additionalData?: any,
  ) {
    try {
      const success = await progressOrderTicket(
        website.main_space,
        sellerShortname,
        order.shortname,
        action,
        additionalData,
      );

      if (success) {
        if (progressComment.trim()) {
          await createOrderComment(
            website.main_space,
            sellerShortname,
            order.shortname,
            progressComment.trim(),
            targetState,
          );
        }

        await refreshOrderDetails();
        progressComment = "";
        successToastMessage("Order state updated successfully");
        dispatch("stateChange", targetState);
      } else {
        errorToastMessage("Failed to update order state");
      }
    } catch (error) {
      console.error("Error updating order state:", error);
      errorToastMessage("An error occurred while updating order");
    }
  }

  function handleStateSelect(action: string, targetState: string) {
    if (!action) return;
    if (targetState === "customer_cancelled") {
      pendingCancellation = { reasonKey: "", reasonLabel: "" };
      return;
    }
    pendingCancellation = null;
    handleStateChange(action, targetState);
  }

  function updateCancellationReason(reasonKey: string, reasonLabel: string) {
    pendingCancellation = { reasonKey, reasonLabel };
  }

  function confirmCancellation() {
    if (!pendingCancellation || !pendingCancellation.reasonKey) {
      errorToastMessage("Please select a cancellation reason");
      return;
    }
    handleStateChange("customer_cancel", "customer_cancelled", {
      resolution_reason: pendingCancellation.reasonKey,
      resolution_reason_label: pendingCancellation.reasonLabel,
    });
    pendingCancellation = null;
  }

  function getCommentStateOptions(): string[] {
    return ["general", ...orderWorkflow.states.map((state) => state.state)];
  }

  function groupCommentsByState(comments: any[]) {
    const groups: Record<string, any[]> = {};
    comments.forEach((comment) => {
      const state = comment.attributes?.payload?.body?.state || "general";
      if (!groups[state]) {
        groups[state] = [];
      }
      groups[state].push(comment);
    });
    return groups;
  }

  async function submitComment() {
    if (!commentText.trim()) {
      errorToastMessage("Please enter a comment");
      return;
    }

    commentLoading = true;
    try {
      const success = await createOrderComment(
        website.main_space,
        sellerShortname,
        order.shortname,
        commentText.trim(),
        commentState,
      );

      if (!success) {
        errorToastMessage("Failed to add comment");
        return;
      }

      await refreshOrderDetails();
      commentText = "";
      successToastMessage("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      errorToastMessage("Error adding comment");
    } finally {
      commentLoading = false;
    }
  }

  async function removeOrderComment(comment: any) {
    if (!comment?.shortname) {
      errorToastMessage("Comment could not be deleted");
      return;
    }

    const confirmed = window.confirm("Delete this comment?");
    if (!confirmed) return;

    commentDeleteLoading = {
      ...commentDeleteLoading,
      [comment.shortname]: true,
    };

    try {
      const success = await deleteComment(
        comment.shortname,
        website.main_space,
        `orders/${sellerShortname}`,
        order.shortname,
      );

      if (!success) {
        errorToastMessage("Failed to delete comment");
        return;
      }

      await refreshOrderDetails();
      successToastMessage("Comment deleted successfully");
    } catch (error) {
      console.error("Error deleting comment:", error);
      errorToastMessage("Error deleting comment");
    } finally {
      commentDeleteLoading = {
        ...commentDeleteLoading,
        [comment.shortname]: false,
      };
    }
  }
</script>

<div
  class="modal-overlay"
  role="button"
  tabindex="0"
  aria-label="Close modal"
  onclick={close}
  onkeydown={handleBackdropKeydown}
>
  <div
    class="modal-content"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="modal-header">
      <h2>Order Details</h2>
      <button class="btn-close" onclick={close}>&times;</button>
    </div>

    <div class="modal-body">
      <!-- Order Information -->
      <section class="section">
        <h3>Order Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Order Code</span>
            <span>{payload?.order_code || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Tracking Code</span>
            <span>{payload?.tracking_code || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Combined Order ID</span>
            <span>{combinedOrderId}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Order From</span>
            <span>{payload?.order_from || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Created At</span>
            <span>{formatDate(order.attributes.created_at)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Updated At</span>
            <span>{formatDate(order.attributes.updated_at)}</span>
          </div>
          {#if payload?.activated_at}
            <div class="info-item">
              <span class="info-label">Activated At</span>
              <span>{formatDate(payload.activated_at)}</span>
            </div>
          {/if}
          <div class="info-item">
            <span class="info-label">Status</span>
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
            <span class="info-label">Name</span>
            <span>{payload?.user?.displayname || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Phone</span>
            <span>{payload?.user?.phone || "N/A"}</span>
          </div>
          {#if payload?.user?.email}
            <div class="info-item">
              <span class="info-label">Email</span>
              <span>{payload.user.email}</span>
            </div>
          {/if}
          <div class="info-item">
            <span class="info-label">State/City</span>
            <span>{payload?.user?.state || "N/A"}</span>
          </div>
          <div class="info-item full-width">
            <span class="info-label">Address</span>
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
            <span class="info-label">Shipping Key</span>
            <span>{payload?.shipping?.key || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Shipping Cost</span>
            <span>{formatCurrency(payload?.shipping?.cost || 0)} IQD</span>
          </div>
          <div class="info-item">
            <span class="info-label">Estimated Delivery</span>
            <span
              >{payload?.shipping?.min || 0} - {payload?.shipping?.max || 0} days</span
            >
          </div>
          <div class="info-item">
            <span class="info-label">Minimum Retail</span>
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
            <span class="info-label">Payment Type</span>
            <span>{payload?.payment_type || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Payment Status</span>
            <span class="badge badge-{payload?.payment_status || 'pending'}">
              {payload?.payment_status || "pending"}
            </span>
          </div>
          {#if payload?.payment_transaction_id}
            <div class="info-item">
              <span class="info-label">Transaction ID</span>
              <span><code>{payload.payment_transaction_id}</code></span>
            </div>
          {/if}
          {#if payment}
            {@const paymentBody = payment.attributes.payload.body}
            <div class="info-item">
              <span class="info-label">Amount Paid</span>
              <span
                >{formatCurrency(paymentBody.amount)}
                {paymentBody.currency}</span
              >
            </div>
            {#if paymentBody.completed_at}
              <div class="info-item">
                <span class="info-label">Completed At</span>
                <span>{formatDate(paymentBody.completed_at)}</span>
              </div>
            {/if}
            {#if paymentBody.failed_at}
              <div class="info-item">
                <span class="info-label">Failed At</span>
                <span>{formatDate(paymentBody.failed_at)}</span>
              </div>
            {/if}
            {#if paymentBody.failure_reason}
              <div class="info-item full-width">
                <span class="info-label">Failure Reason</span>
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
              <span class="info-label">Coupon Code</span>
              <span><code>{payload.coupon.code}</code></span>
            </div>
            <div class="info-item">
              <span class="info-label">Coupon Type</span>
              <span>{payload.coupon.type}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Discount Type</span>
              <span>{payload.coupon.discount_type}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Discount Value</span>
              <span>
                {payload.coupon.discount_type === "percentage"
                  ? `${payload.coupon.discount_value}%`
                  : `${formatCurrency(payload.coupon.discount_value)} IQD`}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Discount Amount</span>
              <span class="discount-amount">
                -{formatCurrency(payload.coupon.discount_amount)} IQD
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">For Shipping</span>
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

      <!-- Workflow Progression -->
      <section class="section">
        <h3>Order Workflow</h3>
        <div class="state-change">
          <p class="current-state">
            Current State: <span class="badge badge-{orderState}">
              {getStateLabel(orderState)}
            </span>
          </p>
          <div class="state-actions">
            {#if transitions.length > 0}
              <select
                class="state-select-inline"
                onchange={(e) => {
                  const action = e.currentTarget.value;
                  const selected = transitions.find(
                    (transition) => transition.action === action,
                  );
                  if (selected) {
                    handleStateSelect(selected.action, selected.state);
                  }
                }}
              >
                <option value="">Change state...</option>
                {#each transitions as transition}
                  <option value={transition.action}>
                    {formatActionLabel(transition.action, transition.state)}
                  </option>
                {/each}
              </select>
            {:else}
              <span class="state-select-disabled">No actions</span>
            {/if}
          </div>
        </div>

        <div class="progress-comment">
          <label for="progress-comment">Progress Comment (optional)</label>
          <textarea
            id="progress-comment"
            rows="2"
            placeholder="Add a comment for this state change..."
            value={progressComment}
            oninput={(e) => (progressComment = e.currentTarget.value)}
          ></textarea>
        </div>

        {#if pendingCancellation}
          <div class="cancellation-reason">
            <label for="cancel-reason">Cancellation reason</label>
            <div class="cancellation-controls">
              <select
                id="cancel-reason"
                value={pendingCancellation.reasonKey}
                onchange={(e) =>
                  updateCancellationReason(
                    e.currentTarget.value,
                    e.currentTarget.selectedOptions?.[0]?.text || "",
                  )}
              >
                <option value="">Select reason...</option>
                {#each getCancellationResolutions() as reason}
                  <option value={reason.key}>{reason.en}</option>
                {/each}
              </select>
              <button class="btn-confirm-cancel" onclick={confirmCancellation}>
                Confirm Cancel
              </button>
            </div>
          </div>
        {/if}
      </section>

      <!-- Order Comments -->
      <section class="section">
        <h3>Comments</h3>
        <div class="comment-form">
          <div class="comment-form-row">
            <label for="comment-state">Comment State</label>
            <select
              id="comment-state"
              value={commentState}
              onchange={(e) => (commentState = e.currentTarget.value)}
            >
              {#each getCommentStateOptions() as stateOption}
                <option value={stateOption}>{getStateLabel(stateOption)}</option
                >
              {/each}
            </select>
          </div>
          <textarea
            rows="3"
            placeholder="Write a comment..."
            value={commentText}
            oninput={(e) => (commentText = e.currentTarget.value)}
          ></textarea>
          <button
            class="btn-comment"
            onclick={submitComment}
            disabled={commentLoading}
          >
            {commentLoading ? "Sending..." : "Add Comment"}
          </button>
        </div>

        {#if orderComments.length > 0}
          {@const commentGroups = groupCommentsByState(orderComments)}
          <div class="order-comments">
            {#each Object.entries(commentGroups) as [commentStateKey, comments]}
              <div class="comment-group">
                <div class="comment-group-title">
                  {commentStateKey === "general"
                    ? "General"
                    : getStateLabel(commentStateKey)}
                </div>
                {#each comments as comment}
                  <div class="comment-item">
                    <div class="comment-header">
                      <span class="comment-author">
                        {comment.attributes?.displayname?.en ||
                          comment.attributes?.owner_shortname ||
                          "Unknown"}
                      </span>
                      <div class="comment-actions">
                        <span class="comment-date">
                          {formatDate(comment.attributes?.created_at)}
                        </span>
                        <button
                          class="comment-delete"
                          type="button"
                          onclick={() => removeOrderComment(comment)}
                          disabled={commentDeleteLoading[comment.shortname]}
                        >
                          {commentDeleteLoading[comment.shortname]
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                    <p class="comment-text">
                      {comment.attributes?.payload?.body?.embedded ||
                        comment.attributes?.payload?.body?.body ||
                        "-"}
                    </p>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick={close}>Close</button>
    </div>
  </div>
</div>

<style>
  .state-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .state-select-inline {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    background: white;
    cursor: pointer;
  }

  .state-select-disabled {
    font-size: 0.8125rem;
    color: #9ca3af;
    font-weight: 600;
  }

  .progress-comment {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-comment label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }

  .progress-comment textarea {
    width: 100%;
    resize: vertical;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #d1d5db;
    font-size: 0.875rem;
    color: #111827;
  }

  .cancellation-reason {
    margin-top: 1rem;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 0.75rem;
    padding: 0.75rem;
  }

  .cancellation-reason label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #9a3412;
    margin-bottom: 0.5rem;
  }

  .cancellation-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .cancellation-controls select {
    flex: 1;
    min-width: 220px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #fdba74;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    color: #7c2d12;
  }

  .btn-confirm-cancel {
    padding: 0.5rem 0.75rem;
    background: #ea580c;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .comment-form {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .comment-form-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .comment-form-row label {
    font-size: 0.8125rem;
    color: #374151;
    font-weight: 600;
  }

  .comment-form-row select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  .comment-form textarea {
    width: 100%;
    resize: vertical;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #d1d5db;
    font-size: 0.875rem;
    color: #111827;
  }

  .btn-comment {
    align-self: flex-start;
    padding: 0.5rem 0.875rem;
    background: #281f51;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-comment:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .order-comments {
    margin-top: 1rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  .comment-group {
    margin-bottom: 1rem;
  }

  .comment-group-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.5rem;
  }

  .comment-item {
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    gap: 0.75rem;
  }

  .comment-author {
    font-weight: 600;
    color: #111827;
  }

  .comment-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .comment-date {
    color: #9ca3af;
  }

  .comment-delete {
    border: none;
    background: transparent;
    color: #b91c1c;
    font-weight: 600;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
  }

  .comment-delete:disabled {
    color: #9ca3af;
    cursor: not-allowed;
  }

  .comment-text {
    margin: 0;
    font-size: 0.8125rem;
    color: #374151;
  }

  .info-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 0.25rem;
  }
</style>

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

  let { order, payment = null, sellerShortname = "" } = $props();

  const dispatch = createEventDispatcher();

  let currentOrder = $state<any>(null);
  const orderAttributes = $derived(
    currentOrder?.attributes ?? currentOrder ?? {},
  );
  const payload = $derived(orderAttributes?.payload?.body);
  const orderTotal = $derived(calculateTotal());

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

  let progressComment = $state("");
  let commentText = $state("");
  let commentLoading = $state(false);
  let commentDeleteLoading = $state<Record<string, boolean>>({});
  let pendingCancellation = $state<{
    reasonKey: string;
    reasonLabel: string;
  } | null>(null);
  const orderState = $derived(orderAttributes?.state || "pending");
  const transitions = $derived(getTransitions(orderState));
  const orderComments = $derived(
    currentOrder?.attachments?.comment ||
      orderAttributes?.attachments?.comment ||
      [],
  );

  $effect(() => {
    if (order) {
      currentOrder = normalizeOrder(order);
    }
  });

  function normalizeOrder(source: any) {
    if (!source) return null;
    const attributes = source.attributes ?? source;
    const attachments = source.attachments ?? attributes?.attachments ?? {};
    return {
      ...source,
      attributes,
      attachments,
    };
  }

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
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  }

  async function refreshOrderDetails() {
    if (!currentOrder?.shortname || !sellerShortname) return;
    const refreshed = await getOrderDetails(
      website.main_space,
      sellerShortname,
      currentOrder.shortname,
      true,
    );
    if (refreshed) {
      currentOrder = normalizeOrder(refreshed);
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
    if (!currentOrder?.shortname) {
      errorToastMessage("Order data is incomplete");
      return;
    }
    try {
      const success = await progressOrderTicket(
        website.main_space,
        sellerShortname,
        currentOrder.shortname,
        action,
        additionalData,
      );

      if (success) {
        if (progressComment.trim()) {
          await createOrderComment(
            website.main_space,
            sellerShortname,
            currentOrder.shortname,
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
    if (!currentOrder?.shortname) {
      errorToastMessage("Order data is incomplete");
      return;
    }
    if (!commentText.trim()) {
      errorToastMessage("Please enter a comment");
      return;
    }

    commentLoading = true;
    try {
      const success = await createOrderComment(
        website.main_space,
        sellerShortname,
        currentOrder.shortname,
        commentText.trim(),
        "general",
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
    if (!currentOrder?.shortname) {
      errorToastMessage("Order data is incomplete");
      return;
    }
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
        currentOrder.shortname,
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
  class="modern-modal-overlay"
  role="button"
  tabindex="0"
  aria-label="Close modal"
  onclick={close}
  onkeydown={handleBackdropKeydown}
>
  <div
    class="modern-modal-content"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="modern-modal-header">
      <h2>Order Details</h2>
      <button class="btn-close" onclick={close}>&times;</button>
    </div>

    <div class="modern-modal-body">
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
            <span>{payload?.combined_order_id || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Order From</span>
            <span>{payload?.order_from || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Created At</span>
            <span>{formatDate(orderAttributes?.created_at)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Updated At</span>
            <span>{formatDate(orderAttributes?.updated_at)}</span>
          </div>
          {#if payload?.activated_at}
            <div class="info-item">
              <span class="info-label">Activated At</span>
              <span>{formatDate(payload.activated_at)}</span>
            </div>
          {/if}
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="badge badge-{orderState}">{orderState}</span>
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

    <div class="modern-modal-footer">
      <button class="btn-secondary" onclick={close}>Close</button>
    </div>
  </div>
</div>
<style>
  /* Overlay + container */
  .modern-modal-overlay {
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

  .modern-modal-container {
    background: white;
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: slideUp 0.3s ease;
    overflow: hidden;
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

  /* Header (Figma) */
  .modern-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modern-modal-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .modern-modal-title {
    margin: 0;
    font-weight: 500;
    font-size: 18px;
    line-height: 28px;
    letter-spacing: 0;
    color: #111827;
  }

  .modern-modal-subtitle {
    font-weight: 400;
    font-size: 10px;
    line-height: 24px;
    letter-spacing: 0;
    color: #4a5565;
  }

  .close-button {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .close-button:hover {
    background: #e5e7eb;
    color: #111827;
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .modern-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    height:70vh;
    flex: 1;
    background: #ffffff;
  }

  /* Section title */
  .section-title {
    margin: 16px 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: #111827;
  }

  /* Order summary (Figma) */
  .order-summary-block {
    width: 100%;
    padding-top: 8px;
    padding-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .order-summary-header {
    width: 100%;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .order-summary-title {
    font-weight: 500;
    font-size: 18px;
    line-height: 28px;
    color: #111827;
  }

  .order-summary-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 6px; /* rounded-sm */
    border-width: 1px;
    border-style: solid;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .order-summary-statuses {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .status-stack {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .status-label {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .order-summary-status.paid {
    background: #ecfdf5;
    border-color: #a4f4cf;
    color: #065f46;
  }

  .order-summary-status.pending {
    background: #fffbeb;
    border-color: #fdc700;
    color: #92400e;
  }

  .order-summary-status.failed {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .order-summary-status.refunded {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #3730a3;
  }

  .order-summary-status.order-status.pending {
    background: #fffbeb;
    border-color: #fdc700;
    color: #92400e;
  }

  .order-summary-status.order-status.processing {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1e40af;
  }

  .order-summary-status.order-status.shipped {
    background: #e0e7ff;
    border-color: #c7d2fe;
    color: #5b21b6;
  }

  .order-summary-status.order-status.delivered {
    background: #ecfdf5;
    border-color: #a4f4cf;
    color: #065f46;
  }

  .order-summary-status.order-status.cancelled {
    background: #fee2e2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .order-summary-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .summary-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .summary-info-label,
  .summary-info-value {
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0;
    color: #111827;
  }

  .summary-info-label {
    color: #4a5565;
    font-weight: 500;
  }

  .badges-row {
    justify-content: flex-start;
    gap: 8px;
    margin-top: 4px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .badge-bnpl {
    background: #ede9fe;
    color: #5b21b6;
    text-transform: uppercase;
  }

  .badge-ssd {
    background: #cffafe;
    color: #155e75;
    text-transform: uppercase;
  }

  /* Seller card container (kept) */
  .order-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
  }

  .order-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 12px;
  }

  .order-card-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .order-number {
    width: 32px;
    height: 32px;
    border-radius: 9999px;
    background: #281f51;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
  }

  .seller-name {
    font-size: 14px;
    color: #374151;
  }

  .order-shortname {
    font-size: 12px;
    color: #6b7280;
    font-family: monospace;
  }

  .order-card-status {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-badge.payment-status {
    border: 1px solid;
  }

  .status-badge svg {
    width: 8px;
    height: 8px;
  }

  .status-badge.pending {
    background: #fffbeb;
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
    background: #ecfdf5;
    color: #065f46;
  }

  .status-badge.cancelled {
    background: #fee2e2;
    color: #991b1b;
  }

  .status-badge.payment-status.paid {
    background: #ecfdf5;
    border-color: #a4f4cf;
    color: #065f46;
  }

  .status-badge.payment-status.pending {
    background: #fffbeb;
    border-color: #fdc700;
    color: #92400e;
  }

  .status-badge.payment-status.failed {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .status-badge.payment-status.refunded {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #3730a3;
  }

  .state-select-inline {
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #374151;
    background: white;
    cursor: pointer;
  }

  .state-select-disabled {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 600;
  }

  .btn-activation-toggle {
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-activation-toggle:hover:not(:disabled) {
    border-color: #281f51;
    color: #281f51;
    background: #f9fafb;
  }

  .btn-activation-toggle:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Shipment block (Figma) */
  .shipment-block {
    width: 100%;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 12px;
    background: #ffffff;
  }

  .shipment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .shipment-seller {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .shipment-flag {
    width: 32px;
    height: 32px;
    border-radius: 9999px;
    background: #f3f4f6;
    color: #111827;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 12px;
  }

  .shipment-seller-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shipment-seller-name {
    font-weight: 600;
    font-size: 14px;
    color: #101828;
  }

  .shipment-seller-id {
    font-weight: 400;
    font-size: 10px;
    line-height: 14px;
    color: #4a5565;
  }

  .shipment-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
    background: #f9fafb;
    color: #4a5565;
  }

  .shipment-status.pending {
    background: #fffbeb;
    border-color: #fdc700;
    color: #92400e;
  }

  .shipment-status.processing {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1e40af;
  }

  .shipment-status.shipped {
    background: #e0e7ff;
    border-color: #c7d2fe;
    color: #5b21b6;
  }

  .shipment-status.delivered {
    background: #ecfdf5;
    border-color: #a4f4cf;
    color: #065f46;
  }

  .shipment-status.cancelled {
    background: #fee2e2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .shipment-products {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }

  .shipment-product {
    width: 100%;
    min-height: 68px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  .shipment-product:first-child {
    border-top: none;
  }

  .shipment-product-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .product-image {
    width: 32px;
    height: 32px;
    border-radius: 100px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 5px;
    flex-shrink: 0;
    color: #6b7280;
  }

  .product-image svg {
    width: 16px;
    height: 16px;
  }

  .product-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .product-name {
    font-weight: 500;
    font-size: 14px;
    line-height: 16px;
    color: #101828;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 440px;
  }

  .product-sku {
    font-weight: 400;
    font-size: 10px;
    line-height: 14px;
    color: #4a5565;
  }

  .shipment-product-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .product-qty {
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
    color: #6a7282;
  }

  .product-price {
    font-weight: 500;
    font-size: 14px;
    line-height: 16px;
    color: #101828;
  }

  /* variation option chips */
  .item-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .option-badge {
    padding: 2px 8px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 12px;
    color: #374151;
  }

  /* Progress comment (kept) */
  .progress-comment {
    margin: 0 0 12px;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-comment label {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .progress-comment textarea {
    width: 100%;
    resize: vertical;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-size: 14px;
    color: #111827;
  }

  .progress-comment textarea:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
  }

  /* Cancellation box (kept) */
  .cancellation-reason {
    margin: 0 0 12px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 12px;
    padding: 12px;
  }

  .cancellation-reason label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #9a3412;
    margin-bottom: 8px;
  }

  .cancellation-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .cancellation-controls select {
    flex: 1;
    min-width: 220px;
    padding: 10px 12px;
    border: 1px solid #fdba74;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    color: #7c2d12;
  }

  .btn-confirm-cancel {
    padding: 10px 12px;
    background: #ea580c;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-confirm-cancel:hover {
    background: #c2410c;
  }

  .customer-info-block {
    margin: 0 0 12px;
    padding: 12px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .customer-info-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }

  .customer-info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .customer-info-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }

  .customer-info-label {
    color: #6b7280;
    font-weight: 500;
  }

  .customer-info-value {
    color: #111827;
    font-weight: 600;
    text-align: right;
    word-break: break-word;
  }

  /* Order totals (kept) */
  .order-summary {
    background: #ffffff;
    border-radius: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 14px;
    color: #374151;
  }

  .summary-row.discount {
    color: #dc2626;
  }

  .summary-row.total {
    font-weight: 700;
    color: #111827;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    margin-top: 8px;
  }

  /* Shipping info (kept) */
  .shipping-info {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .shipping-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
  }

  .shipping-label svg {
    width: 18px;
    height: 18px;
    color: #6b7280;
  }

  .shipping-details {
    font-size: 14px;
    color: #6b7280;
  }

  .shipping-details-grid {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .shipping-detail-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }

  .shipping-detail-label {
    color: #6b7280;
    font-weight: 500;
  }

  .shipping-detail-value {
    color: #111827;
    font-weight: 600;
    text-align: right;
    word-break: break-word;
  }

  .coupon-info {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .coupon-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
  }

  .coupon-label svg {
    width: 18px;
    height: 18px;
    color: #6b7280;
  }

  .coupon-details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .coupon-detail-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }

  .coupon-detail-label {
    color: #6b7280;
    font-weight: 500;
  }

  .coupon-detail-value {
    color: #111827;
    font-weight: 600;
    text-align: right;
    word-break: break-word;
  }

  .coupon-discount-value {
    color: #dc2626;
  }

  /* Comments (kept) */
  .comment-form {
    margin-top: 12px;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .comment-form-header {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
  }

  .comment-form textarea {
    width: 100%;
    resize: vertical;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    font-size: 14px;
    color: #111827;
  }

  .comment-form textarea:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
  }

  .btn-comment {
    align-self: flex-start;
    padding: 10px 14px;
    background: #281f51;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-comment:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .btn-comment:hover:not(:disabled) {
    background: #1e1640;
  }

  .order-comments {
    margin-top: 12px;
    border-top: 1px solid #e5e7eb;
    padding-top: 12px;
  }

  .order-comments h4 {
    margin: 0 0 12px;
    font-size: 15px;
    color: #111827;
    font-weight: 600;
  }

  .comment-group-title {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  .comment-item {
    padding: 10px 12px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    margin-bottom: 8px;
  }

  .comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 6px;
    gap: 12px;
  }

  .comment-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .comment-author {
    font-weight: 600;
    color: #111827;
  }

  .comment-date {
    color: #9ca3af;
  }

  .comment-delete {
    border: none;
    background: transparent;
    color: #b91c1c;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    padding: 0;
  }

  .comment-delete:disabled {
    color: #9ca3af;
    cursor: not-allowed;
  }

  .comment-delete:hover:not(:disabled) {
    text-decoration: underline;
  }

  .comment-text {
    margin: 0;
    font-size: 13px;
    color: #374151;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: #6b7280;
  }

  /* Loading */
  .loading-orders {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    gap: 12px;
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
    .modern-modal-overlay {
      padding: 12px;
    }
    .modern-modal-body {
      padding: 12px;
    }
    .order-card-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .order-card-status {
      width: 100%;
      justify-content: space-between;
    }
    .shipment-product-right {
      gap: 10px;
    }
    .product-name {
      max-width: 220px;
    }
  }
   .form-label {
    display: flex;
    margin-top:10px;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 0.75rem;
}
.form-select {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.95rem;
    color: #2d3748;
    background: white;
    cursor: pointer;
    transition: all 0.3s ease;
}
.form-input, .form-textarea {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.95rem;
    color: #2d3748;
    background: white;
    transition: all 0.3s ease;
    font-family: "uthmantn", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
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

<script lang="ts">
  import { _ } from "@/i18n";
  import {
    createOrderComment,
    deleteComment,
    getOrderDetails,
    getVariationOptionsByShortname,
    progressOrderTicket,
  } from "@/lib/dmart_services";
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

  let pendingCancellations = $state<
    Record<string, { reasonKey: string; reasonLabel: string }>
  >({});
  let commentDrafts = $state<Record<string, { text: string }>>({});
  let commentLoading = $state<Record<string, boolean>>({});
  let commentDeleteLoading = $state<Record<string, boolean>>({});
  let progressCommentDrafts = $state<Record<string, string>>({});
  let variationOptionsCache = $state<
    Record<string, { displayname: any; options: any[] }>
  >({});
  let variationOptionsLoading = $state<Record<string, boolean>>({});

  async function handleStateChange(
    order: any,
    action: string,
    targetState: string,
    additionalData?: any,
    progressComment?: string,
  ) {
    try {
      const success = await progressOrderTicket(
        website.main_space,
        order.seller_shortname,
        order.shortname,
        action,
        additionalData,
      );

      if (success) {
        if (progressComment?.trim()) {
          await createOrderComment(
            website.main_space,
            order.seller_shortname,
            order.shortname,
            progressComment.trim(),
            targetState,
          );
        }

        const refreshedOrder = await getOrderDetails(
          website.main_space,
          order.seller_shortname,
          order.shortname,
          true,
        );

        if (refreshedOrder) {
          order.attributes = refreshedOrder.attributes;
          order.attachments = refreshedOrder.attachments;
        }

        successToastMessage("Order state updated successfully");
        if (onStateChange) {
          onStateChange(order.seller_shortname, order.shortname, targetState);
        }
      } else {
        errorToastMessage("Failed to update order state");
      }
    } catch (error) {
      console.error("Error updating order state:", error);
      errorToastMessage("An error occurred while updating order");
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

  function handleStateSelect(order: any, action: string, targetState: string) {
    if (!action) return;
    if (targetState === "customer_cancelled") {
      pendingCancellations = {
        ...pendingCancellations,
        [order.shortname]: {
          reasonKey: "",
          reasonLabel: "",
        },
      };
      return;
    }
    if (pendingCancellations[order.shortname]) {
      const { [order.shortname]: _, ...rest } = pendingCancellations;
      pendingCancellations = rest;
    }
    const progressComment = progressCommentDrafts[order.shortname] || "";
    handleStateChange(order, action, targetState, undefined, progressComment);
    if (progressCommentDrafts[order.shortname]) {
      const { [order.shortname]: _, ...rest } = progressCommentDrafts;
      progressCommentDrafts = rest;
    }
  }

  function updateCancellationReason(
    orderShortname: string,
    reasonKey: string,
    reasonLabel: string,
  ) {
    pendingCancellations = {
      ...pendingCancellations,
      [orderShortname]: { reasonKey, reasonLabel },
    };
  }

  function confirmCancellation(order: any) {
    const pending = pendingCancellations[order.shortname];
    if (!pending || !pending.reasonKey) {
      errorToastMessage("Please select a cancellation reason");
      return;
    }
    handleStateChange(
      order,
      "customer_cancel",
      "customer_cancelled",
      {
        resolution_reason: pending.reasonKey,
        resolution_reason_label: pending.reasonLabel,
      },
      progressCommentDrafts[order.shortname],
    );
    const { [order.shortname]: _, ...rest } = pendingCancellations;
    pendingCancellations = rest;
    if (progressCommentDrafts[order.shortname]) {
      const { [order.shortname]: __, ...progressRest } = progressCommentDrafts;
      progressCommentDrafts = progressRest;
    }
  }

  function getCommentDraft(order: any) {
    const existing = commentDrafts[order.shortname];
    if (existing) return existing;
    return { text: "" };
  }

  function updateCommentDraft(order: any, updates: Partial<{ text: string }>) {
    const current = getCommentDraft(order);
    commentDrafts = {
      ...commentDrafts,
      [order.shortname]: {
        ...current,
        ...updates,
      },
    };
  }

  function updateProgressCommentDraft(order: any, value: string) {
    progressCommentDrafts = {
      ...progressCommentDrafts,
      [order.shortname]: value,
    };
  }

  async function submitComment(order: any) {
    const draft = getCommentDraft(order);
    if (!draft.text.trim()) {
      errorToastMessage("Please enter a comment");
      return;
    }

    commentLoading = { ...commentLoading, [order.shortname]: true };
    try {
      const success = await createOrderComment(
        website.main_space,
        order.seller_shortname,
        order.shortname,
        draft.text.trim(),
        "general",
      );

      if (!success) {
        errorToastMessage("Failed to add comment");
        return;
      }

      const refreshedOrder = await getOrderDetails(
        website.main_space,
        order.seller_shortname,
        order.shortname,
        true,
      );

      if (refreshedOrder) {
        order.attributes = refreshedOrder.attributes;
        order.attachments = refreshedOrder.attachments;
      }

      updateCommentDraft(order, { text: "" });
      successToastMessage("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      errorToastMessage("Error adding comment");
    } finally {
      commentLoading = { ...commentLoading, [order.shortname]: false };
    }
  }

  async function removeOrderComment(order: any, comment: any) {
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
        `orders/${order.seller_shortname}`,
        order.shortname,
      );

      if (!success) {
        errorToastMessage("Failed to delete comment");
        return;
      }

      const refreshedOrder = await getOrderDetails(
        website.main_space,
        order.seller_shortname,
        order.shortname,
        true,
      );

      if (refreshedOrder) {
        order.attributes = refreshedOrder.attributes;
        order.attachments = refreshedOrder.attachments;
      }

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

  function handleClose() {
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
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
      delivered: "delivered",
      delivery_confirmed: "delivered",
      issue_reported: "shipped",
      refund_pending: "pending",
      refunded: "delivered",
      resolved: "delivered",
      cancel: "cancelled",
      customer_cancelled: "cancelled",
      approved: "delivered",
      rejected: "cancelled",
    };
    return statusMap[status] || "pending";
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

  async function loadVariationOptions(variationShortname: string) {
    try {
      const result = await getVariationOptionsByShortname(
        website.main_space,
        variationShortname,
      );
      variationOptionsCache = {
        ...variationOptionsCache,
        [variationShortname]: result,
      };
      return result;
    } catch (error) {
      console.error("Error loading variation options:", error);
      return { displayname: {}, options: [] };
    } finally {
      variationOptionsLoading = {
        ...variationOptionsLoading,
        [variationShortname]: false,
      };
    }
  }

  function getOptionDisplayName(option: any): string {
    if (!option) return "";
    if (typeof option.name === "string") return option.name;
    return (
      option.name?.en || option.name?.ar || option.name?.ku || option.key || ""
    );
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
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    aria-label="Close modal"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
  >
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
              <div class="header-badges">
                <div
                  class="payment-badge {getPaymentStatusColor(
                    payload?.payment_status || 'pending',
                  )}"
                >
                  {payload?.payment_status || "pending"}
                </div>
                {#if isBnplOrder(payload)}
                  <span class="badge badge-bnpl">BNPL</span>
                {/if}
                {#if isSameDayDelivery(payload)}
                  <span class="badge badge-ssd">SSD</span>
                {/if}
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
                {@const transitions = getTransitions(orderState)}
                {@const cancellationPending =
                  pendingCancellations[order.shortname]}
                {@const commentDraft = getCommentDraft(order)}
                {@const itemsTotal =
                  orderPayload?.items?.reduce(
                    (sum, item) => sum + (item.subtotal || 0),
                    0,
                  ) || 0}
                {@const shippingCost = orderPayload?.shipping?.cost || 0}
                {@const couponDiscount =
                  orderPayload?.coupon?.discount_amount || 0}
                {@const orderTotal = itemsTotal + shippingCost - couponDiscount}
                {@const orderComments = order.attachments?.comment || []}

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
                        {getStateLabel(orderState)}
                      </span>
                      {#if transitions.length > 0}
                        <select
                          class="state-select-inline"
                          onchange={(e) => {
                            const action = e.currentTarget.value;
                            const selected = transitions.find(
                              (transition) => transition.action === action,
                            );
                            if (selected) {
                              handleStateSelect(
                                order,
                                selected.action,
                                selected.state,
                              );
                            }
                          }}
                        >
                          <option value="">Change state...</option>
                          {#each transitions as transition}
                            <option value={transition.action}>
                              {formatActionLabel(
                                transition.action,
                                transition.state,
                              )}
                            </option>
                          {/each}
                        </select>
                      {:else}
                        <span class="state-select-disabled">No actions</span>
                      {/if}
                    </div>
                  </div>

                  <div class="progress-comment">
                    <label for="progress-comment-{order.shortname}">
                      Progress Comment (optional)
                    </label>
                    <textarea
                      id="progress-comment-{order.shortname}"
                      rows="2"
                      placeholder="Add a comment for this state change..."
                      value={progressCommentDrafts[order.shortname] || ""}
                      oninput={(e) =>
                        updateProgressCommentDraft(
                          order,
                          e.currentTarget.value,
                        )}
                    ></textarea>
                  </div>

                  {#if cancellationPending}
                    <div class="cancellation-reason">
                      <label for="cancel-reason-{order.shortname}">
                        Cancellation reason
                      </label>
                      <div class="cancellation-controls">
                        <select
                          id="cancel-reason-{order.shortname}"
                          value={cancellationPending.reasonKey}
                          onchange={(e) =>
                            updateCancellationReason(
                              order.shortname,
                              e.currentTarget.value,
                              e.currentTarget.selectedOptions?.[0]?.text || "",
                            )}
                        >
                          <option value="">Select reason...</option>
                          {#each getCancellationResolutions() as reason}
                            <option value={reason.key}>{reason.en}</option>
                          {/each}
                        </select>
                        <button
                          class="btn-confirm-cancel"
                          onclick={() => confirmCancellation(order)}
                        >
                          Confirm Cancel
                        </button>
                      </div>
                    </div>
                  {/if}

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
                                    {#await loadVariationOptions(option.variation_shortname) then variationData}
                                      {@const resolvedOption =
                                        variationData.options.find(
                                          (opt) => opt.key === option.key,
                                        )}
                                      {@const variationLabel =
                                        variationData.displayname?.en ||
                                        variationData.displayname?.ar ||
                                        variationData.displayname?.ku ||
                                        option.variation_shortname}
                                      <span class="option-badge">
                                        {variationLabel}: {getOptionDisplayName(
                                          resolvedOption,
                                        ) || option.key}
                                      </span>
                                    {:catch}
                                      <span class="option-badge">
                                        {option.variation_shortname}: {option.key}
                                      </span>
                                    {/await}
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

                  <div class="comment-form">
                    <div class="comment-form-header">Add Comment</div>
                    <textarea
                      rows="3"
                      placeholder="Write a comment..."
                      value={commentDraft.text}
                      oninput={(e) =>
                        updateCommentDraft(order, {
                          text: e.currentTarget.value,
                        })}
                    ></textarea>
                    <button
                      class="btn-comment"
                      onclick={() => submitComment(order)}
                      disabled={commentLoading[order.shortname]}
                    >
                      {commentLoading[order.shortname]
                        ? "Sending..."
                        : "Add Comment"}
                    </button>
                  </div>
                  {#if orderComments.length > 0}
                    {@const commentGroups = groupCommentsByState(orderComments)}
                    <div class="order-comments">
                      <h4>Comments</h4>
                      {#each Object.entries(commentGroups) as [commentState, comments]}
                        <div class="comment-group">
                          <div class="comment-group-title">
                            {commentState === "general"
                              ? "General"
                              : getStateLabel(commentState)}
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
                                    onclick={() =>
                                      removeOrderComment(order, comment)}
                                    disabled={commentDeleteLoading[
                                      comment.shortname
                                    ]}
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

  .header-badges {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .badge-bnpl {
    background: #ede9fe;
    color: #5b21b6;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge-ssd {
    background: #cffafe;
    color: #155e75;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  .state-select-disabled {
    font-size: 0.8125rem;
    color: #9ca3af;
    font-weight: 600;
  }

  .cancellation-reason {
    margin: 0 0 1rem;
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

  .progress-comment {
    margin: 0 0 1rem;
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

  .progress-comment textarea:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
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
    transition: background 0.2s ease;
  }

  .btn-confirm-cancel:hover {
    background: #c2410c;
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

  .order-comments {
    margin-top: 1rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  .order-comments h4 {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    color: #111827;
    font-weight: 600;
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

  .comment-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
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
    font-size: 0.75rem;
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
    font-size: 0.8125rem;
    color: #374151;
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

  .comment-form-header {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
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

  .comment-form textarea:focus,
  .comment-form-row select:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(40, 31, 81, 0.1);
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
    transition: background 0.2s ease;
  }

  .btn-comment:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .btn-comment:hover:not(:disabled) {
    background: #1e1640;
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

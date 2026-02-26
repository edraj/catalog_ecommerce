<script lang="ts">
  import { _ } from "@/i18n";
  import { get } from "svelte/store";
  import {
    createOrderComment,
    deleteComment,
    getSpaceContents,
    getOrderDetails,
    getVariationOptionsByShortname,
    progressOrderTicket,
    updateCombinedOrderPayload,
    updateOrderActiveStatus,
    updateOrderPayload,
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
    onOrderEdited?: () => void;
  }

  let {
    isOpen = $bindable(false),
    combinedOrder,
    onClose,
    onStateChange,
    onOrderEdited,
  }: Props = $props();

  const t = (key: string, vars?: Record<string, unknown>) => {
    const translate = get(_);
    return typeof translate === "function" ? translate(key, vars) : key;
  };

  const orderWorkflow = {
    name: "order_processing",
    states: [
      {
        name: "Pending",
        state: "pending",
        next: [
          { roles: ["super_admin"], state: "confirmed", action: "confirm" },
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
      { name: "Delivery Confirmed", state: "delivery_confirmed" },
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
          { roles: ["super_admin"], state: "cancel", action: "cancel" },
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
      { name: "Refunded", state: "refunded" },
      { name: "Resolved", state: "resolved" },
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
          { en: "No agreement", key: "no_agreement" },
          { en: "Price issue", key: "price_issue" },
          { en: "Changed mind", key: "changed_mind" },
          { en: "Duplicate order", key: "duplicate_order" },
          { en: "Others", key: "others" },
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
  let statusToggleLoading = $state<Record<string, boolean>>({});
  let progressCommentDrafts = $state<Record<string, string>>({});
  let variationOptionsCache = $state<
    Record<string, { displayname: any; options: any[] }>
  >({});
  let variationOptionsLoading = $state<Record<string, boolean>>({});
  let orderEditMode = $state<Record<string, boolean>>({});
  let orderEditDrafts = $state<Record<string, any>>({});
  let orderEditSaving = $state<Record<string, boolean>>({});
  let orderCoupons = $state<Record<string, any[]>>({});
  let orderCouponsLoading = $state<Record<string, boolean>>({});
  let selectedCouponCodes = $state<Record<string, string>>({});
  let availableProducts = $state<Record<string, any[]>>({});
  let availableProductsLoading = $state<Record<string, boolean>>({});
  let productSearchQuery = $state<Record<string, string>>({});

  function toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeOrderItem(item: any): any {
    const quantity = Math.max(1, toNumber(item?.quantity, 1));
    const unitPrice = toNumber(
      item?.price_at_purchase,
      item?.subtotal ?? item?.item_subtotal ?? 0,
    );
    const subtotal = Math.max(0, quantity * unitPrice);

    return {
      ...item,
      quantity,
      price_at_purchase: unitPrice,
      subtotal,
      item_subtotal: subtotal,
      sku: item?.sku || "",
      product_shortname: item?.product_shortname || item?.sku || "",
      displayname: item?.displayname || { en: "", ar: "", ku: "" },
      options: Array.isArray(item?.options) ? item.options : [],
    };
  }

  function calculateCouponDiscount(
    coupon: any,
    itemsSubtotal: number,
    shippingCost: number,
  ): number {
    if (!coupon) return 0;

    const isShipping = Boolean(coupon.is_shipping);
    const baseAmount = isShipping ? shippingCost : itemsSubtotal + shippingCost;
    if (baseAmount <= 0) return 0;

    const minimumSpend = toNumber(coupon.minimum_spend, 0);
    if (!isShipping && minimumSpend > 0 && itemsSubtotal < minimumSpend) {
      return 0;
    }

    const discountType = coupon.discount_type?.toString().toLowerCase() || "";
    const discountValue = toNumber(coupon.discount_value, 0);

    let discount = 0;
    if (discountType === "percentage") {
      discount = (baseAmount * discountValue) / 100;
    } else {
      discount = discountValue;
    }

    const maximumAmount = toNumber(coupon.maximum_amount, 0);
    if (maximumAmount > 0) {
      discount = Math.min(discount, maximumAmount);
    }

    return Math.max(0, Math.min(discount, baseAmount));
  }

  function recalculateOrderPayload(payload: any): any {
    const normalizedItems = (payload?.items || []).map((item) =>
      normalizeOrderItem(item),
    );
    const shipping = {
      ...(payload?.shipping || {}),
      min: toNumber(payload?.shipping?.min, 0),
      max: toNumber(payload?.shipping?.max, 0),
      cost: toNumber(payload?.shipping?.cost, 0),
      minimum_retail: toNumber(payload?.shipping?.minimum_retail, 0),
    };

    const itemsSubtotal = normalizedItems.reduce(
      (sum: number, item: any) => sum + toNumber(item.subtotal, 0),
      0,
    );
    const shippingCost = toNumber(shipping.cost, 0);
    const coupon = payload?.coupon ? { ...payload.coupon } : null;
    const discountAmount = coupon
      ? calculateCouponDiscount(coupon, itemsSubtotal, shippingCost)
      : 0;

    if (coupon) {
      coupon.discount_amount = discountAmount;
    }

    const totalAmount = Math.max(
      0,
      itemsSubtotal + shippingCost - discountAmount,
    );

    return {
      ...payload,
      items: normalizedItems,
      shipping,
      coupon,
      total_amount: totalAmount,
    };
  }

  function buildCouponValue(selectedCoupon: any): any {
    const couponBody = selectedCoupon?.coupon_body || selectedCoupon;
    return {
      code: couponBody?.code || "",
      type: couponBody?.type || selectedCoupon?.type || "",
      coupon_body: couponBody,
      is_shipping: Boolean(couponBody?.is_shipping),
      discount_type: couponBody?.discount_type || "amount",
      discount_value: toNumber(couponBody?.discount_value, 0),
      maximum_amount: toNumber(couponBody?.maximum_amount, 0),
      minimum_spend: toNumber(couponBody?.minimum_spend, 0),
      discount_amount: 0,
    };
  }

  function getCouponOptionLabel(coupon: any): string {
    const sourceLabel = coupon.type === "global" ? "Global" : "Seller";
    const discountLabel =
      coupon.discount_type === "percentage"
        ? `${toNumber(coupon.discount_value, 0)}%`
        : `${formatNumberValue(coupon.discount_value)} ${t("admin.currency") || "IQD"}`;
    return `${coupon.code} (${sourceLabel} · ${discountLabel})`;
  }

  async function loadCouponsForOrder(order: any) {
    orderCouponsLoading = { ...orderCouponsLoading, [order.shortname]: true };
    try {
      const [globalResponse, sellerResponse] = await Promise.all([
        getSpaceContents(
          website.main_space,
          "coupons/global",
          "managed",
          500,
          0,
          true,
        ),
        getSpaceContents(
          website.main_space,
          `coupons/${order.seller_shortname}`,
          "managed",
          500,
          0,
          true,
        ),
      ]);

      const mapCoupons = (records: any[] = []) =>
        records
          .map((record) => record?.attributes?.payload?.body)
          .filter((body) => body?.code)
          .map((body) => ({
            ...body,
            coupon_body: body,
          }));

      const globalCoupons = mapCoupons(globalResponse?.records).map(
        (coupon) => ({
          ...coupon,
          type: "global",
        }),
      );
      const sellerCoupons = mapCoupons(sellerResponse?.records).map(
        (coupon) => ({
          ...coupon,
          type: "individual",
        }),
      );

      orderCoupons = {
        ...orderCoupons,
        [order.shortname]: [...globalCoupons, ...sellerCoupons],
      };
    } catch (error) {
      console.error("Error loading coupons for order:", error);
      orderCoupons = {
        ...orderCoupons,
        [order.shortname]: [],
      };
    } finally {
      orderCouponsLoading = {
        ...orderCouponsLoading,
        [order.shortname]: false,
      };
    }
  }

  async function loadAvailableProducts(order: any) {
    availableProductsLoading = {
      ...availableProductsLoading,
      [order.shortname]: true,
    };
    try {
      const response = await getSpaceContents(
        website.main_space,
        `available_products/${order.seller_shortname}`,
        "managed",
        1000,
        0,
        true,
      );

      const products =
        response?.records
          ?.map((record) => {
            const body = record?.attributes?.payload?.body;
            if (!body) return null;

            return {
              shortname: record.shortname,
              sku: body.sku || record.shortname,
              product_shortname: body.product_shortname || record.shortname,
              displayname: body.displayname || record.attributes?.displayname,
              price: body.price || body.retail_price || 0,
              available_shortname: record.shortname,
              brand_shortname: body.brand_shortname || "",
              main_category_shortname: body.main_category_shortname || "",
              commission_category: body.commission_category || "",
              variant_key: body.variant_key || "",
            };
          })
          .filter(Boolean) || [];

      availableProducts = {
        ...availableProducts,
        [order.shortname]: products,
      };
    } catch (error) {
      console.error("Error loading available products:", error);
      availableProducts = {
        ...availableProducts,
        [order.shortname]: [],
      };
    } finally {
      availableProductsLoading = {
        ...availableProductsLoading,
        [order.shortname]: false,
      };
    }
  }

  function startEditOrder(order: any) {
    const payload = order.attributes?.payload?.body || {};
    const draft = recalculateOrderPayload({
      ...payload,
      items: Array.isArray(payload.items) ? payload.items : [],
      shipping: payload.shipping || {},
    });

    orderEditMode = { ...orderEditMode, [order.shortname]: true };
    orderEditDrafts = { ...orderEditDrafts, [order.shortname]: draft };
    selectedCouponCodes = {
      ...selectedCouponCodes,
      [order.shortname]: draft.coupon?.code || "__none__",
    };
    productSearchQuery = { ...productSearchQuery, [order.shortname]: "" };

    loadCouponsForOrder(order);
    loadAvailableProducts(order);
  }

  function cancelEditOrder(orderShortname: string) {
    orderEditMode = { ...orderEditMode, [orderShortname]: false };
  }

  function updateDraft(orderShortname: string, nextDraft: any) {
    orderEditDrafts = {
      ...orderEditDrafts,
      [orderShortname]: recalculateOrderPayload(nextDraft),
    };
  }

  function addDraftItem(orderShortname: string) {
    const draft = orderEditDrafts[orderShortname];
    if (!draft) return;

    const nextItems = [
      ...(draft.items || []),
      normalizeOrderItem({
        sku: "",
        product_shortname: "",
        quantity: 1,
        price_at_purchase: 0,
        subtotal: 0,
        displayname: { en: "", ar: "", ku: "" },
        available_shortname: "",
        brand_shortname: "",
        main_category_shortname: "",
        commission_category: "",
        variant_key: "",
      }),
    ];

    updateDraft(orderShortname, {
      ...draft,
      items: nextItems,
    });
  }

  function selectProductForItem(
    orderShortname: string,
    itemIndex: number,
    product: any,
  ) {
    const draft = orderEditDrafts[orderShortname];
    if (!draft) return;

    const nextItems = (draft.items || []).map((item: any, index: number) => {
      if (index !== itemIndex) return item;

      return normalizeOrderItem({
        ...item,
        sku: product.sku,
        product_shortname: product.product_shortname,
        price_at_purchase: toNumber(product.price, 0),
        displayname: product.displayname || { en: product.sku, ar: "", ku: "" },
        available_shortname: product.available_shortname,
        brand_shortname: product.brand_shortname,
        main_category_shortname: product.main_category_shortname,
        commission_category: product.commission_category,
        variant_key: product.variant_key,
      });
    });

    updateDraft(orderShortname, {
      ...draft,
      items: nextItems,
    });
  }

  function getFilteredProducts(orderShortname: string): any[] {
    const products = availableProducts[orderShortname] || [];
    const query = (productSearchQuery[orderShortname] || "").toLowerCase();
    if (!query) return products.slice(0, 50);

    return products
      .filter((product) => {
        const sku = (product.sku || "").toLowerCase();
        const productShortname = (
          product.product_shortname || ""
        ).toLowerCase();
        const displaynameEn = (product.displayname?.en || "").toLowerCase();
        const displaynameAr = (product.displayname?.ar || "").toLowerCase();

        return (
          sku.includes(query) ||
          productShortname.includes(query) ||
          displaynameEn.includes(query) ||
          displaynameAr.includes(query)
        );
      })
      .slice(0, 50);
  }

  function getProductDisplayLabel(product: any): string {
    const name =
      product.displayname?.en || product.displayname?.ar || product.sku;
    const price = formatNumberValue(product.price);
    return `${name} - ${product.sku} (${price} ${t("admin.currency") || "IQD"})`;
  }

  function removeDraftItem(orderShortname: string, itemIndex: number) {
    const draft = orderEditDrafts[orderShortname];
    if (!draft) return;

    const nextItems = (draft.items || []).filter(
      (_: any, index: number) => index !== itemIndex,
    );

    updateDraft(orderShortname, {
      ...draft,
      items: nextItems,
    });
  }

  function updateDraftItemField(
    orderShortname: string,
    itemIndex: number,
    field: string,
    rawValue: string,
  ) {
    const draft = orderEditDrafts[orderShortname];
    if (!draft) return;

    const nextItems = (draft.items || []).map((item: any, index: number) => {
      if (index !== itemIndex) return item;
      const nextItem = { ...item };

      if (field === "quantity" || field === "price_at_purchase") {
        nextItem[field] = toNumber(rawValue, 0);
      } else {
        nextItem[field] = rawValue;
      }

      return normalizeOrderItem(nextItem);
    });

    updateDraft(orderShortname, {
      ...draft,
      items: nextItems,
    });
  }

  function updateDraftShippingField(
    orderShortname: string,
    field: string,
    rawValue: string,
  ) {
    const draft = orderEditDrafts[orderShortname];
    if (!draft) return;

    const shipping = { ...(draft.shipping || {}) };
    if (["min", "max", "cost", "minimum_retail"].includes(field)) {
      shipping[field] = toNumber(rawValue, 0);
    } else {
      shipping[field] = rawValue;
    }

    updateDraft(orderShortname, {
      ...draft,
      shipping,
    });
  }

  function handleCouponSelection(order: any, couponCode: string) {
    const orderShortname = order.shortname;
    const draft = orderEditDrafts[orderShortname];
    if (!draft) return;

    selectedCouponCodes = {
      ...selectedCouponCodes,
      [orderShortname]: couponCode,
    };

    if (couponCode === "__none__") {
      updateDraft(orderShortname, {
        ...draft,
        coupon: null,
      });
      return;
    }

    const coupons = orderCoupons[orderShortname] || [];
    const selectedCoupon = coupons.find((coupon) => coupon.code === couponCode);
    if (!selectedCoupon) return;

    updateDraft(orderShortname, {
      ...draft,
      coupon: buildCouponValue(selectedCoupon),
    });
  }

  async function saveOrderEdits(order: any) {
    const draft = orderEditDrafts[order.shortname];
    if (!draft) return;

    orderEditSaving = { ...orderEditSaving, [order.shortname]: true };

    try {
      const normalizedPayload = recalculateOrderPayload(draft);
      const orderUpdated = await updateOrderPayload(
        website.main_space,
        order.seller_shortname,
        order.shortname,
        normalizedPayload,
      );

      if (!orderUpdated) {
        errorToastMessage(
          t("admin.order_update_failed") || "Failed to update order details",
        );
        return;
      }

      order.attributes = {
        ...order.attributes,
        payload: {
          ...(order.attributes?.payload || {}),
          content_type: "json",
          body: normalizedPayload,
        },
      };

      const updatedOrders = (combinedOrder.individualOrders || []).map(
        (item: any) => {
          if (item.shortname !== order.shortname) return item;
          return {
            ...item,
            attributes: {
              ...item.attributes,
              payload: {
                ...(item.attributes?.payload || {}),
                content_type: "json",
                body: normalizedPayload,
              },
            },
          };
        },
      );

      const combinedPayload = {
        ...(combinedOrder.attributes?.payload?.body || {}),
      };
      combinedPayload.total_amount = updatedOrders.reduce(
        (sum: number, item: any) =>
          sum + toNumber(item.attributes?.payload?.body?.total_amount, 0),
        0,
      );

      if (updatedOrders.length === 1) {
        if (normalizedPayload.coupon) {
          combinedPayload.coupon = normalizedPayload.coupon;
        } else {
          delete combinedPayload.coupon;
        }
      }

      const combinedUpdated = await updateCombinedOrderPayload(
        website.main_space,
        combinedOrder.shortname,
        combinedPayload,
        combinedOrder.attributes?.is_active,
      );

      if (combinedUpdated) {
        combinedOrder.individualOrders = updatedOrders;
        combinedOrder.attributes = {
          ...combinedOrder.attributes,
          payload: {
            ...(combinedOrder.attributes?.payload || {}),
            content_type: "json",
            body: combinedPayload,
          },
        };
      }

      orderEditMode = { ...orderEditMode, [order.shortname]: false };
      successToastMessage(
        t("admin.order_updated_successfully") ||
          "Order details updated successfully",
      );

      if (onOrderEdited) {
        onOrderEdited();
      }
    } catch (error) {
      console.error("Error while saving order edits:", error);
      errorToastMessage(
        t("admin.order_update_error") ||
          "An error occurred while updating order details",
      );
    } finally {
      orderEditSaving = { ...orderEditSaving, [order.shortname]: false };
    }
  }

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

        successToastMessage(
          t("admin.order_state_updated") || "Order state updated successfully",
        );
        if (onStateChange) {
          onStateChange(order.seller_shortname, order.shortname, targetState);
        }
      } else {
        errorToastMessage(
          t("admin.order_state_update_failed") ||
            "Failed to update order state",
        );
      }
    } catch (error) {
      console.error("Error updating order state:", error);
      errorToastMessage(
        t("admin.order_state_update_error") ||
          "An error occurred while updating order",
      );
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
        [order.shortname]: { reasonKey: "", reasonLabel: "" },
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
      const { [order.shortname]: __, ...rest } = progressCommentDrafts;
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
      errorToastMessage(
        t("admin.select_cancellation_reason") ||
          "Please select a cancellation reason",
      );
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
      [order.shortname]: { ...current, ...updates },
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
      errorToastMessage(
        t("admin.comment_required") || "Please enter a comment",
      );
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
        errorToastMessage(
          t("admin.comment_add_failed") || "Failed to add comment",
        );
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
      successToastMessage(
        t("admin.comment_added") || "Comment added successfully",
      );
    } catch (error) {
      console.error("Error adding comment:", error);
      errorToastMessage(t("admin.comment_add_error") || "Error adding comment");
    } finally {
      commentLoading = { ...commentLoading, [order.shortname]: false };
    }
  }

  async function removeOrderComment(order: any, comment: any) {
    if (!comment?.shortname) {
      errorToastMessage(
        t("admin.comment_delete_invalid") || "Comment could not be deleted",
      );
      return;
    }

    const confirmed = window.confirm(
      t("admin.comment_delete_confirm") || "Delete this comment?",
    );
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
        errorToastMessage(
          t("admin.comment_delete_failed") || "Failed to delete comment",
        );
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

      successToastMessage(
        t("admin.comment_deleted") || "Comment deleted successfully",
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      errorToastMessage(
        t("admin.comment_delete_error") || "Error deleting comment",
      );
    } finally {
      commentDeleteLoading = {
        ...commentDeleteLoading,
        [comment.shortname]: false,
      };
    }
  }

  function isOrderActive(order: any): boolean {
    if (typeof order?.attributes?.is_active === "boolean") {
      return order.attributes.is_active;
    }
    if (typeof order?.attributes?.isActive === "boolean") {
      return order.attributes.isActive;
    }
    return false;
  }

  async function handleOrderActiveToggle(order: any) {
    const currentlyActive = isOrderActive(order);
    const nextActive = !currentlyActive;

    const confirmed = window.confirm(
      nextActive
        ? t("admin.confirm_deactivate_order") ||
            "Are you sure you want to deactivate this order?"
        : t("admin.confirm_activate_order") ||
            "Are you sure you want to activate this order?",
    );

    if (!confirmed) return;

    statusToggleLoading = { ...statusToggleLoading, [order.shortname]: true };
    try {
      const success = await updateOrderActiveStatus(
        website.main_space,
        order.seller_shortname,
        order.shortname,
        nextActive,
      );

      if (!success) {
        errorToastMessage(
          t("admin.order_active_update_failed") ||
            "Failed to update order active status",
        );
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

      successToastMessage(
        nextActive
          ? t("admin.order_activated") || "Order activated successfully"
          : t("admin.order_deactivated") || "Order deactivated successfully",
      );
    } catch (error) {
      console.error("Error updating order active status:", error);
      errorToastMessage(
        t("admin.order_active_update_error") ||
          "An error occurred while updating order active status",
      );
    } finally {
      statusToggleLoading = {
        ...statusToggleLoading,
        [order.shortname]: false,
      };
    }
  }

  function handleClose() {
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") handleClose();
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
      if (!groups[state]) groups[state] = [];
      groups[state].push(comment);
    });
    return groups;
  }

  async function loadVariationOptions(variationShortname: string) {
    variationOptionsLoading = {
      ...variationOptionsLoading,
      [variationShortname]: true,
    };
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

  function getPaymentStatusLabel(status: string): string {
    const normalized = status?.toString().trim().toLowerCase() || "";
    if (!normalized) return t("common.not_available") || "N/A";
    if (normalized === "pending") {
      return t("admin.payment_pending") || "Pending";
    }
    if (["completed", "paid", "success"].includes(normalized)) {
      return t("admin.payment_completed") || "Completed";
    }
    if (["nopaid", "unpaid"].includes(normalized)) {
      return t("admin.payment_not_paid") || "Not Paid";
    }
    if (normalized === "failed") {
      return t("admin.payment_failed") || "Failed";
    }
    if (normalized === "refunded") {
      return t("admin.payment_refunded") || "Refunded";
    }
    return normalized;
  }

  function getCombinedOrderStatus(order: any): string {
    if (!order) return "";
    const payload = order.attributes?.payload?.body || {};
    const directStatus =
      order.attributes?.state || payload.order_status || payload.state || "";
    if (directStatus) return directStatus;

    const individualOrders = order.individualOrders || [];
    const fallbackStatus = individualOrders
      .map(
        (item: any) =>
          item.attributes?.state ||
          item.attributes?.payload?.body?.order_status ||
          item.attributes?.payload?.body?.state ||
          "",
      )
      .find(Boolean);

    return fallbackStatus || "";
  }

  function formatNumberValue(value: unknown): string {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return "0";
    return numberValue.toLocaleString();
  }
</script>

{#if isOpen}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    aria-label={$_("admin.close_modal") || "Close modal"}
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
  >
    <div class="modal-container">
      <!-- Header (Figma) -->
      <div class="modal-header">
        <div class="modal-header-left">
          <h2 class="modal-title">
            {$_("admin.combined_order_details") || "Combined Order Details"}
          </h2>

          {#if combinedOrder}
            {@const payload = combinedOrder.attributes?.payload?.body}
            <div class="modal-subtitle">
              {payload?.combined_order_id || combinedOrder.shortname}
            </div>
          {/if}
        </div>

        <button
          class="close-button"
          onclick={handleClose}
          aria-label={$_("common.close") || "Close"}
        >
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

          <!-- Order Summary (Figma) -->
          {@const combinedOrderStatus = getCombinedOrderStatus(combinedOrder)}
          <div class="order-summary-block">
            <div class="order-summary-header">
              <div class="order-summary-title">
                {$_("admin.order_details") || "Order Details"}
              </div>

              <div class="order-summary-statuses">
                {#if combinedOrderStatus}
                  <div class="status-stack">
                    <span class="status-label">
                      {$_("admin.order_status") || "Order"}
                    </span>
                    <div
                      class="order-summary-status order-status {getStatusColor(
                        combinedOrderStatus,
                      )}"
                    >
                      {getStateLabel(combinedOrderStatus)}
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <div class="order-summary-info">
              <div class="summary-info-row">
                <span class="summary-info-label">
                  {$_("admin.order_date") || "Order date"}
                </span>
                <span class="summary-info-value">
                  {formatDate(combinedOrder.attributes.created_at)}
                </span>
              </div>

              <div class="summary-info-row">
                <span class="summary-info-label">
                  {$_("admin.customer") || "Customer"}
                </span>
                <span class="summary-info-value"
                  >{customerShortname || "—"}</span
                >
              </div>

              <div class="summary-info-row">
                <span class="summary-info-label">
                  {$_("admin.payment_method") || "Payment method"}
                </span>
                <span class="summary-info-value"
                  >{payload?.payment_type || "—"}</span
                >
              </div>

              <div class="summary-info-row">
                <span class="summary-info-label">
                  {$_("admin.origin") || "Origin"}
                </span>
                <span class="summary-info-value"
                  >{payload?.order_from || "—"}</span
                >
              </div>

              <div class="summary-info-row">
                <span class="summary-info-label">
                  {$_("admin.total_amount") || "Total price"}
                </span>
                <span class="summary-info-value">
                  {(payload?.total_amount || 0).toLocaleString()}
                  {$_("admin.currency") || "IQD"}
                </span>
              </div>

              <div class="summary-info-row badges-row">
                {#if isBnplOrder(payload)}
                  <span class="badge badge-bnpl"
                    >{$_("admin.bnpl") || "BNPL"}</span
                  >
                {/if}
                {#if isSameDayDelivery(payload)}
                  <span class="badge badge-ssd">{$_("admin.ssd") || "SSD"}</span
                  >
                {/if}
              </div>
            </div>
          </div>

          <!-- Individual Seller Orders -->
          {#if isLoadingOrders}
            <div class="section">
              <div class="loading-orders">
                <div class="spinner-inline"></div>
                <p>
                  {$_("admin.loading_individual_orders") ||
                    "Loading individual orders..."}
                </p>
              </div>
            </div>
          {:else if individualOrders.length > 0}
            <div class="section">
              <h3 class="section-title">
                {$_("admin.individual_orders") || "Individual Seller Orders"} ({individualOrders.length})
              </h3>

              {#each individualOrders as order, index}
                {@const originalOrderPayload = order.attributes?.payload?.body}
                {@const orderPayload =
                  orderEditMode[order.shortname] &&
                  orderEditDrafts[order.shortname]
                    ? orderEditDrafts[order.shortname]
                    : originalOrderPayload}
                {@const orderState = order.attributes?.state || "pending"}
                {@const paymentStatus =
                  orderPayload?.payment_status || "pending"}
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
                {@const shipping = orderPayload?.shipping || null}
                {@const coupon = orderPayload?.coupon || null}
                {@const userDetails = orderPayload?.user || null}

                <div class="order-card">
                  <!-- Top row: seller + status + actions select (keep logic) -->
                  <div class="order-card-header">
                    <div class="order-card-title">
                      <span class="order-number">{index + 1}</span>
                      <div>
                        <div class="seller-name">
                          {$_("admin.seller") || "Seller"}:
                          <strong>{order.seller_shortname}</strong>
                        </div>
                        <div class="order-shortname">{order.shortname}</div>
                      </div>
                    </div>
                    <div class="status-stack">
                      <span class="status-label">
                        {$_("admin.payment_status") || "Payment"}
                      </span>
                      <span
                        class="status-badge payment-status {getPaymentStatusColor(
                          paymentStatus,
                        )}"
                      >
                        {getPaymentStatusLabel(paymentStatus)}
                      </span>
                    </div>
                    <div class="order-card-status">
                      <div class="status-stack">
                        <span class="status-label">
                          {$_("admin.order_status") || "Order"}
                        </span>
                        <span class="status-badge {getStatusColor(orderState)}">
                          <svg viewBox="0 0 8 8" fill="currentColor">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                          {getStateLabel(orderState)}
                        </span>
                      </div>

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
                          <option value="">
                            {$_("admin.change_state") || "Change state..."}
                          </option>
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
                        <span class="state-select-disabled">
                          {$_("admin.no_actions") || "No actions"}
                        </span>
                      {/if}

                      <button
                        type="button"
                        class="btn-activation-toggle"
                        onclick={() => handleOrderActiveToggle(order)}
                        disabled={statusToggleLoading[order.shortname]}
                      >
                        {#if statusToggleLoading[order.shortname]}
                          {$_("common.updating") || "Updating..."}
                        {:else if isOrderActive(order)}
                          {$_("admin.deactivate_order") || "Deactivate"}
                        {:else}
                          {$_("admin.activate_order") || "Activate"}
                        {/if}
                      </button>

                      <button
                        type="button"
                        class="btn-activation-toggle"
                        onclick={() =>
                          orderEditMode[order.shortname]
                            ? cancelEditOrder(order.shortname)
                            : startEditOrder(order)}
                      >
                        {orderEditMode[order.shortname]
                          ? $_("common.cancel") || "Cancel"
                          : $_("admin.edit_order") || "Edit Order"}
                      </button>
                    </div>
                  </div>

                  <!-- progress comment (keep) -->
                  <div class="progress-comment">
                    <label for="progress-comment-{order.shortname}">
                      {$_("admin.progress_comment_label") ||
                        "Progress Comment (optional)"}
                    </label>
                    <textarea
                      id="progress-comment-{order.shortname}"
                      rows="2"
                      placeholder={$_("admin.progress_comment_placeholder") ||
                        "Add a comment for this state change..."}
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
                        {$_("admin.cancellation_reason") ||
                          "Cancellation reason"}
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
                          <option value="">
                            {$_("admin.select_reason") || "Select reason..."}
                          </option>
                          {#each getCancellationResolutions() as reason}
                            <option value={reason.key}>{reason.en}</option>
                          {/each}
                        </select>
                        <button
                          class="btn-confirm-cancel"
                          onclick={() => confirmCancellation(order)}
                        >
                          {$_("admin.confirm_cancel") || "Confirm Cancel"}
                        </button>
                      </div>
                    </div>
                  {/if}

                  {#if orderEditMode[order.shortname]}
                    {@const draft =
                      orderEditDrafts[order.shortname] || orderPayload}
                    <div
                      class="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4"
                    >
                      <div class="flex items-center justify-between">
                        <h4 class="text-sm font-semibold text-gray-800">
                          {$_("admin.edit_order_details") ||
                            "Edit order details"}
                        </h4>
                        <button
                          type="button"
                          class="btn-comment"
                          onclick={() => saveOrderEdits(order)}
                          disabled={orderEditSaving[order.shortname]}
                        >
                          {orderEditSaving[order.shortname]
                            ? $_("common.updating") || "Updating..."
                            : $_("common.save") || "Save"}
                        </button>
                      </div>

                      <div class="space-y-3">
                        <div class="flex items-center justify-between">
                          <div class="text-sm font-medium text-gray-700">
                            {$_("admin.items") || "Items"}
                          </div>
                          <button
                            type="button"
                            class="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                            onclick={() => addDraftItem(order.shortname)}
                          >
                            {$_("admin.add_article") || "Add article"}
                          </button>
                        </div>

                        {#if (draft.items || []).length === 0}
                          <div class="text-xs text-gray-500">
                            {$_("admin.no_items") || "No items in this order"}
                          </div>
                        {/if}

                        {#each draft.items || [] as item, itemIndex}
                          <div
                            class="grid grid-cols-12 gap-2 items-end border border-gray-200 bg-white rounded-md p-2"
                          >
                            <div class="col-span-12 md:col-span-6">
                              <div class="block text-xs text-gray-600 mb-1">
                                {$_("admin.select_product") || "Select product"}
                              </div>
                              {#if availableProductsLoading[order.shortname]}
                                <div
                                  class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm flex items-center text-gray-500"
                                >
                                  {$_("common.loading") || "Loading..."}
                                </div>
                              {:else if (availableProducts[order.shortname] || []).length === 0}
                                <div
                                  class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm flex items-center text-gray-400"
                                >
                                  {$_("admin.no_products_available") ||
                                    "No products available"}
                                </div>
                              {:else}
                                <div class="relative">
                                  <input
                                    type="text"
                                    class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                                    placeholder={$_("admin.search_products") ||
                                      "Search by name, SKU..."}
                                    value={productSearchQuery[
                                      order.shortname
                                    ] || ""}
                                    oninput={(e) => {
                                      productSearchQuery[order.shortname] =
                                        e.currentTarget.value;
                                    }}
                                  />
                                  {#if productSearchQuery[order.shortname]?.length >= 1}
                                    {@const filtered = getFilteredProducts(
                                      order.shortname,
                                    )}
                                    {#if filtered.length > 0}
                                      <div
                                        class="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg"
                                      >
                                        {#each filtered as product}
                                          <button
                                            type="button"
                                            class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                                            onclick={() => {
                                              selectProductForItem(
                                                order.shortname,
                                                itemIndex,
                                                product,
                                              );
                                              productSearchQuery[
                                                order.shortname
                                              ] = "";
                                            }}
                                          >
                                            {getProductDisplayLabel(product)}
                                          </button>
                                        {/each}
                                      </div>
                                    {/if}
                                  {/if}
                                </div>
                                {#if item.product_shortname}
                                  <div
                                    class="mt-1 text-xs text-gray-600 truncate"
                                  >
                                    {item.displayname || item.product_shortname}
                                    - {item.sku || "N/A"}
                                  </div>
                                {/if}
                              {/if}
                            </div>

                            <div class="col-span-6 md:col-span-2">
                              <div class="block text-xs text-gray-600 mb-1">
                                {$_("admin.quantity") || "Qty"}
                              </div>
                              <input
                                type="number"
                                min="1"
                                class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                                value={item.quantity ?? 1}
                                oninput={(e) =>
                                  updateDraftItemField(
                                    order.shortname,
                                    itemIndex,
                                    "quantity",
                                    e.currentTarget.value,
                                  )}
                              />
                            </div>

                            <div class="col-span-6 md:col-span-2">
                              <div class="block text-xs text-gray-600 mb-1">
                                {$_("admin.price") || "Price"}
                              </div>
                              <input
                                type="number"
                                min="0"
                                class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                                value={item.price_at_purchase ?? 0}
                                oninput={(e) =>
                                  updateDraftItemField(
                                    order.shortname,
                                    itemIndex,
                                    "price_at_purchase",
                                    e.currentTarget.value,
                                  )}
                              />
                            </div>

                            <div
                              class="col-span-12 md:col-span-2 flex items-end justify-between gap-2"
                            >
                              <div class="text-xs text-gray-600">
                                {formatNumberValue(item.subtotal)}
                                {$_("admin.currency") || "IQD"}
                              </div>
                              <button
                                type="button"
                                class="px-2 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                onclick={() =>
                                  removeDraftItem(order.shortname, itemIndex)}
                              >
                                {$_("common.remove") || "Remove"}
                              </button>
                            </div>
                          </div>
                        {/each}
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <div class="block text-xs text-gray-600 mb-1">
                            {$_("admin.shipping_cost") || "Shipping cost"}
                          </div>
                          <input
                            type="number"
                            min="0"
                            class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                            value={draft.shipping?.cost ?? 0}
                            oninput={(e) =>
                              updateDraftShippingField(
                                order.shortname,
                                "cost",
                                e.currentTarget.value,
                              )}
                          />
                        </div>

                        <div>
                          <div class="block text-xs text-gray-600 mb-1">
                            {$_("admin.shipping_min_days") || "Min days"}
                          </div>
                          <input
                            type="number"
                            min="0"
                            class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                            value={draft.shipping?.min ?? 0}
                            oninput={(e) =>
                              updateDraftShippingField(
                                order.shortname,
                                "min",
                                e.currentTarget.value,
                              )}
                          />
                        </div>

                        <div>
                          <div class="block text-xs text-gray-600 mb-1">
                            {$_("admin.shipping_max_days") || "Max days"}
                          </div>
                          <input
                            type="number"
                            min="0"
                            class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                            value={draft.shipping?.max ?? 0}
                            oninput={(e) =>
                              updateDraftShippingField(
                                order.shortname,
                                "max",
                                e.currentTarget.value,
                              )}
                          />
                        </div>

                        <div>
                          <div class="block text-xs text-gray-600 mb-1">
                            {$_("admin.minimum_retail") || "Minimum retail"}
                          </div>
                          <input
                            type="number"
                            min="0"
                            class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                            value={draft.shipping?.minimum_retail ?? 0}
                            oninput={(e) =>
                              updateDraftShippingField(
                                order.shortname,
                                "minimum_retail",
                                e.currentTarget.value,
                              )}
                          />
                        </div>
                      </div>

                      <div>
                        <div class="block text-xs text-gray-600 mb-1">
                          {$_("admin.coupon") || "Coupon"}
                        </div>
                        <select
                          class="w-full h-9 px-2 border border-gray-300 rounded-md text-sm bg-white"
                          value={selectedCouponCodes[order.shortname] ||
                            "__none__"}
                          onchange={(e) =>
                            handleCouponSelection(order, e.currentTarget.value)}
                        >
                          <option value="__none__">
                            {$_("admin.no_coupon") || "No coupon"}
                          </option>
                          {#each orderCoupons[order.shortname] || [] as couponOption}
                            <option value={couponOption.code}>
                              {getCouponOptionLabel(couponOption)}
                            </option>
                          {/each}
                        </select>
                        {#if orderCouponsLoading[order.shortname]}
                          <div class="text-xs text-gray-500 mt-1">
                            {$_("admin.loading_coupons") ||
                              "Loading coupons..."}
                          </div>
                        {/if}
                        <div class="text-xs text-gray-500 mt-1">
                          {$_("admin.coupon_scope_hint") ||
                            "Coupons include global coupons and this seller's coupons."}
                        </div>
                      </div>

                      <div
                        class="text-xs text-gray-700 bg-white border border-gray-200 rounded-md p-2"
                      >
                        {$_("admin.preview_total") || "Preview total"}: {formatNumberValue(
                          draft.total_amount,
                        )}
                        {$_("admin.currency") || "IQD"}
                      </div>
                    </div>
                  {/if}

                  {#if userDetails}
                    <div class="customer-info-block">
                      <div class="customer-info-title">
                        {$_("admin.customer_information") ||
                          "Customer Information"}
                      </div>

                      <div class="customer-info-grid">
                        <div class="customer-info-row">
                          <span class="customer-info-label"
                            >{$_("PhoneNumber") || "Phone"}</span
                          >
                          <span class="customer-info-value"
                            >{userDetails.phone || "—"}</span
                          >
                        </div>

                        <div class="customer-info-row">
                          <span class="customer-info-label"
                            >{$_("admin.governorate") || "State"}</span
                          >
                          <span class="customer-info-value"
                            >{userDetails.state || "—"}</span
                          >
                        </div>

                        <div class="customer-info-row">
                          <span class="customer-info-label"
                            >{$_("Description") || "Address"}</span
                          >
                          <span class="customer-info-value"
                            >{userDetails.address || "—"}</span
                          >
                        </div>

                        <div class="customer-info-row">
                          <span class="customer-info-label"
                            >{$_("ShortName") || "Shortname"}</span
                          >
                          <span class="customer-info-value"
                            >{userDetails.shortname || "—"}</span
                          >
                        </div>

                        <div class="customer-info-row">
                          <span class="customer-info-label"
                            >{$_("DisplayName") || "Display Name"}</span
                          >
                          <span class="customer-info-value"
                            >{userDetails.displayname || "—"}</span
                          >
                        </div>
                      </div>
                    </div>
                  {/if}

                  <!-- Shipment block (Figma) -->
                  <div class="shipment-block">
                    <div class="shipment-header">
                      <div class="shipment-seller">
                        <div class="shipment-flag">PH</div>
                        <div class="shipment-seller-meta">
                          <div class="shipment-seller-name">
                            {order.seller_shortname}
                          </div>
                          <div class="shipment-seller-id">
                            {order.shortname}
                          </div>
                        </div>
                      </div>

                      <div class="shipment-right">
                        <span
                          class="shipment-status {getStatusColor(orderState)}"
                        >
                          {getStateLabel(orderState)}
                        </span>
                      </div>
                    </div>

                    {#if orderPayload?.items && orderPayload.items.length > 0}
                      <div class="shipment-products">
                        {#each orderPayload.items as item}
                          <div class="shipment-product">
                            <div class="shipment-product-left">
                              <div class="product-image">
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path d="M7 7h10v10H7z" stroke-width="1.5" />
                                  <path
                                    d="M7 14l3-3 3 3 2-2 2 2"
                                    stroke-width="1.5"
                                  />
                                </svg>
                              </div>

                              <div class="product-meta">
                                <div class="product-name">
                                  {item.product_shortname || item.sku}
                                </div>
                                <div class="product-sku">
                                  {$_("admin.sku") || "SKU"}: {item.sku}
                                </div>

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
                            </div>

                            <div class="shipment-product-right">
                              <div class="product-qty">x{item.quantity}</div>
                              <div class="product-price">
                                {(item.subtotal || 0).toLocaleString()}
                                {$_("admin.currency") || "IQD"}
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <!-- Seller order totals (keep) -->
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
                  </div>

                  <!-- Shipping Info (enhanced) -->
                  {#if shipping}
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

                      <div class="shipping-details-grid">
                        {#if shipping.key}
                          <div class="shipping-detail-row">
                            <span class="shipping-detail-label"
                              >{$_("admin.shipping_key") || "Key"}</span
                            >
                            <span class="shipping-detail-value"
                              >{shipping.key}</span
                            >
                          </div>
                        {/if}

                        <div class="shipping-detail-row">
                          <span class="shipping-detail-label">
                            {$_("admin.delivery_label") || "Delivery"}
                          </span>
                          <span class="shipping-detail-value">
                            {shipping.min ?? 0}-{shipping.max ?? 0}
                            {$_("admin.days") || "days"}
                          </span>
                        </div>

                        <div class="shipping-detail-row">
                          <span class="shipping-detail-label">
                            {$_("admin.shipping_cost") || "Shipping cost"}
                          </span>
                          <span class="shipping-detail-value">
                            {formatNumberValue(shipping.cost)}
                            {$_("admin.currency") || "IQD"}
                          </span>
                        </div>

                        <div class="shipping-detail-row">
                          <span class="shipping-detail-label">
                            {$_("admin.minimum_retail") || "Minimum retail"}
                          </span>
                          <span class="shipping-detail-value">
                            {formatNumberValue(shipping.minimum_retail)}
                            {$_("admin.currency") || "IQD"}
                          </span>
                        </div>
                      </div>
                    </div>
                  {/if}

                  {#if coupon}
                    <div class="coupon-info">
                      <div class="coupon-label">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2.17a2 2 0 000 3.66V14a2 2 0 01-2 2H4a2 2 0 01-2-2v-2.17a2 2 0 000-3.66V6z"
                          />
                          <path
                            d="M8 4.5v11"
                            stroke="currentColor"
                            stroke-width="1.2"
                          />
                        </svg>
                        {$_("admin.coupon_details") || "Coupon Details"}
                      </div>

                      <div class="coupon-details-grid">
                        <div class="coupon-detail-row">
                          <span class="coupon-detail-label"
                            >{$_("admin.coupon_code") || "Code"}</span
                          >
                          <span class="coupon-detail-value"
                            >{coupon.code || "—"}</span
                          >
                        </div>

                        <div class="coupon-detail-row">
                          <span class="coupon-detail-label"
                            >{$_("admin.coupon_type") || "Type"}</span
                          >
                          <span class="coupon-detail-value"
                            >{coupon.type || "—"}</span
                          >
                        </div>

                        <div class="coupon-detail-row">
                          <span class="coupon-detail-label">
                            {$_("admin.discount_type") || "Discount type"}
                          </span>
                          <span class="coupon-detail-value"
                            >{coupon.discount_type || "—"}</span
                          >
                        </div>

                        <div class="coupon-detail-row">
                          <span class="coupon-detail-label">
                            {$_("admin.discount_value") || "Discount value"}
                          </span>
                          <span class="coupon-detail-value">
                            {coupon.discount_type === "percentage"
                              ? `${formatNumberValue(coupon.discount_value)}%`
                              : `${formatNumberValue(coupon.discount_value)} ${$_("admin.currency") || "IQD"}`}
                          </span>
                        </div>

                        <div class="coupon-detail-row">
                          <span class="coupon-detail-label">
                            {$_("admin.discount_amount") || "Discount amount"}
                          </span>
                          <span
                            class="coupon-detail-value coupon-discount-value"
                          >
                            -{formatNumberValue(coupon.discount_amount)}
                            {$_("admin.currency") || "IQD"}
                          </span>
                        </div>

                        <div class="coupon-detail-row">
                          <span class="coupon-detail-label">
                            {$_("admin.applies_to_shipping") ||
                              "Applies to shipping"}
                          </span>
                          <span class="coupon-detail-value">
                            {coupon.is_shipping
                              ? $_("common.yes") || "Yes"
                              : $_("common.no") || "No"}
                          </span>
                        </div>
                      </div>
                    </div>
                  {/if}

                  <!-- Comments (keep) -->
                  <div class="comment-form">
                    <div class="comment-form-header">
                      {$_("admin.add_comment") || "Add Comment"}
                    </div>
                    <textarea
                      rows="3"
                      placeholder={$_("admin.comment_placeholder") ||
                        "Write a comment..."}
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
                        ? $_("sending") || "Sending..."
                        : $_("admin.add_comment") || "Add Comment"}
                    </button>
                  </div>

                  {#if orderComments.length > 0}
                    {@const commentGroups = groupCommentsByState(orderComments)}
                    <div class="order-comments">
                      <h4>{$_("admin.comments_title") || "Comments"}</h4>

                      {#each Object.entries(commentGroups) as [commentState, comments]}
                        <div class="comment-group">
                          <div class="comment-group-title">
                            {commentState === "general"
                              ? $_("admin.comments_general") || "General"
                              : getStateLabel(commentState)}
                          </div>

                          {#each comments as comment}
                            <div class="comment-item">
                              <div class="comment-header">
                                <span class="comment-author">
                                  {comment.attributes?.displayname?.en ||
                                    comment.attributes?.owner_shortname ||
                                    $_("common.unknown") ||
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
                                      ? $_("admin.deleting") || "Deleting..."
                                      : $_("common.delete") || "Delete"}
                                  </button>
                                </div>
                              </div>

                              <p class="comment-text">
                                {comment.attributes?.payload?.body?.embedded ||
                                  comment.attributes?.payload?.body?.body ||
                                  $_("common.not_available") ||
                                  "N/A"}
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
              <p>
                {$_("admin.no_individual_orders") ||
                  "No individual orders found for this combined order"}
              </p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Overlay + container */
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
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .modal-title {
    margin: 0;
    font-weight: 500;
    font-size: 18px;
    line-height: 28px;
    letter-spacing: 0;
    color: #111827;
  }

  .modal-subtitle {
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

  .modal-body {
    padding: 16px 20px;
    overflow-y: auto;
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
    .modal-overlay {
      padding: 12px;
    }
    .modal-body {
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
</style>

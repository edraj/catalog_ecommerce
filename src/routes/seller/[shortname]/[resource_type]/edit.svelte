<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { params } from "@roxi/routify";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { ArrowLeftOutline, CheckCircleSolid } from "flowbite-svelte-icons";
  import { getEntity, replaceEntity, updateEntity } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";

  $goto;
  let item = $state(null);
  let isLoading = $state(true);
  let isSaving = $state(false);

  let productForm = $state({
    price: "",
    stock: "",
    sku: "",
  });

  let couponForm = $state({
    type: "value",
    minValue: "",
    maxValue: "",
    amount: "",
  });

  let branchForm = $state({
    name: "",
    country: "",
    state: "",
    city: "",
    address: "",
  });

  let bundleForm = $state({
    price: "",
  });

  let discountForm = $state({
    type: "",
    typeShortname: "",
    value: "",
    validFrom: "",
    validTo: "",
  });

  let availabilityForm = $state({
    hasFastDelivery: false,
    hasFreeShipping: false,
    estShippingFrom: 1,
    estShippingTo: 5,
    warrantyShortname: "",
    commissionCategory: "",
  });

  let variants = $state([]);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  onMount(async () => {
    await loadItem();
  });

  async function loadItem() {
    isLoading = true;
    try {
      const resourceType =
        $params.resource_type === "ticket"
          ? ResourceType.ticket
          : ResourceType.content;
      const response = await getEntity(
        $params.shortname,
        website.main_space,
        $params.subpath,
        resourceType,
        "managed",
      );

      if (response) {
        item = response;
        populateForm();
      } else {
        errorToastMessage("Failed to load item");
      }
    } catch (error) {
      console.error("Error loading item:", error);
      errorToastMessage("Error loading item");
    } finally {
      isLoading = false;
    }
  }

  function populateForm() {
    const content = getContent(item);
    if (!content) return;

    const itemType = getItemType(content);

    if (itemType === "availability") {
      availabilityForm = {
        hasFastDelivery: content.has_fast_delivery || false,
        hasFreeShipping: content.has_free_shipping || false,
        estShippingFrom: content.est_shipping_days?.from || 1,
        estShippingTo: content.est_shipping_days?.to || 5,
        warrantyShortname: content.warranty_shortname || "",
        commissionCategory: content.commission_category || "",
      };
      variants = content.variants || [];
    } else if (itemType === "product") {
      productForm = {
        price: content.price?.toString() || "",
        stock: content.stock?.toString() || "",
        sku: content.sku || "",
      };
    } else if (itemType === "coupon") {
      couponForm = {
        code: content.code || "",
        type: content.type || "individual",
        discountType: content.discount_type || "percentage",
        discountValue: content.discount_value?.toString() || "",
        minimumSpend: content.minimum_spend?.toString() || "",
        maximumAmount: content.maximum_amount?.toString() || "",
        maximumUses: content.maximum_uses?.toString() || "",
        maximumPerUser: content.maximum_per_user?.toString() || "1",
        validFrom: content.validity?.from || "",
        validTo: content.validity?.to || "",
        brandShortnames: content.applies_to?.brand_shortnames || [],
      };
    } else if (itemType === "branch") {
      branchForm = {
        name: content.name || "",
        country: content.country || "",
        state: content.state || "",
        city: content.city || "",
        address: content.address || "",
      };
    } else if (itemType === "bundle") {
      bundleForm = {
        price: content.price?.toString() || "",
      };
    } else if (itemType === "discount") {
      discountForm = {
        type: content.type || "",
        typeShortname: content.type_shortname || "",
        value: content.value?.toString() || "",
        validFrom: content.validity?.from || "",
        validTo: content.validity?.to || "",
      };
    }
  }

  function goBack() {
    $goto("/seller/[shortname]/[resource_type]", {
      space_name: website.main_space,
      subpath: $params.subpath,
      shortname: $params.shortname,
      resource_type: $params.resource_type,
    });
  }

  async function saveChanges() {
    const content = getContent(item);
    if (!content) return;

    const itemType = getItemType(content);
    let updatedContent = { ...content };

    if (itemType === "availability") {
      updatedContent = {
        ...updatedContent,
        has_fast_delivery: availabilityForm.hasFastDelivery,
        has_free_shipping: availabilityForm.hasFreeShipping,
        est_shipping_days: {
          from: availabilityForm.estShippingFrom || 1,
          to: availabilityForm.estShippingTo || 5,
        },
        warranty_shortname: availabilityForm.warrantyShortname,
        commission_category: availabilityForm.commissionCategory,
        variants: variants,
      };
    } else if (itemType === "product") {
      if (!productForm.price || !productForm.stock) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock),
        sku: productForm.sku,
      };
    } else if (itemType === "coupon") {
      if (
        !couponForm.code ||
        !couponForm.discountValue ||
        !couponForm.validFrom ||
        !couponForm.validTo
      ) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        code: couponForm.code.toUpperCase(),
        type: couponForm.type,
        discount_type: couponForm.discountType,
        discount_value: parseFloat(couponForm.discountValue),
        minimum_spend: couponForm.minimumSpend
          ? parseFloat(couponForm.minimumSpend)
          : 0,
        maximum_amount: couponForm.maximumAmount
          ? parseFloat(couponForm.maximumAmount)
          : null,
        maximum_uses: couponForm.maximumUses
          ? parseInt(couponForm.maximumUses)
          : null,
        maximum_per_user: parseInt(couponForm.maximumPerUser) || 1,
        usage_count: content.usage_count || 0,
        validity: {
          from: couponForm.validFrom,
          to: couponForm.validTo,
        },
        applies_to: {
          brand_shortnames: couponForm.brandShortnames,
        },
        seller_shortname: content.seller_shortname,
      };
    } else if (itemType === "branch") {
      if (
        !branchForm.name ||
        !branchForm.country ||
        !branchForm.state ||
        !branchForm.city ||
        !branchForm.address
      ) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        name: branchForm.name,
        country: branchForm.country,
        state: branchForm.state,
        city: branchForm.city,
        address: branchForm.address,
      };
    } else if (itemType === "bundle") {
      if (!bundleForm.price) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        price: parseFloat(bundleForm.price),
      };
    } else if (itemType === "discount") {
      if (
        !discountForm.type ||
        !discountForm.typeShortname ||
        !discountForm.value ||
        !discountForm.validFrom ||
        !discountForm.validTo
      ) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      updatedContent = {
        ...updatedContent,
        type: discountForm.type,
        type_shortname: discountForm.typeShortname,
        value: parseInt(discountForm.value),
        validity: {
          from: discountForm.validFrom,
          to: discountForm.validTo,
        },
      };
    }

    isSaving = true;
    try {
      const resourceType =
        $params.resource_type === "ticket"
          ? ResourceType.ticket
          : ResourceType.content;
      await replaceEntity(
        item.shortname,
        website.main_space,
        $params.subpath,
        resourceType,
        {
          content: updatedContent,
        },
        "",
        "",
      );

      successToastMessage("Item updated successfully");
      goBack();
    } catch (error) {
      console.error("Error updating item:", error);
      errorToastMessage("Failed to update item");
    } finally {
      isSaving = false;
    }
  }

  function getLocalizedDisplayName(item) {
    const displayname = item?.attributes?.displayname || item?.displayname;

    if (!displayname) {
      return item?.shortname || $_("seller_dashboard.untitled");
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item?.shortname || $_("seller_dashboard.untitled");
  }

  function getContent(item) {
    const payload = item?.attributes?.payload || item?.payload;
    if (!payload || !payload.body) return null;

    return payload.body.content || payload.body;
  }

  function getItemType(content) {
    if (!content) return "unknown";

    if (content.product_shortname || content.variants) {
      return "availability";
    } else if (content.product_id || content.category_id) {
      return "product";
    } else if (content.code || (content.type && content.discount_type)) {
      return "coupon";
    } else if (content.type && content.type_shortname && content.validity) {
      return "discount";
    } else if (content.country || content.city) {
      return "branch";
    } else if (content.product_ids || content.price !== undefined) {
      return "bundle";
    }

    return "unknown";
  }
</script>

<div class="edit-container">
  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">
        {$_("seller_dashboard.loading") || "Loading..."}
      </p>
    </div>
  {:else if item}
    <!-- Header -->
    <div class="edit-header">
      <button class="back-button" onclick={goBack}>
        <ArrowLeftOutline class="back-icon" />
        <span class="back-text">{$_("seller_dashboard.back") || "Back"}</span>
      </button>

      <button class="save-button" onclick={saveChanges} disabled={isSaving}>
        {#if isSaving}
          <div class="mini-spinner"></div>
        {:else}
          <CheckCircleSolid class="save-icon" />
        {/if}
        <span
          >{isSaving
            ? $_("seller_dashboard.saving") || "Saving..."
            : $_("seller_dashboard.save_changes") || "Save Changes"}</span
        >
      </button>
    </div>

    <!-- Content -->
    <div class="edit-content">
      <div class="content-header">
        <h1 class="content-title" class:rtl={$isRTL}>
          {$_("seller_dashboard.edit") || "Edit"}: {getLocalizedDisplayName(
            item,
          )}
        </h1>
        <p class="content-shortname">{item.shortname}</p>
      </div>

      <div class="content-body">
        {#if getItemType(getContent(item)) === "availability"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-section">
              <h2 class="section-title">
                {$_("seller_dashboard.shipping_options") || "Shipping Options"}
              </h2>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={availabilityForm.hasFastDelivery}
                    class="form-checkbox"
                  />
                  <span
                    >{$_("seller_dashboard.fast_delivery") ||
                      "Fast Delivery"}</span
                  >
                </label>
              </div>

              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={availabilityForm.hasFreeShipping}
                    class="form-checkbox"
                  />
                  <span
                    >{$_("seller_dashboard.free_shipping") ||
                      "Free Shipping"}</span
                  >
                </label>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" class:rtl={$isRTL}>
                    <span
                      >{$_("seller_dashboard.est_shipping_from") ||
                        "Shipping From (days)"}</span
                    >
                  </label>
                  <input
                    type="number"
                    min="1"
                    bind:value={availabilityForm.estShippingFrom}
                    class="form-input"
                    class:rtl={$isRTL}
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" class:rtl={$isRTL}>
                    <span
                      >{$_("seller_dashboard.est_shipping_to") ||
                        "Shipping To (days)"}</span
                    >
                  </label>
                  <input
                    type="number"
                    min="1"
                    bind:value={availabilityForm.estShippingTo}
                    class="form-input"
                    class:rtl={$isRTL}
                  />
                </div>
              </div>
            </div>

            <div class="form-section">
              <h2 class="section-title">
                {$_("seller_dashboard.additional_info") ||
                  "Additional Information"}
              </h2>

              <div class="form-group">
                <label class="form-label" class:rtl={$isRTL}>
                  <span
                    >{$_("seller_dashboard.warranty_shortname") ||
                      "Warranty Shortname"}</span
                  >
                </label>
                <input
                  type="text"
                  bind:value={availabilityForm.warrantyShortname}
                  placeholder={$_("seller_dashboard.enter_warranty") ||
                    "Enter warranty shortname"}
                  class="form-input"
                  class:rtl={$isRTL}
                />
              </div>

              <div class="form-group">
                <label class="form-label" class:rtl={$isRTL}>
                  <span
                    >{$_("seller_dashboard.commission_category") ||
                      "Commission Category"}</span
                  >
                </label>
                <input
                  type="text"
                  bind:value={availabilityForm.commissionCategory}
                  placeholder={$_("seller_dashboard.enter_commission") ||
                    "Enter commission category"}
                  class="form-input"
                  class:rtl={$isRTL}
                />
              </div>
            </div>

            {#if variants && variants.length > 0}
              <div class="form-section">
                <h2 class="section-title">
                  {$_("seller_dashboard.variants") || "Variants"} ({variants.length})
                </h2>
                <p class="section-note">
                  {$_("seller_dashboard.variants_readonly_note") ||
                    "Variant details are read-only. To modify variants, please create a new availability entry."}
                </p>
                <div class="variants-preview">
                  {#each variants as variant, index}
                    <div class="variant-preview-card">
                      <div class="variant-preview-header">
                        <span class="variant-number">Variant {index + 1}</span>
                        <span class="variant-price"
                          >${variant.retail_price}</span
                        >
                      </div>
                      <div class="variant-preview-details">
                        <span class="variant-detail"
                          >SKU: {variant.sku || "N/A"}</span
                        >
                        <span class="variant-detail">Qty: {variant.qty}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </form>
        {:else if getItemType(getContent(item)) === "product"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.price") || "Price"} *</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={productForm.price}
                placeholder={$_("seller_dashboard.enter_price") ||
                  "Enter price"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.stock") || "Stock"} *</span>
              </label>
              <input
                type="number"
                min="0"
                bind:value={productForm.stock}
                placeholder={$_("seller_dashboard.enter_stock") ||
                  "Enter stock quantity"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.sku") || "SKU"}</span>
              </label>
              <input
                type="text"
                bind:value={productForm.sku}
                placeholder={$_("seller_dashboard.enter_sku") || "Enter SKU"}
                class="form-input"
                class:rtl={$isRTL}
              />
            </div>
          </form>
        {:else if getItemType(getContent(item)) === "coupon"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.coupon_code") || "Coupon Code"} *</span
                >
              </label>
              <input
                type="text"
                bind:value={couponForm.code}
                placeholder={$_("seller_dashboard.enter_coupon_code") ||
                  "Enter coupon code"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.coupon_type") || "Coupon Type"} *</span
                >
              </label>
              <select
                bind:value={couponForm.type}
                class="form-select"
                class:rtl={$isRTL}
                required
              >
                <option value="individual"
                  >{$_("seller_dashboard.individual") || "Individual"}</option
                >
                <option value="bulk"
                  >{$_("seller_dashboard.bulk") || "Bulk"}</option
                >
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.discount_type") || "Discount Type"} *</span
                >
              </label>
              <select
                bind:value={couponForm.discountType}
                class="form-select"
                class:rtl={$isRTL}
                required
              >
                <option value="percentage"
                  >{$_("seller_dashboard.percentage") || "Percentage"}</option
                >
                <option value="fixed"
                  >{$_("seller_dashboard.fixed") || "Fixed Amount"}</option
                >
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.discount_value") || "Discount Value"} *</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.discountValue}
                placeholder={couponForm.discountType === "percentage"
                  ? "e.g., 20 for 20%"
                  : "e.g., 10 for $10"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.minimum_spend") ||
                    "Minimum Spend"}</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.minimumSpend}
                placeholder={$_("seller_dashboard.enter_minimum_spend") ||
                  "Enter minimum spend"}
                class="form-input"
                class:rtl={$isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.maximum_amount") ||
                    "Maximum Discount Amount"}</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={couponForm.maximumAmount}
                placeholder={$_("seller_dashboard.enter_maximum_amount") ||
                  "Enter maximum discount (optional)"}
                class="form-input"
                class:rtl={$isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.maximum_uses") ||
                    "Maximum Total Uses"}</span
                >
              </label>
              <input
                type="number"
                min="1"
                bind:value={couponForm.maximumUses}
                placeholder={$_("seller_dashboard.enter_maximum_uses") ||
                  "Enter max uses (optional)"}
                class="form-input"
                class:rtl={$isRTL}
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.maximum_per_user") ||
                    "Maximum Per User"} *</span
                >
              </label>
              <input
                type="number"
                min="1"
                bind:value={couponForm.maximumPerUser}
                placeholder="1"
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.valid_from") || "Valid From"} *</span
                >
              </label>
              <input
                type="date"
                bind:value={couponForm.validFrom}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.valid_to") || "Valid To"} *</span>
              </label>
              <input
                type="date"
                bind:value={couponForm.validTo}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            {#if couponForm.brandShortnames && couponForm.brandShortnames.length > 0}
              <div class="form-group">
                <label class="form-label" class:rtl={$isRTL}>
                  <span
                    >{$_("seller_dashboard.applies_to_brands") ||
                      "Applies To Brands"}</span
                  >
                </label>
                <div class="brand-tags">
                  {#each couponForm.brandShortnames as brand}
                    <span class="brand-tag">{brand}</span>
                  {/each}
                </div>
              </div>
            {/if}
          </form>
        {:else if getItemType(getContent(item)) === "branch"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.branch_name") || "Branch Name"} *</span
                >
              </label>
              <input
                type="text"
                bind:value={branchForm.name}
                placeholder={$_("seller_dashboard.enter_branch_name") ||
                  "Enter branch name"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.country") || "Country"} *</span>
              </label>
              <input
                type="text"
                bind:value={branchForm.country}
                placeholder={$_("seller_dashboard.enter_country") ||
                  "Enter country"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.state") || "State"} *</span>
              </label>
              <input
                type="text"
                bind:value={branchForm.state}
                placeholder={$_("seller_dashboard.enter_state") ||
                  "Enter state"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.city") || "City"} *</span>
              </label>
              <input
                type="text"
                bind:value={branchForm.city}
                placeholder={$_("seller_dashboard.enter_city") || "Enter city"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.address") || "Address"} *</span>
              </label>
              <textarea
                bind:value={branchForm.address}
                placeholder={$_("seller_dashboard.enter_address") ||
                  "Enter full address"}
                class="form-textarea"
                class:rtl={$isRTL}
                rows="3"
                required
              ></textarea>
            </div>
          </form>
        {:else if getItemType(getContent(item)) === "discount"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.discount_type") || "Discount Type"} *</span
                >
              </label>
              <select
                bind:value={discountForm.type}
                class="form-select"
                class:rtl={$isRTL}
                required
              >
                <option value=""
                  >{$_("seller_dashboard.select_type") || "Select Type"}</option
                >
                <option value="brand">Brand</option>
                <option value="category">Category</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.type_shortname") || "Type Shortname"} *</span
                >
              </label>
              <input
                type="text"
                bind:value={discountForm.typeShortname}
                placeholder={$_("seller_dashboard.enter_type_shortname") ||
                  "Enter brand or category shortname"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.discount_value") || "Discount Value"} (%)*</span
                >
              </label>
              <input
                type="number"
                min="0"
                max="100"
                bind:value={discountForm.value}
                placeholder={$_("seller_dashboard.enter_discount_value") ||
                  "Enter discount percentage"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.valid_from") || "Valid From"} *</span
                >
              </label>
              <input
                type="date"
                bind:value={discountForm.validFrom}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span>{$_("seller_dashboard.valid_to") || "Valid To"} *</span>
              </label>
              <input
                type="date"
                bind:value={discountForm.validTo}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>
          </form>
        {:else if getItemType(getContent(item)) === "bundle"}
          <form class="edit-form" onsubmit={(e) => e.preventDefault()}>
            <div class="form-group">
              <label class="form-label" class:rtl={$isRTL}>
                <span
                  >{$_("seller_dashboard.bundle_price") || "Bundle Price"} *</span
                >
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                bind:value={bundleForm.price}
                placeholder={$_("seller_dashboard.enter_price") ||
                  "Enter price"}
                class="form-input"
                class:rtl={$isRTL}
                required
              />
            </div>

            <div class="info-note">
              <svg
                class="info-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" stroke-width="2" />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 16v-4M12 8h.01"
                />
              </svg>
              <p>
                {$_("seller_dashboard.bundle_products_note") ||
                  "Note: Bundle products cannot be changed after creation. To modify the products, please create a new bundle."}
              </p>
            </div>
          </form>
        {/if}

        <div class="form-footer">
          <p class="required-note">
            * {$_("seller_dashboard.required_fields") || "Required fields"}
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p class="empty-text">
        {$_("seller_dashboard.item_not_found") || "Item not found"}
      </p>
      <button class="back-button-large" onclick={goBack}>
        {$_("seller_dashboard.go_back") || "Go Back"}
      </button>
    </div>
  {/if}
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .edit-container {
    min-height: 100vh;
    padding: 2rem;
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: white;
    font-size: 1.125rem;
    font-weight: 500;
  }

  /* Header */
  .edit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
    color: #1f2937;
  }

  .back-button:active {
    transform: scale(0.98);
  }

  .save-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(34, 197, 94, 0.9);
    border: 2px solid rgba(34, 197, 94, 1);
    border-radius: 0.75rem;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .save-button:hover:not(:disabled) {
    background: rgba(34, 197, 94, 1);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
  }

  .save-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mini-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Content */
  .edit-content {
    background: white;
    border-radius: 1.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .content-header {
    background: #281f51;
    padding: 2rem;
    color: white;
  }

  .content-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .content-title.rtl {
    text-align: right;
  }

  .content-shortname {
    font-size: 0.875rem;
    opacity: 0.9;
    font-family: monospace;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 0.5rem;
    display: inline-block;
  }

  .content-body {
    padding: 2rem;
  }

  /* Form Styles */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-label.rtl {
    flex-direction: row-reverse;
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 1rem;
    color: #1f2937;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #281f51;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-input.rtl,
  .form-select.rtl,
  .form-textarea.rtl {
    text-align: right;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }

  .info-note {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    margin-top: 1rem;
  }

  .info-icon {
    width: 1.5rem;
    height: 1.5rem;
    stroke: #3b82f6;
    flex-shrink: 0;
  }

  .info-note p {
    margin: 0;
    font-size: 0.875rem;
    color: #1e40af;
    line-height: 1.5;
  }

  .form-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .required-note {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 2rem;
  }

  .empty-text {
    color: white;
    font-size: 1.5rem;
    font-weight: 500;
  }

  .back-button-large {
    padding: 1rem 2rem;
    background: white;
    color: #281f51;
    border: none;
    border-radius: 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .back-button-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .edit-container {
      padding: 1rem;
    }

    .edit-header {
      flex-direction: column;
      align-items: stretch;
    }

    .save-button {
      justify-content: center;
    }

    .content-header {
      padding: 1.5rem;
    }

    .content-title {
      font-size: 1.5rem;
    }

    .content-body {
      padding: 1.5rem;
    }
  }

  /* Availability Form Styles */
  .form-section {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1.25rem 0;
  }

  .section-note {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
    padding: 0.75rem;
    background: #f9fafb;
    border-left: 3px solid #3b82f6;
    border-radius: 0.25rem;
  }

  .checkbox-group {
    margin-bottom: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .form-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: #3b82f6;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .variants-preview {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .variant-preview-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .variant-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .variant-number {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
  }

  .variant-price {
    font-size: 1rem;
    font-weight: 700;
    color: #3b82f6;
  }

  .variant-preview-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .variant-detail {
    font-size: 0.875rem;
    color: #6b7280;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .variants-preview {
      grid-template-columns: 1fr;
    }
  }
</style>

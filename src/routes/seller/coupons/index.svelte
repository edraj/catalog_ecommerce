<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import { ResourceType } from "@edraj/tsdmart";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {
    getLocalizedDisplayName,
    filterItems,
  } from "@/lib/utils/sellerUtils";
  import "../styles/index.css";
  import CouponModal from "@/components/sellers/CouponModal.svelte";
  import EditModal from "@/components/sellers/EditModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";
  import { website } from "@/config";

  $goto;
  let items = $state([]);
  let filteredItems = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");

  let showCouponModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToEdit = $state(null);
  let itemToDelete = $state(null);

  let couponForm = $state({
    code: "",
    type: "individual",
    discountType: "percentage",
    discountValue: "",
    minimumSpend: "",
    maximumAmount: "",
    maximumUses: "",
    maximumPerUser: "1",
    validFrom: "",
    validTo: "",
    brandShortnames: [],
  });

  let brands = $state([]);
  let isLoadingBrands = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  onMount(async () => {
    await Promise.all([loadCoupons(), loadBrands()]);
  });

  async function loadCoupons() {
    isLoading = true;
    try {
      const sellerShortname = $user.shortname;
      const response = await getSpaceContents(
        website.main_space,
        `/coupons/${sellerShortname}`,
        "managed",
        1000,
        0,
        true
      );

      if (response?.records) {
        items = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading coupons:", error);
      errorToastMessage("Error loading coupons");
    } finally {
      isLoading = false;
    }
  }

  async function loadBrands() {
    isLoadingBrands = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        1000,
        0,
        true
      );
      if (response?.records) {
        brands = response.records;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      isLoadingBrands = false;
    }
  }

  function applyFilters() {
    if (!searchTerm.trim()) {
      filteredItems = [...items];
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    filteredItems = items.filter((item) => {
      const displayname = getItemDisplayName(item).toLowerCase();
      const code = item.attributes?.payload?.body?.code?.toLowerCase() || "";
      return displayname.includes(searchLower) || code.includes(searchLower);
    });
  }

  function openCouponModal() {
    showCouponModal = true;
    couponForm = {
      code: "",
      type: "individual",
      discountType: "percentage",
      discountValue: "",
      minimumSpend: "",
      maximumAmount: "",
      maximumUses: "",
      maximumPerUser: "1",
      validFrom: "",
      validTo: "",
      brandShortnames: [],
    };
  }

  function closeCouponModal() {
    showCouponModal = false;
  }

  async function submitCoupon() {
    if (
      !couponForm.code ||
      !couponForm.discountValue ||
      !couponForm.validFrom ||
      !couponForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const couponData = {
        displayname_en: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
        displayname_ar: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
        displayname_ku: null,
        body: {
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
          usage_count: 0,
          validity: {
            from: couponForm.validFrom,
            to: couponForm.validTo,
          },
          applies_to: {
            brand_shortnames: couponForm.brandShortnames,
          },
          seller_shortname: $user.shortname,
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        couponData,
        website.main_space,
        `/coupons/${$user.shortname}`,
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Coupon created successfully!");
      closeCouponModal();
      await loadCoupons();
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage("Failed to create coupon");
    } finally {
      isLoading = false;
    }
  }

  async function openEditModal(item) {
    itemToEdit = item;
    const content = item.attributes?.payload?.body;

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
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    itemToEdit = null;
  }

  async function submitEdit() {
    if (!itemToEdit) return;

    if (
      !couponForm.code ||
      !couponForm.discountValue ||
      !couponForm.validFrom ||
      !couponForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const updateData = {
        displayname_en: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
        displayname_ar: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
        displayname_ku: null,
        body: {
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
          usage_count: itemToEdit.attributes?.payload?.body?.usage_count || 0,
          validity: {
            from: couponForm.validFrom,
            to: couponForm.validTo,
          },
          applies_to: {
            brand_shortnames: couponForm.brandShortnames,
          },
          seller_shortname: $user.shortname,
        },
        tags: [],
        is_active: true,
      };

      await updateEntity(
        itemToEdit.shortname,
        website.main_space,
        itemToEdit.subpath,
        itemToEdit.resource_type,
        updateData,
        "",
        ""
      );

      successToastMessage("Coupon updated successfully!");
      closeEditModal();
      await loadCoupons();
    } catch (error) {
      console.error("Error updating coupon:", error);
      errorToastMessage("Failed to update coupon");
    } finally {
      isLoading = false;
    }
  }

  function openDeleteModal(item) {
    itemToDelete = item;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    itemToDelete = null;
  }

  async function confirmDelete() {
    if (!itemToDelete) return;

    try {
      isLoading = true;

      await deleteEntity(
        itemToDelete.shortname,
        itemToDelete.space_name,
        itemToDelete.subpath,
        itemToDelete.resource_type
      );

      successToastMessage("Coupon deleted successfully!");
      closeDeleteModal();
      await loadCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      errorToastMessage("Failed to delete coupon");
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    applyFilters();
  });
</script>

<div class="seller-page-container">
  <div class="seller-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <button class="back-button" onclick={() => $goto("/seller")}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M12 5l-5 5 5 5"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {$_("common.back")}
        </button>
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("seller_dashboard.coupons")}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            Manage your coupon codes
          </p>
        </div>
        <button class="btn-primary" onclick={openCouponModal}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M10 5v10M5 10h10"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          {$_("seller_dashboard.add_coupon")}
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="filters-section">
      <div class="search-bar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" stroke-width="2" />
          <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("seller_dashboard.search_coupons")}
        />
      </div>
    </div>

    <!-- Coupons Table -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading")}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="12" width="32" height="24" rx="2" stroke-width="2" />
          <circle cx="14" cy="24" r="2" fill="currentColor" />
          <circle cx="34" cy="24" r="2" fill="currentColor" />
          <path
            d="M20 24h8"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray="2 2"
          />
        </svg>
        <h3>{$_("seller_dashboard.no_coupons")}</h3>
        <p>{$_("seller_dashboard.add_first_coupon")}</p>
        <button class="btn-primary" onclick={openCouponModal}>
          {$_("seller_dashboard.add_coupon")}
        </button>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("seller_dashboard.showing")}
          <strong>{filteredItems.length}</strong>
          {$_("seller_dashboard.coupons")}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("seller_dashboard.code")}</th>
              <th>{$_("seller_dashboard.type")}</th>
              <th>{$_("seller_dashboard.discount")}</th>
              <th>{$_("seller_dashboard.validity")}</th>
              <th>{$_("seller_dashboard.usage")}</th>
              <th>{$_("seller_dashboard.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredItems as item (item.shortname)}
              {@const content = item.attributes?.payload?.body}
              <tr>
                <td>
                  <div class="item-name">{content.code}</div>
                </td>
                <td>
                  <span class="status-badge">
                    {content.type}
                  </span>
                </td>
                <td>
                  {#if content.discount_type === "percentage"}
                    {content.discount_value}%
                  {:else}
                    {content.discount_value} IQD
                  {/if}
                </td>
                <td>
                  <div class="product-info">
                    {formatDate(content.validity?.from)} - {formatDate(
                      content.validity?.to
                    )}
                  </div>
                </td>
                <td>
                  {content.usage_count || 0}
                  {#if content.maximum_uses}
                    / {content.maximum_uses}
                  {/if}
                </td>
                <td>
                  <div class="action-buttons">
                    <button
                      class="btn-icon"
                      onclick={() => openEditModal(item)}
                      title={$_("common.edit")}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M11 2l3 3-9 9H2v-3l9-9z"
                          stroke-width="1.5"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      class="btn-icon"
                      onclick={() => openDeleteModal(item)}
                      title={$_("common.delete")}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M2 4h12M5 4V2h6v2M3 4h10l-1 10H4L3 4z"
                          stroke-width="1.5"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Coupon Modal -->
<CouponModal
  bind:show={showCouponModal}
  isRTL={$isRTL}
  bind:couponForm
  {brands}
  {isLoadingBrands}
  onClose={closeCouponModal}
  onSubmit={submitCoupon}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Edit Modal -->
{#if showEditModal && itemToEdit}
  <CouponModal
    bind:show={showEditModal}
    isRTL={$isRTL}
    bind:couponForm
    {brands}
    {isLoadingBrands}
    onClose={closeEditModal}
    onSubmit={submitEdit}
    getLocalizedDisplayName={getItemDisplayName}
  />
{/if}

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  show={showDeleteModal}
  item={itemToDelete}
  {isLoading}
  onClose={closeDeleteModal}
  onConfirm={confirmDelete}
/>

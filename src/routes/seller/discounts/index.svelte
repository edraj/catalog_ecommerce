<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import "../styles/index.css";
  import DiscountModal from "@/components/sellers/DiscountModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";

  $goto;
  let items = $state([]);
  let filteredItems = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");

  let showDiscountModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToDelete = $state(null);
  let editingItem = $state(null);
  let isEditMode = $state(false);

  let discountForm = $state({
    type: "",
    typeShortname: "",
    value: "",
    discountType: "percentage",
    validFrom: "",
    validTo: "",
  });

  let brands = $state([]);
  let discountCategories = $state([]);
  let isLoadingBrands = $state(false);
  let isLoadingDiscountCategories = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  onMount(async () => {
    await Promise.all([
      loadDiscounts(),
      loadBrands(),
      loadDiscountCategories(),
    ]);
  });

  async function loadDiscounts() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${$user.shortname}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find((r) => r.resource_type === "content") ||
        response?.records?.[0];

      if (configEntry?.attributes?.payload?.body?.items) {
        items = configEntry.attributes.payload.body.items.map(
          (item, index) => ({
            ...item,
            _key: item.key || `discount_${index}`,
            _isDiscountItem: true,
            _configEntry: configEntry,
          }),
        );
        applyFilters();
      } else {
        items = [];
        filteredItems = [];
      }
    } catch (error) {
      console.error("Error loading discounts:", error);
      errorToastMessage("Error loading discounts");
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
        true,
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

  async function loadDiscountCategories() {
    isLoadingDiscountCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true,
      );

      if (response?.records) {
        discountCategories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      isLoadingDiscountCategories = false;
    }
  }

  function applyFilters() {
    if (!searchTerm.trim()) {
      filteredItems = [...items];
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    filteredItems = items.filter((item) => {
      const type = item.type?.toLowerCase() || "";
      const typeShortname = item.type_shortname?.toLowerCase() || "";
      return type.includes(searchLower) || typeShortname.includes(searchLower);
    });
  }

  function openDiscountModal() {
    showDiscountModal = true;
    isEditMode = false;
    editingItem = null;
    discountForm = {
      type: "",
      typeShortname: "",
      value: "",
      discountType: "percentage",
      validFrom: "",
      validTo: "",
    };
  }

  function openEditModal(item) {
    editingItem = item;
    isEditMode = true;
    discountForm = {
      type: item.type || "",
      typeShortname: item.type_shortname || "",
      value: item.discount_value?.toString() || "",
      discountType: item.discount_type || "percentage",
      validFrom: item.validity?.from || "",
      validTo: item.validity?.to || "",
    };
    showDiscountModal = true;
  }

  function closeDiscountModal() {
    showDiscountModal = false;
  }

  async function submitDiscount() {
    if (
      !discountForm.value ||
      !discountForm.validFrom ||
      !discountForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    if (discountForm.type && !discountForm.typeShortname) {
      errorToastMessage("Please select a specific category or brand");
      return;
    }

    try {
      isLoading = true;

      const itemKey = isEditMode
        ? editingItem.key
        : `discount_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const discountItem = {
        key: itemKey,
        type: discountForm.type || null,
        type_shortname: discountForm.typeShortname || null,
        states: [],
        validity: {
          from: discountForm.validFrom,
          to: discountForm.validTo,
        },
        discount_type: discountForm.discountType,
        discount_value: parseFloat(discountForm.value),
      };

      const response = await getSpaceContents(
        website.main_space,
        `/discounts/${$user.shortname}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        response?.records?.find((r) => r.resource_type === "content") ||
        response?.records?.[0];

      if (configEntry) {
        const currentItems = configEntry.attributes?.payload?.body?.items || [];

        let updatedItems;
        if (isEditMode) {
          updatedItems = currentItems.map((item) =>
            item.key === itemKey ? discountItem : item,
          );
        } else {
          updatedItems = [...currentItems, discountItem];
        }

        const updatedBody = {
          items: updatedItems,
          seller_shortname: $user.shortname,
        };

        await updateEntity(
          configEntry.shortname,
          website.main_space,
          `/discounts/${$user.shortname}`,
          ResourceType.content,
          {
            displayname_en: "Configuration",
            displayname_ar: null,
            displayname_ku: null,
            body: updatedBody,
            tags: [],
            is_active: true,
          },
          "",
          "",
        );
      } else {
        await createEntity(
          {
            displayname_en: "Configuration",
            displayname_ar: null,
            displayname_ku: null,
            body: {
              items: [discountItem],
              seller_shortname: $user.shortname,
            },
            tags: [],
            is_active: true,
          },
          website.main_space,
          `/discounts/${$user.shortname}`,
          ResourceType.content,
          "",
          "",
        );
      }

      successToastMessage(
        isEditMode
          ? "Discount updated successfully!"
          : "Discount created successfully!",
      );
      closeDiscountModal();
      await loadDiscounts();
    } catch (error) {
      console.error("Error creating discount:", error);
      errorToastMessage("Failed to create discount");
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

      const configEntry = itemToDelete._configEntry;
      if (!configEntry) {
        errorToastMessage("Configuration entry not found");
        return;
      }

      const currentItems = configEntry.attributes?.payload?.body?.items || [];
      const updatedItems = currentItems.filter(
        (item) => item.key !== itemToDelete.key,
      );

      await updateEntity(
        configEntry.shortname,
        website.main_space,
        `/discounts/${$user.shortname}`,
        ResourceType.content,
        {
          displayname_en: "Configuration",
          displayname_ar: null,
          displayname_ku: null,
          body: {
            items: updatedItems,
            seller_shortname: $user.shortname,
          },
          tags: [],
          is_active: true,
        },
        "",
        "",
      );

      successToastMessage("Discount deleted successfully!");
      closeDeleteModal();
      await loadDiscounts();
    } catch (error) {
      console.error("Error deleting discount:", error);
      errorToastMessage("Failed to delete discount");
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
            {$_("seller_dashboard.discounts")}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            Manage product and category discounts
          </p>
        </div>
        <button class="btn-primary" onclick={openDiscountModal}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M10 5v10M5 10h10"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          {$_("seller_dashboard.add_discount")}
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
          placeholder={$_("seller_dashboard.search_discounts")}
        />
      </div>
    </div>

    <!-- Discounts Table -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading")}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <circle cx="24" cy="24" r="16" stroke-width="2" />
          <path d="M24 16v8l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <h3>{$_("seller_dashboard.no_discounts")}</h3>
        <p>{$_("seller_dashboard.add_first_discount")}</p>
        <button class="btn-primary" onclick={openDiscountModal}>
          {$_("seller_dashboard.add_discount")}
        </button>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("seller_dashboard.showing")}
          <strong>{filteredItems.length}</strong>
          {$_("seller_dashboard.discounts")}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("seller_dashboard.type")}</th>
              <th>{$_("seller_dashboard.target")}</th>
              <th>{$_("seller_dashboard.discount")}</th>
              <th>{$_("seller_dashboard.validity")}</th>
              <th>{$_("seller_dashboard.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredItems as item (item._key)}
              <tr class="clickable-row" onclick={() => openEditModal(item)}>
                <td>
                  <span class="status-badge">
                    {item.type || "Global"}
                  </span>
                </td>
                <td>
                  <div class="item-name">
                    {item.type_shortname || "All"}
                  </div>
                </td>
                <td>
                  {#if item.discount_type === "percentage"}
                    {item.discount_value}%
                  {:else}
                    {item.discount_value} IQD
                  {/if}
                </td>
                <td>
                  <div class="product-info">
                    {item.validity?.from} - {item.validity?.to}
                  </div>
                </td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="action-buttons">
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

<!-- Discount Modal -->
<DiscountModal
  bind:show={showDiscountModal}
  isRTL={$isRTL}
  bind:discountForm
  {brands}
  categories={discountCategories}
  {isLoadingBrands}
  isLoadingCategories={isLoadingDiscountCategories}
  onClose={closeDiscountModal}
  onSubmit={submitDiscount}
  getLocalizedDisplayName={getItemDisplayName}
  {isEditMode}
/>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  show={showDeleteModal}
  item={itemToDelete}
  {isLoading}
  onClose={closeDeleteModal}
  onConfirm={confirmDelete}
/>

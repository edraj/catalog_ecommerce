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
    deleteEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import "../styles/index.css";
  import WarrantyModal from "@/components/sellers/WarrantyModal.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";

  $goto;
  let items = $state([]);
  let filteredItems = $state([]);
  let isLoading = $state(true);
  let searchTerm = $state("");

  let showWarrantyModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToDelete = $state(null);
  let editingItem = $state(null);
  let isEditMode = $state(false);

  let warrantyForm = $state({
    displaynameEn: "",
    displaynameAr: "",
    displaynameKu: "",
    descriptionEn: "",
    descriptionAr: "",
    descriptionKu: "",
    isGlobal: true,
    brandShortname: "",
  });

  let brands = $state([]);
  let isLoadingBrands = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  onMount(async () => {
    await Promise.all([loadWarranties(), loadBrands()]);
  });

  async function loadWarranties() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/warranties/${$user.shortname}`,
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        items = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading warranties:", error);
      errorToastMessage("Error loading warranties");
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

  function applyFilters() {
    if (!searchTerm.trim()) {
      filteredItems = [...items];
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    filteredItems = items.filter((item) => {
      const displayname = getItemDisplayName(item).toLowerCase();
      return displayname.includes(searchLower);
    });
  }

  function openWarrantyModal() {
    showWarrantyModal = true;
    isEditMode = false;
    editingItem = null;
    warrantyForm = {
      displaynameEn: "",
      displaynameAr: "",
      displaynameKu: "",
      descriptionEn: "",
      descriptionAr: "",
      descriptionKu: "",
      isGlobal: true,
      brandShortname: "",
    };
  }

  function openEditModal(item) {
    editingItem = item;
    isEditMode = true;
    const body = item.attributes?.payload?.body;
    warrantyForm = {
      displaynameEn: item.attributes?.displayname?.en || "",
      displaynameAr: item.attributes?.displayname?.ar || "",
      displaynameKu: item.attributes?.displayname?.ku || "",
      descriptionEn: item.attributes?.description?.en || "",
      descriptionAr: item.attributes?.description?.ar || "",
      descriptionKu: item.attributes?.description?.ku || "",
      isGlobal: body?.is_global ?? true,
      brandShortname: body?.brand_shortname || "",
    };
    showWarrantyModal = true;
  }

  function closeWarrantyModal() {
    showWarrantyModal = false;
  }

  async function submitWarranty() {
    if (!warrantyForm.displaynameEn || !warrantyForm.descriptionEn) {
      errorToastMessage("Please fill in English name and description");
      return;
    }

    if (!warrantyForm.isGlobal && !warrantyForm.brandShortname) {
      errorToastMessage("Please select a brand for non-global warranty");
      return;
    }

    try {
      isLoading = true;
      const warrantyData = {
        displayname_en: warrantyForm.displaynameEn,
        displayname_ar: warrantyForm.displaynameAr || null,
        displayname_ku: warrantyForm.displaynameKu || null,
        description_en: warrantyForm.descriptionEn,
        description_ar: warrantyForm.descriptionAr || null,
        description_ku: warrantyForm.descriptionKu || null,
        body: {
          is_global: warrantyForm.isGlobal,
          brand_shortname: warrantyForm.isGlobal
            ? null
            : warrantyForm.brandShortname,
        },
        tags: [],
        is_active: true,
      };

      if (isEditMode && editingItem) {
        // Use updateEntity for editing
        const { updateEntity } = await import("@/lib/dmart_services");
        await updateEntity(
          editingItem.shortname,
          website.main_space,
          `/warranties/${$user.shortname}`,
          ResourceType.content,
          warrantyData,
          "",
          "",
        );
        successToastMessage("Warranty updated successfully!");
      } else {
        await createEntity(
          warrantyData,
          website.main_space,
          `/warranties/${$user.shortname}`,
          ResourceType.content,
          "",
          "",
        );
        successToastMessage("Warranty created successfully!");
      }

      closeWarrantyModal();
      await loadWarranties();
    } catch (error) {
      console.error(
        isEditMode ? "Error updating warranty:" : "Error creating warranty:",
        error,
      );
      errorToastMessage(
        isEditMode ? "Failed to update warranty" : "Failed to create warranty",
      );
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
        itemToDelete.resource_type,
      );

      successToastMessage("Warranty deleted successfully!");
      closeDeleteModal();
      await loadWarranties();
    } catch (error) {
      console.error("Error deleting warranty:", error);
      errorToastMessage("Failed to delete warranty");
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
            {$_("seller_dashboard.warranties")}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            Manage warranty policies
          </p>
        </div>
        <button class="btn-primary" onclick={openWarrantyModal}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M10 5v10M5 10h10"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          {$_("seller_dashboard.add_warranty")}
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
          placeholder={$_("seller_dashboard.search_warranties")}
        />
      </div>
    </div>

    <!-- Warranties Table -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading")}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <path
            d="M24 6L8 14v10c0 10 6 18 16 22 10-4 16-12 16-22V14L24 6z"
            stroke-width="2"
          />
        </svg>
        <h3>{$_("seller_dashboard.no_warranties")}</h3>
        <p>{$_("seller_dashboard.add_first_warranty")}</p>
        <button class="btn-primary" onclick={openWarrantyModal}>
          {$_("seller_dashboard.add_warranty")}
        </button>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("seller_dashboard.showing")}
          <strong>{filteredItems.length}</strong>
          {$_("seller_dashboard.warranties")}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("seller_dashboard.name")}</th>
              <th>{$_("seller_dashboard.description")}</th>
              <th>{$_("seller_dashboard.scope")}</th>
              <th>{$_("seller_dashboard.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredItems as item (item.shortname)}
              {@const body = item.attributes?.payload?.body}
              <tr class="clickable-row" onclick={() => openEditModal(item)}>
                <td>
                  <div class="item-name">{getItemDisplayName(item)}</div>
                </td>
                <td>
                  <div class="product-info">
                    {item.attributes?.description_en ||
                      item.attributes?.description?.en ||
                      ""}
                  </div>
                </td>
                <td>
                  <span class="status-badge {body?.is_global ? 'active' : ''}">
                    {body?.is_global
                      ? "Global"
                      : body?.brand_shortname || "Brand Specific"}
                  </span>
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

<!-- Warranty Modal -->
<WarrantyModal
  bind:show={showWarrantyModal}
  isRTL={$isRTL}
  bind:warrantyForm
  {brands}
  {isLoadingBrands}
  onClose={closeWarrantyModal}
  onSubmit={submitWarranty}
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

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

  // -----------------------------
  // Data
  // -----------------------------
  let items = $state<any[]>([]);
  let filteredItems = $state<any[]>([]);
  let isLoading = $state(true);

  let searchTerm = $state("");

  let showWarrantyModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToDelete = $state<any>(null);
  let editingItem = $state<any>(null);
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

  let brands = $state<any[]>([]);
  let isLoadingBrands = $state(false);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  // Helpers (avoid {@const})
  function warrantyBody(item: any) {
    return item?.attributes?.payload?.body || {};
  }

  function warrantyScopeLabel(item: any) {
    const b = warrantyBody(item);
    if (b?.is_global) return "Global";
    return b?.brand_shortname || "Brand Specific";
  }

  function isGlobalWarranty(item: any) {
    return !!warrantyBody(item)?.is_global;
  }

  // -----------------------------
  // Stats
  // -----------------------------
  const totalWarrantiesStat = $derived.by(() => filteredItems.length);

  const globalWarrantiesStat = $derived.by(() => {
    return filteredItems.filter((i) => isGlobalWarranty(i)).length;
  });

  const otherWarrantiesStat = $derived.by(() => {
    return filteredItems.filter((i) => !isGlobalWarranty(i)).length;
  });

  // -----------------------------
  // Lifecycle
  // -----------------------------
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
      } else {
        items = [];
        filteredItems = [];
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
      if (response?.records) brands = response.records;
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      isLoadingBrands = false;
    }
  }

  // -----------------------------
  // Filtering
  // -----------------------------
  function applyFilters() {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) {
      filteredItems = [...items];
      return;
    }

    filteredItems = items.filter((item) => {
      const name = (getItemDisplayName(item) || "").toLowerCase();
      const desc = (
        item?.attributes?.description_en ||
        item?.attributes?.description?.en ||
        ""
      ).toLowerCase();
      const scope = (warrantyScopeLabel(item) || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || scope.includes(q);
    });
  }

  $effect(() => {
    applyFilters();
  });

  // -----------------------------
  // Modal open/close
  // -----------------------------
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

  function openEditModal(item: any) {
    editingItem = item;
    isEditMode = true;

    const b = warrantyBody(item);

    warrantyForm = {
      displaynameEn: item?.attributes?.displayname?.en || "",
      displaynameAr: item?.attributes?.displayname?.ar || "",
      displaynameKu: item?.attributes?.displayname?.ku || "",
      descriptionEn:
        item?.attributes?.description?.en ||
        item?.attributes?.description_en ||
        "",
      descriptionAr: item?.attributes?.description?.ar || "",
      descriptionKu: item?.attributes?.description?.ku || "",
      isGlobal: b?.is_global ?? true,
      brandShortname: b?.brand_shortname || "",
    };

    showWarrantyModal = true;
  }

  function closeWarrantyModal() {
    showWarrantyModal = false;
  }

  // -----------------------------
  // Create / Update
  // -----------------------------
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

  // -----------------------------
  // Delete
  // -----------------------------
  function openDeleteModal(item: any) {
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
</script>

<div class="seller-page-container">
  <!-- ✅ Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- Shield icon -->
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Total Warranties
        </h3>
        <p class="stat-value">{totalWarrantiesStat}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- Globe icon -->
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Global Warranties
        </h3>
        <p class="stat-value">{globalWarrantiesStat}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- Tag/label icon -->
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3
          class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]"
        >
          Other Warranties
        </h3>
        <p class="stat-value">{otherWarrantiesStat}</p>
      </div>
    </div>
  </div>

  <!-- ✅ Main content -->
  <div class="seller-page-content" class:rtl={$isRTL}>
    <!-- Header controls -->
    <div
      class="flex flex-col md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <!-- SEARCH -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {$_("common.search") || "Search"}
        </label>

        <div class="relative w-[256px]">
          <div
            class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
          >
            <svg
              class="w-4 h-4 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          <input
            type="text"
            bind:value={searchTerm}
            placeholder={$_("seller_dashboard.search_warranties") ||
              "Search warranties..."}
            class="w-full h-9 pl-9 pr-3 py-2
                 bg-[#F9FAFB]
                 border border-[#E5E7EB]
                 rounded-[12px]
                 shadow-[0px_1px_0.5px_0.05px_#1D293D05]
                 text-sm
                 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      <!-- RIGHT CONTROLS -->
      <div class="flex items-end">
        <button
          onclick={openWarrantyModal}
          class="inline-flex items-center justify-center mx-2
               h-9 cursor-pointer
               px-3 py-2
               bg-[#3C307F] text-white text-sm font-medium
               rounded-[12px]
               shadow-[0px_1s 0.5px_0.05px_#1D293D05]
               hover:bg-[#2f2666]
               transition-colors duration-200"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M10 5v10M5 10h10"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span class="ml-2"
            >{$_("seller_dashboard.add_warranty") || "Add Warranty"}</span
          >
        </button>
      </div>
    </div>

    <!-- Table / States -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🛡️</div>
        <h3>{$_("seller_dashboard.no_warranties") || "No warranties found"}</h3>
        <p>
          {$_("seller_dashboard.add_first_warranty") ||
            "Start by creating your first warranty policy"}
        </p>
        <button class="btn-create-large" onclick={openWarrantyModal}>
          {$_("seller_dashboard.add_warranty") || "Add Warranty"}
        </button>
      </div>
    {:else}
      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("seller_dashboard.name") || "Name"}</th>
              <th>{$_("seller_dashboard.description") || "Description"}</th>
              <th>{$_("seller_dashboard.scope") || "Scope"}</th>
              <th class="col-actions">{$_("common.actions") || "Actions"}</th>
            </tr>
          </thead>

          <tbody>
            {#each filteredItems as item (item.shortname)}
              <tr
                class="item-row"
                onclick={() => openEditModal(item)}
                style="cursor: pointer;"
              >
                <td class="col-main">
                  <div class="item-title">
                    {#if getItemDisplayName(item).length > 32}
                      {getItemDisplayName(item).slice(0, 32)}...
                    {:else}
                      {getItemDisplayName(item)}
                    {/if}
                  </div>
                </td>

                <td>
                  <div class="product-info">
                    {#if (item?.attributes?.description_en || item?.attributes?.description?.en || "").length > 30}
                      {(
                        item?.attributes?.description_en ||
                        item?.attributes?.description?.en ||
                        ""
                      ).slice(0, 30)}...
                    {:else}
                      {item?.attributes?.description_en ||
                        item?.attributes?.description?.en ||
                        ""}
                    {/if}
                  </div>
                </td>

                <td>
                  <span
                    class="status-badge"
                    class:active={isGlobalWarranty(item)}
                    class:pending={!isGlobalWarranty(item)}
                  >
                    {#if isGlobalWarranty(item)}
                      <!-- globe icon -->
                      <svg
                        class="status-icon"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle cx="8" cy="8" r="6" stroke-width="1.5" />
                        <path
                          d="M2 8h12"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                        <path
                          d="M8 2c2.5 2.5 2.5 9.5 0 12"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                        <path
                          d="M8 2c-2.5 2.5-2.5 9.5 0 12"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    {:else}
                      <!-- tag icon -->
                      <svg
                        class="status-icon"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M2 6.5V3.5C2 2.7 2.7 2 3.5 2H7.2c.4 0 .8.2 1.1.4l5.3 5.3c.6.6.6 1.6 0 2.1l-3.8 3.8c-.6.6-1.6.6-2.1 0L2.4 8.3C2.2 8 2 7.7 2 7.2z"
                          stroke-width="1.5"
                          stroke-linejoin="round"
                        />
                        <circle cx="4.5" cy="4.5" r="1" stroke-width="1.5" />
                      </svg>
                    {/if}

                    <span class="status-text">{warrantyScopeLabel(item)}</span>
                  </span>
                </td>

                <td class="flex" onclick={(e) => e.stopPropagation()}>
                  <div class="action-buttons">
                    <button
                      class="action-icon-btn"
                      onclick={() => openDeleteModal(item)}
                      title={$_("common.delete") || "Delete"}
                      aria-label="Delete"
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

  <style>
    .seller-page-container,
    .seller-page-content {
      background: #f9fafb;
      min-height: 100vh;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin: 1rem 0 1.5rem;
    }

    .stat-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: all 0.3s ease;
      box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.1);
    }

    .bg-icon {
      width: 56px;
      height: 56px;
      background: #f3f4ff;
      border: 1px solid #e5e7ff;
      border-radius: 12px;
    }

    .stat-title {
      margin: 0;
      font-size: 0.9rem;
      color: #6b7280;
      font-weight: 600;
    }

    .stat-value {
      margin: 0.25rem 0 0;
      font-size: 1.35rem;
      color: #111827;
      font-weight: 800;
    }

    /* Status badge icon */
    .status-icon {
      width: 14px;
      height: 14px;
      margin-right: 6px;
      flex: 0 0 auto;
    }

    .status-text {
      display: inline-block;
    }

    /* Actions icon button (same spec you used) */
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
    }

    .action-icon-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 10px;
      background: var(--colors-background-bg-secondary-medium, #f9fafb);
      border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
      box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition:
        background 0.2s ease,
        border-color 0.2s ease,
        transform 0.05s ease;
      color: #4a5565;
    }

    .action-icon-btn:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    .action-icon-btn:active {
      transform: translateY(1px);
    }

    .action-icon-btn svg {
      width: 14px;
      height: 14px;
    }

    .action-icon-btn.delete {
      color: #dc2626;
    }

    /* Make table body typography match other pages */
    .items-table tbody td {
      font-weight: 500;
      font-size: 0.875rem;
      line-height: 14px;
      letter-spacing: 0;
      color: #101828;
    }
  </style>
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

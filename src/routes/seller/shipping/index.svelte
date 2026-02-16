<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import { errorToastMessage, successToastMessage } from "@/lib/toasts_messages";
  import { getSpaceContents, createEntity, updateEntity } from "@/lib/dmart_services";
  import { website } from "@/config";
  import "../styles/index.css";
  import ShippingItemModal from "@/components/sellers/ShippingItemModal.svelte";
  import { ResourceType } from "@edraj/tsdmart";

  $goto;

  let isLoading = $state(true);
  let shippingConfig = $state<any>(null);

  let showShippingItemModal = $state(false);
  let editingShippingItemIndex = $state<number | null>(null);

  // (optional) quick search by state label
  let searchTerm = $state("");

  let shippingItemForm = $state<any>({
    states: [],
    settings: [
      { min: "", max: "", cost: "", minimum_retail: "", note: "", is_active: true },
    ],
  });

  const isRTL = derived(locale, ($locale) => $locale === "ar" || $locale === "ku");

  onMount(async () => {
    await loadShippingData();
  });

  function getItems(): any[] {
    return shippingConfig?.attributes?.payload?.body?.items || [];
  }

  function getStateLabel(item: any): string {
    const states = item?.states;
    if (!states || (Array.isArray(states) && states.length === 0)) return "All";
    if (Array.isArray(states)) return states.join(", ");
    return String(states);
  }

  function getTierCost(item: any, tierIndex: number): number | null {
    const settings = item?.settings || [];
    const tier = settings[tierIndex];
    const cost = Number(tier?.cost);
    return Number.isFinite(cost) ? cost : null;
  }

  function getMinRetail(item: any): number | null {
    const settings = item?.settings || [];
    const nums = settings
      .map((s: any) => Number(s?.minimum_retail))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (nums.length === 0) return null;
    return Math.min(...nums);
  }

  // If you store delivery time inside note like "3 days" or "ETA 2", we’ll extract first number.
  // If not present -> null (display "—")
  function parseDeliveryDaysFromNote(note: any): number | null {
    if (!note) return null;
    const s = String(note);
    const m = s.match(/(\d+(\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  function getAvgRetailCost(items: any[]): number | null {
    let sum = 0;
    let count = 0;

    for (const it of items) {
      const mr = getMinRetail(it);
      if (mr !== null) {
        sum += mr;
        count++;
      }
    }

    if (count === 0) return null;
    return sum / count;
  }

  function getAvgDeliveryTime(items: any[]): number | null {
    let sum = 0;
    let count = 0;

    for (const it of items) {
      const settings = it?.settings || [];
      // pick first tier note (common case) OR first note found
      const firstNote = settings.find((s: any) => s?.note)?.note;
      const days = parseDeliveryDaysFromNote(firstNote);
      if (days !== null) {
        sum += days;
        count++;
      }
    }

    if (count === 0) return null;
    return sum / count;
  }

  const filteredItems = $derived.by(() => {
    const all = getItems();
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return all;

    return all.filter((it) => getStateLabel(it).toLowerCase().includes(q));
  });

  const totalShippingsStat = $derived.by(() => filteredItems.length);

  const avgRetailCostStat = $derived.by(() => getAvgRetailCost(filteredItems));

  const avgDeliveryTimeStat = $derived.by(() => getAvgDeliveryTime(filteredItems));

  async function loadShippingData() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/shipping/${$user.shortname}`,
        "managed",
        100,
        0,
        true,
      );

      if (response?.records && response.records.length > 0) {
        shippingConfig = response.records[0];
      } else {
        shippingConfig = {
          attributes: {
            payload: { body: { items: [] } },
          },
        };
      }
    } catch (error) {
      console.error("Error loading shipping data:", error);
      errorToastMessage("Error loading shipping configuration");
    } finally {
      isLoading = false;
    }
  }

  async function saveShippingConfig() {
    try {
      isLoading = true;

      const configData = {
        displayname_en: "Configuration",
        displayname_ar: null,
        displayname_ku: null,
        body: shippingConfig.attributes.payload.body,
        tags: [],
        is_active: true,
      };

      if (shippingConfig?.uuid) {
        await updateEntity(
          shippingConfig.shortname,
          website.main_space,
          `/shipping/${$user.shortname}`,
          shippingConfig.resource_type,
          configData,
          "",
          "",
        );
      } else {
        await createEntity(
          configData,
          website.main_space,
          `/shipping/${$user.shortname}`,
          ResourceType.content,
          "",
          "",
        );
      }

      successToastMessage($_("seller_dashboard.shipping_configured_successfully") || "Shipping saved");
      await loadShippingData();
    } catch (error) {
      console.error("Error saving shipping config:", error);
      errorToastMessage($_("seller_dashboard.failed_to_configure_shipping") || "Failed to save shipping");
    } finally {
      isLoading = false;
    }
  }

  async function submitShippingItem() {
    if (shippingItemForm.settings.some((s: any) => !s.min || !s.max || !s.cost)) {
      errorToastMessage("Please fill in all required fields (min, max, cost)");
      return;
    }

    try {
      isLoading = true;

      const newItem = {
        ...(shippingItemForm.states.length > 0 ? { states: shippingItemForm.states } : {}),
        settings: shippingItemForm.settings.map((s: any) => ({
          min: parseFloat(s.min),
          max: parseFloat(s.max),
          cost: parseFloat(s.cost),
          minimum_retail: s.minimum_retail ? parseFloat(s.minimum_retail) : 0,
          note: s.note || "TRANSLATION_KEY_ONLY",
          is_active: s.is_active,
        })),
      };

      // ensure config shape
      if (!shippingConfig?.attributes) shippingConfig = { attributes: { payload: { body: { items: [] } } } };
      if (!shippingConfig.attributes.payload) shippingConfig.attributes.payload = { body: { items: [] } };
      if (!shippingConfig.attributes.payload.body) shippingConfig.attributes.payload.body = { items: [] };
      if (!shippingConfig.attributes.payload.body.items) shippingConfig.attributes.payload.body.items = [];

      if (editingShippingItemIndex !== null) {
        shippingConfig.attributes.payload.body.items[editingShippingItemIndex] = newItem;
      } else {
        shippingConfig.attributes.payload.body.items.push(newItem);
      }

      await saveShippingConfig();
      closeShippingItemModal();
    } catch (error) {
      console.error("Error saving shipping item:", error);
      errorToastMessage("Failed to save shipping item");
    } finally {
      isLoading = false;
    }
  }

  function openShippingItemModal(itemIndex: number | null = null) {
    editingShippingItemIndex = itemIndex;
    showShippingItemModal = true;

    const items = getItems();

    if (itemIndex !== null) {
      const item = items[itemIndex];
      shippingItemForm = {
        states: item?.states || [],
        settings: (item?.settings || []).map((s: any) => ({
          min: s?.min?.toString() || "",
          max: s?.max?.toString() || "",
          cost: s?.cost?.toString() || "",
          minimum_retail: s?.minimum_retail?.toString() || "",
          note: s?.note || "",
          is_active: s?.is_active ?? true,
        })),
      };
    } else {
      shippingItemForm = {
        states: [],
        settings: [
          { min: "", max: "", cost: "", minimum_retail: "", note: "", is_active: true },
        ],
      };
    }
  }

  function closeShippingItemModal() {
    showShippingItemModal = false;
    editingShippingItemIndex = null;
  }

  async function deleteShippingItem(itemIndex: number) {
    try {
      isLoading = true;

      const items = getItems();
      const next = items.filter((_: any, i: number) => i !== itemIndex);

      shippingConfig.attributes.payload.body.items = next;

      await saveShippingConfig();
      successToastMessage("Shipping item deleted successfully!");
    } catch (error) {
      console.error("Error deleting shipping item:", error);
      errorToastMessage("Failed to delete shipping item");
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
        <!-- box icon -->
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">Total Shippings</h3>
        <p class="stat-value">{totalShippingsStat}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- money icon -->
       <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z" stroke="#3C307F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">Avg Retail Cost</h3>
        <p class="stat-value">
          {avgRetailCostStat === null ? "—" : Math.round(avgRetailCostStat)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- clock icon -->
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 9.75C18.8284 9.75 19.5 10.4216 19.5 11.25V17.3787L22.0607 19.9393C22.6464 20.5251 22.6464 21.4749 22.0607 22.0607C21.4749 22.6464 20.5251 22.6464 19.9393 22.0607L16.9393 19.0607C16.658 18.7794 16.5 18.3978 16.5 18V11.25C16.5 10.4216 17.1716 9.75 18 9.75Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title text-sm font-normal text-[#4A5565] leading-[125%]">Avg Delivery Time</h3>
        <p class="stat-value">
          {avgDeliveryTimeStat === null ? "—" : `${avgDeliveryTimeStat.toFixed(1)} days`}
        </p>
      </div>
    </div>
  </div>

  <div class="seller-page-content" class:rtl={$isRTL}>
    <!-- Controls -->
    <!-- ✅ Header controls (same pattern as other edited pages) -->
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
        placeholder={$_("common.search") || "Search by state..."}
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
      onclick={() => openShippingItemModal(null)}
      class="inline-flex items-center justify-center mx-2
             h-9 cursor-pointer
             px-3 py-2
             bg-[#3C307F] text-white text-sm font-medium
             rounded-[12px]
             shadow-[0px_1px_0.5px_0.05px_#1D293D05]
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
      <span class="ml-2">{$_("seller_dashboard.add_shipping") || "Add Shipping"}</span>
    </button>
  </div>
</div>


    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else}
      {#if filteredItems.length === 0}
        <div class="empty-state">
          <h3>{$_("seller_dashboard.no_shipping") || "No shipping items found"}</h3>
        </div>
      {:else}
        <div class="items-table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th>{$_("common.state") || "State"}</th>
                <th>{$_("seller_dashboard.tier_1_cost") || "Tier 1 Cost"}</th>
                <th>{$_("seller_dashboard.tier_2_cost") || "Tier 2 Cost"}</th>
                <th>{$_("seller_dashboard.min_retail") || "Min Retail"}</th>
                <th class="col-actions">{$_("common.actions") || "Action"}</th>
              </tr>
            </thead>

            <tbody>
              {#each filteredItems as item, idx (idx)}
                <tr class="clickable-row" onclick={() => openShippingItemModal(idx)}>
                  <td>
                    <span class="item-name">{getStateLabel(item)}</span>
                  </td>

                  <td>
                    {#if getTierCost(item, 0) !== null}
                      {getTierCost(item, 0)}
                    {:else}
                      <span class="empty-text">—</span>
                    {/if}
                  </td>

                  <td>
                    {#if getTierCost(item, 1) !== null}
                      {getTierCost(item, 1)}
                    {:else}
                      <span class="empty-text">—</span>
                    {/if}
                  </td>

                  <td>
                    {#if getMinRetail(item) !== null}
                      {getMinRetail(item)}
                    {:else}
                      <span class="empty-text">—</span>
                    {/if}
                  </td>

                  <td class="actions-cell" onclick={(e) => e.stopPropagation()}>
                    <div class="action-buttons">
                     
                      <!-- Delete -->
                      <button
                        class="action-icon-btn"
                        onclick={() => deleteShippingItem(idx)}
                        title={$_("common.delete") || "Delete"}
                        aria-label="Delete"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
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
    {/if}
  </div>
</div>

<!-- Shipping Item Modal -->
<ShippingItemModal
  bind:show={showShippingItemModal}
  bind:form={shippingItemForm}
  {isLoading}
  onClose={closeShippingItemModal}
  onSubmit={submitShippingItem}
/>

<style>
  /* Match page background */
  .seller-page-container,
  .seller-page-content {
    background: #f9fafb;
    min-height: 100vh;
  }

  /* Stats grid */
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
  }

  .stat-value {
    margin: 0.25rem 0 0;
    font-size: 1.35rem;
    color: #111827;
    font-weight: 800;
  }

  .empty-text {
    color: #9ca3af;
  }

  /* Action buttons spec (32x32) */
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
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.05s ease;
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
</style>

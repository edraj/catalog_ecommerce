<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { ResourceType } from "@edraj/tsdmart";
  import "./index.css";
  import { website } from "@/config";
  import ShippingItemModal from "@/components/sellers/ShippingItemModal.svelte";

  let sellers = $state<any[]>([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let shippingOptions = $state<any[]>([]);
  let isLoadingSellers = $state(true);
  let isLoadingShipping = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let typeFilter = $state("all");
  let totalShippingCount = $state(0);
  let shippingConfig = $state<any>(null);
  let showShippingItemModal = $state(false);
  let editingShippingItemIndex = $state<number | null>(null);
  let showFilters = $state(false);

  let shippingItemForm = $state<any>({
    states: [],
    settings: [
      {
        min: "",
        max: "",
        cost: "",
        minimum_retail: "",
        note: "",
        is_active: true,
      },
    ],
  });

  let isSavingShipping = $state(false);

  // pagination
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  const isRTL = derived(locale, ($l) => $l === "ar" || $l === "ku");

  function getSellerDisplayName(seller: any): string {
    if (!seller) return "";
    return getLocalizedDisplayName(seller, $locale);
  }

  function resolveShippingItems(record: any) {
    const directItems = record?.attributes?.payload?.body?.items;
    if (Array.isArray(directItems)) return directItems;
    return [];
  }

  function buildShippingOptions(
    records: any[],
    sellerShortname: string,
    sellerDisplayname: string,
  ) {
    const options: any[] = [];

    for (const record of records) {
      const items = resolveShippingItems(record);

      if (items.length > 0) {
        for (const [itemIndex, item] of items.entries()) {
          if (item.settings && Array.isArray(item.settings)) {
            for (const setting of item.settings) {
              options.push({
                ...setting,
                states: item.states || [],
                seller_shortname: sellerShortname,
                seller_displayname: sellerDisplayname,
                record_shortname: record.shortname,
                item_index: itemIndex,
              });
            }
          }
        }
      }
    }

    return options;
  }

  function ensureShippingConfigBody(config: any) {
    if (!config.attributes)
      config.attributes = { payload: { body: { items: [] } } };
    if (!config.attributes.payload)
      config.attributes.payload = { body: { items: [] } };
    if (!config.attributes.payload.body)
      config.attributes.payload.body = { items: [] };
    if (!config.attributes.payload.body.items)
      config.attributes.payload.body.items = [];
  }

  // ------- filters / derived -------
  let filteredShippingOptions = $derived.by(() => {
    let filtered = [...(shippingOptions || [])];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const states = item.states?.join(", ") || "";
        const sellerName = (
          item.seller_displayname ||
          item.seller_shortname ||
          ""
        ).toLowerCase();
        return (
          states.toLowerCase().includes(searchLower) ||
          sellerName.includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter((item) => item.is_active === isActive);
    }

    if (typeFilter !== "all") {
      const isGlobal = typeFilter === "global";
      filtered = filtered.filter((item) => {
        const hasStates = item.states && item.states.length > 0;
        return isGlobal ? !hasStates : hasStates;
      });
    }

    return filtered;
  });

  let totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(filteredShippingOptions.length / itemsPerPage)),
  );

  let paginatedShippingOptions = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredShippingOptions.slice(startIndex, endIndex);
  });

  let paginationStart = $derived.by(() => {
    return filteredShippingOptions.length === 0
      ? 0
      : (currentPage - 1) * itemsPerPage + 1;
  });

  let paginationEnd = $derived.by(() => {
    return Math.min(currentPage * itemsPerPage, filteredShippingOptions.length);
  });

  // ------- stats -------
  let totalSellers = $derived.by(() => sellers.length);

  let activeShippings = $derived.by(
    () => filteredShippingOptions.filter((o) => o?.is_active === true).length,
  );

  function avg(numbers: number[]) {
    if (!numbers.length) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length;
  }

  let avgMinOrder = $derived.by(() => {
    const values = filteredShippingOptions
      .map((o) => Number(o?.minimum_retail || 0))
      .filter((v) => v > 0);
    return avg(values);
  });

  let avgShippingCost = $derived.by(() => {
    const values = filteredShippingOptions
      .map((o) => Number(o?.cost || 0))
      .filter((v) => !Number.isNaN(v));
    return avg(values);
  });

  $effect(() => {
    // reset pagination when filters/search change
    searchTerm;
    statusFilter;
    typeFilter;
    totalShippingCount = filteredShippingOptions.length;
    currentPage = 1;
  });

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
  });

  // ------- lifecycle -------
  onMount(async () => {
    await loadSellers();
    if (!selectedSeller) {
      selectedSeller = "all";
      await loadSellerShipping(true);
    }
    window.addEventListener("click", closeFilters);
  });

  onDestroy(() => {
    window.removeEventListener("click", closeFilters);
  });

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "shipping",
        "managed",
        1000,
        0,
        true,
      );
      if (response?.records) {
        sellers = response.records.filter(
          (record) => record.resource_type === "folder",
        );
      }
    } catch (error) {
      console.error("Error loading sellers:", error);
      errorToastMessage("Error loading sellers");
    } finally {
      isLoadingSellers = false;
    }
  }

  async function loadSellerShipping(reset = true) {
    if (reset) shippingOptions = [];

    if (!selectedSeller) {
      shippingConfig = null;
      return;
    }

    // ALL SELLERS
    if (selectedSeller === "all") {
      isLoadingShipping = true;
      try {
        const allShippingOptions: any[] = [];
        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `shipping/${seller.shortname}`,
              "managed",
              100,
              0,
              true,
            );
            if (response?.records) {
              allShippingOptions.push(
                ...buildShippingOptions(
                  response.records,
                  seller.shortname,
                  getSellerDisplayName(seller),
                ),
              );
            }
          } catch (error) {
            console.error(
              `Error loading shipping for ${seller.shortname}:`,
              error,
            );
          }
        }
        shippingOptions = allShippingOptions;
      } catch (error) {
        console.error("Error loading shipping options:", error);
        errorToastMessage("Error loading shipping options");
      } finally {
        isLoadingShipping = false;
      }
      return;
    }

    // SINGLE SELLER
    isLoadingShipping = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `shipping/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const processedShipping: any[] = [];

      if (response?.records) {
        shippingConfig = response.records[0] || {
          attributes: { payload: { body: { items: [] } } },
        };
        const seller = sellers.find((s) => s.shortname === selectedSeller);
        processedShipping.push(
          ...buildShippingOptions(
            response.records,
            selectedSeller,
            getSellerDisplayName(seller),
          ),
        );
      } else {
        shippingConfig = { attributes: { payload: { body: { items: [] } } } };
      }

      shippingOptions = processedShipping;
    } catch (error) {
      console.error("Error loading shipping options:", error);
      errorToastMessage("Error loading shipping options");
    } finally {
      isLoadingShipping = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerShipping(true);
    }
  });

  // ------- formatting -------
  function formatCurrency(amount: number): string {
    if (!amount || Number.isNaN(amount)) return "0";
    return Number(amount).toLocaleString();
  }

  function formatWeight(weight: number): string {
    if (!weight || Number.isNaN(weight)) return "0.0";
    return Number(weight).toFixed(1);
  }

  // ------- pagination handlers -------
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) currentPage = page;
  }
  function nextPage() {
    if (currentPage < totalPages) currentPage++;
  }
  function previousPage() {
    if (currentPage > 1) currentPage--;
  }

  // ------- filters dropdown -------
  function toggleFilters(event: Event) {
    event.stopPropagation();
    showFilters = !showFilters;
  }

  function closeFilters() {
    if (showFilters) showFilters = false;
  }

  function handleFiltersPanelClick(event: Event) {
    event.stopPropagation();
  }

  // ------- saving -------
  async function loadSellerShippingConfig(sellerShortname: string) {
    const response = await getSpaceContents(
      website.main_space,
      `shipping/${sellerShortname}`,
      "managed",
      100,
      0,
      true,
    );

    if (response?.records && response.records.length > 0)
      return response.records[0];
    return { attributes: { payload: { body: { items: [] } } } };
  }

  async function saveShippingConfigForSeller(
    sellerShortname: string,
    config: any,
  ) {
    ensureShippingConfigBody(config);

    const configData = {
      displayname_en: "Configuration",
      displayname_ar: null,
      displayname_ku: null,
      body: config.attributes.payload.body,
      tags: [],
      is_active: true,
    };

    if (config?.uuid) {
      await updateEntity(
        config.shortname,
        website.main_space,
        `shipping/${sellerShortname}`,
        config.resource_type,
        configData,
        "",
        "",
      );
    } else {
      await createEntity(
        configData,
        website.main_space,
        `shipping/${sellerShortname}`,
        ResourceType.content,
        "",
        "",
      );
    }
  }

  // ------- modal handlers -------
  function openShippingItemModal(itemIndex: number | null = null) {
    if (!shippingConfig || selectedSeller === "all") {
      errorToastMessage("Select a seller to manage shipping options");
      return;
    }

    editingShippingItemIndex = itemIndex;
    showShippingItemModal = true;

    ensureShippingConfigBody(shippingConfig);

    if (itemIndex !== null) {
      const item = shippingConfig.attributes.payload.body.items[itemIndex];
      shippingItemForm = {
        states: item.states || [],
        settings: item.settings.map((s) => ({
          min: s.min?.toString() || "",
          max: s.max?.toString() || "",
          cost: s.cost?.toString() || "",
          minimum_retail: s.minimum_retail?.toString() || "",
          note: s.note || "",
          is_active: s.is_active ?? true,
        })),
      };
    } else {
      shippingItemForm = {
        states: [],
        settings: [
          {
            min: "",
            max: "",
            cost: "",
            minimum_retail: "",
            note: "",
            is_active: true,
          },
        ],
      };
    }
  }

  function closeShippingItemModal() {
    showShippingItemModal = false;
    editingShippingItemIndex = null;
  }

  async function submitShippingItem() {
    if (shippingItemForm.settings.some((s) => !s.min || !s.max || !s.cost)) {
      errorToastMessage("Please fill in all required fields (min, max, cost)");
      return;
    }

    if (!selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to manage shipping options");
      return;
    }

    try {
      isSavingShipping = true;

      const newItem = {
        ...(shippingItemForm.states.length > 0
          ? { states: shippingItemForm.states }
          : {}),
        settings: shippingItemForm.settings.map((s) => ({
          min: parseFloat(s.min),
          max: parseFloat(s.max),
          cost: parseFloat(s.cost),
          minimum_retail: s.minimum_retail ? parseFloat(s.minimum_retail) : 0,
          note: s.note || "TRANSLATION_KEY_ONLY",
          is_active: s.is_active,
        })),
      };

      ensureShippingConfigBody(shippingConfig);

      if (editingShippingItemIndex !== null) {
        shippingConfig.attributes.payload.body.items[editingShippingItemIndex] =
          newItem;
      } else {
        shippingConfig.attributes.payload.body.items.push(newItem);
      }

      await saveShippingConfigForSeller(selectedSeller, shippingConfig);
      successToastMessage("Shipping options saved successfully!");

      closeShippingItemModal();
      await loadSellerShipping(true);
    } catch (error) {
      console.error("Error saving shipping options:", error);
      errorToastMessage("Failed to save shipping options");
    } finally {
      isSavingShipping = false;
    }
  }

  async function deleteShippingItem(itemIndex: number) {
    if (!shippingConfig || !selectedSeller || selectedSeller === "all") {
      errorToastMessage("Select a seller to manage shipping options");
      return;
    }

    try {
      isSavingShipping = true;

      ensureShippingConfigBody(shippingConfig);
      shippingConfig.attributes.payload.body.items =
        shippingConfig.attributes.payload.body.items.filter(
          (_: any, i: number) => i !== itemIndex,
        );

      await saveShippingConfigForSeller(selectedSeller, shippingConfig);
      successToastMessage("Shipping option deleted successfully!");
      await loadSellerShipping(true);
    } catch (error) {
      console.error("Error deleting shipping option:", error);
      errorToastMessage("Failed to delete shipping option");
    } finally {
      isSavingShipping = false;
    }
  }
</script>

<div class="admin-page-container">
  <div>
    <!-- Stats (past tables style) -->
    <div class="stats-grid" style="margin-bottom: 16px;">
      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
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
          <h3 class="stat-title">
            {$_("admin.total_sellers") || "Total Sellers"}
          </h3>
          <p class="stat-value">{formatNumber(totalSellers, $locale)}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
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
          <h3 class="stat-title">
            {$_("admin.active_shippings") || "Active Shippings"}
          </h3>
          <p class="stat-value">{formatNumber(activeShippings, $locale)}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z"
              stroke="#3C307F"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">
            {$_("admin.avg_min_order") || "Avg Min Order"}
          </h3>
          <p class="stat-value">
            {formatNumber(Math.round(avgMinOrder), $locale)}
          </p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z"
              stroke="#3C307F"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">
            {$_("admin.avg_shipping_cost") || "Avg Shipping Cost"}
          </h3>
          <p class="stat-value">
            {formatNumber(Math.round(avgShippingCost), $locale)}
          </p>
        </div>
      </div>
    </div>

    <!-- Controls header (past tables layout) -->
    <div
      class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <!-- SEARCH -->
      <div>
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
            placeholder={$_("admin.search_shipping") ||
              "Search by state or seller..."}
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

      <!-- RIGHT -->
      <div class="flex items-end gap-3 justify-end">
          <!-- Add shipping -->
        <button
          class="h-9 inline-flex items-center justify-center gap-2
            px-3 py-2
            bg-[#3C307F] text-white text-sm font-medium
            rounded-[12px]
            hover:bg-[#2f2666] transition-colors
            disabled:opacity-60 disabled:cursor-not-allowed"
          onclick={() => openShippingItemModal(null)}
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          {$_("admin.add_shipping_rule") || "Add Shipping"}
        </button>
        <!-- Seller Select -->
        <div class="min-w-[220px]">
          <select
            bind:value={selectedSeller}
            class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
          >
            <option value=""
              >{$_("admin.choose_seller") || "Choose a seller..."}</option
            >
            <option value="all"
              >{$_("admin.all_sellers") || "All Sellers"}</option
            >
            {#each sellers as seller}
              <option value={seller.shortname}
                >{getSellerDisplayName(seller)}</option
              >
            {/each}
          </select>
        </div>

        <!-- Filters dropdown -->
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onclick={toggleFilters}
            class="h-9 inline-flex items-center justify-between cursor-pointer
              px-3 py-2 min-w-[140px]
              bg-[#F9FAFB] border border-[#E5E7EB]
              rounded-[12px]
              shadow-[0px_1px_0.5px_0.05px_#1D293D05]
              text-sm text-gray-700 hover:bg-gray-50"
          >
            <span class="truncate">{$_("common.filters") || "Filters"}</span>
            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if showFilters}
            <div
              class="absolute right-0 z-20 mt-2 w-[320px]
                rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
              onclick={handleFiltersPanelClick}
            >
              <div class="grid grid-cols-1 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    {$_("admin.shipping_type") || "Type"}
                  </label>
                  <select
                    bind:value={typeFilter}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    <option value="all"
                      >{$_("admin.all_types") || "All Types"}</option
                    >
                    <option value="global"
                      >{$_("admin.global") || "Global"}</option
                    >
                    <option value="state"
                      >{$_("admin.state_specific") || "State Specific"}</option
                    >
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    {$_("common.status") || "Status"}
                  </label>
                  <select
                    bind:value={statusFilter}
                    class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                  >
                    <option value="all"
                      >{$_("admin.all_status") || "All Status"}</option
                    >
                    <option value="active"
                      >{$_("admin.active") || "Active"}</option
                    >
                    <option value="inactive"
                      >{$_("admin.inactive") || "Inactive"}</option
                    >
                  </select>
                </div>
              </div>

              <div
                class="flex items-center justify-end mt-3 pt-3 border-t border-gray-100"
              >
                <button
                  type="button"
                  onclick={() => (showFilters = false)}
                  class="h-9 inline-flex items-center justify-center
                    px-3 py-2
                    bg-[#3C307F] text-white text-sm font-medium
                    rounded-[12px]
                    hover:bg-[#2f2666] transition-colors"
                >
                  {$_("admin.apply") || "Apply"}
                </button>
              </div>
            </div>
          {/if}
        </div>

      
      </div>
    </div>

    <!-- Table states -->
    {#if isLoadingShipping}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if paginatedShippingOptions.length === 0}
      <div class="empty-state">
        <h3>{"No shippings found"}</h3>
        <p>
          {selectedSeller === "all"
            ? $_("admin_dashboard.no_products_description") ||
              "Start by creating your first shipping rule"
            : $_("admin_dashboard.no_products_in_category") ||
              "No shippings in this category"}
        </p>
      </div>
    {:else}
      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("admin.seller") || "Seller"}</th>
              <th>{$_("admin.shipping_type") || "Type"}</th>
              <th>{$_("admin.states") || "States"}</th>
              <th>{$_("admin.weight_range") || "Weight Range (kg)"}</th>
              <th>{$_("admin.shipping_cost") || "Shipping Cost"}</th>
              <th>{$_("admin.minimum_order") || "Min. Order"}</th>
              <th>{$_("common.status") || "Status"}</th>
              <th style="text-align:right;"
                >{$_("common.actions") || "Actions"}</th
              >
            </tr>
          </thead>

          <tbody>
            {#each paginatedShippingOptions as option, i (option.record_shortname + "-" + i)}
              {@const hasStates = option.states && option.states.length > 0}
              {@const isActive = option.is_active === true}

              <tr class="item-row">
                <td>
                  <div class="seller-badge">
                    {option.seller_displayname || option.seller_shortname}
                  </div>
                </td>

                <td>
                  <div
                    class="type-badge"
                    class:global={!hasStates}
                    class:state={hasStates}
                  >
                    {hasStates
                      ? $_("admin.state_specific") || "State Specific"
                      : $_("admin.global") || "Global"}
                  </div>
                </td>

                <td>
                  <div class="states-display">
                    {#if hasStates}
                      {#each option.states.slice(0, 3) as state}
                        <span class="state-tag">{state}</span>
                      {/each}
                      {#if option.states.length > 3}
                        <span class="more-badge"
                          >+{option.states.length - 3}</span
                        >
                      {/if}
                    {:else}
                      <span class="empty-text"
                        >{$_("admin.all_states") || "All States"}</span
                      >
                    {/if}
                  </div>
                </td>

                <td class="mono">
                  {formatWeight(option.min)} - {formatWeight(option.max)}
                </td>

                <td class="mono">
                  {formatCurrency(option.cost)}
                </td>

                <td class="mono">
                  {option.minimum_retail > 0
                    ? formatCurrency(option.minimum_retail)
                    : "-"}
                </td>

                <td>
                  <span
                    class="status-pill"
                    class:active={isActive}
                    class:inactive={!isActive}
                  >
                    {isActive
                      ? $_("admin.active") || "Active"
                      : $_("admin.inactive") || "Inactive"}
                  </span>
                </td>

                <td
                  style="text-align:right;"
                  onclick={(e) => e.stopPropagation()}
                >
                  {#if selectedSeller && selectedSeller !== "all"}
                    <div class="inline-flex items-center gap-2 justify-end">
                      <!-- Edit -->
                      <button
                        class="icon-action"
                        type="button"
                        aria-label={$_("common.edit") || "Edit"}
                        onclick={() => openShippingItemModal(option.item_index)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path
                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
                          />
                        </svg>
                      </button>

                      <!-- Delete -->
                      <button
                        class="icon-action icon-action--danger"
                        type="button"
                        aria-label={$_("common.delete") || "Delete"}
                        onclick={() => deleteShippingItem(option.item_index)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path
                            d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"
                          />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <span class="empty-text">-</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        <!-- Pagination (match your provided classes) -->
        {#if totalPages > 1}
          <div class="pagination">
            <div class="pagination-info">
              <span class="pagination-info__label"
                >{$_("common.showing") || "Showing"}</span
              >
              <span class="pagination-info__strong"
                >{formatNumber(paginationStart, $locale)}</span
              >
              <span class="pagination-info__label">-</span>
              <span class="pagination-info__strong"
                >{formatNumber(paginationEnd, $locale)}</span
              >
              <span class="pagination-info__label"
                >{$_("common.of") || "of"}</span
              >
              <span class="pagination-info__strong"
                >{formatNumber(filteredShippingOptions.length, $locale)}</span
              >
            </div>

            <div class="pagination-controls">
              <button
                class="pager-arrow pager-arrow--left"
                onclick={previousPage}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <div class="pagination-pages">
                {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                  {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
                    <button
                      class="page-chip"
                      class:active={page === currentPage}
                      onclick={() => goToPage(page)}
                    >
                      {formatNumber(page, $locale)}
                    </button>
                  {:else if page === currentPage - 2 || page === currentPage + 2}
                    <span class="page-ellipsis">...</span>
                  {/if}
                {/each}
              </div>

              <button
                class="pager-arrow pager-arrow--right"
                onclick={nextPage}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<ShippingItemModal
  bind:show={showShippingItemModal}
  bind:form={shippingItemForm}
  isLoading={isSavingShipping}
  onClose={closeShippingItemModal}
  onSubmit={submitShippingItem}
/>

<style>
  /* actions button style like past tables (32x32, rounded 12, border, bg, shadow) */
  .icon-action {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 12px;
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #4a5565;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .icon-action:hover {
    background: #f4f5fe;
    border-color: #3c307f;
  }

  .icon-action--danger:hover {
    background: #fef2f2;
    border-color: #dc2626;
    color: #dc2626;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid;
    white-space: nowrap;
  }

  .status-pill.active {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.35);
    color: #059669;
  }

  .status-pill.inactive {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
    color: #dc2626;
  }
</style>

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
  import { website } from "@/config";
  import "../styles/index.css";
  import ShippingManagement from "@/components/sellers/ShippingManagement.svelte";
  import ShippingItemModal from "@/components/sellers/ShippingItemModal.svelte";
  import "@/components/sellers/ShippingManagement.css";
  import { ResourceType } from "@edraj/tsdmart";

  $goto;
  let isLoading = $state(true);
  let shippingConfig = $state(null);
  let showShippingItemModal = $state(false);
  let editingShippingItemIndex = $state(null);
  let shippingItemForm = $state({
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

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  onMount(async () => {
    await loadShippingData();
  });

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
            payload: {
              body: {
                items: [],
              },
            },
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

      successToastMessage(
        $_("seller_dashboard.shipping_configured_successfully"),
      );
      await loadShippingData();
    } catch (error) {
      console.error("Error saving shipping config:", error);
      errorToastMessage($_("seller_dashboard.failed_to_configure_shipping"));
    } finally {
      isLoading = false;
    }
  }

  async function submitShippingItem() {
    if (shippingItemForm.settings.some((s) => !s.min || !s.max || !s.cost)) {
      errorToastMessage("Please fill in all required fields (min, max, cost)");
      return;
    }

    try {
      isLoading = true;

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

      if (editingShippingItemIndex !== null) {
        shippingConfig.attributes.payload.body.items[editingShippingItemIndex] =
          newItem;
      } else {
        if (!shippingConfig.attributes) {
          shippingConfig.attributes = { payload: { body: { items: [] } } };
        }
        if (!shippingConfig.attributes.payload) {
          shippingConfig.attributes.payload = { body: { items: [] } };
        }
        if (!shippingConfig.attributes.payload.body) {
          shippingConfig.attributes.payload.body = { items: [] };
        }
        if (!shippingConfig.attributes.payload.body.items) {
          shippingConfig.attributes.payload.body.items = [];
        }
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

  function openShippingItemModal(itemIndex = null) {
    editingShippingItemIndex = itemIndex;
    showShippingItemModal = true;

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

  async function deleteShippingItem(itemIndex: number) {
    try {
      isLoading = true;

      shippingConfig.attributes.payload.body.items =
        shippingConfig.attributes.payload.body.items.filter(
          (_, i) => i !== itemIndex,
        );

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
            {$_("seller_dashboard.shipping")}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            Configure shipping settings and rates
          </p>
        </div>
      </div>
    </div>

    <!-- Shipping Management Component -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading")}</p>
      </div>
    {:else if shippingConfig}
      <ShippingManagement
        bind:shippingConfig
        {isLoading}
        onOpenItemModal={(itemIndex) => openShippingItemModal(itemIndex)}
        onDeleteItem={(itemIndex) => deleteShippingItem(itemIndex)}
      />
    {:else}
      <div class="empty-state">
        <h3>Unable to load shipping configuration</h3>
      </div>
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

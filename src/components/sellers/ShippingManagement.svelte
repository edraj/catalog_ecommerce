<script lang="ts">
  import { _ } from "@/i18n";

  let {
    shippingConfig = $bindable(),
    isLoading = $bindable(),
    onOpenItemModal,
    onDeleteItem,
  }: {
    shippingConfig: any;
    isLoading: boolean;
    onOpenItemModal: (index?: number) => void;
    onDeleteItem: (index: number) => void;
  } = $props();

  const iraqStates = [
    { shortname: "baghdad", name: { en: "Baghdad", ar: "بغداد", ku: "بەغدا" } },
    { shortname: "basra", name: { en: "Basra", ar: "البصرة", ku: "بەسرە" } },
    {
      shortname: "nineveh",
      name: { en: "Nineveh", ar: "نينوى", ku: "نەینەوا" },
    },
    { shortname: "erbil", name: { en: "Erbil", ar: "أربيل", ku: "هەولێر" } },
    {
      shortname: "sulaymaniyah",
      name: { en: "Sulaymaniyah", ar: "السليمانية", ku: "سلێمانی" },
    },
    { shortname: "dohuk", name: { en: "Dohuk", ar: "دهوك", ku: "دهۆک" } },
    { shortname: "anbar", name: { en: "Anbar", ar: "الأنبار", ku: "ئەنبار" } },
    { shortname: "diyala", name: { en: "Diyala", ar: "ديالى", ku: "دیالە" } },
    {
      shortname: "salahuddin",
      name: { en: "Salah al-Din", ar: "صلاح الدين", ku: "سەلاحەدین" },
    },
    { shortname: "kirkuk", name: { en: "Kirkuk", ar: "كركوك", ku: "کەرکووک" } },
    { shortname: "najaf", name: { en: "Najaf", ar: "النجف", ku: "نەجەف" } },
    {
      shortname: "karbala",
      name: { en: "Karbala", ar: "كربلاء", ku: "کەربەلا" },
    },
    { shortname: "babil", name: { en: "Babil", ar: "بابل", ku: "بابل" } },
    { shortname: "wasit", name: { en: "Wasit", ar: "واسط", ku: "واست" } },
    { shortname: "maysan", name: { en: "Maysan", ar: "ميسان", ku: "مەیسان" } },
    {
      shortname: "dhi_qar",
      name: { en: "Dhi Qar", ar: "ذي قار", ku: "زیقار" },
    },
    {
      shortname: "muthanna",
      name: { en: "Al-Muthanna", ar: "المثنى", ku: "موسەنا" },
    },
    {
      shortname: "qadisiyyah",
      name: { en: "Al-Qadisiyyah", ar: "القادسية", ku: "قادسیە" },
    },
  ];

  const items = $derived(
    shippingConfig?.attributes?.payload?.body?.items || [],
  );

  const defaultItems = $derived(
    items.filter((item: any) => !item.states || item.states.length === 0),
  );
  const stateSpecificItems = $derived(
    items.filter((item: any) => item.states && item.states.length > 0),
  );

  const getStateDisplayName = (stateShortname: string) => {
    const state = iraqStates.find((s) => s.shortname === stateShortname);
    if (!state) return stateShortname;
    const lang = $_("lang") || "en";
    return state.name[lang as keyof typeof state.name] || state.name.en;
  };
</script>

<div class="shipping-management-container">
  <div class="section-header">
    <h2 class="section-title">
      {$_("seller_dashboard.shipping_configuration")}
    </h2>
    <!-- <button class="add-button" onclick={() => onOpenItemModal()}>
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
      {$_("seller_dashboard.add_shipping_rule")}
    </button> -->
  </div>

  {#if items.length === 0}
    <div class="empty-message">
      <p>{$_("seller_dashboard.no_shipping_configured")}</p>
      <!-- <p class="empty-hint">{$_("seller_dashboard.click_add_to_configure")}</p> -->
    </div>
  {:else}
    <!-- Default/Base Shipping Rules -->
    {#if defaultItems.length > 0}
      <div class="shipping-section">
        <h3 class="subsection-title">
          {$_("seller_dashboard.default_shipping")}
        </h3>
        <div class="shipping-grid">
          {#each defaultItems as item, index}
            {@const itemIndex = items.indexOf(item)}
            <div class="shipping-card">
              <div class="card-header">
                <h4 class="card-title">
                  {$_("seller_dashboard.default_rule")}
                </h4>
                <div class="card-actions">
                  <button
                    class="action-button edit-btn"
                    onclick={() => onOpenItemModal(itemIndex)}
                    title={$_("seller_dashboard.edit")}
                  >
                    ✏️
                  </button>
                  <button
                    class="action-button delete-btn"
                    onclick={() => onDeleteItem(itemIndex)}
                    title={$_("seller_dashboard.delete")}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div class="shipping-details">
                {#each item.settings as setting}
                  <div class="setting-item" class:inactive={!setting.is_active}>
                    <div class="setting-row">
                      <span class="setting-label"
                        >{$_("seller_dashboard.delivery_range")}:</span
                      >
                      <span class="setting-value"
                        >{setting.min} - {setting.max}
                        {$_("seller_dashboard.days")}</span
                      >
                    </div>
                    <div class="setting-row">
                      <span class="setting-label"
                        >{$_("seller_dashboard.cost")}:</span
                      >
                      <span class="setting-value"
                        >{setting.cost} {$_("seller_dashboard.currency")}</span
                      >
                    </div>
                    {#if setting.minimum_retail > 0}
                      <div class="setting-row">
                        <span class="setting-label"
                          >{$_("seller_dashboard.min_retail")}:</span
                        >
                        <span class="setting-value"
                          >{setting.minimum_retail}
                          {$_("seller_dashboard.currency")}</span
                        >
                      </div>
                    {/if}
                    {#if setting.note && setting.note !== "TRANSLATION_KEY_ONLY"}
                      <div class="setting-row">
                        <span class="setting-label"
                          >{$_("seller_dashboard.note")}:</span
                        >
                        <span class="setting-value">{setting.note}</span>
                      </div>
                    {/if}
                    {#if !setting.is_active}
                      <span class="inactive-badge"
                        >{$_("seller_dashboard.inactive")}</span
                      >
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- State-Specific Shipping Rules -->
    {#if stateSpecificItems.length > 0}
      <div class="shipping-section">
        <h3 class="subsection-title">
          {$_("seller_dashboard.state_specific_shipping")}
        </h3>
        <div class="shipping-grid">
          {#each stateSpecificItems as item, index}
            {@const itemIndex = items.indexOf(item)}
            <div class="shipping-card">
              <div class="card-header">
                <h4 class="card-title">
                  {#if item.states.length > 0}
                    {item.states.map((s) => getStateDisplayName(s)).join(", ")}
                  {/if}
                </h4>
                <div class="card-actions">
                  <button
                    class="action-button edit-btn"
                    onclick={() => onOpenItemModal(itemIndex)}
                    title={$_("seller_dashboard.edit")}
                  >
                    ✏️
                  </button>
                  <button
                    class="action-button delete-btn"
                    onclick={() => onDeleteItem(itemIndex)}
                    title={$_("seller_dashboard.delete")}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div class="shipping-details">
                {#each item.settings as setting}
                  <div class="setting-item" class:inactive={!setting.is_active}>
                    <div class="setting-row">
                      <span class="setting-label"
                        >{$_("seller_dashboard.delivery_range")}:</span
                      >
                      <span class="setting-value"
                        >{setting.min} - {setting.max}
                        {$_("seller_dashboard.days")}</span
                      >
                    </div>
                    <div class="setting-row">
                      <span class="setting-label"
                        >{$_("seller_dashboard.cost")}:</span
                      >
                      <span class="setting-value"
                        >{setting.cost} {$_("seller_dashboard.currency")}</span
                      >
                    </div>
                    {#if setting.minimum_retail > 0}
                      <div class="setting-row">
                        <span class="setting-label"
                          >{$_("seller_dashboard.min_retail")}:</span
                        >
                        <span class="setting-value"
                          >{setting.minimum_retail}
                          {$_("seller_dashboard.currency")}</span
                        >
                      </div>
                    {/if}
                    {#if setting.note && setting.note !== "TRANSLATION_KEY_ONLY"}
                      <div class="setting-row">
                        <span class="setting-label"
                          >{$_("seller_dashboard.note")}:</span
                        >
                        <span class="setting-value">{setting.note}</span>
                      </div>
                    {/if}
                    {#if !setting.is_active}
                      <span class="inactive-badge"
                        >{$_("seller_dashboard.inactive")}</span
                      >
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

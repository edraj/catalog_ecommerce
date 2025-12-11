<script lang="ts">
  import { _ } from "@/i18n";

  let {
    baseShipping = $bindable(),
    categoryShippings = $bindable(),
    stateShippings = $bindable(),
    categories = $bindable(),
    isLoading = $bindable(),
    onOpenCategoryModal,
    onOpenStateModal,
    getItemDisplayName,
  }: {
    baseShipping: any;
    categoryShippings: any[];
    stateShippings: any[];
    categories: any[];
    isLoading: boolean;
    onOpenCategoryModal: () => void;
    onOpenStateModal: () => void;
    getItemDisplayName: (item: any) => string;
  } = $props();

  // Static list of Iraq states/governorates
  const iraqStates = [
    {
      shortname: "baghdad",
      displayName: { en: "Baghdad", ar: "بغداد", ku: "بەغدا" },
    },
    {
      shortname: "basra",
      displayName: { en: "Basra", ar: "البصرة", ku: "بەسرە" },
    },
    {
      shortname: "nineveh",
      displayName: { en: "Nineveh", ar: "نينوى", ku: "نەینەوا" },
    },
    {
      shortname: "erbil",
      displayName: { en: "Erbil", ar: "أربيل", ku: "هەولێر" },
    },
    {
      shortname: "sulaymaniyah",
      displayName: { en: "Sulaymaniyah", ar: "السليمانية", ku: "سلێمانی" },
    },
    {
      shortname: "dohuk",
      displayName: { en: "Dohuk", ar: "دهوك", ku: "دهۆک" },
    },
    {
      shortname: "anbar",
      displayName: { en: "Anbar", ar: "الأنبار", ku: "ئەنبار" },
    },
    {
      shortname: "diyala",
      displayName: { en: "Diyala", ar: "ديالى", ku: "دیالە" },
    },
    {
      shortname: "salahuddin",
      displayName: { en: "Salah al-Din", ar: "صلاح الدين", ku: "سەلاحەدین" },
    },
    {
      shortname: "kirkuk",
      displayName: { en: "Kirkuk", ar: "كركوك", ku: "کەرکووک" },
    },
    {
      shortname: "najaf",
      displayName: { en: "Najaf", ar: "النجف", ku: "نەجەف" },
    },
    {
      shortname: "karbala",
      displayName: { en: "Karbala", ar: "كربلاء", ku: "کەربەلا" },
    },
    {
      shortname: "babil",
      displayName: { en: "Babil", ar: "بابل", ku: "بابل" },
    },
    {
      shortname: "wasit",
      displayName: { en: "Wasit", ar: "واسط", ku: "واست" },
    },
    {
      shortname: "maysan",
      displayName: { en: "Maysan", ar: "ميسان", ku: "مەیسان" },
    },
    {
      shortname: "dhi_qar",
      displayName: { en: "Dhi Qar", ar: "ذي قار", ku: "زیقار" },
    },
    {
      shortname: "muthanna",
      displayName: { en: "Al-Muthanna", ar: "المثنى", ku: "موسەنا" },
    },
    {
      shortname: "qadisiyyah",
      displayName: { en: "Al-Qadisiyyah", ar: "القادسية", ku: "قادسیە" },
    },
  ];

  // Get display name based on current language
  const getStateDisplayName = (shortname: string) => {
    const state = iraqStates.find((s) => s.shortname === shortname);
    if (!state) return shortname;
    const lang = $_("lang") || "en";
    return (
      state.displayName[lang as keyof typeof state.displayName] ||
      state.displayName.en
    );
  };
</script>

<div class="shipping-management-container">
  <!-- Base Shipping Section -->
  <div class="shipping-section">
    <div class="section-header">
      <h3 class="section-title">{$_("seller_dashboard.base_shipping")}</h3>
    </div>
    <div class="section-content">
      {#if baseShipping}
        {@const body = baseShipping.attributes?.payload?.body}
        <div class="shipping-card base-shipping-card">
          <div class="shipping-details">
            <div class="shipping-detail-item">
              <span class="detail-label"
                >{$_("seller_dashboard.shipping_cost")}:</span
              >
              <span class="detail-value"
                >{body?.cost || 0} {$_("seller_dashboard.currency")}</span
              >
            </div>
            <div class="shipping-detail-item">
              <span class="detail-label"
                >{$_("seller_dashboard.base_shipping_time")}:</span
              >
              <span class="detail-value"
                >{body?.time || 0} {$_("common.days")}</span
              >
            </div>
          </div>
        </div>
      {:else}
        <div class="empty-message">
          <p>{$_("seller_dashboard.no_base_shipping_configured")}</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Category Shipping Section -->
  <div class="shipping-section">
    <div class="section-header">
      <h3 class="section-title">{$_("seller_dashboard.category_shipping")}</h3>
      <button class="add-button" onclick={onOpenCategoryModal}>
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
        {$_("seller_dashboard.add_category_shipping")}
      </button>
    </div>
    <div class="section-content">
      {#if categoryShippings.length === 0}
        <div class="empty-message">
          <p>{$_("seller_dashboard.no_items")}</p>
        </div>
      {:else}
        <div class="shipping-grid">
          {#each categoryShippings as shipping (shipping.shortname)}
            {@const body = shipping.attributes?.payload?.body}
            {@const category = categories.find(
              (c) => c.shortname === body?.category_shortname
            )}
            {@const categoryName = category
              ? getItemDisplayName(category)
              : body?.category_shortname || shipping.shortname}
            <div class="shipping-card">
              <h4 class="card-title">{categoryName}</h4>
              <div class="shipping-details">
                {#if body?.standard}
                  <div class="shipping-option">
                    <span class="option-label"
                      >{$_("seller_dashboard.standard_shipping")}:</span
                    >
                    <span class="option-value">
                      {body.standard.cost}
                      {$_("seller_dashboard.currency")} | {body.standard
                        .estimated_days}h (min: {body.standard.min_days}h)
                    </span>
                  </div>
                {/if}
                {#if body?.fast?.active}
                  <div class="shipping-option">
                    <span class="option-label"
                      >{$_("seller_dashboard.fast_shipping")}:</span
                    >
                    <span class="option-value">
                      {body.fast.cost}
                      {$_("seller_dashboard.currency")} | {body.fast
                        .estimated_days}h
                    </span>
                    {#if body.fast.validy}
                      <span class="validity-badge"
                        >Valid: {body.fast.validy.from} - {body.fast.validy
                          .to}</span
                      >
                    {/if}
                  </div>
                {/if}
                {#if body?.free?.active}
                  <div class="shipping-option">
                    <span class="option-label"
                      >{$_("seller_dashboard.free_shipping_option")}:</span
                    >
                    <span class="option-value">{body.free.estimated_days}h</span
                    >
                    {#if body.free.validy}
                      <span class="validity-badge"
                        >Valid: {body.free.validy.from} - {body.free.validy
                          .to}</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- State Shipping Section -->
  <div class="shipping-section">
    <div class="section-header">
      <h3 class="section-title">{$_("seller_dashboard.state_shipping")}</h3>
      <button class="add-button" onclick={onOpenStateModal}>
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
        {$_("seller_dashboard.add_state_shipping")}
      </button>
    </div>
    <div class="section-content">
      {#if stateShippings.length === 0}
        <div class="empty-message">
          <p>{$_("seller_dashboard.no_items")}</p>
        </div>
      {:else}
        <div class="shipping-grid">
          {#each stateShippings as shipping (shipping.shortname)}
            {@const body = shipping.attributes?.payload?.body}
            {@const stateName = getStateDisplayName(
              body?.state_shortname || shipping.shortname
            )}
            <div class="shipping-card">
              <h4 class="card-title">{stateName}</h4>
              <div class="shipping-details">
                {#if body?.standard}
                  <div class="shipping-option">
                    <span class="option-label"
                      >{$_("seller_dashboard.standard_shipping")}:</span
                    >
                    <span class="option-value">
                      {body.standard.cost}
                      {$_("seller_dashboard.currency")} | {body.standard
                        .estimated_days}h (min: {body.standard.min_days}h)
                    </span>
                  </div>
                {/if}
                {#if body?.fast?.active}
                  <div class="shipping-option">
                    <span class="option-label"
                      >{$_("seller_dashboard.fast_shipping")}:</span
                    >
                    <span class="option-value">
                      {body.fast.cost}
                      {$_("seller_dashboard.currency")} | {body.fast
                        .estimated_days}h
                    </span>
                    {#if body.fast.validy}
                      <span class="validity-badge"
                        >Valid: {body.fast.validy.from} - {body.fast.validy
                          .to}</span
                      >
                    {/if}
                  </div>
                {/if}
                {#if body?.free?.active}
                  <div class="shipping-option">
                    <span class="option-label"
                      >{$_("seller_dashboard.free_shipping_option")}:</span
                    >
                    <span class="option-value">{body.free.estimated_days}h</span
                    >
                    {#if body.free.validy}
                      <span class="validity-badge"
                        >Valid: {body.free.validy.from} - {body.free.validy
                          .to}</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

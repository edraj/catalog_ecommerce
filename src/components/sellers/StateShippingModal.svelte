<script lang="ts">
  import { _ } from "@/i18n";
  import "./ShippingManagement.css";

  let {
    show = $bindable(),
    form = $bindable(),
    isLoading,
    onClose,
    onSubmit,
  }: {
    show: boolean;
    form: any;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: () => void;
  } = $props();

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

  const getStateDisplayName = (state: (typeof iraqStates)[0]) => {
    const lang = $_("lang") || "en";
    return (
      state.displayName[lang as keyof typeof state.displayName] ||
      state.displayName.en
    );
  };
</script>

{#if show}
  <div
    class="modal-overlay state-shipping-modal"
    role="button"
    tabindex="0"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div
      class="modal-content"
      role="dialog"
      aria-modal="true"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.add_state_shipping")}
        </h2>
        <button class="modal-close" onclick={onClose} aria-label="Close modal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h3>{$_("seller_dashboard.state_shipping")}</h3>

          <div class="form-group">
            <label class="form-label" for="state-select">
              {$_("seller_dashboard.select_state_for_shipping")} *
            </label>
            <select
              id="state-select"
              bind:value={form.state_shortname}
              class="form-select"
            >
              <option value="">
                {$_("seller_dashboard.select_state_for_shipping")}
              </option>
              {#each iraqStates as state (state.shortname)}
                <option value={state.shortname}>
                  {getStateDisplayName(state)}
                </option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Standard Shipping -->
        <div class="form-section">
          <h3>{$_("seller_dashboard.standard_shipping")}</h3>
          <div class="form-group">
            <label class="form-label" for="std-cost">
              {$_("seller_dashboard.shipping_cost")}
            </label>
            <input
              id="std-cost"
              type="number"
              bind:value={form.standard.cost}
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="std-days">
              {$_("seller_dashboard.estimated_days")}
            </label>
            <input
              id="std-days"
              type="number"
              bind:value={form.standard.estimated_days}
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="std-min-days">
              {$_("seller_dashboard.min_days")}
            </label>
            <input
              id="std-min-days"
              type="number"
              bind:value={form.standard.min_days}
              class="form-input"
            />
          </div>
        </div>

        <!-- Fast Shipping -->
        <div class="form-section">
          <h3>{$_("seller_dashboard.fast_shipping")}</h3>
          <div class="checkbox-wrapper">
            <input
              id="fast-active"
              type="checkbox"
              bind:checked={form.fast.active}
            />
            <label for="fast-active">{$_("seller_dashboard.is_active")}</label>
          </div>
          {#if form.fast.active}
            <div class="form-group">
              <label class="form-label" for="fast-cost">
                {$_("seller_dashboard.shipping_cost")}
              </label>
              <input
                id="fast-cost"
                type="number"
                bind:value={form.fast.cost}
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="fast-days">
                {$_("seller_dashboard.estimated_days")}
              </label>
              <input
                id="fast-days"
                type="number"
                bind:value={form.fast.estimated_days}
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="fast-from">
                {$_("seller_dashboard.validity_from")}
              </label>
              <input
                id="fast-from"
                type="datetime-local"
                bind:value={form.fast.validFrom}
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="fast-to">
                {$_("seller_dashboard.validity_to")}
              </label>
              <input
                id="fast-to"
                type="datetime-local"
                bind:value={form.fast.validTo}
                class="form-input"
              />
            </div>
          {/if}
        </div>

        <!-- Free Shipping -->
        <div class="form-section">
          <h3>{$_("seller_dashboard.free_shipping_option")}</h3>
          <div class="checkbox-wrapper">
            <input
              id="free-active"
              type="checkbox"
              bind:checked={form.free.active}
            />
            <label for="free-active">{$_("seller_dashboard.is_active")}</label>
          </div>
          {#if form.free.active}
            <div class="form-group">
              <label class="form-label" for="free-days">
                {$_("seller_dashboard.estimated_days")}
              </label>
              <input
                id="free-days"
                type="number"
                bind:value={form.free.estimated_days}
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="free-from">
                {$_("seller_dashboard.validity_from")}
              </label>
              <input
                id="free-from"
                type="datetime-local"
                bind:value={form.free.validFrom}
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="free-to">
                {$_("seller_dashboard.validity_to")}
              </label>
              <input
                id="free-to"
                type="datetime-local"
                bind:value={form.free.validTo}
                class="form-input"
              />
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onclick={onClose}>
            {$_("common.cancel")}
          </button>
          <button class="btn-primary" onclick={onSubmit} disabled={isLoading}>
            {isLoading ? $_("common.saving") : $_("seller_dashboard.add")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

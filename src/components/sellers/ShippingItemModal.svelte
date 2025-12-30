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

  // Static list of Iraqi states/governorates
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

  // Get state display name
  const getStateDisplayName = (stateShortname: string) => {
    const state = iraqStates.find((s) => s.shortname === stateShortname);
    if (!state) return stateShortname;
    const lang = $_("lang") || "en";
    return state.name[lang as keyof typeof state.name] || state.name.en;
  };

  // Toggle state selection
  function toggleState(stateShortname: string) {
    if (form.states.includes(stateShortname)) {
      form.states = form.states.filter((s) => s !== stateShortname);
    } else {
      form.states = [...form.states, stateShortname];
    }
  }

  // Add new setting tier
  function addSetting() {
    form.settings = [
      ...form.settings,
      {
        min: "",
        max: "",
        cost: "",
        minimum_retail: "",
        note: "",
        is_active: true,
      },
    ];
  }

  // Remove setting tier
  function removeSetting(index: number) {
    form.settings = form.settings.filter((_, i) => i !== index);
  }
</script>

{#if show}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div
      class="modal-content shipping-item-modal"
      role="dialog"
      aria-modal="true"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.add_shipping_item")}
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
        <!-- States Selection -->
        <div class="form-section">
          <label class="form-label">
            {$_("seller_dashboard.states_selection_label")}
          </label>
          <p
            class="help-text"
            style="margin-bottom: 1rem; color: #6b7280; font-size: 0.875rem;"
          >
            Leave empty for default shipping to all states
          </p>
          <div class="states-grid">
            {#each iraqStates as state (state.shortname)}
              <label class="state-checkbox">
                <input
                  type="checkbox"
                  checked={form.states.includes(state.shortname)}
                  onchange={() => toggleState(state.shortname)}
                />
                <span>{getStateDisplayName(state.shortname)}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Shipping Settings/Tiers -->
        <div class="form-section">
          <div
            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;"
          >
            <h3>{$_("seller_dashboard.delivery_based_settings")}</h3>
            <button type="button" class="btn-secondary" onclick={addSetting}>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                style="width: 16px; height: 16px;"
              >
                <path
                  d="M10 5v10M5 10h10"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              Add Tier
            </button>
          </div>

          {#each form.settings as setting, index (index)}
            <div class="setting-tier">
              <div class="tier-header">
                <h4>Tier {index + 1}</h4>
                {#if form.settings.length > 1}
                  <button
                    type="button"
                    class="btn-icon"
                    onclick={() => removeSetting(index)}
                    title="Remove tier"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
                      <path
                        d="M2 4h12M5 4V2h6v2M3 4h10l-1 10H4L3 4z"
                        stroke-width="1.5"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                {/if}
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">
                    {$_("seller_dashboard.min_days")} *
                  </label>
                  <input
                    type="number"
                    bind:value={setting.min}
                    class="form-input"
                    placeholder="e.g., 1"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">
                    {$_("seller_dashboard.max_days")} *
                  </label>
                  <input
                    type="number"
                    bind:value={setting.max}
                    class="form-input"
                    placeholder="e.g., 3"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">
                    {$_("seller_dashboard.cost")} * ({$_(
                      "seller_dashboard.currency"
                    )})
                  </label>
                  <input
                    type="number"
                    bind:value={setting.cost}
                    class="form-input"
                    placeholder="e.g., 5000"
                    min="0"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">
                    {$_("seller_dashboard.minimum_retail_price")} ({$_(
                      "seller_dashboard.currency"
                    )})
                  </label>
                  <input
                    type="number"
                    bind:value={setting.minimum_retail}
                    class="form-input"
                    placeholder="Optional"
                    min="0"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">
                    {$_("seller_dashboard.note_translation_key")}
                  </label>
                  <input
                    type="text"
                    bind:value={setting.note}
                    class="form-input"
                    placeholder="Optional note or translation key"
                  />
                </div>

                <div class="form-group">
                  <label class="checkbox-label">
                    <input type="checkbox" bind:checked={setting.is_active} />
                    <span>{$_("seller_dashboard.active")}</span>
                  </label>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={onClose} disabled={isLoading}>
          {$_("common.cancel")}
        </button>
        <button class="btn-primary" onclick={onSubmit} disabled={isLoading}>
          {isLoading ? $_("common.saving") : $_("seller_dashboard.save")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .shipping-item-modal {
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .states-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .state-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .state-checkbox:hover {
    background: #f9fafb;
    border-color: #281f51;
  }

  .state-checkbox input[type="checkbox"] {
    cursor: pointer;
  }

  .setting-tier {
    padding: 1.5rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    margin-bottom: 1rem;
    background: #fafafa;
  }

  .tier-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .tier-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #281f51;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-row:last-child {
    margin-bottom: 0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.75rem;
    cursor: pointer;
  }

  .help-text {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }
</style>

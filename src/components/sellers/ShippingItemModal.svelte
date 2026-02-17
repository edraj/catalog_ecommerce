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
    { shortname: "baghdad", name: { en: "Baghdad", ar: "بغداد", ku: "بەغدا" } },
    { shortname: "basra", name: { en: "Basra", ar: "البصرة", ku: "بەسرە" } },
    { shortname: "nineveh", name: { en: "Nineveh", ar: "نينوى", ku: "نەینەوا" } },
    { shortname: "erbil", name: { en: "Erbil", ar: "أربيل", ku: "هەولێر" } },
    { shortname: "sulaymaniyah", name: { en: "Sulaymaniyah", ar: "السليمانية", ku: "سلێمانی" } },
    { shortname: "dohuk", name: { en: "Dohuk", ar: "دهوك", ku: "دهۆک" } },
    { shortname: "anbar", name: { en: "Anbar", ar: "الأنبار", ku: "ئەنبار" } },
    { shortname: "diyala", name: { en: "Diyala", ar: "ديالى", ku: "دیالە" } },
    { shortname: "salahuddin", name: { en: "Salah al-Din", ar: "صلاح الدين", ku: "سەلاحەدین" } },
    { shortname: "kirkuk", name: { en: "Kirkuk", ar: "كركوك", ku: "کەرکووک" } },
    { shortname: "najaf", name: { en: "Najaf", ar: "النجف", ku: "نەجەف" } },
    { shortname: "karbala", name: { en: "Karbala", ar: "كربلاء", ku: "کەربەلا" } },
    { shortname: "babil", name: { en: "Babil", ar: "بابل", ku: "بابل" } },
    { shortname: "wasit", name: { en: "Wasit", ar: "واسط", ku: "واست" } },
    { shortname: "maysan", name: { en: "Maysan", ar: "ميسان", ku: "مەیسان" } },
    { shortname: "dhi_qar", name: { en: "Dhi Qar", ar: "ذي قار", ku: "زیقار" } },
    { shortname: "muthanna", name: { en: "Al-Muthanna", ar: "المثنى", ku: "موسەنا" } },
    { shortname: "qadisiyyah", name: { en: "Al-Qadisiyyah", ar: "القادسية", ku: "قادسیە" } },
  ];

  const getStateDisplayName = (stateShortname: string) => {
    const state = iraqStates.find((s) => s.shortname === stateShortname);
    if (!state) return stateShortname;
    const lang = $_("lang") || "en";
    return state.name[lang as keyof typeof state.name] || state.name.en;
  };

  function toggleState(stateShortname: string) {
    if (form.states.includes(stateShortname)) {
      form.states = form.states.filter((s) => s !== stateShortname);
    } else {
      form.states = [...form.states, stateShortname];
    }
  }

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

  function removeSetting(index: number) {
    form.settings = form.settings.filter((_: any, i: number) => i !== index);
  }

  function handleSave(e?: Event) {
    e?.preventDefault();
    onSubmit();
  }
</script>

{#if show}
  <div
    class="modal-overlay"
    onclick={onClose}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div class="modal-container modal-large" onclick={(e) => e.stopPropagation()}>
      <!-- Header (match previous modal header design) -->
      <div class="product-modal-header">
        <h2 class="product-modal-title">
          { "Add Shipping Item"}
        </h2>

        <button
          class="product-modal-close"
          onclick={onClose}
          aria-label="Close"
          type="button"
        >
          <!-- SPEC CLOSE SVG (same as previous design) -->
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M15.5378 4.40935C15.864 4.73397 15.8653 5.26161 15.5407 5.58786L11.1755 9.97496L15.5907 14.4123C15.9153 14.7385 15.914 15.2662 15.5877 15.5908C15.2615 15.9154 14.7339 15.9141 14.4092 15.5878L9.99996 11.1564L5.59069 15.5878C5.26607 15.9141 4.73843 15.9154 4.41218 15.5908C4.08593 15.2662 4.08461 14.7385 4.40923 14.4123L8.82439 9.97496L4.45921 5.58786C4.13459 5.26161 4.13591 4.73398 4.46216 4.40936C4.78842 4.08474 5.31605 4.08606 5.64067 4.41231L9.99996 8.79348L14.3592 4.4123C14.6839 4.08605 15.2115 4.08473 15.5378 4.40935Z"
              fill="#3C307F"
            />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="product-modal-body">
        <!-- States Selection -->
        <div class="form-content">
          <div class="form-block">
            <div class="block-head">
              <h3 class="block-title">
                {$_("seller_dashboard.states_selection_label") || "States"}
              </h3>
              <p class="block-subtitle">
                {$_("seller_dashboard.states_selection_help") ||
                  "Leave empty for default shipping to all states"}
              </p>
            </div>

            <div class="states-grid">
              {#each iraqStates as state (state.shortname)}
                <label
                  class="state-checkbox"
                  class:checked={form.states.includes(state.shortname)}
                >
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
          <div class="form-block">
            <div class="tier-top">
              <div>
                <h3 class="block-title">
                  {$_("seller_dashboard.delivery_based_settings") ||
                    "Delivery based settings"}
                </h3>
                <p class="block-subtitle">
                  {$_("seller_dashboard.delivery_based_settings_help") ||
                    "Add tiers to define delivery days and cost."}
                </p>
              </div>

              <button type="button" class="btn-secondary" onclick={addSetting}>
                <span class="btn-icon-left" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 5v10M5 10h10"
                      stroke="#4A5565"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
                { "Add Tier"}
              </button>
            </div>

            <div class="tiers">
              {#each form.settings as setting, index (index)}
                <div class="tier-card">
                  <div class="tier-header">
                    <div class="tier-title">
                      {$_("seller_dashboard.tier") || "Tier"} {index + 1}
                    </div>

                    {#if form.settings.length > 1}
                      <button
                        type="button"
                        class="action-icon"
                        onclick={() => removeSetting(index)}
                        title={$_("common.remove") || "Remove"}
                        aria-label="Remove tier"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 4h12M5 4V2h6v2M3 4h10l-1 10H4L3 4z"
                            stroke="#4A5565"
                            stroke-width="1.5"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </button>
                    {/if}
                  </div>

                  <div class="grid-3">
                    <div class="field">
                      <label class="field-label">
                        {$_("seller_dashboard.min_days") || "Min days"} *
                      </label>
                      <input
                        class="text-input"
                        type="number"
                        min="0"
                        placeholder="e.g., 1"
                        bind:value={setting.min}
                      />
                    </div>

                    <div class="field">
                      <label class="field-label">
                        {$_("seller_dashboard.max_days") || "Max days"} *
                      </label>
                      <input
                        class="text-input"
                        type="number"
                        min="0"
                        placeholder="e.g., 3"
                        bind:value={setting.max}
                      />
                    </div>

                    <div class="field">
                      <label class="field-label">
                        {$_("seller_dashboard.cost") || "Cost"} *
                        <span class="muted">
                          ({$_("seller_dashboard.currency") || "IQD"})
                        </span>
                      </label>
                      <input
                        class="text-input"
                        type="number"
                        min="0"
                        placeholder="e.g., 5000"
                        bind:value={setting.cost}
                      />
                    </div>
                  </div>

                  <div class="grid-3">
                    <div class="field">
                      <label class="field-label">
                        {$_("seller_dashboard.minimum_retail_price") ||
                          "Minimum retail price"}
                        <span class="muted">
                          ({$_("seller_dashboard.currency") || "IQD"})
                        </span>
                      </label>
                      <input
                        class="text-input"
                        type="number"
                        min="0"
                        placeholder={$_("common.optional") || "Optional"}
                        bind:value={setting.minimum_retail}
                      />
                    </div>

                    <div class="field">
                      <label class="field-label">
                        {$_("seller_dashboard.note_translation_key") ||
                          "Note / translation key"}
                      </label>
                      <input
                        class="text-input"
                        type="text"
                        placeholder={$_("common.optional") || "Optional"}
                        bind:value={setting.note}
                      />
                    </div>

                    <div class="field switch-field">
                      <label class="field-label">
                        {$_("seller_dashboard.status") || "Status"}
                      </label>

                      <label class="checkbox-inline">
                        <input
                          type="checkbox"
                          bind:checked={setting.is_active}
                        />
                        <span>{$_("seller_dashboard.active") || "Active"}</span>
                      </label>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer (match previous modal footer: primary full width if you want like product modal) -->
      <div class="modal-footer">
       

        <button
          class="btn-primary w-full"
          onclick={handleSave}
          disabled={isLoading}
          type="button"
        >
          {isLoading
            ? $_("common.saving") || "Saving..."
            : $_("seller_dashboard.save") || "Save"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Container sizing like your "modal-large" product modal */
  .modal-container.modal-large {
    width: min(980px, calc(100vw - 32px));
    max-height: 90vh;
    overflow: hidden;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
  }

  /* Header (same naming you used: product-modal-*) */
  .product-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 10px;
    border-bottom: 1px solid #e5e7eb;
  }

  .product-modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }

  .product-modal-close {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .product-modal-close:hover {
    background: #f3f4f6;
  }

  /* Body */
  .product-modal-body {
    padding: 18px;
    overflow: auto;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-block {
    border: 1px solid #e5e7eb;
    background: #fff;
    border-radius: 14px;
    padding: 16px;
  }

  .block-head {
    margin-bottom: 12px;
  }

  .block-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .block-subtitle {
    margin: 6px 0 0;
    font-size: 12px;
    color: #6a7282;
  }

  /* States grid */
  .states-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }

  .state-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fff;
  }

  .state-checkbox:hover {
    background: #f9fafb;
    border-color: #3c307f;
  }

  .state-checkbox.checked {
    border-color: rgba(60, 48, 127, 0.35);
    background: rgba(60, 48, 127, 0.04);
  }

  .state-checkbox input {
    cursor: pointer;
  }

  /* Tier header row */
  .tier-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .tiers {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tier-card {
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 14px;
    padding: 14px;
  }

  .tier-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .tier-title {
    font-size: 13px;
    font-weight: 700;
    color: #3c307f;
  }

  .action-icon {
    width: 32px;
    height: 32px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .action-icon:hover {
    background: #f3f4f6;
  }

  /* Inputs (match your product modal look) */
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }

  @media (max-width: 900px) {
    .grid-3 {
      grid-template-columns: 1fr;
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #4a5565;
  }

  .muted {
    font-weight: 500;
    color: #6a7282;
  }

  .text-input {
    height: 40px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 0 12px;
    font-size: 14px;
    color: #111827;
    background: #fff;
    outline: none;
    transition: all 0.2s ease;
  }

  .text-input:focus {
    border-color: #3c307f;
    box-shadow: 0 0 0 3px rgba(60, 48, 127, 0.1);
  }

  .switch-field .checkbox-inline {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #fff;
  }

  .checkbox-inline input {
    cursor: pointer;
  }

  /* Buttons */
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #4a5565;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: #f3f4f6;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    border-radius: 12px;
    border: 1px solid #3c307f;
    background: #3c307f;
    color: #fff;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Footer */
  .modal-footer {
    padding: 14px 18px 18px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    background: #fff;
  }
</style>

<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    couponForm: {
      type: string;
      minValue: string;
      maxValue: string;
      amount: string;
    };
    onClose: () => void;
    onSubmit: () => void;
  };

  let {
    show = $bindable(),
    isRTL,
    couponForm = $bindable(),
    onClose,
    onSubmit,
  }: Props = $props();
</script>

{#if show}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_coupon") || "Create Coupon"}
        </h2>
        <button class="modal-close" onclick={onClose}>
          <svg
            class="close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
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
        <!-- Type Selection -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <svg
              class="label-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span>{$_("seller_dashboard.coupon_type") || "Type"}</span>
          </label>
          <select
            bind:value={couponForm.type}
            class="form-select"
            class:rtl={isRTL}
          >
            <option value="value"
              >{$_("seller_dashboard.value") || "Value"}</option
            >
            <option value="percentage"
              >{$_("seller_dashboard.percentage") || "Percentage"}</option
            >
          </select>
        </div>

        <!-- Min Value -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.min_value") || "Minimum Value"}</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={couponForm.minValue}
            placeholder={$_("seller_dashboard.enter_min_value") ||
              "Enter minimum value"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- Max Value -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span
              >{$_("seller_dashboard.max_value") ||
                "Maximum Value (Optional)"}</span
            >
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={couponForm.maxValue}
            placeholder={$_("seller_dashboard.enter_max_value") ||
              "Enter maximum value"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- Amount -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span
              >{$_("seller_dashboard.amount") ||
                `Amount (${couponForm.type === "percentage" ? "%" : "$"})`}</span
            >
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={couponForm.type === "percentage" ? "100" : undefined}
            bind:value={couponForm.amount}
            placeholder={$_("seller_dashboard.enter_amount") || "Enter amount"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={onSubmit}
          disabled={!couponForm.amount || !couponForm.minValue}
        >
          {$_("seller_dashboard.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

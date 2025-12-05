<script lang="ts">
  import { _ } from "@/i18n";

  type Props = {
    show: boolean;
    isRTL: boolean;
    branchForm: {
      name: string;
      country: string;
      state: string;
      city: string;
      address: string;
    };
    onClose: () => void;
    onSubmit: () => void;
  };

  let {
    show = $bindable(),
    isRTL,
    branchForm = $bindable(),
    onClose,
    onSubmit,
  }: Props = $props();
</script>

{#if show}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.create_branch") || "Create Branch"}
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
        <!-- Name -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.branch_name") || "Branch Name"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.name}
            placeholder={$_("seller_dashboard.enter_branch_name") ||
              "Enter branch name"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- Country -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.country") || "Country"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.country}
            placeholder={$_("seller_dashboard.enter_country") ||
              "Enter country"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- State -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.state") || "State (Optional)"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.state}
            placeholder={$_("seller_dashboard.enter_state") || "Enter state"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- City -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.city") || "City"}</span>
          </label>
          <input
            type="text"
            bind:value={branchForm.city}
            placeholder={$_("seller_dashboard.enter_city") || "Enter city"}
            class="form-input"
            class:rtl={isRTL}
          />
        </div>

        <!-- Address -->
        <div class="form-group">
          <label class="form-label" class:rtl={isRTL}>
            <span>{$_("seller_dashboard.address") || "Address"}</span>
          </label>
          <textarea
            bind:value={branchForm.address}
            placeholder={$_("seller_dashboard.enter_address") ||
              "Enter full address"}
            class="form-textarea"
            class:rtl={isRTL}
            rows="3"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={onClose}>
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button submit"
          onclick={onSubmit}
          disabled={!branchForm.name ||
            !branchForm.country ||
            !branchForm.city ||
            !branchForm.address}
        >
          {$_("seller_dashboard.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

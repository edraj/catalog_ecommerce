<script lang="ts">
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { Modal, Button } from "@/components/ui";
  import { getOptionName } from "@/lib/utils/entityUtils";

  interface Props {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    option: any;
  }

  let { show = $bindable(), onClose, onConfirm, option }: Props = $props();
</script>

<Modal
  bind:show
  title={$_("admin_dashboard.delete_option") || "Delete Option"}
  size="small"
  {onClose}
>
  {#snippet body()}
    <div class="delete-warning">
      <div class="warning-icon">⚠️</div>
      <p>Are you sure you want to delete this option?</p>
      <p class="option-name-highlight">
        {option ? getOptionName(option, $locale) : ""}
      </p>
      <p class="warning-text">
        This action cannot be undone and may affect products using this option.
      </p>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" onclick={onClose}>
      {$_("common.cancel") || "Cancel"}
    </Button>
    <Button variant="danger" onclick={onConfirm}>
      {$_("common.delete") || "Delete"}
    </Button>
  {/snippet}
</Modal>

<style>
  .delete-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .delete-warning p {
    color: #6b7280;
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .option-name-highlight {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 1.125rem;
    margin: 1rem 0 !important;
  }

  .warning-text {
    font-size: 0.875rem;
    color: #dc2626;
    margin-top: 1rem !important;
  }
</style>

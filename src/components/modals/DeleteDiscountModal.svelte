<script lang="ts">
  import { _ } from "@/i18n";
  import { Modal, Button } from "@/components/ui";

  interface Props {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    discount: any;
  }

  let { show = $bindable(), onClose, onConfirm, discount }: Props = $props();
</script>

<Modal
  bind:show
  title={$_("common.confirm_delete") || "Confirm Delete"}
  size="small"
  {onClose}
>
  {#snippet body()}
    <div class="delete-warning">
      <div class="warning-icon">⚠️</div>
      <p>
        {$_("admin.delete_discount_confirm") ||
          "Are you sure you want to delete this discount?"}
      </p>
      <p class="discount-name-highlight">
        {discount?.type_shortname || discount?.type || "-"}
      </p>
      <p class="warning-text">This action cannot be undone.</p>
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

  .discount-name-highlight {
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

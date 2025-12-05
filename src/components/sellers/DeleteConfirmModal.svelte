<script lang="ts">
  import { _ } from "@/i18n";

  interface Props {
    show: boolean;
    item: any;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: () => void;
  }

  let { show, item, isLoading, onClose, onConfirm }: Props = $props();

  function getLocalizedDisplayName(item: any) {
    if (!item) return "";
    const displayname = item.attributes?.displayname;
    if (!displayname) return item.shortname || "Untitled";
    if (typeof displayname === "string") return displayname;

    const locale = localStorage.getItem("locale") || "en";
    return (
      displayname[locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku ||
      item.shortname ||
      "Untitled"
    );
  }
</script>

{#if show && item}
  <div class="modal-overlay">
    <div class="modal-container small">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("seller_dashboard.confirm_delete") || "Confirm Delete"}
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
        <p class="delete-message">
          {$_("seller_dashboard.delete_confirmation") ||
            "Are you sure you want to delete this item?"}
        </p>
        <p class="delete-item-name">
          <strong>{getLocalizedDisplayName(item)}</strong>
        </p>
        <p class="delete-warning">
          {$_("seller_dashboard.delete_warning") ||
            "This action cannot be undone."}
        </p>
      </div>

      <div class="modal-footer">
        <button
          class="modal-button cancel"
          onclick={onClose}
          disabled={isLoading}
        >
          {$_("seller_dashboard.cancel") || "Cancel"}
        </button>
        <button
          class="modal-button delete"
          onclick={onConfirm}
          disabled={isLoading}
        >
          {$_("seller_dashboard.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-container {
    background: white;
    border-radius: 24px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
    width: 90%;
    max-width: 1200px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(30px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-container.small {
    max-width: 500px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .modal-close {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 12px;
    border: none;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  .modal-close:hover {
    background: #f7fafc;
    transform: scale(1.1);
  }

  .close-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #718096;
    stroke-width: 2.5;
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .delete-message {
    font-size: 1rem;
    color: #4a5568;
    margin-bottom: 1rem;
  }

  .delete-item-name {
    font-size: 1.1rem;
    color: #1a202c;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #fff5f5;
    border-radius: 8px;
    text-align: center;
  }

  .delete-warning {
    font-size: 0.9rem;
    color: #e53e3e;
    font-weight: 600;
    margin: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    background: #f7fafc;
  }

  .modal-button {
    padding: 0.875rem 1.75rem;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
  }

  .modal-button.cancel {
    background: white;
    color: #718096;
    border: 2px solid #e2e8f0;
  }

  .modal-button.cancel:hover:not(:disabled) {
    background: #f7fafc;
    border-color: #cbd5e0;
  }

  .modal-button.delete {
    background: linear-gradient(135deg, #f56565 0%, #c53030 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(245, 101, 101, 0.4);
  }

  .modal-button.delete:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(245, 101, 101, 0.5);
  }

  .modal-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .modal-container {
      max-width: 95%;
      margin: 0 1rem;
    }

    .modal-header,
    .modal-body {
      padding: 1.5rem;
    }

    .modal-footer {
      flex-direction: column;
      padding: 1rem 1.5rem;
    }

    .modal-button {
      width: 100%;
    }
  }
</style>

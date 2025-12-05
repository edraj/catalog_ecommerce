<script lang="ts">
  interface Props {
    type?: "success" | "error" | "warning" | "info";
    title?: string;
    message: string;
    dismissible?: boolean;
    onDismiss?: () => void;
  }

  let {
    type = "info",
    title = "",
    message,
    dismissible = true,
    onDismiss,
  }: Props = $props();

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  const icon = $derived(icons[type]);
</script>

<div class="alert alert-{type}">
  <div class="alert-icon">{icon}</div>
  <div class="alert-content">
    {#if title}
      <h4 class="alert-title">{title}</h4>
    {/if}
    <p class="alert-message">{message}</p>
  </div>
  {#if dismissible && onDismiss}
    <button class="alert-close" onclick={onDismiss} aria-label="Dismiss">
      ✕
    </button>
  {/if}
</div>

<style>
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid;
    margin-bottom: 1rem;
  }

  .alert-success {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
  }

  .alert-error {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .alert-warning {
    background: #fefce8;
    border-color: #fde047;
    color: #854d0e;
  }

  .alert-info {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1e40af;
  }

  .alert-icon {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .alert-content {
    flex: 1;
  }

  .alert-title {
    font-weight: 600;
    font-size: 0.875rem;
    margin: 0 0 0.25rem 0;
  }

  .alert-message {
    margin: 0;
    font-size: 0.875rem;
  }

  .alert-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    color: inherit;
    opacity: 0.7;
    transition: opacity 0.2s;
    font-size: 1.25rem;
    line-height: 1;
  }

  .alert-close:hover {
    opacity: 1;
  }
</style>

<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { locale } from "@/i18n";
  import { derived } from "svelte/store";
  import type { Snippet } from "svelte";

  interface Props {
    show?: boolean;
    title?: string;
    size?: "small" | "medium" | "large";
    onClose?: () => void;
    children?: Snippet;
    header?: Snippet;
    body?: Snippet;
    footer?: Snippet;
  }

  let {
    show = $bindable(false),
    title = "",
    size = "medium",
    onClose = () => {},
    children,
    header,
    body,
    footer,
  }: Props = $props();

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  function handleOverlayClick() {
    onClose();
  }

  function handleContainerClick(e: MouseEvent) {
    e.stopPropagation();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && show) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <div
    class="modal-overlay"
    class:rtl={$isRTL}
    onclick={handleOverlayClick}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div
      class="modal-container {size}"
      onclick={handleContainerClick}
      transition:scale={{ duration: 300, start: 0.95 }}
    >
      {#if title || header}
        <div class="modal-header">
          {#if header}
            {@render header()}
          {:else}
            <h2 id="modal-title" class="modal-title">{title}</h2>
          {/if}
          <button
            class="modal-close"
            onclick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
      {/if}

      {#if body || children}
        <div class="modal-body">
          {#if body}
            {@render body()}
          {:else if children}
            {@render children()}
          {/if}
        </div>
      {/if}

      {#if footer}
        <div class="modal-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .rtl {
    direction: rtl;
  }

  .modal-container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(229, 231, 235, 0.8);
    overflow: hidden;
  }

  .modal-container.small {
    max-width: 28rem;
  }

  .modal-container.medium {
    max-width: 48rem;
  }

  .modal-container.large {
    max-width: 80rem;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 2rem;
    line-height: 1;
    width: 2.5rem;
    height: 2.5rem;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #374151;
    transform: scale(1.05);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    min-height: 0;
  }

  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: #f9fafb;
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .modal-container {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
      margin: 0;
    }

    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1rem 1.5rem;
    }

    .modal-title {
      font-size: 1.25rem;
    }
  }
</style>

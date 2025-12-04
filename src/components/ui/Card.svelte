<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    children?: Snippet;
    header?: Snippet;
    footer?: Snippet;
    class?: string;
    hoverable?: boolean;
    clickable?: boolean;
    onclick?: () => void;
  }

  let {
    title = "",
    children,
    header,
    footer,
    class: className = "",
    hoverable = false,
    clickable = false,
    onclick,
  }: Props = $props();
</script>

<div
  class="card {className}"
  class:hoverable
  class:clickable
  {onclick}
  role={clickable ? "button" : undefined}
  tabindex={clickable ? 0 : undefined}
>
  {#if title || header}
    <div class="card-header">
      {#if header}
        {@render header()}
      {:else if title}
        <h3 class="card-title">{title}</h3>
      {/if}
    </div>
  {/if}

  {#if children}
    <div class="card-body">
      {@render children()}
    </div>
  {/if}

  {#if footer}
    <div class="card-footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .card.hoverable:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .card.clickable {
    cursor: pointer;
  }

  .card.clickable:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .card-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .card-body {
    padding: 1.5rem;
  }

  .card-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }
</style>

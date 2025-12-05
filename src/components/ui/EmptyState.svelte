<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    icon?: string;
    title?: string;
    description?: string;
    action?: Snippet;
  }

  let {
    icon = "📭",
    title = "No items found",
    description = "",
    action,
  }: Props = $props();
</script>

<div class="empty-state">
  <div class="empty-icon">{icon}</div>
  <h3 class="empty-title">{title}</h3>
  {#if description}
    <p class="empty-description">{description}</p>
  {/if}
  {#if action}
    <div class="empty-action">
      {@render action()}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 3rem;
    text-align: center;
    background: white;
    border-radius: 1rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .empty-description {
    font-size: 0.95rem;
    color: #6b7280;
    margin: 0 0 1.5rem 0;
    max-width: 400px;
  }

  .empty-action {
    margin-top: 1rem;
  }
</style>

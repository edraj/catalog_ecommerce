<script lang="ts">
  interface Props {
    message?: string;
    size?: "small" | "medium" | "large";
    inline?: boolean;
  }

  let {
    message = "Loading...",
    size = "medium",
    inline = false,
  }: Props = $props();

  const sizes = {
    small: "1.5rem",
    medium: "3rem",
    large: "4rem",
  };

  const spinnerSize = $derived(sizes[size]);
</script>

<div class="loading-container" class:inline>
  <div
    class="spinner"
    style="width: {spinnerSize}; height: {spinnerSize};"
  ></div>
  {#if message}
    <p class="loading-message">{message}</p>
  {/if}
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 400px;
    padding: 3rem;
  }

  .loading-container.inline {
    min-height: auto;
    padding: 1rem;
  }

  .spinner {
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-message {
    font-size: 0.95rem;
    color: #6b7280;
    margin: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

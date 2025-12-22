<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "primary" | "secondary" | "danger" | "link";
    size?: "small" | "medium" | "large";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    loading?: boolean;
    onclick?: (e: MouseEvent) => void;
    class?: string;
    children?: Snippet;
  }

  let {
    variant = "primary",
    size = "medium",
    type = "button",
    disabled = false,
    loading = false,
    onclick,
    class: className = "",
    children,
  }: Props = $props();

  const baseClasses = "btn";
  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    link: "btn-link",
  };
  const sizeClasses = {
    small: "btn-sm",
    medium: "btn-md",
    large: "btn-lg",
  };

  const classes = $derived(
    `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
  );
</script>

<button {type} class={classes} disabled={disabled || loading} {onclick}>
  {#if loading}
    <span class="spinner"></span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-weight: 600;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .btn-md {
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
  }

  .btn-lg {
    padding: 1rem 2rem;
    font-size: 1rem;
  }

  /* Variants */
  .btn-primary {
    background: #281f51;
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .btn-primary:hover:not(:disabled) {
    background: #281f51;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn-secondary {
    background: white;
    border-color: #d1d5db;
    color: #6b7280;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  .btn-link {
    background: transparent;
    color: #3b82f6;
    border: none;
    padding: 0.5rem;
  }

  .btn-link:hover:not(:disabled) {
    color: #2563eb;
    text-decoration: underline;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

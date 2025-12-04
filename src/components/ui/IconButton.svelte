<script lang="ts">
  interface Props {
    icon?: string;
    size?: "small" | "medium" | "large";
    variant?: "default" | "delete";
    onclick?: (e: MouseEvent) => void;
    title?: string;
    disabled?: boolean;
  }

  let {
    icon,
    size = "medium",
    variant = "default",
    onclick,
    title = "",
    disabled = false,
  }: Props = $props();

  const sizeClasses = {
    small: "btn-icon-sm",
    medium: "btn-icon-md",
    large: "btn-icon-lg",
  };

  const variantClasses = {
    default: "btn-icon-default",
    delete: "btn-icon-delete",
  };

  const classes = $derived(
    `btn-icon ${sizeClasses[size]} ${variantClasses[variant]}`
  );
</script>

<button class={classes} {onclick} {title} {disabled} type="button">
  {#if icon}
    {icon}
  {:else}
    <slot />
  {/if}
</button>

<style>
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #6b7280;
  }

  .btn-icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-icon-sm {
    padding: 0.25rem;
    font-size: 0.875rem;
  }

  .btn-icon-md {
    padding: 0.5rem;
    font-size: 1rem;
  }

  .btn-icon-lg {
    padding: 0.75rem;
    font-size: 1.25rem;
  }

  /* Variants */
  .btn-icon-default:hover:not(:disabled) {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-icon-delete {
    color: #ef4444;
  }

  .btn-icon-delete:hover:not(:disabled) {
    background: #fee2e2;
    color: #dc2626;
  }
</style>

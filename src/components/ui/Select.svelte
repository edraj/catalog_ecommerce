<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    value?: string;
    onchange?: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    class?: string;
    id?: string;
  }

  let {
    label = "",
    value = $bindable(""),
    onchange,
    options = [],
    class: className = "",
    id,
  }: Props = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value;
    if (onchange) {
      onchange(target.value);
    }
  }
</script>

<div class="select-group">
  {#if label}
    <label for={id} class="select-label">{label}</label>
  {/if}
  <select
    {id}
    bind:value
    onchange={handleChange}
    class="select-input {className}"
  >
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</div>

<style>
  .select-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .select-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .select-input {
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #111827;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-input:hover {
    border-color: #9ca3af;
  }

  .select-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
</style>

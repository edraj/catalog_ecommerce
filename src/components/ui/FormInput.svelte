<script lang="ts">
  interface Props {
    id?: string;
    label?: string;
    type?: "text" | "email" | "password" | "number" | "textarea" | "select";
    value?: string | number;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    rows?: number;
    options?: Array<{ value: string | number; label: string }>;
    help?: string;
  }

  let {
    id,
    label = "",
    type = "text",
    value = $bindable(""),
    placeholder = "",
    error = "",
    required = false,
    disabled = false,
    rows = 3,
    options = [],
    help = "",
  }: Props = $props();
</script>

<div class="form-group">
  {#if label}
    <label for={id} class="form-label">
      {label}
      {#if required}
        <span class="required">*</span>
      {/if}
    </label>
  {/if}

  {#if help}
    <p class="form-help">{help}</p>
  {/if}

  {#if type === "textarea"}
    <textarea
      {id}
      bind:value
      {placeholder}
      {disabled}
      {rows}
      class="form-input form-textarea"
      class:error={!!error}
    ></textarea>
  {:else if type === "select"}
    <select {id} bind:value {disabled} class="form-input" class:error={!!error}>
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {:else}
    <input
      {id}
      {type}
      bind:value
      {placeholder}
      {disabled}
      class="form-input"
      class:error={!!error}
    />
  {/if}

  {#if error}
    <p class="error-text">{error}</p>
  {/if}
</div>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .required {
    color: #ef4444;
  }

  .form-help {
    font-size: 0.75rem;
    color: #6b7280;
    margin: -0.25rem 0 0.25rem 0;
  }

  .form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #111827;
    background: white;
    transition: all 0.2s ease;
  }

  .form-input:hover:not(:disabled) {
    border-color: #9ca3af;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-input.error {
    border-color: #ef4444;
  }

  .form-input.error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }

  .error-text {
    font-size: 0.75rem;
    color: #ef4444;
    margin: 0;
  }
</style>

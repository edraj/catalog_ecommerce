<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "@/i18n";
  import { getSpaceContents } from "@/lib/dmart_services";

  let {
    formData = $bindable(),
    validateFn = $bindable(),
  }: {
    formData: any;
    validateFn: () => boolean;
  } = $props();

  let form;
  let availableCollections = $state([]);
  let loading = $state(true);

  // Initialize form data
  formData = {
    ...formData,
    shortname: formData.shortname || "",
    region_type: formData.region_type || "collections",
    collections: formData.collections || [],
    single_collection_shortname: formData.single_collection_shortname || "",
    is_active: formData.is_active ?? true,
  };

  onMount(async () => {
    await loadCollections();
  });

  async function loadCollections() {
    try {
      const response: any = await getSpaceContents(
        "e_commerce",
        "/settings/collections",
        "managed",
        100,
        0,
        true
      );
      if (response && response.records) {
        availableCollections = response.records.filter(
          (col) => col.attributes?.payload?.body?.type === "product_cards"
        );
      }
    } catch (error) {
      console.error("Failed to load collections:", error);
    } finally {
      loading = false;
    }
  }

  function validate() {
    const isValid = form?.checkValidity();
    if (!isValid) {
      form?.reportValidity();
      return false;
    }

    // Additional validation
    if (
      formData.region_type === "collections" &&
      formData.collections.length === 0
    ) {
      alert($_("validation.selectAtLeastOneCollection"));
      return false;
    }

    if (
      formData.region_type === "single_collection" &&
      !formData.single_collection_shortname
    ) {
      alert($_("validation.selectCollection"));
      return false;
    }

    return true;
  }

  validateFn = validate;

  function toggleCollection(collectionShortname: string) {
    const index = formData.collections.indexOf(collectionShortname);
    if (index === -1) {
      formData.collections = [...formData.collections, collectionShortname];
    } else {
      formData.collections = formData.collections.filter(
        (c) => c !== collectionShortname
      );
    }
  }
</script>

<form bind:this={form} class="region-form">
  <div class="card">
    <h2 class="card-title">{$_("region.basicInfo")}</h2>

    <div class="form-group">
      <label class="form-label" for="shortname">
        <span class="required">*</span>
        {$_("region.shortname")}
      </label>
      <input
        id="shortname"
        type="text"
        class="form-input"
        bind:value={formData.shortname}
        pattern="^[a-zA-Z0-9_]&#123;1,64&#125;$"
        required
        placeholder={$_("region.shortnamePlaceholder")}
      />
      <small class="form-hint">{$_("region.shortnameHint")}</small>
    </div>

    <div class="form-group">
      <label class="form-label" for="region_type">
        <span class="required">*</span>
        {$_("region.type")}
      </label>
      <select
        id="region_type"
        class="form-select"
        bind:value={formData.region_type}
        required
      >
        <option value="collections">{$_("region.typeCollections")}</option>
        <option value="single_collection"
          >{$_("region.typeSingleCollection")}</option
        >
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" bind:checked={formData.is_active} />
        {$_("common.isActive")}
      </label>
    </div>
  </div>

  <div class="card">
    <h2 class="card-title">{$_("region.collectionsConfig")}</h2>

    {#if loading}
      <div class="loading-skeleton">
        <div class="skeleton-line"></div>
      </div>
    {:else if formData.region_type === "collections"}
      <div class="form-group">
        <div class="form-label">
          <span class="required">*</span>
          {$_("region.selectCollections")}
        </div>
        <div class="collections-list">
          {#each availableCollections as collection}
            <label class="checkbox-item">
              <input
                type="checkbox"
                checked={formData.collections.includes(collection.shortname)}
                onchange={() => toggleCollection(collection.shortname)}
              />
              <span>{collection.shortname}</span>
              {#if collection.attributes?.title?.en}
                <span class="text-gray-500"
                  >- {collection.attributes.title.en}</span
                >
              {/if}
            </label>
          {/each}
        </div>
      </div>
    {:else if formData.region_type === "single_collection"}
      <div class="form-group">
        <label class="form-label" for="single_collection">
          <span class="required">*</span>
          {$_("region.selectSingleCollection")}
        </label>
        <select
          id="single_collection"
          class="form-select"
          bind:value={formData.single_collection_shortname}
          required
        >
          <option value="">{$_("region.selectCollectionPlaceholder")}</option>
          {#each availableCollections as collection}
            <option value={collection.shortname}>
              {collection.shortname}
              {#if collection.attributes?.title?.en}
                - {collection.attributes.title.en}
              {/if}
            </option>
          {/each}
        </select>
        <small class="form-hint">{$_("region.singleCollectionHint")}</small>
      </div>
    {/if}
  </div>
</form>

<style>
  .region-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    color: #1f2937;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .required {
    color: #ef4444;
    margin-right: 0.25rem;
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .checkbox-item:hover {
    background-color: #f9fafb;
  }

  .loading-skeleton {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-line {
    width: 100%;
    height: 40px;
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>

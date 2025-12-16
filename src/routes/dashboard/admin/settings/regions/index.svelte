<script lang="ts">
  import { onMount } from "svelte";
  import { ResourceType } from "@edraj/tsdmart";
  import RegionForm from "@/components/forms/RegionForm.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _ } from "@/i18n";
  import {
    getSpaceContents,
    createRegion,
    updateRegion,
    deleteEntity,
  } from "@/lib/dmart_services";
  import "./regions.css";

  let regions = $state([]);
  let isLoading = $state(true);
  let showModal = $state(false);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let formData: any = $state({});
  let validateFn = $state(() => true);
  let currentRegion = $state(null);
  let showDeleteConfirm = $state(false);
  let regionToDelete = $state(null);
  let isDeleting = $state(false);

  onMount(async () => {
    await loadRegions();
  });

  async function loadRegions() {
    isLoading = true;
    try {
      const response: any = await getSpaceContents(
        "e_commerce",
        "/settings/regions",
        "managed",
        100,
        0,
        true
      );

      if (response && response.records) {
        regions = response.records;
        successToastMessage(
          $_("regions.loaded", { values: { count: regions.length } })
        );
      }
    } catch (error) {
      console.error("Failed to load regions:", error);
      errorToastMessage($_("regions.loadFailed"));
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    formData = {
      shortname: "",
      region_type: "collections",
      collections: [],
      single_collection_shortname: "",
      is_active: true,
    };
    isEditing = false;
    currentRegion = null;
    showModal = true;
  }

  function openEditModal(region: any) {
    const payloadBody = region.attributes?.payload?.body || {};
    formData = {
      shortname: region.shortname,
      region_type: payloadBody.region_type || "collections",
      collections: payloadBody.collections || [],
      single_collection_shortname: payloadBody.collection_shortname || "",
      is_active: region.attributes?.is_active ?? true,
    };
    isEditing = true;
    currentRegion = region;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    formData = {};
    currentRegion = null;
  }

  async function saveRegion() {
    if (!validateFn()) {
      errorToastMessage($_("validation.fixErrors"));
      return;
    }

    isSaving = true;
    try {
      const result = isEditing
        ? await updateRegion("e_commerce", formData)
        : await createRegion("e_commerce", formData);

      if (result) {
        successToastMessage(
          isEditing ? $_("regions.updated") : $_("regions.created")
        );
        closeModal();
        await loadRegions();
      } else {
        errorToastMessage($_("regions.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save region:", error);
      errorToastMessage($_("regions.saveFailed"));
    } finally {
      isSaving = false;
    }
  }

  function openDeleteConfirm(region: any) {
    regionToDelete = region;
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    regionToDelete = null;
  }

  async function deleteRegion() {
    if (!regionToDelete) return;

    isDeleting = true;
    try {
      await deleteEntity(
        regionToDelete.shortname,
        "e_commerce",
        "/settings/regions",
        ResourceType.content
      );

      successToastMessage($_("regions.deleted"));
      closeDeleteConfirm();
      await loadRegions();
    } catch (error) {
      console.error("Failed to delete region:", error);
      errorToastMessage($_("regions.deleteFailed"));
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="regions-page">
  <div class="page-header">
    <h1 class="page-title">{$_("regions.title")}</h1>
    <button class="btn btn-primary" onclick={openCreateModal}>
      {$_("regions.createNew")}
    </button>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{$_("common.loading")}</p>
    </div>
  {:else}
    <div class="regions-grid">
      {#each regions as region}
        <div class="region-card">
          <div class="region-header">
            <h3 class="region-name">{region.shortname}</h3>
            <div
              class="region-badge"
              class:active={region.attributes?.is_active}
            >
              {region.attributes?.is_active
                ? $_("common.active")
                : $_("common.inactive")}
            </div>
          </div>

          <div class="region-info">
            <div class="info-item">
              <span class="info-label">{$_("regions.type")}:</span>
              <span class="info-value">
                {region.attributes?.payload?.body?.region_type === "collections"
                  ? $_("region.typeCollections")
                  : $_("region.typeSingleCollection")}
              </span>
            </div>

            {#if region.attributes?.payload?.body?.region_type === "collections"}
              <div class="info-item">
                <span class="info-label">{$_("regions.collectionsCount")}:</span
                >
                <span class="info-value"
                  >{region.attributes?.payload?.body?.collections?.length ||
                    0}</span
                >
              </div>
            {:else if region.attributes?.payload?.body?.region_type === "single_collection"}
              <div class="info-item">
                <span class="info-label">{$_("regions.collection")}:</span>
                <span class="info-value">
                  {region.attributes?.payload?.body?.collection_shortname ||
                    "-"}
                </span>
              </div>
            {/if}
          </div>

          <div class="region-actions">
            <button
              class="btn btn-sm btn-secondary"
              onclick={() => openEditModal(region)}
            >
              {$_("common.edit")}
            </button>
            <button
              class="btn btn-sm btn-danger"
              onclick={() => openDeleteConfirm(region)}
            >
              {$_("common.delete")}
            </button>
          </div>
        </div>
      {/each}

      {#if regions.length === 0}
        <div class="empty-state">
          <p>{$_("regions.noRegions")}</p>
          <button class="btn btn-primary" onclick={openCreateModal}>
            {$_("regions.createFirst")}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {isEditing ? $_("regions.editRegion") : $_("regions.createRegion")}
        </h2>
        <button class="modal-close" onclick={closeModal}>×</button>
      </div>
      <div class="modal-body">
        <RegionForm bind:formData bind:validateFn />
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={closeModal}
          disabled={isSaving}
        >
          {$_("common.cancel")}
        </button>
        <button
          class="btn btn-primary"
          onclick={saveRegion}
          disabled={isSaving}
        >
          {isSaving ? $_("common.saving") : $_("common.save")}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteConfirm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeDeleteConfirm}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("regions.deleteConfirm")}</h2>
        <button class="modal-close" onclick={closeDeleteConfirm}>×</button>
      </div>
      <div class="modal-body">
        <p>
          {$_("regions.deleteMessage", {
            values: { name: regionToDelete?.shortname },
          })}
        </p>
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={closeDeleteConfirm}
          disabled={isDeleting}
        >
          {$_("common.cancel")}
        </button>
        <button
          class="btn btn-danger"
          onclick={deleteRegion}
          disabled={isDeleting}
        >
          {isDeleting ? $_("common.deleting") : $_("common.delete")}
        </button>
      </div>
    </div>
  </div>
{/if}

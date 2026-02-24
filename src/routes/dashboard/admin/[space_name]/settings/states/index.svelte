<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "@/i18n";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import "./index.css";

  let isLoading = $state(true);
  let isSaving = $state(false);
  let isDeleting = $state(false);
  let states = $state<any[]>([]);
  let showCreateModal = $state(false);
  let showDeleteConfirm = $state(false);
  let isEditing = $state(false);
  let currentState = $state<any>(null);
  let stateToDelete = $state<any>(null);
  let formData = $state({
    shortname: "",
    displayname_en: "",
    displayname_ar: "",
    is_active: true,
  });

  onMount(async () => {
    await loadStates();
  });

  async function loadStates() {
    isLoading = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        "/settings/states",
        "managed",
        100,
        0,
        true,
      );

      states = response?.records || [];
      successToastMessage(
        $_("states.loaded", { values: { count: states.length } }) ||
          `${states.length} states loaded`,
      );
    } catch (error) {
      console.error("Failed to load states:", error);
      errorToastMessage($_("states.loadFailed") || "Failed to load states");
    } finally {
      isLoading = false;
    }
  }

  function getDisplayName(state: any): string {
    return (
      state?.attributes?.displayname?.en ||
      state?.attributes?.displayname?.ar ||
      state?.shortname ||
      "-"
    );
  }

  function openCreateModal() {
    formData = {
      shortname: "",
      displayname_en: "",
      displayname_ar: "",
      is_active: true,
    };
    currentState = null;
    isEditing = false;
    showCreateModal = true;
  }

  function openEditModal(state: any) {
    currentState = state;
    formData = {
      shortname: state.shortname || "",
      displayname_en: state.attributes?.displayname?.en || "",
      displayname_ar: state.attributes?.displayname?.ar || "",
      is_active: state.attributes?.is_active ?? true,
    };
    isEditing = true;
    showCreateModal = true;
  }

  function openDeleteConfirm(state: any) {
    stateToDelete = state;
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    stateToDelete = null;
    showDeleteConfirm = false;
  }

  function closeCreateModal() {
    showCreateModal = false;
    currentState = null;
    isEditing = false;
  }

  async function saveState() {
    if (!formData.shortname.trim()) {
      errorToastMessage(
        $_("widgets.error.keyRequired") || "Shortname is required",
      );
      return;
    }

    if (!formData.displayname_en.trim() && !formData.displayname_ar.trim()) {
      errorToastMessage(
        $_("validation.requireDisplayname") ||
          "Display name is required in English or Arabic",
      );
      return;
    }

    isSaving = true;
    try {
      const payload = {
        displayname_en: formData.displayname_en,
        displayname_ar: formData.displayname_ar,
        description_en: "",
        description_ar: "",
        is_active: formData.is_active,
        body: {},
      };

      const success = isEditing
        ? await updateEntity(
            currentState?.shortname,
            website.main_space,
            "/settings/states",
            ResourceType.content,
            {
              ...payload,
              content_type: "json",
            },
            "",
            "",
          )
        : await createEntity(
            {
              shortname: formData.shortname,
              ...payload,
            },
            website.main_space,
            "/settings/states",
            ResourceType.content,
            "",
            "",
            "json",
          );

      if (success) {
        successToastMessage(
          isEditing
            ? $_("common.update") || "Updated successfully"
            : $_("common.create") || "Created successfully",
        );
        closeCreateModal();
        await loadStates();
      } else {
        errorToastMessage(
          $_("collections.saveFailed") || "Failed to create state",
        );
      }
    } catch (error) {
      console.error("Failed to create state:", error);
      errorToastMessage(
        $_("collections.saveFailed") || "Failed to create state",
      );
    } finally {
      isSaving = false;
    }
  }

  async function deleteState() {
    if (!stateToDelete) return;

    isDeleting = true;
    try {
      await deleteEntity(
        stateToDelete.shortname,
        website.main_space,
        "/settings/states",
        ResourceType.content,
      );

      successToastMessage($_("common.delete") || "Deleted successfully");
      closeDeleteConfirm();
      await loadStates();
    } catch (error) {
      console.error("Failed to delete state:", error);
      errorToastMessage(
        $_("collections.deleteFailed") || "Failed to delete state",
      );
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="states-page">
  <div class="page-header">
    <h1 class="page-title">{$_("admin.states") || "States"}</h1>
    <div class="header-actions">
      <button class="btn-add" onclick={openCreateModal}>
        {$_("common.create") || "Create"}
      </button>
      <button class="btn-refresh" onclick={loadStates} disabled={isLoading}>
        {$_("common.refresh") || "Refresh"}
      </button>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">{$_("common.loading")}</div>
  {:else if states.length === 0}
    <div class="empty-state">{$_("states.noStates") || "No states found"}</div>
  {:else}
    <div class="table-wrap">
      <table class="states-table">
        <thead>
          <tr>
            <th>{$_("states.shortname") || "Shortname"}</th>
            <th>{$_("states.displayName") || "Display Name"}</th>
            <th>{$_("states.arabicName") || "Arabic Name"}</th>
            <th>{$_("states.status") || "Status"}</th>
            <th>{$_("states.updated") || "Updated"}</th>
            <th>{$_("common.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {#each states as state}
            <tr>
              <td>{state.shortname}</td>
              <td>{getDisplayName(state)}</td>
              <td>{state.attributes?.displayname?.ar || "-"}</td>
              <td>
                <span class="status" class:active={state.attributes?.is_active}>
                  {state.attributes?.is_active
                    ? $_("common.active") || "Active"
                    : $_("common.inactive") || "Inactive"}
                </span>
              </td>
              <td>
                {state.attributes?.updated_at
                  ? new Date(state.attributes.updated_at).toLocaleString()
                  : "-"}
              </td>
              <td>
                <div class="row-actions">
                  <button
                    class="btn-secondary"
                    onclick={() => openEditModal(state)}
                  >
                    {$_("common.edit") || "Edit"}
                  </button>
                  <button
                    class="btn-delete"
                    onclick={() => openDeleteConfirm(state)}
                  >
                    {$_("common.delete") || "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showCreateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeCreateModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {$_("common.create") || "Create"}
          {$_("admin.states") || "State"}
        </h2>
        <button class="modal-close" onclick={closeCreateModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="state_shortname"
            >{$_("states.shortname") || "Shortname"} *</label
          >
          <input
            id="state_shortname"
            type="text"
            class="form-input"
            bind:value={formData.shortname}
            placeholder="e.g. al_anbar"
            pattern="^[a-zA-Z0-9_]&#123;1,64&#125;$"
            readonly={isEditing}
          />
        </div>

        <div class="form-group">
          <label for="state_name_en"
            >{$_("collection.titleEn") || "Title (EN)"}</label
          >
          <input
            id="state_name_en"
            type="text"
            class="form-input"
            bind:value={formData.displayname_en}
          />
        </div>

        <div class="form-group">
          <label for="state_name_ar"
            >{$_("collection.titleAr") || "Title (AR)"}</label
          >
          <input
            id="state_name_ar"
            type="text"
            class="form-input"
            bind:value={formData.displayname_ar}
          />
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" bind:checked={formData.is_active} />
            {$_("common.isActive") || "Active"}
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={closeCreateModal}
          disabled={isSaving}
        >
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-primary" onclick={saveState} disabled={isSaving}>
          {isSaving
            ? $_("common.saving") || "Saving..."
            : isEditing
              ? $_("common.update") || "Update"
              : $_("common.create") || "Create"}
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
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("common.delete") || "Delete"}</h2>
        <button class="modal-close" onclick={closeDeleteConfirm}>×</button>
      </div>
      <div class="modal-body">
        <p>
          {$_("collections.deleteMessage", {
            values: { name: stateToDelete?.shortname },
          }) || `Are you sure you want to delete ${stateToDelete?.shortname}?`}
        </p>
      </div>
      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={closeDeleteConfirm}
          disabled={isDeleting}
        >
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-delete" onclick={deleteState} disabled={isDeleting}>
          {isDeleting
            ? $_("common.deleting") || "Deleting..."
            : $_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

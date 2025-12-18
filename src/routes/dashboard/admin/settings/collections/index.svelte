<script lang="ts">
  import { onMount } from "svelte";
  import { ResourceType } from "@edraj/tsdmart";
  import CollectionForm from "@/components/forms/CollectionForm.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _ } from "@/i18n";
  import {
    getSpaceContents,
    createCollection,
    updateCollection,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {website} from "@/config";

  let collections = $state([]);
  let isLoading = $state(true);
  let showModal = $state(false);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let formData: any = $state({});
  let validateFn = $state(() => true);
  let currentCollection = $state(null);
  let showDeleteConfirm = $state(false);
  let collectionToDelete = $state(null);
  let isDeleting = $state(false);
  let filterType = $state("all");

  onMount(async () => {
    await loadCollections();
  });

  async function loadCollections() {
    isLoading = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        "/settings/collections",
        "managed",
        100,
        0,
        true
      );

      if (response && response.records) {
        collections = response.records;
        successToastMessage(
          $_("collections.loaded", { values: { count: collections.length } })
        );
      }
    } catch (error) {
      console.error("Failed to load collections:", error);
      errorToastMessage($_("collections.loadFailed"));
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    formData = {
      shortname: "",
      title: { en: "", ar: "", ku: "" },
      description: { en: "", ar: "", ku: "" },
      image_url: "",
      background_color: "#ffffff",
      collection_type: "banner",
      banner_url: "",
      products: [],
      product_card_type: "basic",
      is_active: true,
    };
    isEditing = false;
    currentCollection = null;
    showModal = true;
  }

  function openEditModal(collection: any) {
    const payloadBody = collection.attributes?.payload?.body || {};
    formData = {
      shortname: collection.shortname,
      title: collection.attributes?.displayname || { en: "", ar: "", ku: "" },
      description: collection.attributes?.description || {
        en: "",
        ar: "",
        ku: "",
      },
      image_url: payloadBody.image_url || "",
      background_color: payloadBody.background_color || "#ffffff",
      collection_type: payloadBody.type || "banner",
      banner_url: payloadBody.url || "",
      products: payloadBody.products || [],
      product_card_type: payloadBody.product_card_type || "basic",
      is_active: collection.attributes?.is_active ?? true,
    };
    isEditing = true;
    currentCollection = collection;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    formData = {};
    currentCollection = null;
  }

  async function saveCollection() {
    if (!validateFn()) {
      errorToastMessage($_("validation.fixErrors"));
      return;
    }

    isSaving = true;
    try {
      const result = isEditing
        ? await updateCollection(website.main_space, formData)
        : await createCollection(website.main_space, formData);

      if (result) {
        successToastMessage(
          isEditing ? $_("collections.updated") : $_("collections.created")
        );
        closeModal();
        await loadCollections();
      } else {
        errorToastMessage($_("collections.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save collection:", error);
      errorToastMessage($_("collections.saveFailed"));
    } finally {
      isSaving = false;
    }
  }

  function openDeleteConfirm(collection: any) {
    collectionToDelete = collection;
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    collectionToDelete = null;
  }

  async function deleteCollection() {
    if (!collectionToDelete) return;

    isDeleting = true;
    try {
      await deleteEntity(
        collectionToDelete.shortname,
        website.main_space,
        "/settings/collections",
        ResourceType.content
      );

      successToastMessage($_("collections.deleted"));
      closeDeleteConfirm();
      await loadCollections();
    } catch (error) {
      console.error("Failed to delete collection:", error);
      errorToastMessage($_("collections.deleteFailed"));
    } finally {
      isDeleting = false;
    }
  }

  let filteredCollections = $derived(
    collections.filter((col) => {
      if (filterType === "all") return true;
      return col.attributes?.payload?.body?.type === filterType;
    })
  );
</script>

<div class="collections-page">
  <div class="page-header">
    <h1 class="page-title">{$_("collections.title")}</h1>
    <button class="btn btn-primary" onclick={openCreateModal}>
      {$_("collections.createNew")}
    </button>
  </div>

  <div class="filter-bar">
    <button
      class="filter-btn"
      class:active={filterType === "all"}
      onclick={() => (filterType = "all")}
    >
      {$_("collections.all")}
    </button>
    <button
      class="filter-btn"
      class:active={filterType === "banner"}
      onclick={() => (filterType = "banner")}
    >
      {$_("collections.banners")}
    </button>
    <button
      class="filter-btn"
      class:active={filterType === "product_cards"}
      onclick={() => (filterType = "product_cards")}
    >
      {$_("collections.productCards")}
    </button>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{$_("common.loading")}</p>
    </div>
  {:else}
    <div class="collections-grid">
      {#each filteredCollections as collection}
        <div class="collection-card">
          <div class="collection-header">
            <h3 class="collection-name">
              {collection.attributes?.displayname?.en || collection.shortname}
            </h3>
            <div
              class="collection-badge"
              class:active={collection.attributes?.is_active}
            >
              {collection.attributes?.is_active
                ? $_("common.active")
                : $_("common.inactive")}
            </div>
          </div>

          <div class="collection-meta">
            <span class="meta-shortname">{collection.shortname}</span>
            <span
              class="meta-type"
              class:banner={collection.attributes?.payload?.body?.type ===
                "banner"}
              class:product={collection.attributes?.payload?.body?.type ===
                "product_cards"}
            >
              {collection.attributes?.payload?.body?.type === "banner"
                ? $_("collection.typeBanner")
                : $_("collection.typeProductCards")}
            </span>
          </div>

          {#if collection.attributes?.description?.en}
            <p class="collection-description">
              {collection.attributes.description.en}
            </p>
          {/if}

          <div class="collection-info">
            {#if collection.attributes?.payload?.body?.type === "product_cards"}
              <div class="info-item">
                <span class="info-label"
                  >{$_("collections.productsCount")}:</span
                >
                <span class="info-value"
                  >{collection.attributes?.payload?.body?.products?.length ||
                    0}</span
                >
              </div>
              <div class="info-item">
                <span class="info-label">{$_("collections.cardType")}:</span>
                <span class="info-value">
                  {collection.attributes?.payload?.body?.product_card_type ||
                    "basic"}
                </span>
              </div>
            {:else if collection.attributes?.payload?.body?.type === "banner"}
              <div class="info-item">
                <span class="info-label">{$_("collections.bannerUrl")}:</span>
                <span class="info-value truncate">
                  {collection.attributes?.payload?.body?.url || "-"}
                </span>
              </div>
            {/if}
          </div>

          <div class="collection-actions">
            <button
              class="btn btn-sm btn-secondary"
              onclick={() => openEditModal(collection)}
            >
              {$_("common.edit")}
            </button>
            <button
              class="btn btn-sm btn-danger"
              onclick={() => openDeleteConfirm(collection)}
            >
              {$_("common.delete")}
            </button>
          </div>
        </div>
      {/each}

      {#if filteredCollections.length === 0}
        <div class="empty-state">
          <p>{$_("collections.noCollections")}</p>
          <button class="btn btn-primary" onclick={openCreateModal}>
            {$_("collections.createFirst")}
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
          {isEditing
            ? $_("collections.editCollection")
            : $_("collections.createCollection")}
        </h2>
        <button class="modal-close" onclick={closeModal}>×</button>
      </div>
      <div class="modal-body">
        <CollectionForm bind:formData bind:validateFn />
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
          onclick={saveCollection}
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
        <h2>{$_("collections.deleteConfirm")}</h2>
        <button class="modal-close" onclick={closeDeleteConfirm}>×</button>
      </div>
      <div class="modal-body">
        <p>
          {$_("collections.deleteMessage", {
            values: { name: collectionToDelete?.shortname },
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
          onclick={deleteCollection}
          disabled={isDeleting}
        >
          {isDeleting ? $_("common.deleting") : $_("common.delete")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style src="./collections.css"></style>

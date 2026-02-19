<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "@/i18n";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
    getEntity,
    attachAttachmentsToEntity,
  } from "@/lib/dmart_services";
  import { Dmart, ResourceType } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { website } from "@/config";
  import "./index.css";

  function t(key: string, fallback: string = ""): string {
    return $_(key) || fallback;
  }

  let tiles: any[] = [];
  let filteredTiles: any[] = [];
  let loading = false;
  let selectedRegion = "all";
  let selectedShape = "all";
  let searchQuery = "";

  let createModalOpen = false;
  let editModalOpen = false;
  let deleteModalOpen = false;
  let viewModalOpen = false;
  let selectedTile: any = null;

  let tileForm = {
    displayname_en: "",
    displayname_ar: "",
    description_en: "",
    description_ar: "",
    shape: "banner",
    region: "hero_region",
    url: "",
    backgroundColor: "#ffffff",
    font_color: "#000000",
    card_type: "withMessage",
    collection_shortname: "",
    is_active: true,
  };

  let imageFile: File | null = null;
  let imagePreviewUrl: string | null = null;

  const regions = [
    { value: "hero_region", label: "Hero Region" },
    { value: "mid_region", label: "Mid Region" },
    { value: "bottom_region", label: "Bottom Region" },
  ];

  const shapes = [
    { value: "banner", label: "Banner" },
    { value: "carousel", label: "Carousel" },
  ];

  const cardTypes = [
    { value: "withMessage", label: "With Message" },
    { value: "full", label: "Full" },
  ];

  onMount(async () => {
    await loadTiles();
  });

  async function loadTiles() {
    loading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "settings/tiles",
        "managed",
        100,
        0,
        false,
      );
      tiles = response.records || [];
      applyFilters();
    } catch (error) {
      console.error("Error loading tiles:", error);
      errorToastMessage(
        t("admin.tiles_failed_to_load", "Failed to load tiles"),
      );
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    let filtered = [...tiles];

    if (selectedRegion !== "all") {
      filtered = filtered.filter(
        (tile) => tile.attributes.payload?.body?.region === selectedRegion,
      );
    }

    if (selectedShape !== "all") {
      filtered = filtered.filter(
        (tile) => tile.attributes.payload?.body?.shape === selectedShape,
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tile) =>
          tile.attributes.displayname?.en?.toLowerCase().includes(query) ||
          tile.attributes.displayname?.ar?.toLowerCase().includes(query) ||
          tile.attributes.description?.en?.toLowerCase().includes(query),
      );
    }

    filteredTiles = filtered;
  }

  $: {
    tiles;
    selectedRegion;
    selectedShape;
    searchQuery;
    applyFilters();
  }

  function openCreateModal() {
    resetForm();
    createModalOpen = true;
  }

  function openEditModal(tile: any) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      imagePreviewUrl = null;
    }
    imageFile = null;
    selectedTile = tile;
    const body = tile.attributes.payload?.body || {};
    tileForm = {
      displayname_en: tile.attributes.displayname?.en || "",
      displayname_ar: tile.attributes.displayname?.ar || "",
      description_en: tile.attributes.description?.en || "",
      description_ar: tile.attributes.description?.ar || "",
      shape: body.shape || "banner",
      region: body.region || "hero_region",
      url: body.url || "",
      backgroundColor: body.style?.backgroundColor || "#ffffff",
      font_color: body.font_color || "#000000",
      card_type: body.card_type || "withMessage",
      collection_shortname: body.collection_shortname || "",
      is_active: tile.attributes.is_active !== false,
    };
    editModalOpen = true;
  }

  async function openViewModal(tile: any) {
    loading = true;
    try {
      const fullTile = await getEntity(
        tile.shortname,
        website.main_space,
        "settings/tiles",
        ResourceType.content,
        "managed",
        true,
        true,
      );
      selectedTile = fullTile;
      viewModalOpen = true;
    } catch (error) {
      console.error("Error loading tile details:", error);
      errorToastMessage(
        t("admin.tiles_failed_to_load_details", "Failed to load tile details"),
      );
    } finally {
      loading = false;
    }
  }

  function openDeleteModal(tile: any) {
    selectedTile = tile;
    deleteModalOpen = true;
  }

  function resetForm() {
    tileForm = {
      displayname_en: "",
      displayname_ar: "",
      description_en: "",
      description_ar: "",
      shape: "banner",
      region: "hero_region",
      url: "",
      backgroundColor: "#ffffff",
      font_color: "#000000",
      card_type: "withMessage",
      collection_shortname: "",
      is_active: true,
    };
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      imagePreviewUrl = null;
    }
    imageFile = null;
    selectedTile = null;
  }

  async function handleCreate() {
    if (!tileForm.displayname_en.trim()) {
      errorToastMessage(
        t("admin.tiles_display_name_required", "Display name (EN) is required"),
      );
      return;
    }

    if (tileForm.shape === "banner" && !tileForm.url.trim()) {
      errorToastMessage(
        t("admin.tiles_url_required", "URL is required for banners"),
      );
      return;
    }

    if (
      tileForm.shape === "carousel" &&
      !tileForm.collection_shortname.trim()
    ) {
      errorToastMessage(
        t(
          "admin.tiles_collection_required",
          "Collection shortname is required for carousels",
        ),
      );
      return;
    }

    loading = true;
    try {
      const body: any = {
        shape: tileForm.shape,
        region: tileForm.region,
        collection_shortname: tileForm.collection_shortname,
        font_color: tileForm.font_color,
        style: {
          backgroundColor: tileForm.backgroundColor,
        },
      };

      if (tileForm.shape === "banner") {
        body.url = tileForm.url;
        body.collection_shortname = null;
      } else {
        body.card_type = tileForm.card_type;
        body.collection_shortname = tileForm.collection_shortname;
      }

      const shortname = await createEntity(
        {
          displayname_en: tileForm.displayname_en,
          displayname_ar: tileForm.displayname_ar,
          description_en: tileForm.description_en,
          description_ar: tileForm.description_ar,
          body: body,
          is_active: tileForm.is_active,
        },
        website.main_space,
        "settings/tiles",
        ResourceType.content,
        "",
        "",
        "json",
      );

      if (shortname && imageFile) {
        await attachAttachmentsToEntity(
          shortname,
          website.main_space,
          "settings/tiles",
          imageFile,
        );
      }

      if (shortname) {
        successToastMessage(
          t("admin.tiles_created_success", "Tile created successfully"),
        );
        createModalOpen = false;
        resetForm();
        await loadTiles();
      } else {
        errorToastMessage(
          t("admin.tiles_create_failed", "Failed to create tile"),
        );
      }
    } catch (error) {
      console.error("Error creating tile:", error);
      errorToastMessage(
        t("admin.tiles_create_failed", "Failed to create tile"),
      );
    } finally {
      loading = false;
    }
  }

  async function handleUpdate() {
    if (!selectedTile) return;

    if (!tileForm.displayname_en.trim()) {
      errorToastMessage(
        t("admin.tiles_display_name_required", "Display name (EN) is required"),
      );
      return;
    }

    loading = true;
    try {
      const body: any = {
        shape: tileForm.shape,
        region: tileForm.region,
        font_color: tileForm.font_color,
        style: {
          backgroundColor: tileForm.backgroundColor,
        },
      };

      if (tileForm.shape === "banner") {
        body.url = tileForm.url;
        body.collection_shortname = null;
      } else {
        body.card_type = tileForm.card_type;
        body.collection_shortname = tileForm.collection_shortname;
      }

      const success = await updateEntity(
        selectedTile.shortname,
        website.main_space,
        "settings/tiles",
        ResourceType.content,
        {
          displayname_en: tileForm.displayname_en,
          displayname_ar: tileForm.displayname_ar,
          description_en: tileForm.description_en,
          description_ar: tileForm.description_ar,
          body: body,
          is_active: tileForm.is_active,
          content_type: "json",
        },
        "",
        "",
      );

      if (success && imageFile) {
        await attachAttachmentsToEntity(
          selectedTile.shortname,
          website.main_space,
          "settings/tiles",
          imageFile,
        );
      }

      if (success) {
        successToastMessage(
          t("admin.tiles_updated_success", "Tile updated successfully"),
        );
        editModalOpen = false;
        resetForm();
        await loadTiles();
      } else {
        errorToastMessage(
          t("admin.tiles_update_failed", "Failed to update tile"),
        );
      }
    } catch (error) {
      console.error("Error updating tile:", error);
      errorToastMessage(
        t("admin.tiles_update_failed", "Failed to update tile"),
      );
    } finally {
      loading = false;
    }
  }

  async function handleDelete() {
    if (!selectedTile) return;

    loading = true;
    try {
      const success = await deleteEntity(
        selectedTile.shortname,
        website.main_space,
        "settings/tiles",
        ResourceType.content,
      );

      if (success) {
        successToastMessage(
          t("admin.tiles_deleted_success", "Tile deleted successfully"),
        );
        deleteModalOpen = false;
        resetForm();
        await loadTiles();
      } else {
        errorToastMessage(
          t("admin.tiles_delete_failed", "Failed to delete tile"),
        );
      }
    } catch (error) {
      console.error("Error deleting tile:", error);
      errorToastMessage(
        t("admin.tiles_delete_failed", "Failed to delete tile"),
      );
    } finally {
      loading = false;
    }
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      imagePreviewUrl = null;
    }

    if (target.files && target.files[0]) {
      imageFile = target.files[0];
      imagePreviewUrl = URL.createObjectURL(target.files[0]);
    } else {
      imageFile = null;
    }
  }

  function getEditModalImageUrl(): string | null {
    if (imagePreviewUrl) return imagePreviewUrl;
    if (!selectedTile) return null;
    return getImageUrl(selectedTile);
  }

  function getImageUrl(tile: any): string | null {
    const media = tile.attachments?.media?.[0];
    if (!media) return null;
    console.log(tile.attachments?.media[0].subpath);

    return Dmart.getAttachmentUrl(
      {
        resource_type: ResourceType.media,
        space_name: website.main_space,
        subpath: tile.attachments?.media[0].subpath || tile.subpath + "/" || "",
        parent_shortname: tile.shortname,
        shortname: media.attributes?.payload?.body || media.shortname,
        ext: null,
      },
      "public",
    );
  }
</script>

<div class="tiles-container">
  <div class="header">
    <div>
      <h1>{t("admin.tiles_management", "Tiles Management")}</h1>
      <p>{t("admin.tiles_description", "Manage homepage tiles and banners")}</p>
    </div>
    <button class="btn-primary" on:click={openCreateModal}>
      + {t("admin.create_new_tile", "Create New Tile")}
    </button>
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-group">
      <label for="region-filter">{t("admin.tiles_region", "Region")}:</label>
      <select id="region-filter" bind:value={selectedRegion}>
        <option value="all"
          >{t("admin.tiles_all_regions", "All Regions")}</option
        >
        {#each regions as region}
          <option value={region.value}>{region.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="shape-filter">{t("admin.tiles_shape", "Shape")}:</label>
      <select id="shape-filter" bind:value={selectedShape}>
        <option value="all">{t("admin.tiles_all_shapes", "All Shapes")}</option>
        {#each shapes as shape}
          <option value={shape.value}>{shape.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="search">{t("common.search", "Search")}:</label>
      <input
        id="search"
        type="text"
        bind:value={searchQuery}
        placeholder={t("admin.tiles_search_placeholder", "Search tiles...")}
      />
    </div>
  </div>

  <!-- Tiles Grid -->
  {#if loading}
    <div class="loading">
      {t("common.loading", "Loading")}
      {t("admin.tiles", "tiles")}...
    </div>
  {:else if filteredTiles.length === 0}
    <div class="empty-state">
      <p>{t("admin.tiles_not_found", "No tiles found")}</p>
    </div>
  {:else}
    <div class="tiles-grid">
      {#each filteredTiles as tile}
        {@const body = tile.attributes.payload?.body || {}}
        {@const imageUrl = getImageUrl(tile)}
        <div class="tile-card">
          {#if imageUrl}
            <div class="tile-image">
              <img src={imageUrl} alt={tile.attributes.displayname?.en || ""} />
            </div>
          {:else}
            <div
              class="tile-placeholder"
              style="background-color: {body.style?.backgroundColor ||
                '#f0f0f0'}"
            >
              {#if body.shape === "carousel"}
                <span class="icon">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="6" y="8" width="20" height="16" rx="2" />
                    <path d="M2 12v8M30 12v8" />
                  </svg>
                </span>
              {:else}
                <span class="icon">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="4" y="8" width="24" height="16" rx="2" />
                    <path d="M8 12l4 6 3-3 5 5" />
                    <circle cx="20" cy="13" r="1.5" fill="currentColor" />
                  </svg>
                </span>
              {/if}
            </div>
          {/if}

          <div class="tile-content">
            <div class="tile-header">
              <h3>
                {tile.attributes.displayname?.en ||
                  t("common.untitled", "Untitled")}
              </h3>
              <span class="badge badge-{body.shape}">
                {body.shape}
              </span>
            </div>

            {#if tile.attributes.description?.en}
              <p class="tile-description">{tile.attributes.description.en}</p>
            {/if}

            <div class="tile-meta">
              <span class="region-badge">{body.region?.replace(/_/g, " ")}</span
              >
              <span
                class="status-badge"
                class:active={tile.attributes.is_active}
              >
                {tile.attributes.is_active
                  ? t("admin.tiles_status_active", "Active")
                  : t("admin.tiles_status_inactive", "Inactive")}
              </span>
            </div>

            {#if body.shape === "carousel"}
              <div class="tile-info">
                <small
                  >{t("admin.tiles_collection", "Collection")}: {body.collection_shortname}</small
                >
                <small>{t("common.type", "Type")}: {body.card_type}</small>
              </div>
            {:else if body.url}
              <div class="tile-info">
                <small>{t("common.url", "URL")}: {body.url}</small>
              </div>
            {/if}

            <div class="tile-actions">
              <button
                class="btn-icon"
                on:click={() => openViewModal(tile)}
                title={t("admin.tiles_view", "View")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z" />
                  <circle cx="8" cy="8" r="2" />
                </svg>
              </button>
              <button
                class="btn-icon"
                on:click={() => openEditModal(tile)}
                title={t("admin.tiles_edit", "Edit")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M11.5 2.5l2 2L6 12H4v-2l7.5-7.5z" />
                  <path d="M10 4l2 2" />
                </svg>
              </button>
              <button
                class="btn-icon delete"
                on:click={() => openDeleteModal(tile)}
                title={t("admin.tiles_delete", "Delete")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M3 4h10M5 4V3h6v1M6 7v4M10 7v4M5 4l.5 9h5l.5-9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if createModalOpen || editModalOpen}
  <div
    class="modal-overlay"
    on:click={() => {
      createModalOpen = false;
      editModalOpen = false;
    }}
  >
    <div class="modal modal-large" on:click|stopPropagation>
      <div class="modal-header">
        <h2>
          {createModalOpen
            ? t("admin.tiles_create_modal_title", "Create New Tile")
            : t("admin.tiles_edit_modal_title", "Edit Tile")}
        </h2>
        <button
          class="close-btn"
          on:click={() => {
            createModalOpen = false;
            editModalOpen = false;
          }}
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label for="displayname_en"
              >{t("admin.tiles_display_name_en", "Display Name (EN)")} *</label
            >
            <input
              id="displayname_en"
              type="text"
              bind:value={tileForm.displayname_en}
              placeholder="Happy New Year"
              required
            />
          </div>

          <div class="form-group">
            <label for="displayname_ar"
              >{t("admin.tiles_display_name_ar", "Display Name (AR)")}</label
            >
            <input
              id="displayname_ar"
              type="text"
              bind:value={tileForm.displayname_ar}
              placeholder="سنة جديدة سعيدة"
            />
          </div>

          <div class="form-group full-width">
            <label for="description_en"
              >{t("admin.tiles_description_en", "Description (EN)")}</label
            >
            <textarea
              id="description_en"
              bind:value={tileForm.description_en}
              placeholder="Check out our offers for new year"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group full-width">
            <label for="description_ar"
              >{t("admin.tiles_description_ar", "Description (AR)")}</label
            >
            <textarea
              id="description_ar"
              bind:value={tileForm.description_ar}
              placeholder="تحقق من عروضنا للسنة الجديدة"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="font_color"
              >{t("admin.tiles_font_color", "Font Color")}</label
            >
            <input
              id="font_color"
              type="color"
              bind:value={tileForm.font_color}
            />
          </div>

          <div class="form-group">
            <label for="shape">{t("admin.tiles_shape", "Shape")} *</label>
            <select id="shape" bind:value={tileForm.shape}>
              {#each shapes as shape}
                <option value={shape.value}>{shape.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="region">{t("admin.tiles_region", "Region")} *</label>
            <select id="region" bind:value={tileForm.region}>
              {#each regions as region}
                <option value={region.value}>{region.label}</option>
              {/each}
            </select>
          </div>

          {#if tileForm.shape === "banner"}
            {@const editImageUrl = getEditModalImageUrl()}
            <div class="form-group">
              <label for="url">{t("common.url", "URL")} *</label>
              <input
                id="url"
                type="text"
                bind:value={tileForm.url}
                placeholder="/pages/newyear"
                required
              />
            </div>

            <div class="form-group">
              {#if editImageUrl}
                <div class="edit-image-preview">
                  <img
                    src={editImageUrl}
                    alt={tileForm.displayname_en || "Tile image"}
                  />
                </div>
              {/if}
              <label for="image">{t("admin.tiles_image", "Image")}</label>
              <input
                id="image"
                type="file"
                accept="image/*"
                on:change={handleFileChange}
              />
            </div>
          {:else}
            <div class="form-group">
              <label for="collection_shortname"
                >{t("admin.tiles_collection_shortname", "Collection Shortname")}
                *</label
              >
              <input
                id="collection_shortname"
                type="text"
                bind:value={tileForm.collection_shortname}
                placeholder="19901458"
                required
              />
            </div>

            <div class="form-group">
              <label for="card_type"
                >{t("admin.tiles_card_type", "Card Type")}</label
              >
              <select id="card_type" bind:value={tileForm.card_type}>
                {#each cardTypes as type}
                  <option value={type.value}>{type.label}</option>
                {/each}
              </select>
            </div>
          {/if}

          <div class="form-group">
            <label for="backgroundColor"
              >{t("admin.tiles_background_color", "Background Color")}</label
            >
            <input
              id="backgroundColor"
              type="color"
              bind:value={tileForm.backgroundColor}
            />
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={tileForm.is_active} />
              {t("admin.tiles_active", "Active")}
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          on:click={() => {
            createModalOpen = false;
            editModalOpen = false;
          }}
        >
          {t("common.cancel", "Cancel")}
        </button>
        <button
          class="btn-primary"
          on:click={createModalOpen ? handleCreate : handleUpdate}
          disabled={loading}
        >
          {loading
            ? t("common.saving", "Saving...")
            : createModalOpen
              ? t("admin.tiles_create", "Create")
              : t("common.update", "Update")}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- View Modal -->
{#if viewModalOpen && selectedTile}
  <div class="modal-overlay" on:click={() => (viewModalOpen = false)}>
    <div class="modal modal-large" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{t("admin.tiles_view_modal_title", "Tile Details")}</h2>
        <button class="close-btn" on:click={() => (viewModalOpen = false)}
          >×</button
        >
      </div>

      <div class="modal-body">
        {#if selectedTile}
          {@const body = selectedTile.payload?.body || {}}
          {@const imageUrl = getImageUrl(selectedTile)}

          {#if imageUrl}
            <div class="view-image">
              <img src={imageUrl} alt={selectedTile.displayname?.en || ""} />
            </div>
          {/if}

          <div class="view-details">
            <div class="detail-row">
              <strong
                >{t("admin.tiles_display_name_en", "Display Name (EN")}:</strong
              >
              <span
                >{selectedTile.displayname?.en || t("common.n_a", "N/A")}</span
              >
            </div>
            <div class="detail-row">
              <strong
                >{t("admin.tiles_display_name_ar", "Display Name (AR")}:</strong
              >
              <span
                >{selectedTile.displayname?.ar || t("common.n_a", "N/A")}</span
              >
            </div>
            <div class="detail-row">
              <strong
                >{t("admin.tiles_description_en", "Description (EN")}:</strong
              >
              <span
                >{selectedTile.description?.en || t("common.n_a", "N/A")}</span
              >
            </div>
            <div class="detail-row">
              <strong>{t("admin.tiles_shape", "Shape")}:</strong>
              <span class="badge badge-{body.shape}">{body.shape}</span>
            </div>
            <div class="detail-row">
              <strong>{t("admin.tiles_region", "Region")}:</strong>
              <span>{body.region?.replace(/_/g, " ")}</span>
            </div>
            {#if body.url}
              <div class="detail-row">
                <strong>{t("common.url", "URL")}:</strong>
                <span>{body.url}</span>
              </div>
            {/if}
            {#if body.collection_shortname}
              <div class="detail-row">
                <strong>{t("admin.tiles_collection", "Collection")}:</strong>
                <span>{body.collection_shortname}</span>
              </div>
              <div class="detail-row">
                <strong>{t("admin.tiles_card_type", "Card Type")}:</strong>
                <span>{body.card_type}</span>
              </div>
            {/if}
            <div class="detail-row">
              <strong
                >{t(
                  "admin.tiles_background_color",
                  "Background Color",
                )}:</strong
              >
              <span>
                <span
                  class="color-preview"
                  style="background-color: {body.style?.backgroundColor}"
                ></span>
                {body.style?.backgroundColor || t("common.n_a", "N/A")}
              </span>
            </div>
            <div class="detail-row">
              <strong>{t("admin.tiles_font_color", "Font Color")}:</strong>
              <span>
                <span
                  class="color-preview"
                  style="background-color: {body.font_color}"
                ></span>
                {body.font_color || t("common.n_a", "N/A")}
              </span>
            </div>
            <div class="detail-row">
              <strong>{t("admin.tiles_status", "Status")}:</strong>
              <span class="status-badge" class:active={selectedTile.is_active}>
                {selectedTile.is_active
                  ? t("admin.tiles_status_active", "Active")
                  : t("admin.tiles_status_inactive", "Inactive")}
              </span>
            </div>
            <div class="detail-row">
              <strong>{t("admin.tiles_created", "Created")}:</strong>
              <span>{new Date(selectedTile.created_at).toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <strong>{t("admin.tiles_updated", "Updated")}:</strong>
              <span>{new Date(selectedTile.updated_at).toLocaleString()}</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => (viewModalOpen = false)}
          >{t("common.close", "Close")}</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if deleteModalOpen && selectedTile}
  <div class="modal-overlay" on:click={() => (deleteModalOpen = false)}>
    <div class="modal modal-small" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{t("admin.tiles_delete_modal_title", "Delete Tile")}</h2>
        <button class="close-btn" on:click={() => (deleteModalOpen = false)}
          >×</button
        >
      </div>

      <div class="modal-body">
        <p>
          {t(
            "admin.tiles_delete_confirm",
            "Are you sure you want to delete the tile",
          )}
          <strong
            >{selectedTile.attributes?.displayname?.en ||
              selectedTile.displayname?.en}</strong
          >?
        </p>
        <p class="warning">
          {t("admin.tiles_delete_warning", "This action cannot be undone.")}
        </p>
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          on:click={() => (deleteModalOpen = false)}
        >
          {t("common.cancel", "Cancel")}
        </button>
        <button class="btn-danger" on:click={handleDelete} disabled={loading}>
          {loading
            ? t("common.deleting", "Deleting...")
            : t("admin.tiles_delete", "Delete")}
        </button>
      </div>
    </div>
  </div>
{/if}

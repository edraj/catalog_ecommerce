<script lang="ts">
  import { onMount } from "svelte";
  import { _ } from "../../../../../i18n";
  import {
    getWidgets,
    updateWidget,
    uploadWidgetMedia,
  } from "@/lib/dmart_services";
  import { website } from "@/config";
  import {
    successToastMessage,
    errorToastMessage,
  } from "@/lib/toasts_messages";
  import { Dmart, ResourceType } from "@edraj/tsdmart";
  import "./index.css";

  let loading = $state(true);
  let widgets = $state<any[]>([]);
  let bannersWidget = $state<any>(null);
  let brandsWidget = $state<any>(null);
  let categoriesWidget = $state<any>(null);

  let activeWidget = $state<string | null>(null);
  let editingItems = $state<any[]>([]);
  let showModal = $state(false);

  let newItemKey = $state("");
  let newItemUrl = $state("");
  let newItemTextEn = $state("");
  let newItemTextAr = $state("");
  let newItemImage = $state<File | null>(null);

  onMount(async () => {
    await loadWidgets();
  });

  async function loadWidgets() {
    loading = true;
    try {
      const response = await getWidgets(website.main_space);
      widgets = response.records || [];

      bannersWidget = widgets.find((w) => w.shortname === "banners");
      brandsWidget = widgets.find((w) => w.shortname === "brands");
      categoriesWidget = widgets.find((w) => w.shortname === "categories");
    } catch (error) {
      console.error("Error loading widgets:", error);
      errorToastMessage($_("widgets.error.loadFailed"));
    } finally {
      loading = false;
    }
  }

  function openEditModal(widgetType: string) {
    activeWidget = widgetType;
    const widget = widgets.find((w) => w.shortname === widgetType);
    editingItems = widget?.attributes?.payload?.body?.items
      ? [...widget.attributes.payload.body.items]
      : [];
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    activeWidget = null;
    editingItems = [];
    resetForm();
  }

  function resetForm() {
    newItemKey = "";
    newItemUrl = "";
    newItemTextEn = "";
    newItemTextAr = "";
    newItemImage = null;
  }

  async function addItem() {
    if (!activeWidget) return;

    if (activeWidget === "banners") {
      if (!newItemKey || !newItemUrl || !newItemTextEn || !newItemImage) {
        errorToastMessage($_("widgets.error.requiredFields"));
        return;
      }

      try {
        const uploadSuccess = await uploadWidgetMedia(
          website.main_space,
          "banners",
          newItemKey,
          newItemImage
        );
        if (!uploadSuccess) {
          errorToastMessage($_("widgets.error.uploadFailed"));
          return;
        }

        editingItems = [
          ...editingItems,
          {
            key: newItemKey,
            url: newItemUrl,
            text: {
              en: newItemTextEn,
              ar: newItemTextAr || newItemTextEn,
            },
          },
        ];
      } catch (error) {
        errorToastMessage($_("widgets.error.uploadFailed"));
        return;
      }
    } else if (activeWidget === "brands") {
      if (!newItemKey) {
        errorToastMessage($_("widgets.error.keyRequired"));
        return;
      }
      editingItems = [...editingItems, { key: newItemKey }];
    } else if (activeWidget === "categories") {
      if (!newItemKey) {
        errorToastMessage($_("widgets.error.keyRequired"));
        return;
      }

      if (newItemImage) {
        try {
          const uploadSuccess = await uploadWidgetMedia(
            website.main_space,
            "categories",
            newItemKey,
            newItemImage
          );
          if (!uploadSuccess) {
            errorToastMessage($_("widgets.error.uploadFailed"));
            return;
          }
        } catch (error) {
          console.error("Upload error:", error);
          errorToastMessage($_("widgets.error.uploadFailed"));
          return;
        }
      }

      editingItems = [...editingItems, { key: newItemKey }];
    }

    resetForm();
  }

  function removeItem(index: number) {
    editingItems = editingItems.filter((_, i) => i !== index);
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...editingItems];
    if (direction === "up" && index > 0) {
      [newItems[index], newItems[index - 1]] = [
        newItems[index - 1],
        newItems[index],
      ];
      editingItems = newItems;
    } else if (direction === "down" && index < editingItems.length - 1) {
      [newItems[index], newItems[index + 1]] = [
        newItems[index + 1],
        newItems[index],
      ];
      editingItems = newItems;
    }
  }

  async function saveWidget() {
    if (!activeWidget) return;

    try {
      const success = await updateWidget(
        website.main_space,
        activeWidget,
        editingItems
      );
      if (success) {
        successToastMessage($_("widgets.success.saved"));
        await loadWidgets();
        closeModal();
      } else {
        errorToastMessage($_("widgets.error.saveFailed"));
      }
    } catch (error) {
      console.error("Error saving widget:", error);
      errorToastMessage($_("widgets.error.saveFailed"));
    }
  }

  function getImageUrl(widgetType: string, key: string): string {
    return Dmart.getAttachmentUrl({
      resource_type: ResourceType.media,
      space_name: website.main_space,
      subpath: "/settings/widgets",
      parent_shortname: widgetType,
      shortname: key,
      ext: null,
    });
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      newItemImage = target.files[0];
    }
  }
</script>

<div class="widgets-container">
  <div class="header">
    <h1>{$_("widgets.title")}</h1>
    <p class="subtitle">{$_("widgets.subtitle")}</p>
  </div>

  {#if loading}
    <div class="loading">{$_("common.loading")}</div>
  {:else}
    <div class="widgets-table">
      <table>
        <thead>
          <tr>
            <th>{$_("widgets.widgetName")}</th>
            <th>{$_("widgets.description")}</th>
            <th>{$_("widgets.itemCount")}</th>
            <th>{$_("widgets.actions")}</th>
          </tr>
        </thead>
        <tbody>
          <!-- Banners Widget -->
          <tr>
            <td>
              <div class="widget-name">{$_("widgets.banners.title")}</div>
            </td>
            <td>
              <div class="widget-description">
                {$_("widgets.banners.description")}
              </div>
            </td>
            <td>
              <span class="widget-count">
                {bannersWidget?.attributes?.payload?.body?.items?.length || 0}
              </span>
            </td>
            <td>
              <button
                class="btn-primary"
                onclick={() => openEditModal("banners")}
              >
                {$_("widgets.edit")}
              </button>
            </td>
          </tr>

          <!-- Brands Widget -->
          <tr>
            <td>
              <div class="widget-name">{$_("widgets.brands.title")}</div>
            </td>
            <td>
              <div class="widget-description">
                {$_("widgets.brands.description")}
              </div>
            </td>
            <td>
              <span class="widget-count">
                {brandsWidget?.attributes?.payload?.body?.items?.length || 0}
              </span>
            </td>
            <td>
              <button
                class="btn-primary"
                onclick={() => openEditModal("brands")}
              >
                {$_("widgets.edit")}
              </button>
            </td>
          </tr>

          <!-- Categories Widget -->
          <tr>
            <td>
              <div class="widget-name">{$_("widgets.categories.title")}</div>
            </td>
            <td>
              <div class="widget-description">
                {$_("widgets.categories.description")}
              </div>
            </td>
            <td>
              <span class="widget-count">
                {categoriesWidget?.attributes?.payload?.body?.items?.length ||
                  0}
              </span>
            </td>
            <td>
              <button
                class="btn-primary"
                onclick={() => openEditModal("categories")}
              >
                {$_("widgets.edit")}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {$_("widgets.edit")}
          {$_(`widgets.${activeWidget}.title`)}
        </h2>
        <button class="close-btn" onclick={closeModal}>×</button>
      </div>

      <div class="modal-body">
        <!-- Add New Item Form -->
        <div class="add-item-form">
          <h3>{$_("widgets.addItem")}</h3>

          {#if activeWidget === "banners"}
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.banners.key")}</label>
              <input
                type="text"
                bind:value={newItemKey}
                placeholder={$_("widgets.banners.keyPlaceholder")}
              />
            </div>
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.banners.url")}</label>
              <input
                type="text"
                bind:value={newItemUrl}
                placeholder="/brands/example"
              />
            </div>
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.banners.textEn")}</label>
              <input
                type="text"
                bind:value={newItemTextEn}
                placeholder={$_("widgets.banners.textPlaceholder")}
              />
            </div>
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.banners.textAr")}</label>
              <input
                type="text"
                bind:value={newItemTextAr}
                placeholder={$_("widgets.banners.textPlaceholder")}
              />
            </div>
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.banners.image")}</label>
              <input type="file" accept="image/*" onchange={handleFileChange} />
            </div>
          {:else if activeWidget === "brands"}
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.brands.key")}</label>
              <input
                type="text"
                bind:value={newItemKey}
                placeholder={$_("widgets.brands.keyPlaceholder")}
              />
            </div>
          {:else if activeWidget === "categories"}
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$_("widgets.categories.key")}</label>
              <input
                type="text"
                bind:value={newItemKey}
                placeholder={$_("widgets.categories.keyPlaceholder")}
              />
            </div>
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label
                >{$_("widgets.categories.image")} ({$_(
                  "common.optional"
                )})</label
              >
              <input type="file" accept="image/*" onchange={handleFileChange} />
            </div>
          {/if}

          <button class="btn-add" onclick={addItem}>{$_("widgets.add")}</button>
        </div>

        <!-- Items List -->
        <div class="items-list">
          <h3>{$_("widgets.currentItems")}</h3>
          {#if editingItems.length === 0}
            <p class="empty-message">{$_("widgets.noItems")}</p>
          {:else}
            {#each editingItems as item, index}
              <div class="item-row">
                <div class="item-content">
                  {#if activeWidget === "banners"}
                    <div class="banner-item">
                      <img
                        src={getImageUrl("banners", item.key)}
                        alt={item.key}
                        class="item-image"
                      />
                      <div class="item-details">
                        <div>
                          <strong>{$_("widgets.banners.key")}:</strong>
                          {item.key}
                        </div>
                        <div>
                          <strong>{$_("widgets.banners.url")}:</strong>
                          {item.url}
                        </div>
                        <div>
                          <strong>{$_("widgets.banners.textEn")}:</strong>
                          {item.text?.en || ""}
                        </div>
                        <div>
                          <strong>{$_("widgets.banners.textAr")}:</strong>
                          {item.text?.ar || ""}
                        </div>
                      </div>
                    </div>
                  {:else if activeWidget === "categories"}
                    <div class="category-item">
                      <img
                        src={getImageUrl("categories", item.key)}
                        alt={item.key}
                        class="item-image"
                        onerror={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                      <div>
                        <strong>{$_("widgets.categories.key")}:</strong>
                        {item.key}
                      </div>
                    </div>
                  {:else}
                    <div>
                      <strong>{$_("widgets.brands.key")}:</strong>
                      {item.key}
                    </div>
                  {/if}
                </div>

                <div class="item-actions">
                  <button
                    class="btn-move"
                    onclick={() => moveItem(index, "up")}
                    disabled={index === 0}>↑</button
                  >
                  <button
                    class="btn-move"
                    onclick={() => moveItem(index, "down")}
                    disabled={index === editingItems.length - 1}>↓</button
                  >
                  <button class="btn-remove" onclick={() => removeItem(index)}
                    >×</button
                  >
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" onclick={closeModal}>
          {$_("common.cancel")}
        </button>
        <button class="btn-save" onclick={saveWidget}>
          {$_("common.save")}
        </button>
      </div>
    </div>
  </div>
{/if}

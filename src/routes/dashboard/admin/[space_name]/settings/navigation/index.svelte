<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
  import { getSpaceContents, updateEntity } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _ } from "@/i18n";
  import { website, defaultPageSize } from "@/config";
  import { derived } from "svelte/store";
  import { locale } from "@/i18n";
  import { ResourceType } from "@edraj/tsdmart";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  interface NavItem {
    url: string;
    order: number;
    title: {
      ar?: string;
      en?: string;
    };
  }

  let navigationData = $state<any>(null);
  let navItems = $state<NavItem[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedItemForDelete = $state<NavItem | null>(null);

  let formData = $state<NavItem>({
    url: "",
    order: 0,
    title: { ar: "", en: "" },
  });

  let currentPage = $state(1);
  let itemsPerPage = $state(defaultPageSize);

  onMount(async () => {
    await loadNavigation();
  });

  async function loadNavigation() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "settings/navigation",
        "managed",
        100,
        0,
        true,
      );

      if (response?.records && response.records.length > 0) {
        navigationData = response.records[0];
        const items = navigationData?.attributes?.payload?.body?.items || [];
        navItems = items.sort((a: NavItem, b: NavItem) => a.order - b.order);
      } else {
        navItems = [];
      }
    } catch (error) {
      console.error("Error loading navigation:", error);
      errorToastMessage(
        $_("admin.error_loading_navigation") || "Error loading navigation",
      );
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    formData = {
      url: "",
      order: navItems.length + 1,
      title: { ar: "", en: "" },
    };
    showCreateModal = true;
  }

  function openEditModal(item: NavItem) {
    formData = {
      url: item.url,
      order: item.order,
      title: { ...item.title },
    };
    showEditModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    formData = { url: "", order: 0, title: { ar: "", en: "" } };
  }

  function closeEditModal() {
    showEditModal = false;
    formData = { url: "", order: 0, title: { ar: "", en: "" } };
  }

  function openDeleteModal(item: NavItem) {
    selectedItemForDelete = item;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedItemForDelete = null;
  }

  async function handleCreateItem() {
    if (!formData.url || !formData.title.en) {
      errorToastMessage(
        $_("admin.fill_required_fields") || "Please fill required fields",
      );
      return;
    }

    isSaving = true;
    try {
      const newItem: NavItem = {
        ...formData,
        order: navItems.length + 1,
      };

      navItems.push(newItem);
      navItems = [...navItems]; // Trigger reactivity

      await saveNavigation();
      successToastMessage(
        $_("admin.navigation_item_created") ||
          "Navigation item created successfully",
      );
      closeCreateModal();
    } catch (error) {
      console.error("Error creating item:", error);
      errorToastMessage(
        $_("admin.error_creating_item") || "Error creating item",
      );
    } finally {
      isSaving = false;
    }
  }

  async function handleUpdateItem() {
    if (!formData.url || !formData.title.en) {
      errorToastMessage(
        $_("admin.fill_required_fields") || "Please fill required fields",
      );
      return;
    }

    isSaving = true;
    try {
      const itemIndex = navItems.findIndex(
        (item) =>
          item.url === navItems.find((i) => i.order === formData.order)?.url,
      );

      if (itemIndex >= 0) {
        navItems[itemIndex] = { ...formData };
        navItems = [...navItems];

        await saveNavigation();
        successToastMessage(
          $_("admin.navigation_item_updated") ||
            "Navigation item updated successfully",
        );
        closeEditModal();
      }
    } catch (error) {
      console.error("Error updating item:", error);
      errorToastMessage(
        $_("admin.error_updating_item") || "Error updating item",
      );
    } finally {
      isSaving = false;
    }
  }

  async function handleDeleteItem() {
    if (!selectedItemForDelete) return;

    isSaving = true;
    try {
      navItems = navItems.filter(
        (item) => item.url !== selectedItemForDelete?.url,
      );

      // Recalculate orders
      navItems = navItems.map((item, index) => ({
        ...item,
        order: index + 1,
      }));

      await saveNavigation();
      successToastMessage(
        $_("admin.navigation_item_deleted") ||
          "Navigation item deleted successfully",
      );
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting item:", error);
      errorToastMessage(
        $_("admin.error_deleting_item") || "Error deleting item",
      );
    } finally {
      isSaving = false;
    }
  }

  async function saveNavigation() {
    if (!navigationData) return;

    try {
      await updateEntity(
        navigationData.shortname,
        website.main_space,
        "settings/navigation",
        ResourceType.content,
        {
          payload: {
            body: {
              items: navItems,
            },
          },
        },
        "",
        "",
      );
    } catch (error) {
      console.error("Error saving navigation:", error);
      throw error;
    }
  }

  function moveItemUp(index: number) {
    if (index > 0) {
      [navItems[index], navItems[index - 1]] = [
        navItems[index - 1],
        navItems[index],
      ];
      navItems = navItems.map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));
      saveNavigation();
    }
  }

  function moveItemDown(index: number) {
    if (index < navItems.length - 1) {
      [navItems[index], navItems[index + 1]] = [
        navItems[index + 1],
        navItems[index],
      ];
      navItems = navItems.map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));
      saveNavigation();
    }
  }

  function getItemTitle(item: NavItem): string {
    return (
      item.title[$locale as keyof typeof item.title] ||
      item.title.en ||
      item.url
    );
  }

  let paginatedItems = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return navItems.slice(start, start + itemsPerPage);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(navItems.length / itemsPerPage) || 1;
  });

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }
</script>

<div class="navigation-settings-container">
  <!-- Header -->
  <div class="page-header">
    <button
      class="back-button"
      onclick={() => $goto(`/dashboard/admin/[space_name]/settings`)}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <path
          d="M12 5l-5 5 5 5"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      {$_("common.back") || "Back"}
    </button>
    <h1>{$_("admin.navigation") || "Navigation"}</h1>
    <p>
      {$_("admin.navigation_description") ||
        "Manage public navigation menu items"}
    </p>

    <button class="btn-primary" onclick={openCreateModal} disabled={isLoading}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 4a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H5a1 1 0 110-2h6V5a1 1 0 011-1z"
        />
      </svg>
      {$_("common.add_new") || "Add New"}
    </button>
  </div>

  <!-- Loading State -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if navItems.length === 0}
    <!-- Empty State -->
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <h3>{$_("admin.no_navigation_items") || "No navigation items"}</h3>
      <p>
        {$_("admin.no_navigation_items_description") ||
          "Start by adding your first navigation item"}
      </p>
      <button class="btn-primary" onclick={openCreateModal}>
        {$_("common.add_new") || "Add New"}
      </button>
    </div>
  {:else}
    <!-- Table -->
    <div class="table-container">
      <table class="items-table">
        <thead>
          <tr>
            <th>{$_("admin.order") || "Order"}</th>
            <th>{$_("admin.title") || "Title"}</th>
            <th>{$_("admin.url") || "URL"}</th>
            <th>{$_("admin.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedItems as item, index}
            <tr>
              <td class="order-cell">
                <div class="order-controls">
                  <button
                    class="move-btn"
                    onclick={() =>
                      moveItemUp((currentPage - 1) * itemsPerPage + index)}
                    disabled={index === 0 && currentPage === 1}
                    title={$_("admin.move_up") || "Move up"}
                  >
                    ↑
                  </button>
                  <span class="order-num">{item.order}</span>
                  <button
                    class="move-btn"
                    onclick={() =>
                      moveItemDown((currentPage - 1) * itemsPerPage + index)}
                    disabled={index === paginatedItems.length - 1 &&
                      currentPage === totalPages}
                    title={$_("admin.move_down") || "Move down"}
                  >
                    ↓
                  </button>
                </div>
              </td>
              <td>
                <div class="title-info">
                  <div class="title-main">{getItemTitle(item)}</div>
                </div>
              </td>
              <td>
                <code class="url-code">{item.url}</code>
              </td>
              <td>
                <div class="actions-cell">
                  <button
                    class="action-btn edit"
                    onclick={() => openEditModal(item)}
                    title={$_("common.edit") || "Edit"}
                  >
                    ✎
                  </button>
                  <button
                    class="action-btn delete"
                    onclick={() => openDeleteModal(item)}
                    title={$_("common.delete") || "Delete"}
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="page-btn"
          onclick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← {$_("common.previous") || "Previous"}
        </button>

        <div class="pagination-pages">
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
            {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
              <button
                class="page-btn"
                class:active={page === currentPage}
                onclick={() => goToPage(page)}
              >
                {page}
              </button>
            {:else if page === currentPage - 2 || page === currentPage + 2}
              <span class="page-ellipsis">...</span>
            {/if}
          {/each}
        </div>

        <button
          class="page-btn"
          onclick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          {$_("common.next") || "Next"} →
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin.add_navigation_item") || "Add Navigation Item"}</h2>
        <button class="close-btn" onclick={closeCreateModal}>✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>{$_("admin.url") || "URL"} *</label>
          <input
            type="text"
            placeholder="/products"
            bind:value={formData.url}
          />
        </div>

        <div class="form-group">
          <label>{$_("admin.title_en") || "Title (English)"} *</label>
          <input
            type="text"
            placeholder="Products"
            bind:value={formData.title.en}
          />
        </div>

        <div class="form-group">
          <label>{$_("admin.title_ar") || "Title (Arabic)"}</label>
          <input
            type="text"
            placeholder="المنتجات"
            bind:value={formData.title.ar}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeCreateModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          class="btn-primary"
          onclick={handleCreateItem}
          disabled={isSaving}
        >
          {isSaving
            ? $_("common.saving") || "Saving..."
            : $_("common.create") || "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin.edit_navigation_item") || "Edit Navigation Item"}</h2>
        <button class="close-btn" onclick={closeEditModal}>✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>{$_("admin.url") || "URL"} *</label>
          <input
            type="text"
            placeholder="/products"
            bind:value={formData.url}
          />
        </div>

        <div class="form-group">
          <label>{$_("admin.title_en") || "Title (English)"} *</label>
          <input
            type="text"
            placeholder="Products"
            bind:value={formData.title.en}
          />
        </div>

        <div class="form-group">
          <label>{$_("admin.title_ar") || "Title (Arabic)"}</label>
          <input
            type="text"
            placeholder="المنتجات"
            bind:value={formData.title.ar}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeEditModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          class="btn-primary"
          onclick={handleUpdateItem}
          disabled={isSaving}
        >
          {isSaving
            ? $_("common.saving") || "Saving..."
            : $_("common.update") || "Update"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedItemForDelete}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div
      class="modal-content confirm-modal"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header danger">
        <h2>
          {$_("admin.delete_navigation_item") || "Delete Navigation Item?"}
        </h2>
        <button class="close-btn" onclick={closeDeleteModal}>✕</button>
      </div>

      <div class="modal-body">
        <p>
          {$_("admin.confirm_delete_navigation") ||
            "Are you sure you want to delete this navigation item?"}
        </p>
        <div class="preview-item">
          <strong>{getItemTitle(selectedItemForDelete)}</strong>
          <code>{selectedItemForDelete.url}</code>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          class="btn-danger"
          onclick={handleDeleteItem}
          disabled={isSaving}
        >
          {isSaving
            ? $_("common.deleting") || "Deleting..."
            : $_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

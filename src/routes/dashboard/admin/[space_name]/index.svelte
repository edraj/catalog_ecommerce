<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params } from "@roxi/routify";
  import {
    deleteEntity,
    getSpaceContents,
    getSpaces,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { Dmart, RequestType, ResourceType } from "@edraj/tsdmart";
  import FolderForm from "@/components/forms/FolderForm.svelte";
  import MetaForm from "@/components/forms/MetaForm.svelte";
  import { formatNumberInText } from "@/lib/helpers";
  import {
    getLocalizedDisplayName,
    getLocalizedDescription,
    formatDate,
    getItemIcon,
    getResourceTypeColor,
    filterBySearch,
    sortItems,
    matchesSearch,
  } from "@/lib/utils/adminUtils";
  import { roles } from "@/stores/user";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let isZmAdmin = $state(false);

  let isLoading = $state(false);
  let allContents = $state([]);
  let displayedContents = $state([]);
  let error = $state(null);
  let spaceName = $state("");
  let actualSubpath = $state("");
  let currentSpace = $state(null);
  let hideFolders = $state([]);
  let isEditMode = $state(false);
  let selectedFolderForEdit = $state(null);

  let searchQuery = $state("");
  let selectedType = $state("all");
  let selectedStatus = $state("all");
  let sortBy = $state("name");
  let sortOrder = $state("asc");
  let isSearchActive = $state(false);

  const typeOptions = [
    { value: "all", label: $_("admin_dashboard.filters.all") },
    { value: "folder", label: $_("admin_dashboard.filters.folder") },
    { value: "content", label: $_("admin_dashboard.filters.content") },
    { value: "post", label: $_("admin_dashboard.filters.post") },
    { value: "ticket", label: $_("admin_dashboard.filters.ticket") },
    { value: "user", label: $_("admin_dashboard.filters.user") },
    { value: "media", label: $_("admin_dashboard.filters.media") },
  ];

  const statusOptions = [
    { value: "all", label: $_("admin_dashboard.filters.all") },
    { value: "active", label: $_("admin_dashboard.filters.active") },
    { value: "inactive", label: $_("admin_dashboard.filters.inactive") },
  ];

  const sortOptions = [
    { value: "name", label: $_("admin_dashboard.sort.name") },
    { value: "created", label: $_("admin_dashboard.sort.created") },
    { value: "updated", label: $_("admin_dashboard.sort.updated") },
    { value: "owner", label: $_("admin_dashboard.sort.owner") },
  ];

  let showCreateFolderModal = $state(false);
  let folderContent = {
    title: "",
    content: "",
    is_active: true,
    tags: [],
    index_attributes: [],
    sort_by: "created_at",
    sort_type: "descending",
    content_resource_types: [],
    content_schema_shortnames: [],
    workflow_shortnames: [],
    allow_view: true,
    allow_create: true,
    allow_update: true,
    allow_delete: false,
    allow_create_category: false,
    allow_csv: false,
    allow_upload_csv: false,
    use_media: false,
    stream: false,
    expand_children: false,
    disable_filter: false,
  };
  let isCreatingFolder = false;

  let metaContent: any = {};
  let validateMetaForm = null;

  onMount(async () => {
    spaceName = $params.space_name;
    actualSubpath = $params.subpath || "/";

    const userRoles = $roles || [];
    isZmAdmin = userRoles.includes("zm_admin");

    if (!isZmAdmin) {
      await loadContents();
    }
  });

  async function loadContents() {
    isLoading = true;
    try {
      const spacesResponse = await getSpaces(false, "managed");
      if (spacesResponse && spacesResponse.records) {
        currentSpace = spacesResponse.records.find(
          (s) => s.shortname === spaceName,
        );
        hideFolders = currentSpace?.attributes?.hide_folders || [];
      }

      const response = await getSpaceContents(
        spaceName,
        "/",
        "managed",
        100,
        0,
        true,
      );
      if (response && response.records) {
        allContents = response.records.filter((item) => {
          if (item.resource_type === "folder" && item.subpath === "/") {
            return !hideFolders.includes(item.shortname);
          }
          return true;
        });
        applyFilters();
      } else {
        allContents = [];
        displayedContents = [];
      }
    } catch (err) {
      console.error("Error fetching space contents:", err);
      error = $_("admin_space.error.failed_load_contents");
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    let filtered = [...allContents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const shortname = item.shortname?.toLowerCase() || "";
        const displayName = getLocalizedDisplayName(
          item,
          $locale,
        ).toLowerCase();
        const description = getLocalizedDescription(
          item,
          $locale,
        ).toLowerCase();
        const owner = item.attributes?.owner_shortname?.toLowerCase() || "";

        return (
          shortname.includes(query) ||
          displayName.includes(query) ||
          description.includes(query) ||
          owner.includes(query)
        );
      });
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.resource_type === selectedType);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => {
        const isActive = item.attributes?.is_active;
        return selectedStatus === "active" ? isActive : !isActive;
      });
    }

    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = getLocalizedDisplayName(a, $locale).toLowerCase();
          bValue = getLocalizedDisplayName(b, $locale).toLowerCase();
          break;
        case "type":
          aValue = a.resource_type || "";
          bValue = b.resource_type || "";
          break;
        case "created":
          aValue = new Date(a.attributes?.created_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        case "updated":
          aValue = new Date(a.attributes?.updated_at || 0);
          bValue = new Date(b.attributes?.updated_at || 0);
          break;
        case "owner":
          aValue = (a.attributes?.owner_shortname || "").toLowerCase();
          bValue = (b.attributes?.owner_shortname || "").toLowerCase();
          break;
        default:
          aValue = getLocalizedDisplayName(a, $locale).toLowerCase();
          bValue = getLocalizedDisplayName(b, $locale).toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    displayedContents = filtered;
    isSearchActive =
      searchQuery.trim() !== "" ||
      selectedType !== "all" ||
      selectedStatus !== "all";
  }

  function clearFilters() {
    searchQuery = "";
    selectedType = "all";
    selectedStatus = "all";
    sortBy = "name";
    sortOrder = "asc";
    applyFilters();
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
    applyFilters();
  }

  $effect(() => {
    applyFilters();
  });

  function handleItemClick(item: any) {
    if (item.resource_type === "folder" || item.subpath !== "/") {
      const subpath =
        item.subpath === "/"
          ? item.shortname
          : `${item.subpath}/${item.shortname}`;
      $goto(`/dashboard/admin/[space_name]/[subpath]`, {
        space_name: spaceName,
        subpath: subpath,
      });
    }
  }

  function handleCreateFolder() {
    isEditMode = false;
    selectedFolderForEdit = null;
    folderContent = {
      title: "",
      content: "",
      is_active: true,
      tags: [],
      index_attributes: [],
      sort_by: "created_at",
      sort_type: "descending",
      content_resource_types: [],
      content_schema_shortnames: [],
      workflow_shortnames: [],
      allow_view: true,
      allow_create: true,
      allow_update: true,
      allow_delete: false,
      allow_create_category: false,
      allow_csv: false,
      allow_upload_csv: false,
      use_media: false,
      stream: false,
      expand_children: false,
      disable_filter: false,
    };
    showCreateFolderModal = true;
  }

  function handleEditFolder(item) {
    isEditMode = true;
    selectedFolderForEdit = item;

    metaContent = {
      shortname: item.shortname,
      displayname: item.attributes?.displayname || {},
      description: item.attributes?.description || {},
    };

    const existingContent = item.attributes?.payload?.body || {};
    folderContent = {
      title: existingContent.title || "",
      content: existingContent.content || "",
      is_active:
        existingContent.is_active !== undefined
          ? existingContent.is_active
          : true,
      tags: existingContent.tags || [],
      index_attributes: existingContent.index_attributes || [],
      sort_by: existingContent.sort_by || "created_at",
      sort_type: existingContent.sort_type || "descending",
      content_resource_types: existingContent.content_resource_types || [],
      content_schema_shortnames:
        existingContent.content_schema_shortnames || [],
      workflow_shortnames: existingContent.workflow_shortnames || [],
      allow_view:
        existingContent.allow_view !== undefined
          ? existingContent.allow_view
          : true,
      allow_create:
        existingContent.allow_create !== undefined
          ? existingContent.allow_create
          : true,
      allow_update:
        existingContent.allow_update !== undefined
          ? existingContent.allow_update
          : true,
      allow_delete:
        existingContent.allow_delete !== undefined
          ? existingContent.allow_delete
          : false,
      allow_create_category:
        existingContent.allow_create_category !== undefined
          ? existingContent.allow_create_category
          : false,
      allow_csv:
        existingContent.allow_csv !== undefined
          ? existingContent.allow_csv
          : false,
      allow_upload_csv:
        existingContent.allow_upload_csv !== undefined
          ? existingContent.allow_upload_csv
          : false,
      use_media:
        existingContent.use_media !== undefined
          ? existingContent.use_media
          : false,
      stream:
        existingContent.stream !== undefined ? existingContent.stream : false,
      expand_children:
        existingContent.expand_children !== undefined
          ? existingContent.expand_children
          : false,
      disable_filter:
        existingContent.disable_filter !== undefined
          ? existingContent.disable_filter
          : false,
    };

    showCreateFolderModal = true;
  }

  async function handleSaveFolder(event) {
    event.preventDefault();
    isCreatingFolder = true;

    try {
      const response = await Dmart.request({
        space_name: spaceName,
        request_type: isEditMode ? RequestType.update : RequestType.create,
        records: [
          {
            resource_type: ResourceType.folder,
            shortname: metaContent.shortname || "auto",
            subpath: "/",
            attributes: {
              displayname: metaContent.displayname,
              description: metaContent.description,
              payload: {
                body: folderContent,
                content_type: "json",
              },
              is_active: true,
            },
          },
        ],
      });

      if (response) {
        showCreateFolderModal = false;
        await loadContents();
      } else {
        const errorMessage = isEditMode
          ? $_("admin_space.error.update_folder_failed")
          : $_("admin_space.error.create_folder_failed");
        alert(errorMessage);
      }
    } catch (err) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} folder:`,
        err,
      );
      const errorMessage = isEditMode
        ? $_("admin_space.error.update_folder_error")
        : $_("admin_space.error.create_folder_error");
      alert(errorMessage + ": " + err.message);
    } finally {
      isCreatingFolder = false;
    }
  }

  async function handleDeleteItem(item: any, event: Event) {
    event.stopPropagation();

    if (
      !confirm(
        $_("admin_space.confirm.delete_item", {
          values: { name: item.shortname },
        }),
      )
    ) {
      return;
    }

    try {
      const success = await deleteEntity(
        item.shortname,
        spaceName,
        actualSubpath,
        item.resource_type,
      );
      if (success) {
        await loadContents();
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }

  function goBack() {
    $goto("/dashboard/admin");
  }
</script>

<div class="min-h-screen bg-gray-50" class:rtl={$isRTL}>
  {#if isZmAdmin}
    <div class="welcome-container">
      <div class="welcome-content">
        <div class="welcome-logo">
          <img
            src="/assets/images/logo.svg"
            alt="zaintmart Logo"
            class="logo-image"
          />
        </div>
        <h1 class="welcome-title">
          {$_("admin_dashboard.zm_admin_welcome.title")}
        </h1>
        <p class="welcome-text">
          {$_("admin_dashboard.zm_admin_welcome.description")}
        </p>
        <div class="features-grid">
          <div class="feature-card">
            <svg
              class="feature-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.manage_products_title",
              )}
            </h3>
            <p>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.manage_products_desc",
              )}
            </p>
          </div>
          <div class="feature-card">
            <svg
              class="feature-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            <h3>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.categories_brands_title",
              )}
            </h3>
            <p>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.categories_brands_desc",
              )}
            </p>
          </div>
          <div class="feature-card">
            <svg
              class="feature-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.process_orders_title",
              )}
            </h3>
            <p>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.process_orders_desc",
              )}
            </p>
          </div>
          <div class="feature-card">
            <svg
              class="feature-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.configure_settings_title",
              )}
            </h3>
            <p>
              {$_(
                "admin_dashboard.zm_admin_welcome.features.configure_settings_desc",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Original content for super_admin -->
    <div class="bg-white border-b border-gray-200">
      <div class="container mx-auto px-4 py-6 max-w-7xl">
        <div class="flex items-center justify-between py-6">
          <div
            class="flex items-center space-x-4"
            class:space-x-reverse={$isRTL}
          >
            <button
              onclick={goBack}
              class="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
              class:flex-row-reverse={$isRTL}
              aria-label={$_("admin_space.navigation.go_back")}
            >
              <svg
                class="w-5 h-5 mr-2"
                class:mr-2={!$isRTL}
                class:ml-2={$isRTL}
                class:rotate-180={$isRTL}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              {$_("admin_space.navigation.back_to_admin")}
            </button>
            <div class="h-6 w-px bg-gray-300"></div>
            <div class:text-right={$isRTL}>
              <h1 class="text-2xl font-bold text-gray-900 capitalize">
                {$_("admin_space.title", { values: { spaceName } })}
              </h1>
              <p class="text-gray-600">
                {$_("admin_space.subtitle")}
              </p>
            </div>
          </div>

          <button
            aria-label={`Create new folder`}
            onclick={handleCreateFolder}
            class="hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            style="background-color: #281f51;"
            class:flex-row-reverse={$isRTL}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
            {$_("admin_space.actions.create_folder")}
          </button>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-8 max-w-7xl">
      {#if isLoading}
        <div class="flex justify-center py-16">
          <Diamonds color="#3b82f6" size="60" unit="px" />
        </div>
      {:else if error}
        <div class="text-center py-16" class:text-right={$isRTL}>
          <div
            class="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6"
          >
            <svg
              class="w-12 h-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">
            {$_("admin_space.error.title")}
          </h3>
          <p class="text-gray-600">{error}</p>
        </div>
      {:else if allContents.length === 0}
        <div class="text-center py-16" class:text-right={$isRTL}>
          <div
            class="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"
          >
            <svg
              class="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 13h6m-3-3v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">
            {$_("admin_space.empty.title")}
          </h3>
          <p class="text-gray-600">
            {$_("admin_space.empty.description")}
          </p>
        </div>
      {:else}{/if}
    </div>
  {/if}
</div>

{#if showCreateFolderModal}
  <div class="modal-overlay">
    <div class="modal-container" class:rtl={$isRTL}>
      <div class="modal-header">
        <div class="modal-header-content" class:text-right={$isRTL}>
          <h3 class="modal-title">
            {isEditMode
              ? $_("admin_space.modal.edit.title")
              : $_("admin_space.modal.create.title")}
          </h3>
          <p class="modal-subtitle">
            {isEditMode
              ? $_("admin_space.modal.edit.subtitle")
              : $_("admin_space.modal.create.subtitle")}
          </p>
        </div>
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="modal-close-btn"
          aria-label={$_("admin_space.modal.close")}
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <div class="modal-content">
        <div class="form-section">
          <div class="section-header" class:text-right={$isRTL}>
            <h4 class="section-title">
              {$_("admin_space.modal.basic_info.title")}
            </h4>
            <p class="section-description">
              {$_("admin_space.modal.basic_info.description")}
            </p>
          </div>
          <MetaForm
            bind:formData={metaContent}
            bind:validateFn={validateMetaForm}
            isCreate={!isEditMode}
          />
        </div>

        <div class="form-section">
          <div class="section-header" class:text-right={$isRTL}>
            <h4 class="section-title">
              {$_("admin_space.modal.folder_config.title")}
            </h4>
            <p class="section-description">
              {$_("admin_space.modal.folder_config.description")}
            </p>
          </div>
          <FolderForm
            bind:content={folderContent}
            space_name={spaceName}
            on:foo={handleSaveFolder}
          />
        </div>
      </div>

      <div class="modal-footer" class:flex-row-reverse={$isRTL}>
        <button
          onclick={() => (showCreateFolderModal = false)}
          class="btn btn-secondary"
          disabled={isCreatingFolder}
        >
          {$_("admin_space.modal.cancel")}
        </button>
        <button
          onclick={handleSaveFolder}
          class="btn btn-primary"
          disabled={isCreatingFolder}
        >
          {#if isCreatingFolder}
            <Diamonds size="20" color="#ffffff" />
            {isEditMode
              ? $_("admin_space.modal.updating")
              : $_("admin_space.modal.creating")}
          {:else}
            {isEditMode
              ? $_("admin_space.modal.updatebtn")
              : $_("admin_space.modal.createbtn")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .rtl {
    direction: rtl;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 80rem;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #f3f4f6;
    background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    border-radius: 16px 16px 0 0;
    flex-shrink: 0;
  }

  .rtl .modal-header {
    flex-direction: row-reverse;
  }

  .modal-header-content {
    flex: 1;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .modal-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .modal-close-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-close-btn:hover {
    background: #f3f4f6;
    color: #374151;
    transform: scale(1.05);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-height: 0;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.75rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
    border-radius: 0 0 16px 16px;
    flex-shrink: 0;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 120px;
    justify-content: center;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-secondary {
    background: #f8fafc;
    color: #475569;
    border: 2px solid #e2e8f0;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  .btn-primary {
    background: #281f51;
    color: white;
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: #281f51;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1024px) {
    .modal-container {
      max-width: 95vw;
      margin: 0.5rem;
    }

    .modal-header {
      padding: 1rem 1.5rem;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .modal-container {
      max-width: 100vw;
      max-height: 100vh;
      margin: 0;
      border-radius: 0;
    }

    .modal-header {
      padding: 1rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .rtl .modal-header {
      align-items: flex-end;
    }

    .modal-header-content {
      flex: none;
      width: 100%;
    }

    .modal-close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }

    .rtl .modal-close-btn {
      right: auto;
      left: 1rem;
    }

    .modal-content {
      padding: 1rem;
    }

    .modal-footer {
      padding: 1rem;
      flex-direction: column-reverse;
    }

    .rtl .modal-footer {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }

  .modal-content::-webkit-scrollbar {
    width: 8px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Welcome Page Styles */
  .welcome-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 64px);
    padding: 2rem;
  }

  .welcome-content {
    text-align: center;
    max-width: 1200px;
    width: 100%;
  }

  .welcome-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 120px;
    background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
    border-radius: 50%;
    margin-bottom: 2rem;
    padding: 1.5rem;
  }

  .logo-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .welcome-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 1rem;
  }

  .welcome-text {
    font-size: 1.125rem;
    color: #6b7280;
    margin-bottom: 3rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    margin-top: 3rem;
  }

  .feature-card {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .feature-icon {
    width: 48px;
    height: 48px;
    color: #281f51;
    margin: 0 auto 1rem;
  }

  .feature-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .feature-card p {
    font-size: 0.9375rem;
    color: #6b7280;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .welcome-title {
      font-size: 1.875rem;
    }

    .welcome-text {
      font-size: 1rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    getSpaceContents,
    updateDmartEntity,
    createEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { params } from "@roxi/routify";
  import "./index.css";
  import { website } from "@/config";
  import { ResourceType } from "@edraj/tsdmart";

  let serviceFolders = $state([]);
  let selectedFolder = $state("");
  let previousFolder = $state("");
  let services = $state([]);
  let isLoadingFolders = $state(true);
  let isLoadingServices = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let categoryFilter = $state("all");
  let showCreateModal = $state(false);
  let isSaving = $state(false);

  // Pagination state
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let newService = $state({
    key: "",
    name: { en: "", ar: "" },
    cost: 0,
    is_active: true,
    state_shortname: "optional",
    category_shortname: "",
  });

  let filteredServices = $derived.by(() => {
    let filtered = [...services];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const nameEn = item.name?.en?.toLowerCase() || "";
        const nameAr = item.name?.ar?.toLowerCase() || "";
        return nameEn.includes(searchLower) || nameAr.includes(searchLower);
      });
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter((item) => item.is_active === isActive);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.category_shortname === categoryFilter
      );
    }

    return filtered;
  });

  let paginatedServices = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredServices.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredServices.length / itemsPerPage);
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  const uniqueCategories = $derived.by(() => {
    const categories = new Set<string>();
    services.forEach((service) => {
      if (service.category_shortname) {
        categories.add(service.category_shortname);
      }
    });
    return Array.from(categories);
  });

  function getFolderDisplayName(folder: any): string {
    if (!folder) return "";
    return getLocalizedDisplayName(folder, $locale);
  }

  onMount(async () => {
    await loadServiceFolders();
  });

  async function loadServiceFolders() {
    isLoadingFolders = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "service",
        "managed",
        1000,
        0,
        true
      );

      if (response?.records) {
        serviceFolders = response.records.filter(
          (record) => record.resource_type === "folder"
        );
      }
    } catch (error) {
      console.error("Error loading service folders:", error);
      errorToastMessage($_("admin.services.error_loading"));
    } finally {
      isLoadingFolders = false;
    }
  }

  async function loadFolderServices(reset = true) {
    if (reset) {
      services = [];
    }

    if (selectedFolder === "all") {
      isLoadingServices = true;
      try {
        const allServices = [];

        for (const folder of serviceFolders) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `service/${folder.shortname}`,
              "managed",
              100,
              0,
              true
            );

            if (response?.records) {
              for (const record of response.records) {
                if (record.shortname === "config") {
                  const body = record.attributes?.payload?.body;

                  if (body?.items && Array.isArray(body.items)) {
                    for (const item of body.items) {
                      allServices.push({
                        ...item,
                        folder_shortname: folder.shortname,
                        folder_displayname: getFolderDisplayName(folder),
                        record_shortname: record.shortname,
                      });
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(
              `Error loading services for ${folder.shortname}:`,
              error
            );
          }
        }

        services = allServices;
      } catch (error) {
        console.error("Error loading services:", error);
        errorToastMessage($_("admin.services.error_loading_services"));
      } finally {
        isLoadingServices = false;
      }
      return;
    }

    isLoadingServices = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `service/${selectedFolder}`,
        "managed",
        100,
        0,
        true
      );

      const processedServices = [];

      if (response?.records) {
        const folder = serviceFolders.find(
          (f) => f.shortname === selectedFolder
        );

        for (const record of response.records) {
          if (record.shortname === "config") {
            const body = record.attributes?.payload?.body;

            if (body?.items && Array.isArray(body.items)) {
              for (const item of body.items) {
                processedServices.push({
                  ...item,
                  folder_shortname: selectedFolder,
                  folder_displayname: getFolderDisplayName(folder),
                  record_shortname: record.shortname,
                });
              }
            }
          }
        }
      }

      services = processedServices;
    } catch (error) {
      console.error("Error loading services:", error);
      errorToastMessage($_("admin.services.error_loading_services"));
    } finally {
      isLoadingServices = false;
    }
  }

  $effect(() => {
    if (selectedFolder && selectedFolder !== previousFolder) {
      previousFolder = selectedFolder;
      loadFolderServices(true);
    }
  });

  function formatCurrency(amount: number): string {
    return amount.toLocaleString();
  }

  function isGlobalFolder(shortname: string): boolean {
    return shortname === "global";
  }

  function generateKey() {
    return Math.random().toString(36).substr(2, 16);
  }

  function openCreateModal() {
    newService = {
      key: generateKey(),
      name: { en: "", ar: "" },
      cost: 0,
      is_active: true,
      state_shortname: "optional",
      category_shortname: "",
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  async function createService() {
    if (!newService.name.en || newService.cost <= 0) {
      errorToastMessage($_("admin.services.validation_error"));
      return;
    }

    isSaving = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "service/global",
        "managed",
        100,
        0,
        true
      );

      let existingConfig = null;
      let existingItems = [];

      if (response?.records) {
        existingConfig = response.records.find(
          (record) => record.shortname === "config"
        );
        if (existingConfig) {
          existingItems = existingConfig.attributes?.payload?.body?.items || [];
        }
      }

      const updatedItems = [...existingItems, { ...newService }];

      const payload = {
        body: {
          items: updatedItems,
        },
        content_type: "json",
        schema_shortname: null,
      };

      if (existingConfig) {
        const result = await updateDmartEntity(
          "config",
          website.main_space,
          "service/global",
          ResourceType.content,
          { body: { items: updatedItems } },
          false
        );

        if (result) {
          successToastMessage($_("admin.services.save_success"));
          showCreateModal = false;
          await loadFolderServices(true);
        } else {
          errorToastMessage($_("admin.services.save_error"));
        }
      } else {
        const result = await createEntity(
          {
            shortname: "config",
            body: { items: updatedItems },
            is_active: true,
          },
          website.main_space,
          "service/global",
          ResourceType.content,
          "",
          "",
          "json"
        );

        if (result) {
          successToastMessage($_("admin.services.save_success"));
          showCreateModal = false;
          await loadFolderServices(true);
        } else {
          errorToastMessage($_("admin.services.save_error"));
        }
      }
    } catch (error) {
      console.error("Error creating service:", error);
      errorToastMessage($_("admin.services.save_error"));
    } finally {
      isSaving = false;
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }
</script>

<div class="admin-page-container">
  <div class="admin-page-content">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.services.title")}
          </h1>
          <p class="page-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("admin.services.description")}
          </p>
        </div>
        {#if selectedFolder === "global"}
          <div class="header-right">
            <button class="create-btn" onclick={openCreateModal}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                />
              </svg>
              <span
                >{$_("admin.services.create_service") || "Create Service"}</span
              >
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters-group">
        <label for="folder-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
            />
          </svg>
          {$_("admin.services.select_folder") || "Select Folder"}
        </label>
        <select id="folder-filter" bind:value={selectedFolder}>
          <option value=""
            >{$_("admin.services.choose_folder") ||
              "Choose a folder..."}</option
          >
          <option value="all"
            >{$_("admin.services.all_folders") || "All Folders"}</option
          >
          {#each serviceFolders as folder}
            <option value={folder.shortname}>
              {getFolderDisplayName(folder)}
            </option>
          {/each}
        </select>
      </div>

      <div class="search-bar">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <circle cx="8" cy="8" r="5" stroke-width="2" />
          <path d="M12 12l4 4" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("admin.services.search_placeholder")}
        />
      </div>

      {#if uniqueCategories.length > 0}
        <div class="filters-group">
          <label for="category-filter">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              style="width: 18px; height: 18px;"
            >
              <path
                d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"
              />
            </svg>
            {$_("admin.services.category")}
          </label>
          <select id="category-filter" bind:value={categoryFilter}>
            <option value="all"
              >{$_("admin.services.all_categories") || "All Categories"}</option
            >
            {#each uniqueCategories as category}
              <option value={category}>{category}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="filters-group">
        <label for="status-filter">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            style="width: 18px; height: 18px;"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          {$_("common.status") || "Status"}
        </label>
        <select id="status-filter" bind:value={statusFilter}>
          <option value="all">{$_("admin.all_status") || "All Status"}</option>
          <option value="active">{$_("admin.active") || "Active"}</option>
          <option value="inactive">{$_("admin.inactive") || "Inactive"}</option>
        </select>
      </div>
    </div>

    <!-- Services Table -->
    {#if isLoadingFolders}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading..."}</p>
      </div>
    {:else if !selectedFolder}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <path
            d="M24 8v8m0 16v8m8-20h8m-24 0H8m28.364 14.364l5.656 5.656M5.636 5.636l5.656 5.656m22.708 0l5.656-5.656M5.636 30.364l5.656-5.656"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>
          {$_("admin.services.select_folder_prompt") ||
            "Select a folder to view services"}
        </h3>
        <p>
          {$_("admin.services.select_folder_hint") ||
            "Choose a folder from the dropdown above"}
        </p>
      </div>
    {:else if isLoadingServices}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>{$_("common.loading") || "Loading services..."}</p>
      </div>
    {:else if filteredServices.length === 0}
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <rect x="8" y="8" width="32" height="32" rx="4" stroke-width="2" />
          <path
            d="M16 24h16M24 16v16"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <h3>{$_("admin.services.no_services")}</h3>
        <p>
          {$_("admin.services.no_services_description")}
        </p>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredServices.length}</strong>
          {$_("admin.services.services_count") || "services"}
          {#if selectedFolder !== "all"}
            from <strong
              >{getFolderDisplayName(
                serviceFolders.find((f) => f.shortname === selectedFolder)
              )}</strong
            >
          {/if}
        </p>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>{$_("admin.services.folder") || "Folder"}</th>
              <th>{$_("admin.services.service_name") || "Service Name"}</th>
              <th>{$_("admin.services.category") || "Category"}</th>
              <th>{$_("admin.services.cost") || "Cost"}</th>
              <th>{$_("admin.services.state") || "State"}</th>
              <th>{$_("common.status") || "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {#each paginatedServices as service, i (service.key)}
              {@const isActive = service.is_active === true}
              {@const isGlobal = isGlobalFolder(service.folder_shortname)}
              <tr class="item-row">
                <td>
                  <div
                    class="type-badge"
                    class:global={isGlobal}
                    class:state={!isGlobal}
                  >
                    {#if isGlobal}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path
                          d="M8 0a8 8 0 100 16A8 8 0 008 0zM2.04 4.326c.325 1.329 2.532 2.54 3.717 3.19.48.263.793.434.743.484-.08.08-.162.158-.242.234-.416.396-.787.749-.758 1.266.035.634.618.824 1.214 1.017.577.188 1.168.38 1.286.983.082.417-.075.988-.22 1.52-.215.782-.406 1.48.22 1.48 1.5-.5 3.798-3.186 4-5 .138-1.243-2-2-3.5-2.5-.478-.16-.755.081-.99.284-.172.15-.322.279-.51.216-.445-.148-2.5-2-1.5-2.5.78-.39.952-.171 1.227.182.078.099.163.208.273.318.609.304.662-.132.723-.633.039-.322.081-.671.277-.867.434-.434 1.265-.791 2.028-1.12.712-.306 1.365-.587 1.579-.88A7 7 0 002.04 4.327zm7.5 4.674a1 1 0 110 2 1 1 0 010-2z"
                        />
                      </svg>
                      {$_("admin.services.global_services")}
                    {:else}
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path
                          d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                        />
                      </svg>
                      {service.folder_displayname || service.folder_shortname}
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="service-name">
                    <strong>{service.name?.en || service.name?.ar}</strong>
                    {#if service.name?.ar && service.name?.en !== service.name?.ar}
                      <span class="name-secondary">({service.name.ar})</span>
                    {/if}
                  </div>
                </td>
                <td>
                  {#if service.category_shortname}
                    <span class="state-tag">{service.category_shortname}</span>
                  {:else}
                    <span class="empty-text"
                      >{$_("admin.services.no_category")}</span
                    >
                  {/if}
                </td>
                <td>
                  <div class="cost-display">
                    <strong>{formatCurrency(service.cost)}</strong>
                    {$_("admin.currency") || "IQD"}
                  </div>
                </td>
                <td>
                  <span class="state-tag">{service.state_shortname}</span>
                </td>
                <td>
                  <div
                    class="status-badge"
                    class:active={isActive}
                    class:inactive={!isActive}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="8" cy="8" r="8" />
                    </svg>
                    {#if isActive}
                      {$_("admin.active") || "Active"}
                    {:else}
                      {$_("admin.inactive") || "Inactive"}
                      !-- Create Service Modal -->
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if totalPages > 1}
        <div class="pagination">
          <button
            class="btn btn-secondary btn-small"
            onclick={previousPage}
            disabled={currentPage === 1}
          >
            {$_("previous")}
          </button>

          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-btn"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <button
                class="page-btn"
                class:active={currentPage === 1}
                onclick={() => goToPage(1)}
              >
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-btn"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <button
                class="page-btn"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <div class="pagination-info">
            <span>{formatNumber(filteredServices.length, $locale)} {$_("total_items")}</span>
          </div>

          <button
            class="btn btn-secondary btn-small"
            onclick={nextPage}
            disabled={currentPage === totalPages}
          >
            {$_("next")}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>
{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-container" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin.services.add_service")}</h2>
        <button onclick={closeCreateModal} class="modal-close">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="service-name-en">
            {$_("admin.services.service_name_en")} *
          </label>
          <input
            id="service-name-en"
            type="text"
            bind:value={newService.name.en}
            placeholder={$_("admin.services.service_name_placeholder")}
          />
        </div>

        <div class="form-group">
          <label for="service-name-ar">
            {$_("admin.services.service_name_ar")}
          </label>
          <input
            id="service-name-ar"
            type="text"
            bind:value={newService.name.ar}
            placeholder={$_("admin.services.service_name_ar_placeholder")}
          />
        </div>

        <div class="form-group">
          <label for="service-cost">
            {$_("admin.services.cost")} * (IQD)
          </label>
          <input
            id="service-cost"
            type="number"
            bind:value={newService.cost}
            min="0"
            step="1000"
          />
        </div>

        <div class="form-group">
          <label for="service-category">
            {$_("admin.services.category")}
          </label>
          <input
            id="service-category"
            type="text"
            bind:value={newService.category_shortname}
            placeholder={$_("admin.services.category_placeholder")}
          />
        </div>

        <div class="form-group">
          <label for="service-state">
            {$_("admin.services.state")}
          </label>
          <select id="service-state" bind:value={newService.state_shortname}>
            <option value="optional">{$_("admin.services.optional")}</option>
            <option value="required">{$_("admin.services.required")}</option>
          </select>
        </div>

        <div class="form-group-checkbox">
          <input
            id="service-active"
            type="checkbox"
            bind:checked={newService.is_active}
          />
          <label for="service-active">
            {$_("admin.services.is_active")}
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button onclick={closeCreateModal} class="btn-secondary">
          {$_("cancel")}
        </button>
        <button onclick={createService} disabled={isSaving} class="btn-primary">
          {isSaving ? $_("saving") : $_("add")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pagination-pages {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .page-btn {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-btn:hover:not(.active) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .page-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
    font-weight: 600;
  }

  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 600;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }
</style>

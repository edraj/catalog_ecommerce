<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { ResourceType, ContentType } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    PlusOutline,
    EditOutline,
    TrashBinOutline,
  } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName, formatDate } from "@/lib/utils/adminUtils";
  import { getEntityContent } from "@/lib/utils/entityUtils";
  import { formatNumber } from "@/lib/helpers";
  import {
    Button,
    IconButton,
    LoadingSpinner,
    EmptyState,
  } from "@/components/ui";
  import {
    CreateSpecificationModal,
    EditSpecificationModal,
    DeleteSpecificationModal,
  } from "@/components/modals";
  import type { SpecificationFormData } from "@/components/modals/CreateSpecificationModal.svelte";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let specifications = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedSpecification = $state(null);
  let editFormData = $state<SpecificationFormData | undefined>(undefined);
  let totalSpecificationsCount = $state(0);
  let searchTerm = $state("");
  let openDropdownId = $state<string | null>(null);

  let currentPage = $state(1);
  let itemsPerPage = $state(12);

  let filteredSpecifications = $derived.by(() => {
    if (!searchTerm.trim()) return specifications;
    const term = searchTerm.toLowerCase();
    return specifications.filter((spec) => {
      const displayname = getLocalizedDisplayName(spec, $locale).toLowerCase();
      const shortname = spec.shortname?.toLowerCase() || "";
      return displayname.includes(term) || shortname.includes(term);
    });
  });

  let paginatedSpecifications = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSpecifications.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredSpecifications.length / itemsPerPage);
  });

  onMount(async () => {
    await loadSpecifications();
  });

  async function loadSpecifications() {
    isLoading = true;
    const offset = (currentPage - 1) * itemsPerPage;

    try {
      const response = await getSpaceContents(
        website.main_space,
        "specifications",
        "managed",
        itemsPerPage,
        offset,
        true,
      );

      if (response?.records) {
        specifications = response.records;
        totalSpecificationsCount =
          response.attributes?.total || response.records.length;
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Failed to load specifications");
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(specification) {
    selectedSpecification = specification;
    const content = specification.attributes?.payload?.body || {};
    const displayname = specification.attributes?.displayname || {};

    let options = content?.options || [];

    const normalizedOptions = options.map((opt) => {
      if (opt.name) {
        return {
          key: opt.key || Math.random().toString(36).substring(2, 15),
          name: {
            en: opt.name.en || "",
            ar: opt.name.ar || "",
            ku: opt.name.ku || "",
          },
        };
      } else if (opt.en || opt.ar) {
        return {
          key: opt.key || Math.random().toString(36).substring(2, 15),
          name: {
            en: opt.en || "",
            ar: opt.ar || "",
            ku: opt.ku || "",
          },
        };
      }
      return opt;
    });

    editFormData = {
      displayname: displayname.en || "",
      displayname_ar: displayname.ar || "",
      displayname_ku: displayname.ku || "",
      options:
        normalizedOptions.length > 0
          ? normalizedOptions
          : [
              {
                key: Math.random().toString(36).substring(2, 15),
                name: { en: "", ar: "", ku: "" },
              },
            ],
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedSpecification = null;
  }

  function openDeleteModal(specification) {
    selectedSpecification = specification;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedSpecification = null;
  }

  async function handleCreateSpecification(formData: SpecificationFormData) {
    if (!formData.displayname.trim()) {
      errorToastMessage("Please enter a specification name");
      return;
    }

    const validOptions = formData.options.filter((opt) => opt.name.en.trim());
    if (validOptions.length === 0) {
      errorToastMessage("Please add at least one option with an English name");
      return;
    }

    try {
      const specificationData = {
        displayname_en: formData.displayname,
        displayname_ar: formData.displayname_ar || "",
        displayname_ku: formData.displayname_ku || "",

        body: {
          options: validOptions,
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        specificationData,
        website.main_space,
        "/specifications",
        ResourceType.content,
        "",
        "",
      );

      successToastMessage("Specification created successfully!");
      closeCreateModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error creating specification:", error);
      errorToastMessage("Failed to create specification");
    }
  }

  async function handleUpdateSpecification(formData: SpecificationFormData) {
    if (!formData.displayname.trim()) {
      errorToastMessage("Please enter a specification name");
      return;
    }

    const validOptions = formData.options.filter((opt) => opt.name.en.trim());
    if (validOptions.length === 0) {
      errorToastMessage("Please add at least one option with an English name");
      return;
    }

    if (!selectedSpecification) return;

    try {
      const specificationData = {
        displayname: {
          en: formData.displayname,
          ar: formData.displayname_ar || "",
          ku: formData.displayname_ku || "",
        },
        body: {
          options: validOptions,
        },
        content_type: "json",
        tags: selectedSpecification.attributes?.tags || [],
        is_active: true,
      };

      await updateEntity(
        selectedSpecification.shortname,
        website.main_space,
        selectedSpecification.subpath,
        selectedSpecification.resource_type,
        specificationData,
        "",
        "",
      );

      successToastMessage("Specification updated successfully!");
      closeEditModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error updating specification:", error);
      errorToastMessage("Failed to update specification");
    }
  }

  async function handleDeleteSpecification() {
    if (!selectedSpecification) return;

    try {
      await deleteEntity(
        selectedSpecification.shortname,
        website.main_space,
        selectedSpecification.subpath,
        selectedSpecification.resource_type,
      );

      successToastMessage("Specification deleted successfully!");
      closeDeleteModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error deleting specification:", error);
      errorToastMessage("Failed to delete specification");
    }
  }

  function getSpecificationOptions(specification: any): any[] {
    const content = specification.attributes?.payload?.body || {};
    return content?.options || [];
  }

  function getOptionName(option: any, locale: string): string {
    if (option?.name) {
      if (typeof option.name === "string") return option.name;
      return (
        option.name[locale] ||
        option.name.en ||
        option.name.ar ||
        option.name.ku ||
        ""
      );
    }
    if (option?.[locale]) return option[locale];
    return option?.en || option?.ar || option?.ku || "";
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

  function toggleDropdown(shortname: string) {
    openDropdownId = openDropdownId === shortname ? null : shortname;
  }

  function closeDropdown() {
    openDropdownId = null;
  }

  $effect(() => {
    currentPage = 1;
  });
</script>

<div class="specifications-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon" style="background: #dbeafe;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">
          {$_("admin_dashboard.total_specifications") || "Total Specifications"}
        </p>
        <h3 class="stat-value">
          {formatNumber(specifications.length, $locale)}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #d1fae5;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">
          {$_("admin_dashboard.with_options") || "With Options"}
        </p>
        <h3 class="stat-value">
          {formatNumber(
            specifications.filter((s) => getSpecificationOptions(s).length > 0)
              .length,
            $locale,
          )}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #fef3c7;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">
          {$_("admin_dashboard.total_options") || "Total Options"}
        </p>
        <h3 class="stat-value">
          {formatNumber(
            specifications.reduce(
              (sum, s) => sum + getSpecificationOptions(s).length,
              0,
            ),
            $locale,
          )}
        </h3>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon" style="background: #e0e7ff;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </div>
      <div class="stat-content">
        <p class="stat-title">{$_("common.showing") || "Showing"}</p>
        <h3 class="stat-value">
          {formatNumber(paginatedSpecifications.length, $locale)}
        </h3>
      </div>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="search-and-filters">
    <div class="search-bar search-bar--icon-left">
      <span class="search-icon">
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 15l-4-4m2-5a5 5 0 11-10 0 5 5 0 0110 0z"
          />
        </svg>
      </span>
      <input
        type="text"
        bind:value={searchTerm}
        placeholder={$_("admin_dashboard.search_specifications") ||
          "Search specifications..."}
        class="search-input"
        class:rtl={$isRTL}
        style="padding-left: 32px;"
      />
    </div>
    <style>
      .search-bar--icon-left {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-bar--icon-left .search-icon {
        position: absolute;
        left: 10px;
        color: #9ca3af;
        pointer-events: none;
        display: flex;
        align-items: center;
        height: 100%;
        z-index: 2;
      }
      .rtl .search-bar--icon-left .search-icon {
        left: auto;
        right: 10px;
      }
      .search-bar--icon-left .search-input {
        padding-left: 32px;
      }
      .rtl .search-bar--icon-left .search-input {
        padding-left: 0;
        padding-right: 32px;
      }
    </style>

    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span
        >{$_("admin_dashboard.create_specification") ||
          "Create Specification"}</span
      >
    </button>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if specifications.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>
        {$_("admin_dashboard.no_specifications") || "No specifications found"}
      </h3>
      <p>
        {$_("admin_dashboard.create_first_specification_desc") ||
          "Create your first specification to get started"}
      </p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span
          >{$_("admin_dashboard.create_first_specification") ||
            "Create First Specification"}</span
        >
      </button>
    </div>
  {:else if filteredSpecifications.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>{$_("common.no_results") || "No results found"}</h3>
      <p>
        {$_("common.try_different_search") || "Try adjusting your search terms"}
      </p>
    </div>
  {:else}
    <div class="specifications-grid">
      {#each paginatedSpecifications as specification}
        <div class="specification-card">
          <div class="specification-header">
            <div class="header-left">
              <h3 class="specification-name">
                {getLocalizedDisplayName(specification, $locale)}
              </h3>
              {#if specification.attributes?.is_active}
                <span class="status-badge active">
                  {$_("common.active") || "Active"}
                </span>
              {:else}
                <span class="status-badge inactive">
                  {$_("common.inactive") || "Inactive"}
                </span>
              {/if}
            </div>
            <div class="specification-actions">
              <button
                class="settings-btn"
                onclick={() => toggleDropdown(specification.shortname)}
                title={$_("common.settings") || "Settings"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                  />
                </svg>
              </button>
              {#if openDropdownId === specification.shortname}
                <div class="dropdown-menu">
                  <button
                    class="dropdown-item"
                    onclick={() => {
                      closeDropdown();
                      openEditModal(specification);
                    }}
                  >
                    <EditOutline size="sm" />
                    <span>{$_("common.edit") || "Edit"}</span>
                  </button>
                  <button
                    class="dropdown-item delete"
                    onclick={() => {
                      closeDropdown();
                      openDeleteModal(specification);
                    }}
                  >
                    <TrashBinOutline size="sm" />
                    <span>{$_("common.delete") || "Delete"}</span>
                  </button>
                </div>
              {/if}
            </div>
          </div>
          <div class="specification-options">
            <h4 class="options-title">
              {$_("common.options") || "Options"}:
            </h4>
            {#if getSpecificationOptions(specification).length > 0}
              <div class="options-list">
                {#each getSpecificationOptions(specification) as option}
                  <div class="option-item">
                    <span class="option-value"
                      >{getOptionName(option, $locale)}</span
                    >
                  </div>
                {/each}
              </div>
            {:else}
              <p class="no-options">
                {$_("common.no_options") || "No options defined"}
              </p>
            {/if}
          </div>
          <div class="specification-meta">
            <span class="meta-item"
              >{$_("common.shortname") || "Shortname"}: {specification.shortname}</span
            >
            <span class="meta-item"
              >{$_("common.created") || "Created"}: {formatDate(
                specification.attributes?.created_at,
                $locale,
              )}</span
            >
          </div>
        </div>
      {/each}
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="page-btn"
          onclick={previousPage}
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

        <div class="pagination-info">
          {$_("common.page") || "Page"}
          {currentPage}
          {$_("common.of") || "of"}
          {totalPages}
        </div>

        <button
          class="page-btn"
          onclick={nextPage}
          disabled={currentPage === totalPages}
        >
          {$_("common.next") || "Next"} →
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal Components -->
<CreateSpecificationModal
  bind:show={showCreateModal}
  onClose={closeCreateModal}
  onSubmit={handleCreateSpecification}
/>

<EditSpecificationModal
  bind:show={showEditModal}
  onClose={closeEditModal}
  onSubmit={handleUpdateSpecification}
  specification={selectedSpecification}
  initialData={editFormData}
/>

<DeleteSpecificationModal
  bind:show={showDeleteModal}
  onClose={closeDeleteModal}
  onConfirm={handleDeleteSpecification}
  specification={selectedSpecification}
/>

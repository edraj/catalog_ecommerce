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

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let paginatedSpecifications = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return specifications.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(specifications.length / itemsPerPage);
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
</script>

<div class="specifications-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.specifications") || "Specifications Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.specifications_description") ||
          "Manage product specifications and their available options"}
      </p>
    </div>
    <Button variant="primary" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span
        >{$_("admin_dashboard.create_specification") ||
          "Create Specification"}</span
      >
    </Button>
  </div>

  {#if isLoading}
    <LoadingSpinner message={$_("common.loading") || "Loading..."} />
  {:else if specifications.length === 0}
    <EmptyState
      icon="📋"
      title={$_("admin_dashboard.no_specifications") ||
        "No specifications found"}
      description="Create your first specification to get started"
    >
      {#snippet action()}
        <Button variant="primary" onclick={openCreateModal}>
          {$_("admin_dashboard.create_first_specification") ||
            "Create First Specification"}
        </Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="specifications-grid">
      {#each paginatedSpecifications as specification}
        <div class="specification-card">
          <div class="specification-header">
            <h3 class="specification-name">
              {getLocalizedDisplayName(specification, $locale)}
            </h3>
            <div class="specification-actions">
              <IconButton
                onclick={() => openEditModal(specification)}
                title="Edit"
              >
                <EditOutline size="sm" />
              </IconButton>
              <IconButton
                variant="delete"
                onclick={() => openDeleteModal(specification)}
                title="Delete"
              >
                <TrashBinOutline size="sm" />
              </IconButton>
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
            <span class="meta-item">Shortname: {specification.shortname}</span>
            <span class="meta-item"
              >Created: {formatDate(
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
          <span
            >{formatNumber(totalSpecificationsCount, $locale)}
            {$_("total_items")}</span
          >
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

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
  import {website} from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let specifications = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedSpecification = $state(null);
  let editFormData = $state<SpecificationFormData | undefined>(undefined);

  onMount(async () => {
    await loadSpecifications();
  });

  async function loadSpecifications() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "specifications",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        specifications = response.records;
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
    const content = getEntityContent(specification);
    const displayname = specification.attributes?.displayname || {};

    editFormData = {
      displayname: displayname.en || "",
      displayname_ar: displayname.ar || "",
      displayname_ku: displayname.ku || "",
      options: content?.options || [
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
          content: {
            options: validOptions,
          },
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
        ""
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
        content: {
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
        ""
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
        selectedSpecification.resource_type
      );

      successToastMessage("Specification deleted successfully!");
      closeDeleteModal();
      await loadSpecifications();
    } catch (error) {
      console.error("Error deleting specification:", error);
      errorToastMessage("Failed to delete specification");
    }
  }

  // Helper function to get options from specification
  function getSpecificationOptions(specification: any): any[] {
    const content = getEntityContent(specification);
    return content?.options || [];
  }

  function getOptionName(option: any, locale: string): string {
    if (!option?.name) return "";
    if (typeof option.name === "string") return option.name;
    return option.name[locale] || option.name.en || option.name.ar || "";
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
      {#each specifications as specification}
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
            <div class="options-list">
              {#each getSpecificationOptions(specification) as option}
                <div class="option-item">
                  <span class="option-value"
                    >{getOptionName(option, $locale)}</span
                  >
                </div>
              {/each}
            </div>
          </div>
          <div class="specification-meta">
            <span class="meta-item">Shortname: {specification.shortname}</span>
            <span class="meta-item"
              >Created: {formatDate(
                specification.attributes?.created_at,
                $locale
              )}</span
            >
          </div>
        </div>
      {/each}
    </div>
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

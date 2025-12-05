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
  import {
    getSpecificationProduct,
    getSpecificationAttributes,
    getProductName,
    filterSpecificationsByProduct,
    getEntityContent,
    buildEntityPayload,
  } from "@/lib/utils/entityUtils";
  import {
    validateSpecificationForm,
    formatCustomAttributes,
  } from "@/lib/utils/validationUtils";
  import {
    Button,
    IconButton,
    Select,
    LoadingSpinner,
    EmptyState,
  } from "@/components/ui";
  import {
    CreateSpecificationModal,
    EditSpecificationModal,
    DeleteSpecificationModal,
  } from "@/components/modals";
  import type { SpecificationFormData } from "@/components/modals/CreateSpecificationModal.svelte";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let specifications = $state([]);
  let products = $state([]);
  let isLoading = $state(true);
  let isLoadingProducts = $state(false);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedSpecification = $state(null);
  let selectedProductFilter = $state("all");
  let editFormData = $state<SpecificationFormData | undefined>(undefined);

  onMount(async () => {
    await loadProducts();
    await loadSpecifications();
  });

  async function loadProducts() {
    isLoadingProducts = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "products",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        products = response.records;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Failed to load products");
    } finally {
      isLoadingProducts = false;
    }
  }

  async function loadSpecifications() {
    isLoading = true;
    try {
      const response = await getSpaceContents(
        "e_commerce",
        "product_specifications",
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
    const attributes = getSpecificationAttributes(specification);

    const customAttributes = Object.entries(attributes).map(([key, value]) => ({
      key,
      value: value.toString(),
    }));

    editFormData = {
      displayname: getLocalizedDisplayName(specification, $locale),
      product: content?.product_id || "",
      attributes: attributes,
      customAttributes:
        customAttributes.length > 0
          ? customAttributes
          : [{ key: "", value: "" }],
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

    if (!formData.product) {
      errorToastMessage("Please select a product");
      return;
    }

    const attributes = {};
    formData.customAttributes.forEach((attr) => {
      if (attr.key && attr.value) {
        attributes[attr.key] = attr.value;
      }
    });

    if (Object.keys(attributes).length === 0) {
      errorToastMessage("Please add at least one attribute");
      return;
    }

    try {
      const specificationData = {
        displayname: formData.displayname,
        body: {
          content: {
            name: formData.displayname,
            product_id: formData.product,
            attributes: attributes,
          },
          content_type: "json",
        },
        tags: [`product:${formData.product}`],
        is_active: true,
      };

      await createEntity(
        specificationData,
        "e_commerce",
        "/product_specifications",
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

    if (!formData.product) {
      errorToastMessage("Please select a product");
      return;
    }

    const attributes = {};
    formData.customAttributes.forEach((attr) => {
      if (attr.key && attr.value) {
        attributes[attr.key] = attr.value;
      }
    });

    if (Object.keys(attributes).length === 0) {
      errorToastMessage("Please add at least one attribute");
      return;
    }

    if (!selectedSpecification) return;

    try {
      const specificationData = {
        displayname: formData.displayname,
        content: {
          name: formData.displayname,
          product_id: formData.product,
          attributes: attributes,
        },
        content_type: "json",
        tags: [`product:${formData.product}`],
        is_active: true,
      };

      await updateEntity(
        selectedSpecification.shortname,
        "e_commerce",
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
        "e_commerce",
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

  // Helper functions now imported from utility modules

  const filteredSpecifications = $derived.by(() => {
    return filterSpecificationsByProduct(specifications, selectedProductFilter);
  });
</script>

<div class="specifications-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.product_specifications") ||
          "Product Specifications Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.specifications_description") ||
          "Manage product variations and specifications"}
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

  <div class="filters">
    <label for="product-filter"
      >{$_("common.filter_by_product") || "Filter by Product"}:</label
    >
    <select
      id="product-filter"
      bind:value={selectedProductFilter}
      class="filter-select"
    >
      <option value="all">{$_("common.all_products") || "All Products"}</option>
      {#each products as product}
        <option value={product.shortname}
          >{getLocalizedDisplayName(product, $locale)}</option
        >
      {/each}
    </select>
  </div>

  {#if isLoading}
    <LoadingSpinner message={$_("common.loading") || "Loading..."} />
  {:else if filteredSpecifications.length === 0}
    <EmptyState
      icon="📋"
      title={selectedProductFilter === "all"
        ? $_("admin_dashboard.no_specifications") || "No specifications found"
        : $_("admin_dashboard.no_specifications_for_product") ||
          "No specifications for this product"}
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
      {#each filteredSpecifications as specification}
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
          <div class="specification-product">
            <span class="product-label"
              >{$_("common.product") || "Product"}:</span
            >
            <span class="product-badge"
              >{getProductName(
                getSpecificationProduct(specification),
                products,
                $locale
              )}</span
            >
          </div>
          <div class="specification-attributes">
            <h4 class="attributes-title">
              {$_("common.attributes") || "Attributes"}:
            </h4>
            <div class="attributes-list">
              {#each Object.entries(getSpecificationAttributes(specification)) as [key, value]}
                <div class="attribute-item">
                  <span class="attribute-key">{key}:</span>
                  <span class="attribute-value">{value}</span>
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
  {products}
  {isLoadingProducts}
/>

<EditSpecificationModal
  bind:show={showEditModal}
  onClose={closeEditModal}
  onSubmit={handleUpdateSpecification}
  {products}
  {isLoadingProducts}
  specification={selectedSpecification}
  initialData={editFormData}
/>

<DeleteSpecificationModal
  bind:show={showDeleteModal}
  onClose={closeDeleteModal}
  onConfirm={handleDeleteSpecification}
  specification={selectedSpecification}
/>

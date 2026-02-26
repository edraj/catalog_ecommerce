<script lang="ts">
  import { onMount } from "svelte";
  import { ResourceType } from "@edraj/tsdmart";
  import CollectionForm from "@/components/forms/CollectionForm.svelte";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import {
    getSpaceContents,
    createCollection,
    updateCollection,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { website } from "@/config";
  import "./collections.css";
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
  let showDetailsModal = $state(false);
  let selectedCollectionDetails = $state(null);
  let isDeleting = $state(false);
  let searchTerm = $state("");
  let selectedCategoryFilter = $state("all");
  let selectedBrandFilter = $state("all");
  let categoriesByShortname: Record<string, any> = $state({});
  let brandsByShortname: Record<string, any> = $state({});
  let categoryOptions: Array<{ shortname: string; label: string }> = $state([]);
  let brandOptions: Array<{ shortname: string; label: string }> = $state([]);
  let collectionCategoriesMap: Record<string, string[]> = $state({});
  let collectionBrandsMap: Record<string, string[]> = $state({});
  let isLoadingFilterData = $state(false);
  let filterDataCacheKey = $state("");

  const filteredCollections = $derived.by(() => {
    return collections.filter((collection: any) => {
      const matchesCategory =
        selectedCategoryFilter === "all" ||
        (collectionCategoriesMap[collection.shortname] || []).includes(
          selectedCategoryFilter,
        );

      const matchesBrand =
        selectedBrandFilter === "all" ||
        (collectionBrandsMap[collection.shortname] || []).includes(
          selectedBrandFilter,
        );

      const searchableText = [
        collection.shortname,
        collection.attributes?.owner_shortname,
        collection.attributes?.displayname?.en,
        collection.attributes?.displayname?.ar,
        collection.attributes?.description?.en,
        collection.attributes?.description?.ar,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm.trim() ||
        searchableText.includes(searchTerm.trim().toLowerCase());

      return matchesCategory && matchesBrand && matchesSearch;
    });
  });

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
        true,
      );

      if (response && response.records) {
        collections = response.records;
        await loadCollectionCategoryFilterData(collections);
        successToastMessage(
          $_("collections.loaded", { values: { count: collections.length } }),
        );
      }
    } catch (error) {
      console.error("Failed to load collections:", error);
      errorToastMessage($_("collections.loadFailed"));
    } finally {
      isLoading = false;
    }
  }

  async function fetchSpaceContentsOnce(
    subpath: string,
    searchQuery = "",
    limit = 200,
  ): Promise<any[]> {
    const response: any = await getSpaceContents(
      website.main_space,
      subpath,
      "managed",
      limit,
      0,
      true,
      undefined,
      searchQuery,
    );

    return response?.records || [];
  }

  function chunkArray<T>(input: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < input.length; index += size) {
      chunks.push(input.slice(index, index + size));
    }
    return chunks;
  }

  async function fetchProductsByShortnames(
    productShortnames: string[],
  ): Promise<any[]> {
    const chunks = chunkArray(productShortnames, 20);
    const results: any[] = [];

    for (const chunk of chunks) {
      const productRecords = await Promise.all(
        chunk.map(async (shortname) => {
          const productMatches = await fetchSpaceContentsOnce(
            "/products",
            `@shortname:${shortname}`,
            1,
          );
          return productMatches[0] || null;
        }),
      );

      results.push(...productRecords.filter(Boolean));
    }

    return results;
  }

  function getLocalizedText(localizedValue: any): string {
    if (!localizedValue || typeof localizedValue !== "object") {
      return "";
    }

    return (
      localizedValue[$locale] || localizedValue.en || localizedValue.ar || ""
    );
  }

  function getCategoryLabel(categoryShortname: string): string {
    const category = categoriesByShortname[categoryShortname];
    const localizedName = getLocalizedText(category?.attributes?.displayname);
    return localizedName || categoryShortname;
  }

  function getBrandLabel(brandShortname: string): string {
    const brand = brandsByShortname[brandShortname];
    const localizedName = getLocalizedText(brand?.attributes?.displayname);
    return localizedName || brandShortname;
  }

  async function loadCollectionCategoryFilterData(collectionRecords: any[]) {
    if (isLoadingFilterData) {
      return;
    }

    const nextCacheKey = collectionRecords
      .map((collection: any) => collection?.shortname)
      .filter(Boolean)
      .sort()
      .join("|");

    if (nextCacheKey && nextCacheKey === filterDataCacheKey) {
      return;
    }

    isLoadingFilterData = true;
    try {
      const productShortnames = Array.from(
        new Set(
          collectionRecords.flatMap((collection: any) => {
            const items = collection.attributes?.payload?.body?.items || [];
            return items
              .map((item: any) => item?.product_shortname)
              .filter(Boolean);
          }),
        ),
      );

      if (productShortnames.length === 0) {
        categoriesByShortname = {};
        brandsByShortname = {};
        categoryOptions = [];
        brandOptions = [];
        collectionCategoriesMap = {};
        collectionBrandsMap = {};
        selectedCategoryFilter = "all";
        selectedBrandFilter = "all";
        filterDataCacheKey = nextCacheKey;
        return;
      }

      const [products, categories, brands] = await Promise.all([
        fetchProductsByShortnames(productShortnames),
        fetchSpaceContentsOnce("/categories"),
        fetchSpaceContentsOnce("/brands", "", 500),
      ]);

      const productsByShortname = new Map(
        products.map((product: any) => [product.shortname, product]),
      );

      const nextCategoriesByShortname: Record<string, any> = {};
      for (const category of categories) {
        nextCategoriesByShortname[category.shortname] = category;
      }

      const nextBrandsByShortname: Record<string, any> = {};
      for (const brand of brands) {
        nextBrandsByShortname[brand.shortname] = brand;
      }

      const allCollectionCategories = new Set<string>();
      const allCollectionBrands = new Set<string>();
      const nextCollectionCategoriesMap: Record<string, string[]> = {};
      const nextCollectionBrandsMap: Record<string, string[]> = {};

      for (const collection of collectionRecords) {
        const items = collection.attributes?.payload?.body?.items || [];
        const categoryShortnames = new Set<string>();
        const brandShortnames = new Set<string>();

        for (const item of items) {
          const productShortname = item?.product_shortname;
          if (!productShortname) continue;

          const product = productsByShortname.get(productShortname);
          if (!product) continue;

          const productBody = product.attributes?.payload?.body || {};
          const categoriesShortnames = productBody.categories_shortnames || [];
          const mainCategoryShortname = productBody.main_category_shortname;
          const brandShortname = productBody.brand_shortname;

          for (const categoryShortname of categoriesShortnames) {
            if (categoryShortname) {
              categoryShortnames.add(categoryShortname);
              allCollectionCategories.add(categoryShortname);
            }
          }

          if (mainCategoryShortname) {
            categoryShortnames.add(mainCategoryShortname);
            allCollectionCategories.add(mainCategoryShortname);
          }

          if (brandShortname) {
            brandShortnames.add(brandShortname);
            allCollectionBrands.add(brandShortname);
          }
        }

        nextCollectionCategoriesMap[collection.shortname] =
          Array.from(categoryShortnames);
        nextCollectionBrandsMap[collection.shortname] =
          Array.from(brandShortnames);
      }

      categoriesByShortname = nextCategoriesByShortname;
      brandsByShortname = nextBrandsByShortname;
      collectionCategoriesMap = nextCollectionCategoriesMap;
      collectionBrandsMap = nextCollectionBrandsMap;
      categoryOptions = Array.from(allCollectionCategories)
        .map((shortname) => ({
          shortname,
          label:
            getLocalizedText(
              nextCategoriesByShortname[shortname]?.attributes?.displayname,
            ) || shortname,
        }))
        .sort((first, second) =>
          first.label.localeCompare(second.label, undefined, {
            sensitivity: "base",
          }),
        );
      brandOptions = Array.from(allCollectionBrands)
        .map((shortname) => ({
          shortname,
          label:
            getLocalizedText(
              nextBrandsByShortname[shortname]?.attributes?.displayname,
            ) || shortname,
        }))
        .sort((first, second) =>
          first.label.localeCompare(second.label, undefined, {
            sensitivity: "base",
          }),
        );

      if (
        selectedCategoryFilter !== "all" &&
        !allCollectionCategories.has(selectedCategoryFilter)
      ) {
        selectedCategoryFilter = "all";
      }

      if (
        selectedBrandFilter !== "all" &&
        !allCollectionBrands.has(selectedBrandFilter)
      ) {
        selectedBrandFilter = "all";
      }

      filterDataCacheKey = nextCacheKey;
    } catch (error) {
      console.error("Failed to map collection categories:", error);
      categoriesByShortname = {};
      brandsByShortname = {};
      categoryOptions = [];
      brandOptions = [];
      collectionCategoriesMap = {};
      collectionBrandsMap = {};
      selectedCategoryFilter = "all";
      selectedBrandFilter = "all";
    } finally {
      isLoadingFilterData = false;
    }
  }

  function openCreateModal() {
    formData = {
      shortname: "",
      displayname: { en: "", ar: "" },
      description: { en: "", ar: "" },
      items: [],
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
      displayname: collection.attributes?.displayname || {
        en: "",
        ar: "",
      },
      description: collection.attributes?.description || {
        en: "",
        ar: "",
      },
      items: payloadBody.items || [],
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
      const payload = isEditing
        ? {
            ...formData,
            shortname: currentCollection?.shortname || formData.shortname,
          }
        : formData;

      const result = isEditing
        ? await updateCollection(website.main_space, payload)
        : await createCollection(website.main_space, payload);

      if (result) {
        successToastMessage(
          isEditing ? $_("collections.updated") : $_("collections.created"),
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

  function openDetailsModal(collection: any) {
    selectedCollectionDetails = collection;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    selectedCollectionDetails = null;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    collectionToDelete = null;
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  }

  function getItemMessage(item: any): string {
    const message = item?.message;
    if (!message || typeof message !== "object") return "-";
    return message[$locale] || message.en || message.ar || "-";
  }

  async function deleteCollection() {
    if (!collectionToDelete) return;

    isDeleting = true;
    try {
      await deleteEntity(
        collectionToDelete.shortname,
        website.main_space,
        "/settings/collections",
        ResourceType.content,
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
</script>

<div class="collections-page">
  <div class="page-header">
    <h1 class="page-title">{$_("collections.title")}</h1>
    <button class="btn btn-primary" onclick={openCreateModal}>
      {$_("collections.createNew")}
    </button>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>{$_("common.loading")}</p>
    </div>
  {:else}
    <div class="filter-bar">
      <input
        type="text"
        class="collection-search-input"
        bind:value={searchTerm}
        placeholder={$_("collections.searchPlaceholder")}
      />

      <label class="filter-label" for="category-filter">
        {$_("collections.filterByCategory")}
      </label>
      <select
        id="category-filter"
        class="category-filter-select"
        bind:value={selectedCategoryFilter}
      >
        <option value="all">{$_("collections.allCategories")}</option>
        {#each categoryOptions as category}
          <option value={category.shortname}>{category.label}</option>
        {/each}
      </select>

      <label class="filter-label" for="brand-filter">
        {$_("collections.filterByBrand")}
      </label>
      <select
        id="brand-filter"
        class="category-filter-select"
        bind:value={selectedBrandFilter}
      >
        <option value="all">{$_("collections.allBrands")}</option>
        {#each brandOptions as brand}
          <option value={brand.shortname}
            >{getBrandLabel(brand.shortname)}</option
          >
        {/each}
      </select>
    </div>

    <div class="collections-grid">
      {#each filteredCollections as collection}
        <div class="collection-card">
          <div class="collection-header">
            <h3 class="collection-name">
              {getLocalizedText(collection.attributes?.displayname) ||
                collection.shortname}
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
          </div>

          {#if getLocalizedText(collection.attributes?.description)}
            <p class="collection-description">
              {getLocalizedText(collection.attributes?.description)}
            </p>
          {/if}

          <div class="collection-info">
            <div class="info-item">
              <span class="info-label">{$_("collections.itemsCount")}:</span>
              <span class="info-value">
                {collection.attributes?.payload?.body?.items?.length || 0}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label"
                >{$_("collections.categoriesCount")}:</span
              >
              <span class="info-value">
                {collectionCategoriesMap[collection.shortname]?.length || 0}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{$_("collections.brandsCount")}:</span>
              <span class="info-value">
                {collectionBrandsMap[collection.shortname]?.length || 0}
              </span>
            </div>
            {#if (collectionCategoriesMap[collection.shortname]?.length || 0) > 0}
              <div class="collection-categories">
                {#each collectionCategoriesMap[collection.shortname] as categoryShortname}
                  <span class="category-chip" title={categoryShortname}>
                    {getCategoryLabel(categoryShortname)}
                  </span>
                {/each}
              </div>
            {/if}
          </div>

          <div class="collection-actions">
            <button
              class="btn btn-sm btn-secondary"
              onclick={() => openDetailsModal(collection)}
            >
              {$_("common.view")}
            </button>
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
          <p>
            {selectedCategoryFilter === "all" && selectedBrandFilter === "all"
              ? $_("collections.noCollections")
              : $_("collections.noCollectionsForFilters")}
          </p>
          <button class="btn btn-primary" onclick={openCreateModal}>
            {$_("collections.createFirst")}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showDetailsModal && selectedCollectionDetails}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={closeDetailsModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("collections.detailsTitle")}</h2>
        <button class="modal-close" onclick={closeDetailsModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">{$_("common.shortname")}</span>
            <span class="detail-value"
              >{selectedCollectionDetails.shortname}</span
            >
          </div>
          <div class="detail-item">
            <span class="detail-label">{$_("common.status")}</span>
            <span class="detail-value">
              {selectedCollectionDetails.attributes?.is_active
                ? $_("common.active")
                : $_("common.inactive")}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{$_("common.owner")}</span>
            <span class="detail-value">
              {selectedCollectionDetails.attributes?.owner_shortname || "-"}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{$_("common.created_at")}</span>
            <span class="detail-value">
              {formatDate(selectedCollectionDetails.attributes?.created_at)}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{$_("common.updated_at")}</span>
            <span class="detail-value">
              {formatDate(selectedCollectionDetails.attributes?.updated_at)}
            </span>
          </div>
        </div>

        <div class="detail-block">
          <h3>{$_("collection.basicInfo")}</h3>
          <p>
            <strong>{$_("collection.titleEn")}:</strong>
            {selectedCollectionDetails.attributes?.displayname?.en || "-"}
          </p>
          <p>
            <strong>{$_("collection.titleAr")}:</strong>
            {selectedCollectionDetails.attributes?.displayname?.ar || "-"}
          </p>
          <p>
            <strong>{$_("collection.descriptionEn")}:</strong>
            {selectedCollectionDetails.attributes?.description?.en || "-"}
          </p>
          <p>
            <strong>{$_("collection.descriptionAr")}:</strong>
            {selectedCollectionDetails.attributes?.description?.ar || "-"}
          </p>
        </div>

        <div class="detail-block">
          <h3>
            {$_("collection.items")} ({selectedCollectionDetails.attributes
              ?.payload?.body?.items?.length || 0})
          </h3>

          {#if (selectedCollectionDetails.attributes?.payload?.body?.items?.length || 0) > 0}
            <div class="details-items-list">
              {#each selectedCollectionDetails.attributes?.payload?.body?.items || [] as item, index}
                <div class="details-item-card">
                  <div class="details-item-header">
                    <span>#{index + 1}</span>
                    <span>{item?.variant_key || "-"}</span>
                  </div>
                  <div class="details-item-body">
                    <p>
                      <strong>{$_("collections.productShortname")}:</strong>
                      {item?.product_shortname || "-"}
                    </p>
                    <p>
                      <strong
                        >{$_("collections.availableProductShortname")}:</strong
                      >
                      {item?.available_product_shortname || "-"}
                    </p>
                    <p>
                      <strong>{$_("collections.itemMessage")}:</strong>
                      {getItemMessage(item)}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-message">{$_("collection.noItemsYet")}</p>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={closeDetailsModal}>
          {$_("common.close")}
        </button>
      </div>
    </div>
  </div>
{/if}

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
        <CollectionForm bind:formData bind:validateFn {isEditing} />
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

<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { params } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import "./index.css";
  import {
    attachAttachmentsToEntity,
    createEntity,
    deleteEntity,
    getSpaceContents,
    updateEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { website, defaultPageSize } from "@/config";
  import { formatNumber } from "@/lib/helpers";
  import { Dmart, ResourceType } from "@edraj/tsdmart";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  type BrandForm = {
    shortname: string;
    displayname_en: string;
    displayname_ar: string;
    displayname_ku: string;
    description_en: string;
    description_ar: string;
    description_ku: string;
    meta_description: string;
    top: boolean;
    boost_value: number;
  };

  let spaceName = $state(website.main_space);

  let brands = $state<any[]>([]);
  let isLoading = $state(false);

  let searchTerm = $state("");
  let topFilter = $state<"all" | "top" | "regular">("all");
  let statusFilter = $state<"all" | "active" | "inactive">("all");

  const itemsPerPage = defaultPageSize;
  let currentPage = $state(1);
  let totalItems = $state(0);

  let totalBrands = $state(0);
  let topBrands = $state(0);
  let regularBrands = $state(0);

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);

  let isCreating = $state(false);
  let isUpdating = $state(false);
  let isDeleting = $state(false);

  let selectedBrand = $state<any | null>(null);

  let createForm = $state<BrandForm>({
    shortname: "",
    displayname_en: "",
    displayname_ar: "",
    displayname_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    meta_description: "",
    top: false,
    boost_value: 0,
  });

  let editForm = $state<BrandForm>({
    shortname: "",
    displayname_en: "",
    displayname_ar: "",
    displayname_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    meta_description: "",
    top: false,
    boost_value: 0,
  });

  let createImage = $state<File | null>(null);
  let editImage = $state<File | null>(null);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(totalItems / itemsPerPage)),
  );
  const showingCount = $derived.by(() => brands.length);

  onMount(async () => {
    spaceName = $params?.space_name || website.main_space;
    await Promise.all([loadBrands(), loadStats()]);
  });

  onDestroy(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
  });

  function buildSearchQuery(): string {
    const parts: string[] = [];

    if (searchTerm.trim()) {
      parts.push(searchTerm.trim());
    }

    if (topFilter === "top") {
      parts.push("@payload.body.top:true");
    } else if (topFilter === "regular") {
      parts.push("-@payload.body.top:true");
    }

    if (statusFilter === "active") {
      parts.push("@is_active:true");
    } else if (statusFilter === "inactive") {
      parts.push("@is_active:false");
    }

    return parts.join(" ").trim();
  }

  async function loadBrands() {
    isLoading = true;
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getSpaceContents(
        spaceName,
        "brands",
        "managed",
        itemsPerPage,
        offset,
        true,
        undefined,
        buildSearchQuery(),
      );

      brands = response?.records || [];
      totalItems = response?.attributes?.total || 0;
    } catch (error) {
      console.error("Error loading brands:", error);
      brands = [];
      totalItems = 0;
      errorToastMessage($_("common.error") || "Failed to load brands");
    } finally {
      isLoading = false;
    }
  }

  async function loadStats() {
    try {
      const [allResponse, topResponse] = await Promise.all([
        getSpaceContents(spaceName, "brands", "managed", 1, 0, true),
        getSpaceContents(
          spaceName,
          "brands",
          "managed",
          1,
          0,
          true,
          undefined,
          "@payload.body.top:true",
        ),
      ]);

      totalBrands = allResponse?.attributes?.total || 0;
      topBrands = topResponse?.attributes?.total || 0;
      regularBrands = Math.max(totalBrands - topBrands, 0);
    } catch (error) {
      console.error("Error loading brand stats:", error);
    }
  }

  function onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    searchTerm = input.value;

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(async () => {
      currentPage = 1;
      await loadBrands();
    }, 350);
  }

  async function applyFilters() {
    currentPage = 1;
    await loadBrands();
  }

  async function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    await loadBrands();
  }

  function getBrandDisplayName(item: any): string {
    const displayname = item?.attributes?.displayname || {};
    return (
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku ||
      item?.shortname ||
      "-"
    );
  }

  function isTopBrand(item: any): boolean {
    return item?.attributes?.payload?.body?.top === true;
  }

  function getBoostValue(item: any): number {
    return Number(item?.attributes?.payload?.body?.boost_value || 0);
  }

  function formatDate(value?: string): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString($locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getBrandImageUrl(item: any): string | null {
    const media = item?.attachments?.media;
    if (!media || media.length === 0) return null;

    const firstImage = media[0];
    const fileName = firstImage?.attributes?.payload?.body;
    if (!fileName) return null;

    try {
      return Dmart.getAttachmentUrl(
        {
          resource_type: ResourceType.media,
          space_name: spaceName,
          subpath: `${item.subpath}/`,
          parent_shortname: item.shortname,
          shortname: fileName,
          ext: null,
        },
        "public",
      );
    } catch (error) {
      console.error("Error building brand image url:", error);
      return null;
    }
  }

  function resetCreateForm() {
    createForm = {
      shortname: "",
      displayname_en: "",
      displayname_ar: "",
      displayname_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      meta_description: "",
      top: false,
      boost_value: 0,
    };
    createImage = null;
  }

  function resetEditForm() {
    editForm = {
      shortname: "",
      displayname_en: "",
      displayname_ar: "",
      displayname_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      meta_description: "",
      top: false,
      boost_value: 0,
    };
    editImage = null;
  }

  function onCreateImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      createImage = null;
      return;
    }

    if (!file.type.startsWith("image/")) {
      errorToastMessage("Only image files are allowed");
      input.value = "";
      createImage = null;
      return;
    }

    createImage = file;
  }

  function onEditImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      editImage = null;
      return;
    }

    if (!file.type.startsWith("image/")) {
      errorToastMessage("Only image files are allowed");
      input.value = "";
      editImage = null;
      return;
    }

    editImage = file;
  }

  function openCreateModal() {
    resetCreateForm();
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    resetCreateForm();
  }

  function openEditModal(brand: any) {
    selectedBrand = brand;

    const displayname = brand?.attributes?.displayname || {};
    const description = brand?.attributes?.description || {};
    const body = brand?.attributes?.payload?.body || {};

    editForm = {
      shortname: brand.shortname || "",
      displayname_en: displayname.en || "",
      displayname_ar: displayname.ar || "",
      displayname_ku: displayname.ku || "",
      description_en: description.en || "",
      description_ar: description.ar || "",
      description_ku: description.ku || "",
      meta_description: body.meta_description || "",
      top: body.top === true,
      boost_value: Number(body.boost_value || 0),
    };

    editImage = null;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedBrand = null;
    resetEditForm();
  }

  function openDeleteModal(brand: any) {
    selectedBrand = brand;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedBrand = null;
  }

  async function removeExistingBrandImages(brand: any) {
    const media = brand?.attachments?.media || [];
    if (media.length === 0) return;

    await Promise.all(
      media.map((image: any) =>
        deleteEntity(
          image.shortname,
          spaceName,
          `/brands/${brand.shortname}`,
          image.resource_type || ResourceType.media,
        ),
      ),
    );
  }

  async function handleCreateBrand() {
    isCreating = true;
    try {
      const payloadData = {
        displayname_en: createForm.displayname_en,
        displayname_ar: createForm.displayname_ar,
        displayname_ku: createForm.displayname_ku,
        description_en: createForm.description_en,
        description_ar: createForm.description_ar,
        description_ku: createForm.description_ku,
        body: {
          top: createForm.top,
          meta_description: createForm.meta_description,
          boost_value: Number(createForm.boost_value || 0),
        },
        tags: [],
        is_active: true,
      };

      const createdShortname = await createEntity(
        {
          ...payloadData,
        },
        spaceName,
        "/brands",
        ResourceType.content,
        "",
        "",
      );

      if (!createdShortname) {
        throw new Error("Brand creation failed");
      }

      if (createImage) {
        const uploadResult = await attachAttachmentsToEntity(
          createdShortname,
          spaceName,
          "/brands",
          createImage,
        );

        if (!uploadResult) {
          errorToastMessage(
            "Brand created, but image upload failed. You can upload it later.",
          );
        }
      }

      successToastMessage("Brand created successfully");
      closeCreateModal();
      currentPage = 1;
      await Promise.all([loadBrands(), loadStats()]);
    } catch (error) {
      console.error("Error creating brand:", error);
      errorToastMessage("Failed to create brand");
    } finally {
      isCreating = false;
    }
  }

  async function handleUpdateBrand() {
    if (!selectedBrand) return;

    isUpdating = true;
    try {
      const data = {
        displayname_en: editForm.displayname_en,
        displayname_ar: editForm.displayname_ar,
        displayname_ku: editForm.displayname_ku,
        description_en: editForm.description_en,
        description_ar: editForm.description_ar,
        description_ku: editForm.description_ku,
        content_type: "json",
        body: {
          top: editForm.top,
          meta_description: editForm.meta_description,
          boost_value: Number(editForm.boost_value || 0),
        },
        tags: selectedBrand.attributes?.tags || [],
        is_active: selectedBrand.attributes?.is_active ?? true,
      };

      await updateEntity(
        selectedBrand.shortname,
        spaceName,
        selectedBrand.subpath,
        selectedBrand.resource_type,
        data,
        "",
        "",
      );

      if (editImage) {
        await removeExistingBrandImages(selectedBrand);
        const uploadResult = await attachAttachmentsToEntity(
          selectedBrand.shortname,
          spaceName,
          "/brands",
          editImage,
        );

        if (!uploadResult) {
          errorToastMessage(
            "Brand updated, but image upload failed. You can retry from edit.",
          );
        }
      }

      successToastMessage("Brand updated successfully");
      closeEditModal();
      await Promise.all([loadBrands(), loadStats()]);
    } catch (error) {
      console.error("Error updating brand:", error);
      errorToastMessage("Failed to update brand");
    } finally {
      isUpdating = false;
    }
  }

  async function handleDeleteBrand() {
    if (!selectedBrand) return;

    isDeleting = true;
    try {
      await deleteEntity(
        selectedBrand.shortname,
        spaceName,
        selectedBrand.subpath,
        selectedBrand.resource_type,
      );

      successToastMessage("Brand deleted successfully");
      closeDeleteModal();

      if (brands.length === 1 && currentPage > 1) {
        currentPage -= 1;
      }

      await Promise.all([loadBrands(), loadStats()]);
    } catch (error) {
      console.error("Error deleting brand:", error);
      errorToastMessage("Failed to delete brand");
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="brands-page" class:rtl={$isRTL}>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18.4612 7.5C18.4611 7.5 18.4612 7.5 18.4612 7.5V7.5ZM18.4744 7.50001L27.0568 7.51047C27.0578 7.51048 27.0588 7.51049 27.0598 7.5105C27.4433 7.51362 27.8101 7.66835 28.0799 7.94096C28.3505 8.21429 28.5016 8.58379 28.5 8.96838L28.5 17.2208C28.4868 17.2332 28.4738 17.2458 28.461 17.2587L17.328 28.483L7.50172 18.57L18.4744 7.50001ZM18.4688 4.50001C18.4684 4.50001 18.4692 4.50001 18.4688 4.50001L27.0751 4.51051C28.2543 4.51769 29.3824 4.99241 30.212 5.83046C31.0409 6.66778 31.504 7.79948 31.5 8.97757C31.5 8.97859 31.5 8.97961 31.5 8.98063L30 8.9745H31.5V8.97757V17.2243C31.5 17.6346 31.4156 18.0407 31.2521 18.417C31.093 18.7829 30.8624 19.1131 30.574 19.3884L30.591 19.3713L29.526 18.315L30.5491 19.4119C30.5575 19.4041 30.5658 19.3963 30.574 19.3884L19.4336 30.6201L18.3676 29.5652L19.4325 30.6213C19.1575 30.8989 18.8303 31.1193 18.4698 31.2699C18.1087 31.4207 17.7214 31.4985 17.3301 31.4987C16.9389 31.499 16.5514 31.4218 16.1902 31.2715C15.8289 31.1212 15.501 30.9009 15.2254 30.6232L5.36657 20.6774L6.43048 19.62L5.36517 20.676C4.80937 20.116 4.49744 19.359 4.49744 18.57C4.49744 17.7807 4.80962 17.0234 5.36584 16.4633L16.3644 5.36719C16.6409 5.09132 16.9691 4.87273 17.3302 4.72392C17.6909 4.57526 18.0786 4.49918 18.4688 4.50001ZM21.8745 12.6672C21.8745 11.8388 22.5461 11.1672 23.3745 11.1672H23.3895C24.2179 11.1672 24.8895 11.8388 24.8895 12.6672C24.8895 13.4957 24.2179 14.1672 23.3895 14.1672H23.3745C22.5461 14.1672 21.8745 13.4957 21.8745 12.6672Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.total") || "Total Brands"}</h3>
        <p class="stat-value">
          {formatNumber(totalBrands, $locale)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.top_brands") || "Top Brands"}</h3>
        <p class="stat-value">
          {formatNumber(topBrands, $locale)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.regular") || "Regular Brands"}</h3>
        <p class="stat-value">
          {formatNumber(regularBrands, $locale)}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.1715 18H4.8285L7.53572 5.6746ZM4.5 19.5H31.5V24C31.5 25.933 29.933 27.5 28 27.5H8C6.067 27.5 4.5 25.933 4.5 24V19.5ZM10 21.25C10.6904 21.25 11.25 21.8096 11.25 22.5C11.25 23.1904 10.6904 23.75 10 23.75C9.30964 23.75 8.75 23.1904 8.75 22.5C8.75 21.8096 9.30964 21.25 10 21.25Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.showing") || "Showing"}</h3>
        <p class="stat-value">
          {formatNumber(showingCount, $locale)}
        </p>
      </div>
    </div>
  </div>

  <div class="search-and-filters">
    <div class="search-bar">
      <input
        type="text"
        id="brands-search"
        value={searchTerm}
        oninput={onSearchInput}
        placeholder="Search brands..."
        class="search-input"
      />
    </div>

    <div class="filters">
      <select
        id="brands-top-filter"
        bind:value={topFilter}
        onchange={applyFilters}
        class="filter-select"
      >
        <option value="all">All Brands</option>
        <option value="top">Top</option>
        <option value="regular">Regular</option>
      </select>

      <select
        id="brands-status-filter"
        bind:value={statusFilter}
        onchange={applyFilters}
        class="filter-select"
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>

    <div>
      <button type="button" class="btn-create" onclick={openCreateModal}>
        + Create Brand
      </button>
    </div>
  </div>

  <div class="brands-table-container">
    <table class="brands-table">
      <thead>
        <tr>
          <th>Image</th>
          <th>Shortname</th>
          <th>Display Name</th>
          <th>Top</th>
          <th>Boost</th>
          <th>Status</th>
          <th>Owner</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if isLoading}
          <tr>
            <td colspan="9" class="loading-state" style="padding: 40px 0;">
              <div class="loading-spinner"></div>
              <p>Loading brands...</p>
            </td>
          </tr>
        {:else if brands.length === 0}
          <tr>
            <td colspan="9" class="empty-state" style="padding: 40px 0;">
              <p>No brands found.</p>
            </td>
          </tr>
        {:else}
          {#each brands as brand}
            <tr class="brand-row">
              <td>
                {#if getBrandImageUrl(brand)}
                  <img
                    src={getBrandImageUrl(brand)}
                    alt={brand.shortname}
                    style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;"
                  />
                {:else}
                  <div class="brand-icon">N/A</div>
                {/if}
              </td>
              <td class="brand-shortname">{brand.shortname}</td>
              <td class="brand-name">{getBrandDisplayName(brand)}</td>
              <td>{isTopBrand(brand) ? "Yes" : "No"}</td>
              <td>
                <span class="boost-value">{getBoostValue(brand)}</span>
              </td>
              <td>
                <span
                  class="status-badge"
                  class:top={isTopBrand(brand)}
                  class:regular={!isTopBrand(brand)}
                >
                  {brand.attributes?.is_active === false
                    ? "Inactive"
                    : "Active"}
                </span>
              </td>
              <td class="date-text"
                >{brand.attributes?.owner_shortname || "-"}</td
              >
              <td class="date-text"
                >{formatDate(brand.attributes?.updated_at)}</td
              >
              <td>
                <div class="actions-group">
                  <button
                    type="button"
                    class="action-button edit"
                    onclick={() => openEditModal(brand)}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    class="action-button delete"
                    onclick={() => openDeleteModal(brand)}
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>

    <div class="pagination">
      <div class="pagination-info">
        <span class="pagination-info__label"
          >Page {currentPage} of {totalPages} •</span
        >
        <span class="pagination-info__strong"
          >{formatNumber(totalItems, $locale)} total results</span
        >
      </div>

      <div class="pagination-controls">
        <button
          type="button"
          class="pager-arrow pager-arrow--left"
          disabled={currentPage <= 1 || isLoading}
          onclick={() => goToPage(currentPage - 1)}
          title="Previous page"
        >
          ‹
        </button>
        <div class="pagination-pages">
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
            {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
              <button
                type="button"
                class="page-chip"
                class:active={page === currentPage}
                onclick={() => goToPage(page)}
              >
                {page}
              </button>
            {:else if page === 2 && currentPage > 3}
              <span class="page-ellipsis">...</span>
            {:else if page === totalPages - 1 && currentPage < totalPages - 2}
              <span class="page-ellipsis">...</span>
            {/if}
          {/each}
        </div>
        <button
          type="button"
          class="pager-arrow pager-arrow--right"
          disabled={currentPage >= totalPages || isLoading}
          onclick={() => goToPage(currentPage + 1)}
          title="Next page"
        >
          ›
        </button>
      </div>
    </div>
  </div>
</div>

{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Create Brand</h3>
        <button
          type="button"
          class="modal-close"
          onclick={closeCreateModal}
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h4 class="section-title">Brand Information</h4>

          <div class="form-group">
            <label for="create-brand-display-en" class="form-label"
              >Display Name (EN) <span class="required">*</span></label
            >
            <input
              id="create-brand-display-en"
              type="text"
              bind:value={createForm.displayname_en}
              class="form-input"
              placeholder="Enter English display name"
            />
          </div>

          <div class="form-group">
            <label for="create-brand-display-ar" class="form-label"
              >Display Name (AR)</label
            >
            <input
              id="create-brand-display-ar"
              type="text"
              bind:value={createForm.displayname_ar}
              class="form-input"
              placeholder="Enter Arabic display name"
            />
          </div>

          <div class="form-group">
            <label for="create-brand-display-ku" class="form-label"
              >Display Name (KU)</label
            >
            <input
              id="create-brand-display-ku"
              type="text"
              bind:value={createForm.displayname_ku}
              class="form-input"
              placeholder="Enter Kurdish display name"
            />
          </div>

          <div class="form-group">
            <label for="create-brand-image" class="form-label">Brand Logo</label
            >
            <input
              id="create-brand-image"
              type="file"
              accept="image/*"
              oninput={onCreateImageChange}
              class="form-input"
            />
            {#if createImage}
              <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                Selected: {createImage.name}
              </p>
            {/if}
          </div>
        </div>

        <div class="form-section">
          <h4 class="section-title">Description & Meta</h4>

          <div class="form-group">
            <label for="create-brand-description-en" class="form-label"
              >Description (EN)</label
            >
            <input
              id="create-brand-description-en"
              type="text"
              bind:value={createForm.description_en}
              class="form-input"
              placeholder="Enter English description"
            />
          </div>

          <div class="form-group">
            <label for="create-brand-description-ar" class="form-label"
              >Description (AR)</label
            >
            <input
              id="create-brand-description-ar"
              type="text"
              bind:value={createForm.description_ar}
              class="form-input"
              placeholder="Enter Arabic description"
            />
          </div>

          <div class="form-group">
            <label for="create-brand-description-ku" class="form-label"
              >Description (KU)</label
            >
            <input
              id="create-brand-description-ku"
              type="text"
              bind:value={createForm.description_ku}
              class="form-input"
              placeholder="Enter Kurdish description"
            />
          </div>

          <div class="form-group">
            <label for="create-brand-meta-description" class="form-label"
              >Meta Description</label
            >
            <textarea
              id="create-brand-meta-description"
              bind:value={createForm.meta_description}
              class="form-textarea"
              placeholder="Enter meta description for SEO"
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h4 class="section-title">Settings</h4>

          <div style="display: flex; align-items: center; gap: 8px;">
            <input
              id="create-brand-top"
              type="checkbox"
              checked={createForm.top}
              onchange={(e) => {
                const target = e.target as HTMLInputElement;
                createForm.top = target.checked;
              }}
              class="form-checkbox"
            />
            <label
              for="create-brand-top"
              class="checkbox-label"
              style="margin: 0;">Mark as Top Brand</label
            >
          </div>

          <div class="form-group">
            <label for="create-brand-boost" class="form-label"
              >Boost Value</label
            >
            <input
              id="create-brand-boost"
              type="number"
              min="0"
              bind:value={createForm.boost_value}
              class="form-input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="button-secondary"
          onclick={closeCreateModal}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isCreating}
          class="button-primary"
          onclick={handleCreateBrand}
          style={isCreating ? "opacity: 0.6; cursor: not-allowed;" : ""}
        >
          {isCreating ? "Creating..." : "Create Brand"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showEditModal}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Edit Brand</h3>
        <button
          type="button"
          class="modal-close"
          onclick={closeEditModal}
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h4 class="section-title">Brand Information</h4>

          <div class="form-group">
            <label for="edit-brand-shortname" class="form-label"
              >Shortname (Read-only)</label
            >
            <input
              id="edit-brand-shortname"
              type="text"
              value={editForm.shortname}
              disabled
              class="form-input"
              style="background: #f3f4f6; color: #6b7280; cursor: not-allowed;"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-display-en" class="form-label"
              >Display Name (EN) <span class="required">*</span></label
            >
            <input
              id="edit-brand-display-en"
              type="text"
              bind:value={editForm.displayname_en}
              class="form-input"
              placeholder="Enter English display name"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-display-ar" class="form-label"
              >Display Name (AR)</label
            >
            <input
              id="edit-brand-display-ar"
              type="text"
              bind:value={editForm.displayname_ar}
              class="form-input"
              placeholder="Enter Arabic display name"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-display-ku" class="form-label"
              >Display Name (KU)</label
            >
            <input
              id="edit-brand-display-ku"
              type="text"
              bind:value={editForm.displayname_ku}
              class="form-input"
              placeholder="Enter Kurdish display name"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-image" class="form-label"
              >Replace Brand Logo</label
            >
            <input
              id="edit-brand-image"
              type="file"
              accept="image/*"
              oninput={onEditImageChange}
              class="form-input"
            />
            {#if editImage}
              <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                Selected: {editImage.name}
              </p>
            {/if}
          </div>
        </div>

        <div class="form-section">
          <h4 class="section-title">Description & Meta</h4>

          <div class="form-group">
            <label for="edit-brand-description-en" class="form-label"
              >Description (EN)</label
            >
            <input
              id="edit-brand-description-en"
              type="text"
              bind:value={editForm.description_en}
              class="form-input"
              placeholder="Enter English description"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-description-ar" class="form-label"
              >Description (AR)</label
            >
            <input
              id="edit-brand-description-ar"
              type="text"
              bind:value={editForm.description_ar}
              class="form-input"
              placeholder="Enter Arabic description"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-description-ku" class="form-label"
              >Description (KU)</label
            >
            <input
              id="edit-brand-description-ku"
              type="text"
              bind:value={editForm.description_ku}
              class="form-input"
              placeholder="Enter Kurdish description"
            />
          </div>

          <div class="form-group">
            <label for="edit-brand-meta-description" class="form-label"
              >Meta Description</label
            >
            <textarea
              id="edit-brand-meta-description"
              bind:value={editForm.meta_description}
              class="form-textarea"
              placeholder="Enter meta description for SEO"
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h4 class="section-title">Settings</h4>

          <div style="display: flex; align-items: center; gap: 8px;">
            <input
              id="edit-brand-top"
              type="checkbox"
              checked={editForm.top}
              onchange={(e) => {
                const target = e.target as HTMLInputElement;
                editForm.top = target.checked;
              }}
              class="form-checkbox"
            />
            <label
              for="edit-brand-top"
              class="checkbox-label"
              style="margin: 0;">Mark as Top Brand</label
            >
          </div>

          <div class="form-group">
            <label for="edit-brand-boost" class="form-label">Boost Value</label>
            <input
              id="edit-brand-boost"
              type="number"
              min="0"
              bind:value={editForm.boost_value}
              class="form-input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="button-secondary" onclick={closeEditModal}>
          Cancel
        </button>
        <button
          type="button"
          disabled={isUpdating}
          class="button-primary"
          onclick={handleUpdateBrand}
          style={isUpdating ? "opacity: 0.6; cursor: not-allowed;" : ""}
        >
          {isUpdating ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteModal}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div
      class="modal-content modal-content.small"
      style="max-width: 400px;"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 class="modal-title">Delete Brand</h3>
        <button
          type="button"
          class="modal-close"
          onclick={closeDeleteModal}
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <div class="delete-confirmation">
          <div class="delete-icon">⚠</div>
          <p class="delete-message">
            Are you sure you want to delete this brand?
          </p>
          <p class="delete-brand-name">{selectedBrand?.shortname}</p>
          <p class="delete-warning">This action cannot be undone.</p>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="button-secondary"
          onclick={closeDeleteModal}
          style="flex: 1;"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isDeleting}
          class="button-danger"
          onclick={handleDeleteBrand}
          style={`flex: 1; ${isDeleting ? "opacity: 0.6; cursor: not-allowed;" : ""}`}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

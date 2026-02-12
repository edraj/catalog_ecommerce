<script lang="ts">
  import { onMount } from "svelte";
  import "./index.css";
  import { goto } from "@roxi/routify";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { ResourceType } from "@edraj/tsdmart";
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
    SearchOutline,
  } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName, formatDate } from "@/lib/utils/adminUtils";
  import { formatNumber } from "@/lib/helpers";
  import { Pagination } from "@/components/ui";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let brands = $state([]);
  let filteredBrands = $state([]);
  let isLoading = $state(true);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedBrand = $state(null);
  let searchTerm = $state("");
  let topBrandsFilter = $state("all");
  let totalBrandsCount = $state(0);
  let allBrandsCache = $state([]);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let paginatedBrands = $derived.by(() => {
    if (searchTerm || topBrandsFilter !== "all") {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      return filteredBrands.slice(start, end);
    }
    return brands;
  });

  let totalPages = $derived.by(() => {
    if (searchTerm || topBrandsFilter !== "all") {
      return Math.ceil(filteredBrands.length / itemsPerPage);
    }
    return Math.ceil(totalBrandsCount / itemsPerPage);
  });

  let createForm = $state({
    displayname_en: "",
    displayname_ar: "",
    displayname_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    meta_title_en: "",
    meta_description_en: "",
    isTop: false,
    boost_value: 0,
    logo: null,
  });

  let editForm = $state({
    displayname_en: "",
    displayname_ar: "",
    displayname_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    meta_title_en: "",
    meta_description_en: "",
    isTop: false,
    boost_value: 0,
    logo: null,
  });

  onMount(async () => {
    await loadBrands();
  });

  async function loadBrands() {
    isLoading = true;
    const offset = (currentPage - 1) * itemsPerPage;

    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        itemsPerPage,
        offset,
        true,
      );

      if (response?.records) {
        brands = response.records;
        totalBrandsCount =
          response.attributes?.total || response.records.length;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
      errorToastMessage("Failed to load brands");
    } finally {
      isLoading = false;
    }
  }

  async function loadAllBrandsForFiltering() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        allBrandsCache = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading brands for filtering:", error);
      errorToastMessage("Failed to load brands");
    }
  }

  function applyFilters() {
    let result = [...allBrandsCache];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((brand) => {
        const displayname = getLocalizedDisplayName(
          brand,
          $locale,
        ).toLowerCase();
        const shortname = brand.shortname?.toLowerCase() || "";
        const description =
          brand.attributes?.description?.[$locale]?.toLowerCase() || "";
        return (
          displayname.includes(searchLower) ||
          shortname.includes(searchLower) ||
          description.includes(searchLower)
        );
      });
    }

    if (topBrandsFilter === "top") {
      result = result.filter(
        (brand) => brand.attributes?.payload?.body?.top === true,
      );
    } else if (topBrandsFilter === "regular") {
      result = result.filter(
        (brand) => brand.attributes?.payload?.body?.top !== true,
      );
    }

    filteredBrands = result;
    currentPage = 1;
  }

  function openCreateModal() {
    createForm = {
      displayname_en: "",
      displayname_ar: "",
      displayname_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      meta_title_en: "",
      meta_description_en: "",
      isTop: false,
      boost_value: 0,
      logo: null,
    };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(brand) {
    selectedBrand = brand;
    editForm = {
      displayname_en: brand.attributes?.displayname?.en || "",
      displayname_ar: brand.attributes?.displayname?.ar || "",
      displayname_ku: brand.attributes?.displayname?.ku || "",
      description_en: brand.attributes?.description?.en || "",
      description_ar: brand.attributes?.description?.ar || "",
      description_ku: brand.attributes?.description?.ku || "",
      meta_title_en: brand.attributes?.payload?.body?.meta_title?.en || "",
      meta_description_en:
        brand.attributes?.payload?.body?.meta_description?.en || "",
      isTop: brand.attributes?.payload?.body?.top === true,
      boost_value: brand.attributes?.payload?.body?.boost_value || 0,
      logo: null,
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedBrand = null;
  }

  function openDeleteModal(brand) {
    selectedBrand = brand;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedBrand = null;
  }

  async function handleCreateBrand() {
    if (!createForm.displayname_en.trim()) {
      errorToastMessage("Please enter a brand name in English");
      return;
    }

    try {
      const brandData = {
        displayname_en: createForm.displayname_en,
        displayname_ar: createForm.displayname_ar || createForm.displayname_en,
        displayname_ku: createForm.displayname_ku || null,

        description_en: createForm.description_en,
        description_ar: createForm.description_ar || createForm.description_en,
        description_ku: createForm.description_ku || null,
        body: {
          top: createForm.isTop,
          boost_value: createForm.boost_value,
          meta_title: createForm.meta_title_en,
          meta_description: createForm.meta_description_en,
        },
        tags: [],
        is_active: true,
      };

      if (!brandData.body.meta_title) delete brandData.body.meta_title;
      if (!brandData.body.meta_description)
        delete brandData.body.meta_description;

      await createEntity(
        brandData,
        website.main_space,
        "/brands",
        ResourceType.content,
        "",
        "",
      );

      successToastMessage("Brand created successfully!");
      closeCreateModal();
      await loadBrands();
    } catch (error) {
      console.error("Error creating brand:", error);
      errorToastMessage("Failed to create brand");
    }
  }

  async function handleUpdateBrand() {
    if (!editForm.displayname_en.trim()) {
      errorToastMessage("Please enter a brand name in English");
      return;
    }

    if (!selectedBrand) return;

    try {
      const brandData = {
        displayname: {
          en: editForm.displayname_en,
          ar: editForm.displayname_ar || editForm.displayname_en,
          ku: editForm.displayname_ku || null,
        },
        description: {
          en: editForm.description_en,
          ar: editForm.description_ar || editForm.description_en,
          ku: editForm.description_ku || null,
        },
        body: {
          top: editForm.isTop,
          boost_value: editForm.boost_value,
          meta_title: editForm.meta_title_en,
          meta_description: editForm.meta_description_en,
        },
        tags: selectedBrand.attributes?.tags || [],
        is_active: true,
      };

      if (!brandData.body.meta_title) delete brandData.body.meta_title;
      if (!brandData.body.meta_description)
        delete brandData.body.meta_description;

      await updateEntity(
        selectedBrand.shortname,
        website.main_space,
        selectedBrand.subpath,
        selectedBrand.resource_type,
        brandData,
        "",
        "",
      );

      successToastMessage("Brand updated successfully!");
      closeEditModal();
      await loadBrands();
    } catch (error) {
      console.error("Error updating brand:", error);
      errorToastMessage("Failed to update brand");
    }
  }

  async function handleDeleteBrand() {
    if (!selectedBrand) return;

    try {
      await deleteEntity(
        selectedBrand.shortname,
        website.main_space,
        selectedBrand.subpath,
        selectedBrand.resource_type,
      );

      successToastMessage("Brand deleted successfully!");
      closeDeleteModal();
      await loadBrands();
    } catch (error) {
      console.error("Error deleting brand:", error);
      errorToastMessage("Failed to delete brand");
    }
  }

  function handlePageChange(page: number) {
    currentPage = page;
    if (!searchTerm && topBrandsFilter === "all") {
      loadBrands();
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      if (!searchTerm && topBrandsFilter === "all") {
        loadBrands();
      }
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      if (!searchTerm && topBrandsFilter === "all") {
        loadBrands();
      }
    }
  }

  $effect(() => {
    if (searchTerm || topBrandsFilter !== "all") {
      if (allBrandsCache.length === 0) {
        loadAllBrandsForFiltering();
      } else {
        applyFilters();
      }
    } else {
      loadBrands();
    }
  });

  let isBrandOpen = $state(false);
  function getBrandFilter() {
    if (topBrandsFilter === "all") {
      return $_("brands.all_brands") || "All Brands";
    }

    if (topBrandsFilter === "top") {
      return $_("brands.top_brands") || "Top Brands";
    }

    if (topBrandsFilter === "regular") {
      return $_("brands.regular_brands") || "Regular Brands";
    }
  }
  let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(item.id ?? item.shortname ?? crypto.randomUUID());
  }

  function toggleActions(item: any) {
    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeActions() {
    openActionsFor = null;
  }

  function onWindowClick() {
    if (openActionsFor) closeActions();
  }

  function formatDateDMY(value?: string) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
</script>

<div class="brands-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
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
        <h3 class="stat-title">
          {$_("brands.total") || "Total Brands"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            searchTerm || topBrandsFilter !== "all"
              ? allBrandsCache.length
              : totalBrandsCount,
            $locale,
          )}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
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
        <h3 class="stat-title">
          {$_("brands.top_brands") || "Top Brands"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            (searchTerm || topBrandsFilter !== "all"
              ? allBrandsCache
              : brands
            ).filter((b) => b.attributes?.payload?.body?.top === true).length,
            $locale,
          )}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2ZM4.5 2.5V3.6665C4.5 3.77469 4.53509 3.87995 4.6 3.9665C4.61345 3.98444 4.62568 4.00326 4.63661 4.02284L5.42302 5.43199C5.5381 5.59873 5.6 5.79679 5.6 6C5.6 6.20321 5.5381 6.40127 5.42302 6.56801L4.63661 7.97716C4.62568 7.99674 4.61345 8.01556 4.6 8.0335C4.53509 8.12005 4.5 8.22532 4.5 8.3335V9.5H7.5V8.3335C7.5 8.22531 7.46491 8.12005 7.4 8.0335C7.38769 8.01709 7.37641 7.99994 7.3662 7.98214L6.55725 6.57077C6.44095 6.40346 6.37836 6.20433 6.37836 6C6.37836 5.79567 6.44095 5.59654 6.55725 5.42923L7.3662 4.01786C7.37641 4.00006 7.38769 3.98291 7.4 3.9665C7.46491 3.87995 7.5 3.77469 7.5 3.6665V2.5H4.5Z"
            fill="#1C398E"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("brands.regular") || "Regular Brands"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            (searchTerm || topBrandsFilter !== "all"
              ? allBrandsCache
              : brands
            ).filter((b) => b.attributes?.payload?.body?.top !== true).length,
            $locale,
          )}
        </p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("brands.showing") || "Showing"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            searchTerm || topBrandsFilter !== "all"
              ? filteredBrands.length
              : Math.min(
                  itemsPerPage,
                  totalBrandsCount - (currentPage - 1) * itemsPerPage,
                ),
            $locale,
          )}
        </p>
      </div>
    </div>
  </div>
  <!-- Content -->
    <div
      class="flex flex-col search-table_header md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
    >
      <!-- SEARCH -->
      <div>
        <div class="relative w-[256px]">
          <div
            class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
          >
            <svg
              class="w-4 h-4 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clip-rule="evenodd"
              />
            </svg>
          </div>

          <input
            type="text"
            bind:value={searchTerm}
            placeholder={$_("brands.search_placeholder") || "Search brands..."}
            class="w-full h-9 pl-9 pr-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm
               focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      <div class="flex items-end">
        <!-- CREATE BUTTON -->
        <button
          onclick={openCreateModal}
          class="inline-flex items-center justify-center mx-2
            h-9 cursor-pointer
           px-3 py-2
           bg-[#3C307F] text-white text-sm font-medium
           rounded-[12px]
           shadow-[0px_1px_0.5px_0.05px_#1D293D05]
           hover:bg-[#2f2666]
           transition-colors duration-200"
        >
          <PlusOutline size="sm" />
          <span class="ml-2">
            {$_("brands.create_brand") || "Create Brand"}
          </span>
        </button>

        <!-- BRAND FILTER DROPDOWN -->
        <div class="mx-2">
          <button
            onclick={() => (isBrandOpen = !isBrandOpen)}
            class="list-none cursor-pointer select-none
                h-9
               inline-flex items-center justify-between
               px-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm text-gray-700
               hover:bg-gray-50"
          >
            <span class="truncate">
              {getBrandFilter()}
            </span>
            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {#if isBrandOpen}
            <div
              class="absolute z-20 mt-2 w-[220px] max-h-[320px] overflow-y-scroll rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
            >
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                onclick={() => {
                  topBrandsFilter = "all";
                  isBrandOpen = false;
                }}
              >
                {$_("brands.all_brands") || "All Brands"}
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                onclick={() => {
                  topBrandsFilter = "top";
                  isBrandOpen = false;
                }}
              >
                {$_("brands.top_brands") || "Top Brands"}
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                onclick={() => {
                  topBrandsFilter = "regular";
                  isBrandOpen = false;
                }}
              >
                {$_("brands.regular_brands") || "Regular Brands"}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("brands.loading") || "Loading brands..."}</p>
    </div>
  {:else if paginatedBrands.length === 0 && !searchTerm && topBrandsFilter === "all"}
    <div class="empty-state">
      <div class="empty-icon">🏷️</div>
      <h3>{$_("brands.no_brands") || "No brands found"}</h3>
      <p>
        {$_("brands.no_brands_description") ||
          "Create your first brand to get started"}
      </p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span
          >{$_("brands.create_first_brand") || "Create Your First Brand"}</span
        >
      </button>
    </div>
  {:else}
   
    <div class="brands-table-container">
      <table class="brands-table">
        <thead>
          <tr>
            <th>{$_("brands.name") || "Brand Name"}</th>
            <th>{$_("brands.description") || "Description"}</th>
            <th>{$_("brands.status") || "Status"}</th>
            <th>{$_("brands.boost") || "Boost"}</th>
            <th>{$_("brands.created") || "Created"}</th>
            <th>{$_("brands.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
  {#each paginatedBrands as brand (brand.shortname)}
    <tr class="brand-row">
      <!-- Brand (avatar + name + description) -->
      <td>
        <div class="flex items-center gap-2.5" class:flex-row-reverse={$isRTL}>
          <div
            class="shrink-0 rounded-full flex items-center justify-center"
            style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
            aria-hidden="true"
          >
            <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
              {(getLocalizedDisplayName(brand, $locale) || "B").charAt(0).toUpperCase()}
            </span>
          </div>

          <div class="min-w-0">
            <div
              class="truncate"
              style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
              title={getLocalizedDisplayName(brand, $locale) || ""}
            >
              {getLocalizedDisplayName(brand, $locale)}
            </div>

            <div
              class="truncate mt-1"
              style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
              title={brand.attributes?.description?.[$locale] ||
                brand.attributes?.description?.en ||
                ""}
            >
              {brand.attributes?.description?.[$locale] ||
                brand.attributes?.description?.en ||
                "-"}
            </div>
          </div>
        </div>
      </td>

      <!-- Description column (keep as separate column, same content) -->
      <td>
        <p
          class="truncate"
          style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
          class:text-right={$isRTL}
          title={brand.attributes?.description?.[$locale] ||
            brand.attributes?.description?.en ||
            ""}
        >
          {brand.attributes?.description?.[$locale] ||
            brand.attributes?.description?.en ||
            "-"}
        </p>
      </td>

      <!-- Status pill (Top Brand / Regular) -->
      <td>
        {#if brand.attributes?.payload?.body?.top === true}
          <span
            class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
            style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
          >
            <!-- check icon (reuse active icon style) -->
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z" fill="#004F3B"/>
            </svg>

            <span style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;">
              {$_("brands.top") || "Top Brand"}
            </span>
          </span>
        {:else}
          <span
            class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
            style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
          >
            <!-- pending icon style -->
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M2.25 2C2.25 1.72386 2.47386 1.5 2.75 1.5H9.25C9.52614 1.5 9.75 1.72386 9.75 2C9.75 2.27614 9.52614 2.5 9.25 2.5H8.5V3.6665C8.5 3.97975 8.40194 4.28484 8.22003 4.53915L7.41216 5.94864C7.40196 5.96644 7.39067 5.98359 7.37836 6C7.39067 6.01641 7.40196 6.03356 7.41216 6.05136L8.22003 7.46084C8.40194 7.71516 8.5 8.02025 8.5 8.3335V9.5H9.25C9.52614 9.5 9.75 9.72386 9.75 10C9.75 10.2761 9.52614 10.5 9.25 10.5H2.75C2.47386 10.5 2.25 10.2761 2.25 10C2.25 9.72386 2.47386 9.5 2.75 9.5H3.5V8.3335C3.5 8.02131 3.5974 7.71722 3.77814 7.46342L4.56339 6.05634C4.57432 6.03676 4.58655 6.01794 4.6 6C4.58655 5.98206 4.57432 5.96324 4.56339 5.94366L3.77813 4.53658C3.5974 4.28278 3.5 3.97869 3.5 3.6665V2.5H2.75C2.47386 2.5 2.25 2.27614 2.25 2Z" fill="#1C398E"/>
            </svg>

            <span style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;">
              {$_("brands.regular") || "Regular"}
            </span>
          </span>
        {/if}
      </td>

      <!-- Boost -->
      <td>
        <span
          style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
        >
          {brand.attributes?.payload?.body?.boost_value || 0}
        </span>
      </td>

      <!-- Created (calendar + 15 Mar 2025) -->
      <td>
        <div
          class="inline-flex items-center gap-2"
          style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
          class:flex-row-reverse={$isRTL}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2Z" fill="#6A7282"/>
          </svg>

          <span>{formatDateDMY(brand.attributes?.created_at)}</span>
        </div>
      </td>

      <!-- Actions (... dropdown) -->
      <td>
        <div class="relative" onclick={(e) => e.stopPropagation()}>
          <button
            class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
            aria-label={$_("brands.actions") || "Actions"}
            aria-haspopup="menu"
            aria-expanded={openActionsFor === getRowId(brand)}
            onclick={() => toggleActions(brand)}
          >
            <span class="text-xl leading-none">…</span>
          </button>

          {#if openActionsFor === getRowId(brand)}
            <div
              class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
              style={$isRTL ? "right:-60px;" : "left:-60px;"}
              role="menu"
            >
              <button
                class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                class:text-right={$isRTL}
                onclick={() => {
                  closeActions();
                  openEditModal(brand);
                }}
                role="menuitem"
              >
                {$_("brands.edit") || $_("common.edit") || "Edit"}
              </button>

              <button
                class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                class:text-right={$isRTL}
                onclick={() => {
                  closeActions();
                  openDeleteModal(brand);
                }}
                role="menuitem"
              >
                {$_("brands.delete") || $_("common.delete") || "Delete"}
              </button>
            </div>
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
        <div class="pagination-info">
          {$_("common.page") || "Page"}
          {currentPage}
          {$_("common.of") || "of"}
          {totalPages}
        </div>
        <div class="pagination-pages">
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
            {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
              <button
                class="page-btn"
                class:active={page === currentPage}
                onclick={() => handlePageChange(page)}
              >
                {page}
              </button>
            {:else if page === currentPage - 2 || page === currentPage + 2}
              <span class="page-ellipsis">...</span>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={$isRTL}>
          {$_("brands.create_brand") || "Create Brand"}
        </h2>
        <button class="modal-close" onclick={closeCreateModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.basic_info") || "Basic Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_en") || "Brand Name (English)"}
              <span class="required">*</span>
            </label>
            <input
              type="text"
              bind:value={createForm.displayname_en}
              placeholder="e.g., Apple, Samsung"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_ar") || "Brand Name (Arabic)"}
            </label>
            <input
              type="text"
              bind:value={createForm.displayname_ar}
              placeholder="مثال: آبل، سامسونج"
              class="form-input rtl"
            />
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.descriptions") || "Descriptions"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_en") || "Description (English)"}
            </label>
            <textarea
              bind:value={createForm.description_en}
              rows="3"
              placeholder="Brief description of the brand..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_ar") || "Description (Arabic)"}
            </label>
            <textarea
              bind:value={createForm.description_ar}
              rows="3"
              placeholder="وصف مختصر للعلامة التجارية..."
              class="form-textarea rtl"
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.seo_info") || "SEO Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_title_en") || "Meta Title (English)"}
            </label>
            <input
              type="text"
              bind:value={createForm.meta_title_en}
              placeholder="SEO title for search engines..."
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_description_en") || "Meta Description (English)"}
            </label>
            <textarea
              bind:value={createForm.meta_description_en}
              rows="3"
              placeholder="SEO description for search engines..."
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            {$_("brands.boost_value") || "Boost Value"}
          </label>
          <input
            type="number"
            bind:value={createForm.boost_value}
            min="0"
            placeholder="0"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={createForm.isTop}
              class="form-checkbox"
            />
            <span class:rtl={$isRTL}>
              {$_("brands.mark_as_top") || "Mark as Top Brand"}
            </span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button-secondary" onclick={closeCreateModal}>
          {$_("brands.cancel") || "Cancel"}
        </button>
        <button class="button-primary" onclick={handleCreateBrand}>
          {$_("brands.create") || "Create Brand"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && selectedBrand}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={$isRTL}>
          {$_("brands.edit_brand") || "Edit Brand"}
        </h2>
        <button class="modal-close" onclick={closeEditModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.basic_info") || "Basic Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_en") || "Brand Name (English)"}
              <span class="required">*</span>
            </label>
            <input
              type="text"
              bind:value={editForm.displayname_en}
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.name_ar") || "Brand Name (Arabic)"}
            </label>
            <input
              type="text"
              bind:value={editForm.displayname_ar}
              class="form-input rtl"
            />
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.descriptions") || "Descriptions"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_en") || "Description (English)"}
            </label>
            <textarea
              bind:value={editForm.description_en}
              rows="3"
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.description_ar") || "Description (Arabic)"}
            </label>
            <textarea
              bind:value={editForm.description_ar}
              rows="3"
              class="form-textarea rtl"
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">
            {$_("brands.seo_info") || "SEO Information"}
          </h3>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_title_en") || "Meta Title (English)"}
            </label>
            <input
              type="text"
              bind:value={editForm.meta_title_en}
              placeholder="SEO title for search engines..."
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" class:rtl={$isRTL}>
              {$_("brands.meta_description_en") || "Meta Description (English)"}
            </label>
            <textarea
              bind:value={editForm.meta_description_en}
              rows="3"
              placeholder="SEO description for search engines..."
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" class:rtl={$isRTL}>
            {$_("brands.boost_value") || "Boost Value"}
          </label>
          <input
            type="number"
            bind:value={editForm.boost_value}
            min="0"
            placeholder="0"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              bind:checked={editForm.isTop}
              class="form-checkbox"
            />
            <span class:rtl={$isRTL}>
              {$_("brands.mark_as_top") || "Mark as Top Brand"}
            </span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button-secondary" onclick={closeEditModal}>
          {$_("brands.cancel") || "Cancel"}
        </button>
        <button class="button-primary" onclick={handleUpdateBrand}>
          {$_("brands.update") || "Update Brand"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && selectedBrand}
  <div class="modal-overlay" onclick={closeDeleteModal}>
    <div class="modal-content small" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" class:rtl={$isRTL}>
          {$_("brands.delete_brand") || "Delete Brand"}
        </h2>
        <button class="modal-close" onclick={closeDeleteModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="delete-confirmation">
          <div class="delete-icon">
            <TrashBinOutline />
          </div>
          <p class="delete-message" class:rtl={$isRTL}>
            {$_("brands.delete_confirmation") ||
              "Are you sure you want to delete this brand?"}
          </p>
          <p class="delete-brand-name" class:rtl={$isRTL}>
            <strong>{getLocalizedDisplayName(selectedBrand, $locale)}</strong>
          </p>
          <p class="delete-warning" class:rtl={$isRTL}>
            {$_("brands.delete_warning") || "This action cannot be undone."}
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button-secondary" onclick={closeDeleteModal}>
          {$_("brands.cancel") || "Cancel"}
        </button>
        <button class="button-danger" onclick={handleDeleteBrand}>
          {$_("brands.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

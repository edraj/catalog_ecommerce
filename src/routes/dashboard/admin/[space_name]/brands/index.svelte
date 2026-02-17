<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "./index.css";
  import { goto } from "@roxi/routify";

  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
    attachAttachmentsToEntity,
  } from "@/lib/dmart_services";

  import { ResourceType } from "@edraj/tsdmart";
  import BrandModal from "@/components/modals/BrandModal.svelte";

  import { errorToastMessage, successToastMessage } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { PlusOutline } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName } from "@/lib/utils/adminUtils";
  import { formatNumber } from "@/lib/helpers";
  import { website } from "@/config";

  $goto;

  // ----------------------------
  // RTL
  // ----------------------------
  const isRTL = derived(locale, ($locale) => $locale === "ar" || $locale === "ku");

  // ----------------------------
  // State
  // ----------------------------
  let brands = $state<any[]>([]);
  let isLoading = $state(true);

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);

  let selectedBrand = $state<any | null>(null);

  let searchTerm = $state("");
  let topBrandsFilter = $state<"all" | "top" | "regular">("all");

  // Server pagination (when NOT filtering)
  let totalBrandsCount = $state(0);
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  // Client cache for filtering mode
  let allBrandsCache = $state<any[]>([]);
  let filteredBrands = $state<any[]>([]);

  // Logo files (from modal)
  let createLogoFile = $state<File | null>(null);
  let editLogoFile = $state<File | null>(null);

  // Dropdowns
  let isBrandOpen = $state(false);
  let openActionsFor = $state<string | null>(null);

  const isFiltering = $derived.by(() => {
    return !!searchTerm.trim() || topBrandsFilter !== "all";
  });

  // ----------------------------
  // Derived: list to show + total pages
  // ----------------------------
  let paginatedBrands = $derived.by(() => {
    if (isFiltering) {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      return filteredBrands.slice(start, end);
    }
    return brands; // server already paginated
  });

  let totalPages = $derived.by(() => {
    const total = isFiltering ? filteredBrands.length : totalBrandsCount;
    return Math.max(1, Math.ceil(total / itemsPerPage));
  });

  // ----------------------------
  // Forms
  // ----------------------------
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
  });

  // ----------------------------
  // Helpers
  // ----------------------------
  function getRowId(item: any) {
    return String(item?.id ?? item?.shortname ?? crypto.randomUUID());
  }

  function toggleActions(item: any) {
    const id = getRowId(item);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeActions() {
    openActionsFor = null;
  }

  function closeBrandDropdown() {
    isBrandOpen = false;
  }

  function onWindowClick() {
    // close any open popovers when clicking outside
    if (isBrandOpen) isBrandOpen = false;
    if (openActionsFor) openActionsFor = null;
  }

  function stop(e: Event) {
    e.stopPropagation();
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

  function getBrandFilterLabel() {
    if (topBrandsFilter === "all") return $_("brands.all_brands") || "All Brands";
    if (topBrandsFilter === "top") return $_("brands.top_brands") || "Top Brands";
    return $_("brands.regular_brands") || "Regular Brands";
  }

  // ----------------------------
  // Data loading
  // ----------------------------
  async function loadBrandsServerPage() {
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
        totalBrandsCount = response.attributes?.total || response.records.length;
      } else {
        brands = [];
        totalBrandsCount = 0;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
      errorToastMessage("Failed to load brands");
    } finally {
      isLoading = false;
    }
  }

  async function loadAllBrandsForFiltering() {
    // Only needed once (or after create/update/delete if you want)
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
      } else {
        allBrandsCache = [];
      }
    } catch (error) {
      console.error("Error loading brands for filtering:", error);
      errorToastMessage("Failed to load brands");
      allBrandsCache = [];
    }
  }

  function applyFilters() {
    let result = [...allBrandsCache];

    // search
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((brand) => {
        const displayname = (getLocalizedDisplayName(brand, $locale) || "").toLowerCase();
        const shortname = (brand.shortname || "").toLowerCase();
        const description =
          (brand.attributes?.description?.[$locale] ||
            brand.attributes?.description?.en ||
            "")
            .toLowerCase();

        return (
          displayname.includes(searchLower) ||
          shortname.includes(searchLower) ||
          description.includes(searchLower)
        );
      });
    }

    // top/regular
    if (topBrandsFilter === "top") {
      result = result.filter((b) => b.attributes?.payload?.body?.top === true);
    } else if (topBrandsFilter === "regular") {
      result = result.filter((b) => b.attributes?.payload?.body?.top !== true);
    }

    filteredBrands = result;

    // keep currentPage in range
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
  }

  // ----------------------------
  // Pagination
  // ----------------------------
  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;

    // server pagination only when not filtering
    if (!isFiltering) {
      loadBrandsServerPage();
    }
  }

  // ----------------------------
  // Modals
  // ----------------------------
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
    };
    createLogoFile = null;
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    createLogoFile = null;
  }

  function openEditModal(brand: any) {
    selectedBrand = brand;
    editForm = {
      displayname_en: brand.attributes?.displayname?.en || "",
      displayname_ar: brand.attributes?.displayname?.ar || "",
      displayname_ku: brand.attributes?.displayname?.ku || "",
      description_en: brand.attributes?.description?.en || "",
      description_ar: brand.attributes?.description?.ar || "",
      description_ku: brand.attributes?.description?.ku || "",
      meta_title_en: brand.attributes?.payload?.body?.meta_title?.en || "",
      meta_description_en: brand.attributes?.payload?.body?.meta_description?.en || "",
      isTop: brand.attributes?.payload?.body?.top === true,
      boost_value: brand.attributes?.payload?.body?.boost_value || 0,
    };
    editLogoFile = null;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedBrand = null;
    editLogoFile = null;
  }

  function openDeleteModal(brand: any) {
    selectedBrand = brand;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedBrand = null;
  }

  // ----------------------------
  // CRUD
  // ----------------------------
  async function handleCreateBrand() {
    if (!createForm.displayname_en.trim()) {
      errorToastMessage("Please enter a brand name in English");
      return;
    }

    try {
      const brandData: any = {
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
      if (!brandData.body.meta_description) delete brandData.body.meta_description;

      // 1) Create brand
      const createdBrand: any = await createEntity(
        brandData,
        website.main_space,
        "/brands",
        ResourceType.content,
        "",
        "",
      );

      // 2) Upload logo (optional)
      if (createLogoFile) {
        await attachAttachmentsToEntity(
          createdBrand.shortname,
          website.main_space,
          "/brands",
          createLogoFile,
        );
      }

      successToastMessage("Brand created successfully!");
      closeCreateModal();

      // refresh both server and cache (so filters also see it)
      await loadBrandsServerPage();
      allBrandsCache = [];
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
      const brandData: any = {
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
      if (!brandData.body.meta_description) delete brandData.body.meta_description;

      await updateEntity(
        selectedBrand.shortname,
        website.main_space,
        selectedBrand.subpath,
        selectedBrand.resource_type,
        brandData,
        "",
        "",
      );

      // Upload new logo if provided
      if (editLogoFile) {
        await attachAttachmentsToEntity(
          selectedBrand.shortname,
          website.main_space,
          "/brands",
          editLogoFile,
        );
      }

      successToastMessage("Brand updated successfully!");
      closeEditModal();

      await loadBrandsServerPage();
      allBrandsCache = [];
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

      await loadBrandsServerPage();
      allBrandsCache = [];
    } catch (error) {
      console.error("Error deleting brand:", error);
      errorToastMessage("Failed to delete brand");
    }
  }

  // ----------------------------
  // Lifecycle + effects
  // ----------------------------
  onMount(async () => {
    window.addEventListener("click", onWindowClick);
    await loadBrandsServerPage();
  });

  onDestroy(() => {
    window.removeEventListener("click", onWindowClick);
  });

  // When filters change -> switch to filtering mode
  $effect(() => {
    if (isFiltering) {
      // reset to first page for filtering
      currentPage = 1;

      // ensure cache loaded then filter
      (async () => {
        if (allBrandsCache.length === 0) {
          await loadAllBrandsForFiltering();
        }
        applyFilters();
      })();
    } else {
      // when leaving filtering mode, go back to server pagination
      // keep currentPage as-is
      loadBrandsServerPage();
    }
  });

  // When locale changes and we're filtering, re-apply (because search/displayname changes)
  $effect(() => {
    if (isFiltering && allBrandsCache.length) {
      applyFilters();
    }
  });
</script>

<div class="brands-page" class:rtl={$isRTL}>
  <!-- Stats Cards (keep your existing markup/styles) -->
  <div class="stats-grid">
    <!-- Total -->
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <!-- (same svg you had) -->
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M18.4612 7.5C18.4611 7.5 18.4612 7.5 18.4612 7.5V7.5ZM18.4744 7.50001L27.0568 7.51047C27.0578 7.51048 27.0588 7.51049 27.0598 7.5105C27.4433 7.51362 27.8101 7.66835 28.0799 7.94096C28.3505 8.21429 28.5016 8.58379 28.5 8.96838L28.5 17.2208C28.4868 17.2332 28.4738 17.2458 28.461 17.2587L17.328 28.483L7.50172 18.57L18.4744 7.50001ZM18.4688 4.50001C18.4684 4.50001 18.4692 4.50001 18.4688 4.50001L27.0751 4.51051C28.2543 4.51769 29.3824 4.99241 30.212 5.83046C31.0409 6.66778 31.504 7.79948 31.5 8.97757C31.5 8.97859 31.5 8.97961 31.5 8.98063L30 8.9745H31.5V8.97757V17.2243C31.5 17.6346 31.4156 18.0407 31.2521 18.417C31.093 18.7829 30.8624 19.1131 30.574 19.3884L30.591 19.3713L29.526 18.315L30.5491 19.4119C30.5575 19.4041 30.5658 19.3963 30.574 19.3884L19.4336 30.6201L18.3676 29.5652L19.4325 30.6213C19.1575 30.8989 18.8303 31.1193 18.4698 31.2699C18.1087 31.4207 17.7214 31.4985 17.3301 31.4987C16.9389 31.499 16.5514 31.4218 16.1902 31.2715C15.8289 31.1212 15.501 30.9009 15.2254 30.6232L5.36657 20.6774L6.43048 19.62L5.36517 20.676C4.80937 20.116 4.49744 19.359 4.49744 18.57C4.49744 17.7807 4.80962 17.0234 5.36584 16.4633L16.3644 5.36719C16.6409 5.09132 16.9691 4.87273 17.3302 4.72392C17.6909 4.57526 18.0786 4.49918 18.4688 4.50001ZM21.8745 12.6672C21.8745 11.8388 22.5461 11.1672 23.3745 11.1672H23.3895C24.2179 11.1672 24.8895 11.8388 24.8895 12.6672C24.8895 13.4957 24.2179 14.1672 23.3895 14.1672H23.3745C22.5461 14.1672 21.8745 13.4957 21.8745 12.6672Z" fill="#3C307F"/>
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.total") || "Total Brands"}</h3>
        <p class="stat-value">
          {formatNumber(isFiltering ? filteredBrands.length : totalBrandsCount, $locale)}
        </p>
      </div>
    </div>

    <!-- Top -->
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z" fill="#3C307F"/>
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.top_brands") || "Top Brands"}</h3>
        <p class="stat-value">
          {formatNumber(
            (isFiltering ? filteredBrands : brands).filter((b) => b.attributes?.payload?.body?.top === true).length,
            $locale
          )}
        </p>
      </div>
    </div>

    <!-- Regular -->
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z" fill="#3C307F"/>
</svg>

      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.regular") || "Regular Brands"}</h3>
        <p class="stat-value">
          {formatNumber(
            (isFiltering ? filteredBrands : brands).filter((b) => b.attributes?.payload?.body?.top !== true).length,
            $locale
          )}
        </p>
      </div>
    </div>

    <!-- Showing -->
    <div class="stat-card">
      <div class="bg-icon rounded-lg flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z" fill="#3C307F"/>
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">{$_("brands.showing") || "Showing"}</h3>
        <p class="stat-value">
          {formatNumber(paginatedBrands.length, $locale)}
        </p>
      </div>
    </div>
  </div>

  <!-- Header -->
  <div class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6">
    <!-- Search -->
    <div>
      <div class="relative w-[256px]">
        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
        </div>

        <input
          type="text"
          bind:value={searchTerm}
          placeholder={$_("brands.search_placeholder") || "Search brands..."}
          class="w-full h-9 pl-9 pr-3 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px]
                 shadow-[0px_1px_0.5px_0.05px_#1D293D05] text-sm
                 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>

    <div class="flex items-end" onclick={stop}>
      <!-- Create -->
      <button
        onclick={openCreateModal}
        class="inline-flex items-center justify-center mx-2 h-9 cursor-pointer px-3 py-2
               bg-[#3C307F] text-white text-sm font-medium rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               hover:bg-[#2f2666] transition-colors duration-200"
      >
        <PlusOutline size="sm" />
        <span class="ml-2">{$_("brands.create_brand") || "Create Brand"}</span>
      </button>

      <!-- Filter -->
      <div class="relative mx-2">
        <button
          type="button"
          onclick={() => (isBrandOpen = !isBrandOpen)}
          class="list-none cursor-pointer select-none h-9 inline-flex items-center justify-between
                 px-3 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px]
                 shadow-[0px_1px_0.5px_0.05px_#1D293D05] text-sm text-gray-700 hover:bg-gray-50"
        >
          <span class="truncate">{getBrandFilterLabel()}</span>
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {#if isBrandOpen}
          <div
            class="absolute z-20 mt-2 w-[220px] max-h-[320px] overflow-y-auto rounded-[12px]
                   border border-gray-200 bg-white shadow-lg p-2"
            onclick={stop}
          >
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => { topBrandsFilter = "all"; closeBrandDropdown(); }}
            >
              {$_("brands.all_brands") || "All Brands"}
            </button>
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => { topBrandsFilter = "top"; closeBrandDropdown(); }}
            >
              {$_("brands.top_brands") || "Top Brands"}
            </button>
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => { topBrandsFilter = "regular"; closeBrandDropdown(); }}
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
  {:else if paginatedBrands.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🏷️</div>
      <h3>{$_("brands.no_brands") || "No brands found"}</h3>
      <p>{$_("brands.no_brands_description") || "Create your first brand to get started"}</p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span>{$_("brands.create_first_brand") || "Create Your First Brand"}</span>
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
          </tr>
        </thead>

        <tbody>
          {#each paginatedBrands as brand (brand.shortname)}
            <tr class="brand-row">
              <!-- Brand -->
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
                      title={brand.attributes?.description?.[$locale] || brand.attributes?.description?.en || ""}
                    >
                      {brand.attributes?.description?.[$locale] || brand.attributes?.description?.en || "-"}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Description -->
              <td>
                <p
                  class="truncate"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  class:text-right={$isRTL}
                  title={brand.attributes?.description?.[$locale] || brand.attributes?.description?.en || ""}
                >
                  {brand.attributes?.description?.[$locale] || brand.attributes?.description?.en || "-"}
                </p>
              </td>

              <!-- Status -->
              <td>
                {#if brand.attributes?.payload?.body?.top === true}
                  <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5" style="height:20px;background:#ECFDF5;border-color:#A4F4CF;">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z" fill="#004F3B"/>
                    </svg>
                    <span style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;">
                      {$_("brands.top") || "Top Brand"}
                    </span>
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5" style="height:20px;background:#EEF6FF;border-color:#BEDBFF;">
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
                <span style="font-weight:500;font-size:14px;line-height:14px;color:#101828;">
                  {brand.attributes?.payload?.body?.boost_value || 0}
                </span>
              </td>

              <!-- Created -->
              <td>
                <div class="inline-flex items-center gap-2" style="font-weight:500;font-size:14px;line-height:14px;color:#101828;" class:flex-row-reverse={$isRTL}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2Z" fill="#6A7282"/>
                  </svg>
                  <span>{formatDateDMY(brand.attributes?.created_at)}</span>
                </div>
              </td>

              <!-- Actions -->
              <td>
                <div class="relative" onclick={stop}>
                  <button
                    class="h-8 w-8 inline-flex items-center justify-center rounded-md cursor-pointer hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                    aria-label={$_("brands.actions") || "Actions"}
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(brand)}
                    onclick={() => toggleActions(brand)}
                    type="button"
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
                        onclick={() => { closeActions(); openEditModal(brand); }}
                        role="menuitem"
                        type="button"
                      >
                        {$_("brands.edit") || $_("common.edit") || "Edit"}
                      </button>

                      <button
                        class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                        class:text-right={$isRTL}
                        onclick={() => { closeActions(); openDeleteModal(brand); }}
                        role="menuitem"
                        type="button"
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
          <span class="pagination-info__label">{$_("common.showing") || "Showing"}</span>

          {#if isFiltering}
            <span class="pagination-info__strong">
              {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}-
              {formatNumber(Math.min(currentPage * itemsPerPage, filteredBrands.length), $locale)}
            </span>
            <span class="pagination-info__label">{$_("common.of") || "of"}</span>
            <span class="pagination-info__strong">{formatNumber(filteredBrands.length, $locale)}</span>
          {:else}
            <span class="pagination-info__strong">
              {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}-
              {formatNumber(Math.min(currentPage * itemsPerPage, totalBrandsCount), $locale)}
            </span>
            <span class="pagination-info__label">{$_("common.of") || "of"}</span>
            <span class="pagination-info__strong">{formatNumber(totalBrandsCount, $locale)}</span>
          {/if}
        </div>

        <div class="pagination-controls">
          <button
            class="pager-arrow pager-arrow--left"
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M4.86195 8.47132C4.6016 8.21097 4.6016 7.78886 4.86195 7.52851L9.52862 2.86185C9.78897 2.6015 10.2111 2.6015 10.4714 2.86185C10.7318 3.1222 10.7318 3.54431 10.4714 3.80466L6.27616 7.99992L10.4714 12.1952C10.7318 12.4555 10.7318 12.8776 10.4714 13.138C10.2111 13.3983 9.78897 13.3983 9.52862 13.138L4.86195 8.47132Z" fill="#101828"/>
            </svg>
          </button>

          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-chip"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                  type="button"
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <button class="page-chip" class:active={currentPage === 1} onclick={() => goToPage(1)} type="button">
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-chip"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                    type="button"
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <button
                class="page-chip"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
                type="button"
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <button
            class="pager-arrow pager-arrow--right"
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M11.1381 7.52868C11.3985 7.78903 11.3985 8.21114 11.1381 8.47149L6.47145 13.1382C6.2111 13.3985 5.78899 13.3985 5.52864 13.1382C5.26829 12.8778 5.26829 12.4557 5.52864 12.1953L9.7239 8.00008L5.52864 3.80482C5.26829 3.54447 5.26829 3.12236 5.52864 2.86201C5.78899 2.60166 6.2111 2.60166 6.47145 2.86201L11.1381 7.52868Z" fill="#101828"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Modal -->
<BrandModal
  bind:show={showCreateModal}
  mode="create"
  bind:value={createForm}
  bind:logoFile={createLogoFile}
  onClose={closeCreateModal}
  onSubmit={handleCreateBrand}
>
  <svelte:fragment slot="dropIcon">
    <svg width="466" height="52" viewBox="0 0 466 52" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M233 3C233.304 3 233.591 3.13809 233.781 3.3753L237.781 8.37531C238.126 8.80657 238.056 9.43586 237.625 9.78087C237.193 10.1259 236.564 10.056 236.219 9.62469L234 6.85078L234 14C234 14.5523 233.552 15 233 15C232.448 15 232 14.5523 232 14L232 6.85078L229.781 9.62469C229.436 10.056 228.807 10.1259 228.375 9.78087C227.944 9.43586 227.874 8.80657 228.219 8.37531L232.219 3.3753C232.409 3.13809 232.696 3 233 3ZM224 15C224 13.8954 224.895 13 226 13H228C228.552 13 229 13.4477 229 14C229 14.5523 228.552 15 228 15H226V19H240V15H238C237.448 15 237 14.5523 237 14C237 13.4477 237.448 13 238 13H240C241.105 13 242 13.8954 242 15V19C242 20.1046 241.105 21 240 21H226C224.895 21 224 20.1046 224 19V15ZM237 17C237 16.4477 237.448 16 238 16H238.01C238.562 16 239.01 16.4477 239.01 17C239.01 17.5523 238.562 18 238.01 18H238C237.448 18 237 17.5523 237 17Z" fill="#6A7282"/>
<path d="M149.25 40.1108H147.921C147.87 39.8267 147.775 39.5767 147.635 39.3608C147.496 39.1449 147.326 38.9616 147.124 38.8111C146.922 38.6605 146.696 38.5469 146.446 38.4702C146.199 38.3935 145.936 38.3551 145.658 38.3551C145.155 38.3551 144.705 38.4815 144.307 38.7344C143.912 38.9872 143.6 39.358 143.37 39.8466C143.142 40.3352 143.029 40.9318 143.029 41.6364C143.029 42.3466 143.142 42.946 143.37 43.4347C143.6 43.9233 143.914 44.2926 144.311 44.5426C144.709 44.7926 145.157 44.9176 145.654 44.9176C145.929 44.9176 146.191 44.8807 146.438 44.8068C146.688 44.7301 146.914 44.6179 147.115 44.4702C147.317 44.3224 147.488 44.142 147.627 43.929C147.769 43.7131 147.867 43.4659 147.921 43.1875L149.25 43.1918C149.179 43.6207 149.042 44.0156 148.837 44.3764C148.635 44.7344 148.375 45.044 148.057 45.3054C147.742 45.5639 147.381 45.7642 146.975 45.9062C146.569 46.0483 146.125 46.1193 145.645 46.1193C144.89 46.1193 144.216 45.9403 143.625 45.5824C143.034 45.2216 142.569 44.706 142.228 44.0355C141.89 43.3651 141.721 42.5653 141.721 41.6364C141.721 40.7045 141.891 39.9048 142.232 39.2372C142.573 38.5668 143.039 38.0526 143.63 37.6946C144.221 37.3338 144.892 37.1534 145.645 37.1534C146.108 37.1534 146.54 37.2202 146.941 37.3537C147.344 37.4844 147.706 37.6776 148.027 37.9332C148.348 38.1861 148.614 38.4957 148.824 38.8622C149.034 39.2259 149.176 39.642 149.25 40.1108ZM151.998 37.2727V46H150.724V37.2727H151.998ZM153.712 46V39.4545H154.986V46H153.712ZM154.355 38.4446C154.134 38.4446 153.944 38.3707 153.784 38.223C153.628 38.0724 153.55 37.8935 153.55 37.6861C153.55 37.4759 153.628 37.2969 153.784 37.1491C153.944 36.9986 154.134 36.9233 154.355 36.9233C154.577 36.9233 154.766 36.9986 154.922 37.1491C155.081 37.2969 155.161 37.4759 155.161 37.6861C155.161 37.8935 155.081 38.0724 154.922 38.223C154.766 38.3707 154.577 38.4446 154.355 38.4446ZM159.457 46.1321C158.824 46.1321 158.278 45.9886 157.821 45.7017C157.366 45.4119 157.017 45.0128 156.773 44.5043C156.528 43.9957 156.406 43.4134 156.406 42.7571C156.406 42.0923 156.531 41.5057 156.781 40.9972C157.031 40.4858 157.384 40.0866 157.838 39.7997C158.293 39.5128 158.828 39.3693 159.445 39.3693C159.942 39.3693 160.385 39.4616 160.774 39.6463C161.163 39.8281 161.477 40.0838 161.716 40.4134C161.957 40.7429 162.101 41.1278 162.146 41.5682H160.906C160.838 41.2614 160.682 40.9972 160.438 40.7756C160.196 40.554 159.872 40.4432 159.466 40.4432C159.111 40.4432 158.8 40.5369 158.533 40.7244C158.268 40.9091 158.063 41.1733 157.915 41.517C157.767 41.858 157.693 42.2614 157.693 42.7273C157.693 43.2045 157.766 43.6165 157.911 43.9631C158.055 44.3097 158.26 44.5781 158.524 44.7685C158.791 44.9588 159.105 45.054 159.466 45.054C159.707 45.054 159.926 45.0099 160.122 44.9219C160.321 44.831 160.487 44.7017 160.621 44.5341C160.757 44.3665 160.852 44.1648 160.906 43.929H162.146C162.101 44.3523 161.963 44.7301 161.733 45.0625C161.503 45.3949 161.195 45.6562 160.808 45.8466C160.425 46.0369 159.974 46.1321 159.457 46.1321ZM164.681 43.7798L164.672 42.2244H164.894L167.502 39.4545H169.027L166.053 42.608H165.853L164.681 43.7798ZM163.509 46V37.2727H164.783V46H163.509ZM167.642 46L165.299 42.8892L166.176 41.9986L169.206 46H167.642ZM176.42 39.4545V40.4773H172.844V39.4545H176.42ZM173.803 37.8864H175.077V44.0781C175.077 44.3253 175.114 44.5114 175.188 44.6364C175.262 44.7585 175.357 44.8423 175.474 44.8878C175.593 44.9304 175.722 44.9517 175.862 44.9517C175.964 44.9517 176.053 44.9446 176.13 44.9304C176.207 44.9162 176.266 44.9048 176.309 44.8963L176.539 45.9489C176.465 45.9773 176.36 46.0057 176.224 46.0341C176.087 46.0653 175.917 46.0824 175.712 46.0852C175.377 46.0909 175.065 46.0312 174.775 45.9062C174.485 45.7812 174.251 45.5881 174.072 45.3267C173.893 45.0653 173.803 44.7372 173.803 44.3423V37.8864ZM180.516 46.1321C179.902 46.1321 179.367 45.9915 178.909 45.7102C178.452 45.429 178.097 45.0355 177.844 44.5298C177.591 44.0241 177.465 43.4332 177.465 42.7571C177.465 42.0781 177.591 41.4844 177.844 40.9759C178.097 40.4673 178.452 40.0724 178.909 39.7912C179.367 39.5099 179.902 39.3693 180.516 39.3693C181.13 39.3693 181.665 39.5099 182.123 39.7912C182.58 40.0724 182.935 40.4673 183.188 40.9759C183.441 41.4844 183.567 42.0781 183.567 42.7571C183.567 43.4332 183.441 44.0241 183.188 44.5298C182.935 45.0355 182.58 45.429 182.123 45.7102C181.665 45.9915 181.13 46.1321 180.516 46.1321ZM180.52 45.0625C180.918 45.0625 181.248 44.9574 181.509 44.7472C181.77 44.5369 181.963 44.2571 182.088 43.9077C182.216 43.5582 182.28 43.1733 182.28 42.7528C182.28 42.3352 182.216 41.9517 182.088 41.6023C181.963 41.25 181.77 40.9673 181.509 40.7543C181.248 40.5412 180.918 40.4347 180.52 40.4347C180.12 40.4347 179.787 40.5412 179.523 40.7543C179.262 40.9673 179.067 41.25 178.939 41.6023C178.814 41.9517 178.752 42.3352 178.752 42.7528C178.752 43.1733 178.814 43.5582 178.939 43.9077C179.067 44.2571 179.262 44.5369 179.523 44.7472C179.787 44.9574 180.12 45.0625 180.52 45.0625ZM192.311 43.2855V39.4545H193.59V46H192.337V44.8665H192.269C192.118 45.2159 191.877 45.5071 191.544 45.7401C191.215 45.9702 190.804 46.0852 190.313 46.0852C189.892 46.0852 189.52 45.9929 189.196 45.8082C188.875 45.6207 188.623 45.3438 188.438 44.9773C188.256 44.6108 188.165 44.1577 188.165 43.6179V39.4545H189.439V43.4645C189.439 43.9105 189.563 44.2656 189.81 44.5298C190.057 44.794 190.378 44.9261 190.773 44.9261C191.012 44.9261 191.249 44.8665 191.485 44.7472C191.723 44.6278 191.921 44.4474 192.077 44.206C192.236 43.9645 192.314 43.6577 192.311 43.2855ZM195.302 48.4545V39.4545H196.546V40.5156H196.653C196.727 40.3793 196.833 40.2216 196.972 40.0426C197.112 39.8636 197.305 39.7074 197.552 39.5739C197.799 39.4375 198.126 39.3693 198.532 39.3693C199.06 39.3693 199.532 39.5028 199.947 39.7699C200.362 40.0369 200.687 40.4219 200.923 40.9247C201.161 41.4276 201.281 42.0327 201.281 42.7401C201.281 43.4474 201.163 44.054 200.927 44.5597C200.691 45.0625 200.367 45.4503 199.955 45.723C199.543 45.9929 199.073 46.1278 198.545 46.1278C198.147 46.1278 197.822 46.0611 197.569 45.9276C197.319 45.794 197.123 45.6378 196.981 45.4588C196.839 45.2798 196.729 45.1207 196.653 44.9815H196.576V48.4545H195.302ZM196.55 42.7273C196.55 43.1875 196.617 43.5909 196.751 43.9375C196.884 44.2841 197.077 44.5554 197.33 44.7514C197.583 44.9446 197.893 45.0412 198.259 45.0412C198.64 45.0412 198.958 44.9403 199.214 44.7386C199.469 44.5341 199.663 44.2571 199.793 43.9077C199.927 43.5582 199.994 43.1648 199.994 42.7273C199.994 42.2955 199.928 41.9077 199.798 41.5639C199.67 41.2202 199.477 40.9489 199.218 40.75C198.962 40.5511 198.643 40.4517 198.259 40.4517C197.89 40.4517 197.577 40.5469 197.322 40.7372C197.069 40.9276 196.877 41.1932 196.746 41.5341C196.616 41.875 196.55 42.2727 196.55 42.7273ZM203.982 37.2727V46H202.708V37.2727H203.982ZM208.453 46.1321C207.84 46.1321 207.304 45.9915 206.847 45.7102C206.39 45.429 206.034 45.0355 205.782 44.5298C205.529 44.0241 205.402 43.4332 205.402 42.7571C205.402 42.0781 205.529 41.4844 205.782 40.9759C206.034 40.4673 206.39 40.0724 206.847 39.7912C207.304 39.5099 207.84 39.3693 208.453 39.3693C209.067 39.3693 209.603 39.5099 210.06 39.7912C210.517 40.0724 210.873 40.4673 211.125 40.9759C211.378 41.4844 211.505 42.0781 211.505 42.7571C211.505 43.4332 211.378 44.0241 211.125 44.5298C210.873 45.0355 210.517 45.429 210.06 45.7102C209.603 45.9915 209.067 46.1321 208.453 46.1321ZM208.458 45.0625C208.855 45.0625 209.185 44.9574 209.446 44.7472C209.708 44.5369 209.901 44.2571 210.026 43.9077C210.154 43.5582 210.218 43.1733 210.218 42.7528C210.218 42.3352 210.154 41.9517 210.026 41.6023C209.901 41.25 209.708 40.9673 209.446 40.7543C209.185 40.5412 208.855 40.4347 208.458 40.4347C208.057 40.4347 207.725 40.5412 207.461 40.7543C207.199 40.9673 207.005 41.25 206.877 41.6023C206.752 41.9517 206.689 42.3352 206.689 42.7528C206.689 43.1733 206.752 43.5582 206.877 43.9077C207.005 44.2571 207.199 44.5369 207.461 44.7472C207.725 44.9574 208.057 45.0625 208.458 45.0625ZM214.832 46.1449C214.417 46.1449 214.042 46.0682 213.707 45.9148C213.371 45.7585 213.106 45.5327 212.91 45.2372C212.717 44.9418 212.62 44.5795 212.62 44.1506C212.62 43.7812 212.691 43.4773 212.833 43.2386C212.975 43 213.167 42.8111 213.408 42.6719C213.65 42.5327 213.92 42.4276 214.218 42.3565C214.516 42.2855 214.82 42.2315 215.13 42.1946C215.522 42.1491 215.84 42.1122 216.085 42.0838C216.329 42.0526 216.506 42.0028 216.617 41.9347C216.728 41.8665 216.783 41.7557 216.783 41.6023V41.5724C216.783 41.2003 216.678 40.9119 216.468 40.7074C216.261 40.5028 215.951 40.4006 215.539 40.4006C215.11 40.4006 214.772 40.4957 214.525 40.6861C214.281 40.8736 214.112 41.0824 214.018 41.3125L212.82 41.0398C212.962 40.642 213.17 40.321 213.442 40.0767C213.718 39.8295 214.035 39.6506 214.393 39.5398C214.751 39.4261 215.127 39.3693 215.522 39.3693C215.783 39.3693 216.06 39.4006 216.353 39.4631C216.648 39.5227 216.924 39.6335 217.18 39.7955C217.438 39.9574 217.65 40.1889 217.815 40.4901C217.979 40.7884 218.062 41.1761 218.062 41.6534V46H216.817V45.1051H216.766C216.684 45.2699 216.56 45.4318 216.396 45.5909C216.231 45.75 216.019 45.8821 215.761 45.9872C215.502 46.0923 215.192 46.1449 214.832 46.1449ZM215.109 45.1222C215.461 45.1222 215.762 45.0526 216.012 44.9134C216.265 44.7741 216.457 44.5923 216.587 44.3679C216.721 44.1406 216.788 43.8977 216.788 43.6392V42.7955C216.742 42.8409 216.654 42.8835 216.523 42.9233C216.396 42.9602 216.249 42.9929 216.085 43.0213C215.92 43.0469 215.759 43.071 215.603 43.0938C215.447 43.1136 215.316 43.1307 215.211 43.1449C214.964 43.1761 214.738 43.2287 214.533 43.3026C214.332 43.3764 214.17 43.483 214.048 43.6222C213.928 43.7585 213.869 43.9403 213.869 44.1676C213.869 44.483 213.985 44.7216 214.218 44.8835C214.451 45.0426 214.748 45.1222 215.109 45.1222ZM222.209 46.1278C221.681 46.1278 221.209 45.9929 220.794 45.723C220.382 45.4503 220.059 45.0625 219.823 44.5597C219.59 44.054 219.473 43.4474 219.473 42.7401C219.473 42.0327 219.591 41.4276 219.827 40.9247C220.066 40.4219 220.392 40.0369 220.807 39.7699C221.222 39.5028 221.692 39.3693 222.218 39.3693C222.624 39.3693 222.951 39.4375 223.198 39.5739C223.448 39.7074 223.641 39.8636 223.777 40.0426C223.917 40.2216 224.025 40.3793 224.101 40.5156H224.178V37.2727H225.452V46H224.208V44.9815H224.101C224.025 45.1207 223.914 45.2798 223.769 45.4588C223.627 45.6378 223.431 45.794 223.181 45.9276C222.931 46.0611 222.607 46.1278 222.209 46.1278ZM222.49 45.0412C222.857 45.0412 223.167 44.9446 223.419 44.7514C223.675 44.5554 223.868 44.2841 223.999 43.9375C224.132 43.5909 224.199 43.1875 224.199 42.7273C224.199 42.2727 224.134 41.875 224.003 41.5341C223.873 41.1932 223.681 40.9276 223.428 40.7372C223.175 40.5469 222.863 40.4517 222.49 40.4517C222.107 40.4517 221.787 40.5511 221.532 40.75C221.276 40.9489 221.083 41.2202 220.952 41.5639C220.824 41.9077 220.76 42.2955 220.76 42.7273C220.76 43.1648 220.826 43.5582 220.956 43.9077C221.087 44.2571 221.28 44.5341 221.536 44.7386C221.794 44.9403 222.113 45.0412 222.49 45.0412ZM233.369 46.1364C232.778 46.1364 232.259 45.9957 231.813 45.7145C231.37 45.4332 231.023 45.0398 230.773 44.5341C230.526 44.0284 230.403 43.4375 230.403 42.7614C230.403 42.0795 230.526 41.4844 230.773 40.9759C231.023 40.4673 231.37 40.0724 231.813 39.7912C232.259 39.5099 232.778 39.3693 233.369 39.3693C233.96 39.3693 234.477 39.5099 234.92 39.7912C235.366 40.0724 235.712 40.4673 235.96 40.9759C236.21 41.4844 236.335 42.0795 236.335 42.7614C236.335 43.4375 236.21 44.0284 235.96 44.5341C235.712 45.0398 235.366 45.4332 234.92 45.7145C234.477 45.9957 233.96 46.1364 233.369 46.1364ZM233.369 45.233C233.817 45.233 234.187 45.1179 234.477 44.8878C234.766 44.6577 234.981 44.3551 235.12 43.9801C235.259 43.6051 235.329 43.1989 235.329 42.7614C235.329 42.3239 235.259 41.9162 235.12 41.5384C234.981 41.1605 234.766 40.8551 234.477 40.6222C234.187 40.3892 233.817 40.2727 233.369 40.2727C232.92 40.2727 232.55 40.3892 232.261 40.6222C231.971 40.8551 231.756 41.1605 231.617 41.5384C231.478 41.9162 231.408 42.3239 231.408 42.7614C231.408 43.1989 231.478 43.6051 231.617 43.9801C231.756 44.3551 231.971 44.6577 232.261 44.8878C232.55 45.1179 232.92 45.233 233.369 45.233ZM237.87 46V39.4545H238.841V40.4432H238.909C239.029 40.1193 239.245 39.8565 239.557 39.6548C239.87 39.4531 240.222 39.3523 240.614 39.3523C240.688 39.3523 240.78 39.3537 240.891 39.3565C241.002 39.3594 241.086 39.3636 241.142 39.3693V40.392C241.108 40.3835 241.03 40.3707 240.908 40.3537C240.789 40.3338 240.662 40.3239 240.529 40.3239C240.211 40.3239 239.926 40.3906 239.676 40.5241C239.429 40.6548 239.233 40.8366 239.088 41.0696C238.946 41.2997 238.875 41.5625 238.875 41.858V46H237.87ZM248.181 46.1364C247.636 46.1364 247.154 45.9986 246.737 45.723C246.319 45.4446 245.992 45.0526 245.756 44.5469C245.521 44.0384 245.403 43.4375 245.403 42.7443C245.403 42.0568 245.521 41.4602 245.756 40.9545C245.992 40.4489 246.32 40.0582 246.741 39.7827C247.161 39.5071 247.647 39.3693 248.198 39.3693C248.624 39.3693 248.961 39.4403 249.208 39.5824C249.458 39.7216 249.648 39.8807 249.779 40.0597C249.913 40.2358 250.016 40.3807 250.09 40.4943H250.175V37.2727H251.181V46H250.21V44.9943H250.09C250.016 45.1136 249.911 45.2642 249.775 45.446C249.638 45.625 249.444 45.7855 249.191 45.9276C248.938 46.0668 248.602 46.1364 248.181 46.1364ZM248.317 45.233C248.721 45.233 249.062 45.1278 249.34 44.9176C249.619 44.7045 249.83 44.4105 249.975 44.0355C250.12 43.6577 250.192 43.2216 250.192 42.7273C250.192 42.2386 250.121 41.8111 249.979 41.4446C249.837 41.0753 249.627 40.7884 249.349 40.5838C249.07 40.3764 248.727 40.2727 248.317 40.2727C247.891 40.2727 247.536 40.3821 247.252 40.6009C246.971 40.8168 246.759 41.1108 246.617 41.483C246.478 41.8523 246.408 42.267 246.408 42.7273C246.408 43.1932 246.479 43.6165 246.621 43.9972C246.766 44.375 246.979 44.6761 247.261 44.9006C247.545 45.1222 247.897 45.233 248.317 45.233ZM253.163 46V39.4545H254.134V40.4432H254.202C254.322 40.1193 254.538 39.8565 254.85 39.6548C255.163 39.4531 255.515 39.3523 255.907 39.3523C255.981 39.3523 256.073 39.3537 256.184 39.3565C256.295 39.3594 256.379 39.3636 256.435 39.3693V40.392C256.401 40.3835 256.323 40.3707 256.201 40.3537C256.082 40.3338 255.955 40.3239 255.822 40.3239C255.504 40.3239 255.219 40.3906 254.969 40.5241C254.722 40.6548 254.526 40.8366 254.381 41.0696C254.239 41.2997 254.168 41.5625 254.168 41.858V46H253.163ZM259.554 46.1534C259.139 46.1534 258.762 46.0753 258.424 45.919C258.086 45.7599 257.818 45.5312 257.619 45.233C257.42 44.9318 257.321 44.5682 257.321 44.142C257.321 43.767 257.395 43.4631 257.542 43.2301C257.69 42.9943 257.887 42.8097 258.135 42.6761C258.382 42.5426 258.654 42.4432 258.953 42.3778C259.254 42.3097 259.556 42.2557 259.86 42.2159C260.258 42.1648 260.581 42.1264 260.828 42.1009C261.078 42.0724 261.26 42.0256 261.373 41.9602C261.49 41.8949 261.548 41.7812 261.548 41.6193V41.5852C261.548 41.1648 261.433 40.8381 261.203 40.6051C260.975 40.3722 260.63 40.2557 260.167 40.2557C259.687 40.2557 259.311 40.3608 259.038 40.571C258.765 40.7812 258.574 41.0057 258.463 41.2443L257.508 40.9034C257.679 40.5057 257.906 40.196 258.19 39.9744C258.477 39.75 258.789 39.5937 259.127 39.5057C259.468 39.4148 259.804 39.3693 260.133 39.3693C260.343 39.3693 260.585 39.3949 260.858 39.446C261.133 39.4943 261.399 39.5952 261.654 39.7486C261.913 39.902 262.127 40.1335 262.298 40.4432C262.468 40.7528 262.554 41.1676 262.554 41.6875V46H261.548V45.1136H261.497C261.429 45.2557 261.315 45.4077 261.156 45.5696C260.997 45.7315 260.785 45.8693 260.521 45.983C260.257 46.0966 259.934 46.1534 259.554 46.1534ZM259.707 45.25C260.105 45.25 260.44 45.1719 260.713 45.0156C260.988 44.8594 261.196 44.6577 261.335 44.4105C261.477 44.1634 261.548 43.9034 261.548 43.6307V42.7102C261.505 42.7614 261.412 42.8082 261.267 42.8509C261.125 42.8906 260.96 42.9261 260.772 42.9574C260.588 42.9858 260.407 43.0114 260.231 43.0341C260.058 43.054 259.917 43.071 259.809 43.0852C259.548 43.1193 259.304 43.1747 259.076 43.2514C258.852 43.3253 258.67 43.4375 258.531 43.5881C258.395 43.7358 258.326 43.9375 258.326 44.1932C258.326 44.5426 258.456 44.8068 258.714 44.9858C258.975 45.1619 259.306 45.25 259.707 45.25ZM267.031 48.5909C266.545 48.5909 266.128 48.5284 265.778 48.4034C265.429 48.2812 265.138 48.1193 264.905 47.9176C264.675 47.7188 264.491 47.5057 264.355 47.2784L265.156 46.7159C265.247 46.8352 265.362 46.9716 265.501 47.125C265.641 47.2812 265.831 47.4162 266.072 47.5298C266.317 47.6463 266.636 47.7045 267.031 47.7045C267.56 47.7045 267.996 47.5767 268.339 47.321C268.683 47.0653 268.855 46.6648 268.855 46.1193V44.7898H268.77C268.696 44.9091 268.591 45.0568 268.455 45.233C268.321 45.4062 268.128 45.5611 267.875 45.6974C267.625 45.831 267.287 45.8977 266.861 45.8977C266.332 45.8977 265.858 45.7727 265.438 45.5227C265.02 45.2727 264.689 44.9091 264.445 44.4318C264.203 43.9545 264.082 43.375 264.082 42.6932C264.082 42.0227 264.2 41.4389 264.436 40.9418C264.672 40.4418 265 40.0554 265.42 39.7827C265.841 39.5071 266.327 39.3693 266.878 39.3693C267.304 39.3693 267.642 39.4403 267.892 39.5824C268.145 39.7216 268.338 39.8807 268.472 40.0597C268.608 40.2358 268.713 40.3807 268.787 40.4943H268.889V39.4545H269.861V46.1875C269.861 46.75 269.733 47.2074 269.477 47.5597C269.224 47.9148 268.884 48.1747 268.455 48.3395C268.028 48.5071 267.554 48.5909 267.031 48.5909ZM266.997 44.9943C267.401 44.9943 267.741 44.902 268.02 44.7173C268.298 44.5327 268.51 44.267 268.655 43.9205C268.8 43.5739 268.872 43.1591 268.872 42.6761C268.872 42.2045 268.801 41.7884 268.659 41.4276C268.517 41.0668 268.307 40.7841 268.028 40.5795C267.75 40.375 267.406 40.2727 266.997 40.2727C266.571 40.2727 266.216 40.3807 265.932 40.5966C265.651 40.8125 265.439 41.1023 265.297 41.4659C265.158 41.8295 265.088 42.233 265.088 42.6761C265.088 43.1307 265.159 43.5327 265.301 43.8821C265.446 44.2287 265.659 44.5014 265.94 44.7003C266.224 44.8963 266.577 44.9943 266.997 44.9943ZM277.003 46.1534C276.588 46.1534 276.212 46.0753 275.874 45.919C275.536 45.7599 275.267 45.5312 275.068 45.233C274.869 44.9318 274.77 44.5682 274.77 44.142C274.77 43.767 274.844 43.4631 274.991 43.2301C275.139 42.9943 275.337 42.8097 275.584 42.6761C275.831 42.5426 276.104 42.4432 276.402 42.3778C276.703 42.3097 277.006 42.2557 277.31 42.2159C277.707 42.1648 278.03 42.1264 278.277 42.1009C278.527 42.0724 278.709 42.0256 278.822 41.9602C278.939 41.8949 278.997 41.7812 278.997 41.6193V41.5852C278.997 41.1648 278.882 40.8381 278.652 40.6051C278.425 40.3722 278.08 40.2557 277.616 40.2557C277.136 40.2557 276.76 40.3608 276.487 40.571C276.214 40.7812 276.023 41.0057 275.912 41.2443L274.957 40.9034C275.128 40.5057 275.355 40.196 275.639 39.9744C275.926 39.75 276.239 39.5937 276.577 39.5057C276.918 39.4148 277.253 39.3693 277.582 39.3693C277.793 39.3693 278.034 39.3949 278.307 39.446C278.582 39.4943 278.848 39.5952 279.104 39.7486C279.362 39.902 279.577 40.1335 279.747 40.4432C279.918 40.7528 280.003 41.1676 280.003 41.6875V46H278.997V45.1136H278.946C278.878 45.2557 278.764 45.4077 278.605 45.5696C278.446 45.7315 278.234 45.8693 277.97 45.983C277.706 46.0966 277.384 46.1534 277.003 46.1534ZM277.156 45.25C277.554 45.25 277.889 45.1719 278.162 45.0156C278.438 44.8594 278.645 44.6577 278.784 44.4105C278.926 44.1634 278.997 43.9034 278.997 43.6307V42.7102C278.955 42.7614 278.861 42.8082 278.716 42.8509C278.574 42.8906 278.409 42.9261 278.222 42.9574C278.037 42.9858 277.857 43.0114 277.68 43.0341C277.507 43.054 277.366 43.071 277.259 43.0852C276.997 43.1193 276.753 43.1747 276.526 43.2514C276.301 43.3253 276.119 43.4375 275.98 43.5881C275.844 43.7358 275.776 43.9375 275.776 44.1932C275.776 44.5426 275.905 44.8068 276.163 44.9858C276.425 45.1619 276.756 45.25 277.156 45.25ZM282.844 42.0625V46H281.838V39.4545H282.81V40.4773H282.895C283.049 40.1449 283.282 39.8778 283.594 39.6761C283.907 39.4716 284.31 39.3693 284.804 39.3693C285.248 39.3693 285.635 39.4602 285.968 39.642C286.3 39.821 286.559 40.0938 286.743 40.4602C286.928 40.8239 287.02 41.2841 287.02 41.8409V46H286.015V41.9091C286.015 41.3949 285.881 40.9943 285.614 40.7074C285.347 40.4176 284.98 40.2727 284.515 40.2727C284.194 40.2727 283.907 40.3423 283.654 40.4815C283.404 40.6207 283.206 40.8239 283.061 41.0909C282.917 41.358 282.844 41.6818 282.844 42.0625ZM291.33 46.1364C290.784 46.1364 290.303 45.9986 289.885 45.723C289.467 45.4446 289.141 45.0526 288.905 44.5469C288.669 44.0384 288.551 43.4375 288.551 42.7443C288.551 42.0568 288.669 41.4602 288.905 40.9545C289.141 40.4489 289.469 40.0582 289.889 39.7827C290.31 39.5071 290.795 39.3693 291.347 39.3693C291.773 39.3693 292.109 39.4403 292.357 39.5824C292.607 39.7216 292.797 39.8807 292.928 40.0597C293.061 40.2358 293.165 40.3807 293.239 40.4943H293.324V37.2727H294.33V46H293.358V44.9943H293.239C293.165 45.1136 293.06 45.2642 292.923 45.446C292.787 45.625 292.592 45.7855 292.339 45.9276C292.087 46.0668 291.75 46.1364 291.33 46.1364ZM291.466 45.233C291.869 45.233 292.21 45.1278 292.489 44.9176C292.767 44.7045 292.979 44.4105 293.124 44.0355C293.268 43.6577 293.341 43.2216 293.341 42.7273C293.341 42.2386 293.27 41.8111 293.128 41.4446C292.986 41.0753 292.776 40.7884 292.497 40.5838C292.219 40.3764 291.875 40.2727 291.466 40.2727C291.04 40.2727 290.685 40.3821 290.401 40.6009C290.119 40.8168 289.908 41.1108 289.766 41.483C289.626 41.8523 289.557 42.267 289.557 42.7273C289.557 43.1932 289.628 43.6165 289.77 43.9972C289.915 44.375 290.128 44.6761 290.409 44.9006C290.693 45.1222 291.045 45.233 291.466 45.233ZM302.158 46.1364C301.612 46.1364 301.131 45.9986 300.713 45.723C300.295 45.4446 299.969 45.0526 299.733 44.5469C299.497 44.0384 299.379 43.4375 299.379 42.7443C299.379 42.0568 299.497 41.4602 299.733 40.9545C299.969 40.4489 300.297 40.0582 300.717 39.7827C301.138 39.5071 301.624 39.3693 302.175 39.3693C302.601 39.3693 302.938 39.4403 303.185 39.5824C303.435 39.7216 303.625 39.8807 303.756 40.0597C303.889 40.2358 303.993 40.3807 304.067 40.4943H304.152V37.2727H305.158V46H304.186V44.9943H304.067C303.993 45.1136 303.888 45.2642 303.751 45.446C303.615 45.625 303.42 45.7855 303.168 45.9276C302.915 46.0668 302.578 46.1364 302.158 46.1364ZM302.294 45.233C302.697 45.233 303.038 45.1278 303.317 44.9176C303.595 44.7045 303.807 44.4105 303.952 44.0355C304.097 43.6577 304.169 43.2216 304.169 42.7273C304.169 42.2386 304.098 41.8111 303.956 41.4446C303.814 41.0753 303.604 40.7884 303.325 40.5838C303.047 40.3764 302.703 40.2727 302.294 40.2727C301.868 40.2727 301.513 40.3821 301.229 40.6009C300.947 40.8168 300.736 41.1108 300.594 41.483C300.455 41.8523 300.385 42.267 300.385 42.7273C300.385 43.1932 300.456 43.6165 300.598 43.9972C300.743 44.375 300.956 44.6761 301.237 44.9006C301.521 45.1222 301.874 45.233 302.294 45.233ZM307.139 46V39.4545H308.111V40.4432H308.179C308.298 40.1193 308.514 39.8565 308.827 39.6548C309.139 39.4531 309.491 39.3523 309.884 39.3523C309.957 39.3523 310.05 39.3537 310.161 39.3565C310.271 39.3594 310.355 39.3636 310.412 39.3693V40.392C310.378 40.3835 310.3 40.3707 310.178 40.3537C310.058 40.3338 309.932 40.3239 309.798 40.3239C309.48 40.3239 309.196 40.3906 308.946 40.5241C308.699 40.6548 308.503 40.8366 308.358 41.0696C308.216 41.2997 308.145 41.5625 308.145 41.858V46H307.139ZM314.064 46.1364C313.473 46.1364 312.955 45.9957 312.509 45.7145C312.065 45.4332 311.719 45.0398 311.469 44.5341C311.222 44.0284 311.098 43.4375 311.098 42.7614C311.098 42.0795 311.222 41.4844 311.469 40.9759C311.719 40.4673 312.065 40.0724 312.509 39.7912C312.955 39.5099 313.473 39.3693 314.064 39.3693C314.655 39.3693 315.172 39.5099 315.615 39.7912C316.061 40.0724 316.408 40.4673 316.655 40.9759C316.905 41.4844 317.03 42.0795 317.03 42.7614C317.03 43.4375 316.905 44.0284 316.655 44.5341C316.408 45.0398 316.061 45.4332 315.615 45.7145C315.172 45.9957 314.655 46.1364 314.064 46.1364ZM314.064 45.233C314.513 45.233 314.882 45.1179 315.172 44.8878C315.462 44.6577 315.676 44.3551 315.815 43.9801C315.955 43.6051 316.024 43.1989 316.024 42.7614C316.024 42.3239 315.955 41.9162 315.815 41.5384C315.676 41.1605 315.462 40.8551 315.172 40.6222C314.882 40.3892 314.513 40.2727 314.064 40.2727C313.615 40.2727 313.246 40.3892 312.956 40.6222C312.666 40.8551 312.452 41.1605 312.312 41.5384C312.173 41.9162 312.104 42.3239 312.104 42.7614C312.104 43.1989 312.173 43.6051 312.312 43.9801C312.452 44.3551 312.666 44.6577 312.956 44.8878C313.246 45.1179 313.615 45.233 314.064 45.233ZM318.565 48.4545V39.4545H319.537V40.4943H319.656C319.73 40.3807 319.832 40.2358 319.963 40.0597C320.096 39.8807 320.287 39.7216 320.534 39.5824C320.784 39.4403 321.122 39.3693 321.548 39.3693C322.099 39.3693 322.585 39.5071 323.005 39.7827C323.426 40.0582 323.754 40.4489 323.99 40.9545C324.225 41.4602 324.343 42.0568 324.343 42.7443C324.343 43.4375 324.225 44.0384 323.99 44.5469C323.754 45.0526 323.427 45.4446 323.01 45.723C322.592 45.9986 322.11 46.1364 321.565 46.1364C321.145 46.1364 320.808 46.0668 320.555 45.9276C320.302 45.7855 320.108 45.625 319.971 45.446C319.835 45.2642 319.73 45.1136 319.656 44.9943H319.571V48.4545H318.565ZM319.554 42.7273C319.554 43.2216 319.626 43.6577 319.771 44.0355C319.916 44.4105 320.127 44.7045 320.406 44.9176C320.684 45.1278 321.025 45.233 321.429 45.233C321.849 45.233 322.2 45.1222 322.481 44.9006C322.765 44.6761 322.978 44.375 323.12 43.9972C323.265 43.6165 323.338 43.1932 323.338 42.7273C323.338 42.267 323.267 41.8523 323.125 41.483C322.985 41.1108 322.774 40.8168 322.49 40.6009C322.208 40.3821 321.855 40.2727 321.429 40.2727C321.02 40.2727 320.676 40.3764 320.397 40.5838C320.119 40.7884 319.909 41.0753 319.767 41.4446C319.625 41.8111 319.554 42.2386 319.554 42.7273Z" fill="#6A7282"/>
</svg>

    <slot name="dropIcon" />
  </svelte:fragment>
</BrandModal>

<!-- Edit Modal -->
<BrandModal
  bind:show={showEditModal}
  mode="edit"
  bind:value={editForm}
  bind:logoFile={editLogoFile}
  onClose={closeEditModal}
  onSubmit={handleUpdateBrand}
>
  <svelte:fragment slot="dropIcon">
    <svg width="466" height="52" viewBox="0 0 466 52" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M233 3C233.304 3 233.591 3.13809 233.781 3.3753L237.781 8.37531C238.126 8.80657 238.056 9.43586 237.625 9.78087C237.193 10.1259 236.564 10.056 236.219 9.62469L234 6.85078L234 14C234 14.5523 233.552 15 233 15C232.448 15 232 14.5523 232 14L232 6.85078L229.781 9.62469C229.436 10.056 228.807 10.1259 228.375 9.78087C227.944 9.43586 227.874 8.80657 228.219 8.37531L232.219 3.3753C232.409 3.13809 232.696 3 233 3ZM224 15C224 13.8954 224.895 13 226 13H228C228.552 13 229 13.4477 229 14C229 14.5523 228.552 15 228 15H226V19H240V15H238C237.448 15 237 14.5523 237 14C237 13.4477 237.448 13 238 13H240C241.105 13 242 13.8954 242 15V19C242 20.1046 241.105 21 240 21H226C224.895 21 224 20.1046 224 19V15ZM237 17C237 16.4477 237.448 16 238 16H238.01C238.562 16 239.01 16.4477 239.01 17C239.01 17.5523 238.562 18 238.01 18H238C237.448 18 237 17.5523 237 17Z" fill="#6A7282"/>
<path d="M149.25 40.1108H147.921C147.87 39.8267 147.775 39.5767 147.635 39.3608C147.496 39.1449 147.326 38.9616 147.124 38.8111C146.922 38.6605 146.696 38.5469 146.446 38.4702C146.199 38.3935 145.936 38.3551 145.658 38.3551C145.155 38.3551 144.705 38.4815 144.307 38.7344C143.912 38.9872 143.6 39.358 143.37 39.8466C143.142 40.3352 143.029 40.9318 143.029 41.6364C143.029 42.3466 143.142 42.946 143.37 43.4347C143.6 43.9233 143.914 44.2926 144.311 44.5426C144.709 44.7926 145.157 44.9176 145.654 44.9176C145.929 44.9176 146.191 44.8807 146.438 44.8068C146.688 44.7301 146.914 44.6179 147.115 44.4702C147.317 44.3224 147.488 44.142 147.627 43.929C147.769 43.7131 147.867 43.4659 147.921 43.1875L149.25 43.1918C149.179 43.6207 149.042 44.0156 148.837 44.3764C148.635 44.7344 148.375 45.044 148.057 45.3054C147.742 45.5639 147.381 45.7642 146.975 45.9062C146.569 46.0483 146.125 46.1193 145.645 46.1193C144.89 46.1193 144.216 45.9403 143.625 45.5824C143.034 45.2216 142.569 44.706 142.228 44.0355C141.89 43.3651 141.721 42.5653 141.721 41.6364C141.721 40.7045 141.891 39.9048 142.232 39.2372C142.573 38.5668 143.039 38.0526 143.63 37.6946C144.221 37.3338 144.892 37.1534 145.645 37.1534C146.108 37.1534 146.54 37.2202 146.941 37.3537C147.344 37.4844 147.706 37.6776 148.027 37.9332C148.348 38.1861 148.614 38.4957 148.824 38.8622C149.034 39.2259 149.176 39.642 149.25 40.1108ZM151.998 37.2727V46H150.724V37.2727H151.998ZM153.712 46V39.4545H154.986V46H153.712ZM154.355 38.4446C154.134 38.4446 153.944 38.3707 153.784 38.223C153.628 38.0724 153.55 37.8935 153.55 37.6861C153.55 37.4759 153.628 37.2969 153.784 37.1491C153.944 36.9986 154.134 36.9233 154.355 36.9233C154.577 36.9233 154.766 36.9986 154.922 37.1491C155.081 37.2969 155.161 37.4759 155.161 37.6861C155.161 37.8935 155.081 38.0724 154.922 38.223C154.766 38.3707 154.577 38.4446 154.355 38.4446ZM159.457 46.1321C158.824 46.1321 158.278 45.9886 157.821 45.7017C157.366 45.4119 157.017 45.0128 156.773 44.5043C156.528 43.9957 156.406 43.4134 156.406 42.7571C156.406 42.0923 156.531 41.5057 156.781 40.9972C157.031 40.4858 157.384 40.0866 157.838 39.7997C158.293 39.5128 158.828 39.3693 159.445 39.3693C159.942 39.3693 160.385 39.4616 160.774 39.6463C161.163 39.8281 161.477 40.0838 161.716 40.4134C161.957 40.7429 162.101 41.1278 162.146 41.5682H160.906C160.838 41.2614 160.682 40.9972 160.438 40.7756C160.196 40.554 159.872 40.4432 159.466 40.4432C159.111 40.4432 158.8 40.5369 158.533 40.7244C158.268 40.9091 158.063 41.1733 157.915 41.517C157.767 41.858 157.693 42.2614 157.693 42.7273C157.693 43.2045 157.766 43.6165 157.911 43.9631C158.055 44.3097 158.26 44.5781 158.524 44.7685C158.791 44.9588 159.105 45.054 159.466 45.054C159.707 45.054 159.926 45.0099 160.122 44.9219C160.321 44.831 160.487 44.7017 160.621 44.5341C160.757 44.3665 160.852 44.1648 160.906 43.929H162.146C162.101 44.3523 161.963 44.7301 161.733 45.0625C161.503 45.3949 161.195 45.6562 160.808 45.8466C160.425 46.0369 159.974 46.1321 159.457 46.1321ZM164.681 43.7798L164.672 42.2244H164.894L167.502 39.4545H169.027L166.053 42.608H165.853L164.681 43.7798ZM163.509 46V37.2727H164.783V46H163.509ZM167.642 46L165.299 42.8892L166.176 41.9986L169.206 46H167.642ZM176.42 39.4545V40.4773H172.844V39.4545H176.42ZM173.803 37.8864H175.077V44.0781C175.077 44.3253 175.114 44.5114 175.188 44.6364C175.262 44.7585 175.357 44.8423 175.474 44.8878C175.593 44.9304 175.722 44.9517 175.862 44.9517C175.964 44.9517 176.053 44.9446 176.13 44.9304C176.207 44.9162 176.266 44.9048 176.309 44.8963L176.539 45.9489C176.465 45.9773 176.36 46.0057 176.224 46.0341C176.087 46.0653 175.917 46.0824 175.712 46.0852C175.377 46.0909 175.065 46.0312 174.775 45.9062C174.485 45.7812 174.251 45.5881 174.072 45.3267C173.893 45.0653 173.803 44.7372 173.803 44.3423V37.8864ZM180.516 46.1321C179.902 46.1321 179.367 45.9915 178.909 45.7102C178.452 45.429 178.097 45.0355 177.844 44.5298C177.591 44.0241 177.465 43.4332 177.465 42.7571C177.465 42.0781 177.591 41.4844 177.844 40.9759C178.097 40.4673 178.452 40.0724 178.909 39.7912C179.367 39.5099 179.902 39.3693 180.516 39.3693C181.13 39.3693 181.665 39.5099 182.123 39.7912C182.58 40.0724 182.935 40.4673 183.188 40.9759C183.441 41.4844 183.567 42.0781 183.567 42.7571C183.567 43.4332 183.441 44.0241 183.188 44.5298C182.935 45.0355 182.58 45.429 182.123 45.7102C181.665 45.9915 181.13 46.1321 180.516 46.1321ZM180.52 45.0625C180.918 45.0625 181.248 44.9574 181.509 44.7472C181.77 44.5369 181.963 44.2571 182.088 43.9077C182.216 43.5582 182.28 43.1733 182.28 42.7528C182.28 42.3352 182.216 41.9517 182.088 41.6023C181.963 41.25 181.77 40.9673 181.509 40.7543C181.248 40.5412 180.918 40.4347 180.52 40.4347C180.12 40.4347 179.787 40.5412 179.523 40.7543C179.262 40.9673 179.067 41.25 178.939 41.6023C178.814 41.9517 178.752 42.3352 178.752 42.7528C178.752 43.1733 178.814 43.5582 178.939 43.9077C179.067 44.2571 179.262 44.5369 179.523 44.7472C179.787 44.9574 180.12 45.0625 180.52 45.0625ZM192.311 43.2855V39.4545H193.59V46H192.337V44.8665H192.269C192.118 45.2159 191.877 45.5071 191.544 45.7401C191.215 45.9702 190.804 46.0852 190.313 46.0852C189.892 46.0852 189.52 45.9929 189.196 45.8082C188.875 45.6207 188.623 45.3438 188.438 44.9773C188.256 44.6108 188.165 44.1577 188.165 43.6179V39.4545H189.439V43.4645C189.439 43.9105 189.563 44.2656 189.81 44.5298C190.057 44.794 190.378 44.9261 190.773 44.9261C191.012 44.9261 191.249 44.8665 191.485 44.7472C191.723 44.6278 191.921 44.4474 192.077 44.206C192.236 43.9645 192.314 43.6577 192.311 43.2855ZM195.302 48.4545V39.4545H196.546V40.5156H196.653C196.727 40.3793 196.833 40.2216 196.972 40.0426C197.112 39.8636 197.305 39.7074 197.552 39.5739C197.799 39.4375 198.126 39.3693 198.532 39.3693C199.06 39.3693 199.532 39.5028 199.947 39.7699C200.362 40.0369 200.687 40.4219 200.923 40.9247C201.161 41.4276 201.281 42.0327 201.281 42.7401C201.281 43.4474 201.163 44.054 200.927 44.5597C200.691 45.0625 200.367 45.4503 199.955 45.723C199.543 45.9929 199.073 46.1278 198.545 46.1278C198.147 46.1278 197.822 46.0611 197.569 45.9276C197.319 45.794 197.123 45.6378 196.981 45.4588C196.839 45.2798 196.729 45.1207 196.653 44.9815H196.576V48.4545H195.302ZM196.55 42.7273C196.55 43.1875 196.617 43.5909 196.751 43.9375C196.884 44.2841 197.077 44.5554 197.33 44.7514C197.583 44.9446 197.893 45.0412 198.259 45.0412C198.64 45.0412 198.958 44.9403 199.214 44.7386C199.469 44.5341 199.663 44.2571 199.793 43.9077C199.927 43.5582 199.994 43.1648 199.994 42.7273C199.994 42.2955 199.928 41.9077 199.798 41.5639C199.67 41.2202 199.477 40.9489 199.218 40.75C198.962 40.5511 198.643 40.4517 198.259 40.4517C197.89 40.4517 197.577 40.5469 197.322 40.7372C197.069 40.9276 196.877 41.1932 196.746 41.5341C196.616 41.875 196.55 42.2727 196.55 42.7273ZM203.982 37.2727V46H202.708V37.2727H203.982ZM208.453 46.1321C207.84 46.1321 207.304 45.9915 206.847 45.7102C206.39 45.429 206.034 45.0355 205.782 44.5298C205.529 44.0241 205.402 43.4332 205.402 42.7571C205.402 42.0781 205.529 41.4844 205.782 40.9759C206.034 40.4673 206.39 40.0724 206.847 39.7912C207.304 39.5099 207.84 39.3693 208.453 39.3693C209.067 39.3693 209.603 39.5099 210.06 39.7912C210.517 40.0724 210.873 40.4673 211.125 40.9759C211.378 41.4844 211.505 42.0781 211.505 42.7571C211.505 43.4332 211.378 44.0241 211.125 44.5298C210.873 45.0355 210.517 45.429 210.06 45.7102C209.603 45.9915 209.067 46.1321 208.453 46.1321ZM208.458 45.0625C208.855 45.0625 209.185 44.9574 209.446 44.7472C209.708 44.5369 209.901 44.2571 210.026 43.9077C210.154 43.5582 210.218 43.1733 210.218 42.7528C210.218 42.3352 210.154 41.9517 210.026 41.6023C209.901 41.25 209.708 40.9673 209.446 40.7543C209.185 40.5412 208.855 40.4347 208.458 40.4347C208.057 40.4347 207.725 40.5412 207.461 40.7543C207.199 40.9673 207.005 41.25 206.877 41.6023C206.752 41.9517 206.689 42.3352 206.689 42.7528C206.689 43.1733 206.752 43.5582 206.877 43.9077C207.005 44.2571 207.199 44.5369 207.461 44.7472C207.725 44.9574 208.057 45.0625 208.458 45.0625ZM214.832 46.1449C214.417 46.1449 214.042 46.0682 213.707 45.9148C213.371 45.7585 213.106 45.5327 212.91 45.2372C212.717 44.9418 212.62 44.5795 212.62 44.1506C212.62 43.7812 212.691 43.4773 212.833 43.2386C212.975 43 213.167 42.8111 213.408 42.6719C213.65 42.5327 213.92 42.4276 214.218 42.3565C214.516 42.2855 214.82 42.2315 215.13 42.1946C215.522 42.1491 215.84 42.1122 216.085 42.0838C216.329 42.0526 216.506 42.0028 216.617 41.9347C216.728 41.8665 216.783 41.7557 216.783 41.6023V41.5724C216.783 41.2003 216.678 40.9119 216.468 40.7074C216.261 40.5028 215.951 40.4006 215.539 40.4006C215.11 40.4006 214.772 40.4957 214.525 40.6861C214.281 40.8736 214.112 41.0824 214.018 41.3125L212.82 41.0398C212.962 40.642 213.17 40.321 213.442 40.0767C213.718 39.8295 214.035 39.6506 214.393 39.5398C214.751 39.4261 215.127 39.3693 215.522 39.3693C215.783 39.3693 216.06 39.4006 216.353 39.4631C216.648 39.5227 216.924 39.6335 217.18 39.7955C217.438 39.9574 217.65 40.1889 217.815 40.4901C217.979 40.7884 218.062 41.1761 218.062 41.6534V46H216.817V45.1051H216.766C216.684 45.2699 216.56 45.4318 216.396 45.5909C216.231 45.75 216.019 45.8821 215.761 45.9872C215.502 46.0923 215.192 46.1449 214.832 46.1449ZM215.109 45.1222C215.461 45.1222 215.762 45.0526 216.012 44.9134C216.265 44.7741 216.457 44.5923 216.587 44.3679C216.721 44.1406 216.788 43.8977 216.788 43.6392V42.7955C216.742 42.8409 216.654 42.8835 216.523 42.9233C216.396 42.9602 216.249 42.9929 216.085 43.0213C215.92 43.0469 215.759 43.071 215.603 43.0938C215.447 43.1136 215.316 43.1307 215.211 43.1449C214.964 43.1761 214.738 43.2287 214.533 43.3026C214.332 43.3764 214.17 43.483 214.048 43.6222C213.928 43.7585 213.869 43.9403 213.869 44.1676C213.869 44.483 213.985 44.7216 214.218 44.8835C214.451 45.0426 214.748 45.1222 215.109 45.1222ZM222.209 46.1278C221.681 46.1278 221.209 45.9929 220.794 45.723C220.382 45.4503 220.059 45.0625 219.823 44.5597C219.59 44.054 219.473 43.4474 219.473 42.7401C219.473 42.0327 219.591 41.4276 219.827 40.9247C220.066 40.4219 220.392 40.0369 220.807 39.7699C221.222 39.5028 221.692 39.3693 222.218 39.3693C222.624 39.3693 222.951 39.4375 223.198 39.5739C223.448 39.7074 223.641 39.8636 223.777 40.0426C223.917 40.2216 224.025 40.3793 224.101 40.5156H224.178V37.2727H225.452V46H224.208V44.9815H224.101C224.025 45.1207 223.914 45.2798 223.769 45.4588C223.627 45.6378 223.431 45.794 223.181 45.9276C222.931 46.0611 222.607 46.1278 222.209 46.1278ZM222.49 45.0412C222.857 45.0412 223.167 44.9446 223.419 44.7514C223.675 44.5554 223.868 44.2841 223.999 43.9375C224.132 43.5909 224.199 43.1875 224.199 42.7273C224.199 42.2727 224.134 41.875 224.003 41.5341C223.873 41.1932 223.681 40.9276 223.428 40.7372C223.175 40.5469 222.863 40.4517 222.49 40.4517C222.107 40.4517 221.787 40.5511 221.532 40.75C221.276 40.9489 221.083 41.2202 220.952 41.5639C220.824 41.9077 220.76 42.2955 220.76 42.7273C220.76 43.1648 220.826 43.5582 220.956 43.9077C221.087 44.2571 221.28 44.5341 221.536 44.7386C221.794 44.9403 222.113 45.0412 222.49 45.0412ZM233.369 46.1364C232.778 46.1364 232.259 45.9957 231.813 45.7145C231.37 45.4332 231.023 45.0398 230.773 44.5341C230.526 44.0284 230.403 43.4375 230.403 42.7614C230.403 42.0795 230.526 41.4844 230.773 40.9759C231.023 40.4673 231.37 40.0724 231.813 39.7912C232.259 39.5099 232.778 39.3693 233.369 39.3693C233.96 39.3693 234.477 39.5099 234.92 39.7912C235.366 40.0724 235.712 40.4673 235.96 40.9759C236.21 41.4844 236.335 42.0795 236.335 42.7614C236.335 43.4375 236.21 44.0284 235.96 44.5341C235.712 45.0398 235.366 45.4332 234.92 45.7145C234.477 45.9957 233.96 46.1364 233.369 46.1364ZM233.369 45.233C233.817 45.233 234.187 45.1179 234.477 44.8878C234.766 44.6577 234.981 44.3551 235.12 43.9801C235.259 43.6051 235.329 43.1989 235.329 42.7614C235.329 42.3239 235.259 41.9162 235.12 41.5384C234.981 41.1605 234.766 40.8551 234.477 40.6222C234.187 40.3892 233.817 40.2727 233.369 40.2727C232.92 40.2727 232.55 40.3892 232.261 40.6222C231.971 40.8551 231.756 41.1605 231.617 41.5384C231.478 41.9162 231.408 42.3239 231.408 42.7614C231.408 43.1989 231.478 43.6051 231.617 43.9801C231.756 44.3551 231.971 44.6577 232.261 44.8878C232.55 45.1179 232.92 45.233 233.369 45.233ZM237.87 46V39.4545H238.841V40.4432H238.909C239.029 40.1193 239.245 39.8565 239.557 39.6548C239.87 39.4531 240.222 39.3523 240.614 39.3523C240.688 39.3523 240.78 39.3537 240.891 39.3565C241.002 39.3594 241.086 39.3636 241.142 39.3693V40.392C241.108 40.3835 241.03 40.3707 240.908 40.3537C240.789 40.3338 240.662 40.3239 240.529 40.3239C240.211 40.3239 239.926 40.3906 239.676 40.5241C239.429 40.6548 239.233 40.8366 239.088 41.0696C238.946 41.2997 238.875 41.5625 238.875 41.858V46H237.87ZM248.181 46.1364C247.636 46.1364 247.154 45.9986 246.737 45.723C246.319 45.4446 245.992 45.0526 245.756 44.5469C245.521 44.0384 245.403 43.4375 245.403 42.7443C245.403 42.0568 245.521 41.4602 245.756 40.9545C245.992 40.4489 246.32 40.0582 246.741 39.7827C247.161 39.5071 247.647 39.3693 248.198 39.3693C248.624 39.3693 248.961 39.4403 249.208 39.5824C249.458 39.7216 249.648 39.8807 249.779 40.0597C249.913 40.2358 250.016 40.3807 250.09 40.4943H250.175V37.2727H251.181V46H250.21V44.9943H250.09C250.016 45.1136 249.911 45.2642 249.775 45.446C249.638 45.625 249.444 45.7855 249.191 45.9276C248.938 46.0668 248.602 46.1364 248.181 46.1364ZM248.317 45.233C248.721 45.233 249.062 45.1278 249.34 44.9176C249.619 44.7045 249.83 44.4105 249.975 44.0355C250.12 43.6577 250.192 43.2216 250.192 42.7273C250.192 42.2386 250.121 41.8111 249.979 41.4446C249.837 41.0753 249.627 40.7884 249.349 40.5838C249.07 40.3764 248.727 40.2727 248.317 40.2727C247.891 40.2727 247.536 40.3821 247.252 40.6009C246.971 40.8168 246.759 41.1108 246.617 41.483C246.478 41.8523 246.408 42.267 246.408 42.7273C246.408 43.1932 246.479 43.6165 246.621 43.9972C246.766 44.375 246.979 44.6761 247.261 44.9006C247.545 45.1222 247.897 45.233 248.317 45.233ZM253.163 46V39.4545H254.134V40.4432H254.202C254.322 40.1193 254.538 39.8565 254.85 39.6548C255.163 39.4531 255.515 39.3523 255.907 39.3523C255.981 39.3523 256.073 39.3537 256.184 39.3565C256.295 39.3594 256.379 39.3636 256.435 39.3693V40.392C256.401 40.3835 256.323 40.3707 256.201 40.3537C256.082 40.3338 255.955 40.3239 255.822 40.3239C255.504 40.3239 255.219 40.3906 254.969 40.5241C254.722 40.6548 254.526 40.8366 254.381 41.0696C254.239 41.2997 254.168 41.5625 254.168 41.858V46H253.163ZM259.554 46.1534C259.139 46.1534 258.762 46.0753 258.424 45.919C258.086 45.7599 257.818 45.5312 257.619 45.233C257.42 44.9318 257.321 44.5682 257.321 44.142C257.321 43.767 257.395 43.4631 257.542 43.2301C257.69 42.9943 257.887 42.8097 258.135 42.6761C258.382 42.5426 258.654 42.4432 258.953 42.3778C259.254 42.3097 259.556 42.2557 259.86 42.2159C260.258 42.1648 260.581 42.1264 260.828 42.1009C261.078 42.0724 261.26 42.0256 261.373 41.9602C261.49 41.8949 261.548 41.7812 261.548 41.6193V41.5852C261.548 41.1648 261.433 40.8381 261.203 40.6051C260.975 40.3722 260.63 40.2557 260.167 40.2557C259.687 40.2557 259.311 40.3608 259.038 40.571C258.765 40.7812 258.574 41.0057 258.463 41.2443L257.508 40.9034C257.679 40.5057 257.906 40.196 258.19 39.9744C258.477 39.75 258.789 39.5937 259.127 39.5057C259.468 39.4148 259.804 39.3693 260.133 39.3693C260.343 39.3693 260.585 39.3949 260.858 39.446C261.133 39.4943 261.399 39.5952 261.654 39.7486C261.913 39.902 262.127 40.1335 262.298 40.4432C262.468 40.7528 262.554 41.1676 262.554 41.6875V46H261.548V45.1136H261.497C261.429 45.2557 261.315 45.4077 261.156 45.5696C260.997 45.7315 260.785 45.8693 260.521 45.983C260.257 46.0966 259.934 46.1534 259.554 46.1534ZM259.707 45.25C260.105 45.25 260.44 45.1719 260.713 45.0156C260.988 44.8594 261.196 44.6577 261.335 44.4105C261.477 44.1634 261.548 43.9034 261.548 43.6307V42.7102C261.505 42.7614 261.412 42.8082 261.267 42.8509C261.125 42.8906 260.96 42.9261 260.772 42.9574C260.588 42.9858 260.407 43.0114 260.231 43.0341C260.058 43.054 259.917 43.071 259.809 43.0852C259.548 43.1193 259.304 43.1747 259.076 43.2514C258.852 43.3253 258.67 43.4375 258.531 43.5881C258.395 43.7358 258.326 43.9375 258.326 44.1932C258.326 44.5426 258.456 44.8068 258.714 44.9858C258.975 45.1619 259.306 45.25 259.707 45.25ZM267.031 48.5909C266.545 48.5909 266.128 48.5284 265.778 48.4034C265.429 48.2812 265.138 48.1193 264.905 47.9176C264.675 47.7188 264.491 47.5057 264.355 47.2784L265.156 46.7159C265.247 46.8352 265.362 46.9716 265.501 47.125C265.641 47.2812 265.831 47.4162 266.072 47.5298C266.317 47.6463 266.636 47.7045 267.031 47.7045C267.56 47.7045 267.996 47.5767 268.339 47.321C268.683 47.0653 268.855 46.6648 268.855 46.1193V44.7898H268.77C268.696 44.9091 268.591 45.0568 268.455 45.233C268.321 45.4062 268.128 45.5611 267.875 45.6974C267.625 45.831 267.287 45.8977 266.861 45.8977C266.332 45.8977 265.858 45.7727 265.438 45.5227C265.02 45.2727 264.689 44.9091 264.445 44.4318C264.203 43.9545 264.082 43.375 264.082 42.6932C264.082 42.0227 264.2 41.4389 264.436 40.9418C264.672 40.4418 265 40.0554 265.42 39.7827C265.841 39.5071 266.327 39.3693 266.878 39.3693C267.304 39.3693 267.642 39.4403 267.892 39.5824C268.145 39.7216 268.338 39.8807 268.472 40.0597C268.608 40.2358 268.713 40.3807 268.787 40.4943H268.889V39.4545H269.861V46.1875C269.861 46.75 269.733 47.2074 269.477 47.5597C269.224 47.9148 268.884 48.1747 268.455 48.3395C268.028 48.5071 267.554 48.5909 267.031 48.5909ZM266.997 44.9943C267.401 44.9943 267.741 44.902 268.02 44.7173C268.298 44.5327 268.51 44.267 268.655 43.9205C268.8 43.5739 268.872 43.1591 268.872 42.6761C268.872 42.2045 268.801 41.7884 268.659 41.4276C268.517 41.0668 268.307 40.7841 268.028 40.5795C267.75 40.375 267.406 40.2727 266.997 40.2727C266.571 40.2727 266.216 40.3807 265.932 40.5966C265.651 40.8125 265.439 41.1023 265.297 41.4659C265.158 41.8295 265.088 42.233 265.088 42.6761C265.088 43.1307 265.159 43.5327 265.301 43.8821C265.446 44.2287 265.659 44.5014 265.94 44.7003C266.224 44.8963 266.577 44.9943 266.997 44.9943ZM277.003 46.1534C276.588 46.1534 276.212 46.0753 275.874 45.919C275.536 45.7599 275.267 45.5312 275.068 45.233C274.869 44.9318 274.77 44.5682 274.77 44.142C274.77 43.767 274.844 43.4631 274.991 43.2301C275.139 42.9943 275.337 42.8097 275.584 42.6761C275.831 42.5426 276.104 42.4432 276.402 42.3778C276.703 42.3097 277.006 42.2557 277.31 42.2159C277.707 42.1648 278.03 42.1264 278.277 42.1009C278.527 42.0724 278.709 42.0256 278.822 41.9602C278.939 41.8949 278.997 41.7812 278.997 41.6193V41.5852C278.997 41.1648 278.882 40.8381 278.652 40.6051C278.425 40.3722 278.08 40.2557 277.616 40.2557C277.136 40.2557 276.76 40.3608 276.487 40.571C276.214 40.7812 276.023 41.0057 275.912 41.2443L274.957 40.9034C275.128 40.5057 275.355 40.196 275.639 39.9744C275.926 39.75 276.239 39.5937 276.577 39.5057C276.918 39.4148 277.253 39.3693 277.582 39.3693C277.793 39.3693 278.034 39.3949 278.307 39.446C278.582 39.4943 278.848 39.5952 279.104 39.7486C279.362 39.902 279.577 40.1335 279.747 40.4432C279.918 40.7528 280.003 41.1676 280.003 41.6875V46H278.997V45.1136H278.946C278.878 45.2557 278.764 45.4077 278.605 45.5696C278.446 45.7315 278.234 45.8693 277.97 45.983C277.706 46.0966 277.384 46.1534 277.003 46.1534ZM277.156 45.25C277.554 45.25 277.889 45.1719 278.162 45.0156C278.438 44.8594 278.645 44.6577 278.784 44.4105C278.926 44.1634 278.997 43.9034 278.997 43.6307V42.7102C278.955 42.7614 278.861 42.8082 278.716 42.8509C278.574 42.8906 278.409 42.9261 278.222 42.9574C278.037 42.9858 277.857 43.0114 277.68 43.0341C277.507 43.054 277.366 43.071 277.259 43.0852C276.997 43.1193 276.753 43.1747 276.526 43.2514C276.301 43.3253 276.119 43.4375 275.98 43.5881C275.844 43.7358 275.776 43.9375 275.776 44.1932C275.776 44.5426 275.905 44.8068 276.163 44.9858C276.425 45.1619 276.756 45.25 277.156 45.25ZM282.844 42.0625V46H281.838V39.4545H282.81V40.4773H282.895C283.049 40.1449 283.282 39.8778 283.594 39.6761C283.907 39.4716 284.31 39.3693 284.804 39.3693C285.248 39.3693 285.635 39.4602 285.968 39.642C286.3 39.821 286.559 40.0938 286.743 40.4602C286.928 40.8239 287.02 41.2841 287.02 41.8409V46H286.015V41.9091C286.015 41.3949 285.881 40.9943 285.614 40.7074C285.347 40.4176 284.98 40.2727 284.515 40.2727C284.194 40.2727 283.907 40.3423 283.654 40.4815C283.404 40.6207 283.206 40.8239 283.061 41.0909C282.917 41.358 282.844 41.6818 282.844 42.0625ZM291.33 46.1364C290.784 46.1364 290.303 45.9986 289.885 45.723C289.467 45.4446 289.141 45.0526 288.905 44.5469C288.669 44.0384 288.551 43.4375 288.551 42.7443C288.551 42.0568 288.669 41.4602 288.905 40.9545C289.141 40.4489 289.469 40.0582 289.889 39.7827C290.31 39.5071 290.795 39.3693 291.347 39.3693C291.773 39.3693 292.109 39.4403 292.357 39.5824C292.607 39.7216 292.797 39.8807 292.928 40.0597C293.061 40.2358 293.165 40.3807 293.239 40.4943H293.324V37.2727H294.33V46H293.358V44.9943H293.239C293.165 45.1136 293.06 45.2642 292.923 45.446C292.787 45.625 292.592 45.7855 292.339 45.9276C292.087 46.0668 291.75 46.1364 291.33 46.1364ZM291.466 45.233C291.869 45.233 292.21 45.1278 292.489 44.9176C292.767 44.7045 292.979 44.4105 293.124 44.0355C293.268 43.6577 293.341 43.2216 293.341 42.7273C293.341 42.2386 293.27 41.8111 293.128 41.4446C292.986 41.0753 292.776 40.7884 292.497 40.5838C292.219 40.3764 291.875 40.2727 291.466 40.2727C291.04 40.2727 290.685 40.3821 290.401 40.6009C290.119 40.8168 289.908 41.1108 289.766 41.483C289.626 41.8523 289.557 42.267 289.557 42.7273C289.557 43.1932 289.628 43.6165 289.77 43.9972C289.915 44.375 290.128 44.6761 290.409 44.9006C290.693 45.1222 291.045 45.233 291.466 45.233ZM302.158 46.1364C301.612 46.1364 301.131 45.9986 300.713 45.723C300.295 45.4446 299.969 45.0526 299.733 44.5469C299.497 44.0384 299.379 43.4375 299.379 42.7443C299.379 42.0568 299.497 41.4602 299.733 40.9545C299.969 40.4489 300.297 40.0582 300.717 39.7827C301.138 39.5071 301.624 39.3693 302.175 39.3693C302.601 39.3693 302.938 39.4403 303.185 39.5824C303.435 39.7216 303.625 39.8807 303.756 40.0597C303.889 40.2358 303.993 40.3807 304.067 40.4943H304.152V37.2727H305.158V46H304.186V44.9943H304.067C303.993 45.1136 303.888 45.2642 303.751 45.446C303.615 45.625 303.42 45.7855 303.168 45.9276C302.915 46.0668 302.578 46.1364 302.158 46.1364ZM302.294 45.233C302.697 45.233 303.038 45.1278 303.317 44.9176C303.595 44.7045 303.807 44.4105 303.952 44.0355C304.097 43.6577 304.169 43.2216 304.169 42.7273C304.169 42.2386 304.098 41.8111 303.956 41.4446C303.814 41.0753 303.604 40.7884 303.325 40.5838C303.047 40.3764 302.703 40.2727 302.294 40.2727C301.868 40.2727 301.513 40.3821 301.229 40.6009C300.947 40.8168 300.736 41.1108 300.594 41.483C300.455 41.8523 300.385 42.267 300.385 42.7273C300.385 43.1932 300.456 43.6165 300.598 43.9972C300.743 44.375 300.956 44.6761 301.237 44.9006C301.521 45.1222 301.874 45.233 302.294 45.233ZM307.139 46V39.4545H308.111V40.4432H308.179C308.298 40.1193 308.514 39.8565 308.827 39.6548C309.139 39.4531 309.491 39.3523 309.884 39.3523C309.957 39.3523 310.05 39.3537 310.161 39.3565C310.271 39.3594 310.355 39.3636 310.412 39.3693V40.392C310.378 40.3835 310.3 40.3707 310.178 40.3537C310.058 40.3338 309.932 40.3239 309.798 40.3239C309.48 40.3239 309.196 40.3906 308.946 40.5241C308.699 40.6548 308.503 40.8366 308.358 41.0696C308.216 41.2997 308.145 41.5625 308.145 41.858V46H307.139ZM314.064 46.1364C313.473 46.1364 312.955 45.9957 312.509 45.7145C312.065 45.4332 311.719 45.0398 311.469 44.5341C311.222 44.0284 311.098 43.4375 311.098 42.7614C311.098 42.0795 311.222 41.4844 311.469 40.9759C311.719 40.4673 312.065 40.0724 312.509 39.7912C312.955 39.5099 313.473 39.3693 314.064 39.3693C314.655 39.3693 315.172 39.5099 315.615 39.7912C316.061 40.0724 316.408 40.4673 316.655 40.9759C316.905 41.4844 317.03 42.0795 317.03 42.7614C317.03 43.4375 316.905 44.0284 316.655 44.5341C316.408 45.0398 316.061 45.4332 315.615 45.7145C315.172 45.9957 314.655 46.1364 314.064 46.1364ZM314.064 45.233C314.513 45.233 314.882 45.1179 315.172 44.8878C315.462 44.6577 315.676 44.3551 315.815 43.9801C315.955 43.6051 316.024 43.1989 316.024 42.7614C316.024 42.3239 315.955 41.9162 315.815 41.5384C315.676 41.1605 315.462 40.8551 315.172 40.6222C314.882 40.3892 314.513 40.2727 314.064 40.2727C313.615 40.2727 313.246 40.3892 312.956 40.6222C312.666 40.8551 312.452 41.1605 312.312 41.5384C312.173 41.9162 312.104 42.3239 312.104 42.7614C312.104 43.1989 312.173 43.6051 312.312 43.9801C312.452 44.3551 312.666 44.6577 312.956 44.8878C313.246 45.1179 313.615 45.233 314.064 45.233ZM318.565 48.4545V39.4545H319.537V40.4943H319.656C319.73 40.3807 319.832 40.2358 319.963 40.0597C320.096 39.8807 320.287 39.7216 320.534 39.5824C320.784 39.4403 321.122 39.3693 321.548 39.3693C322.099 39.3693 322.585 39.5071 323.005 39.7827C323.426 40.0582 323.754 40.4489 323.99 40.9545C324.225 41.4602 324.343 42.0568 324.343 42.7443C324.343 43.4375 324.225 44.0384 323.99 44.5469C323.754 45.0526 323.427 45.4446 323.01 45.723C322.592 45.9986 322.11 46.1364 321.565 46.1364C321.145 46.1364 320.808 46.0668 320.555 45.9276C320.302 45.7855 320.108 45.625 319.971 45.446C319.835 45.2642 319.73 45.1136 319.656 44.9943H319.571V48.4545H318.565ZM319.554 42.7273C319.554 43.2216 319.626 43.6577 319.771 44.0355C319.916 44.4105 320.127 44.7045 320.406 44.9176C320.684 45.1278 321.025 45.233 321.429 45.233C321.849 45.233 322.2 45.1222 322.481 44.9006C322.765 44.6761 322.978 44.375 323.12 43.9972C323.265 43.6165 323.338 43.1932 323.338 42.7273C323.338 42.267 323.267 41.8523 323.125 41.483C322.985 41.1108 322.774 40.8168 322.49 40.6009C322.208 40.3821 321.855 40.2727 321.429 40.2727C321.02 40.2727 320.676 40.3764 320.397 40.5838C320.119 40.7884 319.909 41.0753 319.767 41.4446C319.625 41.8111 319.554 42.2386 319.554 42.7273Z" fill="#6A7282"/>
</svg>

    <slot name="dropIcon" />
  </svelte:fragment>
</BrandModal>

<!-- Delete Modal (simple confirm) -->
{#if showDeleteModal}
  <div class="modal-backdrop" onclick={closeDeleteModal}>
    <div class="modal-card" onclick={stop}>
      <h3 class="modal-title">{$_("brands.delete") || "Delete Brand"}</h3>
      <p class="modal-desc">
        {$_("brands.delete_confirm") || "Are you sure you want to delete this brand?"}
      </p>

      <div class="modal-actions">
        <button class="btn-secondary" type="button" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" type="button" onclick={handleDeleteBrand}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

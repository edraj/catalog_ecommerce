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
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { ResourceType } from "@edraj/tsdmart";
  import "./index.css";
  import { website } from "@/config";
  import WarrantyModal from "@/components/modals/WarrantyModal.svelte";
  import { DeleteWarrantyModal } from "@/components/modals";

  let sellers = $state([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let warranties = $state([]);
  let isLoadingSellers = $state(true);
  let isLoadingWarranties = $state(false);
  let searchTerm = $state("");
  let statusFilter = $state("all");
  let scopeFilter = $state("all");
  let totalWarrantiesCount = $state(0);

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedWarranty = $state(null);
  let showFilters = $state(false);
  let warrantyForm = $state({
    displaynameEn: "",
    displaynameAr: "",
    displaynameKu: "",
    descriptionEn: "",
    descriptionAr: "",
    descriptionKu: "",
    isGlobal: true,
    brandShortname: "",
    sellerShortname: "",
    isActive: true,
  });
  let brands = $state([]);
  let isLoadingBrands = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(20);

  let filteredWarranties = $derived.by(() => {
    let filtered = [...warranties];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const displayName = getItemDisplayName(item).toLowerCase();
        const brandShortname =
          item.attributes?.payload?.body?.brand_shortname || "";
        return (
          displayName.includes(searchLower) ||
          brandShortname.toLowerCase().includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter(
        (item) => item.attributes?.is_active === isActive,
      );
    }

    if (scopeFilter !== "all") {
      const isGlobal = scopeFilter === "global";
      filtered = filtered.filter(
        (item) => item.attributes?.payload?.body?.is_global === isGlobal,
      );
    }

    return filtered;
  });

  let paginatedWarranties = $derived.by(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredWarranties.slice(startIndex, endIndex);
  });

  let totalPages = $derived.by(() => {
    return Math.ceil(filteredWarranties.length / itemsPerPage);
  });

  $effect(() => {
    searchTerm;
    statusFilter;
    scopeFilter;
    totalWarrantiesCount = filteredWarranties.length;
    currentPage = 1;
  });

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  function getItemDescription(item: any): string {
    const description = item.attributes?.description;
    if (!description) return "-";
    return description[$locale] || description.en || description.ar || "-";
  }

  function getSellerDisplayName(seller: any): string {
    if (!seller) return "";
    return getLocalizedDisplayName(seller, $locale);
  }

  onMount(async () => {
    await Promise.all([loadSellers(), loadBrands()]);
    if (!selectedSeller) {
      selectedSeller = "all";
      await loadSellerWarranties(true);
    }
  });

  async function loadBrands() {
    isLoadingBrands = true;
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
        brands = response.records;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      isLoadingBrands = false;
    }
  }

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "warranties",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        sellers = response.records.filter(
          (record) => record.resource_type === "folder",
        );
      }
    } catch (error) {
      console.error("Error loading sellers:", error);
      errorToastMessage("Error loading sellers");
    } finally {
      isLoadingSellers = false;
    }
  }

  async function loadSellerWarranties(reset = true) {
    if (reset) {
      warranties = [];
    }

    if (!selectedSeller) {
      return;
    }

    if (selectedSeller === "all") {
      isLoadingWarranties = true;
      try {
        const allWarranties = [];

        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `warranties/${seller.shortname}`,
              "managed",
              100,
              0,
              true,
            );

            if (response?.records) {
              const processedRecords = response.records.map((record) => ({
                ...record,
                seller_shortname: seller.shortname,
                seller_displayname: getSellerDisplayName(seller),
              }));
              allWarranties.push(...processedRecords);
            }
          } catch (error) {
            console.error(
              `Error loading warranties for ${seller.shortname}:`,
              error,
            );
          }
        }

        warranties = allWarranties;
      } catch (error) {
        console.error("Error loading warranties:", error);
        errorToastMessage("Error loading warranties");
      } finally {
        isLoadingWarranties = false;
      }
      return;
    }

    isLoadingWarranties = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `warranties/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const processedWarranties = [];

      if (response?.records) {
        const seller = sellers.find((s) => s.shortname === selectedSeller);
        const processedRecords = response.records.map((record) => ({
          ...record,
          seller_shortname: selectedSeller,
          seller_displayname: getSellerDisplayName(seller),
        }));
        processedWarranties.push(...processedRecords);
      }

      warranties = processedWarranties;
    } catch (error) {
      console.error("Error loading warranties:", error);
      errorToastMessage("Error loading warranties");
    } finally {
      isLoadingWarranties = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerWarranties(true);
    }
  });

  function formatDate(dateString: string): string {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString($locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  function truncateText(text: string, maxLength: number = 100): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
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

  function openCreateModal() {
    warrantyForm = {
      displaynameEn: "",
      displaynameAr: "",
      displaynameKu: "",
      descriptionEn: "",
      descriptionAr: "",
      descriptionKu: "",
      isGlobal: true,
      brandShortname: "",
      sellerShortname: "",
      isActive: true,
    };
    showCreateModal = true;
  }

  function openEditModal(warranty: any) {
    selectedWarranty = warranty;
    const displayname = warranty.attributes?.displayname || {};
    const description = warranty.attributes?.description || {};
    const body = warranty.attributes?.payload?.body || {};

    warrantyForm = {
      displaynameEn: displayname.en || "",
      displaynameAr: displayname.ar || "",
      displaynameKu: displayname.ku || "",
      descriptionEn: description.en || "",
      descriptionAr: description.ar || "",
      descriptionKu: description.ku || "",
      isGlobal: body.is_global !== false,
      brandShortname: body.brand_shortname || "",
      sellerShortname: "",
      isActive: warranty.attributes?.is_active ?? true,
    };
    showEditModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedWarranty = null;
  }

  function openDeleteModal(warranty: any) {
    selectedWarranty = warranty;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedWarranty = null;
  }

  function toggleFilters(event: Event) {
    event.stopPropagation();
    showFilters = !showFilters;
  }

  function closeFilters() {
    if (showFilters) {
      showFilters = false;
    }
  }

  function handleFiltersPanelClick(event: Event) {
    event.stopPropagation();
  }

  async function submitCreateWarranty() {
    if (!warrantyForm.displaynameEn || !warrantyForm.descriptionEn) {
      errorToastMessage("Please fill in English name and description");
      return;
    }

    if (!warrantyForm.isGlobal && !warrantyForm.brandShortname) {
      errorToastMessage("Please select a brand for brand-specific warranty");
      return;
    }

    if (!warrantyForm.sellerShortname) {
      errorToastMessage("Please select a seller");
      return;
    }

    try {
      isLoadingWarranties = true;
      const warrantyData = {
        displayname_en: warrantyForm.displaynameEn,
        displayname_ar: warrantyForm.displaynameAr || null,
        displayname_ku: warrantyForm.displaynameKu || null,
        description_en: warrantyForm.descriptionEn,
        description_ar: warrantyForm.descriptionAr || null,
        description_ku: warrantyForm.descriptionKu || null,
        body: {
          is_global: warrantyForm.isGlobal,
          brand_shortname: warrantyForm.isGlobal
            ? null
            : warrantyForm.brandShortname,
        },
        tags: [],
        is_active: warrantyForm.isActive,
      };

      await createEntity(
        warrantyData,
        website.main_space,
        `warranties/${warrantyForm.sellerShortname}`,
        ResourceType.content,
        "",
        "",
      );

      successToastMessage("Warranty created successfully!");

      closeCreateModal();
      await loadSellerWarranties(true);
    } catch (error) {
      console.error("Error creating warranty:", error);
      errorToastMessage("Failed to create warranty");
    } finally {
      isLoadingWarranties = false;
    }
  }

  async function submitUpdateWarranty() {
    if (!selectedWarranty) return;

    if (!warrantyForm.displaynameEn || !warrantyForm.descriptionEn) {
      errorToastMessage("Please fill in English name and description");
      return;
    }

    if (!warrantyForm.isGlobal && !warrantyForm.brandShortname) {
      errorToastMessage("Please select a brand for brand-specific warranty");
      return;
    }

    try {
      isLoadingWarranties = true;
      const warrantyData = {
        displayname_en: warrantyForm.displaynameEn,
        displayname_ar: warrantyForm.displaynameAr || null,
        displayname_ku: warrantyForm.displaynameKu || null,
        description_en: warrantyForm.descriptionEn,
        description_ar: warrantyForm.descriptionAr || null,
        description_ku: warrantyForm.descriptionKu || null,
        body: {
          is_global: warrantyForm.isGlobal,
          brand_shortname: warrantyForm.isGlobal
            ? null
            : warrantyForm.brandShortname,
        },
        tags: selectedWarranty.attributes?.tags || [],
        is_active: warrantyForm.isActive,
      };

      await updateEntity(
        selectedWarranty.shortname,
        website.main_space,
        selectedWarranty.subpath,
        selectedWarranty.resource_type,
        warrantyData,
        "",
        "",
      );

      successToastMessage("Warranty updated successfully!");
      closeEditModal();
      await loadSellerWarranties(true);
    } catch (error) {
      console.error("Error updating warranty:", error);
      errorToastMessage("Failed to update warranty");
    } finally {
      isLoadingWarranties = false;
    }
  }

  async function handleDeleteWarranty() {
    if (!selectedWarranty) return;

    try {
      await deleteEntity(
        selectedWarranty.shortname,
        website.main_space,
        selectedWarranty.subpath,
        selectedWarranty.resource_type,
      );

      successToastMessage("Warranty deleted successfully!");
      closeDeleteModal();
      await loadSellerWarranties(true);
    } catch (error) {
      console.error("Error deleting warranty:", error);
      errorToastMessage("Failed to delete warranty");
    }
  }
  // Dropdown states
  let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);

  function closeAllDropdowns() {
    isFiltersOpen = false;
    isActionsOpen = false;
  }

  function toggleFiltersNew() {
    isActionsOpen = false;
    isFiltersOpen = !isFiltersOpen;
  }

  function toggleActions() {
    isFiltersOpen = false;
    isActionsOpen = !isActionsOpen;
  }

  // Optional: count active filters to show a badge on Filters button
  function activeFiltersCount() {
    let n = 0;
    if (selectedSeller && selectedSeller !== "all") n++;
    if (statusFilter && statusFilter !== "all") n++;
    if (scopeFilter && scopeFilter !== "all") n++;
    return n;
  }

  function resetFilters() {
    selectedSeller = "all";
    statusFilter = "all";
    scopeFilter = "all";
  }

  let openActionsFor = $state<string | null>(null);

  function getRowId(item: any) {
    return String(
      item.uuid ?? item.id ?? item.shortname ?? crypto.randomUUID(),
    );
  }

  function toggleTableActions(item: any) {
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

<svelte:window onclick={closeFilters} />

<div class="warranties-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
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
            d="M17.466 4.59827C17.8099 4.46724 18.1901 4.46724 18.534 4.59827L29.034 8.59827C29.6227 8.82252 30.0085 9.3907 29.9999 10.0206C29.9425 14.1982 28.9029 18.3024 26.9663 21.9912C25.0296 25.68 22.2516 28.8474 18.862 31.2276C18.3447 31.5908 17.6553 31.5908 17.138 31.2276C13.7484 28.8474 10.9704 25.68 9.03372 21.9912C7.09714 18.3024 6.05746 14.1982 6.00014 10.0206C5.9915 9.3907 6.37734 8.82252 6.96601 8.59827L17.466 4.59827ZM9.03706 11.0196C9.23062 14.3659 10.1343 17.6336 11.6899 20.5967C13.2387 23.5468 15.3928 26.1169 18 28.1364C20.6072 26.1169 22.7613 23.5468 24.3101 20.5967C25.8657 17.6336 26.7694 14.3659 26.9629 11.0196L18 7.60516L9.03706 11.0196Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.total_warranties") || "Total Warranties"}
        </h3>

        <p class="stat-value">
          {formatNumber(warranties.length, $locale)}
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
        <h3 class="stat-title">
          {$_("admin.active_warranties") || "Active"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            warranties.filter((w) => w.attributes?.is_active).length,
            $locale,
          )}
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.global_warranties") || "Global"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            warranties.filter((w) => w.attributes?.payload?.body?.is_global)
              .length,
            $locale,
          )}
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
            d="M18.4612 7.5C18.4611 7.5 18.4612 7.5 18.4612 7.5V7.5ZM18.4744 7.50001L27.0568 7.51047C27.0578 7.51048 27.0588 7.51049 27.0598 7.5105C27.4433 7.51362 27.8101 7.66835 28.0799 7.94096C28.3505 8.21429 28.5016 8.58379 28.5 8.96838L28.5 17.2208C28.4868 17.2332 28.4738 17.2458 28.461 17.2587L17.328 28.483L7.50172 18.57L18.4744 7.50001ZM18.4688 4.50001C18.4684 4.50001 18.4692 4.50001 18.4688 4.50001L27.0751 4.51051C28.2543 4.51769 29.3824 4.99241 30.212 5.83046C31.0409 6.66778 31.504 7.79948 31.5 8.97757C31.5 8.97859 31.5 8.97961 31.5 8.98063L30 8.9745H31.5V8.97757V17.2243C31.5 17.6346 31.4156 18.0407 31.2521 18.417C31.093 18.7829 30.8624 19.1131 30.574 19.3884L30.591 19.3713L29.526 18.315L30.5491 19.4119C30.5575 19.4041 30.5658 19.3963 30.574 19.3884L19.4336 30.6201L18.3676 29.5652L19.4325 30.6213C19.1575 30.8989 18.8303 31.1193 18.4698 31.2699C18.1087 31.4207 17.7214 31.4985 17.3301 31.4987C16.9389 31.499 16.5514 31.4218 16.1902 31.2715C15.8289 31.1212 15.501 30.9009 15.2254 30.6232L5.36657 20.6774L6.43048 19.62L5.36517 20.676C4.80937 20.116 4.49744 19.359 4.49744 18.57C4.49744 17.7807 4.80962 17.0234 5.36584 16.4633L16.3644 5.36719C16.6409 5.09132 16.9691 4.87273 17.3302 4.72392C17.6909 4.57526 18.0786 4.49918 18.4688 4.50001ZM21.8745 12.6672C21.8745 11.8388 22.5461 11.1672 23.3745 11.1672H23.3895C24.2179 11.1672 24.8895 11.8388 24.8895 12.6672C24.8895 13.4957 24.2179 14.1672 23.3895 14.1672H23.3745C22.5461 14.1672 21.8745 13.4957 21.8745 12.6672Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin.brand_specific") || "Brand Specific"}
        </h3>
        <p class="stat-value">
          {formatNumber(
            warranties.filter((w) => !w.attributes?.payload?.body?.is_global)
              .length,
            $locale,
          )}
        </p>
      </div>
    </div>
  </div>
  <div
    class="flex flex-col md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6 search-table_header"
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
          placeholder={$_("admin.search_warranties") || "Search warranties..."}
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

    <!-- RIGHT: Filters + Actions + Create -->
    <div class="flex items-end gap-3 justify-end">
      <!-- CREATE WARRANTY (same condition) -->
      <button
        type="button"
        onclick={openCreateModal}
        class="inline-flex items-center justify-center
          h-9 px-3 py-2
          bg-[#3C307F] text-white text-sm font-medium
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          hover:bg-[#2f2666]
          transition-colors duration-200"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
          <path
            fill-rule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="ml-2"
          >{$_("admin.create_warranty") || "Create warranty"}</span
        >
      </button>
      <!-- FILTERS DROPDOWN (Seller + Status + Scope) -->
      <div class="relative">
        <button
          type="button"
          onclick={toggleFiltersNew}
          class="h-9 inline-flex items-center justify-between
          px-3 py-2 min-w-[160px]
          bg-[#F9FAFB] border border-[#E5E7EB]
          rounded-[12px]
          shadow-[0px_1px_0.5px_0.05px_#1D293D05]
          text-sm text-gray-700 hover:bg-gray-50"
        >
          <span class="truncate inline-flex items-center gap-2">
            {$_("common.filters") || "Filters"}

            {#if activeFiltersCount() > 0}
              <span
                class="inline-flex items-center justify-center px-2 h-5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
              >
                {activeFiltersCount()}
              </span>
            {/if}
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

        {#if isFiltersOpen}
          <div
            class="absolute right-0 z-20 mt-2 w-[360px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <!-- Seller -->
              <div class="md:col-span-2">
                <label
                  class="block text-xs font-medium text-gray-600 mb-1"
                  for="seller-filter"
                >
                  {$_("admin.seller") || "Seller"}
                </label>

                <select
                  id="seller-filter"
                  bind:value={selectedSeller}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                >
                  <option value="all"
                    >{$_("admin.all_sellers") || "All Sellers"}</option
                  >
                  <option value=""
                    >{$_("admin.choose_seller") || "Choose a seller..."}</option
                  >

                  {#each sellers as seller}
                    <option value={seller.shortname}>
                      {getSellerDisplayName(seller)}
                    </option>
                  {/each}
                </select>
              </div>

              <!-- Status -->
              <div>
                <label
                  class="block text-xs font-medium text-gray-600 mb-1"
                  for="status-filter"
                >
                  {$_("common.status") || "Status"}
                </label>

                <select
                  id="status-filter"
                  bind:value={statusFilter}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                >
                  <option value="all"
                    >{$_("admin.all_status") || "All Status"}</option
                  >
                  <option value="active"
                    >{$_("admin.active") || "Active"}</option
                  >
                  <option value="inactive"
                    >{$_("admin.inactive") || "Inactive"}</option
                  >
                </select>
              </div>

              <!-- Scope -->
              <div>
                <label
                  class="block text-xs font-medium text-gray-600 mb-1"
                  for="scope-filter"
                >
                  {$_("admin.warranty_scope") || "Scope"}
                </label>

                <select
                  id="scope-filter"
                  bind:value={scopeFilter}
                  class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                >
                  <option value="all"
                    >{$_("admin.all_scopes") || "All Scopes"}</option
                  >
                  <option value="global"
                    >{$_("admin.global") || "Global"}</option
                  >
                  <option value="brand"
                    >{$_("admin.brand_specific") || "Brand Specific"}</option
                  >
                </select>
              </div>
            </div>

            <div
              class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100"
            >
              <button
                type="button"
                onclick={resetFilters}
                class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#F9FAFB] text-gray-700 text-sm font-medium
                border border-[#E5E7EB]
                rounded-[12px]
                hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>

              <button
                type="button"
                onclick={() => (isFiltersOpen = false)}
                class="h-9 inline-flex items-center justify-center
                px-3 py-2
                bg-[#3C307F] text-white text-sm font-medium
                rounded-[12px]
                hover:bg-[#2f2666] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Warranties Table -->
  {#if isLoadingSellers}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if !selectedSeller}
    <div class="empty-state">
      <div class="empty-icon">🛡️</div>
      <h3>
        {$_("admin.select_seller_prompt") ||
          "Select a seller to view warranties"}
      </h3>
      <p>
        {$_("admin.select_seller_hint_warranties") ||
          "Choose a seller from the dropdown above"}
      </p>
    </div>
  {:else if isLoadingWarranties}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading warranties..."}</p>
    </div>
  {:else if filteredWarranties.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>{$_("admin.no_warranties") || "No warranties found"}</h3>
      <p>
        {$_("admin.no_warranties_hint") ||
          "This seller has no warranty policies yet"}
      </p>
    </div>
  {:else}
    <div class="warranties-table-container">
      <table class="warranties-table">
        <thead>
          <tr>
            <th>{$_("admin.seller") || "Seller"}</th>
            <th>{$_("admin.warranty_name") || "Warranty Name"}</th>
            <th>{$_("admin.warranty_scope") || "Scope"}</th>
            <th>{$_("admin.brand") || "Brand"}</th>
            <th>{$_("admin.warranty_terms") || "Terms"}</th>
            <th>{$_("common.status") || "Status"}</th>
            <th>{$_("admin.created") || "Created"}</th>
          </tr>
        </thead>
        <tbody class="bg-white">
          {#each paginatedWarranties as warranty (warranty.uuid)}
            <tr class="hover:bg-gray-50 transition-colors duration-200">
              <!-- Seller (avatar + seller + warranty name below) -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-2.5">
                  <div class="min-w-0">
                    <div
                      class="truncate"
                      style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
                      title={warranty.seller_displayname ||
                        warranty.seller_shortname ||
                        ""}
                    >
                      {warranty.seller_displayname || warranty.seller_shortname}
                    </div>

                    <div
                      class="truncate mt-1"
                      style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                      title={getItemDisplayName(warranty)}
                    >
                      {getItemDisplayName(warranty)}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Warranty Name (keep as its own column if you want it separate) -->
              <td class="px-6 py-4">
                <div
                  class="truncate"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  title={getItemDisplayName(warranty)}
                >
                  {getItemDisplayName(warranty)}
                </div>
              </td>

              <!-- Scope pill -->
              <td class="px-6 py-4">
                {#if warranty.attributes?.payload?.body?.is_global === true}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                  >
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                    >
                      {$_("admin.global") || "Global"}
                    </span>
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#F3F4F6;border-color:#E5E7EB;"
                  >
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#101828;"
                    >
                      {$_("admin.brand_specific") || "Brand Specific"}
                    </span>
                  </span>
                {/if}
              </td>

              <!-- Brand -->
              <td class="px-6 py-4">
                {#if warranty.attributes?.payload?.body?.is_global !== true && warranty.attributes?.payload?.body?.brand_shortname}
                  <span
                    class="inline-flex items-center rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#F3F4F6;border-color:#E5E7EB;"
                  >
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#101828;"
                    >
                      {warranty.attributes.payload.body.brand_shortname}
                    </span>
                  </span>
                {:else}
                  <span style="color:#4A5565;">-</span>
                {/if}
              </td>

              <!-- Terms (truncate + tooltip full) -->
              <td class="px-6 py-4">
                <div
                  class="truncate max-w-[360px]"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  title={getItemDescription(warranty)}
                >
                  {truncateText(getItemDescription(warranty), 30)}
                </div>
              </td>

              <!-- Status pill -->
              <td class="px-6 py-4">
                {#if warranty.attributes?.is_active === true}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#ECFDF5;border-color:#A4F4CF;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.85885 3.40183C10.0511 3.60001 10.0464 3.91656 9.84818 4.10885L5.21017 8.60885C5.01621 8.79704 4.70781 8.79705 4.51384 8.60887L2.15184 6.31737C1.95365 6.12509 1.94885 5.80854 2.14113 5.61034C2.33341 5.41215 2.64996 5.40735 2.84816 5.59963L4.86198 7.55335L9.15183 3.39115C9.35001 3.19886 9.66656 3.20364 9.85885 3.40183Z"
                        fill="#004F3B"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#004F3B;"
                    >
                      {$_("admin.active") || "Active"}
                    </span>
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#FFF8F1;border-color:#FCD9BD;"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M9.32268 2.64556C9.51843 2.84033 9.51922 3.15692 9.32445 3.35267L6.70534 5.98493L9.35444 8.64733C9.54921 8.84308 9.54842 9.15966 9.35267 9.35443C9.15692 9.5492 8.84033 9.54841 8.64556 9.35266L6 6.69381L3.35444 9.35266C3.15967 9.54841 2.84308 9.5492 2.64733 9.35443C2.45158 9.15966 2.45079 8.84308 2.64556 8.64733L5.29466 5.98493L2.67555 3.35267C2.48078 3.15692 2.48157 2.84034 2.67732 2.64556C2.87307 2.45079 3.18966 2.45159 3.38443 2.64734L6 5.27604L8.61557 2.64733C8.81035 2.45158 9.12693 2.45079 9.32268 2.64556Z"
                        fill="#771D1D"
                      />
                    </svg>
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#771D1D;"
                    >
                      {$_("admin.inactive") || "Inactive"}
                    </span>
                  </span>
                {/if}
              </td>

              <!-- Created (calendar + date) -->
              <td class="px-6 py-4">
                <div
                  class="inline-flex items-center gap-2"
                  style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M4.66667 2C5.03486 2 5.33333 2.29848 5.33333 2.66667V3.33333H7.33333V2.66667C7.33333 2.29848 7.63181 2 8 2C8.36819 2 8.66667 2.29848 8.66667 2.66667V3.33333H10.6667V2.66667C10.6667 2.29848 10.9651 2 11.3333 2C11.7015 2 12 2.29848 12 2.66667V3.33333H12.6667C13.403 3.33333 14 3.93029 14 4.66667V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V4.66667C2 3.93029 2.59695 3.33333 3.33333 3.33333H4L4 2.66667C4 2.29848 4.29848 2 4.66667 2ZM4 4.66667L3.33333 4.66667V6H12.6667V4.66667H12C12 5.03486 11.7015 5.33333 11.3333 5.33333C10.9651 5.33333 10.6667 5.03486 10.6667 4.66667H8.66667C8.66667 5.03486 8.36819 5.33333 8 5.33333C7.63181 5.33333 7.33333 5.03486 7.33333 4.66667H5.33333C5.33333 5.03486 5.03486 5.33333 4.66667 5.33333C4.29848 5.33333 4 5.03486 4 4.66667ZM12.6667 7.33333H3.33333V12.6667H12.6667V7.33333ZM4.66667 8.66667C4.66667 8.29848 4.96514 8 5.33333 8H5.34C5.70819 8 6.00667 8.29848 6.00667 8.66667V8.67333C6.00667 9.04152 5.70819 9.34 5.34 9.34H5.33333C4.96514 9.34 4.66667 9.04152 4.66667 8.67333V8.66667ZM7.33333 8.66667C7.33333 8.29848 7.63181 8 8 8H8.00667C8.37486 8 8.67333 8.29848 8.67333 8.66667V8.67333C8.67333 9.04152 8.37486 9.34 8.00667 9.34H8C7.63181 9.34 7.33333 9.04152 7.33333 8.67333V8.66667ZM10 8.66667C10 8.29848 10.2985 8 10.6667 8H10.6733C11.0415 8 11.34 8.29848 11.34 8.66667V8.67333C11.34 9.04152 11.0415 9.34 10.6733 9.34H10.6667C10.2985 9.34 10 9.04152 10 8.67333V8.66667ZM4.66667 11.3333C4.66667 10.9651 4.96514 10.6667 5.33333 10.6667H5.34C5.70819 10.6667 6.00667 10.9651 6.00667 11.3333V11.34C6.00667 11.7082 5.70819 12.0067 5.34 12.0067H5.33333C4.96514 12.0067 4.66667 11.7082 4.66667 11.34V11.3333ZM7.33333 11.3333C7.33333 10.9651 7.63181 10.6667 8 10.6667H8.00667C8.37486 10.6667 8.67333 10.9651 8.67333 11.3333V11.34C8.67333 11.7082 8.37486 12.0067 8.00667 12.0067H8C7.63181 12.0067 7.33333 11.7082 7.33333 11.34V11.3333ZM10 11.3333C10 10.9651 10.2985 10.6667 10.6667 10.6667H10.6733C11.0415 10.6667 11.34 10.9651 11.34 11.3333V11.34C11.34 11.7082 11.0415 12.0067 10.6733 12.0067H10.6667C10.2985 12.0067 10 11.7082 10 11.34V11.3333Z"
                      fill="#6A7282"
                    />
                  </svg>

                  <span>{formatDateDMY(warranty.attributes?.created_at)}</span>
                </div>
              </td>

              <!-- Actions (... dropdown) -->
              <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
                <div
                  class="relative flex justify-end"
                  onclick={(e) => e.stopPropagation()}
                >
                  <button
                    class="h-8 w-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-[#f4f5fe] hover:border hover:border-[#3C307F] transition"
                    aria-label="Actions"
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(warranty)}
                    onclick={() => toggleTableActions(warranty)}
                  >
                    <span class="text-xl leading-none">…</span>
                  </button>

                  {#if openActionsFor === getRowId(warranty)}
                    <div
                      class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                      role="menu"
                    >
                      <!-- Edit -->
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                        class:flex-row-reverse={$isRTL}
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openEditModal(warranty);
                        }}
                        role="menuitem"
                      >
                        <!-- Pencil Icon -->
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          class="w-4 h-4 text-gray-500"
                        >
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M15.5763 5.55905L14.1547 7.028L15.5563 8.42618C15.5577 8.42761 15.5592 8.42904 15.5606 8.43048L17.0227 9.88908L18.4245 8.44058L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM15.6318 11.3265L14.8691 10.5657L10.0378 15.6235L10.7674 16.3531L15.6318 11.3265ZM8.92782 17.3419L7.95914 16.3732C7.95553 16.3699 7.95195 16.3665 7.94838 16.3631C7.93349 16.3489 7.91913 16.3343 7.90531 16.3194L6.93719 15.3513L5.9421 18.337L8.92782 17.3419ZM7.90282 13.4885L8.62322 14.2089L13.4529 9.15285L12.7638 8.46539L7.90282 13.4885ZM12.0308 6.34678C12.0319 6.34571 12.0329 6.34463 12.0339 6.34356L14.1455 4.16158L14.1573 4.14958C14.9124 3.39511 15.9362 2.97131 17.0036 2.97131C18.071 2.97131 19.0948 3.39511 19.8499 4.14958L19.8505 4.15018C20.605 4.90529 21.0288 5.92906 21.0288 6.99649C21.0288 8.06106 20.6072 9.0822 19.8566 9.83672L11.4977 18.4744C11.3859 18.59 11.2479 18.6768 11.0953 18.7277L4.67729 20.8667C4.31797 20.9864 3.92182 20.8929 3.654 20.6251C3.38618 20.3573 3.29266 19.9611 3.41241 19.6018L5.55141 13.1838C5.59875 13.0418 5.67738 12.9122 5.7815 12.8046L12.0308 6.34678Z"
                            fill="currentColor"
                          />
                        </svg>

                        <span>{$_("common.edit") || "Edit"}</span>
                      </button>

                      <!-- Delete -->
                      <button
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                        class:flex-row-reverse={$isRTL}
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openDeleteModal(warranty);
                        }}
                        role="menuitem"
                      >
                        <!-- Trash Icon -->
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          x="0px"
                          y="0px"
                          class="w-4 h-4"
                          viewBox="0,0,256,256"
                        >
                          <g
                            fill="#fa5252"
                            fill-rule="nonzero"
                            stroke="none"
                            stroke-width="1"
                            stroke-linecap="butt"
                            stroke-linejoin="miter"
                            stroke-miterlimit="10"
                            stroke-dasharray=""
                            stroke-dashoffset="0"
                            font-family="none"
                            font-weight="none"
                            font-size="none"
                            text-anchor="none"
                            style="mix-blend-mode: normal"
                            ><g transform="scale(2,2)"
                              ><path
                                d="M49,1c-1.66,0 -3,1.34 -3,3c0,1.66 1.34,3 3,3h30c1.66,0 3,-1.34 3,-3c0,-1.66 -1.34,-3 -3,-3zM24,15c-7.17,0 -13,5.83 -13,13c0,7.17 5.83,13 13,13h77v63c0,9.37 -7.63,17 -17,17h-40c-9.37,0 -17,-7.63 -17,-17v-52c0,-1.66 -1.34,-3 -3,-3c-1.66,0 -3,1.34 -3,3v52c0,12.68 10.32,23 23,23h40c12.68,0 23,-10.32 23,-23v-63.35937c5.72,-1.36 10,-6.50062 10,-12.64062c0,-7.17 -5.83,-13 -13,-13zM24,21h80c3.86,0 7,3.14 7,7c0,3.86 -3.14,7 -7,7h-80c-3.86,0 -7,-3.14 -7,-7c0,-3.86 3.14,-7 7,-7zM50,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3zM78,55c-1.66,0 -3,1.34 -3,3v46c0,1.66 1.34,3 3,3c1.66,0 3,-1.34 3,-3v-46c0,-1.66 -1.34,-3 -3,-3z"
                              ></path></g
                            ></g
                          >
                        </svg>

                        <span>{$_("common.delete") || "Delete"}</span>
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
          {$_("common.showing") || "Showing"}
          {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
          -
          {formatNumber(
            Math.min(currentPage * itemsPerPage, filteredWarranties.length),
            $locale,
          )}
          {$_("common.of") || "of"}
          {formatNumber(filteredWarranties.length, $locale)}
          {$_("admin.warranties") || "warranties"}
        </div>

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
      </div>
    {/if}
  {/if}
</div>

<WarrantyModal
  bind:show={showCreateModal}
  isRTL={$isRTL}
  bind:warrantyForm
  {brands}
  {sellers}
  {isLoadingBrands}
  onClose={closeCreateModal}
  onSubmit={submitCreateWarranty}
  getLocalizedDisplayName={getItemDisplayName}
  isEditMode={false}
/>

<WarrantyModal
  bind:show={showEditModal}
  isRTL={$isRTL}
  bind:warrantyForm
  {brands}
  sellers={[]}
  {isLoadingBrands}
  onClose={closeEditModal}
  onSubmit={submitUpdateWarranty}
  getLocalizedDisplayName={getItemDisplayName}
  isEditMode={true}
/>

<DeleteWarrantyModal
  bind:show={showDeleteModal}
  onClose={closeDeleteModal}
  onConfirm={handleDeleteWarranty}
  warranty={selectedWarranty}
  getDisplayName={getItemDisplayName}
/>

<style>
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 20px;
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
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
    font-weight: 500;
  }

  .btn-create-warranty {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #3c307f;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-create-warranty:hover {
    background: #2f2567;
    transform: translateY(-1px);
  }

  .btn-create-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    border-color: #9ca3af;
    background: #f9fafb;
  }

  .action-btn.edit {
    color: #1d4ed8;
    border-color: rgba(29, 78, 216, 0.35);
  }

  .action-btn.delete {
    color: #dc2626;
    border-color: rgba(220, 38, 38, 0.35);
  }
</style>

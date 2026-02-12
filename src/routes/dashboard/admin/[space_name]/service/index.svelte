<script lang="ts">
  import { onMount } from "svelte";
  import { derived } from "svelte/store";
  import { _, locale } from "@/i18n";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import {
    getSpaceContents,
    updateDmartEntity,
    createEntity,
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import "./index.css";
  import { website } from "@/config";
  import { ResourceType } from "@edraj/tsdmart";

  let serviceFolders = $state<any[]>([]);
  let selectedFolder = $state("");
  let previousFolder = $state("");
  let services = $state<any[]>([]);
  let isLoadingFolders = $state(true);
  let isLoadingServices = $state(false);

  let searchTerm = $state("");
  let statusFilter = $state("all");
  let categoryFilter = $state("all");

  let showCreateModal = $state(false);
  let isSaving = $state(false);

  let totalServicesCount = $state(0);
  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  // Header dropdowns (same edits)
  let isFiltersOpen = $state(false);
  let isActionsOpen = $state(false);
  let openRowActionsFor = $state<string | null>(null);

  let newService = $state({
    key: "",
    name: { en: "", ar: "" },
    cost: 0,
    is_active: true,
    state_shortname: "optional",
    category_shortname: "",
  });

  // -----------------------------
  // RTL
  // -----------------------------
  const isRTL = derived(locale, ($l) => $l === "ar" || $l === "ku");

  // -----------------------------
  // Derived: categories
  // -----------------------------
  const uniqueCategories = $derived.by(() => {
    const categories = new Set<string>();
    services.forEach((service) => {
      if (service.category_shortname)
        categories.add(service.category_shortname);
    });
    return Array.from(categories);
  });

  // -----------------------------
  // Filtering
  // -----------------------------
  let filteredServices = $derived.by(() => {
    let filtered = [...services];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const en = item.name?.en?.toLowerCase() || "";
        const ar = item.name?.ar?.toLowerCase() || "";
        return en.includes(s) || ar.includes(s);
      });
    }

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter((item) => item.is_active === isActive);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.category_shortname === categoryFilter,
      );
    }

    return filtered;
  });

  let paginatedServices = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredServices.slice(start, start + itemsPerPage);
  });

  let totalPages = $derived.by(() =>
    Math.ceil(filteredServices.length / itemsPerPage),
  );

  $effect(() => {
    searchTerm;
    statusFilter;
    categoryFilter;
    totalServicesCount = filteredServices.length;
    currentPage = 1;
  });

  // -----------------------------
  // Stats (same style as discounts)
  // -----------------------------
  let totalStats = $derived.by(() => filteredServices.length);

  let activeStats = $derived.by(
    () => filteredServices.filter((s) => s.is_active === true).length,
  );

  let inactiveStats = $derived.by(
    () => filteredServices.filter((s) => s.is_active !== true).length,
  );

  let avgCostStats = $derived.by(() => {
    const nums = filteredServices
      .map((s) => Number(s.cost ?? 0))
      .filter((n) => Number.isFinite(n));

    if (!nums.length) return "-";
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return `${avg.toLocaleString()} ${$_("admin.currency") || "IQD"}`;
  });

  // -----------------------------
  // Helpers
  // -----------------------------
  function getFolderDisplayName(folder: any): string {
    if (!folder) return "";
    return getLocalizedDisplayName(folder, $locale);
  }

  function isGlobalFolder(shortname: string): boolean {
    return shortname === "global";
  }

  function generateKey() {
    return Math.random().toString(36).substr(2, 16);
  }

  function formatCurrency(amount: number): string {
    return Number(amount || 0).toLocaleString();
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

  // Dropdown controls
  function closeAllDropdowns() {
    isFiltersOpen = false;
    isActionsOpen = false;
    openRowActionsFor = null;
  }

  function toggleHeaderFilters(e?: Event) {
    e?.stopPropagation();
    isActionsOpen = false;
    isFiltersOpen = !isFiltersOpen;
  }

  function toggleHeaderActions(e?: Event) {
    e?.stopPropagation();
    isFiltersOpen = false;
    isActionsOpen = !isActionsOpen;
  }

  function toggleRowActions(id: string, e?: Event) {
    e?.stopPropagation();
    openRowActionsFor = openRowActionsFor === id ? null : id;
  }

  function activeFiltersCount() {
    let n = 0;
    if (statusFilter !== "all") n++;
    if (categoryFilter !== "all") n++;
    return n;
  }

  function resetFilters() {
    statusFilter = "all";
    categoryFilter = "all";
  }

  // Optional action: CSV export (stub)
  function downloadServicesCsv() {
    successToastMessage("CSV download started (hook your exporter).");
  }

  // Pagination
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) currentPage = page;
  }
  function nextPage() {
    if (currentPage < totalPages) currentPage++;
  }
  function previousPage() {
    if (currentPage > 1) currentPage--;
  }

  // -----------------------------
  // Loading
  // -----------------------------
  onMount(async () => {
    await loadServiceFolders();
  });

  async function loadServiceFolders() {
    isLoadingFolders = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        "service",
        "managed",
        1000,
        0,
        true,
      );

      if (response?.records) {
        serviceFolders = response.records.filter(
          (r: any) => r.resource_type === "folder",
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
    if (reset) services = [];

    if (!selectedFolder) return;

    // All folders
    if (selectedFolder === "all") {
      isLoadingServices = true;
      try {
        const allServices: any[] = [];

        for (const folder of serviceFolders) {
          try {
            const response: any = await getSpaceContents(
              website.main_space,
              `service/${folder.shortname}`,
              "managed",
              100,
              0,
              true,
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
              error,
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

    // Single folder
    isLoadingServices = true;
    try {
      const response: any = await getSpaceContents(
        website.main_space,
        `service/${selectedFolder}`,
        "managed",
        100,
        0,
        true,
      );

      const processed: any[] = [];
      if (response?.records) {
        const folder = serviceFolders.find(
          (f: any) => f.shortname === selectedFolder,
        );

        for (const record of response.records) {
          if (record.shortname === "config") {
            const body = record.attributes?.payload?.body;
            if (body?.items && Array.isArray(body.items)) {
              for (const item of body.items) {
                processed.push({
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

      services = processed;
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

  // -----------------------------
  // Create modal
  // -----------------------------
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
      const response: any = await getSpaceContents(
        website.main_space,
        "service/global",
        "managed",
        100,
        0,
        true,
      );

      let existingConfig: any = null;
      let existingItems: any[] = [];

      if (response?.records) {
        existingConfig = response.records.find(
          (record: any) => record.shortname === "config",
        );
        if (existingConfig) {
          existingItems = existingConfig.attributes?.payload?.body?.items || [];
        }
      }

      const updatedItems = [...existingItems, { ...newService }];

      if (existingConfig) {
        const result = await updateDmartEntity(
          "config",
          website.main_space,
          "service/global",
          ResourceType.content,
          { body: { items: updatedItems } },
          false,
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
          "json",
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
</script>

<svelte:window onclick={closeAllDropdowns} />

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
      </div>
    </div>

    <!-- STATS (before header controls) -->
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
              d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
              fill="#3C307F"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Total Services</h3>
          <p class="stat-value">{totalStats}</p>
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
          <h3 class="stat-title">Active Services</h3>
          <p class="stat-value">{activeStats}</p>
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
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Inactive Services</h3>
          <p class="stat-value">{inactiveStats}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="bg-icon rounded-lg flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.00002 14.6666V19.9999M24 11.9999V17.3332M22.6667 5.33325C25.9316 5.33325 27.6975 5.83293 28.5762 6.22051C28.6932 6.27212 28.7517 6.29793 28.9206 6.45908C29.0218 6.55568 29.2065 6.83911 29.2541 6.9707C29.3334 7.19024 29.3334 7.31024 29.3334 7.55024V21.8814C29.3334 23.0931 29.3334 23.699 29.1516 24.0104C28.9668 24.3272 28.7886 24.4744 28.4426 24.5962C28.1025 24.7158 27.416 24.5839 26.0429 24.3201C25.0819 24.1355 23.942 23.9999 22.6667 23.9999C18.6667 23.9999 14.6667 26.6666 9.33335 26.6666C6.06841 26.6666 4.30251 26.1669 3.42386 25.7793C3.30685 25.7277 3.24834 25.7019 3.07949 25.5408C2.97827 25.4442 2.79351 25.1607 2.74598 25.0291C2.66669 24.8096 2.66669 24.6896 2.66669 24.4496L2.66669 10.1184C2.66669 8.9067 2.66669 8.30085 2.84839 7.98944C3.03322 7.67267 3.21147 7.52541 3.55743 7.40367C3.89754 7.28399 4.58407 7.4159 5.95713 7.67972C6.91818 7.86437 8.05799 7.99992 9.33335 7.99992C13.3334 7.99992 17.3334 5.33325 22.6667 5.33325ZM19.3334 15.9999C19.3334 17.8409 17.841 19.3332 16 19.3332C14.1591 19.3332 12.6667 17.8409 12.6667 15.9999C12.6667 14.159 14.1591 12.6666 16 12.6666C17.841 12.6666 19.3334 14.159 19.3334 15.9999Z"
              stroke="#3C307F"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="stat-content">
          <h3 class="stat-title">Avg Cost</h3>
          <p class="stat-value">{avgCostStats}</p>
        </div>
      </div>
    </div>

    <!-- SAME HEADER CONTROLS (search + filters + actions + create) -->
    <div class="bg-white rounded-t-xl w-full p-6">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-3">
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
              placeholder={$_("admin.services.search_placeholder")}
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

        <div class="flex flex-wrap items-end justify-end gap-3">
          <!-- FOLDER SELECT -->
          <div class="min-w-[240px]">
            <label
              class="block text-xs font-medium text-gray-600 mb-1"
              for="folder-filter"
            >
              {$_("admin.services.select_folder") || "Select Folder"}
            </label>
            <select
              id="folder-filter"
              bind:value={selectedFolder}
              class="w-full h-9 px-3
                bg-[#F9FAFB]
                border border-[#E5E7EB]
                rounded-[12px]
                shadow-[0px_1px_0.5px_0.05px_#1D293D05]
                text-sm"
            >
              <option value="">
                {$_("admin.services.choose_folder") || "Choose a folder..."}
              </option>
              <option value="all">
                {$_("admin.services.all_folders") || "All Folders"}
              </option>
              {#each serviceFolders as folder}
                <option value={folder.shortname}>
                  {getFolderDisplayName(folder)}
                </option>
              {/each}
            </select>
          </div>

          <!-- FILTERS DROPDOWN -->
          <div class="relative">
            <button
              type="button"
              onclick={toggleHeaderFilters}
              class="h-9 inline-flex items-center justify-between
                px-3 py-2 min-w-[160px]
                bg-[#F9FAFB] border border-[#E5E7EB]
                rounded-[12px]
                shadow-[0px_1px_0.5px_0.05px_#1D293D05]
                text-sm text-gray-700 hover:bg-gray-50"
              aria-haspopup="true"
              aria-expanded={isFiltersOpen}
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
                class="absolute right-0 z-20 mt-2 w-[320px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-3"
                onclick={(e) => e.stopPropagation()}
              >
                {#if uniqueCategories.length > 0}
                  <div class="mb-3">
                    <label
                      class="block text-xs font-medium text-gray-600 mb-1"
                      for="category-filter"
                    >
                      {$_("admin.services.category")}
                    </label>
                    <select
                      id="category-filter"
                      bind:value={categoryFilter}
                      class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] text-sm"
                    >
                      <option value="all">
                        {$_("admin.services.all_categories") ||
                          "All Categories"}
                      </option>
                      {#each uniqueCategories as category}
                        <option value={category}>{category}</option>
                      {/each}
                    </select>
                  </div>
                {/if}

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

          <!-- CREATE SERVICE (only global like your old logic) -->
          {#if selectedFolder === "global"}
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span class="ml-2"
                >{$_("admin.services.create_service") || "Create Service"}</span
              >
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Table states -->
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
        <p>{$_("admin.services.no_services_description")}</p>
      </div>
    {:else}
      <div class="items-stats">
        <p>
          {$_("admin.showing") || "Showing"}
          <strong>{filteredServices.length}</strong>
          {$_("admin.services.services_count") || "services"}
          {#if selectedFolder !== "all"}
            from
            <strong>
              {getFolderDisplayName(
                serviceFolders.find((f: any) => f.shortname === selectedFolder),
              )}
            </strong>
          {/if}
        </p>
      </div>

      <div class="items-table-container overflow-x-auto">
        <table class="items-table w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.services.folder") || "Folder"}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.services.service_name") || "Service Name"}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.services.category") || "Category"}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.services.cost") || "Cost"}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("admin.services.state") || "State"}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("common.status") || "Status"}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {$_("common.actions") || "Actions"}
              </th>
            </tr>
          </thead>

          <tbody class="bg-white">
            {#each paginatedServices as service (service.folder_shortname + "-" + service.key)}
              {@const isActive = service.is_active === true}
              {@const isGlobal = isGlobalFolder(service.folder_shortname)}
              {@const rowId = service.folder_shortname + "-" + service.key}

              <tr class="hover:bg-gray-50 transition-colors duration-200">
                <!-- Folder column (same “main cell” style) -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="shrink-0 rounded-full flex items-center justify-center"
                      style="width:44px;height:44px;padding:10px 5px;background:#F3F4F6;"
                      aria-hidden="true"
                    >
                      <span
                        style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                      >
                        {(
                          service.folder_displayname ||
                          service.folder_shortname ||
                          "F"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>

                    <div class="min-w-0">
                      <div
                        class="truncate"
                        style="font-weight:500;font-size:16px;line-height:16px;color:#101828;"
                        title={service.folder_displayname ||
                          service.folder_shortname}
                      >
                        {#if isGlobal}
                          {$_("admin.services.global_services")}
                        {:else}
                          {service.folder_displayname ||
                            service.folder_shortname}
                        {/if}
                      </div>

                      <div
                        class="truncate mt-1"
                        style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                        title={service.folder_shortname}
                      >
                        {service.folder_shortname}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Service name -->
                <td class="px-6 py-4">
                  <div class="min-w-0">
                    <div
                      class="truncate"
                      style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                      title={service.name?.en || service.name?.ar || "-"}
                    >
                      {service.name?.en || service.name?.ar || "-"}
                    </div>
                    {#if service.name?.ar && service.name?.en && service.name?.en !== service.name?.ar}
                      <div
                        class="truncate mt-1"
                        style="font-weight:400;font-size:14px;line-height:14px;color:#4A5565;"
                        title={service.name?.ar}
                      >
                        {service.name.ar}
                      </div>
                    {/if}
                  </div>
                </td>

                <!-- Category pill -->
                <td class="px-6 py-4">
                  {#if service.category_shortname}
                    <span
                      class="inline-flex items-center rounded-sm border px-2 py-0.5"
                      style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                    >
                      <span
                        style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                      >
                        {service.category_shortname}
                      </span>
                    </span>
                  {:else}
                    <span class="text-gray-400">-</span>
                  {/if}
                </td>

                <!-- Cost -->
                <td class="px-6 py-4">
                  <span
                    style="font-weight:500;font-size:14px;line-height:14px;color:#101828;"
                  >
                    {formatCurrency(service.cost)}
                    {$_("admin.currency") || "IQD"}
                  </span>
                </td>

                <!-- State pill -->
                <td class="px-6 py-4">
                  <span
                    class="inline-flex items-center rounded-sm border px-2 py-0.5"
                    style="height:20px;background:#EEF6FF;border-color:#BEDBFF;"
                  >
                    <span
                      style="font-weight:500;font-size:12px;line-height:16px;color:#1C398E;"
                    >
                      {service.state_shortname}
                    </span>
                  </span>
                </td>

                <!-- Status pill -->
                <td class="px-6 py-4">
                  {#if isActive}
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
                        >{$_("admin.active") || "Active"}</span
                      >
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
                        >{$_("admin.inactive") || "Inactive"}</span
                      >
                    </span>
                  {/if}
                </td>

                <!-- Actions: only allow edit/delete on global folder -->
                <td class="px-6 py-4" onclick={(e) => e.stopPropagation()}>
                  {#if selectedFolder === "global"}
                    <div class="relative" onclick={(e) => e.stopPropagation()}>
                      <button
                        class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
                        aria-label="Actions"
                        aria-haspopup="menu"
                        aria-expanded={openRowActionsFor === rowId}
                        onclick={(e) => toggleRowActions(rowId, e)}
                      >
                        <span class="text-xl leading-none">…</span>
                      </button>

                      {#if openRowActionsFor === rowId}
                        <div
                          class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1 right-0"
                          role="menu"
                        >
                          <button
                            class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                            onclick={() => {
                              closeAllDropdowns();
                              // Hook your edit flow here if you have it
                              successToastMessage(
                                "Edit action (hook your modal).",
                              );
                            }}
                            role="menuitem"
                          >
                            {$_("common.edit") || "Edit"}
                          </button>

                          <button
                            class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-red-600"
                            onclick={() => {
                              closeAllDropdowns();
                              // Hook your delete flow here if you have it
                              successToastMessage(
                                "Delete action (hook your modal).",
                              );
                            }}
                            role="menuitem"
                          >
                            {$_("common.delete") || "Delete"}
                          </button>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-gray-400">-</span>
                  {/if}
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
            <span
              >{formatNumber(filteredServices.length, $locale)}
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
</div>

{#if showCreateModal}
  <div class="modal-overlay" onclick={closeCreateModal}>
    <div class="modal-container w-1/2 bg-white" onclick={(e) => e.stopPropagation()}>
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
          <label for="service-name-en"
            >{$_("admin.services.service_name_en")} *</label
          >
          <input
            id="service-name-en"
            type="text"
            bind:value={newService.name.en}
            placeholder={$_("admin.services.service_name_placeholder")}
          />
        </div>

        <div class="form-group">
          <label for="service-name-ar"
            >{$_("admin.services.service_name_ar")}</label
          >
          <input
            id="service-name-ar"
            type="text"
            bind:value={newService.name.ar}
            placeholder={$_("admin.services.service_name_ar_placeholder")}
          />
        </div>

        <div class="form-group">
          <label for="service-cost">{$_("admin.services.cost")} * (IQD)</label>
          <input
            id="service-cost"
            type="number"
            bind:value={newService.cost}
            min="0"
            step="1000"
          />
        </div>

        <div class="form-group">
          <label for="service-category">{$_("admin.services.category")}</label>
          <input
            id="service-category"
            type="text"
            bind:value={newService.category_shortname}
            placeholder={$_("admin.services.category_placeholder")}
          />
        </div>

        <div class="form-group">
          <label for="service-state">{$_("admin.services.state")}</label>
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
          <label for="service-active">{$_("admin.services.is_active")}</label>
        </div>
      </div>

      <div class="modal-footer">
        <button onclick={closeCreateModal} class="btn-secondary"
          >{$_("cancel")}</button
        >
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

  /* Ensure borders show under each row like the other pages */
  .items-table {
    border-collapse: collapse;
  }
  .items-table tbody tr td {
    border-bottom: 1px solid #e5e7eb;
  }
</style>

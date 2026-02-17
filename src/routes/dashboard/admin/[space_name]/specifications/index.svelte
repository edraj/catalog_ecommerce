<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
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
  import { PlusOutline } from "flowbite-svelte-icons";
  import { getLocalizedDisplayName, formatDate } from "@/lib/utils/adminUtils";
  import { formatNumber } from "@/lib/helpers";
  import { Button, LoadingSpinner, EmptyState } from "@/components/ui";
  import {
    CreateSpecificationModal,
    EditSpecificationModal,
    DeleteSpecificationModal,
  } from "@/components/modals";
  import type { SpecificationFormData } from "@/components/modals/CreateSpecificationModal.svelte";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(locale, ($l) => $l === "ar" || $l === "ku");

  let specifications = $state<any[]>([]);
  let isLoading = $state(true);

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);

  let selectedSpecification = $state<any>(null);
  let editFormData = $state<SpecificationFormData | undefined>(undefined);

  let totalSpecificationsCount = $state(0);
  let searchTerm = $state("");

  // actions dropdown (per row)
  let openDropdownId = $state<string | null>(null);

  // Pagination (client-side)
  let currentPage = $state(1);
  let itemsPerPage = $state(12);

  // ---------------- helpers ----------------
  function truncateText(text: string, max = 25) {
    const t = (text || "").trim();
    return t.length > max ? t.slice(0, max) + "..." : t;
  }

  function getSpecificationOptions(specification: any): any[] {
    const content = specification?.attributes?.payload?.body || {};
    return content?.options || [];
  }

  function getOptionsCount(specification: any) {
    return getSpecificationOptions(specification).length;
  }

  function getStatus(specification: any) {
    // keep compatible with your current data shape
    const v = specification?.attributes?.is_active;
    return v === undefined ? true : !!v;
  }

  // ---------------- derived ----------------
  let filteredSpecifications = $derived.by(() => {
    const list = specifications || [];
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) return list;

    return list.filter((spec) => {
      const displayname = (getLocalizedDisplayName(spec, $locale) || "")
        .toLowerCase()
        .trim();
      const shortname = (spec?.shortname || "").toLowerCase();
      return displayname.includes(term) || shortname.includes(term);
    });
  });

  let totalFiltered = $derived.by(() => filteredSpecifications.length);

  let totalPages = $derived.by(() =>
    Math.max(1, Math.ceil(totalFiltered / itemsPerPage)),
  );

  let paginatedSpecifications = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredSpecifications.slice(start, end);
  });

  // Stats (new style)
  let totalSpecs = $derived.by(() => specifications.length);

  let activeSpecs = $derived.by(
    () => specifications.filter((s) => getStatus(s)).length,
  );

  let inactiveSpecs = $derived.by(() => totalSpecs - activeSpecs);

  let totalOptions = $derived.by(() =>
    specifications.reduce((sum, s) => sum + getOptionsCount(s), 0),
  );

  // ---------------- lifecycle ----------------
  onMount(async () => {
    await loadSpecifications();
    window.addEventListener("click", onWindowClick);
  });

  onDestroy(() => {
    window.removeEventListener("click", onWindowClick);
  });

  async function loadSpecifications() {
    isLoading = true;
    try {
      // Load a big chunk once, then filter/paginate client-side (prevents double-pagination)
      const limit = 500;
      const offset = 0;

      const response: any = await getSpaceContents(
        website.main_space,
        "specifications",
        "managed",
        limit,
        offset,
        true,
      );

      if (response?.records) {
        specifications = response.records;
        totalSpecificationsCount =
          response.attributes?.total ?? response.records.length;
      } else {
        specifications = [];
        totalSpecificationsCount = 0;
      }
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Failed to load specifications");
    } finally {
      isLoading = false;
    }
  }

  // keep page in range
  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
  });

  // reset to first page when searching
  $effect(() => {
    (searchTerm || "").trim();
    currentPage = 1;
  });

  // ---------------- modals ----------------
  function openCreateModal() {
    showCreateModal = true;
  }
  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(specification: any) {
    selectedSpecification = specification;

    const content = specification?.attributes?.payload?.body || {};
    const displayname = specification?.attributes?.displayname || {};

    let options = content?.options || [];

    const normalizedOptions = (options || []).map((opt: any) => {
      if (opt?.name) {
        return {
          key: opt.key || Math.random().toString(36).substring(2, 15),
          name: {
            en: opt.name.en || "",
            ar: opt.name.ar || "",
            ku: opt.name.ku || "",
          },
        };
      } else if (opt?.en || opt?.ar) {
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

  function openDeleteModal(specification: any) {
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
        body: { options: validOptions, content_type: "json" },
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
      const specificationData: any = {
        displayname: {
          en: formData.displayname,
          ar: formData.displayname_ar || "",
          ku: formData.displayname_ku || "",
        },
        body: { options: validOptions },
        content_type: "json",
        tags: selectedSpecification?.attributes?.tags || [],
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

  // ---------------- pagination ----------------
  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }
  function nextPage() {
    if (currentPage < totalPages) currentPage++;
  }
  function previousPage() {
    if (currentPage > 1) currentPage--;
  }

  // ---------------- dropdown ----------------
  function toggleDropdown(shortname: string, e?: Event) {
    e?.stopPropagation?.();
    openDropdownId = openDropdownId === shortname ? null : shortname;
  }

  function closeDropdown() {
    openDropdownId = null;
  }

  function onWindowClick() {
    if (openDropdownId) closeDropdown();
  }
</script>

<div class="specifications-page" class:rtl={$isRTL}>
  {#if isLoading}
    <LoadingSpinner message={$_("common.loading") || "Loading..."} />
  {:else if specifications.length === 0}
    <EmptyState
      icon="📋"
      title={$_("admin_dashboard.no_specifications") ||
        "No specifications found"}
      description={$_("admin_dashboard.create_first_specification_desc") ||
        "Create your first specification to get started"}
    />
    <div class="mt-4">
      <Button variant="primary" onclick={openCreateModal}>
        <PlusOutline size="sm" />
        <span
          >{$_("admin_dashboard.create_specification") ||
            "Create Specification"}</span
        >
      </Button>
    </div>
  {:else}
    <!-- Stats (redesigned like previous stats cards) -->
    <div class="stats-grid" style="margin-bottom: 16px;">
      <!-- Total -->
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
            {$_("admin_dashboard.total_specifications") ||
              "Total Specifications"}
          </h3>
          <p class="stat-value">{formatNumber(totalSpecs, $locale)}</p>
        </div>
      </div>

      <!-- Active -->
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
          <h3 class="stat-title">{$_("common.active") || "Active"}</h3>
          <p class="stat-value">{formatNumber(activeSpecs, $locale)}</p>
        </div>
      </div>

      <!-- Inactive -->
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
          <h3 class="stat-title">{$_("common.inactive") || "Inactive"}</h3>
          <p class="stat-value">{formatNumber(inactiveSpecs, $locale)}</p>
        </div>
      </div>

      <!-- Total Options -->
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
            {$_("admin_dashboard.total_options") || "Total Options"}
          </h3>
          <p class="stat-value">{formatNumber(totalOptions, $locale)}</p>
        </div>
      </div>
    </div>

    <!-- Controls (search + create) -->
    <div class="bg-white rounded-t-xl w-full p-6" style="margin-bottom: 0;">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-3"
      >
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
            placeholder={$_("admin_dashboard.search_specifications") ||
              "Search specifications..."}
            class="w-full h-9 pl-9 pr-3 py-2
              bg-[#F9FAFB]
              border border-[#E5E7EB]
              rounded-[12px]
              shadow-[0px_1px_0.5px_0.05px_#1D293D05]
              text-sm
              focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <button class='inline-flex items-center justify-center mx-2 h-9 cursor-pointer px-3 py-2 bg-[#3C307F] text-white text-sm font-medium rounded-[12px] shadow-[0px_1px_0.5px_0.05px_#1D293D05] hover:bg-[#2f2666] transition-colors duration-200 s-YJT1Gee9Kcm3 s-PDCyVhHr-VbL' onclick={openCreateModal}>
          <PlusOutline size="sm" />
          <span
            >{$_("admin_dashboard.create_specification") ||
              "Create Specification"}</span
          >
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="items-table-container">
      {#if filteredSpecifications.length === 0}
        <EmptyState
          icon="🔍"
          title={$_("common.no_results") || "No results found"}
          description={$_("common.try_different_search") ||
            "Try adjusting your search terms"}
        />
      {:else}
        <div class="items-table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-name">
                  {$_("admin_dashboard.specification") || "Specification"}
                </th>
                <th class="col-count">
                  {$_("admin_dashboard.available_options") ||
                    "Available Options"}
                </th>
                <th class="col-status">
                  {$_("common.status") || "Status"}
                </th>
              </tr>
            </thead>

            <tbody>
              {#each paginatedSpecifications as specification (specification.shortname)}
                <tr class="item-row">
                  <!-- Specification -->
                  <td class="col-name">
                    <div class="option-cell">
                      <div
                        class="option-title"
                        title={getLocalizedDisplayName(specification, $locale)}
                      >
                        {truncateText(
                          getLocalizedDisplayName(specification, $locale),
                          25,
                        )}
                      </div>

                      <div
                        class="option-sub mono"
                        title={specification.shortname}
                      >
                        {truncateText(specification.shortname, 30)}
                      </div>
                    </div>
                  </td>

                  <!-- Available options -->
                  <td class="col-count">
                    <span class="mono">
                      {formatNumber(getOptionsCount(specification), $locale)}
                    </span>
                  </td>

                  <!-- Status -->
                  <td class="col-status">
                    {#if getStatus(specification)}
                      <span class="status-pill status-pill--active">
                        {$_("common.active") || "Active"}
                      </span>
                    {:else}
                      <span class="status-pill status-pill--inactive">
                        {$_("common.inactive") || "Inactive"}
                      </span>
                    {/if}
                  </td>

                  <!-- Action -->
                  <td onclick={(e) => e.stopPropagation()}>
                    <div
                      class="relative flex justify-end"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <button
                        aria-label={$_("common.actions") || "Action"}
                        onclick={(e) =>
                          toggleDropdown(specification.shortname, e)}
                      >
                        <span class="text-xl leading-none">…</span>
                      </button>

                      {#if openDropdownId === specification.shortname}
                        <div
                          class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                          style={$isRTL
                            ? "right:0; top:22px;"
                            : "right:0; top:22px;"}
                          role="menu"
                        >
                          <button
                            class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                            onclick={() => {
                              closeDropdown();
                              openEditModal(specification);
                            }}
                            role="menuitem"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              class="w-4 h-4 text-gray-500"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                fill-rule="evenodd"
                                clip-rule="evenodd"
                                d="M15.5763 5.55905L14.1547 7.028L15.5606 8.43048L17.0227 9.88908L18.4357 8.42918C18.8155 8.0491 19.0288 7.53378 19.0288 6.99649C19.0288 6.45931 18.8155 5.94411 18.4359 5.56405C18.0559 5.1845 17.5407 4.97131 17.0036 4.97131C16.4688 4.97131 15.9558 5.18263 15.5763 5.55905ZM10.0378 15.6235L14.8691 10.5657L15.6318 11.3265L10.7674 16.3531L10.0378 15.6235ZM7.95914 16.3732L8.92782 17.3419L5.9421 18.337L6.93719 15.3513L7.90531 16.3194C7.91913 16.3343 7.93349 16.3489 7.94838 16.3631C7.95195 16.3665 7.95553 16.3699 7.95914 16.3732ZM8.62322 14.2089L7.90282 13.4885L12.7638 8.46539L13.4529 9.15285L8.62322 14.2089ZM14.1455 4.16158L12.0339 6.34356C12.0329 6.34463 12.0319 6.34571 12.0308 6.34678L5.7815 12.8046C5.67738 12.9122 5.59875 13.0418 5.55141 13.1838L3.41241 19.6018C3.29266 19.9611 3.38618 20.3573 3.654 20.6251C3.92182 20.8929 4.31797 20.9864 4.67729 20.8667L11.0953 18.7277C11.2479 18.6768 11.3859 18.59 11.4977 18.4744L19.8566 9.83672C20.6072 9.0822 21.0288 8.06106 21.0288 6.99649C21.0288 5.92906 20.605 4.90529 19.8505 4.15018L19.8499 4.14958C19.0948 3.39511 18.071 2.97131 17.0036 2.97131C15.9362 2.97131 14.9124 3.39511 14.1573 4.14958L14.1455 4.16158Z"
                                fill="currentColor"
                              />
                            </svg>
                            <span>{$_("common.edit") || "Edit"}</span>
                          </button>

                          <button
                            class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                            onclick={() => {
                              closeDropdown();
                              openDeleteModal(specification);
                            }}
                            role="menuitem"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path
                                d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"
                              />
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

        <!-- Pagination -->
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
                    {formatNumber(page, $locale)}
                  </button>
                {:else if page === currentPage - 2 || page === currentPage + 2}
                  <span class="page-ellipsis">...</span>
                {/if}
              {/each}
            </div>

            <div class="pagination-info">
              {$_("common.page") || "Page"}
              {formatNumber(currentPage, $locale)}
              {$_("common.of") || "of"}
              {formatNumber(totalPages, $locale)}
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
  {/if}
</div>

<!-- Modals -->
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
  /* Status pills */
  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid;
    white-space: nowrap;
  }
  .status-pill--active {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.35);
    color: #059669;
  }
  .status-pill--inactive {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
    color: #dc2626;
  }

  /* Table cell layout */
  .option-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .option-title {
    font-weight: 700;
    color: #111827;
  }
  .option-sub {
    font-size: 12px;
    color: #6b7280;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    color: #374151;
  }
</style>

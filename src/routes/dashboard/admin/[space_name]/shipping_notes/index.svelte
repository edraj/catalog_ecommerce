<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
  } from "@/lib/dmart_services";
  import { getLocalizedDisplayName } from "@/lib/utils/sellerUtils";
  import { formatNumber } from "@/lib/helpers";
  import { ResourceType } from "@edraj/tsdmart";
  import "./index.css";
  import { website, defaultPageSize } from "@/config";
  import ShippingNotesModal from "@/components/sellers/ShippingNotesModal.svelte";

  let sellers = $state<any[]>([]);
  let categories = $state<any[]>([]);
  let brands = $state<any[]>([]);
  let selectedSeller = $state("");
  let previousSeller = $state("");
  let shippingNotes = $state<any[]>([]);
  let isLoadingSellers = $state(true);
  let isLoadingNotes = $state(false);
  let searchTerm = $state("");
  let showNotesModal = $state(false);
  let editingNoteIndex = $state<number | null>(null);
  let shippingNotesConfig = $state<any>(null);
  let isSavingNotes = $state(false);
  let showDetailsModal = $state(false);
  let selectedNoteDetails = $state<any>(null);

  // pagination
  let currentPage = $state(1);
  let itemsPerPage = $state(defaultPageSize);

  let shippingNoteForm = $state<any>({
    sellerShortname: "",
    shipping_note_en: "",
    shipping_note_ar: "",
    brand_shortnames: [],
    category_shortnames: [],
  });

  const isRTL = derived(locale, ($l) => $l === "ar" || $l === "ku");

  function getSellerDisplayName(seller: any): string {
    if (!seller) return "";
    return getLocalizedDisplayName(seller, $locale);
  }

  function buildShippingNotes(
    records: any[],
    sellerShortname: string,
    sellerDisplayname: string,
  ) {
    const notes: any[] = [];

    // Only process the "notes" record, ignore "config" and other records
    const notesRecord = records.find((record) => record.shortname === "notes");
    if (!notesRecord) return notes;

    const items = notesRecord?.attributes?.payload?.body?.items || [];

    if (Array.isArray(items)) {
      for (const [itemIndex, item] of items.entries()) {
        notes.push({
          ...item,
          seller_shortname: sellerShortname,
          seller_displayname: sellerDisplayname,
          record_shortname: notesRecord.shortname,
          item_index: itemIndex,
        });
      }
    }

    return notes;
  }

  function ensureShippingNotesBody(config: any) {
    if (!config.attributes)
      config.attributes = { payload: { body: { items: [] } } };
    if (!config.attributes.payload)
      config.attributes.payload = { body: { items: [] } };
    if (!config.attributes.payload.body)
      config.attributes.payload.body = { items: [] };
    if (!config.attributes.payload.body.items)
      config.attributes.payload.body.items = [];
  }

  // ------- lifecycle -------
  onMount(async () => {
    await Promise.all([loadSellers(), loadCategories(), loadBrands()]);
    if (!selectedSeller) {
      selectedSeller = "all";
      await loadSellerNotes(true);
    }
    window.addEventListener("click", closeModals);
  });

  onDestroy(() => {
    window.removeEventListener("click", closeModals);
  });

  async function loadSellers() {
    isLoadingSellers = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "shipping",
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

  async function loadCategories() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        1000,
        0,
        true,
      );
      if (response?.records) {
        categories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function loadBrands() {
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
    }
  }

  async function loadSellerNotes(reset = true) {
    if (reset) shippingNotes = [];

    if (!selectedSeller) {
      shippingNotesConfig = null;
      return;
    }

    // ALL SELLERS
    if (selectedSeller === "all") {
      isLoadingNotes = true;
      try {
        const allNotes: any[] = [];
        for (const seller of sellers) {
          try {
            const response = await getSpaceContents(
              website.main_space,
              `shipping/${seller.shortname}`,
              "managed",
              100,
              0,
              true,
            );
            if (response?.records) {
              allNotes.push(
                ...buildShippingNotes(
                  response.records,
                  seller.shortname,
                  getSellerDisplayName(seller),
                ),
              );
            }
          } catch (error) {
            console.error(
              `Error loading shipping notes for ${seller.shortname}:`,
              error,
            );
          }
        }
        shippingNotes = allNotes;
      } catch (error) {
        console.error("Error loading shipping notes:", error);
        errorToastMessage("Error loading shipping notes");
      } finally {
        isLoadingNotes = false;
      }
      return;
    }

    // SINGLE SELLER
    isLoadingNotes = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `shipping/${selectedSeller}`,
        "managed",
        100,
        0,
        true,
      );

      const processedNotes: any[] = [];

      if (response?.records) {
        shippingNotesConfig = response.records.find(
          (r) => r.shortname === "notes",
        ) || { attributes: { payload: { body: { items: [] } } } };

        const seller = sellers.find((s) => s.shortname === selectedSeller);
        processedNotes.push(
          ...buildShippingNotes(
            response.records,
            selectedSeller,
            getSellerDisplayName(seller),
          ),
        );
      } else {
        shippingNotesConfig = {
          attributes: { payload: { body: { items: [] } } },
        };
      }

      shippingNotes = processedNotes;
    } catch (error) {
      console.error("Error loading shipping notes:", error);
      errorToastMessage("Error loading shipping notes");
    } finally {
      isLoadingNotes = false;
    }
  }

  $effect(() => {
    if (selectedSeller && selectedSeller !== previousSeller) {
      previousSeller = selectedSeller;
      loadSellerNotes(true);
    }
  });

  function closeModals() {
    // Can be extended for other modals
  }

  function openDetailsModal(note: any) {
    selectedNoteDetails = note;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    selectedNoteDetails = null;
  }

  // ------- modal handlers -------
  async function openNotesModal(note: any = null) {
    showNotesModal = true;

    if (note && note.item_index !== undefined) {
      // Editing existing note
      editingNoteIndex = note.item_index;

      // Load the seller's config if we're in "all sellers" view
      if (selectedSeller === "all") {
        try {
          const response = await getSpaceContents(
            website.main_space,
            `shipping/${note.seller_shortname}`,
            "managed",
            100,
            0,
            true,
          );
          const notesRecord = response.records.find(
            (r: any) => r.shortname === "notes",
          );
          if (notesRecord) {
            shippingNotesConfig = notesRecord;
            ensureShippingNotesBody(notesRecord);
            const item =
              notesRecord.attributes.payload.body.items[note.item_index];

            shippingNoteForm = {
              sellerShortname: note.seller_shortname,
              shipping_note_en: (
                item.shipping_note?.en ||
                item.shipping_note ||
                ""
              ).trim(),
              shipping_note_ar: (item.shipping_note?.ar || "").trim(),
              brand_shortnames: item.brand_shortnames || [],
              category_shortnames: item.category_shortnames || [],
            };
          }
        } catch (error) {
          console.error("Error loading seller notes for edit:", error);
          errorToastMessage("Failed to load shipping notes");
          showNotesModal = false;
          return;
        }
      } else {
        // Editing with a specific seller already selected
        if (shippingNotesConfig) {
          ensureShippingNotesBody(shippingNotesConfig);
          const item =
            shippingNotesConfig.attributes.payload.body.items[note.item_index];

          shippingNoteForm = {
            sellerShortname: selectedSeller,
            shipping_note_en: (
              item.shipping_note?.en ||
              item.shipping_note ||
              ""
            ).trim(),
            shipping_note_ar: (item.shipping_note?.ar || "").trim(),
            brand_shortnames: item.brand_shortnames || [],
            category_shortnames: item.category_shortnames || [],
          };
        }
      }
    } else {
      // Creating new note
      editingNoteIndex = null;
      shippingNoteForm = {
        sellerShortname:
          selectedSeller && selectedSeller !== "all" ? selectedSeller : "",
        shipping_note_en: "",
        shipping_note_ar: "",
        brand_shortnames: [],
        category_shortnames: [],
      };
    }
  }

  function closeNotesModal() {
    showNotesModal = false;
    editingNoteIndex = null;
    shippingNoteForm = {
      sellerShortname: "",
      shipping_note_en: "",
      shipping_note_ar: "",
      brand_shortnames: [],
      category_shortnames: [],
    };
  }

  async function loadSellerNotesConfig(sellerShortname: string) {
    const response = await getSpaceContents(
      website.main_space,
      `shipping/${sellerShortname}`,
      "managed",
      100,
      0,
      true,
    );

    if (response?.records) {
      const notesRecord = response.records.find((r) => r.shortname === "notes");
      if (notesRecord) return notesRecord;
    }
    return { attributes: { payload: { body: { items: [] } } } };
  }

  async function saveShippingNotesForSeller(
    sellerShortname: string,
    config: any,
  ) {
    ensureShippingNotesBody(config);

    const configData = {
      displayname_en: "Notes",
      displayname_ar: "ملاحظات",
      displayname_ku: null,
      body: config.attributes.payload.body,
      tags: [],
      is_active: true,
    };

    if (config?.uuid) {
      await updateEntity(
        config.shortname,
        website.main_space,
        `shipping/${sellerShortname}`,
        config.resource_type,
        configData,
        "",
        "",
      );
    } else {
      await createEntity(
        configData,
        website.main_space,
        `shipping/${sellerShortname}`,
        ResourceType.content,
        "",
        "",
      );
    }
  }

  async function submitShippingNote() {
    if (!shippingNoteForm.sellerShortname) {
      errorToastMessage("Please select a seller");
      return;
    }

    if (
      !shippingNoteForm.shipping_note_en &&
      !shippingNoteForm.shipping_note_ar
    ) {
      errorToastMessage("Please provide a note in at least one language");
      return;
    }

    if (
      (!shippingNoteForm.brand_shortnames ||
        shippingNoteForm.brand_shortnames.length === 0) &&
      (!shippingNoteForm.category_shortnames ||
        shippingNoteForm.category_shortnames.length === 0)
    ) {
      errorToastMessage("Please select at least one brand or category");
      return;
    }

    try {
      isSavingNotes = true;

      let configToUpdate = shippingNotesConfig;
      if (!configToUpdate) {
        configToUpdate = await loadSellerNotesConfig(
          shippingNoteForm.sellerShortname,
        );
      }

      ensureShippingNotesBody(configToUpdate);

      const newItem = {
        shipping_note: {
          en: shippingNoteForm.shipping_note_en.trim(),
          ar: shippingNoteForm.shipping_note_ar.trim(),
        },
        ...(shippingNoteForm.brand_shortnames &&
        shippingNoteForm.brand_shortnames.length > 0
          ? { brand_shortnames: shippingNoteForm.brand_shortnames }
          : {}),
        ...(shippingNoteForm.category_shortnames &&
        shippingNoteForm.category_shortnames.length > 0
          ? { category_shortnames: shippingNoteForm.category_shortnames }
          : {}),
      };

      if (editingNoteIndex !== null) {
        configToUpdate.attributes.payload.body.items[editingNoteIndex] =
          newItem;
      } else {
        configToUpdate.attributes.payload.body.items.push(newItem);
      }

      await saveShippingNotesForSeller(
        shippingNoteForm.sellerShortname,
        configToUpdate,
      );
      successToastMessage("Shipping note saved successfully!");

      closeNotesModal();
      await loadSellerNotes(true);
    } catch (error) {
      console.error("Error saving shipping note:", error);
      errorToastMessage("Failed to save shipping note");
    } finally {
      isSavingNotes = false;
    }
  }

  async function deleteShippingNote(note: any) {
    try {
      isSavingNotes = true;

      // Load the seller's config if we're in "all sellers" view
      let configToUpdate;
      if (selectedSeller === "all") {
        configToUpdate = await loadSellerNotesConfig(note.seller_shortname);
      } else {
        if (!shippingNotesConfig || !selectedSeller) {
          errorToastMessage("Select a seller to manage shipping notes");
          return;
        }
        configToUpdate = shippingNotesConfig;
      }

      ensureShippingNotesBody(configToUpdate);
      configToUpdate.attributes.payload.body.items =
        configToUpdate.attributes.payload.body.items.filter(
          (_: any, i: number) => i !== note.item_index,
        );

      await saveShippingNotesForSeller(
        note.seller_shortname || selectedSeller,
        configToUpdate,
      );
      successToastMessage("Shipping note deleted successfully!");
      await loadSellerNotes(true);
    } catch (error) {
      console.error("Error deleting shipping note:", error);
      errorToastMessage("Failed to delete shipping note");
    } finally {
      isSavingNotes = false;
    }
  }

  let filteredNotes = $derived.by(() => {
    if (!searchTerm) return shippingNotes;
    return shippingNotes.filter(
      (note) =>
        note.shipping_note?.en
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        note.shipping_note?.ar
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        note.seller_displayname
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        note.brand_shortnames?.some((b: string) =>
          b.toLowerCase().includes(searchTerm.toLowerCase()),
        ) ||
        note.category_shortnames?.some((c: string) =>
          c.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    );
  });

  let totalPages = $derived.by(() =>
    Math.ceil(filteredNotes.length / itemsPerPage),
  );
  let paginatedNotes = $derived.by(() =>
    filteredNotes.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
  );

  // pagination handlers
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) currentPage = page;
  }

  function nextPage() {
    if (currentPage < totalPages) currentPage++;
  }

  function previousPage() {
    if (currentPage > 1) currentPage--;
  }

  function getNoteName(note: any): string {
    return note.shipping_note?.[$locale] || note.shipping_note?.en || "";
  }

  function getBrandDisplayNames(brandShortnames: string[]): string {
    if (!brandShortnames || brandShortnames.length === 0) return "";
    return brandShortnames
      .map((shortname) => {
        const brand = brands.find((b) => b.shortname === shortname);
        if (brand) return getLocalizedDisplayName(brand, $locale) || shortname;
        return shortname;
      })
      .join(", ");
  }

  function getCategoryDisplayNames(categoryShortnames: string[]): string {
    if (!categoryShortnames || categoryShortnames.length === 0) return "";
    return categoryShortnames
      .map((shortname) => {
        const category = categories.find((c) => c.shortname === shortname);
        if (category)
          return getLocalizedDisplayName(category, $locale) || shortname;
        return shortname;
      })
      .join(", ");
  }
</script>

<div class="admin-page-container">
  <div
    class="flex flex-col search-table_header md:flex-row md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
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
          placeholder={$_("admin.search_shipping") ||
            "Search by note or seller..."}
          class="w-full h-9 pl-9 pr-3 py-2
            bg-[#F9FAFB]
            border border-[#E5E7EB]
            rounded-xl
            shadow-[0px_1px_0.5px_0.05px_#1D293D05]
            text-sm
            focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>

    <!-- RIGHT -->
    <div class="flex items-end gap-3 justify-end">
      <!-- Add note -->
      <button
        class="h-9 inline-flex items-center justify-center gap-2
          px-3 py-2
          bg-[#3C307F] text-white text-sm font-medium
          rounded-xl
          hover:bg-[#2f2666] transition-colors
          disabled:opacity-60 disabled:cursor-not-allowed"
        onclick={() => openNotesModal(null)}
        type="button"
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
        {$_("admin.add_shipping_note") || "Add Shipping Note"}
      </button>

      <!-- Seller Select -->
      <div class="min-w-[220px]">
        <select
          bind:value={selectedSeller}
          class="w-full h-9 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm"
        >
          <option value=""
            >{$_("admin.choose_seller") || "Choose a seller..."}</option
          >
          <option value="all">{$_("admin.all_sellers") || "All Sellers"}</option
          >
          {#each sellers as seller}
            <option value={seller.shortname}
              >{getSellerDisplayName(seller)}</option
            >
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Table states -->
  {#if isLoadingNotes}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if paginatedNotes.length === 0}
    <div class="empty-state">
      <h3>{"No shipping notes found"}</h3>
      <p>
        {selectedSeller === "all"
          ? $_("admin.no_products_description") ||
            "Start by creating your first shipping note"
          : $_("admin.no_products_in_category") ||
            "No shipping notes for this seller"}
      </p>
    </div>
  {:else}
    <div class="items-table-container">
      <table class="items-table">
        <thead>
          <tr>
            <th>{$_("admin.seller") || "Seller"}</th>
            <th>{$_("admin.shipping_note") || "Shipping Note"}</th>
            <th>{$_("admin.brands") || "Brands"}</th>
            <th>{$_("admin.categories") || "Categories"}</th>
            <th style="text-align:right;"
              >{$_("common.actions") || "Actions"}</th
            >
          </tr>
        </thead>

        <tbody>
          {#each paginatedNotes as note, i (note.item_index + "-" + i)}
            <tr class="item-row">
              <td>
                <div class="seller-badge">
                  {note.seller_displayname || note.seller_shortname}
                </div>
              </td>

              <td>
                <div class="note-content">
                  <button
                    type="button"
                    class="note-text-btn"
                    onclick={() => openDetailsModal(note)}
                    title={getNoteName(note)}
                  >
                    {getNoteName(note)}
                  </button>
                </div>
              </td>

              <td>
                <div class="related-items">
                  {#if note.brand_shortnames && note.brand_shortnames.length > 0}
                    <span class="badge-item brand-badge">
                      {getBrandDisplayNames(note.brand_shortnames)}
                    </span>
                  {:else}
                    <span class="text-gray-400 text-sm">—</span>
                  {/if}
                </div>
              </td>

              <td>
                <div class="related-items">
                  {#if note.category_shortnames && note.category_shortnames.length > 0}
                    <span class="badge-item category-badge">
                      {getCategoryDisplayNames(note.category_shortnames)}
                    </span>
                  {:else}
                    <span class="text-gray-400 text-sm">—</span>
                  {/if}
                </div>
              </td>

              <td>
                <div class="actions-cell">
                  <button
                    type="button"
                    onclick={() => openNotesModal(note)}
                    class="action-btn edit-btn"
                    title={$_("common.edit") || "Edit"}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                      />
                      <path
                        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onclick={() => deleteShippingNote(note)}
                    class="action-btn delete-btn"
                    title={$_("common.delete") || "Delete"}
                    disabled={isSavingNotes}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination-container">
        <button
          type="button"
          class="pagination-btn"
          onclick={previousPage}
          disabled={currentPage === 1}
        >
          ← {$_("admin.previous") || "Previous"}
        </button>

        <div class="page-numbers">
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
            <button
              type="button"
              class="page-number"
              class:active={page === currentPage}
              onclick={() => goToPage(page)}
            >
              {page}
            </button>
          {/each}
        </div>

        <button
          type="button"
          class="pagination-btn"
          onclick={nextPage}
          disabled={currentPage === totalPages}
        >
          {$_("admin.next") || "Next"} →
        </button>
      </div>
    {/if}
  {/if}
</div>

{#if showDetailsModal && selectedNoteDetails}
  <div
    class="modal-overlay"
    role="presentation"
    onclick={closeDetailsModal}
    onkeydown={(e) => e.key === "Escape" && closeDetailsModal()}
  >
    <div
      class="modal-content"
      role="dialog"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("admin.shipping_note_details") || "Shipping Note Details"}
        </h2>
        <button
          class="modal-close"
          onclick={closeDetailsModal}
          type="button"
          aria-label="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="details-section">
          <h3 class="details-label">{$_("admin.seller") || "Seller"}</h3>
          <p class="details-value">
            {selectedNoteDetails.seller_displayname ||
              selectedNoteDetails.seller_shortname}
          </p>
        </div>

        <div class="details-section">
          <h3 class="details-label">
            {$_("admin.shipping_note_en") || "Shipping Note (English)"}
          </h3>
          <p class="details-value">
            {selectedNoteDetails.shipping_note?.en ||
              selectedNoteDetails.shipping_note ||
              "—"}
          </p>
        </div>

        <div class="details-section">
          <h3 class="details-label">
            {$_("admin.shipping_note_ar") || "Shipping Note (Arabic)"}
          </h3>
          <p class="details-value">
            {selectedNoteDetails.shipping_note?.ar || "—"}
          </p>
        </div>

        {#if selectedNoteDetails.brand_shortnames?.length > 0}
          <div class="details-section">
            <h3 class="details-label">{$_("admin.brands") || "Brands"}</h3>
            <div class="tags-display">
              {#each selectedNoteDetails.brand_shortnames as brandShortname}
                <span class="details-tag brand-tag">
                  {brands.find((b) => b.shortname === brandShortname)
                    ? getLocalizedDisplayName(
                        brands.find((b) => b.shortname === brandShortname),
                        $locale,
                      ) || brandShortname
                    : brandShortname}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedNoteDetails.category_shortnames?.length > 0}
          <div class="details-section">
            <h3 class="details-label">
              {$_("admin.categories") || "Categories"}
            </h3>
            <div class="tags-display">
              {#each selectedNoteDetails.category_shortnames as categoryShortname}
                <span class="details-tag category-tag">
                  {categories.find((c) => c.shortname === categoryShortname)
                    ? getLocalizedDisplayName(
                        categories.find(
                          (c) => c.shortname === categoryShortname,
                        ),
                        $locale,
                      ) || categoryShortname
                    : categoryShortname}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick={closeDetailsModal}>
          {$_("common.close") || "Close"}
        </button>
      </div>
    </div>
  </div>
{/if}

<ShippingNotesModal
  bind:show={showNotesModal}
  bind:form={shippingNoteForm}
  {sellers}
  {categories}
  {brands}
  isLoading={isSavingNotes}
  isEditMode={editingNoteIndex !== null}
  onClose={closeNotesModal}
  onSubmit={submitShippingNote}
  sellerDisabled={selectedSeller !== "all"}
/>

<style>
  .admin-page-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    background-color: #f3f4f6;
    padding: 0;
  }

  .search-table_header {
    border-bottom: 1px solid #e5e7eb;
  }

  .loading-state,
  .empty-state {
    background-color: #fff;
    padding: 40px 20px;
    text-align: center;
    color: #6b7280;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3c307f;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    color: #374151;
    font-size: 16px;
  }

  .items-table-container {
    background-color: #fff;
    padding: 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .items-table thead {
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .items-table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }

  .items-table tbody tr {
    border-bottom: 1px solid #e5e7eb;
    transition: background-color 0.2s;
  }

  .items-table tbody tr:hover {
    background-color: #f9fafb;
  }

  .items-table td {
    padding: 12px 16px;
    color: #374151;
  }

  .seller-badge {
    display: inline-block;
    padding: 6px 12px;
    background-color: #ede9fe;
    color: #3c307f;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .note-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .related-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge-item {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .brand-badge {
    background-color: #dbeafe;
    color: #0369a1;
  }

  .category-badge {
    background-color: #fce7f3;
    color: #be185d;
  }

  .actions-cell {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .action-btn {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background-color: transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .edit-btn {
    color: #3c307f;
  }

  .edit-btn:hover {
    background-color: #ede9fe;
  }

  .delete-btn {
    color: #dc2626;
  }

  .delete-btn:hover:not(:disabled) {
    background-color: #fee2e2;
  }

  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 20px;
    background-color: #fff;
    border-top: 1px solid #e5e7eb;
  }

  .pagination-btn {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background-color: #fff;
    color: #374151;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .pagination-btn:hover:not(:disabled) {
    border-color: #3c307f;
    color: #3c307f;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    gap: 6px;
  }

  .page-number {
    padding: 6px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background-color: #fff;
    color: #374151;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .page-number:hover {
    border-color: #3c307f;
    color: #3c307f;
  }

  .page-number.active {
    background-color: #3c307f;
    color: #fff;
    border-color: #3c307f;
  }

  .note-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .note-text-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: #3c307f;
    text-align: left;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.2s;
    font-size: 14px;
  }

  .note-text-btn:hover {
    color: #2f2666;
    text-decoration: underline;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal-content {
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background-color: transparent;
    color: #6b7280;
    cursor: pointer;
    border-radius: 6px;
    transition: background-color 0.2s;
  }

  .modal-close:hover {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .modal-body {
    padding: 24px;
    flex: 1;
    overflow-y: auto;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 16px 24px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
    background-color: #f9fafb;
  }

  .details-section {
    margin-bottom: 20px;
  }

  .details-section:last-child {
    margin-bottom: 0;
  }

  .details-label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin: 0 0 8px 0;
    text-transform: uppercase;
  }

  .details-value {
    font-size: 14px;
    color: #1f2937;
    margin: 0;
    padding: 8px 12px;
    background-color: #f9fafb;
    border-radius: 6px;
  }

  .tags-display {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .details-tag {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .details-tag.brand-tag {
    background-color: #dbeafe;
    color: #0369a1;
  }

  .details-tag.category-tag {
    background-color: #fce7f3;
    color: #be185d;
  }

  .btn-secondary {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background-color: #e5e7eb;
    color: #374151;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background-color: #d1d5db;
  }

  @media (max-width: 640px) {
    .items-table th,
    .items-table td {
      padding: 8px 12px;
      font-size: 12px;
    }

    .search-table_header {
      flex-direction: column;
      gap: 12px;
    }

    .page-numbers {
      display: none;
    }
  }
</style>

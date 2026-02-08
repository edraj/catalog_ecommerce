<script lang="ts">
  import { onMount } from "svelte";
  import {
    getSpaceFolders,
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";

  import "./index.css";
  import { ResourceType } from "@edraj/tsdmart";
  import { website } from "@/config";
  import { _, locale } from "@/i18n";
  import { Pagination } from "@/components/ui";
  import { formatNumber } from "@/lib/helpers";

  let activeTab = $state<"all" | "global">("all");
  let allCoupons = $state<any[]>([]);
  let globalCoupons = $state<any[]>([]);
  let filteredCoupons = $state<any[]>([]);
  let loading = $state(false);
  let selectedFilter = $state("");
  let searchQuery = $state("");
  let totalCouponsCount = $state(0);
  let allCouponsTotal = $state(0);
  let globalCouponsTotal = $state(0);
  let showFilters = $state(false);
  let couponFolders = $state<any[]>([]);
  let previousSelectedFilter = $state("");
  let previousSearchQuery = $state("");
  let showCreateModal = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(10);

  let paginatedCoupons = $derived.by(() => {
    return filteredCoupons;
  });

  let totalPages = $derived.by(() => {
    return Math.max(1, Math.ceil(totalCouponsCount / itemsPerPage));
  });

  let newCoupon = $state({
    code: "",
    type: "global",
    discount_type: "percentage",
    discount_value: 0,
    minimum_spend: 0,
    maximum_amount: 0,
    maximum_uses: 0,
    maximum_per_user: 1,
    is_shipping: false,
    validity: {
      from: "",
      to: "",
    },
    applies_to: {
      products: [] as string[],
      services_keys: [] as string[],
      users_shortnames: [] as string[],
      brands_shortnames: [] as string[],
      sellers_shortname: [] as string[],
      categories_shortnames: [] as string[],
    },
  });

  let editModalOpen = $state(false);
  let editingCoupon = $state<any>(null);
  let editFormData = $state<any>({});

  let deleteModalOpen = $state(false);
  let deletingCoupon = $state<any>(null);

  onMount(async () => {
    if (website.main_space) {
      await loadCouponFolders();
      await loadCouponsPage();
    }
  });

  async function loadCouponFolders() {
    const foldersResponse = await getSpaceFolders(
      website.main_space,
      "coupons",
      "managed",
      100,
      0,
    );
    couponFolders = foldersResponse?.records || [];
  }

  function getFolderDisplayname(shortname: string) {
    const folder = couponFolders.find((f) => f.shortname === shortname);
    return folder?.attributes?.displayname?.en || shortname;
  }

  function mapCoupons(records: any[], folderShortname: string) {
    return records.map((coupon) => ({
      ...coupon,
      folderName: folderShortname,
      folderDisplayname: getFolderDisplayname(folderShortname),
      isGlobal: folderShortname === "global",
    }));
  }

  function applySearch(coupons: any[]) {
    if (!searchQuery.trim()) {
      return coupons;
    }

    const query = searchQuery.toLowerCase();
    return coupons.filter(
      (c) =>
        c.attributes.payload?.body?.code?.toLowerCase().includes(query) ||
        c.folderDisplayname?.toLowerCase().includes(query),
    );
  }

  async function loadCouponsPage() {
    if (!website.main_space) {
      return;
    }

    loading = true;
    try {
      if (!couponFolders.length) {
        await loadCouponFolders();
      }

      const limit = itemsPerPage;
      const offset = (currentPage - 1) * itemsPerPage;

      if (activeTab === "global") {
        const response = await getSpaceContents(
          website.main_space,
          "coupons/global",
          "managed",
          limit,
          offset,
          false,
        );

        globalCoupons = response?.records
          ? mapCoupons(response.records, "global")
          : [];
        globalCouponsTotal =
          response?.attributes?.total ?? response?.records?.length ?? 0;

        filteredCoupons = applySearch(globalCoupons);
        totalCouponsCount = searchQuery.trim()
          ? filteredCoupons.length
          : globalCouponsTotal;
        return;
      }

      let coupons = [];
      let total = 0;

      if (!selectedFilter || selectedFilter === "all") {
        filteredCoupons = [];
        totalCouponsCount = 0;
        allCoupons = [];
        allCouponsTotal = 0;
        return;
      }

      if (selectedFilter && selectedFilter !== "all") {
        const response = await getSpaceContents(
          website.main_space,
          `coupons/${selectedFilter}`,
          "managed",
          limit,
          offset,
          false,
        );

        coupons = response?.records
          ? mapCoupons(response.records, selectedFilter)
          : [];
        total = response?.attributes?.total ?? response?.records?.length ?? 0;
      }

      allCoupons = coupons;
      allCouponsTotal = total;

      filteredCoupons = applySearch(coupons);
      totalCouponsCount = searchQuery.trim() ? filteredCoupons.length : total;
    } catch (error) {
      console.error("Error loading coupons:", error);
      errorToastMessage("Failed to load coupons");
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    activeTab;
    selectedFilter;
    searchQuery;
    currentPage;
    itemsPerPage;
    loadCouponsPage();
  });

  $effect(() => {
    if (selectedFilter !== previousSelectedFilter) {
      previousSelectedFilter = selectedFilter;
      currentPage = 1;
    }
  });

  $effect(() => {
    activeTab;
    selectedFilter;
    if (activeTab === "global") {
      selectedFilter = "";
    }
  });

  $effect(() => {
    if (searchQuery !== previousSearchQuery) {
      previousSearchQuery = searchQuery;
      currentPage = 1;
    }
  });

  async function handleCreateCoupon() {
    if (!newCoupon.code.trim()) {
      errorToastMessage("Coupon code is required");
      return;
    }

    if (!newCoupon.validity.from || !newCoupon.validity.to) {
      errorToastMessage("Validity dates are required");
      return;
    }

    loading = true;
    try {
      const result = await createEntity(
        {
          body: newCoupon,
          is_active: true,
        },
        website.main_space,

        "coupons/global",
        ResourceType.content,
        "",
        "",
        "json",
      );

      if (result) {
        successToastMessage("Coupon created successfully");
        resetForm();
        activeTab = "global";
        await loadCouponsPage();
      } else {
        errorToastMessage("Failed to create coupon");
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage("Failed to create coupon");
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    newCoupon = {
      code: "",
      type: "global",
      discount_type: "percentage",
      discount_value: 0,
      minimum_spend: 0,
      maximum_amount: 0,
      maximum_uses: 0,
      maximum_per_user: 1,
      is_shipping: false,
      validity: {
        from: "",
        to: "",
      },
      applies_to: {
        products: [],
        services_keys: [],
        users_shortnames: [],
        brands_shortnames: [],
        sellers_shortname: [],
        categories_shortnames: [],
      },
    };
  }

  function openEditModal(coupon: any) {
    editingCoupon = coupon;
    editFormData = JSON.parse(JSON.stringify(coupon.attributes.payload.body));
    editModalOpen = true;
  }

  async function handleUpdateCoupon() {
    if (!editingCoupon) return;

    loading = true;
    try {
      const success = await updateEntity(
        editingCoupon.shortname,
        website.main_space,
        editingCoupon.subpath,
        ResourceType.content,
        {
          body: editFormData,
          is_active: true,
          content_type: "json",
        },
        "",
        "",
      );

      if (success) {
        successToastMessage("Coupon updated successfully");
        editModalOpen = false;
        await loadCouponsPage();
      } else {
        errorToastMessage("Failed to update coupon");
      }
    } catch (error) {
      console.error("Error updating coupon:", error);
      errorToastMessage("Failed to update coupon");
    } finally {
      loading = false;
    }
  }

  function openDeleteModal(coupon: any) {
    deletingCoupon = coupon;
    deleteModalOpen = true;
  }

  async function handleDeleteCoupon() {
    if (!deletingCoupon) return;

    loading = true;
    try {
      const success = await deleteEntity(
        deletingCoupon.shortname,
        website.main_space,

        deletingCoupon.subpath,
        ResourceType.content,
      );

      if (success) {
        successToastMessage("Coupon deleted successfully");
        deleteModalOpen = false;
        await loadCouponsPage();
      } else {
        errorToastMessage("Failed to delete coupon");
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
      errorToastMessage("Failed to delete coupon");
    } finally {
      loading = false;
    }
  }

  function getUniqueSellers() {
    return couponFolders
      .filter((folder) => folder.shortname !== "global")
      .map((folder) => ({
        shortname: folder.shortname,
        displayname: getFolderDisplayname(folder.shortname),
      }));
  }

  function formatDate(dateString: string) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function addAppliesTo(
    field: keyof typeof newCoupon.applies_to,
    value: string,
  ) {
    if (value.trim()) {
      newCoupon.applies_to[field] = [
        ...newCoupon.applies_to[field],
        value.trim(),
      ];
    }
  }

  function removeAppliesTo(
    field: keyof typeof newCoupon.applies_to,
    index: number,
  ) {
    newCoupon.applies_to[field] = newCoupon.applies_to[field].filter(
      (_, i) => i !== index,
    );
  }

  function handlePageChange(page: number) {
    currentPage = page;
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

  function openCreateModal() {
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function handleScopeChange() {
    currentPage = 1;
    loadCouponsPage();
  }

  function handleSellerChange() {
    currentPage = 1;
    loadCouponsPage();
  }
</script>

<svelte:window onclick={closeFilters} />

<div class="coupons-container">
  <div class="header">
    <div class="header-content">
      <div class="header-left">
        <h1>Coupon Management</h1>
        <p>Manage global and seller-specific coupons</p>
      </div>
      <div class="header-actions">
        <button class="btn-add-coupon" type="button" on:click={openCreateModal}>
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
          Create Coupon
        </button>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="search-and-filters">
    <div class="search-bar">
      <input
        id="search"
        type="text"
        bind:value={searchQuery}
        placeholder="Search by code or seller..."
        class="search-input"
      />
      <button
        type="button"
        class="search-btn"
        aria-label="Search by code or seller"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <div class="filters-left">
      <div class="filters-dropdown">
        <button
          type="button"
          class="filters-trigger"
          aria-haspopup="true"
          aria-expanded={showFilters}
          on:click={toggleFilters}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 6a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 5a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
            />
          </svg>
          {$_("common.filters") || "Filters"}
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        {#if showFilters}
          <div class="filters-panel" on:click={handleFiltersPanelClick}>
            <div class="filter-group">
              <label class="filter-label" for="scope-filter"> Scope </label>
              <select
                id="scope-filter"
                bind:value={activeTab}
                class="filter-select"
                on:change={handleScopeChange}
              >
                <option value="all">Seller Coupons</option>
                <option value="global">Global Coupons</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label" for="seller-filter">
                Filter by Seller
              </label>
              <select
                id="seller-filter"
                bind:value={selectedFilter}
                class="filter-select"
                disabled={activeTab === "global"}
                on:change={handleSellerChange}
              >
                <option value="" disabled>Select a seller</option>
                {#each getUniqueSellers() as seller}
                  <option value={seller.shortname}>
                    {seller.displayname}
                  </option>
                {/each}
              </select>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Coupons Table -->
  {#if loading}
    <div class="loading">Loading coupons...</div>
  {:else if filteredCoupons.length === 0}
    <div class="empty-state">
      {#if activeTab === "all" && !selectedFilter}
        <p>Select a seller to view coupons.</p>
      {:else if activeTab === "global"}
        <p>No global coupons found.</p>
      {:else if searchQuery.trim()}
        <p>No coupons match your search.</p>
      {:else}
        <p>No coupons found.</p>
      {/if}
    </div>
  {:else}
    <div class="table-container">
      <table class="coupons-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Seller</th>
            <th>Discount</th>
            <th>Valid From</th>
            <th>Valid To</th>
            <th>Usage</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedCoupons as coupon}
            {@const body = coupon.attributes.payload?.body || {}}
            <tr>
              <td class="code-cell">
                <strong>{body.code || "N/A"}</strong>
                {#if coupon.isGlobal}
                  <span class="badge global">Global</span>
                {/if}
              </td>
              <td>
                <span class="badge {body.discount_type}">
                  {body.discount_type === "percentage" ? "%" : "$"}
                </span>
              </td>
              <td>{coupon.folderDisplayname}</td>
              <td>
                {body.discount_type === "percentage"
                  ? `${body.discount_value}%`
                  : `$${body.discount_value}`}
                {#if body.maximum_amount}
                  <span class="text-muted">(max: ${body.maximum_amount})</span>
                {/if}
              </td>
              <td>{formatDate(body.validity?.from)}</td>
              <td>{formatDate(body.validity?.to)}</td>
              <td>
                {body.usage_count || 0} / {body.maximum_uses || "∞"}
              </td>
              <td>
                <span
                  class="status-badge"
                  class:active={coupon.attributes.is_active}
                >
                  {coupon.attributes.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td class="actions-cell">
                {#if coupon.isGlobal}
                  <button
                    class="btn-icon edit"
                    on:click={() => openEditModal(coupon)}
                    title="Edit"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path d="M11.5 2.5l2 2L6 12H4v-2l7.5-7.5z" />
                      <path d="M10 4l2 2" />
                    </svg>
                  </button>
                  <button
                    class="btn-icon delete"
                    on:click={() => openDeleteModal(coupon)}
                    title="Delete"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path
                        d="M3 4h10M5 4V3h6v1M6 7v4M10 7v4M5 4l.5 9h5l.5-9"
                      />
                    </svg>
                  </button>
                {:else}
                  <button class="btn-icon view" title="View Only">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path
                        d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z"
                      />
                      <circle cx="8" cy="8" r="2" />
                    </svg>
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Pagination
      {currentPage}
      {totalPages}
      totalItems={totalCouponsCount}
      {itemsPerPage}
      onPageChange={handlePageChange}
    />
  {/if}
</div>

{#if showCreateModal}
  <div class="modal-overlay" on:click={closeCreateModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Create New Global Coupon</h2>
        <button class="close-btn" on:click={closeCreateModal}> × </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label for="code">Coupon Code *</label>
            <input
              id="code"
              type="text"
              bind:value={newCoupon.code}
              placeholder="e.g., SAVE25"
              required
            />
          </div>

          <div class="form-group">
            <label for="discount_type">Discount Type *</label>
            <select id="discount_type" bind:value={newCoupon.discount_type}>
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>

          <div class="form-group">
            <label for="discount_value">Discount Value *</label>
            <input
              id="discount_value"
              type="number"
              bind:value={newCoupon.discount_value}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="minimum_spend">Minimum Spend</label>
            <input
              id="minimum_spend"
              type="number"
              bind:value={newCoupon.minimum_spend}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="maximum_amount">Maximum Discount Amount</label>
            <input
              id="maximum_amount"
              type="number"
              bind:value={newCoupon.maximum_amount}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="maximum_uses">Maximum Uses</label>
            <input
              id="maximum_uses"
              type="number"
              bind:value={newCoupon.maximum_uses}
              min="0"
            />
          </div>

          <div class="form-group">
            <label for="maximum_per_user">Maximum Per User</label>
            <input
              id="maximum_per_user"
              type="number"
              bind:value={newCoupon.maximum_per_user}
              min="1"
            />
          </div>

          <div class="form-group">
            <label for="is_shipping">
              <input
                id="is_shipping"
                type="checkbox"
                bind:checked={newCoupon.is_shipping}
              />
              Is Shipping Coupon
            </label>
          </div>

          <div class="form-group">
            <label for="valid_from">Valid From *</label>
            <input
              id="valid_from"
              type="date"
              bind:value={newCoupon.validity.from}
              required
            />
          </div>

          <div class="form-group">
            <label for="valid_to">Valid To *</label>
            <input
              id="valid_to"
              type="date"
              bind:value={newCoupon.validity.to}
              required
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={resetForm}> Reset </button>
        <button
          class="btn-primary"
          on:click={handleCreateCoupon}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Coupon"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if editModalOpen && editingCoupon}
  <div class="modal-overlay" on:click={() => (editModalOpen = false)}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Edit Coupon</h2>
        <button class="close-btn" on:click={() => (editModalOpen = false)}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Coupon Code</label>
            <input type="text" bind:value={editFormData.code} />
          </div>

          <div class="form-group">
            <label>Discount Type</label>
            <select bind:value={editFormData.discount_type}>
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
          </div>

          <div class="form-group">
            <label>Discount Value</label>
            <input
              type="number"
              bind:value={editFormData.discount_value}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>Minimum Spend</label>
            <input
              type="number"
              bind:value={editFormData.minimum_spend}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>Maximum Amount</label>
            <input
              type="number"
              bind:value={editFormData.maximum_amount}
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label>Maximum Uses</label>
            <input
              type="number"
              bind:value={editFormData.maximum_uses}
              min="0"
            />
          </div>

          <div class="form-group">
            <label>Valid From</label>
            <input type="date" bind:value={editFormData.validity.from} />
          </div>

          <div class="form-group">
            <label>Valid To</label>
            <input type="date" bind:value={editFormData.validity.to} />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => (editModalOpen = false)}>
          Cancel
        </button>
        <button
          class="btn-primary"
          on:click={handleUpdateCoupon}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Coupon"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteModalOpen && deletingCoupon}
  <div class="modal-overlay" on:click={() => (deleteModalOpen = false)}>
    <div class="modal modal-small" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Delete Coupon</h2>
        <button class="close-btn" on:click={() => (deleteModalOpen = false)}>
          ×
        </button>
      </div>

      <div class="modal-body">
        <p>
          Are you sure you want to delete the coupon
          <strong>{deletingCoupon.attributes.payload?.body?.code}</strong>?
        </p>
        <p class="warning">This action cannot be undone.</p>
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          on:click={() => (deleteModalOpen = false)}
        >
          Cancel
        </button>
        <button
          class="btn-danger"
          on:click={handleDeleteCoupon}
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

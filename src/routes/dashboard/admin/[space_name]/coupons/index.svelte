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

  let activeTab: "all" | "global" | "create" = "all";
  let allCoupons: any[] = [];
  let globalCoupons: any[] = [];
  let filteredCoupons: any[] = [];
  let loading = false;
  let selectedFilter = "all";
  let searchQuery = "";

  let newCoupon = {
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
  };

  let editModalOpen = false;
  let editingCoupon: any = null;
  let editFormData: any = {};

  let deleteModalOpen = false;
  let deletingCoupon: any = null;

  onMount(async () => {
    if (website.main_space) {
      await loadAllCoupons();
    }
  });

  async function loadAllCoupons() {
    loading = true;
    try {
      const foldersResponse = await getSpaceFolders(
        website.main_space,
        "coupons",
        "managed",
        100,
        0
      );

      if (!foldersResponse.records || foldersResponse.records.length === 0) {
        allCoupons = [];
        globalCoupons = [];
        applyFilters();
        return;
      }

      const couponPromises = foldersResponse.records.map(async (folder) => {
        const subpath = `coupons/${folder.shortname}`;
        const couponsResponse = await getSpaceContents(
          website.main_space,
          subpath,
          "managed",
          100,
          0,
          false
        );

        return couponsResponse.records.map((coupon: any) => ({
          ...coupon,
          folderName: folder.shortname,
          folderDisplayname:
            folder.attributes.displayname?.en || folder.shortname,
          isGlobal: folder.shortname === "global",
        }));
      });

      const allCouponsArrays = await Promise.all(couponPromises);
      allCoupons = allCouponsArrays.flat();
      globalCoupons = allCoupons.filter((c) => c.isGlobal);
      applyFilters();
    } catch (error) {
      console.error("Error loading coupons:", error);
      errorToastMessage("Failed to load coupons");
    } finally {
      loading = false;
    }
  }

  async function loadGlobalCoupons() {
    loading = true;
    try {
      const response = await getSpaceContents(
        website.main_space,

        "coupons/global",
        "managed",
        100,
        0,
        false
      );
      globalCoupons = response.records.map((coupon) => ({
        ...coupon,
        folderName: "global",
        folderDisplayname: "Global",
        isGlobal: true,
      }));
    } catch (error) {
      console.error("Error loading global coupons:", error);
      errorToastMessage("Failed to load global coupons");
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    let coupons = activeTab === "global" ? globalCoupons : allCoupons;

    if (selectedFilter !== "all") {
      coupons = coupons.filter((c) => c.folderName === selectedFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      coupons = coupons.filter(
        (c) =>
          c.attributes.payload?.body?.code?.toLowerCase().includes(query) ||
          c.folderDisplayname.toLowerCase().includes(query)
      );
    }

    filteredCoupons = coupons;
  }

  $: {
    allCoupons;
    globalCoupons;
    activeTab;
    selectedFilter;
    searchQuery;
    applyFilters();
  }

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
        "json"
      );

      if (result) {
        successToastMessage("Coupon created successfully");
        resetForm();
        await loadAllCoupons();
        activeTab = "global";
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
        ""
      );

      if (success) {
        successToastMessage("Coupon updated successfully");
        editModalOpen = false;
        await loadAllCoupons();
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
        ResourceType.content
      );

      if (success) {
        successToastMessage("Coupon deleted successfully");
        deleteModalOpen = false;
        await loadAllCoupons();
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
    const sellers = new Set(allCoupons.map((c) => c.folderName));
    return Array.from(sellers).map((shortname) => {
      const coupon = allCoupons.find((c) => c.folderName === shortname);
      return {
        shortname,
        displayname: coupon?.folderDisplayname || shortname,
      };
    });
  }

  function formatDate(dateString: string) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  }

  function addAppliesTo(
    field: keyof typeof newCoupon.applies_to,
    value: string
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
    index: number
  ) {
    newCoupon.applies_to[field] = newCoupon.applies_to[field].filter(
      (_, i) => i !== index
    );
  }
</script>

<div class="coupons-container">
  <div class="header">
    <h1>Coupon Management</h1>
    <p>Manage global and seller-specific coupons</p>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button
      class:active={activeTab === "all"}
      on:click={() => (activeTab = "all")}
    >
      All Coupons ({allCoupons.length})
    </button>
    <button
      class:active={activeTab === "global"}
      on:click={() => {
        activeTab = "global";
        loadGlobalCoupons();
      }}
    >
      Global Coupons ({globalCoupons.length})
    </button>
    <button
      class:active={activeTab === "create"}
      on:click={() => (activeTab = "create")}
    >
      Create New Coupon
    </button>
  </div>

  <!-- Content -->
  {#if activeTab === "create"}
    <div class="create-form">
      <h2>Create New Global Coupon</h2>

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

      <div class="form-actions">
        <button
          class="btn-primary"
          on:click={handleCreateCoupon}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Coupon"}
        </button>
        <button class="btn-secondary" on:click={resetForm}>Reset</button>
      </div>
    </div>
  {:else}
    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label for="seller-filter">Filter by Seller:</label>
        <select id="seller-filter" bind:value={selectedFilter}>
          <option value="all">All Sellers</option>
          {#each getUniqueSellers() as seller}
            <option value={seller.shortname}>{seller.displayname}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="search">Search:</label>
        <input
          id="search"
          type="text"
          bind:value={searchQuery}
          placeholder="Search by code or seller..."
        />
      </div>
    </div>

    <!-- Coupons Table -->
    {#if loading}
      <div class="loading">Loading coupons...</div>
    {:else if filteredCoupons.length === 0}
      <div class="empty-state">
        <p>No coupons found</p>
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
            {#each filteredCoupons as coupon}
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
                    <span class="text-muted">(max: ${body.maximum_amount})</span
                    >
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
                      ✏️
                    </button>
                    <button
                      class="btn-icon delete"
                      on:click={() => openDeleteModal(coupon)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  {:else}
                    <button class="btn-icon view" title="View Only">👁️</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

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

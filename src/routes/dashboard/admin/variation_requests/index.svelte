<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";
  import {
    getSpaceContents,
    updateEntity,
    deleteEntity,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { formatDate } from "@/lib/helpers";
  import {
    CheckCircleOutline,
    CloseCircleOutline,
    EyeOutline,
  } from "flowbite-svelte-icons";
  import { website } from "@/config";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let requests = $state([]);
  let isLoading = $state(true);
  let showReviewModal = $state(false);
  let selectedRequest = $state(null);
  let statusFilter = $state("all");
  let typeFilter = $state("all");
  let searchTerm = $state("");
  let filteredRequests = $state([]);

  let reviewForm = $state({
    status: "approved",
    admin_notes: "",
  });

  onMount(async () => {
    await loadRequests();
  });

  async function loadRequests() {
    isLoading = true;
    try {
      // Load product requests
      const productResponse = await getSpaceContents(
        website.main_space,
        "/variation_request/products_requests",
        "managed",
        100,
        0,
        true
      );

      // Load category requests
      const categoryResponse = await getSpaceContents(
        website.main_space,
        "/variation_request/categories_requests",
        "managed",
        100,
        0,
        true
      );

      // Combine both responses
      const productRecords = productResponse?.records || [];
      const categoryRecords = categoryResponse?.records || [];
      requests = [...productRecords, ...categoryRecords];
      applyFilters();
    } catch (error) {
      console.error("Error loading requests:", error);
      errorToastMessage("Failed to load requests");
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    let result = [...requests];

    if (statusFilter !== "all") {
      result = result.filter((request) => {
        const content = request.attributes?.payload?.body;
        return content?.status === statusFilter;
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((request) => {
        const content = request.attributes?.payload?.body;
        return content?.request_type === typeFilter;
      });
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((request) => {
        const content = request.attributes?.payload?.body;
        const displayname =
          request.attributes?.displayname?.en?.toLowerCase() || "";
        const sellerName = content?.seller_shortname?.toLowerCase() || "";
        const justification = content?.justification?.toLowerCase() || "";
        const productName =
          content?.product_details?.name?.en?.toLowerCase() || "";
        const categoryName =
          content?.category_details?.name?.en?.toLowerCase() || "";

        return (
          displayname.includes(searchLower) ||
          sellerName.includes(searchLower) ||
          justification.includes(searchLower) ||
          productName.includes(searchLower) ||
          categoryName.includes(searchLower)
        );
      });
    }

    filteredRequests = result;
  }

  function openReviewModal(request: any) {
    selectedRequest = request;
    const content = request.attributes?.payload?.body;
    reviewForm = {
      status: content?.status === "pending" ? "approved" : content?.status,
      admin_notes: content?.admin_notes || "",
    };
    showReviewModal = true;
  }

  function closeReviewModal() {
    showReviewModal = false;
    selectedRequest = null;
    reviewForm = {
      status: "approved",
      admin_notes: "",
    };
  }

  async function submitReview() {
    if (!selectedRequest) return;

    try {
      isLoading = true;
      const content = selectedRequest.attributes?.payload?.body;

      const updatedContent = {
        ...content,
        status: reviewForm.status,
        admin_notes: reviewForm.admin_notes,
        reviewed_by: "admin",
        reviewed_at: Date.now(),
      };

      const updateData = {
        displayname: selectedRequest.attributes?.displayname,
        body: updatedContent,
        tags: [
          `seller:${content.seller_shortname}`,
          `type:${content.request_type}_request`,
          `status:${reviewForm.status}`,
        ],
        is_active: true,
      };

      await updateEntity(
        selectedRequest.shortname,
        website.main_space,
        selectedRequest.subpath,
        selectedRequest.resource_type,
        updateData,
        "",
        ""
      );

      successToastMessage(
        `Request ${reviewForm.status === "approved" ? "approved" : "rejected"} successfully!`
      );
      closeReviewModal();
      await loadRequests();
    } catch (error) {
      console.error("Error reviewing request:", error);
      errorToastMessage("Failed to update request");
    } finally {
      isLoading = false;
    }
  }

  async function deleteRequest(request: any) {
    if (!confirm("Are you sure you want to delete this request?")) return;

    try {
      isLoading = true;
      await deleteEntity(
        request.shortname,
        request.space_name,
        request.subpath,
        request.resource_type
      );

      successToastMessage("Request deleted successfully!");
      await loadRequests();
    } catch (error) {
      console.error("Error deleting request:", error);
      errorToastMessage("Failed to delete request");
    } finally {
      isLoading = false;
    }
  }

  function getRequestContent(request: any) {
    return request.attributes?.payload?.body;
  }

  function getTypeBadgeClass(type: string) {
    return type === "product" ? "type-product" : "type-category";
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case "pending":
        return "status-pending";
      case "approved":
        return "status-approved";
      case "rejected":
        return "status-rejected";
      default:
        return "";
    }
  }

  $effect(() => {
    applyFilters();
  });
</script>

<div class="variation-requests-container">
  <div class="page-header">
    <div class="header-content">
      <div class="header-icon-wrapper">
        <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
          />
        </svg>
      </div>
      <div class="header-text">
        <h1 class="page-title">
          {$_("admin_dashboard.product_category_requests") ||
            "Product & Category Requests"}
        </h1>
        <p class="page-subtitle">
          {$_("admin_dashboard.product_category_requests_subtitle") ||
            "Review and manage seller product and category requests"}
        </p>
      </div>
    </div>
  </div>

  <div class="filters-section">
    <div class="search-bar">
      <svg
        class="search-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="11" cy="11" r="8" stroke-width="2" />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-4.35-4.35"
        />
      </svg>
      <input
        type="text"
        bind:value={searchTerm}
        placeholder={$_("admin_dashboard.search_requests") ||
          "Search requests..."}
        class="search-input"
        class:rtl={$isRTL}
      />
    </div>

    <div class="filter-group">
      <svg
        class="filter-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
        />
      </svg>
      <select bind:value={typeFilter} class="filter-select" class:rtl={$isRTL}>
        <option value="all"
          >{$_("admin_dashboard.all_types") || "All Types"}</option
        >
        <option value="product"
          >{$_("admin_dashboard.product") || "Product"}</option
        >
        <option value="category"
          >{$_("admin_dashboard.category") || "Category"}</option
        >
      </select>
    </div>

    <div class="filter-group">
      <svg
        class="filter-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <select
        bind:value={statusFilter}
        class="filter-select"
        class:rtl={$isRTL}
      >
        <option value="all"
          >{$_("admin_dashboard.all_statuses") || "All Statuses"}</option
        >
        <option value="pending"
          >{$_("admin_dashboard.pending") || "Pending"}</option
        >
        <option value="approved"
          >{$_("admin_dashboard.approved") || "Approved"}</option
        >
        <option value="rejected"
          >{$_("admin_dashboard.rejected") || "Rejected"}</option
        >
      </select>
    </div>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">
        {$_("admin_dashboard.loading") || "Loading requests..."}
      </p>
    </div>
  {:else if filteredRequests.length === 0}
    <div class="empty-state">
      <svg
        class="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 class="empty-title">
        {$_("admin_dashboard.no_requests") || "No requests found"}
      </h3>
      <p class="empty-description">
        {$_("admin_dashboard.no_requests_description") ||
          "There are no requests matching your filters"}
      </p>
    </div>
  {:else}
    <div class="requests-grid">
      {#each filteredRequests as request (request.shortname)}
        {@const content = getRequestContent(request)}
        <div class="request-card">
          <div class="card-header">
            <div class="card-title-section">
              <div class="title-badges">
                <span
                  class="type-badge {getTypeBadgeClass(content?.request_type)}"
                >
                  {#if content?.request_type === "product"}
                    <svg
                      class="badge-icon"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                  {:else}
                    <svg
                      class="badge-icon"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                      />
                    </svg>
                  {/if}
                  {content?.request_type || "unknown"}
                </span>
                <span
                  class="status-badge {getStatusBadgeClass(content?.status)}"
                >
                  {content?.status || "pending"}
                </span>
              </div>
              <h3 class="card-title">
                {#if content?.request_type === "product"}
                  {content?.product_details?.name?.en || request.shortname}
                {:else}
                  {content?.category_details?.name?.en || request.shortname}
                {/if}
              </h3>
            </div>
            <div class="card-meta">
              <span class="meta-item">
                <svg
                  class="meta-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="10" stroke-width="2" />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6l4 2"
                  />
                </svg>
                {formatDate(request.attributes?.created_at)}
              </span>
            </div>
          </div>

          <div class="card-body">
            <div class="info-row">
              <span class="info-label">Seller:</span>
              <span class="info-value"
                >{content?.seller_shortname || "N/A"}</span
              >
            </div>

            {#if content?.request_type === "product"}
              <div class="product-details">
                <h4 class="details-title">Product Details</h4>
                {#if content?.product_details?.category_shortname}
                  <div class="info-row">
                    <span class="info-label">Category:</span>
                    <span class="info-value"
                      >{content.product_details.category_shortname}</span
                    >
                  </div>
                {/if}
                {#if content?.product_details?.brand_shortname}
                  <div class="info-row">
                    <span class="info-label">Brand:</span>
                    <span class="info-value"
                      >{content.product_details.brand_shortname}</span
                    >
                  </div>
                {/if}
                {#if content?.product_details?.description?.en}
                  <div class="info-row">
                    <span class="info-label">Description:</span>
                    <span class="info-value"
                      >{content.product_details.description.en}</span
                    >
                  </div>
                {/if}

                {#if content?.product_details?.specifications && content.product_details.specifications.length > 0}
                  <div class="variations-section">
                    <span class="variations-label">Specifications:</span>
                    <div class="variations-list">
                      {#each content.product_details.specifications as spec}
                        <div class="variation-item">
                          <span class="variation-attr">{spec.key}:</span>
                          <span class="variation-value">{spec.value}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {:else if content?.request_type === "category"}
              <div class="category-details">
                <h4 class="details-title">Category Details</h4>
                {#if content?.category_details?.description?.en}
                  <div class="info-row">
                    <span class="info-label">Description:</span>
                    <span class="info-value"
                      >{content.category_details.description.en}</span
                    >
                  </div>
                {/if}
                {#if content?.category_details?.parent_category}
                  <div class="info-row">
                    <span class="info-label">Parent Category:</span>
                    <span class="info-value"
                      >{content.category_details.parent_category}</span
                    >
                  </div>
                {/if}
              </div>
            {/if}

            {#if content?.justification}
              <div class="justification-section">
                <span class="justification-label">Justification:</span>
                <p class="justification-text">{content.justification}</p>
              </div>
            {/if}

            {#if content?.admin_notes}
              <div class="admin-notes-section">
                <span class="admin-notes-label">Admin Notes:</span>
                <p class="admin-notes-text">{content.admin_notes}</p>
              </div>
            {/if}
          </div>

          <div class="card-footer">
            <button
              class="action-btn review-btn"
              onclick={() => openReviewModal(request)}
            >
              <EyeOutline class="btn-icon" />
              <span>{$_("admin_dashboard.review") || "Review"}</span>
            </button>
            <button
              class="action-btn delete-btn"
              onclick={() => deleteRequest(request)}
            >
              <CloseCircleOutline class="btn-icon" />
              <span>{$_("admin_dashboard.delete") || "Delete"}</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Review Modal -->
{#if showReviewModal && selectedRequest}
  {@const content = getRequestContent(selectedRequest)}
  <div class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">
          {$_("admin_dashboard.review_request") || "Review Request"}
        </h2>
        <button
          class="modal-close"
          onclick={closeReviewModal}
          aria-label="Close"
        >
          <svg
            class="close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
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
        <div class="review-info">
          <div class="info-block">
            <span class="block-label">Request Type:</span>
            <span
              class="block-value type-badge {getTypeBadgeClass(
                content?.request_type
              )}"
            >
              {content?.request_type || "N/A"}
            </span>
          </div>
          <div class="info-block">
            <span class="block-label">Seller:</span>
            <span class="block-value">{content?.seller_shortname || "N/A"}</span
            >
          </div>

          {#if content?.request_type === "product"}
            <div class="info-block full-width">
              <span class="block-label">Product Information:</span>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Name (EN):</span>
                  <span class="detail-value"
                    >{content?.product_details?.name?.en || "N/A"}</span
                  >
                </div>
                {#if content?.product_details?.name?.ar}
                  <div class="detail-item">
                    <span class="detail-label">Name (AR):</span>
                    <span class="detail-value rtl"
                      >{content.product_details.name.ar}</span
                    >
                  </div>
                {/if}
                {#if content?.product_details?.name?.ku}
                  <div class="detail-item">
                    <span class="detail-label">Name (KU):</span>
                    <span class="detail-value"
                      >{content.product_details.name.ku}</span
                    >
                  </div>
                {/if}
                <div class="detail-item">
                  <span class="detail-label">Category:</span>
                  <span class="detail-value"
                    >{content?.product_details?.category_shortname ||
                      "N/A"}</span
                  >
                </div>
                <div class="detail-item">
                  <span class="detail-label">Brand:</span>
                  <span class="detail-value"
                    >{content?.product_details?.brand_shortname || "N/A"}</span
                  >
                </div>
              </div>

              {#if content?.product_details?.description?.en}
                <div class="description-block">
                  <span class="detail-label">Description (EN):</span>
                  <p class="detail-text">
                    {content.product_details.description.en}
                  </p>
                </div>
              {/if}

              {#if content?.product_details?.specifications && content.product_details.specifications.length > 0}
                <div class="specs-block">
                  <span class="detail-label">Specifications:</span>
                  <div class="specs-grid">
                    {#each content.product_details.specifications as spec}
                      <div class="spec-card">
                        <span class="spec-name">{spec.key}</span>
                        <span class="spec-arrow">→</span>
                        <span class="spec-val">{spec.value}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else if content?.request_type === "category"}
            <div class="info-block full-width">
              <span class="block-label">Category Information:</span>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Name (EN):</span>
                  <span class="detail-value"
                    >{content?.category_details?.name?.en || "N/A"}</span
                  >
                </div>
                {#if content?.category_details?.name?.ar}
                  <div class="detail-item">
                    <span class="detail-label">Name (AR):</span>
                    <span class="detail-value rtl"
                      >{content.category_details.name.ar}</span
                    >
                  </div>
                {/if}
                {#if content?.category_details?.name?.ku}
                  <div class="detail-item">
                    <span class="detail-label">Name (KU):</span>
                    <span class="detail-value"
                      >{content.category_details.name.ku}</span
                    >
                  </div>
                {/if}
                {#if content?.category_details?.parent_category}
                  <div class="detail-item">
                    <span class="detail-label">Parent Category:</span>
                    <span class="detail-value"
                      >{content.category_details.parent_category}</span
                    >
                  </div>
                {/if}
              </div>

              {#if content?.category_details?.description?.en}
                <div class="description-block">
                  <span class="detail-label">Description (EN):</span>
                  <p class="detail-text">
                    {content.category_details.description.en}
                  </p>
                </div>
              {/if}
            </div>
          {/if}

          {#if content?.justification}
            <div class="info-block full-width">
              <span class="block-label">Justification:</span>
              <p class="block-text">{content.justification}</p>
            </div>
          {/if}
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("admin_dashboard.decision") || "Decision"}</span>
          </label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                bind:group={reviewForm.status}
                value="approved"
                class="radio-input"
              />
              <span class="radio-text approved">
                <CheckCircleOutline />
                {$_("admin_dashboard.approve") || "Approve"}
              </span>
            </label>
            <label class="radio-label">
              <input
                type="radio"
                bind:group={reviewForm.status}
                value="rejected"
                class="radio-input"
              />
              <span class="radio-text rejected">
                <CloseCircleOutline />
                {$_("admin_dashboard.reject") || "Reject"}
              </span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label" class:rtl={$isRTL}>
            <span>{$_("admin_dashboard.admin_notes") || "Admin Notes"}</span>
          </label>
          <textarea
            bind:value={reviewForm.admin_notes}
            placeholder={$_("admin_dashboard.admin_notes_placeholder") ||
              "Add notes about your decision..."}
            class="form-textarea"
            class:rtl={$isRTL}
            rows="4"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="modal-button cancel" onclick={closeReviewModal}>
          {$_("admin_dashboard.cancel") || "Cancel"}
        </button>
        <button class="modal-button submit" onclick={submitReview}>
          {$_("admin_dashboard.submit") || "Submit Review"}
        </button>
      </div>
    </div>
  </div>
{/if}

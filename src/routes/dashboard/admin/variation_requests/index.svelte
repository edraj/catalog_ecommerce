<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import {
    getSpaceContents,
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
  import { formatDate } from "@/lib/helpers";
  import {
    CheckCircleOutline,
    CloseCircleOutline,
    EyeOutline,
  } from "flowbite-svelte-icons";

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
      const response = await getSpaceContents(
        "Ecommerce",
        "sellers/variation_request",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        requests = response.records;
        applyFilters();
      }
    } catch (error) {
      console.error("Error loading variation requests:", error);
      errorToastMessage("Failed to load variation requests");
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    let result = [...requests];

    if (statusFilter !== "all") {
      result = result.filter((request) => {
        const content =
          request.attributes?.payload?.body?.content ||
          request.attributes?.payload?.body;
        return content?.status === statusFilter;
      });
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((request) => {
        const content =
          request.attributes?.payload?.body?.content ||
          request.attributes?.payload?.body;
        const displayname =
          request.attributes?.displayname?.toLowerCase() || "";
        const productId = content?.product_id?.toLowerCase() || "";
        const sellerId = content?.seller_id?.toLowerCase() || "";
        const justification = content?.justification?.toLowerCase() || "";

        return (
          displayname.includes(searchLower) ||
          productId.includes(searchLower) ||
          sellerId.includes(searchLower) ||
          justification.includes(searchLower)
        );
      });
    }

    filteredRequests = result;
  }

  function openReviewModal(request: any) {
    selectedRequest = request;
    const content =
      request.attributes?.payload?.body?.content ||
      request.attributes?.payload?.body;
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
      console.log(selectedRequest);
      isLoading = true;
      const content =
        selectedRequest.attributes?.payload?.body?.content ||
        selectedRequest.attributes?.payload?.body;

      const updateData = {
        displayname: selectedRequest.attributes?.displayname,
        body: {
          content: {
            ...content,
            status: reviewForm.status,
            admin_notes: reviewForm.admin_notes,
            reviewed_by: "dmart",
            reviewed_at: Date.now(),
          },
          content_type: "json",
        },
        tags: [
          `product:${content.product_id}`,
          `seller:${content.seller_id}`,
          `status:${reviewForm.status}`,
        ],
        is_active: true,
      };

      await updateEntity(
        selectedRequest.shortname,
        "Ecommerce",
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
    return (
      request.attributes?.payload?.body?.content ||
      request.attributes?.payload?.body
    );
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
            d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"
          />
        </svg>
      </div>
      <div class="header-text">
        <h1 class="page-title">
          {$_("admin_dashboard.variation_requests") || "Variation Requests"}
        </h1>
        <p class="page-subtitle">
          {$_("admin_dashboard.variation_requests_subtitle") ||
            "Review and manage seller variation requests"}
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
          "There are no variation requests matching your filters"}
      </p>
    </div>
  {:else}
    <div class="requests-grid">
      {#each filteredRequests as request (request.shortname)}
        {@const content = getRequestContent(request)}
        <div class="request-card">
          <div class="card-header">
            <div class="card-title-section">
              <h3 class="card-title">
                {request.attributes?.displayname.en || request.shortname}
              </h3>
              <span class="status-badge {getStatusBadgeClass(content?.status)}">
                {content?.status || "pending"}
              </span>
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
              <span class="info-label">Product:</span>
              <span class="info-value">{content?.product_id || "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Seller:</span>
              <span class="info-value">{content?.seller_id || "N/A"}</span>
            </div>

            {#if content?.requested_variations && content.requested_variations.length > 0}
              <div class="variations-section">
                <span class="variations-label">Requested Variations:</span>
                <div class="variations-list">
                  {#each content.requested_variations as variation}
                    <div class="variation-item">
                      <span class="variation-attr"
                        >{variation.attribute_name}:</span
                      >
                      <span class="variation-value"
                        >{variation.attribute_value}</span
                      >
                    </div>
                  {/each}
                </div>
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
          {$_("admin_dashboard.review_request") || "Review Variation Request"}
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
            <span class="block-label">Product ID:</span>
            <span class="block-value">{content?.product_id || "N/A"}</span>
          </div>
          <div class="info-block">
            <span class="block-label">Seller ID:</span>
            <span class="block-value">{content?.seller_id || "N/A"}</span>
          </div>

          {#if content?.requested_variations && content.requested_variations.length > 0}
            <div class="info-block full-width">
              <span class="block-label">Requested Variations:</span>
              <div class="variations-grid">
                {#each content.requested_variations as variation}
                  <div class="variation-card">
                    <span class="var-name">{variation.attribute_name}</span>
                    <span class="var-arrow">→</span>
                    <span class="var-val">{variation.attribute_value}</span>
                  </div>
                {/each}
              </div>
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

<style>
  .variation-requests-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    min-height: 100vh;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  }

  .page-header {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .header-icon-wrapper {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .header-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: white;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1a202c;
    margin: 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: #718096;
    margin: 0.25rem 0 0 0;
  }

  .filters-section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .search-bar {
    position: relative;
    flex: 1;
    min-width: 250px;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    stroke: #a0aec0;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .search-input.rtl {
    padding: 0.875rem 3rem 0.875rem 1rem;
    text-align: right;
  }

  .filter-group {
    position: relative;
    min-width: 200px;
  }

  .filter-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    stroke: #a0aec0;
    pointer-events: none;
    z-index: 1;
  }

  .filter-select {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .filter-select.rtl {
    padding: 0.875rem 3rem 0.875rem 1rem;
    text-align: right;
  }

  .loading-state,
  .empty-state {
    background: white;
    border-radius: 16px;
    padding: 4rem 2rem;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 1.1rem;
    color: #4a5568;
    margin: 0;
  }

  .empty-icon {
    width: 4rem;
    height: 4rem;
    stroke: #cbd5e0;
    margin: 0 auto 1.5rem;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2d3748;
    margin: 0 0 0.5rem 0;
  }

  .empty-description {
    font-size: 1rem;
    color: #718096;
    margin: 0;
  }

  .requests-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .request-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .request-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  }

  .card-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1.5rem;
    color: white;
  }

  .card-title-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    flex: 1;
  }

  .status-badge {
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-approved {
    background: #d1fae5;
    color: #065f46;
  }

  .status-rejected {
    background: #fee2e2;
    color: #991b1b;
  }

  .card-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .meta-icon {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
  }

  .card-body {
    padding: 1.5rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .info-label {
    font-weight: 600;
    color: #4a5568;
  }

  .info-value {
    color: #2d3748;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    font-size: 0.9rem;
  }

  .variations-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
  }

  .variations-label {
    display: block;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 0.75rem;
  }

  .variations-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .variation-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #f7fafc;
    border-radius: 6px;
  }

  .variation-attr {
    font-weight: 600;
    color: #667eea;
  }

  .variation-value {
    color: #2d3748;
  }

  .justification-section,
  .admin-notes-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
  }

  .justification-label,
  .admin-notes-label {
    display: block;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 0.5rem;
  }

  .justification-text,
  .admin-notes-text {
    color: #2d3748;
    line-height: 1.6;
    margin: 0;
  }

  .admin-notes-text {
    background: #fff5f5;
    padding: 0.75rem;
    border-radius: 6px;
    border-left: 3px solid #f56565;
  }

  .card-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #f7fafc;
    border-top: 1px solid #e2e8f0;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .review-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .review-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .delete-btn {
    background: #fee2e2;
    color: #991b1b;
  }

  .delete-btn:hover {
    background: #fca5a5;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }

  .modal-container {
    background: white;
    border-radius: 20px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 2px solid #e2e8f0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .modal-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .close-icon {
    width: 1.5rem;
    height: 1.5rem;
    stroke: white;
  }

  .modal-body {
    padding: 2rem;
  }

  .review-info {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid #e2e8f0;
  }

  .info-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-block.full-width {
    grid-column: 1 / -1;
  }

  .block-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .block-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: #2d3748;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
  }

  .block-text {
    font-size: 1rem;
    color: #4a5568;
    line-height: 1.6;
    margin: 0;
  }

  .variations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .variation-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%);
    border-radius: 8px;
    border-left: 3px solid #38b2ac;
  }

  .var-name {
    font-weight: 700;
    color: #234e52;
  }

  .var-arrow {
    color: #38b2ac;
    font-weight: 700;
  }

  .var-val {
    font-weight: 600;
    color: #2d3748;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .form-label.rtl {
    text-align: right;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
  }

  .radio-label {
    flex: 1;
    cursor: pointer;
  }

  .radio-input {
    display: none;
  }

  .radio-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .radio-input:checked + .radio-text {
    border-color: #667eea;
    background: #f0f4ff;
  }

  .radio-text.approved {
    color: #059669;
  }

  .radio-input:checked + .radio-text.approved {
    border-color: #059669;
    background: #d1fae5;
  }

  .radio-text.rejected {
    color: #dc2626;
  }

  .radio-input:checked + .radio-text.rejected {
    border-color: #dc2626;
    background: #fee2e2;
  }

  .form-textarea {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    transition: all 0.2s ease;
  }

  .form-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-textarea.rtl {
    text-align: right;
    direction: rtl;
  }

  .modal-footer {
    display: flex;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 2px solid #e2e8f0;
    background: #f7fafc;
  }

  .modal-button {
    flex: 1;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-button.cancel {
    background: #e2e8f0;
    color: #4a5568;
  }

  .modal-button.cancel:hover {
    background: #cbd5e0;
  }

  .modal-button.submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .modal-button.submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  @media (max-width: 768px) {
    .variation-requests-container {
      padding: 1rem;
    }

    .page-header {
      padding: 1.5rem;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .requests-grid {
      grid-template-columns: 1fr;
    }

    .filters-section {
      flex-direction: column;
    }

    .review-info {
      grid-template-columns: 1fr;
    }

    .radio-group {
      flex-direction: column;
    }
  }
</style>

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

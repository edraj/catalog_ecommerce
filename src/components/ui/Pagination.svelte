<script lang="ts">
  import { _ } from "@/i18n";
  import { locale } from "@/i18n";
  import { formatNumber } from "@/lib/helpers";

  interface Props {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage?: number;
    onPageChange: (page: number) => void;
  }

  let {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage = 10,
    onPageChange,
  }: Props = $props();

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }
</script>

{#if totalPages > 1}
  <div class="pagination">
    <button
      class="btn btn-secondary btn-small"
      onclick={previousPage}
      disabled={currentPage === 1}
    >
      {$_("pagination.previous") || "Previous"}
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
        >{formatNumber(totalItems, $locale)}
        {$_("pagination.total_items") || "total items"}</span
      >
    </div>

    <button
      class="btn btn-secondary btn-small"
      onclick={nextPage}
      disabled={currentPage === totalPages}
    >
      {$_("pagination.next") || "Next"}
    </button>
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

  @media (max-width: 768px) {
    .pagination {
      flex-direction: column;
      gap: 16px;
    }

    .pagination-pages {
      order: 2;
      justify-content: center;
      width: 100%;
    }

    .pagination-info {
      order: 1;
      justify-content: center;
    }

    .page-btn {
      min-width: 32px;
      height: 32px;
      font-size: 13px;
    }
  }
</style>

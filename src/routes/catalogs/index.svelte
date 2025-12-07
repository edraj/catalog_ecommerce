<script lang="ts">
  import { onMount } from "svelte";
  import {
    getSpaceContents,
    getSpaces,
    getSpaceTags,
    searchInCatalog,
  } from "@/lib/dmart_services";
  import { Diamonds } from "svelte-loading-spinners";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { formatNumber, formatNumberInText } from "@/lib/helpers";
  import { QueryType } from "@edraj/tsdmart";
  import "./styles/index.css";

  $goto;

  let isLoading = $state(true);
  let spaces = $state([]);
  let filteredSpaces = $state([]);
  let error = $state(null);
  let searchQuery = $state("");
  let sortBy = $state("name");
  let filterActive = $state("all");
  let searchResults = $state([]);
  let isSearching = $state(false);
  let searchTimeout: number;
  let spaceStats = [];
  let totalSpaceItems = 0;
  let spaceTags = {};

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  onMount(async () => {
    try {
      const response = await getSpaces(false, "public");

      const statsPromises = response.records.map(async (space) => {
        const data = await getSpaceContents(
          space.shortname,
          "/",
          "public",
          100,
          0,
          false,
          QueryType.counters
        );
        const tags = await getSpaceTags(space.shortname);

        if (tags.status === "success" && tags.records.length > 0) {
          const tagData = tags.records[0].attributes;
          if (tagData.tag_counts) {
            const sortedTags = Object.entries(tagData.tag_counts)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => Number(b.count) - Number(a.count));

            spaceTags[space.shortname] = sortedTags;
          }
        } else {
          spaceTags[space.shortname] = [];
        }

        return {
          spaceName: space.shortname,
          total: data.attributes.total,
        };
      });

      const stats = await Promise.all(statsPromises);

      const totalItems = stats.reduce((sum, stat) => sum + stat.total, 0);

      spaces = response.records || [];
      filteredSpaces = spaces;

      spaceStats = stats;
      totalSpaceItems = totalItems;
    } catch (err) {
      console.error("Error fetching spaces:", err);
      error = $_("catalogs.error.failed_load");
    } finally {
      isLoading = false;
    }
  });

  function getTagsSpaces(shortname) {
    return spaceTags[shortname] || [];
  }

  function getSpaceStats(spaceShortname) {
    return (
      spaceStats.find((stat) => stat.spaceName === spaceShortname)?.total || 0
    );
  }

  function handleSpaceClick(space: any) {
    $goto("/catalogs/[space_name]", {
      space_name: space.shortname,
    });
  }

  function handleRecordClick(record: any) {
    const encodedSubpath = encodeURIComponent(record.subpath);

    $goto("/catalogs/[space_name]/[subpath]/[shortname]/[resource_type]", {
      space_name: record.attributes?.space_name,
      subpath: encodedSubpath,
      shortname: record.shortname,
      resource_type: record.resource_type,
    });
  }

  function getDisplayName(space: any): string {
    const displayname = space.attributes?.displayname;
    if (displayname) {
      return (
        displayname[$locale] ||
        displayname.en ||
        displayname.ar ||
        space.shortname
      );
    }
    return space.shortname || $_("catalogs.unnamed_space");
  }

  function getDescription(space: any): string {
    const description = space.attributes?.description;
    if (description) {
      return (
        description[$locale] ||
        description.en ||
        description.ar ||
        $_("catalogs.no_description")
      );
    }
    return $_("catalogs.no_description");
  }

  function getRecordDisplayName(record: any): string {
    const displayname = record.attributes?.displayname;
    if (displayname) {
      return (
        displayname[$locale] ||
        displayname.en ||
        displayname.ar ||
        record.shortname
      );
    }
    if (
      record.resource_type === "ticket" &&
      record.attributes?.payload?.body?.title
    ) {
      return record.attributes.payload.body.title;
    }
    return record.shortname || $_("catalogs.unnamed_record");
  }

  function getRecordDescription(record: any): string {
    const description = record.attributes?.description;

    if (description) {
      return (
        description[$locale] ||
        description.en ||
        description.ar ||
        $_("catalogs.no_description")
      );
    }

    if (
      record.resource_type === "ticket" &&
      record.attributes?.payload?.body?.content
    ) {
      const contentType = record.attributes?.payload?.content_type;

      if (contentType === "json") {
        let processedContent = record.attributes.payload.body.content
          .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[Image: $1]")
          .replace(/<img[^>]*>/gi, "[Image]")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        return processedContent.length > 200
          ? processedContent.substring(0, 200) + "..."
          : processedContent || $_("catalogs.no_description");
      } else {
        const textContent = record.attributes.payload.body.content.replace(
          /<[^>]*>/g,
          ""
        );
        return textContent.length > 200
          ? textContent.substring(0, 200) + "..."
          : textContent;
      }
    }

    if (record.attributes?.payload?.body) {
      const htmlContent = record.attributes.payload.body;
      if (typeof htmlContent === "string") {
        const contentType = record.attributes?.payload?.content_type;

        if (contentType === "json") {
          let processedContent = htmlContent
            .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "[Image: $1]")
            .replace(/<img[^>]*>/gi, "[Image]")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim();

          return processedContent.length > 200
            ? processedContent.substring(0, 200) + "..."
            : processedContent || $_("catalogs.no_description");
        } else {
          const textContent = htmlContent.replace(/<[^>]*>/g, "");
          return textContent.length > 200
            ? textContent.substring(0, 200) + "..."
            : textContent;
        }
      }
    }

    return $_("catalogs.no_description");
  }
  function formatDate(dateString: string): string {
    if (!dateString) return $_("common.not_available");
    return new Date(dateString).toLocaleDateString($locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function performSearch(query: string) {
    if (!query.trim()) {
      searchResults = [];
      filteredSpaces = spaces;
      return;
    }

    isSearching = true;
    try {
      const results = await searchInCatalog(query.trim());
      searchResults = results;

      filteredSpaces = [];
    } catch (err) {
      console.error("Error performing search:", err);
      error = $_("catalogs.error.search_failed");
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  function applyFilters() {
    if (searchQuery.trim()) {
      return;
    }

    let filtered = spaces;

    if (filterActive !== "all") {
      filtered = filtered.filter((space) =>
        filterActive === "active"
          ? space.attributes?.is_active
          : !space.attributes?.is_active
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "created":
          return (
            new Date(b.attributes?.created_at || 0).getTime() -
            new Date(a.attributes?.created_at || 0).getTime()
          );
        case "updated":
          return (
            new Date(b.attributes?.updated_at || 0).getTime() -
            new Date(a.attributes?.updated_at || 0).getTime()
          );
        default:
          return getDisplayName(a).localeCompare(getDisplayName(b));
      }
    });

    filteredSpaces = filtered;
  }

  function handleSearchInput() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);
  }

  function handleContactUs() {
    $goto("/contact");
  }

  $effect(() => {
    if (!searchQuery.trim()) {
      searchResults = [];
      applyFilters();
    }
  });

  $effect(() => {
    applyFilters();
  });
</script>

<div class="catalog-page" class:rtl={$isRTL}>
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          {$_("catalogs.hero.title")}
        </h1>
        <p class="hero-description">
          {$_("catalogs.hero.description")}
        </p>
      </div>
    </div>
  </section>

  <section class="search-section">
    <div class="search-container">
      <div class="search-bar">
        <svg
          class="search-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
        <label for="search-input"></label>
        <input
          type="text"
          placeholder={$_("catalogs.search.placeholder")}
          bind:value={searchQuery}
          oninput={handleSearchInput}
          class="search-input"
        />
        {#if isSearching}
          <div class="search-loading">
            <Diamonds color="#6366f1" size="20" unit="px" />
          </div>
        {/if}
      </div>

      {#if !searchQuery.trim()}
        <div class="filters">
          <label for="sort-select"></label>
          <select bind:value={sortBy} class="filter-select">
            <option value="name">{$_("catalogs.sort.name")}</option>
            <option value="created">{$_("catalogs.sort.created")}</option>
            <option value="updated">{$_("catalogs.sort.updated")}</option>
          </select>
        </div>
      {/if}
    </div>
  </section>

  <section class="content-section">
    {#if isLoading}
      <div class="loading-state">
        <Diamonds color="#6366f1" size="60" unit="px" />
        <p class="loading-text">{$_("common.loading")}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
        <h2 class="error-title">{$_("catalogs.error.title")}</h2>
        <p class="error-message">{error}</p>
      </div>
    {:else if searchQuery.trim() && searchResults.length === 0 && !isSearching}
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
        <h3 class="empty-title">{$_("catalogs.empty.no_results_title")}</h3>
        <p class="empty-message">
          {$_("catalogs.empty.no_results_description")}
        </p>
      </div>
    {:else if searchQuery.trim() && searchResults.length > 0}
      <div class="search-results">
        <div class="results-header">
          <div class="results-info">
            <h2 class="results-title">
              {$_("catalogs.search.results_title", {
                values: {
                  count: formatNumberInText(searchResults.length, $locale),
                  query: searchQuery,
                },
              })}
            </h2>
            <p class="results-subtitle">
              {$_("catalogs.search.results_subtitle", {
                values: {
                  count: formatNumberInText(searchResults.length, $locale),
                },
              })}
            </p>
          </div>

          <!-- Clear Search Button -->
          <button
            class="clear-search-btn"
            onclick={() => {
              searchQuery = "";
              searchResults = [];
              applyFilters();
            }}
            aria-label={$_("catalogs.search.clear")}
          >
            <svg
              class="clear-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
            {$_("catalogs.search.clear")}
          </button>
        </div>

        <!-- Enhanced Results Grid -->
        <div class="results-grid">
          {#each searchResults as record, index}
            <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
            <article
              class="result-card {record.resource_type}-card"
              onclick={() => handleRecordClick(record)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleRecordClick(record);
                }
              }}
              style="animation-delay: {index * 50}ms"
            >
              <!-- Card Header with Resource Type Indicator -->
              <div class="result-header">
                <div class="result-avatar-container">
                  <div class="result-avatar {record.resource_type}">
                    <div class="avatar-circle">
                      {record.shortname
                        ? record.shortname.charAt(0).toUpperCase()
                        : "R"}
                    </div>
                  </div>
                </div>

                <!-- Result Title and Meta -->
                <div class="result-info">
                  <h3 class="result-title">
                    {getRecordDisplayName(record)}
                  </h3>

                  <div class="result-meta-line">
                    <span class="result-shortname">@{record.shortname}</span>
                    <span class="meta-separator">•</span>
                    <span class="result-space">
                      <svg
                        class="space-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        ></path>
                      </svg>
                      {record.attributes?.space_name}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Result Content -->
              <div class="result-content">
                <p class="result-description">
                  {getRecordDescription(record)}
                </p>
              </div>

              <!-- Tags Section -->
              {#if record.attributes?.tags && record.attributes.tags.length > 0}
                <div class="result-tags">
                  {#each record.attributes.tags.slice(0, 4) as tag}
                    <span class="tag">
                      <svg
                        class="tag-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        ></path>
                      </svg>
                      {tag}
                    </span>
                  {/each}
                  {#if record.attributes.tags.length > 4}
                    <span class="tag-more">
                      +{formatNumberInText(
                        record.attributes.tags.length - 4,
                        $locale
                      )} more
                    </span>
                  {/if}
                </div>
              {/if}

              <!-- Result Footer -->
              <div class="result-footer">
                <div class="result-meta">
                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span class="meta-text">
                      {record.attributes?.owner_shortname ||
                        $_("common.unknown")}
                    </span>
                  </div>

                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <span class="meta-text">
                      {formatDate(record.attributes?.created_at)}
                    </span>
                  </div>

                  {#if record.attributes?.updated_at && record.attributes.updated_at !== record.attributes.created_at}
                    <div class="meta-item updated">
                      <svg
                        class="meta-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                      </svg>
                      <span class="meta-text">
                        Updated {formatDate(record.attributes.updated_at)}
                      </span>
                    </div>
                  {/if}
                </div>

                <!-- Action Button -->
                <div class="result-actions">
                  <button
                    class="view-btn"
                    aria-label={$_("catalogs.actions.view_details")}
                  >
                    <svg
                      class="action-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Hover Effect Overlay -->
              <div class="card-overlay"></div>
            </article>
          {/each}
        </div>
      </div>
    {:else if !searchQuery.trim() && filteredSpaces.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
        </div>
        <h3 class="empty-title">{$_("catalogs.empty.no_catalogs_title")}</h3>
        <p class="empty-message">
          {$_("catalogs.empty.no_catalogs_description")}
        </p>
      </div>
    {:else}
      {#if !isLoading && spaceStats.length > 0}
        <div class="header-stats">
          <h1 class="stats-title">{$_("SpacesDashboard")}</h1>
          <div class="global-stats">
            <div class="global-stat-card">
              <div class="global-stat-number">
                {formatNumber(spaces.length, $locale)}
              </div>
              <div class="global-stat-label">Total Spaces</div>
            </div>
            <div class="global-stat-card">
              <div class="global-stat-number">
                {formatNumber(totalSpaceItems, $locale)}
              </div>
              <div class="global-stat-label">Total Items</div>
            </div>
          </div>
        </div>
      {/if}
      {#if !isLoading}
        <div class="spaces-grid">
          {#each filteredSpaces as space}
            <div
              class="space-card"
              onclick={() => handleSpaceClick(space)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleSpaceClick(space);
                }
              }}
            >
              <div class="space-header">
                <div class="space-avatar">
                  <div class="avatar-circle">
                    {space.shortname
                      ? space.shortname.charAt(0).toUpperCase()
                      : "S"}
                  </div>
                </div>
                <div class="space-info">
                  <h1 class="space-title">{getDisplayName(space)}</h1>
                  <p class="space-shortname">@{space.shortname}</p>
                </div>
              </div>

              <div class="space-content">
                <p class="space-description">{getDescription(space)}</p>

                <!-- Tags Section -->
                {#if getTagsSpaces(space.shortname).length > 0}
                  <div class="space-tags">
                    {#each getTagsSpaces(space.shortname).slice(0, 5) as tag}
                      <span class="tag-chip">{tag.name}</span>
                    {/each}
                    {#if getTagsSpaces(space.shortname).length > 5}
                      <span class="tag-more"
                        >+{formatNumberInText(
                          getTagsSpaces(space.shortname).length - 5,
                          $locale
                        )}</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Individual Space Stats -->
              <div class="space-stats">
                <div class="space-stat-number">
                  {formatNumber(getSpaceStats(space.shortname), $locale)}
                </div>
                <div class="space-stat-label">{$_("itemsInSpace")}</div>
              </div>
              <div class="space-footer">
                <div class="space-meta">
                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      ></path>
                    </svg>
                    <span
                      >{space.attributes?.owner_shortname ||
                        $_("common.unknown")}</span
                    >
                  </div>
                  <div class="meta-item">
                    <svg
                      class="meta-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <span>{formatDate(space.attributes?.created_at)}</span>
                  </div>
                </div>

                {#if space.attributes?.primary_website}
                  <a
                    href={space.attributes.primary_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="website-link"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <svg
                      class="link-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      ></path>
                    </svg>
                    {$_("catalogs.actions.visit")}
                  </a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </section>

  <footer class="footer-section">
    <div class="footer-content">
      <div class="footer-grid">
        <div class="footer-brand">
          <h3 class="brand-name">{$_("Catalog")}</h3>
          <p class="brand-description">
            {$_("BrandDescription")}
          </p>
        </div>

        <div class="footer-column">
          <h4 class="footer-column-title">{$_("Support")}</h4>
          <ul class="footer-links">
            <li><a href="/help">{$_("HelpCenter")}</a></li>
            <li><a href="/community">{$_("Community")}</a></li>
            <li>
              <button onclick={handleContactUs} class="footer-link-button"
                >{$_("ContactUs")}</button
              >
            </li>
            <li><a href="/privacy">{$_("Privacy")}</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>{$_("Copyright")}</p>
      </div>
    </div>
  </footer>
</div>

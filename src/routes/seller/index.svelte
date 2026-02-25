<script lang="ts">
  import { onMount } from "svelte";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import { website } from "@/config.js";
  import { getSpaceContents } from "@/lib/dmart_services";
  import { getSellerOrders } from "@/lib/dmart_services";
  import { errorToastMessage } from "@/lib/toasts_messages";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  // Theme
  const PRIMARY = "#281f51";
  const TEXT_MUTED = "#6b7280";

  let isLoading = $state(true);

  // KPI values
  let productsCount = $state(0);
  let activeDiscountsCount = $state(0);
  let totalOrders = $state(0);
  let warrantiesCount = $state(0);
  let shippingRulesCount = $state(0);

  // Trend data
  let ordersTrend = $state<number[]>([]);
  let ordersTrendLabels = $state<string[]>([]);

  // Helpers
  function safeNumber(n: any) {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }

  function getOrderDate(order: any): Date | null {
    const raw =
      order?.attributes?.created_at ||
      order?.created_at ||
      order?.attributes?.payload?.created_at ||
      order?.attributes?.payload?.body?.created_at ||
      order?.date ||
      order?.timestamp;

    if (!raw) return null;

    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDayLabel(d: Date) {
    // short label like "Feb 25"
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  }

  function buildDailyTrend(orders: any[], days: number = 14) {
    // Build last N days buckets (including today)
    const today = new Date();
    const buckets: { key: string; date: Date; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      dt.setHours(0, 0, 0, 0);
      buckets.push({
        key: dt.toISOString().slice(0, 10),
        date: dt,
        count: 0,
      });
    }

    const map = new Map(buckets.map((b) => [b.key, b]));

    for (const o of orders) {
      const d = getOrderDate(o);
      if (!d) continue;

      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);

      const bucket = map.get(key);
      if (bucket) bucket.count += 1;
    }

    ordersTrendLabels = buckets.map((b) => formatDayLabel(b.date));
    ordersTrend = buckets.map((b) => b.count);
  }

  // SVG line path generator (0..100 viewBox)
  function svgLinePath(data: number[]) {
    if (!data?.length) return "";

    const max = Math.max(...data, 1); // avoid div by 0
    const n = data.length;

    return data
      .map((v, i) => {
        const x = n === 1 ? 0 : (i / (n - 1)) * 100;
        const y = 100 - (v / max) * 100;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  function svgAreaPath(data: number[]) {
    const line = svgLinePath(data);
    if (!line) return "";
    // Close to bottom for area fill
    return `${line} L 100 100 L 0 100 Z`;
  }

  // Active discounts: try common shapes
  function countActiveDiscounts(items: any[]) {
    if (!Array.isArray(items)) return 0;

    const isActive = (d: any) => {
      // Flexible matching: true-ish flags or status strings
      const flag =
        d?.active ?? d?.enabled ?? d?.is_active ?? d?.isEnabled ?? d?.isActive;

      if (typeof flag === "boolean") return flag;

      const status = (d?.status ?? d?.state ?? "").toString().toLowerCase();
      if (["active", "enabled", "running", "on"].includes(status)) return true;

      // If there is no clear flag, treat as active (you can tighten later)
      return flag == null && !status ? true : false;
    };

    return items.filter(isActive).length;
  }

  async function loadDashboardStats() {
    isLoading = true;

    try {
      const sellerShortname = $user?.shortname;

      // -----------------------------
      // Products (ACTIVE only)
      // -----------------------------
      const productsRes = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        1000,
        0,
        true,
      );

      const allProducts = Array.isArray(productsRes?.records)
        ? productsRes.records
        : [];

      // Detect active product safely
      function isProductActive(p: any) {
        const flag = p?.attributes.is_active;

        if (typeof flag === "boolean") return flag;

        const status = ( p?.attributes?.is_active 
        )
          .toString()
          .toLowerCase();

        if (["active", "enabled", "published", "live"].includes(status))
          return true;

        return false;
      }
      productsCount = allProducts.filter(isProductActive).length;

      // -----------------------------
      // Discounts (count active)
      // -----------------------------
      const discountsRes = await getSpaceContents(
        website.main_space,
        `/discounts/${sellerShortname}`,
        "managed",
        100,
        0,
        true,
      );

      const configEntry =
        discountsRes?.records?.find((r) => r.resource_type === "content") ||
        discountsRes?.records?.[0];

      const discountItems =
        configEntry?.attributes?.payload?.body?.items &&
        Array.isArray(configEntry.attributes.payload.body.items)
          ? configEntry.attributes.payload.body.items
          : [];

      activeDiscountsCount = countActiveDiscounts(discountItems);

      // -----------------------------
      // Orders (total + trend)
      // -----------------------------
      // Use a bigger limit to build a reasonable trend without multiple pages
      const ordersRes = await getSellerOrders(
        website.main_space,
        sellerShortname,
        500,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      if (ordersRes?.status === "success") {
        const records = Array.isArray(ordersRes?.records)
          ? ordersRes.records
          : [];
        totalOrders = safeNumber(
          ordersRes?.attributes?.total ?? records.length,
        );

        // Build last 14 days trend from returned orders
        buildDailyTrend(records, 14);
      } else {
        totalOrders = 0;
        ordersTrend = [];
        ordersTrendLabels = [];
      }

      // -----------------------------
      // Shipping rules (count)
      // -----------------------------
      const shippingRes = await getSpaceContents(
        website.main_space,
        `/shipping/${sellerShortname}`,
        "managed",
        100,
        0,
        true,
      );

      const shippingConfig =
        Array.isArray(shippingRes?.records) && shippingRes.records.length > 0
          ? shippingRes.records[0]
          : { attributes: { payload: { body: { items: [] } } } };

      const shippingItems = shippingConfig?.attributes?.payload?.body?.items;
      shippingRulesCount = Array.isArray(shippingItems)
        ? shippingItems.length
        : 0;

      // -----------------------------
      // Warranties (count)
      // -----------------------------
      const warrantiesRes = await getSpaceContents(
        website.main_space,
        `/warranties/${sellerShortname}`,
        "managed",
        1000,
        0,
        true,
      );

      warrantiesCount = Array.isArray(warrantiesRes?.records)
        ? warrantiesRes.records.length
        : 0;
    } catch (e) {
      console.error("Error loading seller dashboard stats:", e);
      errorToastMessage("Error loading dashboard stats");
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadDashboardStats();
  });
</script>

<div class="seller-dashboard-container">
  <div class="seller-dashboard-content">
    <!-- Header -->
    <div>
        <div class="header-right w-full flex justify-end items-center">
          <button
            class="refresh-btn"
            on:click={loadDashboardStats}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Available Products</div>
        <div class="kpi-value">{isLoading ? "—" : productsCount}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Active Discounts</div>
        <div class="kpi-value">{isLoading ? "—" : activeDiscountsCount}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Orders</div>
        <div class="kpi-value">{isLoading ? "—" : totalOrders}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Total Warranties</div>
        <div class="kpi-value">{isLoading ? "—" : warrantiesCount}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Shipping Rules</div>
        <div class="kpi-value">{isLoading ? "—" : shippingRulesCount}</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <!-- Orders Trend (SVG, no library) -->
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">Orders Trend (Last 14 days)</div>
          <div class="chart-subtitle" style="color: {TEXT_MUTED}">
            {ordersTrend?.length
              ? `${ordersTrend.reduce((a, b) => a + b, 0)} orders in range`
              : "No data"}
          </div>
        </div>

        {#if isLoading}
          <div class="chart-skeleton"></div>
        {:else if ordersTrend?.length}
          <div class="svg-wrap">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              class="trend-svg"
              aria-label="Orders trend chart"
            >
              <!-- area fill -->
              <path d={svgAreaPath(ordersTrend)} fill="rgba(40,31,81,0.10)" />
              <!-- line -->
              <path
                d={svgLinePath(ordersTrend)}
                fill="none"
                stroke={PRIMARY}
                stroke-width="2.2"
              />
              <!-- baseline -->
              <line
                x1="0"
                y1="100"
                x2="100"
                y2="100"
                stroke="rgba(229,231,235,1)"
                stroke-width="1"
              />
            </svg>
          </div>

          <div class="trend-labels" dir="ltr">
            {#each ordersTrendLabels as label, i}
              {#if i === 0 || i === Math.floor(ordersTrendLabels.length / 2) || i === ordersTrendLabels.length - 1}
                <span class="trend-label">{label}</span>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="empty-state">No orders data to display.</div>
        {/if}
      </div>

      <!-- Simple Insights Card (no library) -->
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">Quick Insights</div>
          <div class="chart-subtitle" style="color: {TEXT_MUTED}">
            Snapshot of your current setup
          </div>
        </div>

        {#if isLoading}
          <div class="insights-skeleton"></div>
        {:else}
          <div class="insights-list">
            <div class="insight-row">
              <span class="insight-label">Discount coverage</span>
              <span class="insight-value">{activeDiscountsCount} active</span>
            </div>

            <div class="progress">
              <div
                class="progress-bar"
                style="
                  width: {Math.min(
                  100,
                  productsCount
                    ? (activeDiscountsCount / Math.max(1, productsCount)) * 100
                    : 0,
                )}%;
                "
              ></div>
            </div>
            <div class="progress-hint">
              Based on discounts vs products (rough indicator)
            </div>

            <div class="divider"></div>

            <div class="insight-row">
              <span class="insight-label">Shipping rules</span>
              <span class="insight-value">{shippingRulesCount}</span>
            </div>

            <div class="insight-row">
              <span class="insight-label">Warranties</span>
              <span class="insight-value">{warrantiesCount}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* Keep your existing layout styles (seller-dashboard-container/content/header) from index.css */
  /* The styles below match your theme and UI style (bordered cards, rounded corners) */

  .header-content {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .refresh-btn {
    padding: 0.65rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(229, 231, 235, 0.8);
    background: #f3f4f6;
    color: #374151;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .refresh-btn:hover {
    background: #e5e7eb;
  }
  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1rem;
    margin-top: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .kpi-card {
    grid-column: span 12;
    background: #fff;
    border: 1px solid
      var(--colors-border-border-base-medium, rgba(229, 231, 235, 0.9));
    border-radius: 1rem;
    padding: 1.1rem 1.15rem;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .kpi-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 25px rgba(0, 0, 0, 0.06);
  }

  .kpi-label {
    color: #6b7280;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }

  .kpi-value {
    color: #281f51;
    font-size: 1.8rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .chart-card {
    grid-column: span 12;
    background: #fff;
    border: 1px solid
      var(--colors-border-border-base-medium, rgba(229, 231, 235, 0.9));
    border-radius: 1.1rem;
    padding: 1.25rem;
  }

  .chart-header {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-bottom: 1rem;
  }

  .chart-title {
    font-weight: 800;
    color: #111827;
    font-size: 1rem;
  }

  .chart-subtitle {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .svg-wrap {
    width: 100%;
    border-radius: 0.9rem;
    border: 1px solid rgba(229, 231, 235, 0.8);
    background: linear-gradient(180deg, rgba(249, 250, 251, 0.9), #fff);
    padding: 0.75rem;
  }

  .trend-svg {
    width: 100%;
    height: 180px;
    display: block;
  }

  .trend-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.6rem;
    color: #6b7280;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .trend-label {
    white-space: nowrap;
  }

  .empty-state {
    padding: 1.25rem;
    border-radius: 0.9rem;
    border: 1px dashed rgba(229, 231, 235, 0.9);
    color: #6b7280;
    background: rgba(249, 250, 251, 0.8);
    font-weight: 600;
  }

  .chart-skeleton {
    height: 220px;
    border-radius: 0.9rem;
    background: linear-gradient(
      90deg,
      rgba(243, 244, 246, 1),
      rgba(229, 231, 235, 1),
      rgba(243, 244, 246, 1)
    );
    animation: shimmer 1.2s infinite linear;
    background-size: 200% 100%;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  .insights-skeleton {
    height: 160px;
    border-radius: 0.9rem;
    background: linear-gradient(
      90deg,
      rgba(243, 244, 246, 1),
      rgba(229, 231, 235, 1),
      rgba(243, 244, 246, 1)
    );
    animation: shimmer 1.2s infinite linear;
    background-size: 200% 100%;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .insights-list {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .insight-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 700;
    color: #374151;
    font-size: 0.9rem;
  }

  .insight-label {
    color: #6b7280;
    font-weight: 700;
  }

  .insight-value {
    color: #111827;
  }

  .progress {
    height: 10px;
    border-radius: 999px;
    background: rgba(229, 231, 235, 1);
    overflow: hidden;
    border: 1px solid rgba(229, 231, 235, 0.7);
  }

  .progress-bar {
    height: 100%;
    border-radius: 999px;
    background: #281f51;
    transition: width 0.3s ease;
  }

  .progress-hint {
    color: #6b7280;
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: -0.35rem;
  }

  .divider {
    height: 1px;
    background: rgba(229, 231, 235, 0.8);
    margin: 0.4rem 0;
  }

  /* Responsive layout */
  @media (min-width: 768px) {
    .kpi-card {
      grid-column: span 4;
    }
    .charts-grid .chart-card:first-child {
      grid-column: span 8;
    }
    .charts-grid .chart-card:last-child {
      grid-column: span 4;
    }
  }
</style>

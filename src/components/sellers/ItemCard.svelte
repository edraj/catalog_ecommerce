<script lang="ts">
  import {
    FolderOutline,
    TagOutline,
    LayersSolid,
  } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";
  import { formatDate } from "@/lib/helpers";

  interface Props {
    item: any;
    onView: (item: any) => void;
    onEdit: (item: any) => void;
    onDelete: (item: any) => void;
    isRTL: boolean;
  }

  let { item, onView, onEdit, onDelete, isRTL }: Props = $props();

  const IconComponent = $derived(getResourceTypeIcon(item.resource_type));

  function getLocalizedDisplayName(item: any) {
    const displayname = item.attributes?.displayname;
    if (!displayname) return item.shortname || "Untitled";
    if (typeof displayname === "string") return displayname;

    const locale = localStorage.getItem("locale") || "en";
    return (
      displayname[locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku ||
      item.shortname ||
      "Untitled"
    );
  }

  function getResourceTypeLabel(resourceType: string): string {
    const labels: { [key: string]: string } = {
      content: $_("seller_dashboard.content"),
      media: $_("seller_dashboard.media"),
      folder: $_("seller_dashboard.folder"),
      comment: $_("seller_dashboard.comment"),
    };
    return labels[resourceType] || resourceType;
  }

  function getResourceTypeIcon(resourceType: string) {
    switch (resourceType) {
      case "folder":
        return FolderOutline;
      case "media":
        return LayersSolid;
      default:
        return TagOutline;
    }
  }

  function getContentPreview(item: any) {
    const payload = item.attributes?.payload;
    if (!payload || !payload.body) return "";

    const body = payload.body;

    if (item.resource_type === "content") {
      if (payload.content_type === "html" && typeof body === "string") {
        return body;
      }

      if (payload.content_type === "json") {
        if (typeof body === "object") {
          const content = body.content || body;

          if (content.product_id && content.price !== undefined) {
            return `Product: ${content.product_id} | Price: $${content.price} | Stock: ${content.stock || 0} | SKU: ${content.sku || "N/A"}`;
          }

          if (
            content.type &&
            content.amount !== undefined &&
            content.min_value !== undefined
          ) {
            const amountDisplay =
              content.type === "percentage"
                ? `${content.amount}%`
                : `$${content.amount}`;
            const maxDisplay = content.max_value
              ? ` | Max: $${content.max_value}`
              : "";
            return `Coupon: ${content.type} - ${amountDisplay} | Min: $${content.min_value}${maxDisplay}`;
          }

          if (content.name && content.city && content.country) {
            return `Branch: ${content.name} | ${content.city}, ${content.state ? content.state + ", " : ""}${content.country}`;
          }

          if (
            content.product_ids &&
            Array.isArray(content.product_ids) &&
            content.price !== undefined
          ) {
            return `Bundle: ${content.product_ids.length} products | Price: $${content.price}`;
          }

          if (body.description && typeof body.description === "string") {
            return body.description;
          }

          return JSON.stringify(content).substring(0, 100) + "...";
        }
      }
    }

    return "";
  }

  function getItemCategory(item: any) {
    const payload = item.attributes?.payload;
    if (!payload || !payload.body) return null;

    const body = payload.body;
    const content = body.content || body;

    if (
      item.subpath.includes("/available_products") &&
      content.product_id &&
      content.category_id
    ) {
      return { type: "product", icon: "🛍️", color: "#281f51" };
    } else if (
      item.subpath.includes("/coupons") &&
      content.type &&
      content.amount !== undefined
    ) {
      return { type: "coupon", icon: "🎟️", color: "#10b981" };
    } else if (
      item.subpath.includes("/discounts") &&
      content.product_id &&
      content.discount_percentage
    ) {
      return { type: "discount", icon: "💰", color: "#ec4899" };
    } else if (
      item.subpath.includes("/warranties") &&
      content.product_id &&
      content.warranty_duration
    ) {
      return { type: "warranty", icon: "🛡️", color: "#8b5cf6" };
    } else if (item.subpath.includes("/orders") && content.order_id) {
      return { type: "order", icon: "📦", color: "#f59e0b" };
    }

    return null;
  }
</script>

<div class="item-card">
  <div class="item-card-header">
    <div class="item-type-badge">
      <IconComponent class="type-icon" />
      <span>{getResourceTypeLabel(item.resource_type)}</span>
    </div>
    <div class="item-actions">
      <button
        class="action-button view"
        onclick={() => onView(item)}
        title={$_("seller_dashboard.view")}
      >
        <svg
          class="action-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </button>
      <button
        class="action-button edit"
        onclick={() => onEdit(item)}
        title={$_("seller_dashboard.edit")}
      >
        <svg
          class="action-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
      <button
        class="action-button delete"
        onclick={() => onDelete(item)}
        title={$_("seller_dashboard.delete")}
      >
        <svg
          class="action-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  </div>

  <div class="item-card-body">
    <div class="item-title-row">
      <h3 class="item-title" class:rtl={isRTL}>
        {getLocalizedDisplayName(item)}
      </h3>
      {#if getItemCategory(item)}
        {@const category = getItemCategory(item)}
        <span
          class="item-category-badge"
          style="background: {category.color}15; color: {category.color}; border-color: {category.color}30;"
        >
          <span class="category-icon">{category.icon}</span>
          <span class="category-text">{category.type}</span>
        </span>
      {/if}
    </div>
    <p class="item-shortname">{item.shortname}</p>
    {#if getContentPreview(item)}
      <p class="item-preview" class:rtl={isRTL}>
        {getContentPreview(item)}
      </p>
    {/if}
  </div>

  <div class="item-card-footer">
    <div class="item-meta">
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
      <span class="meta-text">{formatDate(item.attributes.updated_at)}</span>
    </div>
  </div>
</div>

<style>
  .item-card {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
    position: relative;
  }

  .item-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: #281f51;
    transform: scaleX(0);
    transition: transform 0.4s ease;
  }

  .item-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    border-color: #281f51;
  }

  .item-card:hover::before {
    transform: scaleX(1);
  }

  .item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: #281f51;
    border-bottom: 1px solid #e2e8f0;
  }

  .item-type-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #281f51;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.625rem;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-button:hover {
    transform: scale(1.1);
  }

  .action-button.view:hover {
    background: #281f51;
    border-color: #281f51;
  }

  .action-button.view:hover .action-icon {
    color: white;
  }

  .action-button.edit:hover {
    background: #48bb78;
    border-color: #48bb78;
  }

  .action-button.edit:hover .action-icon {
    color: white;
  }

  .action-button.delete:hover {
    background: #f56565;
    border-color: #f56565;
  }

  .action-button.delete:hover .action-icon {
    color: white;
  }

  .action-icon {
    width: 1.125rem;
    height: 1.125rem;
    color: #718096;
    stroke-width: 2;
    transition: color 0.3s ease;
  }

  .item-card-body {
    padding: 1.75rem 1.5rem;
  }

  .item-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .item-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    line-height: 1.4;
    flex: 1;
    min-width: 0;
  }

  .item-title.rtl {
    text-align: right;
  }

  .item-category-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.9rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1.5px solid;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .item-category-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .category-icon {
    font-size: 1.1rem;
    line-height: 1;
  }

  .category-text {
    font-weight: 600;
  }

  .item-shortname {
    font-size: 0.85rem;
    color: #a0aec0;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    margin: 0 0 1rem 0;
    padding: 0.25rem 0.75rem;
    background: #f7fafc;
    border-radius: 6px;
    display: inline-block;
  }

  .item-preview {
    font-size: 0.95rem;
    color: #718096;
    line-height: 1.7;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .item-preview.rtl {
    text-align: right;
  }

  .item-card-footer {
    padding: 1.25rem 1.5rem;
    background: #281f51;
    border-top: 1px solid #e2e8f0;
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #718096;
    font-size: 0.875rem;
  }

  .meta-icon {
    width: 1rem;
    height: 1rem;
    stroke-width: 2;
  }

  @media (max-width: 768px) {
    .item-card-header {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .item-type-badge {
      flex: 1;
    }
  }
</style>

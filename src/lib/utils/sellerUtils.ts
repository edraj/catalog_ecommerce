/**
 * Seller-specific utility functions for the seller dashboard
 */
import { _, locale } from "@/i18n";
/**
 * Gets localized display name from an entity
 * @param item - Entity with displayname attribute
 * @param locale - Current locale (default: 'en')
 * @param fallbackText - Text to return if no displayname found
 * @returns Localized display name or fallback
 */
export function getLocalizedDisplayName(
  item: any,
  locale: string = "en",
  fallbackText: string = "Untitled"
): string {
  const displayname = item?.attributes?.displayname;

  if (!displayname) {
    return item?.shortname || fallbackText;
  }

  if (typeof displayname === "string") {
    return displayname;
  }

  const localizedName =
    displayname[locale] || displayname.en || displayname.ar || displayname.ku;
  return localizedName || item?.shortname || fallbackText;
}

/**
 * Generates preview text for different content types
 * @param item - Entity item with payload
 * @returns Preview text string
 */
export function getContentPreview(item: any): string {
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

        // Product availability preview
        if (content.product_id && content.price !== undefined) {
          return `Product: ${content.product_id} | Price: $${
            content.price
          } | Stock: ${content.stock || 0} | SKU: ${content.sku || "N/A"}`;
        }

        // Coupon preview
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

        // Branch preview
        if (content.name && content.city && content.country) {
          return `Branch: ${content.name} | ${content.city}, ${
            content.state ? content.state + ", " : ""
          }${content.country}`;
        }

        // Bundle preview (array format)
        if (
          content.product_ids &&
          Array.isArray(content.product_ids) &&
          content.price !== undefined
        ) {
          return `Bundle: ${content.product_ids.length} products | Price: $${content.price}`;
        }

        // Bundle preview (single product format)
        if (
          content.product_id &&
          content.price !== undefined &&
          !content.category_id
        ) {
          return `Bundle: Product ${content.product_id} | Price: $${content.price}`;
        }

        // Generic description
        if (body.description && typeof body.description === "string") {
          return body.description;
        }

        return JSON.stringify(content).substring(0, 100) + "...";
      }
    }
  }

  return "";
}

/**
 * Gets the category information for an item based on its content and subpath
 * @param item - Entity item
 * @returns Category object with type, icon, and color, or null
 */
export function getItemCategory(item: any): {
  type: string;
  icon: string;
  color: string;
} | null {
  const payload = item.attributes?.payload;
  if (!payload || !payload.body) return null;

  const body = payload.body;
  const content = body.content || body;

  if (
    item.subpath.includes("/available_products") &&
    content.product_id &&
    content.category_id
  ) {
    return { type: "product", icon: "🛍️", color: "#667eea" };
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

/**
 * Gets localized resource type label
 * @param resourceType - Resource type string
 * @param translations - Translation function
 * @returns Localized label
 */
export function getResourceTypeLabel(
  resourceType: string,
  translations: any
): string {
  const labels: { [key: string]: string } = {
    content: translations("seller_dashboard.content"),
    media: translations("seller_dashboard.media"),
    folder: translations("seller_dashboard.folder"),
    comment: translations("seller_dashboard.comment"),
  };
  return labels[resourceType] || resourceType;
}

/**
 * Filters items based on search term and category
 * @param items - Array of items to filter
 * @param searchTerm - Search query string
 * @param categoryFilter - Category filter ('all' or category shortname)
 * @param locale - Current locale
 * @returns Filtered items array
 */
export function filterItems(
  items: any[],
  searchTerm: string,
  categoryFilter: string,
  locale: string = "en"
): any[] {
  let result = [...items];

  if (searchTerm.trim()) {
    const search = searchTerm.toLowerCase();
    result = result.filter((item) => {
      const displayName = getLocalizedDisplayName(item, locale).toLowerCase();
      const shortname = item.shortname?.toLowerCase() || "";
      return displayName.includes(search) || shortname.includes(search);
    });
  }

  if (categoryFilter !== "all") {
    result = result.filter((item) => {
      const payload = item.attributes?.payload;
      if (!payload || !payload.body) return false;

      const body = payload.body;
      const content = body.content || body;

      return content?.category_id === categoryFilter;
    });
  }

  return result;
}

/**
 * Filters products based on search term
 * @param products - Array of products to filter
 * @param searchTerm - Search query string
 * @param locale - Current locale
 * @returns Filtered products array
 */
export function filterProductsBySearch(
  products: any[],
  searchTerm: string,
  locale: string = "en"
): any[] {
  if (!searchTerm.trim()) {
    return products;
  }

  const search = searchTerm.toLowerCase();
  return products.filter((product) => {
    const displayName = getLocalizedDisplayName(product, locale).toLowerCase();
    const shortname = product.shortname?.toLowerCase() || "";
    return displayName.includes(search) || shortname.includes(search);
  });
}

/**
 * Generates Cartesian product of specification arrays
 * @param arrays - Array of arrays to combine
 * @param index - Current index for recursion
 * @param current - Current combination being built
 * @returns Array of all combinations
 */
export function generateCartesianProduct(
  arrays: any[][],
  index: number = 0,
  current: any[] = []
): any[] {
  const combinations: any[] = [];

  function recurse(idx: number, curr: any[]) {
    if (idx === arrays.length) {
      combinations.push([...curr]);
      return;
    }

    for (const item of arrays[idx]) {
      recurse(idx + 1, [...curr, item]);
    }
  }

  recurse(index, current);
  return combinations;
}

/**
 * Creates seller folder structure
 * @param sellerShortname - Seller's shortname
 * @param translations - Translation function
 * @returns Array of folder objects
 */
export function createSellerFolders(
  sellerShortname: string,
  translations: any
): any[] {
  return [
    {
      shortname: "available_products",
      subpath: `/available_products/${sellerShortname}`,
      resource_type: "folder",
      icon: "ShoppingBagSolid",
      attributes: {
        displayname: {
          en:
            translations("seller_dashboard.available_products") ||
            "Available Products",
          ar: "المنتجات المتاحة",
        },
      },
    },
    {
      shortname: "discounts",
      subpath: `/discounts/${sellerShortname}`,
      resource_type: "folder",
      icon: "BadgeCheckSolid",
      attributes: {
        displayname: {
          en: translations("seller_dashboard.discounts") || "Discounts",
          ar: "الخصومات",
        },
      },
    },
    {
      shortname: "orders",
      subpath: `/orders/${sellerShortname}`,
      resource_type: "folder",
      icon: "ClipboardListSolid",
      attributes: {
        displayname: {
          en: translations("seller_dashboard.orders") || "Orders",
          ar: "الطلبات",
        },
      },
    },
    {
      shortname: "coupons",
      subpath: `/coupons/${sellerShortname}`,
      resource_type: "folder",
      icon: "TicketSolid",
      attributes: {
        displayname: {
          en: translations("seller_dashboard.coupons") || "Coupons",
          ar: "الكوبونات",
        },
      },
    },
    {
      shortname: "warranties",
      subpath: `/warranties/${sellerShortname}`,
      resource_type: "folder",
      icon: "ShieldCheckSolid",
      attributes: {
        displayname: {
          en: translations("seller_dashboard.warranties") || "Warranties",
          ar: "الضمانات",
        },
      },
    },
    {
      shortname: "shipping",
      subpath: `/shipping/${sellerShortname}`,
      resource_type: "folder",
      icon: "TruckSolid",
      attributes: {
        displayname: {
          en:
            translations("seller_dashboard.shipping_and_service") ||
            "Shipping & Service",
          ar: "الشحن والخدمة",
          ku: "گەیاندن و خزمەتگوزاری",
        },
      },
    },
  ];
}

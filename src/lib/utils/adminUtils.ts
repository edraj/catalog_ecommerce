/**
 * Admin utility functions for common operations across admin pages
 */

/**
 * Gets localized display name from an entity
 * Tries to get the localized version based on current locale, falls back to other languages
 * @param item - Entity item with displayname attribute
 * @param locale - Current locale (en, ar, ku)
 * @returns Localized display name or shortname as fallback
 */
export function getLocalizedDisplayName(
  item: any,
  locale: string = "en"
): string {
  const displayname = item?.attributes?.displayname;

  if (!displayname) {
    return item?.shortname || "Untitled";
  }

  if (typeof displayname === "string") {
    return displayname;
  }

  // Try current locale first, then fallback to other languages
  const localizedName =
    displayname[locale] || displayname.en || displayname.ar || displayname.ku;
  return localizedName || item?.shortname || "Untitled";
}

/**
 * Gets localized description from an entity
 * @param item - Entity item with description attribute
 * @param locale - Current locale (en, ar, ku)
 * @returns Localized description or default message
 */
export function getLocalizedDescription(
  item: any,
  locale: string = "en"
): string {
  const description = item?.attributes?.description;

  if (!description) {
    return "No description available";
  }

  if (typeof description === "string") {
    return description;
  }

  return (
    description[locale] ||
    description.en ||
    description.ar ||
    description.ku ||
    "No description available"
  );
}

/**
 * Formats a date string according to the specified locale
 * @param dateString - ISO date string
 * @param locale - Current locale
 * @param fallback - Fallback text if date is invalid
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string,
  locale: string = "en",
  fallback: string = "N/A"
): string {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString(locale);
}

/**
 * Gets the appropriate icon for a resource type
 * @param item - Entity item with resource_type
 * @returns Icon emoji string
 */
export function getItemIcon(item: any): string {
  switch (item.resource_type) {
    case "folder":
      return "📁";
    case "content":
      return "📄";
    case "post":
      return "📝";
    case "comment":
      return "💬";
    case "media":
      return "🖼️";
    case "user":
      return "👤";
    case "ticket":
      return "🎫";
    default:
      return "📄";
  }
}

/**
 * Gets the color associated with a resource type
 * @param resourceType - Type of the resource
 * @returns Hex color code
 */
export function getResourceTypeColor(resourceType: string): string {
  switch (resourceType) {
    case "folder":
      return "#3b82f6"; // blue
    case "content":
      return "#10b981"; // green
    case "post":
      return "#8b5cf6"; // purple
    case "comment":
      return "#f59e0b"; // amber
    case "media":
      return "#ec4899"; // pink
    case "user":
      return "#6366f1"; // indigo
    case "ticket":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}

/**
 * Gets the badge text for a resource type
 * @param resourceType - Type of the resource
 * @param translations - Translation function
 * @returns Localized resource type text
 */
export function getResourceTypeLabel(
  resourceType: string,
  translations?: any
): string {
  if (translations) {
    return translations(`resource_types.${resourceType}`) || resourceType;
  }
  // Fallback to capitalized resource type
  return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
}

/**
 * Generates a random alphanumeric key
 * @param length - Length of the key to generate
 * @returns Random key string
 */
export function generateKey(length: number = 26): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let key = "";
  for (let i = 0; i < length; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

/**
 * Checks if a string matches a search query (case-insensitive)
 * @param text - Text to search in
 * @param query - Search query
 * @returns True if text contains query
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query || !text) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Filters an array of items based on search query
 * Searches in displayname, shortname, and description
 * @param items - Array of items to filter
 * @param query - Search query
 * @param locale - Current locale
 * @returns Filtered array
 */
export function filterBySearch(
  items: any[],
  query: string,
  locale: string = "en"
): any[] {
  if (!query.trim()) return items;

  return items.filter((item) => {
    const displayName = getLocalizedDisplayName(item, locale);
    const description = getLocalizedDescription(item, locale);
    const shortname = item?.shortname || "";

    return (
      matchesSearch(displayName, query) ||
      matchesSearch(description, query) ||
      matchesSearch(shortname, query)
    );
  });
}

/**
 * Sorts items by a specified field
 * @param items - Array of items to sort
 * @param sortBy - Field to sort by
 * @param sortOrder - 'asc' or 'desc'
 * @param locale - Current locale for display name sorting
 * @returns Sorted array
 */
export function sortItems(
  items: any[],
  sortBy: string = "name",
  sortOrder: "asc" | "desc" = "asc",
  locale: string = "en"
): any[] {
  const sorted = [...items].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case "name":
        aValue = getLocalizedDisplayName(a, locale).toLowerCase();
        bValue = getLocalizedDisplayName(b, locale).toLowerCase();
        break;
      case "created":
        aValue = new Date(a.created_at || 0).getTime();
        bValue = new Date(b.created_at || 0).getTime();
        break;
      case "updated":
        aValue = new Date(a.updated_at || 0).getTime();
        bValue = new Date(b.updated_at || 0).getTime();
        break;
      case "owner":
        aValue = (a.owner_shortname || "").toLowerCase();
        bValue = (b.owner_shortname || "").toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Entity-related utility functions for working with e-commerce entities
 * (categories, products, specifications, variations, etc.)
 */

/**
 * Gets the parent category ID from a category entity
 * @param category - Category entity
 * @returns Parent category ID or null
 */
export function getCategoryParentId(category: any): string | null {
  const body = category.attributes?.payload?.body;

  if (!body) return null;

  // Handle string format (JSON string)
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed?.content?.parent_category_shortname || null;
    } catch {
      return null;
    }
  }

  // Handle object format
  const content = body.content || body;
  return content?.parent_category_shortname || null;
}

/**
 * Gets the name of a parent category
 * @param parentId - Parent category shortname
 * @param categories - Array of all categories
 * @param locale - Current locale
 * @returns Parent category display name or the ID if not found
 */
export function getParentCategoryName(
  parentId: string | null,
  categories: any[],
  locale: string = "en",
): string | null {
  if (!parentId) return null;
  const parent = categories.find((c: any) => c.shortname === parentId);
  if (!parent) return parentId;

  const displayname = parent.attributes?.displayname;
  if (!displayname) return parent.shortname;
  if (typeof displayname === "string") return displayname;

  return (
    displayname[locale] ||
    displayname.en ||
    displayname.ar ||
    displayname.ku ||
    parent.shortname
  );
}

/**
 * Checks if a category is a parent (has no parent itself)
 * @param category - Category entity
 * @returns True if category is a parent category
 */
export function isParentCategory(category: any): boolean {
  return !getCategoryParentId(category);
}

/**
 * Gets all subcategories of a parent category
 * @param parentId - Parent category shortname
 * @param categories - Array of all categories
 * @returns Array of subcategory entities
 */
export function getSubCategories(parentId: string, categories: any[]): any[] {
  return categories.filter((c: any) => getCategoryParentId(c) === parentId);
}

/**
 * Gets the product shortname from a specification entity
 * @param specification - Specification entity
 * @returns Product shortname or null
 */
export function getSpecificationProduct(specification: any): string | null {
  const content =
    typeof specification.attributes?.payload?.body === "string"
      ? JSON.parse(specification.attributes.payload.body)
      : specification.attributes?.payload?.body;
  return content?.product || null;
}

/**
 * Gets the attributes object from a specification entity
 * @param specification - Specification entity
 * @returns Attributes object or empty object
 */
export function getSpecificationAttributes(
  specification: any,
): Record<string, any> {
  const content =
    typeof specification.attributes?.payload?.body === "string"
      ? JSON.parse(specification.attributes.payload.body)
      : specification.attributes?.payload?.body;
  return content?.attributes || {};
}

/**
 * Gets the product display name from products array
 * @param productId - Product shortname
 * @param products - Array of all products
 * @param locale - Current locale
 * @returns Product display name or ID if not found
 */
export function getProductName(
  productId: string,
  products: any[],
  locale: string = "en",
): string {
  const product = products.find((p: any) => p.shortname === productId);
  if (!product) return productId;

  const displayname = product.attributes?.displayname;
  if (!displayname) return product.shortname;
  if (typeof displayname === "string") return displayname;

  return (
    displayname[locale] ||
    displayname.en ||
    displayname.ar ||
    displayname.ku ||
    product.shortname
  );
}

/**
 * Gets the options array from a variation entity
 * @param variation - Variation entity
 * @returns Array of option objects
 */
export function getVariationOptions(variation: any): any[] {
  return variation.attributes?.payload?.body?.options || [];
}

/**
 * Gets the localized name of an option
 * @param option - Option object with name property
 * @param locale - Current locale
 * @returns Localized option name
 */
export function getOptionName(option: any, locale: string = "en"): string {
  const name = option?.name;
  if (!name) return "Unnamed";

  if (typeof name === "string") return name;

  return name[locale] || name.en || name.ar || name.ku || "Unnamed";
}

/**
 * Filters specifications by product
 * @param specifications - Array of specifications
 * @param productId - Product shortname to filter by ('all' for no filter)
 * @returns Filtered specifications array
 */
export function filterSpecificationsByProduct(
  specifications: any[],
  productId: string,
): any[] {
  if (productId === "all") return specifications;
  return specifications.filter(
    (spec: any) => getSpecificationProduct(spec) === productId,
  );
}

/**
 * Filters categories by parent
 * @param categories - Array of categories
 * @param parentFilter - Parent filter ('all', 'root', or specific parent ID)
 * @returns Filtered categories array
 */
export function filterCategoriesByParent(
  categories: any[],
  parentFilter: string,
): any[] {
  if (parentFilter === "all") {
    return categories.filter((c: any) => isParentCategory(c));
  } else if (parentFilter === "root") {
    return categories.filter((c: any) => isParentCategory(c));
  } else {
    return categories.filter(
      (c: any) => getCategoryParentId(c) === parentFilter,
    );
  }
}

/**
 * Extracts content body from entity payload
 * Handles both string (JSON) and object formats
 * @param entity - Entity with payload attribute
 * @returns Parsed content body or empty object
 */
export function getEntityContent(entity: any): any {
  const payload = entity?.attributes?.payload?.body;

  if (!payload) return {};

  // Handle string format
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return parsed.content || parsed;
    } catch {
      return {};
    }
  }

  // Handle object format - extract content if it exists
  return payload.content || payload;
}

/**
 * Builds entity payload for API requests
 * @param content - Content object to be stringified
 * @returns Payload object with body as JSON string
 */
export function buildEntityPayload(content: any): any {
  return {
    body: JSON.stringify(content),
    schema_shortname: "ecommerce_entity",
  };
}

/**
 * Counts total subcategories for a parent category
 * @param parentId - Parent category shortname
 * @param categories - Array of all categories
 * @returns Count of subcategories
 */
export function countSubCategories(
  parentId: string,
  categories: any[],
): number {
  return getSubCategories(parentId, categories).length;
}

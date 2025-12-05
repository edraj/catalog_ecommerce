/**
 * Product variation and specification utilities
 */
import { _, locale } from "@/i18n";
export type VariantType = "color" | "storage";

export interface ProductVariant {
  key: string;
  type: VariantType;
  shortname: string;
  name: string;
  hex?: string;
  qty: number;
  retailPrice: number;
  sku: string;
  discount: {
    type: string;
    value: number;
  };
}

export interface SpecificationGroup {
  attributeName: string;
  specifications: any[];
}

/**
 * Loads product variations (colors and storages) from variation records
 * @param variationRecords - Array of variation records from API
 * @param productVariationOptions - Product's variation options
 * @returns Array of product variants
 */
export function loadProductVariations(
  variationRecords: any[],
  productVariationOptions: any[]
): ProductVariant[] {
  const colorsData = variationRecords.find((v) => v.shortname === "colors");
  const storagesData = variationRecords.find((v) => v.shortname === "storages");

  const colors = colorsData?.attributes?.payload?.body?.options || [];
  const storages = storagesData?.attributes?.payload?.body?.options || [];

  const productVariants: ProductVariant[] = [];

  // Process color variations
  const colorVariation = productVariationOptions.find(
    (opt) => opt.variation_shortname === "colors"
  );
  if (colorVariation && colors.length > 0) {
    const selectedColorKeys = colorVariation.values || [];
    colors.forEach((color: any) => {
      if (selectedColorKeys.includes(color.key)) {
        productVariants.push({
          key: color.key,
          type: "color",
          shortname: `color_${color.key}`,
          name: color.name,
          hex: color.value,
          qty: 0,
          retailPrice: 0,
          sku: "",
          discount: { type: "amount", value: 0 },
        });
      }
    });
  }

  // Process storage variations
  const storageVariation = productVariationOptions.find(
    (opt) => opt.variation_shortname === "storages"
  );
  if (storageVariation && storages.length > 0) {
    const selectedStorageKeys = storageVariation.values || [];
    storages.forEach((storage: any) => {
      if (selectedStorageKeys.includes(storage.key)) {
        productVariants.push({
          key: storage.key,
          type: "storage",
          shortname: `storage_${storage.key}`,
          name: storage.name,
          qty: 0,
          retailPrice: 0,
          sku: "",
          discount: { type: "amount", value: 0 },
        });
      }
    });
  }

  return productVariants;
}

/**
 * Generates all possible combinations from specification groups
 * @param specificationGroups - Array of specification groups
 * @param existingPrices - Existing price data for combinations
 * @returns Object with combinations and price data
 */
export function generateCombinations(
  specificationGroups: SpecificationGroup[],
  existingPrices: Record<string, { price: string; stock: string; sku: string }>
): {
  combinations: any[];
  prices: Record<string, { price: string; stock: string; sku: string }>;
} {
  if (specificationGroups.length === 0) {
    return { combinations: [], prices: {} };
  }

  const combinations: any[] = [];
  const prices = { ...existingPrices };
  const specSets = specificationGroups.map((group) => group.specifications);

  function cartesianProduct(
    arrays: any[][],
    index: number = 0,
    current: any[] = []
  ) {
    if (index === arrays.length) {
      const specs = current.map((item) => item.originalSpec);
      const comboId = specs.map((spec) => spec.shortname).join("_");
      const displayParts = current.map((item) => item.value);

      combinations.push({
        id: comboId,
        specifications: specs,
        displayName: displayParts.join(" - "),
        attributes: current,
      });

      if (!prices[comboId]) {
        prices[comboId] = {
          price: "",
          stock: "",
          sku: "",
        };
      }
      return;
    }

    for (const spec of arrays[index]) {
      cartesianProduct(arrays, index + 1, [...current, spec]);
    }
  }

  cartesianProduct(specSets);
  return { combinations, prices };
}

/**
 * Validates variant data before submission
 * @param variants - Array of variants to validate
 * @param selectedVariantKeys - Array of selected variant keys
 * @returns Object with isValid flag and error message
 */
export function validateVariants(
  variants: ProductVariant[],
  selectedVariantKeys: string[]
): { isValid: boolean; error?: string } {
  const filledVariants = variants.filter(
    (variant) =>
      selectedVariantKeys.includes(variant.key) &&
      variant.retailPrice &&
      parseFloat(variant.retailPrice.toString()) > 0
  );

  if (filledVariants.length === 0) {
    return {
      isValid: false,
      error: "Please add price for at least one variation",
    };
  }

  return { isValid: true };
}

/**
 * Prepares variant data for API submission
 * @param variants - Array of product variants
 * @param selectedVariantKeys - Array of selected variant keys
 * @returns Array of formatted variant data
 */
export function prepareVariantsForSubmission(
  variants: ProductVariant[],
  selectedVariantKeys: string[]
): any[] {
  const filledVariants = variants.filter(
    (variant) =>
      selectedVariantKeys.includes(variant.key) &&
      variant.retailPrice &&
      parseFloat(variant.retailPrice.toString()) > 0
  );

  return filledVariants.map((variant) => ({
    key: variant.key,
    qty: variant.qty ? parseInt(variant.qty.toString()) : 0,
    sku: variant.sku || "",
    retail_price: parseFloat(variant.retailPrice.toString()),
    discount: variant.discount || { type: "amount", value: 0 },
    options: [
      {
        key: variant.key,
        variation_shortname: variant.type === "color" ? "colors" : "storages",
      },
    ],
  }));
}

/**
 * Filters products by category
 * @param products - Array of products
 * @param categoryShortname - Category shortname to filter by
 * @returns Filtered products array
 */
export function filterProductsByCategory(
  products: any[],
  categoryShortname: string
): any[] {
  return products.filter((product) => {
    const content = product.attributes?.payload?.body;
    const categories = content?.categories_shortnames || [];
    const mainCategory = content?.main_category_shortname;
    return (
      categories.includes(categoryShortname) ||
      mainCategory === categoryShortname
    );
  });
}

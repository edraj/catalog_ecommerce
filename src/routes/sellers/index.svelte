<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { formatDate } from "@/lib/helpers";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    FolderOutline,
    TagOutline,
    LayersSolid,
  } from "flowbite-svelte-icons";
  import { user } from "@/stores/user";
  import { ResourceType } from "@edraj/tsdmart";
  import {
    getSpaceContents,
    createEntity,
    updateEntity,
  } from "@/lib/dmart_services";

  import {
    getLocalizedDisplayName,
    getContentPreview,
    getItemCategory,
    getResourceTypeLabel,
    filterItems,
    filterProductsBySearch,
    createSellerFolders,
  } from "@/lib/utils/sellerUtils";
  import {
    loadProductVariations,
    generateCombinations,
    validateVariants,
    prepareVariantsForSubmission,
    filterProductsByCategory,
    type ProductVariant,
    type SpecificationGroup,
  } from "@/lib/utils/productVariationUtils";
  import "./styles/index.css";
  import FolderCard from "@/components/sellers/FolderCard.svelte";
  import ItemCard from "@/components/sellers/ItemCard.svelte";
  import DeleteConfirmModal from "@/components/sellers/DeleteConfirmModal.svelte";
  import AddProductModal from "@/components/sellers/AddProductModal.svelte";
  import CouponModal from "@/components/sellers/CouponModal.svelte";
  import BranchModal from "@/components/sellers/BranchModal.svelte";
  import BundleModal from "@/components/sellers/BundleModal.svelte";
  import VariationRequestModal from "@/components/sellers/VariationRequestModal.svelte";
  import DiscountModal from "@/components/sellers/DiscountModal.svelte";
  import WarrantyModal from "@/components/sellers/WarrantyModal.svelte";
  import EditModal from "@/components/sellers/EditModal.svelte";
  import ProductCategoryRequestModal from "@/components/sellers/ProductCategoryRequestModal.svelte";
  import ShippingManagement from "@/components/sellers/ShippingManagement.svelte";
  import "@/components/sellers/ShippingManagement.css";
  import { website } from "@/config";

  $goto;
  let folders = $state([]);
  let items = $state([]);
  let filteredItems = $state([]);
  let selectedFolder = $state<string | null>(null);
  let isLoading = $state(true);
  let searchTerm = $state("");
  let categoryFilter = $state("all");
  let filterCategories = $state([]);

  let showAddItemModal = $state(false);
  let categories = $state([]);
  let products = $state([]);
  let variations = $state({ colors: [], storages: [] });
  let allVariations = $state([]);
  let productsMap = $state(new Map());
  let warranties = $state([]);
  let commissionCategories = $state([]);
  let selectedCategory = $state("");
  let selectedProduct = $state("");
  let selectedWarranty = $state("");
  let selectedCommissionCategory = $state("");
  let productVariants = $state<ProductVariant[]>([]);
  let selectedVariants = $state([]);
  let isLoadingCategories = $state(false);
  let isLoadingProducts = $state(false);
  let isLoadingVariations = $state(false);
  let isLoadingWarranties = $state(false);
  let productSearchTerm = $state("");
  let filteredProducts = $state([]);

  let availabilityForm = $state({
    hasFastDelivery: false,
    hasFreeShipping: false,
    estShippingFrom: 1,
    estShippingTo: 5,
  });

  let specificationGroups = $state<SpecificationGroup[]>([]);
  let generatedCombinations = $state<any[]>([]);
  let combinationPrices = $state<
    Record<string, { price: string; stock: string; sku: string }>
  >({});

  let showCouponModal = $state(false);
  let couponForm = $state({
    code: "",
    type: "individual",
    discountType: "percentage",
    discountValue: "",
    minimumSpend: "",
    maximumAmount: "",
    maximumUses: "",
    maximumPerUser: "1",
    validFrom: "",
    validTo: "",
    brandShortnames: [],
  });

  let brands = $state([]);
  let isLoadingBrands = $state(false);

  let showBranchModal = $state(false);
  let branchForm = $state({
    name: "",
    country: "",
    state: "",
    city: "",
    address: "",
  });

  let showBundleModal = $state(false);
  let bundleForm = $state({
    selectedProducts: [],
    price: "",
  });
  let sellerProducts = $state([]);
  let filteredSellerProducts = $state([]);
  let isLoadingSellerProducts = $state(false);
  let bundleProductSearch = $state("");
  let bundleCategoryFilter = $state("all");
  let productCategories = $state([]);

  let showWarrantyModal = $state(false);
  let warrantyForm = $state({
    displaynameEn: "",
    displaynameAr: "",
    displaynameKu: "",
    descriptionEn: "",
    descriptionAr: "",
    descriptionKu: "",
    isGlobal: true,
    brandShortname: "",
  });

  let showDiscountModal = $state(false);
  let discountForm = $state({
    type: "",
    typeShortname: "",
    value: "",
    validFrom: "",
    validTo: "",
  });
  let discountCategories = $state([]);
  let isLoadingDiscountCategories = $state(false);
  let warrantyCategories = $state([]);
  let isLoadingWarrantyCategories = $state(false);

  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let itemToEdit = $state(null);
  let itemToDelete = $state(null);

  let showVariationRequestModal = $state(false);
  let variationRequestForm = $state({
    product: "",
    variations: [{ attribute_name: "", attribute_value: "" }],
    justification: "",
  });
  let isLoadingVariationCategories = $state(false);
  let variationProducts = $state([]);
  let isLoadingVariationProducts = $state(false);

  let showProductCategoryRequestModal = $state(false);
  let requestType = $state("product");
  let productRequestForm = $state({
    name_en: "",
    name_ar: "",
    name_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    category_shortname: "",
    brand_shortname: "",
    specifications: [{ key: "", value: "" }],
    justification: "",
  });
  let categoryRequestForm = $state({
    name_en: "",
    name_ar: "",
    name_ku: "",
    description_en: "",
    description_ar: "",
    description_ku: "",
    parent_category: "",
    justification: "",
  });

  let isShippingView = $state(false);
  let shippingConfig = $state(null);
  let shippingItemForm = $state({
    states: [],
    settings: [
      {
        min: "",
        max: "",
        cost: "",
        minimum_retail: "",
        note: "",
        is_active: true,
      },
    ],
  });
  let showShippingItemModal = $state(false);
  let editingShippingItemIndex = $state(null);

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  // Wrapper function for getLocalizedDisplayName to include current locale
  function getItemDisplayName(item: any): string {
    return getLocalizedDisplayName(item, $locale);
  }

  onMount(async () => {
    await loadFolders();
    await loadFilterCategories();
  });

  async function loadFolders() {
    isLoading = true;
    try {
      const sellerShortname = $user.shortname;
      folders = createSellerFolders(sellerShortname, $_);
    } catch (error) {
      console.error("Error loading folders:", error);
      errorToastMessage(
        $_("seller_dashboard.error_loading_folders") || "Error loading folders"
      );
    } finally {
      isLoading = false;
    }
  }

  async function loadFolderContents(folderShortname: string) {
    isLoading = true;
    selectedFolder = folderShortname;
    try {
      const sellerShortname = $user.shortname;
      const response = await getSpaceContents(
        website.main_space,
        `/${folderShortname}/${sellerShortname}`,
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        items = response.records;

        // Load variations and products for available folder
        if (folderShortname === "available_products") {
          await Promise.all([loadAllVariations(), loadAllProducts()]);
        }

        // Handle shipping folder specially
        if (folderShortname === "shipping") {
          isShippingView = true;
          await loadShippingData();
          return;
        }

        isShippingView = false;

        applyFilters();
      }
    } catch (error) {
      console.error("Error loading folder contents:", error);
      errorToastMessage(
        $_("seller_dashboard.error_loading_contents") ||
          "Error loading folder contents"
      );
    } finally {
      isLoading = false;
    }
  }

  function goBackToFolders() {
    selectedFolder = null;
    items = [];
    filteredItems = [];
    isShippingView = false;
  }

  async function loadFilterCategories() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        filterCategories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  async function loadAllVariations() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        100,
        0,
        true
      );
      if (response?.records) {
        allVariations = response.records;
      }
    } catch (error) {
      console.error("Error loading variations:", error);
    }
  }

  async function loadBrands() {
    isLoadingBrands = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "brands",
        "managed",
        1000,
        0,
        true
      );
      if (response?.records) {
        brands = response.records;
      }
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      isLoadingBrands = false;
    }
  }

  async function loadAllProducts() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        100,
        0,
        true
      );
      if (response?.records) {
        productsMap = new Map(response.records.map((p) => [p.shortname, p]));
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  }

  function resolveOptionKey(
    optionKey: string,
    variationShortname: string
  ): string {
    const variation = allVariations.find(
      (v) => v.shortname === variationShortname
    );
    if (!variation) return optionKey;

    const body = variation.attributes?.payload?.body;
    const options = body?.options || [];
    const option = options.find((opt: any) => opt.key === optionKey);

    if (option?.name) {
      return option.name[$locale] || option.name.en || optionKey;
    }
    return optionKey;
  }

  function getProductName(productShortname: string): string {
    const product = productsMap.get(productShortname);
    if (!product) return productShortname;
    return getLocalizedDisplayName(product, $locale);
  }

  function applyFilters() {
    filteredItems = filterItems(items, searchTerm, categoryFilter, $locale);
  }

  function filterProducts() {
    filteredProducts = filterProductsBySearch(
      products,
      productSearchTerm,
      $locale
    );
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

  function viewItem(item) {
    $goto("/sellers/[shortname]/[resource_type]", {
      subpath: item.subpath.replace(/^\//, ""),
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function editItem(item) {
    $goto("/sellers/[shortname]/[resource_type]/edit", {
      subpath: item.subpath.replace(/^\//, ""),
      shortname: item.shortname,
      resource_type: item.resource_type,
    });
  }

  function createItem() {
    if (selectedFolder === "available_products") {
      showAddItemModal = true;
      loadProducts();
    } else if (selectedFolder === "coupons") {
      openCouponModal();
    } else if (selectedFolder === "discounts") {
      openDiscountModal();
    } else if (selectedFolder === "warranties") {
      openWarrantyModal();
    } else if (selectedFolder === "shipping") {
      // Shipping is handled in the view
      return;
    } else {
      $goto("/sellers/create");
    }
  }

  async function loadCategories() {
    isLoadingCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        categories = response.records;
      } else {
        console.error("Seller - No categories found in response:", response);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Error loading categories");
    } finally {
      isLoadingCategories = false;
    }
  }

  async function loadProducts(categoryShortname?: string) {
    isLoadingProducts = true;
    selectedProduct = "";
    productVariants = [];
    selectedVariants = [];
    try {
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        if (categoryShortname) {
          products = filterProductsByCategory(
            response.records,
            categoryShortname
          );
        } else {
          products = response.records;
        }
        filteredProducts = products;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingProducts = false;
    }
  }

  async function loadSpecifications(productShortname: string) {
    isLoadingVariations = true;
    productVariants = [];
    generatedCombinations = [];
    combinationPrices = {};
    specificationGroups = [];

    try {
      const response = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        const selectedProductData = products.find(
          (p) => p.shortname === productShortname
        );
        const productContent = selectedProductData?.attributes?.payload?.body;
        const variationOptions = productContent?.variation_options || [];

        productVariants = loadProductVariations(
          response.records,
          variationOptions
        );
      }
    } catch (error) {
      console.error("Error loading variations:", error);
      errorToastMessage("Error loading variations");
    } finally {
      isLoadingVariations = false;
    }
  }

  $effect(() => {
    if (selectedCategory) {
      loadProducts(selectedCategory);
      if (showVariationRequestModal) {
        loadVariationProducts(selectedCategory);
      }
    } else {
      products = [];
      selectedProduct = "";
      productVariants = [];
      variationProducts = [];
      variationRequestForm.product = "";
    }
  });

  $effect(() => {
    if (selectedProduct) {
      loadSpecifications(selectedProduct);
    } else {
      productVariants = [];
      generatedCombinations = [];
      combinationPrices = {};
    }
  });

  function handleCategoryChange() {
    if (selectedCategory) {
      loadProducts(selectedCategory);
      if (showVariationRequestModal) {
        loadVariationProducts(selectedCategory);
      }
    } else {
      products = [];
      selectedProduct = "";
      productVariants = [];
      selectedVariants = [];
      variationProducts = [];
      variationRequestForm.product = "";
    }
  }

  function toggleVariantSelection(variantKey: string) {
    const index = selectedVariants.indexOf(variantKey);
    if (index > -1) {
      selectedVariants = selectedVariants.filter((v) => v !== variantKey);
    } else {
      selectedVariants = [...selectedVariants, variantKey];
    }
  }

  function isVariantSelected(variantKey: string): boolean {
    return selectedVariants.includes(variantKey);
  }

  function handleProductChange() {
    if (selectedProduct) {
      loadSpecifications(selectedProduct);
    } else {
      productVariants = [];
      generatedCombinations = [];
      combinationPrices = {};
      specificationGroups = [];
    }
  }

  function generateCombinationsFromSpecifications() {
    const result = generateCombinations(specificationGroups, combinationPrices);
    generatedCombinations = result.combinations;
    combinationPrices = result.prices;
  }
  function closeModal() {
    showAddItemModal = false;
    selectedCategory = "";
    selectedProduct = "";
    categories = [];
    products = [];
    productVariants = [];
    selectedVariants = [];
    generatedCombinations = [];
    combinationPrices = {};
    specificationGroups = [];
    productSearchTerm = "";
    filteredProducts = [];
  }

  async function submitProductVariations() {
    const validation = validateVariants(productVariants, selectedVariants);
    if (!validation.isValid) {
      errorToastMessage(validation.error || "Validation failed");
      return;
    }

    try {
      isLoading = true;

      const selectedProductData = products.find(
        (p) => p.shortname === selectedProduct
      );

      if (!selectedProductData) {
        errorToastMessage("Selected product not found");
        return;
      }

      const variants = prepareVariantsForSubmission(
        productVariants,
        selectedVariants
      );

      const availabilityData = {
        displayname_en: getLocalizedDisplayName(selectedProductData, $locale),
        displayname_ar: selectedProductData.attributes?.displayname?.ar || "",
        displayname_ku: selectedProductData.attributes?.displayname?.ku || "",
        body: {
          sku: "",
          variants: variants,
          product_shortname: selectedProduct,
          warranty_shortname: selectedWarranty || "",
          commission_category: selectedCommissionCategory || "",
          has_fast_delivery: availabilityForm.hasFastDelivery,
          has_free_shipping: availabilityForm.hasFreeShipping,
          est_shipping_days: {
            from: availabilityForm.estShippingFrom || 1,
            to: availabilityForm.estShippingTo || 5,
          },
        },
        tags: [`product:${selectedProduct}`],
        is_active: true,
        workflow_shortname: "availability",
      };

      await createEntity(
        availabilityData,
        website.main_space,
        `/available_products/${$user.shortname}`,
        ResourceType.ticket,
        "availability",
        ""
      );

      successToastMessage(
        `Product availability with ${variants.length} variant(s) added successfully!`
      );
      closeModal();
      await loadFolderContents("available_products");
    } catch (error) {
      console.error("Error creating product availability:", error);
      errorToastMessage("Failed to create product availability");
    } finally {
      isLoading = false;
    }
  }

  async function openCouponModal() {
    showCouponModal = true;
    couponForm = {
      code: "",
      type: "individual",
      discountType: "percentage",
      discountValue: "",
      minimumSpend: "",
      maximumAmount: "",
      maximumUses: "",
      maximumPerUser: "1",
      validFrom: "",
      validTo: "",
      brandShortnames: [],
    };
    await loadBrands();
  }

  function closeCouponModal() {
    showCouponModal = false;
    couponForm = {
      code: "",
      type: "individual",
      discountType: "percentage",
      discountValue: "",
      minimumSpend: "",
      maximumAmount: "",
      maximumUses: "",
      maximumPerUser: "1",
      validFrom: "",
      validTo: "",
      brandShortnames: [],
    };
    brands = [];
  }

  async function submitCoupon() {
    if (
      !couponForm.code ||
      !couponForm.discountValue ||
      !couponForm.validFrom ||
      !couponForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const couponData = {
        displayname_en: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
        displayname_ar: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
        displayname_ku: null,

        body: {
          code: couponForm.code.toUpperCase(),
          type: couponForm.type,
          discount_type: couponForm.discountType,
          discount_value: parseFloat(couponForm.discountValue),
          minimum_spend: couponForm.minimumSpend
            ? parseFloat(couponForm.minimumSpend)
            : 0,
          maximum_amount: couponForm.maximumAmount
            ? parseFloat(couponForm.maximumAmount)
            : null,
          maximum_uses: couponForm.maximumUses
            ? parseInt(couponForm.maximumUses)
            : null,
          maximum_per_user: parseInt(couponForm.maximumPerUser) || 1,
          usage_count: 0,
          validity: {
            from: couponForm.validFrom,
            to: couponForm.validTo,
          },
          applies_to: {
            brand_shortnames: couponForm.brandShortnames,
          },
          seller_shortname: $user.shortname,
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        couponData,
        website.main_space,
        `/coupons/${$user.shortname}`,
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Coupon created successfully!");
      closeCouponModal();
      await loadFolderContents("coupons");
    } catch (error) {
      console.error("Error creating coupon:", error);
      errorToastMessage("Failed to create coupon");
    } finally {
      isLoading = false;
    }
  }

  function openBranchModal() {
    showBranchModal = true;
    branchForm = {
      name: "",
      country: "",
      state: "",
      city: "",
      address: "",
    };
  }

  function closeBranchModal() {
    showBranchModal = false;
    branchForm = {
      name: "",
      country: "",
      state: "",
      city: "",
      address: "",
    };
  }

  async function submitBranch() {
    if (
      !branchForm.name ||
      !branchForm.country ||
      !branchForm.city ||
      !branchForm.address
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const branchData = {
        displayname: `Branch - ${branchForm.name}`,
        body: {
          content: {
            name: branchForm.name,
            country: branchForm.country,
            state: branchForm.state,
            city: branchForm.city,
            address: branchForm.address,
          },
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        branchData,
        "Ecommerce",
        "/sellers/branch",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Branch created successfully!");
      closeBranchModal();
      await loadFolderContents("branch");
    } catch (error) {
      console.error("Error creating branch:", error);
      errorToastMessage("Failed to create branch");
    } finally {
      isLoading = false;
    }
  }

  function openBundleModal() {
    showBundleModal = true;
    bundleForm = {
      selectedProducts: [],
      price: "",
    };
    bundleProductSearch = "";
    bundleCategoryFilter = "all";
    loadSellerProducts();
  }

  function closeBundleModal() {
    showBundleModal = false;
    bundleForm = {
      selectedProducts: [],
      price: "",
    };
    sellerProducts = [];
    filteredSellerProducts = [];
    bundleProductSearch = "";
    bundleCategoryFilter = "all";
    productCategories = [];
  }

  function toggleProductSelection(productShortname: string) {
    if (bundleForm.selectedProducts.includes(productShortname)) {
      bundleForm.selectedProducts = bundleForm.selectedProducts.filter(
        (p) => p !== productShortname
      );
    } else {
      bundleForm.selectedProducts = [
        ...bundleForm.selectedProducts,
        productShortname,
      ];
    }
  }

  async function loadSellerProducts() {
    isLoadingSellerProducts = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/available_products/${$user.shortname}`,
        "managed",
        1000,
        0,
        true
      );

      if (response?.records) {
        sellerProducts = response.records;

        const categoriesSet = new Set<string>();
        sellerProducts.forEach((product) => {
          const content =
            product?.payload?.body?.content || product?.payload?.body;
          if (content?.category_id) {
            categoriesSet.add(content.category_id);
          }
        });
        productCategories = Array.from(categoriesSet);

        filterBundleProducts();
      }
    } catch (error) {
      console.error("Error loading seller products:", error);
      errorToastMessage("Error loading your products");
    } finally {
      isLoadingSellerProducts = false;
    }
  }

  function filterBundleProducts() {
    let result = [...sellerProducts];

    if (bundleProductSearch.trim()) {
      const searchLower = bundleProductSearch.toLowerCase();
      result = result.filter((product) => {
        const displayname = getLocalizedDisplayName(
          product,
          $locale
        ).toLowerCase();
        const shortname = product.shortname?.toLowerCase() || "";
        const content =
          product?.payload?.body?.content || product?.payload?.body;
        const productId = content?.product_id?.toLowerCase() || "";

        return (
          displayname.includes(searchLower) ||
          shortname.includes(searchLower) ||
          productId.includes(searchLower)
        );
      });
    }

    if (bundleCategoryFilter !== "all") {
      result = result.filter((product) => {
        const content =
          product?.payload?.body?.content || product?.payload?.body;
        return content?.category_id === bundleCategoryFilter;
      });
    }

    filteredSellerProducts = result;
  }

  async function submitBundle() {
    if (bundleForm.selectedProducts.length < 2 || !bundleForm.price) {
      errorToastMessage("Please select at least 2 products and enter a price");
      return;
    }

    try {
      isLoading = true;
      const productNames = bundleForm.selectedProducts
        .map((shortname) => {
          const product = sellerProducts.find((p) => p.shortname === shortname);
          return getLocalizedDisplayName(product, $locale);
        })
        .join(" + ");

      const bundleData = {
        displayname: `Bundle - ${productNames}`,
        body: {
          content: {
            product_ids: bundleForm.selectedProducts,
            price: parseFloat(bundleForm.price),
          },
          content_type: "json",
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        bundleData,
        "Ecommerce",
        "/sellers/bundles",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Bundle created successfully!");
      closeBundleModal();
      await loadFolderContents("bundles");
    } catch (error) {
      console.error("Error creating bundle:", error);
      errorToastMessage("Failed to create bundle");
    } finally {
      isLoading = false;
    }
  }

  async function openEditModal(item) {
    itemToEdit = item;
    const payload = item.attributes?.payload;
    const body = payload?.body;
    const content = body?.content || body;

    if (item.subpath.includes("/available")) {
      editItem(item);
      return;
    } else if (
      item.subpath.includes("/coupons") ||
      item.subpath.includes("/coupons")
    ) {
      couponForm = {
        code: content.code || "",
        type: content.type || "individual",
        discountType: content.discount_type || "percentage",
        discountValue: content.discount_value?.toString() || "",
        minimumSpend: content.minimum_spend?.toString() || "",
        maximumAmount: content.maximum_amount?.toString() || "",
        maximumUses: content.maximum_uses?.toString() || "",
        maximumPerUser: content.maximum_per_user?.toString() || "1",
        validFrom: content.validity?.from || "",
        validTo: content.validity?.to || "",
        brandShortnames: content.applies_to?.brand_shortnames || [],
      };
      await loadBrands();
      showEditModal = true;
    } else if (item.subpath.includes("/discounts")) {
      discountForm = {
        type: content.type || "",
        typeShortname: content.type_shortname || "",
        value: content.value?.toString() || "",
        validFrom: content.validity?.from || "",
        validTo: content.validity?.to || "",
      };
      await Promise.all([loadBrands(), loadDiscountCategories()]);
      showEditModal = true;
    } else if (item.subpath.includes("/warranties")) {
      showEditModal = true;
    }
  }

  function closeEditModal() {
    showEditModal = false;
    itemToEdit = null;
    couponForm = {
      code: "",
      type: "individual",
      discountType: "percentage",
      discountValue: "",
      minimumSpend: "",
      maximumAmount: "",
      maximumUses: "",
      maximumPerUser: "1",
      validFrom: "",
      validTo: "",
      brandShortnames: [],
    };
    discountForm = {
      type: "",
      typeShortname: "",
      value: "",
      validFrom: "",
      validTo: "",
    };
    branchForm = { name: "", country: "", state: "", city: "", address: "" };
    bundleForm = { selectedProducts: [], price: "" };
    brands = [];
    discountCategories = [];
  }

  async function openDiscountModal() {
    showDiscountModal = true;
    discountForm = {
      type: "",
      typeShortname: "",
      value: "",
      validFrom: "",
      validTo: "",
    };
    await Promise.all([loadBrands(), loadDiscountCategories()]);
  }

  function closeDiscountModal() {
    showDiscountModal = false;
    discountForm = {
      type: "",
      typeShortname: "",
      value: "",
      validFrom: "",
      validTo: "",
    };
    brands = [];
    discountCategories = [];
  }

  async function loadDiscountCategories() {
    isLoadingDiscountCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        discountCategories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      isLoadingDiscountCategories = false;
    }
  }

  async function submitDiscount() {
    if (
      !discountForm.type ||
      !discountForm.typeShortname ||
      !discountForm.value ||
      !discountForm.validFrom ||
      !discountForm.validTo
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const discountData = {
        displayname_en: null,
        displayname_ar: null,
        displayname_ku: null,
        body: {
          type: discountForm.type,
          type_shortname: discountForm.typeShortname,
          value: parseInt(discountForm.value),
          validity: {
            from: discountForm.validFrom,
            to: discountForm.validTo,
          },
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        discountData,
        website.main_space,
        `/discounts/${$user.shortname}`,
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Discount created successfully!");
      closeDiscountModal();
      await loadFolderContents("discounts");
    } catch (error) {
      console.error("Error creating discount:", error);
      errorToastMessage("Failed to create discount");
    } finally {
      isLoading = false;
    }
  }

  async function openWarrantyModal() {
    showWarrantyModal = true;
    warrantyForm = {
      displaynameEn: "",
      displaynameAr: "",
      displaynameKu: "",
      descriptionEn: "",
      descriptionAr: "",
      descriptionKu: "",
      isGlobal: true,
      brandShortname: "",
    };
    await loadBrands();
  }

  function closeWarrantyModal() {
    showWarrantyModal = false;
    warrantyForm = {
      displaynameEn: "",
      displaynameAr: "",
      displaynameKu: "",
      descriptionEn: "",
      descriptionAr: "",
      descriptionKu: "",
      isGlobal: true,
      brandShortname: "",
    };
    brands = [];
  }

  async function loadWarrantyCategories() {
    isLoadingWarrantyCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        warrantyCategories = response.records;
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      isLoadingWarrantyCategories = false;
    }
  }

  async function submitWarranty() {
    if (!warrantyForm.displaynameEn || !warrantyForm.descriptionEn) {
      errorToastMessage("Please fill in English name and description");
      return;
    }

    if (!warrantyForm.isGlobal && !warrantyForm.brandShortname) {
      errorToastMessage("Please select a brand for non-global warranty");
      return;
    }

    try {
      isLoading = true;
      const warrantyData = {
        displayname_en: warrantyForm.displaynameEn,
        displayname_ar: warrantyForm.displaynameAr || null,
        displayname_ku: warrantyForm.displaynameKu || null,
        description_en: warrantyForm.descriptionEn,
        description_ar: warrantyForm.descriptionAr || null,
        description_ku: warrantyForm.descriptionKu || null,
        body: {
          is_global: warrantyForm.isGlobal,
          brand_shortname: warrantyForm.isGlobal
            ? ""
            : warrantyForm.brandShortname,
        },
        tags: [],
        is_active: true,
      };

      await createEntity(
        warrantyData,
        website.main_space,
        `/warranties/${$user.shortname}`,
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Warranty created successfully!");
      closeWarrantyModal();
      await loadFolderContents("warranties");
    } catch (error) {
      console.error("Error creating warranty:", error);
      errorToastMessage("Failed to create warranty");
    } finally {
      isLoading = false;
    }
  }

  function openVariationRequestModal() {
    variationRequestForm = {
      product: "",
      variations: [{ attribute_name: "", attribute_value: "" }],
      justification: "",
    };
    categories = [];
    variationProducts = [];
    loadCategories();
    showVariationRequestModal = true;
  }

  function closeVariationRequestModal() {
    showVariationRequestModal = false;
    variationRequestForm = {
      product: "",
      variations: [{ attribute_name: "", attribute_value: "" }],
      justification: "",
    };
  }

  function addVariationAttribute() {
    variationRequestForm.variations = [
      ...variationRequestForm.variations,
      { attribute_name: "", attribute_value: "" },
    ];
  }

  function removeVariationAttribute(index: number) {
    if (variationRequestForm.variations.length > 1) {
      variationRequestForm.variations = variationRequestForm.variations.filter(
        (_, i) => i !== index
      );
    }
  }

  async function loadVariationProducts(categoryShortname: string) {
    isLoadingVariationProducts = true;
    variationRequestForm.product = "";
    try {
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        variationProducts = response.records.filter((product) => {
          const content = product.attributes?.payload?.body;
          const categories = content?.categories_shortnames || [];
          return categories.includes(categoryShortname);
        });
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Error loading products");
    } finally {
      isLoadingVariationProducts = false;
    }
  }

  async function submitVariationRequest() {
    if (
      !variationRequestForm.product ||
      variationRequestForm.variations.some(
        (v) => !v.attribute_name || !v.attribute_value
      ) ||
      !variationRequestForm.justification
    ) {
      errorToastMessage("Please fill in all required fields");
      return;
    }

    try {
      isLoading = true;
      const requestData = {
        displayname: `Variation Request - ${variationRequestForm.product}`,
        body: {
          content: {
            product_id: variationRequestForm.product,
            seller_id: $user.shortname,
            requested_variations: variationRequestForm.variations,
            justification: variationRequestForm.justification,
            status: "pending",
          },
          content_type: "json",
        },
        tags: [
          `product:${variationRequestForm.product}`,
          `seller:${$user.shortname}`,
          "status:pending",
        ],
        is_active: true,
      };

      await createEntity(
        requestData,
        website.main_space,
        "/variation_requests",
        ResourceType.content,
        "",
        ""
      );

      successToastMessage("Variation request submitted successfully!");
      closeVariationRequestModal();
    } catch (error) {
      console.error("Error submitting variation request:", error);
      errorToastMessage("Failed to submit variation request");
    } finally {
      isLoading = false;
    }
  }

  function openProductCategoryRequestModal() {
    showProductCategoryRequestModal = true;
    requestType = "product";
    productRequestForm = {
      name_en: "",
      name_ar: "",
      name_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      category_shortname: "",
      brand_shortname: "",
      specifications: [{ key: "", value: "" }],
      justification: "",
    };
    categoryRequestForm = {
      name_en: "",
      name_ar: "",
      name_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      parent_category: "",
      justification: "",
    };
    loadCategories();
    loadBrands();
  }

  function closeProductCategoryRequestModal() {
    showProductCategoryRequestModal = false;
    productRequestForm = {
      name_en: "",
      name_ar: "",
      name_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      category_shortname: "",
      brand_shortname: "",
      specifications: [{ key: "", value: "" }],
      justification: "",
    };
    categoryRequestForm = {
      name_en: "",
      name_ar: "",
      name_ku: "",
      description_en: "",
      description_ar: "",
      description_ku: "",
      parent_category: "",
      justification: "",
    };
  }

  function addProductSpecification() {
    productRequestForm.specifications = [
      ...productRequestForm.specifications,
      { key: "", value: "" },
    ];
  }

  function removeProductSpecification(index: number) {
    if (productRequestForm.specifications.length > 1) {
      productRequestForm.specifications =
        productRequestForm.specifications.filter((_, i) => i !== index);
    }
  }

  async function submitProductCategoryRequest() {
    if (requestType === "product") {
      if (
        !productRequestForm.name_en ||
        !productRequestForm.description_en ||
        !productRequestForm.category_shortname ||
        !productRequestForm.brand_shortname ||
        !productRequestForm.justification
      ) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      try {
        isLoading = true;
        const requestData = {
          displayname_en: `Product Request - ${productRequestForm.name_en}`,
          displayname_ar: productRequestForm.name_ar
            ? `طلب منتج - ${productRequestForm.name_ar}`
            : null,
          displayname_ku: productRequestForm.name_ku
            ? `داواکاری بەرهەم - ${productRequestForm.name_ku}`
            : null,
          body: {
            request_type: "product",
            seller_shortname: $user.shortname,
            product_details: {
              name: {
                en: productRequestForm.name_en,
                ar: productRequestForm.name_ar || null,
                ku: productRequestForm.name_ku || null,
              },
              description: {
                en: productRequestForm.description_en,
                ar: productRequestForm.description_ar || null,
                ku: productRequestForm.description_ku || null,
              },
              category_shortname: productRequestForm.category_shortname,
              brand_shortname: productRequestForm.brand_shortname,
              specifications: productRequestForm.specifications.filter(
                (spec) => spec.key && spec.value
              ),
            },
            justification: productRequestForm.justification,
            status: "pending",
          },
          tags: [
            `seller:${$user.shortname}`,
            "type:product_request",
            "status:pending",
          ],
          is_active: true,
        };

        await createEntity(
          requestData,
          website.main_space,
          "/variation_request/products_requests",
          ResourceType.content,
          "",
          ""
        );

        successToastMessage("Product request submitted successfully!");
        closeProductCategoryRequestModal();
      } catch (error) {
        console.error("Error submitting product request:", error);
        errorToastMessage("Failed to submit product request");
      } finally {
        isLoading = false;
      }
    } else if (requestType === "category") {
      if (
        !categoryRequestForm.name_en ||
        !categoryRequestForm.description_en ||
        !categoryRequestForm.justification
      ) {
        errorToastMessage("Please fill in all required fields");
        return;
      }

      try {
        isLoading = true;
        const requestData = {
          displayname_en: `Category Request - ${categoryRequestForm.name_en}`,
          displayname_ar: categoryRequestForm.name_ar
            ? `طلب فئة - ${categoryRequestForm.name_ar}`
            : null,
          displayname_ku: categoryRequestForm.name_ku
            ? `داواکاری پۆل - ${categoryRequestForm.name_ku}`
            : null,
          body: {
            request_type: "category",
            seller_shortname: $user.shortname,
            category_details: {
              name: {
                en: categoryRequestForm.name_en,
                ar: categoryRequestForm.name_ar || null,
                ku: categoryRequestForm.name_ku || null,
              },
              description: {
                en: categoryRequestForm.description_en,
                ar: categoryRequestForm.description_ar || null,
                ku: categoryRequestForm.description_ku || null,
              },
              parent_category: categoryRequestForm.parent_category || null,
            },
            justification: categoryRequestForm.justification,
            status: "pending",
          },
          tags: [
            `seller:${$user.shortname}`,
            "type:category_request",
            "status:pending",
          ],
          is_active: true,
        };

        await createEntity(
          requestData,
          website.main_space,
          "/variation_request/categories_requests",
          ResourceType.content,
          "",
          ""
        );

        successToastMessage("Category request submitted successfully!");
        closeProductCategoryRequestModal();
      } catch (error) {
        console.error("Error submitting category request:", error);
        errorToastMessage("Failed to submit category request");
      } finally {
        isLoading = false;
      }
    }
  }

  // Shipping Management Functions

  async function loadShippingData() {
    try {
      const response = await getSpaceContents(
        website.main_space,
        `/shipping/${$user.shortname}`,
        "managed",
        100,
        0,
        true
      );

      if (response?.records && response.records.length > 0) {
        // Get the first (and only) config record
        shippingConfig = response.records[0];
      } else {
        // Initialize empty config structure for new config
        shippingConfig = {
          attributes: {
            payload: {
              body: {
                items: [],
              },
            },
          },
        };
      }
    } catch (error) {
      console.error("Error loading shipping data:", error);
    }
  }

  async function saveShippingConfig() {
    try {
      isLoading = true;

      const configData = {
        displayname_en: "Configuration",
        displayname_ar: null,
        displayname_ku: null,
        body: shippingConfig.attributes.payload.body,
        tags: [],
        is_active: true,
      };

      if (shippingConfig?.uuid) {
        // Update existing
        await updateEntity(
          shippingConfig.shortname,
          website.main_space,
          `/shipping/${$user.shortname}`,
          ResourceType.content,
          configData,
          "",
          ""
        );
      } else {
        // Create new
        await createEntity(
          configData,
          website.main_space,
          `/shipping/${$user.shortname}`,
          ResourceType.content,
          "",
          ""
        );
      }

      successToastMessage(
        $_("seller_dashboard.shipping_configured_successfully")
      );
      await loadShippingData();
    } catch (error) {
      console.error("Error saving shipping config:", error);
      errorToastMessage($_("seller_dashboard.failed_to_configure_shipping"));
    } finally {
      isLoading = false;
    }
  }

  function addShippingSetting() {
    shippingItemForm.settings = [
      ...shippingItemForm.settings,
      {
        min: "",
        max: "",
        cost: "",
        minimum_retail: "",
        note: "",
        is_active: true,
      },
    ];
  }

  function removeShippingSetting(index: number) {
    if (shippingItemForm.settings.length > 1) {
      shippingItemForm.settings = shippingItemForm.settings.filter(
        (_, i) => i !== index
      );
    }
  }

  async function submitShippingItem() {
    // Validate form
    if (shippingItemForm.settings.some((s) => !s.min || !s.max || !s.cost)) {
      errorToastMessage("Please fill in all required fields (min, max, cost)");
      return;
    }

    try {
      isLoading = true;

      const newItem = {
        ...(shippingItemForm.states.length > 0
          ? { states: shippingItemForm.states }
          : {}),
        settings: shippingItemForm.settings.map((s) => ({
          min: parseFloat(s.min),
          max: parseFloat(s.max),
          cost: parseFloat(s.cost),
          minimum_retail: s.minimum_retail ? parseFloat(s.minimum_retail) : 0,
          note: s.note || "TRANSLATION_KEY_ONLY",
          is_active: s.is_active,
        })),
      };

      if (editingShippingItemIndex !== null) {
        // Update existing item
        shippingConfig.attributes.payload.body.items[editingShippingItemIndex] =
          newItem;
      } else {
        // Add new item
        if (!shippingConfig.attributes) {
          shippingConfig.attributes = { payload: { body: { items: [] } } };
        }
        if (!shippingConfig.attributes.payload) {
          shippingConfig.attributes.payload = { body: { items: [] } };
        }
        if (!shippingConfig.attributes.payload.body) {
          shippingConfig.attributes.payload.body = { items: [] };
        }
        if (!shippingConfig.attributes.payload.body.items) {
          shippingConfig.attributes.payload.body.items = [];
        }
        shippingConfig.attributes.payload.body.items.push(newItem);
      }

      await saveShippingConfig();
      closeShippingItemModal();
    } catch (error) {
      console.error("Error saving shipping item:", error);
      errorToastMessage("Failed to save shipping item");
    } finally {
      isLoading = false;
    }
  }

  function openShippingItemModal(itemIndex = null) {
    editingShippingItemIndex = itemIndex;
    showShippingItemModal = true;

    if (itemIndex !== null) {
      // Edit existing item
      const item = shippingConfig.attributes.payload.body.items[itemIndex];
      shippingItemForm = {
        states: item.states || [],
        settings: item.settings.map((s) => ({
          min: s.min?.toString() || "",
          max: s.max?.toString() || "",
          cost: s.cost?.toString() || "",
          minimum_retail: s.minimum_retail?.toString() || "",
          note: s.note || "",
          is_active: s.is_active ?? true,
        })),
      };
    } else {
      // New item
      shippingItemForm = {
        states: [],
        settings: [
          {
            min: "",
            max: "",
            cost: "",
            minimum_retail: "",
            note: "",
            is_active: true,
          },
        ],
      };
    }
  }

  function closeShippingItemModal() {
    showShippingItemModal = false;
    editingShippingItemIndex = null;
  }

  async function deleteShippingItem(itemIndex: number) {
    try {
      isLoading = true;

      shippingConfig.attributes.payload.body.items =
        shippingConfig.attributes.payload.body.items.filter(
          (_, i) => i !== itemIndex
        );

      await saveShippingConfig();
      successToastMessage("Shipping item deleted successfully!");
    } catch (error) {
      console.error("Error deleting shipping item:", error);
      errorToastMessage("Failed to delete shipping item");
    } finally {
      isLoading = false;
    }
  }

  async function submitEdit() {
    if (!itemToEdit) return;

    try {
      isLoading = true;
      let updateData;
      let subpath = itemToEdit.subpath;

      if (subpath.includes("/coupons") || subpath.includes("/coupons")) {
        if (
          !couponForm.code ||
          !couponForm.discountValue ||
          !couponForm.validFrom ||
          !couponForm.validTo
        ) {
          errorToastMessage("Please fill in all required fields");
          return;
        }
        updateData = {
          displayname_en: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
          displayname_ar: `${couponForm.code} - ${couponForm.discountType === "percentage" ? couponForm.discountValue + "%" : "IQD" + couponForm.discountValue}`,
          displayname_ku: null,
          body: {
            code: couponForm.code.toUpperCase(),
            type: couponForm.type,
            discount_type: couponForm.discountType,
            discount_value: parseFloat(couponForm.discountValue),
            minimum_spend: couponForm.minimumSpend
              ? parseFloat(couponForm.minimumSpend)
              : 0,
            maximum_amount: couponForm.maximumAmount
              ? parseFloat(couponForm.maximumAmount)
              : null,
            maximum_uses: couponForm.maximumUses
              ? parseInt(couponForm.maximumUses)
              : null,
            maximum_per_user: parseInt(couponForm.maximumPerUser) || 1,
            usage_count: itemToEdit.attributes?.payload?.body?.usage_count || 0,
            validity: {
              from: couponForm.validFrom,
              to: couponForm.validTo,
            },
            applies_to: {
              brand_shortnames: couponForm.brandShortnames,
            },
            seller_shortname: $user.shortname,
          },
          tags: itemToEdit.attributes.tags || [],
          is_active: true,
        };
      } else if (subpath.includes("/discounts")) {
        if (
          !discountForm.type ||
          !discountForm.typeShortname ||
          !discountForm.value ||
          !discountForm.validFrom ||
          !discountForm.validTo
        ) {
          errorToastMessage("Please fill in all required fields");
          return;
        }
        updateData = {
          displayname_en: null,
          displayname_ar: null,
          displayname_ku: null,
          body: {
            type: discountForm.type,
            type_shortname: discountForm.typeShortname,
            value: parseInt(discountForm.value),
            validity: {
              from: discountForm.validFrom,
              to: discountForm.validTo,
            },
          },
          tags: itemToEdit.attributes?.tags || [],
          is_active: true,
        };
      } else if (subpath.includes("/warranties")) {
        errorToastMessage("Warranty updates coming soon");
        return;
      }

      if (!updateData) {
        errorToastMessage("Unable to update this item type");
        return;
      }

      const { updateEntity } = await import("@/lib/dmart_services");

      await updateEntity(
        itemToEdit.shortname,
        itemToEdit.space_name,
        itemToEdit.subpath,
        itemToEdit.resource_type,
        updateData,
        "",
        ""
      );

      successToastMessage("Item updated successfully!");
      closeEditModal();
      await loadFolderContents(selectedFolder);
    } catch (error) {
      console.error("Error updating item:", error);
      errorToastMessage("Failed to update item");
    } finally {
      isLoading = false;
    }
  }

  function openDeleteModal(item) {
    itemToDelete = item;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    itemToDelete = null;
  }

  async function confirmDelete() {
    if (!itemToDelete) return;

    try {
      isLoading = true;
      const { deleteEntity } = await import("@/lib/dmart_services");

      await deleteEntity(
        itemToDelete.shortname,
        website.main_space,
        itemToDelete.subpath,
        itemToDelete.resource_type
      );

      successToastMessage("Item deleted successfully!");
      closeDeleteModal();
      await loadFolderContents(selectedFolder);
    } catch (error) {
      console.error("Error deleting item:", error);
      errorToastMessage("Failed to delete item");
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    applyFilters();
  });
</script>

<div class="seller-dashboard-container">
  <div class="seller-dashboard-content">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          {#if selectedFolder}
            <button class="back-button" onclick={goBackToFolders}>
              <svg
                class="back-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span class="back-text"
                >{$_("seller_dashboard.back") || "Back"}</span
              >
            </button>
          {/if}
          <div class="header-icon-wrapper">
            <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 2.18l8 4V17c0 4.52-3.15 8.75-8 9.83-4.85-1.08-8-5.31-8-9.83V8.18l8-4z"
              />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div class="header-text">
            <h1 class="dashboard-title">
              {#if selectedFolder}
                {selectedFolder.charAt(0).toUpperCase() +
                  selectedFolder.slice(1)}
              {:else}
                {$_("seller_dashboard.title") || "Seller Dashboard"}
              {/if}
            </h1>
            <p class="dashboard-subtitle">
              {#if selectedFolder}
                {$_("seller_dashboard.folder_subtitle") ||
                  "Manage items in this folder"}
              {:else}
                {$_("seller_dashboard.subtitle") ||
                  "Select a folder to manage your items"}
              {/if}
            </p>
          </div>
        </div>
        {#if selectedFolder}
          <div class="header-actions">
            {#if selectedFolder === "available_products"}
              <button
                class="create-button tertiary-button"
                onclick={openProductCategoryRequestModal}
              >
                <svg
                  class="button-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <span>
                  {$_("seller_dashboard.request_product_category") ||
                    "Request Product/Category"}
                </span>
              </button>
              <button
                class="create-button secondary-button"
                onclick={openVariationRequestModal}
              >
                <svg
                  class="button-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>
                  {$_("seller_dashboard.request_variation") ||
                    "Request Variation"}
                </span>
              </button>
            {/if}
            <button class="create-button" onclick={createItem}>
              <svg
                class="button-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>
                {#if selectedFolder === "products"}
                  {$_("seller_dashboard.create_product") || "Create Product"}
                {:else if selectedFolder === "coupons"}
                  {$_("seller_dashboard.create_coupon") || "Create Coupon"}
                {:else if selectedFolder === "branch"}
                  {$_("seller_dashboard.create_branch") || "Create Branch"}
                {:else if selectedFolder === "bundles"}
                  {$_("seller_dashboard.add_bundle") || "Add Bundle"}
                {:else}
                  {$_("seller_dashboard.create_item") || "Create Item"}
                {/if}
              </span>
            </button>
          </div>
        {/if}
      </div>
    </div>

    {#if !selectedFolder}
      <!-- Folders View -->
      {#if isLoading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p class="loading-text">
            {$_("seller_dashboard.loading_folders") || "Loading folders..."}
          </p>
        </div>
      {:else if folders.length === 0}
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
              stroke-width="1.5"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 class="empty-title">
            {$_("seller_dashboard.no_folders") || "No folders found"}
          </h3>
          <p class="empty-description">
            {$_("seller_dashboard.no_folders_description") ||
              "Contact administrator to set up folders"}
          </p>
        </div>
      {:else}
        <div class="folders-grid">
          {#each folders as folder (folder.shortname)}
            <button
              class="folder-card"
              onclick={() => loadFolderContents(folder.shortname)}
            >
              <div class="folder-card-icon">
                <svg
                  class="folder-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                  />
                </svg>
              </div>
              <div class="folder-card-body">
                <h3 class="folder-title" class:rtl={$isRTL}>
                  {getLocalizedDisplayName(folder, $locale) || folder.shortname}
                </h3>
                <p class="folder-shortname">{folder.shortname}</p>
                {#if folder.attributes?.description?.[$locale] || folder.attributes?.description?.en}
                  <p class="folder-description" class:rtl={$isRTL}>
                    {folder.attributes.description[$locale] ||
                      folder.attributes.description.en}
                  </p>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Items View -->
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
            placeholder={$_("seller_dashboard.search_placeholder") ||
              "Search items..."}
            class="search-input"
            class:rtl={$isRTL}
          />
        </div>

        <div class="filters-group">
          <div class="filter-item">
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <select
              bind:value={categoryFilter}
              class="filter-select"
              class:rtl={$isRTL}
            >
              <option value="all"
                >{$_("seller_dashboard.all_categories") ||
                  "All Categories"}</option
              >
              {#each filterCategories as category (category.shortname)}
                <option value={category.shortname}>
                  {getLocalizedDisplayName(category, $locale)}
                </option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      {#if isLoading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p class="loading-text">
            {$_("seller_dashboard.loading") || "Loading items..."}
          </p>
        </div>
      {:else if isShippingView}
        <!-- Shipping Management View -->
        <ShippingManagement
          bind:shippingConfig
          bind:isLoading
          onOpenItemModal={openShippingItemModal}
          onDeleteItem={deleteShippingItem}
        />
      {:else if filteredItems.length === 0}
        <div class="empty-state">
          <svg
            class="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              stroke-width="1.5"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 9h6M9 15h6"
            />
          </svg>
          <h3 class="empty-title">
            {$_("seller_dashboard.no_items") || "No items found"}
          </h3>
          <p class="empty-description">
            {$_("seller_dashboard.no_items_description") ||
              "Start by creating your first item"}
          </p>
          <button class="create-button-large" onclick={createItem}>
            <svg
              class="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span
              >{$_("seller_dashboard.create_first_item") ||
                "Create Your First Item"}</span
            >
          </button>
        </div>
      {:else}
        <div class="items-stats">
          <svg
            class="stats-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p class="stats-text">
            {$_("seller_dashboard.showing") || "Showing"}
            <strong>{filteredItems.length}</strong>
            {$_("seller_dashboard.of") || "of"} <strong>{items.length}</strong>
            {$_("seller_dashboard.items") || "items"}
          </p>
        </div>

        <div class="items-table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th class="th-type">{$_("seller_dashboard.type") || "Type"}</th>
                <th class="th-name">{$_("seller_dashboard.name") || "Name"}</th>
                <th class="th-shortname"
                  >{$_("seller_dashboard.shortname") || "Shortname"}</th
                >
                <th class="th-details"
                  >{$_("seller_dashboard.details") || "Details"}</th
                >
                <th class="th-updated"
                  >{$_("seller_dashboard.updated") || "Updated"}</th
                >
                <th class="th-actions"
                  >{$_("seller_dashboard.actions") || "Actions"}</th
                >
              </tr>
            </thead>
            <tbody>
              {#each filteredItems as item (item.shortname)}
                {@const IconComponent = getResourceTypeIcon(item.resource_type)}
                <tr class="item-row">
                  <td
                    class="td-type"
                    data-label={$_("seller_dashboard.type") || "Type"}
                  >
                    <div class="type-cell">
                      <IconComponent class="type-icon-small" />
                      <span class="type-label"
                        >{getResourceTypeLabel(item.resource_type, $_)}</span
                      >
                    </div>
                  </td>
                  <td
                    class="td-name"
                    data-label={$_("seller_dashboard.name") || "Name"}
                  >
                    <div class="name-cell">
                      <span class="item-name" class:rtl={$isRTL}>
                        {#if item.resource_type === "ticket" && item.attributes?.payload?.body?.product_shortname}
                          {getProductName(
                            item.attributes.payload.body.product_shortname
                          )}
                        {:else}
                          {getLocalizedDisplayName(item, $locale)}
                        {/if}
                      </span>
                      {#if item.resource_type === "ticket" && item.attributes?.state}
                        {@const stateColors = {
                          open: {
                            bg: "#fef3c7",
                            text: "#92400e",
                            border: "#fde68a",
                          },
                          approved: {
                            bg: "#d1fae5",
                            text: "#065f46",
                            border: "#a7f3d0",
                          },
                          rejected: {
                            bg: "#fee2e2",
                            text: "#991b1b",
                            border: "#fecaca",
                          },
                        }}
                        {@const stateColor =
                          stateColors[item.attributes.state] ||
                          stateColors.open}
                        <span
                          class="status-badge"
                          style="background: {stateColor.bg}; color: {stateColor.text}; border-color: {stateColor.border};"
                        >
                          {item.attributes.state}
                        </span>
                      {:else if getItemCategory(item)}
                        {@const category = getItemCategory(item)}
                        <span
                          class="status-badge"
                          style="background: {category.color}15; color: {category.color}; border-color: {category.color}30;"
                        >
                          {category.icon}
                          {category.type}
                        </span>
                      {/if}
                    </div>
                  </td>
                  <td
                    class="td-shortname"
                    data-label={$_("seller_dashboard.shortname") || "Shortname"}
                  >
                    <code class="shortname-code">{item.shortname}</code>
                  </td>
                  <td
                    class="td-details"
                    data-label={$_("seller_dashboard.details") || "Details"}
                  >
                    {#if item.resource_type === "ticket" && item.attributes?.payload?.body}
                      {@const body = item.attributes.payload.body}
                      {@const variants = body.variants || []}
                      <div class="details-cell">
                        <div class="detail-item">
                          <strong>{variants.length}</strong>
                          variant{variants.length !== 1 ? "s" : ""}
                        </div>
                        {#if variants.length > 0}
                          <div class="variants-inline">
                            {#each variants.slice(0, 2) as variant}
                              <span class="variant-price-mini"
                                >${variant.retail_price}</span
                              >
                            {/each}
                            {#if variants.length > 2}
                              <span class="more-mini"
                                >+{variants.length - 2}</span
                              >
                            {/if}
                          </div>
                        {/if}
                        {#if body.has_fast_delivery || body.has_free_shipping}
                          <div class="shipping-inline">
                            {#if body.has_fast_delivery}
                              <span class="badge-mini fast">⚡</span>
                            {/if}
                            {#if body.has_free_shipping}
                              <span class="badge-mini free">🚚</span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {:else if getContentPreview(item)}
                      <div class="preview-text" class:rtl={$isRTL}>
                        {getContentPreview(item)}
                      </div>
                    {:else}
                      <span class="no-details">—</span>
                    {/if}
                  </td>
                  <td
                    class="td-updated"
                    data-label={$_("seller_dashboard.updated") || "Updated"}
                  >
                    <time class="updated-time"
                      >{formatDate(item.attributes.updated_at)}</time
                    >
                  </td>
                  <td
                    class="td-actions"
                    data-label={$_("seller_dashboard.actions") || "Actions"}
                  >
                    <div class="actions-cell">
                      <button
                        class="table-action-btn view"
                        onclick={() => viewItem(item)}
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
                        class="table-action-btn edit"
                        onclick={() => openEditModal(item)}
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
                        class="table-action-btn delete"
                        onclick={() => openDeleteModal(item)}
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
                            d="M19 7l-.867 12.142A2 12 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Add Item Modal -->
<AddProductModal
  bind:show={showAddItemModal}
  isRTL={$isRTL}
  bind:productSearchTerm
  {filteredProducts}
  {isLoadingProducts}
  bind:selectedProduct
  {isLoadingVariations}
  {productVariants}
  {selectedVariants}
  onClose={closeModal}
  onSubmit={submitProductVariations}
  onProductSearchChange={(value) => (productSearchTerm = value)}
  onFilterProducts={filterProducts}
  onProductChange={handleProductChange}
  onToggleVariant={toggleVariantSelection}
  {isVariantSelected}
  getLocalizedDisplayName={getItemDisplayName}
  updateVariant={(key, field, value) => {
    const variant = productVariants.find((v) => v.key === key);
    if (variant) variant[field] = value;
  }}
/>

<!-- Coupon Modal -->
<CouponModal
  bind:show={showCouponModal}
  isRTL={$isRTL}
  bind:couponForm
  {brands}
  {isLoadingBrands}
  onClose={closeCouponModal}
  onSubmit={submitCoupon}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Branch Modal -->
<BranchModal
  bind:show={showBranchModal}
  isRTL={$isRTL}
  bind:branchForm
  onClose={closeBranchModal}
  onSubmit={submitBranch}
/>

<!-- Bundle Modal -->
<BundleModal
  bind:show={showBundleModal}
  isRTL={$isRTL}
  bind:bundleForm
  bind:bundleProductSearch
  bind:bundleCategoryFilter
  {isLoadingSellerProducts}
  {sellerProducts}
  {filteredSellerProducts}
  {productCategories}
  onClose={closeBundleModal}
  onSubmit={submitBundle}
  onToggleProduct={toggleProductSelection}
  onFilterProducts={filterBundleProducts}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Variation Request Modal -->
<VariationRequestModal
  bind:show={showVariationRequestModal}
  isRTL={$isRTL}
  bind:selectedCategory
  {categories}
  {isLoadingCategories}
  {variationProducts}
  {isLoadingVariationProducts}
  bind:variationRequestForm
  onClose={closeVariationRequestModal}
  onSubmit={submitVariationRequest}
  onCategoryChange={handleCategoryChange}
  onAddAttribute={addVariationAttribute}
  onRemoveAttribute={removeVariationAttribute}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Warranty Modal -->
<WarrantyModal
  bind:show={showWarrantyModal}
  isRTL={$isRTL}
  bind:warrantyForm
  {brands}
  {isLoadingBrands}
  onClose={closeWarrantyModal}
  onSubmit={submitWarranty}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Discount Modal -->
<DiscountModal
  bind:show={showDiscountModal}
  isRTL={$isRTL}
  bind:discountForm
  {brands}
  categories={discountCategories}
  {isLoadingBrands}
  isLoadingCategories={isLoadingDiscountCategories}
  onClose={closeDiscountModal}
  onSubmit={submitDiscount}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Edit Modal -->
<EditModal
  bind:show={showEditModal}
  isRTL={$isRTL}
  {itemToEdit}
  bind:couponForm
  bind:branchForm
  bind:bundleForm
  {isLoadingSellerProducts}
  {sellerProducts}
  {brands}
  {isLoadingBrands}
  onClose={closeEditModal}
  onSubmit={submitEdit}
  onToggleProduct={toggleProductSelection}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
  show={showDeleteModal}
  item={itemToDelete}
  {isLoading}
  onClose={closeDeleteModal}
  onConfirm={confirmDelete}
/>

<!-- Product/Category Request Modal -->
<ProductCategoryRequestModal
  bind:show={showProductCategoryRequestModal}
  isRTL={$isRTL}
  bind:requestType
  {categories}
  {brands}
  {isLoadingCategories}
  {isLoadingBrands}
  bind:productRequestForm
  bind:categoryRequestForm
  onClose={closeProductCategoryRequestModal}
  onSubmit={submitProductCategoryRequest}
  onAddSpecification={addProductSpecification}
  onRemoveSpecification={removeProductSpecification}
  getLocalizedDisplayName={getItemDisplayName}
/>

<!-- Shipping Item Modal -->
{#if showShippingItemModal}
  <div
    class="modal-overlay"
    onclick={closeShippingItemModal}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Escape" && closeShippingItemModal()}
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2>
          {editingShippingItemIndex !== null
            ? $_("seller_dashboard.edit_shipping_item")
            : $_("seller_dashboard.add_shipping_item")}
        </h2>
        <button class="close-button" onclick={closeShippingItemModal}
          >&times;</button
        >
      </div>
      <div class="modal-body">
        <!-- States Selection -->
        <div class="form-group">
          <span class="form-label"
            >{$_("seller_dashboard.states_selection_label")}</span
          >
          <div class="states-grid">
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="baghdad"
                checked={shippingItemForm.states.includes("baghdad")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "baghdad",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "baghdad"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "بغداد"
                  : $locale === "ku"
                    ? "بەغدا"
                    : "Baghdad"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="basra"
                checked={shippingItemForm.states.includes("basra")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "basra",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "basra"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "البصرة"
                  : $locale === "ku"
                    ? "بەسرە"
                    : "Basra"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="nineveh"
                checked={shippingItemForm.states.includes("nineveh")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "nineveh",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "nineveh"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "نينوى"
                  : $locale === "ku"
                    ? "نەینەوا"
                    : "Nineveh"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="erbil"
                checked={shippingItemForm.states.includes("erbil")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "erbil",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "erbil"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "أربيل"
                  : $locale === "ku"
                    ? "هەولێر"
                    : "Erbil"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="sulaymaniyah"
                checked={shippingItemForm.states.includes("sulaymaniyah")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "sulaymaniyah",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "sulaymaniyah"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "السليمانية"
                  : $locale === "ku"
                    ? "سلێمانی"
                    : "Sulaymaniyah"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="dohuk"
                checked={shippingItemForm.states.includes("dohuk")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "dohuk",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "dohuk"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "دهوك"
                  : $locale === "ku"
                    ? "دهۆک"
                    : "Dohuk"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="anbar"
                checked={shippingItemForm.states.includes("anbar")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "anbar",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "anbar"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "الأنبار"
                  : $locale === "ku"
                    ? "ئەنبار"
                    : "Anbar"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="diyala"
                checked={shippingItemForm.states.includes("diyala")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "diyala",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "diyala"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "ديالى"
                  : $locale === "ku"
                    ? "دیالە"
                    : "Diyala"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="salahuddin"
                checked={shippingItemForm.states.includes("salahuddin")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "salahuddin",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "salahuddin"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "صلاح الدين"
                  : $locale === "ku"
                    ? "سەلاحەدین"
                    : "Salah al-Din"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="kirkuk"
                checked={shippingItemForm.states.includes("kirkuk")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "kirkuk",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "kirkuk"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "كركوك"
                  : $locale === "ku"
                    ? "کەرکووک"
                    : "Kirkuk"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="najaf"
                checked={shippingItemForm.states.includes("najaf")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "najaf",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "najaf"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "النجف"
                  : $locale === "ku"
                    ? "نەجەف"
                    : "Najaf"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="karbala"
                checked={shippingItemForm.states.includes("karbala")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "karbala",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "karbala"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "كربلاء"
                  : $locale === "ku"
                    ? "کەربەلا"
                    : "Karbala"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="babil"
                checked={shippingItemForm.states.includes("babil")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "babil",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "babil"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "بابل"
                  : $locale === "ku"
                    ? "بابل"
                    : "Babil"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="wasit"
                checked={shippingItemForm.states.includes("wasit")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "wasit",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "wasit"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "واسط"
                  : $locale === "ku"
                    ? "واست"
                    : "Wasit"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="maysan"
                checked={shippingItemForm.states.includes("maysan")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "maysan",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "maysan"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "ميسان"
                  : $locale === "ku"
                    ? "مەیسان"
                    : "Maysan"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="dhi_qar"
                checked={shippingItemForm.states.includes("dhi_qar")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "dhi_qar",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "dhi_qar"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "ذي قار"
                  : $locale === "ku"
                    ? "زیقار"
                    : "Dhi Qar"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="muthanna"
                checked={shippingItemForm.states.includes("muthanna")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "muthanna",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "muthanna"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "المثنى"
                  : $locale === "ku"
                    ? "موسەنا"
                    : "Al-Muthanna"}</span
              >
            </label>
            <label class="state-checkbox">
              <input
                type="checkbox"
                value="qadisiyyah"
                checked={shippingItemForm.states.includes("qadisiyyah")}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    shippingItemForm.states = [
                      ...shippingItemForm.states,
                      "qadisiyyah",
                    ];
                  } else {
                    shippingItemForm.states = shippingItemForm.states.filter(
                      (s) => s !== "qadisiyyah"
                    );
                  }
                }}
              />
              <span
                >{$locale === "ar"
                  ? "القادسية"
                  : $locale === "ku"
                    ? "قادسیە"
                    : "Al-Qadisiyyah"}</span
              >
            </label>
          </div>
        </div>

        <!-- Settings -->
        <div class="form-group">
          <span class="form-label"
            >{$_("seller_dashboard.delivery_based_settings")}</span
          >
          {#each shippingItemForm.settings as setting, index}
            <div class="setting-item-form">
              <div class="setting-row-form">
                <input
                  type="number"
                  step="1"
                  bind:value={setting.min}
                  placeholder={$_("seller_dashboard.min_days")}
                  class="form-input"
                />
                <input
                  type="number"
                  step="1"
                  bind:value={setting.max}
                  placeholder={$_("seller_dashboard.max_days")}
                  class="form-input"
                />
                <input
                  type="number"
                  bind:value={setting.cost}
                  placeholder={$_("seller_dashboard.cost")}
                  class="form-input"
                />
              </div>
              <div class="setting-row-form">
                <input
                  type="number"
                  bind:value={setting.minimum_retail}
                  placeholder={$_("seller_dashboard.minimum_retail_price")}
                  class="form-input"
                />
                <input
                  type="text"
                  bind:value={setting.note}
                  placeholder={$_("seller_dashboard.note_translation_key")}
                  class="form-input"
                />
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={setting.is_active} />
                  {$_("seller_dashboard.active")}
                </label>
                {#if shippingItemForm.settings.length > 1}
                  <button
                    type="button"
                    class="btn-remove"
                    onclick={() => removeShippingSetting(index)}
                  >
                    {$_("seller_dashboard.remove")}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
          <button type="button" class="btn-add" onclick={addShippingSetting}>
            + {$_("seller_dashboard.add_setting_range")}
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeShippingItemModal}
          >{$_("seller_dashboard.cancel")}</button
        >
        <button
          class="btn-primary"
          onclick={submitShippingItem}
          disabled={isLoading}
        >
          {isLoading
            ? $_("seller_dashboard.saving")
            : $_("seller_dashboard.save")}
        </button>
      </div>
    </div>
  </div>
{/if}

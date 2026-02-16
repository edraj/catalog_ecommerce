<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import "./index.css";

  import {
    getSpaceContents,
    createEntity,
    updateEntity,
    deleteEntity,
    attachAttachmentsToEntity,
  } from "@/lib/dmart_services";

  import { ResourceType, Dmart } from "@edraj/tsdmart";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import {
    PlusOutline,
    EditOutline,
    TrashBinOutline,
    CheckOutline,
    EyeOutline,
  } from "flowbite-svelte-icons";
  import { website } from "@/config";
  import { formatNumber } from "@/lib/helpers";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let products = $state<any[]>([]);
  let categories = $state<any[]>([]);
  let variations = $state<{ colors: any[]; storages: any[] }>({
    colors: [],
    storages: [],
  });
  let specifications = $state<any[]>([]);

  let isLoading = $state(true);
  let isLoadingCategories = $state(false);
  let isLoadingVariations = $state(false);
  let isLoadingSpecifications = $state(false);

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let activeLang = $state<"ar" | "en">("ar");
  let selectedProduct = $state<any>(null);
  let selectedCategoryFilter = $state("all");

  let totalProductsCount = $state(0);
  let expandedRows = $state<Set<string>>(new Set());

  let activeTab = $state("basic_info");
  let activeLanguageTab = $state("english");

  let searchQuery = $state("");
  let totalActiveProducts = $state(0);
  let totalInactiveProducts = $state(0);
  let lowStockCount = $state(0);

  let currentPage = $state(1);
  let itemsPerPage = $state(20);

  let productForm = $state<any>({
    displayname_en: "",
    displayname_ar: "",
    description_en: "",
    description_ar: "",
    unit: "PC",
    is_digital: false,
    meta_title: "",
    meta_description: "",
    brand_shortname: "",
    low_stock_quantity: 1,
    boost_value: 0,
    categories: [],
    main_category: "",
    variation_options: [],
    product_specifications: [],
    category_specifications: [],
    tags: [],
  });

  let colorSearchTerm = $state("");
  let storageSearchTerm = $state("");
  let showAllColors = $state(false);
  let showAllStorages = $state(false);
  const INITIAL_VARIATION_DISPLAY = 6;

  let selectedImages = $state<File[]>([]);
  let imagePreviews = $state<string[]>([]);
  let isUploadingImages = $state(false);

  onMount(async () => {
    await Promise.all([
      loadCategories(),
      loadVariations(),
      loadSpecifications(),
      loadProducts(),
    ]);
  });

  async function loadCategories() {
    isLoadingCategories = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "categories",
        "managed",
        100,
        0,
        true,
      );
      if (response?.records) categories = response.records;
      else console.error("No categories found in response:", response);
    } catch (error) {
      console.error("Error loading categories:", error);
      errorToastMessage("Failed to load categories");
    } finally {
      isLoadingCategories = false;
    }
  }

  async function loadVariations() {
    isLoadingVariations = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "variations",
        "managed",
        100,
        0,
        true,
      );
      if (response?.records) {
        const colorsData = response.records.find(
          (v: any) => v.shortname === "colors",
        );
        const storagesData = response.records.find(
          (v: any) => v.shortname === "storages",
        );
        variations = {
          colors: colorsData?.attributes?.payload?.body?.options || [],
          storages: storagesData?.attributes?.payload?.body?.options || [],
        };
      }
    } catch (error) {
      console.error("Error loading variations:", error);
      errorToastMessage("Failed to load variations");
    } finally {
      isLoadingVariations = false;
    }
  }

  async function loadSpecifications() {
    isLoadingSpecifications = true;
    try {
      const response = await getSpaceContents(
        website.main_space,
        "specifications",
        "managed",
        100,
        0,
        true,
      );
      if (response?.records) specifications = response.records;
    } catch (error) {
      console.error("Error loading specifications:", error);
      errorToastMessage("Failed to load specifications");
    } finally {
      isLoadingSpecifications = false;
    }
  }

  async function loadProducts() {
    isLoading = true;
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        itemsPerPage,
        offset,
        true,
      );
      if (response?.records) {
        products = response.records;
        totalProductsCount =
          response.attributes?.total || response.records.length;

        totalActiveProducts = products.filter(
          (p) => p.attributes?.is_active !== false,
        ).length;
        totalInactiveProducts = products.length - totalActiveProducts;

        lowStockCount = products.filter((p) => {
          const content = p.attributes?.payload?.body;
          return content?.low_stock_quantity > 0;
        }).length;
      }
    } catch (error) {
      console.error("Error loading products:", error);
      errorToastMessage("Failed to load products");
    } finally {
      isLoading = false;
    }
  }

  function openCreateModal() {
    productForm = {
      displayname_en: "",
      displayname_ar: "",
      description_en: "",
      description_ar: "",
      unit: "PC",
      is_digital: false,
      meta_title: "",
      meta_description: "",
      brand_shortname: "",
      low_stock_quantity: 1,
      boost_value: 0,
      categories: [],
      main_category: "",
      variation_options: [],
      product_specifications: [],
      category_specifications: [],
      tags: [],
    };
    colorSearchTerm = "";
    storageSearchTerm = "";
    showAllColors = false;
    showAllStorages = false;
    selectedImages = [];
    imagePreviews = [];
    activeTab = "basic_info";
    activeLanguageTab = "english";
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    selectedImages = [];
    imagePreviews = [];
  }

  function openEditModal(product: any) {
    selectedProduct = product;

    const content = product.attributes?.payload?.body;
    const displayname = product.attributes?.displayname || {};
    const description = product.attributes?.description || {};

    const categorySpecs = content?.category_specifications || [];
    const normalizedSpecs = categorySpecs.map((spec: any) => {
      if (spec.value && !spec.values) return { ...spec, values: [spec.value] };
      return spec;
    });

    productForm = {
      displayname_en: displayname.en || "",
      displayname_ar: displayname.ar || "",
      description_en: description.en || "",
      description_ar: description.ar || "",
      unit: content?.unit || "PC",
      is_digital: content?.is_digital || false,
      meta_title: content?.meta_title || "",
      meta_description: content?.meta_description || "",
      brand_shortname: content?.brand_shortname || "",
      low_stock_quantity: content?.low_stock_quantity || 1,
      boost_value: content?.boost_value || 0,
      categories: content?.categories_shortnames || [],
      main_category: content?.main_category_shortname || "",
      variation_options: content?.variation_options || [],
      product_specifications: content?.product_specifications || [],
      category_specifications: normalizedSpecs,
      tags: product.attributes?.tags || [],
    };

    selectedImages = [];
    imagePreviews = [];
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedProduct = null;
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    selectedImages = [];
    imagePreviews = [];
  }

  function openDeleteModal(product: any) {
    selectedProduct = product;
    showDeleteModal = true;
  }
  let productNameBinding = {
    get: () =>
      activeLang === "ar" ? productForm.name_ar : productForm.name_en,
    set: (v: string) => {
      if (activeLang === "ar") productForm.name_ar = v;
      else productForm.name_en = v;
    },
  };
  let descriptionBinding = {
    get: () =>
      activeLang === "ar" ? productForm.desc_ar : productForm.desc_en,
    set: (v: string) => {
      if (activeLang === "ar") productForm.desc_ar = v;
      else productForm.desc_en = v;
    },
  };
  function closeDeleteModal() {
    showDeleteModal = false;
    selectedProduct = null;
  }

  async function handleCreateProduct() {
    if (
      !productForm.displayname_en.trim() &&
      !productForm.displayname_ar.trim()
    ) {
      errorToastMessage("Please enter a product name");
      return;
    }
    if (!productForm.main_category) {
      errorToastMessage("Please select a main category");
      return;
    }
    if (productForm.categories.length === 0) {
      errorToastMessage("Please select at least one category");
      return;
    }

    try {
      const productData = {
        displayname_en: productForm.displayname_en,
        displayname_ar: productForm.displayname_ar,
        description_en: productForm.description_en,
        description_ar: productForm.description_ar,
        body: {
          unit: productForm.unit,
          is_digital: productForm.is_digital,
          meta_title: productForm.meta_title,
          meta_description: productForm.meta_description,
          brand_shortname: productForm.brand_shortname,
          low_stock_quantity: productForm.low_stock_quantity,
          boost_value: productForm.boost_value,
          variation_options: productForm.variation_options,
          categories_shortnames: productForm.categories,
          main_category_shortname: productForm.main_category,
          product_specifications: productForm.product_specifications,
          category_specifications: productForm.category_specifications,
          content_type: "json",
        },
        tags: productForm.tags,
        is_active: true,
      };

      const createdShortname = await createEntity(
        productData,
        website.main_space,
        "/products",
        ResourceType.content,
        "",
        "",
      );

      if (createdShortname && selectedImages.length > 0) {
        isUploadingImages = true;
        await uploadProductImages(createdShortname);
        isUploadingImages = false;
      }

      successToastMessage("Product created successfully!");
      closeCreateModal();
      await loadProducts();
    } catch (error) {
      console.error("Error creating product:", error);
      errorToastMessage("Failed to create product");
      isUploadingImages = false;
    }
  }

  async function handleUpdateProduct() {
    if (
      !productForm.displayname_en.trim() &&
      !productForm.displayname_ar.trim()
    ) {
      errorToastMessage("Please enter a product name");
      return;
    }
    if (!productForm.main_category) {
      errorToastMessage("Please select a main category");
      return;
    }
    if (productForm.categories.length === 0) {
      errorToastMessage("Please select at least one category");
      return;
    }
    if (!selectedProduct) return;

    try {
      const productData = {
        displayname: {
          en: productForm.displayname_en,
          ar: productForm.displayname_ar,
        },
        description: {
          en: productForm.description_en,
          ar: productForm.description_ar,
        },
        body: {
          unit: productForm.unit,
          is_digital: productForm.is_digital,
          meta_title: productForm.meta_title,
          meta_description: productForm.meta_description,
          brand_shortname: productForm.brand_shortname,
          low_stock_quantity: productForm.low_stock_quantity,
          boost_value: productForm.boost_value,
          variation_options: productForm.variation_options,
          categories_shortnames: productForm.categories,
          main_category_shortname: productForm.main_category,
          product_specifications: productForm.product_specifications,
          category_specifications: productForm.category_specifications,
        },
        content_type: "json",
        tags: productForm.tags,
        is_active: true,
      };

      await updateEntity(
        selectedProduct.shortname,
        website.main_space,
        selectedProduct.subpath,
        selectedProduct.resource_type,
        productData,
        "",
        "",
      );

      if (selectedImages.length > 0) {
        isUploadingImages = true;
        await uploadProductImages(selectedProduct.shortname);
        isUploadingImages = false;
      }

      successToastMessage("Product updated successfully!");
      closeEditModal();
      await loadProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      errorToastMessage("Failed to update product");
      isUploadingImages = false;
    }
  }

  async function handleDeleteProduct() {
    if (!selectedProduct) return;
    try {
      await deleteEntity(
        selectedProduct.shortname,
        website.main_space,
        selectedProduct.subpath,
        selectedProduct.resource_type,
      );
      successToastMessage("Product deleted successfully!");
      closeDeleteModal();
      await loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      errorToastMessage("Failed to delete product");
    }
  }

  function previewProduct(product: any) {
    // Adjust if you have a dedicated preview route/page
    window.open(`/product/${product.shortname}`, "_blank");
  }

  function getLocalizedDisplayName(item: any) {
    const displayname = item?.attributes?.displayname?.en;
    if (!displayname) return item?.shortname || "Untitled";

    // if it's already a string
    if (typeof item?.attributes?.displayname === "string")
      return item.attributes.displayname;

    const dn = item?.attributes?.displayname || {};
    const localizedName = dn[$locale] || dn.en || dn.ar || dn.ku;
    return localizedName || item?.shortname || "Untitled";
  }

  function getProductMainCategory(product: any) {
    const content = product.attributes?.payload?.body;
    return content?.main_category_shortname || null;
  }

  function getProductCategories(product: any) {
    const content = product.attributes?.payload?.body;
    return content?.categories_shortnames || [];
  }

  function getCategoryName(categoryId: string) {
    const category = categories.find((c) => c.shortname === categoryId);
    return category ? getLocalizedDisplayName(category) : categoryId;
  }

  function getCategoryParentId(category: any) {
    const content = category.attributes?.payload?.body;
    return content?.parent_category_shortname || null;
  }

  function isParentCategory(category: any) {
    return !getCategoryParentId(category);
  }

  function getSubCategories(parentId: string) {
    return categories.filter((c) => getCategoryParentId(c) === parentId);
  }

  const parentCategories = $derived.by(() =>
    categories.filter((c) => isParentCategory(c)),
  );

  function toggleCategory(categoryId: string) {
    const index = productForm.categories.indexOf(categoryId);
    if (index > -1) {
      productForm.categories = productForm.categories.filter(
        (id: string) => id !== categoryId,
      );
      if (productForm.main_category === categoryId)
        productForm.main_category = "";
    } else {
      productForm.categories = [...productForm.categories, categoryId];
      if (!productForm.main_category) productForm.main_category = categoryId;
    }
  }

  function setMainCategory(categoryId: string) {
    if (!productForm.categories.includes(categoryId)) {
      productForm.categories = [...productForm.categories, categoryId];
    }
    productForm.main_category = categoryId;
  }

  function toggleVariationValue(variationType: string, valueKey: string) {
    const existingOption = productForm.variation_options.find(
      (opt: any) => opt.variation_shortname === variationType,
    );
    if (existingOption) {
      if (existingOption.values.includes(valueKey)) {
        existingOption.values = existingOption.values.filter(
          (v: string) => v !== valueKey,
        );
        if (existingOption.values.length === 0) {
          productForm.variation_options = productForm.variation_options.filter(
            (opt: any) => opt.variation_shortname !== variationType,
          );
        }
      } else {
        existingOption.values = [...existingOption.values, valueKey];
      }
      productForm.variation_options = [...productForm.variation_options];
    } else {
      productForm.variation_options = [
        ...productForm.variation_options,
        { variation_shortname: variationType, values: [valueKey] },
      ];
    }
  }

  function isVariationSelected(
    variationType: string,
    valueKey: string,
  ): boolean {
    const option = productForm.variation_options.find(
      (opt: any) => opt.variation_shortname === variationType,
    );
    return option ? option.values.includes(valueKey) : false;
  }

  let totalPages = $derived.by(() =>
    Math.ceil(totalProductsCount / itemsPerPage),
  );

  $effect(() => {
    loadProducts();
  });

  function handleSearch() {
    currentPage = 1;
    loadProducts();
  }

  function handleCategoryFilterChange() {
    currentPage = 1;
    loadProducts();
  }

  const filteredColors = $derived.by(() => {
    if (!colorSearchTerm) return variations.colors;
    const term = colorSearchTerm.toLowerCase();
    return variations.colors.filter(
      (c: any) =>
        c.name?.en?.toLowerCase().includes(term) ||
        c.name?.ar?.toLowerCase().includes(term) ||
        c.key?.toLowerCase().includes(term),
    );
  });
  let fileInput: HTMLInputElement;

  let uploadedFile: File | null = null;

  function triggerUpload() {
    fileInput?.click();
  }

  function onUploadFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    uploadedFile = file;

    // optional: allow selecting same file again later
    input.value = "";
  }
  const filteredStorages = $derived.by(() => {
    if (!storageSearchTerm) return variations.storages;
    const term = storageSearchTerm.toLowerCase();
    return variations.storages.filter(
      (s: any) =>
        s.name?.en?.toLowerCase().includes(term) ||
        s.name?.ar?.toLowerCase().includes(term) ||
        s.key?.toLowerCase().includes(term),
    );
  });

  const displayedColors = $derived.by(() => {
    if (showAllColors || filteredColors.length <= INITIAL_VARIATION_DISPLAY)
      return filteredColors;
    return filteredColors.slice(0, INITIAL_VARIATION_DISPLAY);
  });

  const displayedStorages = $derived.by(() => {
    if (showAllStorages || filteredStorages.length <= INITIAL_VARIATION_DISPLAY)
      return filteredStorages;
    return filteredStorages.slice(0, INITIAL_VARIATION_DISPLAY);
  });

  const availableSpecifications = $derived.by(() => {
    if (productForm.categories.length === 0) return [];
    const specShortnames = new Set<string>();

    productForm.categories.forEach((categoryShortname: string) => {
      const category = categories.find(
        (c) => c.shortname === categoryShortname,
      );
      if (category) {
        const content = category.attributes?.payload?.body;
        const specs = content?.specification_shortnames || [];
        specs.forEach((spec: string) => specShortnames.add(spec));
      }
    });

    return specifications.filter((spec) => specShortnames.has(spec.shortname));
  });

  function getSpecificationOptions(spec: any): any[] {
    const content = spec?.attributes?.payload?.body?.content;
    return content?.options || [];
  }

  function getSpecificationDisplayName(spec: any): string {
    const displayname = spec?.attributes?.displayname;
    if (displayname)
      return (
        displayname.en || displayname.ar || displayname.ku || spec.shortname
      );
    return spec?.shortname || "";
  }

  function getOptionDisplayName(option: any): string {
    if (!option?.name) return option?.key || "";
    if (typeof option.name === "string") return option.name;
    return option.name.en || option.name.ar || option.name.ku || option.key;
  }

  function toggleProductSpecification(specShortname: string) {
    const index = productForm.product_specifications.findIndex(
      (ps: any) => ps.specification_shortname === specShortname,
    );
    if (index > -1) {
      productForm.product_specifications =
        productForm.product_specifications.filter(
          (ps: any) => ps.specification_shortname !== specShortname,
        );
      productForm.category_specifications =
        productForm.category_specifications.filter(
          (cs: any) => cs.specification_shortname !== specShortname,
        );
    } else {
      productForm.product_specifications = [
        ...productForm.product_specifications,
        { specification_shortname: specShortname },
      ];
    }
  }

  function isSpecificationSelected(specShortname: string): boolean {
    return productForm.product_specifications.some(
      (ps: any) => ps.specification_shortname === specShortname,
    );
  }

  function updateCategorySpecification(
    specShortname: string,
    values: string[],
  ) {
    const index = productForm.category_specifications.findIndex(
      (cs: any) => cs.specification_shortname === specShortname,
    );
    if (values.length === 0) {
      if (index > -1) {
        productForm.category_specifications =
          productForm.category_specifications.filter(
            (cs: any) => cs.specification_shortname !== specShortname,
          );
      }
    } else if (index > -1) {
      productForm.category_specifications[index].values = values;
      productForm.category_specifications = [
        ...productForm.category_specifications,
      ];
    } else {
      productForm.category_specifications = [
        ...productForm.category_specifications,
        { specification_shortname: specShortname, values },
      ];
    }
  }

  function getCategorySpecificationValues(specShortname: string): string[] {
    const spec = productForm.category_specifications.find(
      (cs: any) => cs.specification_shortname === specShortname,
    );
    if (spec?.values) return spec.values;
    if (spec?.value) return [spec.value];
    return [];
  }

  function isSpecificationValueSelected(
    specShortname: string,
    valueKey: string,
  ): boolean {
    const values = getCategorySpecificationValues(specShortname);
    return values.includes(valueKey);
  }

  function toggleSpecificationValue(specShortname: string, valueKey: string) {
    const currentValues = getCategorySpecificationValues(specShortname);
    const newValues = currentValues.includes(valueKey)
      ? currentValues.filter((v) => v !== valueKey)
      : [...currentValues, valueKey];
    updateCategorySpecification(specShortname, newValues);
  }

  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const validFiles = files.filter((file) => {
        const isImage = file.type.startsWith("image/");
        if (!isImage)
          errorToastMessage(`${file.name} is not a valid image file`);
        return isImage;
      });

      if (validFiles.length > 0) {
        selectedImages = [...selectedImages, ...validFiles];
        validFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result)
              imagePreviews = [...imagePreviews, e.target.result as string];
          };
          reader.readAsDataURL(file);
        });
      }
    }
  }

  function removeImage(index: number) {
    selectedImages = selectedImages.filter((_, i) => i !== index);
    if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
    imagePreviews = imagePreviews.filter((_, i) => i !== index);
  }

  async function uploadProductImages(productShortname: string) {
    const uploadPromises = selectedImages.map(async (file) => {
      try {
        const result = await attachAttachmentsToEntity(
          productShortname,
          website.main_space,
          "/products",
          file,
        );
        return { success: result, file: file.name };
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        return { success: false, file: file.name, error };
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      if (successCount > 0)
        successToastMessage(`${successCount} image(s) uploaded successfully`);
      if (failedCount > 0) {
        const failedFiles = results
          .filter((r) => !r.success)
          .map((r) => r.file)
          .join(", ");
        errorToastMessage(
          `${failedCount} image(s) failed to upload: ${failedFiles}`,
        );
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      errorToastMessage("Failed to upload images");
    }
  }

  function getProductThumbnail(product: any): string | null {
    const media = product.attachments?.media;
    if (!media || media.length === 0) return null;
    const thumbnail = media.find((m: any) => m.shortname === "thumbnail");
    const imageToUse = thumbnail || media[0];
    if (!imageToUse) return null;

    try {
      return Dmart.getAttachmentUrl({
        resource_type: ResourceType.media,
        space_name: website.main_space,
        subpath: product.subpath + "/",
        parent_shortname: product.shortname,
        shortname: imageToUse.attributes.payload.body,
        ext: null,
      });
    } catch (error) {
      console.error("Error getting thumbnail URL:", error);
      return null;
    }
  }

  function getProductImages(product: any): any[] {
    return product.attachments?.media || [];
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      loadProducts();
    }
  }

  function toggleExpandRow(productShortname: string) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productShortname)) newExpanded.delete(productShortname);
    else newExpanded.add(productShortname);
    expandedRows = newExpanded;
  }

  const filteredProducts = $derived.by(() => {
    let filtered = products;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) => {
        const displayname = getLocalizedDisplayName(product).toLowerCase();
        const shortname = (product.shortname || "").toLowerCase();
        return displayname.includes(query) || shortname.includes(query);
      });
    }

    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter((product) =>
        getProductCategories(product).includes(selectedCategoryFilter),
      );
    }

    return filtered;
  });

  function stripHtmlTags(html: string): string {
    if (!html) return "";
    const temp = document.createElement("div");
    temp.innerHTML = html;
    let text = temp.textContent || temp.innerText || "";
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function truncateText(text: string, max = 30) {
    if (!text) return "";
    const t = String(text).trim();
    return t.length > max ? t.slice(0, max) + "..." : t;
  }

  function getProductDetailsText(product: any) {
    const raw =
      $locale === "ar"
        ? product.attributes?.description?.ar
        : product.attributes?.description?.en;
    return (
      stripHtmlTags(raw) ||
      $_("admin_dashboard.no_description_available") ||
      "No description available"
    );
  }

  function getColorValues(product: any): string[] {
    const opts = product.attributes?.payload?.body?.variation_options || [];
    const colorVar = opts.find((v: any) => v.variation_shortname === "colors");
    return colorVar?.values || [];
  }

  function getBrandValue(product: any): string {
    return product.attributes?.payload?.body?.brand_shortname || "—";
  }

  function getDimensionsValue(product: any): string {
    const specs =
      product.attributes?.payload?.body?.category_specifications || [];
    const dimSpec = specs.find((s: any) =>
      String(s.specification_shortname || "")
        .toLowerCase()
        .includes("dimension"),
    );
    const vals = (dimSpec?.values ||
      (dimSpec?.value ? [dimSpec.value] : [])) as string[];
    return vals.length ? vals.join(", ") : "—";
  }

  function getWeightValue(product: any): string {
    const specs =
      product.attributes?.payload?.body?.category_specifications || [];
    const wSpec = specs.find((s: any) =>
      String(s.specification_shortname || "")
        .toLowerCase()
        .includes("weight"),
    );
    const vals = (wSpec?.values ||
      (wSpec?.value ? [wSpec.value] : [])) as string[];
    return vals.length ? vals.join(", ") : "—";
  }
</script>

<div class="products-page" class:rtl={$isRTL}>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.total_products") || "Total Products"}
        </h3>
        <p class="stat-value">{formatNumber(totalProductsCount, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM23.5607 13.9393C24.1464 14.5251 24.1464 15.4749 23.5607 16.0607L17.5607 22.0607C16.9749 22.6464 16.0251 22.6464 15.4393 22.0607L11.6893 18.3107C11.1036 17.7249 11.1036 16.7751 11.6893 16.1893C12.2751 15.6036 13.2249 15.6036 13.8107 16.1893L16.5 18.8787L21.4393 13.9393C22.0251 13.3536 22.9749 13.3536 23.5607 13.9393Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.active_products") || "Active Products"}
        </h3>
        <p class="stat-value">{formatNumber(totalActiveProducts, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M18 6C11.3726 6 6 11.3726 6 18C6 24.6274 11.3726 30 18 30C24.6274 30 30 24.6274 30 18C30 11.3726 24.6274 6 18 6ZM3 18C3 9.71573 9.71573 3 18 3C26.2843 3 33 9.71573 33 18C33 26.2843 26.2843 33 18 33C9.71573 33 3 26.2843 3 18ZM18 10.5C18.8284 10.5 19.5 11.1716 19.5 12V19.5C19.5 20.3284 18.8284 21 18 21C17.1716 21 16.5 20.3284 16.5 19.5V12C16.5 11.1716 17.1716 10.5 18 10.5ZM16.5 24C16.5 23.1716 17.1716 22.5 18 22.5H18.015C18.8434 22.5 19.515 23.1716 19.515 24C19.515 24.8284 18.8434 25.5 18.015 25.5H18C17.1716 25.5 16.5 24.8284 16.5 24Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.inactive_products") || "Inactive Products"}
        </h3>
        <p class="stat-value">{formatNumber(totalInactiveProducts, $locale)}</p>
      </div>
    </div>

    <div class="stat-card">
      <div class="bg-icon mx-4 rounded-lg flex items-center justify-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21Z"
            fill="#3C307F"
          />
        </svg>
      </div>
      <div class="stat-content">
        <h3 class="stat-title">
          {$_("admin_dashboard.low_stock") || "Low Stock"}
        </h3>
        <p class="stat-value">{formatNumber(lowStockCount, $locale)}</p>
      </div>
    </div>
  </div>

  <!-- Header: Search + Create + Category Filter -->
  <div
    class="flex flex-col md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
  >
    <div>
      <div class="relative w-[256px]">
        <div
          class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"
        >
          <svg
            class="w-4 h-4 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={$_("common.search") || "Search products..."}
          onkeydown={(e) => e.key === "Enter" && handleSearch()}
          class="w-full h-9 pl-9 pr-3 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] shadow-[0px_1px_0.5px_0.05px_#1D293D05] text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>

    <div class="flex items-end">
      <button
        onclick={openCreateModal}
        class="inline-flex items-center justify-center mx-2 h-9 cursor-pointer px-3 py-2 bg-[#3C307F] text-white text-sm font-medium rounded-[12px] shadow-[0px_1px_0.5px_0.05px_#1D293D05] hover:bg-[#2f2666] transition-colors duration-200"
      >
        <PlusOutline size="sm" />
        <span class="ml-2"
          >{$_("admin_dashboard.create_product") || "Create Product"}</span
        >
      </button>

      <div class="mx-2">
        <details class="relative">
          <summary
            class="list-none cursor-pointer select-none h-9 inline-flex items-center justify-between px-3 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] shadow-[0px_1px_0.5px_0.05px_#1D293D05] text-sm text-gray-700 hover:bg-gray-50"
          >
            <span class="truncate">
              {selectedCategoryFilter === "all"
                ? $_("common.all_categories") || "All Categories"
                : getLocalizedDisplayName(
                    categories.find(
                      (c) => c.shortname === selectedCategoryFilter,
                    ),
                  )}
            </span>
            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>
          <div
            class="absolute z-20 mt-2 w-[220px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
          >
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
              onclick={() => {
                selectedCategoryFilter = "all";
                handleCategoryFilterChange();
              }}
            >
              {$_("common.all_categories") || "All Categories"}
            </button>
            {#each categories as category}
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
                onclick={() => {
                  selectedCategoryFilter = category.shortname;
                  handleCategoryFilterChange();
                }}
              >
                {getLocalizedDisplayName(category)}
              </button>
            {/each}
          </div>
        </details>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{$_("common.loading") || "Loading..."}</p>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <h3>{$_("admin_dashboard.no_products") || "No products found"}</h3>
      <p>
        {selectedCategoryFilter === "all"
          ? $_("admin_dashboard.no_products_description") ||
            "Start by creating your first product"
          : $_("admin_dashboard.no_products_in_category") ||
            "No products in this category"}
      </p>
      <button class="btn-create-large" onclick={openCreateModal}>
        <PlusOutline size="md" />
        {$_("admin_dashboard.create_first_product") || "Create First Product"}
      </button>
    </div>
  {:else}
    <div class="products-table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th class="col-product">{$_("common.product") || "Product"}</th>
            <th class="col-category"
              >{$_("admin_dashboard.category") || "Category"}</th
            >
            <th class="col-tags">{$_("admin_dashboard.tags") || "Tags"}</th>
            <th class="col-status">{$_("common.status") || "Status"}</th>
          </tr>
        </thead>

        <tbody>
          {#each filteredProducts as product}
            <tr
              class="product-row product-row--clickable"
              class:expanded={expandedRows.has(product.shortname)}
              onclick={() => toggleExpandRow(product.shortname)}
              role="button"
              tabindex="0"
              onkeydown={(e) =>
                e.key === "Enter" && toggleExpandRow(product.shortname)}
            >
              <td class="col-product">
                <div class="product-cell">
                  {#if getProductThumbnail(product)}
                    <div class="product-image">
                      <img
                        src={getProductThumbnail(product)}
                        alt={getLocalizedDisplayName(product) || ""}
                        loading="lazy"
                      />
                    </div>
                  {:else}
                    <div class="product-image-placeholder">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path
                          d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                        />
                      </svg>
                    </div>
                  {/if}

                  <div class="product-info">
                    <span
                      class="product-name product-name--truncate"
                      title={getLocalizedDisplayName(product) || ""}
                      aria-label={getLocalizedDisplayName(product) || ""}
                    >
                      {truncateText(getLocalizedDisplayName(product) || "", 30)}
                    </span>
                  </div>
                </div>
              </td>

              <td class="col-category">
                {#if getProductMainCategory(product)}
                  <span class="category-text"
                    >{getCategoryName(getProductMainCategory(product))}</span
                  >
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>

              <td class="col-tags">
                {#if product.attributes?.tags && product.attributes.tags.length > 0}
                  <div class="tags-preview">
                    {#each product.attributes.tags.slice(0, 2) as tag}
                      <span class="tag-badge">{tag}</span>
                    {/each}
                    {#if product.attributes.tags.length > 2}
                      <span class="tag-more"
                        >+{product.attributes.tags.length - 2}</span
                      >
                    {/if}
                  </div>
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>

              <td class="col-status">
                <span
                  class="status-badge"
                  class:active={product.attributes?.is_active}
                  class:inactive={!product.attributes?.is_active}
                >
                  {product.attributes?.is_active
                    ? $_("common.active") || "Active"
                    : $_("common.inactive") || "Inactive"}
                </span>
              </td>
            </tr>

            {#if expandedRows.has(product.shortname)}
              <tr class="expanded-row">
                <td colspan="4">
                  <div class="expanded-content">
                    <!-- Images row (4 per row) -->
                    {#if getProductImages(product).length > 0}
                      <div class="product-images-grid">
                        {#each getProductImages(product).slice(0, 4) as image}
                          <div class="product-image-card">
                            <img
                              class="product-image-img"
                              src={Dmart.getAttachmentUrl({
                                resource_type: ResourceType.media,
                                space_name: website.main_space,
                                subpath: product.subpath + "/",
                                parent_shortname: product.shortname,
                                shortname: image.attributes.payload.body,
                                ext: null,
                              })}
                              alt="Product"
                              loading="lazy"
                            />
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <!-- Details -->
                    <div class="details-block">
                      <div class="details-title">
                        {$_("admin_dashboard.details") || "Details"}
                      </div>
                      <div class="details-text">
                        {getProductDetailsText(product)}
                      </div>
                    </div>

                    <!-- Specs (max 4 per row) -->
                    <div class="specs-grid">
                      <!-- Product state -->
                      <div class="spec-card">
                        <div class="spec-title">
                          {$_("admin_dashboard.product_state") ||
                            "Product state"}
                        </div>
                        <div class="spec-text">
                          <span class="state-pill">
                            <CheckOutline size="xs" />
                            {$_("admin_dashboard.new") || "New"}
                          </span>
                        </div>
                      </div>

                      <!-- Colors -->
                      <div class="spec-card">
                        <div class="spec-title">
                          {$_("admin_dashboard.colors_label") || "Colors"}
                        </div>
                        <div class="spec-text">
                          {#if getColorValues(product).length > 0}
                            <div class="color-circles">
                              {#each getColorValues(product).slice(0, 6) as colorKey}
                                {@const color = variations.colors.find(
                                  (c: any) => c.key === colorKey,
                                )}
                                {#if color?.value?.startsWith("#")}
                                  <div
                                    class="color-circle"
                                    style={`background:${color.value};`}
                                    title={getOptionDisplayName(color)}
                                  ></div>
                                {:else if color?.value?.startsWith("/")}
                                  <div
                                    class="color-circle"
                                    style={`background-image:url('https://api.zainmart.com/public${color.value}'); background-size:cover; background-position:center;`}
                                    title={getOptionDisplayName(color)}
                                  ></div>
                                {:else}
                                  <div
                                    class="color-circle color-circle--placeholder"
                                    title={colorKey}
                                  ></div>
                                {/if}
                              {/each}
                            </div>
                          {:else}
                            —
                          {/if}
                        </div>
                      </div>

                      <!-- Brand -->
                      <div class="spec-card">
                        <div class="spec-title">
                          {$_("admin_dashboard.brand_label") || "Brand"}
                        </div>
                        <div class="spec-text">{getBrandValue(product)}</div>
                      </div>

                      <!-- Category -->
                      <div class="spec-card">
                        <div class="spec-title">
                          {$_("admin_dashboard.category_label") || "Category"}
                        </div>
                        <div class="spec-text">
                          {#if getProductMainCategory(product)}
                            {getCategoryName(getProductMainCategory(product))}
                          {:else}
                            —
                          {/if}
                        </div>
                      </div>

                      <!-- Dimensions -->
                      <div class="spec-card">
                        <div class="spec-title">
                          {$_("admin_dashboard.dimensions_label") ||
                            "Dimensions"}
                        </div>
                        <div class="spec-text">
                          {getDimensionsValue(product)}
                        </div>
                      </div>

                      <!-- Item weight -->
                      <div class="spec-card">
                        <div class="spec-title">
                          {$_("admin_dashboard.item_weight_label") ||
                            "Item weight"}
                        </div>
                        <div class="spec-text">{getWeightValue(product)}</div>
                      </div>
                    </div>

                    <!-- Buttons -->
                    <div
                      class="expanded-buttons"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <button
                        class="btn-expanded btn-edit"
                        onclick={() => openEditModal(product)}
                      >
                        <EditOutline size="sm" />
                        {$_("common.edit") || "Edit product"}
                      </button>

                      <button
                        class="btn-expanded btn-preview"
                        onclick={() => previewProduct(product)}
                      >
                        <EyeOutline size="sm" />
                        {$_("common.preview") || "Preview"}
                      </button>

                      <button
                        class="btn-expanded btn-delete"
                        onclick={() => openDeleteModal(product)}
                      >
                        <TrashBinOutline size="sm" />
                        {$_("common.delete") || "Delete"}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <!-- Left text -->
        <div class="pagination-info">
          <span class="pagination-info__label">
            {$_("common.showing") || "Showing"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
            -
            {formatNumber(
              Math.min(currentPage * itemsPerPage, totalProductsCount),
              $locale,
            )}
          </span>

          <span class="pagination-info__label">
            {$_("common.of") || "of"}
          </span>

          <span class="pagination-info__strong">
            {formatNumber(totalProductsCount, $locale)}
          </span>
        </div>

        <!-- Right controls -->
        <div class="pagination-controls">
          <!-- Prev -->
          <button
            class="pager-arrow pager-arrow--left"
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M4.86195 8.47132C4.6016 8.21097 4.6016 7.78886 4.86195 7.52851L9.52862 2.86185C9.78897 2.6015 10.2111 2.6015 10.4714 2.86185C10.7318 3.1222 10.7318 3.54431 10.4714 3.80466L6.27616 7.99992L10.4714 12.1952C10.7318 12.4555 10.7318 12.8776 10.4714 13.138C10.2111 13.3983 9.78897 13.3983 9.52862 13.138L4.86195 8.47132Z"
                fill="#101828"
              />
            </svg>
          </button>

          <!-- Pages -->
          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-chip"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                  type="button"
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <!-- 1 -->
              <button
                class="page-chip"
                class:active={currentPage === 1}
                onclick={() => goToPage(1)}
                type="button"
              >
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-chip"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                    type="button"
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <!-- last -->
              <button
                class="page-chip"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
                type="button"
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <!-- Next -->
          <button
            class="pager-arrow pager-arrow--right"
            onclick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M11.1381 7.52868C11.3985 7.78903 11.3985 8.21114 11.1381 8.47149L6.47145 13.1382C6.2111 13.3985 5.78899 13.3985 5.52864 13.1382C5.26829 12.8778 5.26829 12.4557 5.52864 12.1953L9.7239 8.00008L5.52864 3.80482C5.26829 3.54447 5.26829 3.12236 5.52864 2.86201C5.78899 2.60166 6.2111 2.60166 6.47145 2.86201L11.1381 7.52868Z"
                fill="#101828"
              />
            </svg>
          </button>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Create/Edit Modal (UNCHANGED FROM YOUR FILE) -->
  {#if showCreateModal || showEditModal}
    <div
      class="modal-overlay"
      onclick={showCreateModal ? closeCreateModal : closeEditModal}
    >
      <div
        class="modal-container modal-large"
        onclick={(e) => e.stopPropagation()}
      >
        <!-- Header -->
        <div class="product-modal-header">
          <h2 class="product-modal-title">
            {showCreateModal
              ? $_("admin_dashboard.add_new_product") || "Add new product"
              : $_("admin_dashboard.edit_product") || "Edit Product"}
          </h2>

          <button
            class="product-modal-close"
            onclick={showCreateModal ? closeCreateModal : closeEditModal}
            aria-label="Close"
            type="button"
          >
            <!-- SPEC CLOSE SVG -->
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M15.5378 4.40935C15.864 4.73397 15.8653 5.26161 15.5407 5.58786L11.1755 9.97496L15.5907 14.4123C15.9153 14.7385 15.914 15.2662 15.5877 15.5908C15.2615 15.9154 14.7339 15.9141 14.4092 15.5878L9.99996 11.1564L5.59069 15.5878C5.26607 15.9141 4.73843 15.9154 4.41218 15.5908C4.08593 15.2662 4.08461 14.7385 4.40923 14.4123L8.82439 9.97496L4.45921 5.58786C4.13459 5.26161 4.13591 4.73398 4.46216 4.40936C4.78842 4.08474 5.31605 4.08606 5.64067 4.41231L9.99996 8.79348L14.3592 4.4123C14.6839 4.08605 15.2115 4.08473 15.5378 4.40935Z"
                fill="#3C307F"
              />
            </svg>
          </button>
        </div>

        <!-- Main Tabs -->
        <div class="product-modal-tabs">
          <button
            class="product-tab"
            class:active={activeTab === "basic_info"}
            onclick={() => (activeTab = "basic_info")}
            type="button"
          >
            {$_("admin_dashboard.basic_info") || "Basic info"}
          </button>

          <button
            class="product-tab"
            class:active={activeTab === "categories"}
            onclick={() => (activeTab = "categories")}
            type="button"
          >
            {$_("admin_dashboard.categories") || "Categories"}
          </button>

          <button
            class="product-tab"
            class:active={activeTab === "variants"}
            onclick={() => (activeTab = "variants")}
            type="button"
          >
            {$_("admin_dashboard.variants") || "Variants"}
          </button>

          <button
            class="product-tab"
            class:active={activeTab === "meta_info"}
            onclick={() => (activeTab = "meta_info")}
            type="button"
          >
            {$_("admin_dashboard.meta_info") || "Meta info"}
          </button>
        </div>

        <!-- Body -->
        <div class="product-modal-body">
          {#if activeTab === "basic_info"}
            <!-- Language Tabs -->
            <div class="lang-tabs">
              <button
                class="lang-tab"
                class:active={activeLang === "ar"}
                onclick={() => (activeLang = "ar")}
                type="button"
              >
                Arabic
              </button>
              <button
                class="lang-tab"
                class:active={activeLang === "en"}
                onclick={() => (activeLang = "en")}
                type="button"
              >
                English
              </button>
            </div>

            <!-- Fields -->
            <div class="form-grid">
              <!-- Product name -->
              <div class="field">
                <label class="field-label">
                  {$_("admin_dashboard.product_name") || "Product name"}
                </label>
                <input
                  class="text-input"
                  type="text"
                  placeholder="e.g iMac Pro"
                  bind:value={productNameBinding}
                />
              </div>

              <!-- Description -->
              <div class="field">
                <label class="field-label">
                  {$_("common.description") || "Description"}
                </label>
                <textarea
                  class="textarea-input"
                  placeholder="Write description here ..."
                  bind:value={descriptionBinding}
                />
              </div>

              <div class="divider"></div>

              <!-- Amount + Unit -->
              <div class="field">
                <label class="field-label">
                  {$_("common.amount") || "Amount"} <span class="req">*</span>
                  <span class="hint" title="Required">ⓘ</span>
                </label>

                <div class="amount-row">
                  <div class="amount-input">
                    <span class="amount-icon" aria-hidden="true">
                      <!-- SPEC LEFT ICON -->
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M3.34921 2.52205C3.41699 2.21702 3.68753 2 4 2H12C12.3125 2 12.583 2.21702 12.6508 2.52205L13.9841 8.52205C13.9947 8.56953 14 8.61803 14 8.66667V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V8.66667C2 8.61803 2.00532 8.56953 2.01588 8.52205L3.34921 2.52205ZM4.53478 3.33333L3.49774 8H4.96109C5.2201 8.00068 5.47326 8.07713 5.68936 8.21993C5.90546 8.36273 6.07506 8.56563 6.17725 8.80364C6.33082 9.15938 6.58514 9.46242 6.90886 9.67539C7.23286 9.88853 7.61218 10.0021 8 10.0021C8.38782 10.0021 8.76714 9.88853 9.09114 9.67539C9.41499 9.46233 9.66939 9.15913 9.82294 8.80319C9.92516 8.56538 10.0947 8.36264 10.3106 8.21993C10.5267 8.07713 10.7799 8.00068 11.0389 8L11.0407 8L12.5023 8L11.4652 3.33333H4.53478ZM12.6667 9.33333H11.0463C10.7896 9.92746 10.3647 10.4336 9.82393 10.7893C9.28235 11.1456 8.64827 11.3354 8 11.3354C7.35173 11.3354 6.71765 11.1456 6.17607 10.7893C5.63531 10.4336 5.21041 9.92746 4.95365 9.33333H3.33333V12.6667H12.6667V9.33333Z"
                          fill="#4A5565"
                        />
                      </svg>
                    </span>

                    <input
                      class="amount-text"
                      type="number"
                      min="0"
                      placeholder="Low Stock Quantity"
                      bind:value={productForm.amount}
                    />
                  </div>

                  <select class="unit-select" bind:value={productForm.unit}>
                    <option value="Unit">Unit</option>
                    <option value="Kg">Kg</option>
                    <option value="Box">Box</option>
                  </select>
                </div>
              </div>

              <!-- Boost value -->
              <div class="field">
                <label class="field-label">
                  {$_("admin_dashboard.boost_value") || "Boost value"}
                  <span class="req">*</span>
                  <span class="hint" title="Required">ⓘ</span>
                </label>

                <div class="boost">
                  <button
                    class="boost-btn left"
                    type="button"
                    onclick={() =>
                      (productForm.boost = Math.max(
                        0,
                        (productForm.boost ?? 0) - 1,
                      ))}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M3.33337 10.0001C3.33337 9.53984 3.70647 9.16675 4.16671 9.16675H15.8334C16.2936 9.16675 16.6667 9.53984 16.6667 10.0001C16.6667 10.4603 16.2936 10.8334 15.8334 10.8334H4.16671C3.70647 10.8334 3.33337 10.4603 3.33337 10.0001Z"
                        fill="#4A5565"
                      />
                    </svg>
                  </button>

                  <input
                    class="boost-input"
                    type="number"
                    min="0"
                    bind:value={productForm.boost}
                  />

                  <button
                    class="boost-btn right"
                    type="button"
                    onclick={() =>
                      (productForm.boost = (productForm.boost ?? 0) + 1)}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M10 3.33325C10.4603 3.33325 10.8334 3.70635 10.8334 4.16659V9.16659H15.8334C16.2936 9.16659 16.6667 9.53968 16.6667 9.99992C16.6667 10.4602 16.2936 10.8333 15.8334 10.8333H10.8334V15.8333C10.8334 16.2935 10.4603 16.6666 10 16.6666C9.5398 16.6666 9.16671 16.2935 9.16671 15.8333V10.8333H4.16671C3.70647 10.8333 3.33337 10.4602 3.33337 9.99992C3.33337 9.53968 3.70647 9.16659 4.16671 9.16659H9.16671V4.16659C9.16671 3.70635 9.5398 3.33325 10 3.33325Z"
                        fill="#4A5565"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Digital product -->
              <div class="field">
                <div class="switch-row">
                  <button
                    class="switch"
                    class:on={productForm.isDigital}
                    type="button"
                    role="switch"
                    aria-checked={productForm.isDigital}
                    onclick={() =>
                      (productForm.isDigital = !productForm.isDigital)}
                  >
                    <span class="switch-thumb"></span>
                  </button>

                  <div class="switch-text">
                    <div class="switch-title">
                      {$_("admin_dashboard.digital_product") ||
                        "Digital product"}
                    </div>
                    <div class="switch-desc">
                      {$_("admin_dashboard.digital_product_desc") ||
                        "Enable the option if the product is not a physical item."}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Upload file -->
              <div class="field">
                <label class="field-label">
                  {$_("common.upload_file") || "Upload file"}
                  <span class="req">*</span>
                </label>

                <button
                  type="button"
                  class="upload-box"
                  onclick={triggerUpload}
                >
                  <svg
                    width="124"
                    height="72"
                    viewBox="0 0 124 72"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M62 3C62.3038 3 62.5911 3.13809 62.7809 3.3753L66.7809 8.37531C67.1259 8.80657 67.056 9.43586 66.6247 9.78087C66.1934 10.1259 65.5641 10.056 65.2191 9.62469L63 6.85078L63 14C63 14.5523 62.5523 15 62 15C61.4477 15 61 14.5523 61 14L61 6.85078L58.7809 9.62469C58.4359 10.056 57.8066 10.1259 57.3753 9.78087C56.944 9.43586 56.8741 8.80657 57.2191 8.37531L61.2191 3.3753C61.4089 3.13809 61.6962 3 62 3ZM53 15C53 13.8954 53.8954 13 55 13H57C57.5523 13 58 13.4477 58 14C58 14.5523 57.5523 15 57 15H55V19H69V15H67C66.4477 15 66 14.5523 66 14C66 13.4477 66.4477 13 67 13H69C70.1046 13 71 13.8954 71 15V19C71 20.1046 70.1046 21 69 21H55C53.8954 21 53 20.1046 53 19V15ZM66 17C66 16.4477 66.4477 16 67 16H67.01C67.5623 16 68.01 16.4477 68.01 17C68.01 17.5523 67.5623 18 67.01 18H67C66.4477 18 66 17.5523 66 17Z"
                      fill="#6A7282"
                    />
                    <path
                      d="M20.0218 40.1108H18.6923C18.6412 39.8267 18.546 39.5767 18.4068 39.3608C18.2676 39.1449 18.0971 38.9616 17.8954 38.8111C17.6937 38.6605 17.4679 38.5469 17.2179 38.4702C16.9707 38.3935 16.7079 38.3551 16.4295 38.3551C15.9267 38.3551 15.4764 38.4815 15.0787 38.7344C14.6838 38.9872 14.3713 39.358 14.1412 39.8466C13.9139 40.3352 13.8002 40.9318 13.8002 41.6364C13.8002 42.3466 13.9139 42.946 14.1412 43.4347C14.3713 43.9233 14.6852 44.2926 15.0829 44.5426C15.4806 44.7926 15.9281 44.9176 16.4252 44.9176C16.7008 44.9176 16.9622 44.8807 17.2093 44.8068C17.4593 44.7301 17.6852 44.6179 17.8869 44.4702C18.0886 44.3224 18.2591 44.142 18.3983 43.929C18.5403 43.7131 18.6383 43.4659 18.6923 43.1875L20.0218 43.1918C19.9508 43.6207 19.813 44.0156 19.6085 44.3764C19.4068 44.7344 19.1468 45.044 18.8287 45.3054C18.5133 45.5639 18.1525 45.7642 17.7463 45.9062C17.34 46.0483 16.8968 46.1193 16.4167 46.1193C15.661 46.1193 14.9877 45.9403 14.3968 45.5824C13.8059 45.2216 13.34 44.706 12.9991 44.0355C12.661 43.3651 12.492 42.5653 12.492 41.6364C12.492 40.7045 12.6625 39.9048 13.0034 39.2372C13.3443 38.5668 13.8102 38.0526 14.4011 37.6946C14.992 37.3338 15.6639 37.1534 16.4167 37.1534C16.8798 37.1534 17.3116 37.2202 17.7122 37.3537C18.1156 37.4844 18.4778 37.6776 18.7988 37.9332C19.1199 38.1861 19.3855 38.4957 19.5957 38.8622C19.8059 39.2259 19.948 39.642 20.0218 40.1108ZM22.7694 37.2727V46H21.4952V37.2727H22.7694ZM24.4835 46V39.4545H25.7576V46H24.4835ZM25.127 38.4446C24.9054 38.4446 24.715 38.3707 24.5559 38.223C24.3997 38.0724 24.3216 37.8935 24.3216 37.6861C24.3216 37.4759 24.3997 37.2969 24.5559 37.1491C24.715 36.9986 24.9054 36.9233 25.127 36.9233C25.3485 36.9233 25.5375 36.9986 25.6937 37.1491C25.8528 37.2969 25.9324 37.4759 25.9324 37.6861C25.9324 37.8935 25.8528 38.0724 25.6937 38.223C25.5375 38.3707 25.3485 38.4446 25.127 38.4446ZM30.2289 46.1321C29.5953 46.1321 29.0499 45.9886 28.5925 45.7017C28.138 45.4119 27.7885 45.0128 27.5442 44.5043C27.2999 43.9957 27.1777 43.4134 27.1777 42.7571C27.1777 42.0923 27.3027 41.5057 27.5527 40.9972C27.8027 40.4858 28.155 40.0866 28.6096 39.7997C29.0641 39.5128 29.5996 39.3693 30.2161 39.3693C30.7132 39.3693 31.1564 39.4616 31.5456 39.6463C31.9348 39.8281 32.2488 40.0838 32.4874 40.4134C32.7289 40.7429 32.8723 41.1278 32.9178 41.5682H31.6777C31.6096 41.2614 31.4533 40.9972 31.209 40.7756C30.9675 40.554 30.6436 40.4432 30.2374 40.4432C29.8823 40.4432 29.5712 40.5369 29.3042 40.7244C29.04 40.9091 28.834 41.1733 28.6863 41.517C28.5385 41.858 28.4647 42.2614 28.4647 42.7273C28.4647 43.2045 28.5371 43.6165 28.682 43.9631C28.8269 44.3097 29.0314 44.5781 29.2956 44.7685C29.5627 44.9588 29.8766 45.054 30.2374 45.054C30.4789 45.054 30.6976 45.0099 30.8936 44.9219C31.0925 44.831 31.2587 44.7017 31.3922 44.5341C31.5286 44.3665 31.6238 44.1648 31.6777 43.929H32.9178C32.8723 44.3523 32.7346 44.7301 32.5044 45.0625C32.2743 45.3949 31.9661 45.6562 31.5797 45.8466C31.1962 46.0369 30.7459 46.1321 30.2289 46.1321ZM35.4522 43.7798L35.4437 42.2244H35.6653L38.2733 39.4545H39.7988L36.8244 42.608H36.6241L35.4522 43.7798ZM34.2804 46V37.2727H35.5545V46H34.2804ZM38.4139 46L36.0701 42.8892L36.948 41.9986L39.9778 46H38.4139ZM47.1912 39.4545V40.4773H43.6159V39.4545H47.1912ZM44.5748 37.8864H45.8489V44.0781C45.8489 44.3253 45.8858 44.5114 45.9597 44.6364C46.0336 44.7585 46.1287 44.8423 46.2452 44.8878C46.3645 44.9304 46.4938 44.9517 46.633 44.9517C46.7353 44.9517 46.8248 44.9446 46.9015 44.9304C46.9782 44.9162 47.0378 44.9048 47.0804 44.8963L47.3105 45.9489C47.2367 45.9773 47.1316 46.0057 46.9952 46.0341C46.8588 46.0653 46.6884 46.0824 46.4838 46.0852C46.1486 46.0909 45.8361 46.0312 45.5463 45.9062C45.2566 45.7812 45.0222 45.5881 44.8432 45.3267C44.6642 45.0653 44.5748 44.7372 44.5748 44.3423V37.8864ZM51.2875 46.1321C50.6738 46.1321 50.1383 45.9915 49.6809 45.7102C49.2235 45.429 48.8684 45.0355 48.6156 44.5298C48.3627 44.0241 48.2363 43.4332 48.2363 42.7571C48.2363 42.0781 48.3627 41.4844 48.6156 40.9759C48.8684 40.4673 49.2235 40.0724 49.6809 39.7912C50.1383 39.5099 50.6738 39.3693 51.2875 39.3693C51.9011 39.3693 52.4366 39.5099 52.894 39.7912C53.3514 40.0724 53.7065 40.4673 53.9593 40.9759C54.2122 41.4844 54.3386 42.0781 54.3386 42.7571C54.3386 43.4332 54.2122 44.0241 53.9593 44.5298C53.7065 45.0355 53.3514 45.429 52.894 45.7102C52.4366 45.9915 51.9011 46.1321 51.2875 46.1321ZM51.2917 45.0625C51.6895 45.0625 52.019 44.9574 52.2804 44.7472C52.5417 44.5369 52.7349 44.2571 52.8599 43.9077C52.9877 43.5582 53.0517 43.1733 53.0517 42.7528C53.0517 42.3352 52.9877 41.9517 52.8599 41.6023C52.7349 41.25 52.5417 40.9673 52.2804 40.7543C52.019 40.5412 51.6895 40.4347 51.2917 40.4347C50.8912 40.4347 50.5588 40.5412 50.2946 40.7543C50.0332 40.9673 49.8386 41.25 49.7108 41.6023C49.5858 41.9517 49.5233 42.3352 49.5233 42.7528C49.5233 43.1733 49.5858 43.5582 49.7108 43.9077C49.8386 44.2571 50.0332 44.5369 50.2946 44.7472C50.5588 44.9574 50.8912 45.0625 51.2917 45.0625ZM63.0829 43.2855V39.4545H64.3613V46H63.1085V44.8665H63.0403C62.8897 45.2159 62.6483 45.5071 62.3159 45.7401C61.9863 45.9702 61.5758 46.0852 61.0843 46.0852C60.6639 46.0852 60.2917 45.9929 59.9679 45.8082C59.6468 45.6207 59.394 45.3438 59.2093 44.9773C59.0275 44.6108 58.9366 44.1577 58.9366 43.6179V39.4545H60.2108V43.4645C60.2108 43.9105 60.3343 44.2656 60.5815 44.5298C60.8287 44.794 61.1497 44.9261 61.5446 44.9261C61.7832 44.9261 62.0204 44.8665 62.2562 44.7472C62.4949 44.6278 62.6923 44.4474 62.8485 44.206C63.0076 43.9645 63.0858 43.6577 63.0829 43.2855ZM66.0733 48.4545V39.4545H67.3176V40.5156H67.4242C67.498 40.3793 67.6046 40.2216 67.7438 40.0426C67.883 39.8636 68.0762 39.7074 68.3233 39.5739C68.5705 39.4375 68.8972 39.3693 69.3034 39.3693C69.8319 39.3693 70.3034 39.5028 70.7182 39.7699C71.133 40.0369 71.4583 40.4219 71.6941 40.9247C71.9327 41.4276 72.052 42.0327 72.052 42.7401C72.052 43.4474 71.9341 44.054 71.6983 44.5597C71.4625 45.0625 71.1387 45.4503 70.7267 45.723C70.3148 45.9929 69.8446 46.1278 69.3162 46.1278C68.9185 46.1278 68.5932 46.0611 68.3404 45.9276C68.0904 45.794 67.8944 45.6378 67.7523 45.4588C67.6103 45.2798 67.5009 45.1207 67.4242 44.9815H67.3475V48.4545H66.0733ZM67.3219 42.7273C67.3219 43.1875 67.3887 43.5909 67.5222 43.9375C67.6557 44.2841 67.8489 44.5554 68.1017 44.7514C68.3546 44.9446 68.6642 45.0412 69.0307 45.0412C69.4114 45.0412 69.7296 44.9403 69.9853 44.7386C70.2409 44.5341 70.4341 44.2571 70.5648 43.9077C70.6983 43.5582 70.7651 43.1648 70.7651 42.7273C70.7651 42.2955 70.6998 41.9077 70.5691 41.5639C70.4412 41.2202 70.248 40.9489 69.9895 40.75C69.7338 40.5511 69.4142 40.4517 69.0307 40.4517C68.6614 40.4517 68.3489 40.5469 68.0932 40.7372C67.8404 40.9276 67.6486 41.1932 67.5179 41.5341C67.3873 41.875 67.3219 42.2727 67.3219 42.7273ZM74.7537 37.2727V46H73.4796V37.2727H74.7537ZM79.225 46.1321C78.6113 46.1321 78.0758 45.9915 77.6184 45.7102C77.161 45.429 76.8059 45.0355 76.5531 44.5298C76.3002 44.0241 76.1738 43.4332 76.1738 42.7571C76.1738 42.0781 76.3002 41.4844 76.5531 40.9759C76.8059 40.4673 77.161 40.0724 77.6184 39.7912C78.0758 39.5099 78.6113 39.3693 79.225 39.3693C79.8386 39.3693 80.3741 39.5099 80.8315 39.7912C81.2889 40.0724 81.644 40.4673 81.8968 40.9759C82.1497 41.4844 82.2761 42.0781 82.2761 42.7571C82.2761 43.4332 82.1497 44.0241 81.8968 44.5298C81.644 45.0355 81.2889 45.429 80.8315 45.7102C80.3741 45.9915 79.8386 46.1321 79.225 46.1321ZM79.2292 45.0625C79.627 45.0625 79.9565 44.9574 80.2179 44.7472C80.4792 44.5369 80.6724 44.2571 80.7974 43.9077C80.9252 43.5582 80.9892 43.1733 80.9892 42.7528C80.9892 42.3352 80.9252 41.9517 80.7974 41.6023C80.6724 41.25 80.4792 40.9673 80.2179 40.7543C79.9565 40.5412 79.627 40.4347 79.2292 40.4347C78.8287 40.4347 78.4963 40.5412 78.2321 40.7543C77.9707 40.9673 77.7761 41.25 77.6483 41.6023C77.5233 41.9517 77.4608 42.3352 77.4608 42.7528C77.4608 43.1733 77.5233 43.5582 77.6483 43.9077C77.7761 44.2571 77.9707 44.5369 78.2321 44.7472C78.4963 44.9574 78.8287 45.0625 79.2292 45.0625ZM85.6032 46.1449C85.1884 46.1449 84.8134 46.0682 84.4782 45.9148C84.1429 45.7585 83.8773 45.5327 83.6813 45.2372C83.4881 44.9418 83.3915 44.5795 83.3915 44.1506C83.3915 43.7812 83.4625 43.4773 83.6046 43.2386C83.7466 43 83.9384 42.8111 84.1799 42.6719C84.4213 42.5327 84.6912 42.4276 84.9895 42.3565C85.2878 42.2855 85.5918 42.2315 85.9015 42.1946C86.2935 42.1491 86.6117 42.1122 86.856 42.0838C87.1003 42.0526 87.2779 42.0028 87.3887 41.9347C87.4995 41.8665 87.5549 41.7557 87.5549 41.6023V41.5724C87.5549 41.2003 87.4498 40.9119 87.2395 40.7074C87.0321 40.5028 86.7225 40.4006 86.3105 40.4006C85.8816 40.4006 85.5435 40.4957 85.2963 40.6861C85.052 40.8736 84.883 41.0824 84.7892 41.3125L83.5918 41.0398C83.7338 40.642 83.9412 40.321 84.214 40.0767C84.4895 39.8295 84.8063 39.6506 85.1642 39.5398C85.5222 39.4261 85.8986 39.3693 86.2935 39.3693C86.5549 39.3693 86.8319 39.4006 87.1245 39.4631C87.4199 39.5227 87.6955 39.6335 87.9512 39.7955C88.2097 39.9574 88.4213 40.1889 88.5861 40.4901C88.7509 40.7884 88.8333 41.1761 88.8333 41.6534V46H87.589V45.1051H87.5378C87.4554 45.2699 87.3319 45.4318 87.1671 45.5909C87.0023 45.75 86.7907 45.8821 86.5321 45.9872C86.2736 46.0923 85.964 46.1449 85.6032 46.1449ZM85.8801 45.1222C86.2324 45.1222 86.5336 45.0526 86.7836 44.9134C87.0364 44.7741 87.2282 44.5923 87.3588 44.3679C87.4924 44.1406 87.5591 43.8977 87.5591 43.6392V42.7955C87.5137 42.8409 87.4256 42.8835 87.2949 42.9233C87.1671 42.9602 87.0208 42.9929 86.856 43.0213C86.6912 43.0469 86.5307 43.071 86.3745 43.0938C86.2182 43.1136 86.0875 43.1307 85.9824 43.1449C85.7353 43.1761 85.5094 43.2287 85.3049 43.3026C85.1032 43.3764 84.9412 43.483 84.8191 43.6222C84.6998 43.7585 84.6401 43.9403 84.6401 44.1676C84.6401 44.483 84.7566 44.7216 84.9895 44.8835C85.2225 45.0426 85.5194 45.1222 85.8801 45.1222ZM92.9806 46.1278C92.4522 46.1278 91.9806 45.9929 91.5659 45.723C91.1539 45.4503 90.8301 45.0625 90.5943 44.5597C90.3613 44.054 90.2449 43.4474 90.2449 42.7401C90.2449 42.0327 90.3627 41.4276 90.5985 40.9247C90.8372 40.4219 91.1639 40.0369 91.5787 39.7699C91.9934 39.5028 92.4636 39.3693 92.9892 39.3693C93.3954 39.3693 93.7221 39.4375 93.9693 39.5739C94.2193 39.7074 94.4125 39.8636 94.5488 40.0426C94.688 40.2216 94.796 40.3793 94.8727 40.5156H94.9494V37.2727H96.2235V46H94.9792V44.9815H94.8727C94.796 45.1207 94.6852 45.2798 94.5403 45.4588C94.3983 45.6378 94.2022 45.794 93.9522 45.9276C93.7022 46.0611 93.3784 46.1278 92.9806 46.1278ZM93.2619 45.0412C93.6284 45.0412 93.938 44.9446 94.1909 44.7514C94.4466 44.5554 94.6397 44.2841 94.7704 43.9375C94.9039 43.5909 94.9707 43.1875 94.9707 42.7273C94.9707 42.2727 94.9054 41.875 94.7747 41.5341C94.644 41.1932 94.4522 40.9276 94.1994 40.7372C93.9466 40.5469 93.6341 40.4517 93.2619 40.4517C92.8784 40.4517 92.5588 40.5511 92.3031 40.75C92.0474 40.9489 91.8542 41.2202 91.7235 41.5639C91.5957 41.9077 91.5318 42.2955 91.5318 42.7273C91.5318 43.1648 91.5971 43.5582 91.7278 43.9077C91.8585 44.2571 92.0517 44.5341 92.3074 44.7386C92.5659 44.9403 92.8841 45.0412 93.2619 45.0412ZM104.14 46.1364C103.549 46.1364 103.031 45.9957 102.585 45.7145C102.142 45.4332 101.795 45.0398 101.545 44.5341C101.298 44.0284 101.174 43.4375 101.174 42.7614C101.174 42.0795 101.298 41.4844 101.545 40.9759C101.795 40.4673 102.142 40.0724 102.585 39.7912C103.031 39.5099 103.549 39.3693 104.14 39.3693C104.731 39.3693 105.248 39.5099 105.691 39.7912C106.137 40.0724 106.484 40.4673 106.731 40.9759C106.981 41.4844 107.106 42.0795 107.106 42.7614C107.106 43.4375 106.981 44.0284 106.731 44.5341C106.484 45.0398 106.137 45.4332 105.691 45.7145C105.248 45.9957 104.731 46.1364 104.14 46.1364ZM104.14 45.233C104.589 45.233 104.958 45.1179 105.248 44.8878C105.538 44.6577 105.752 44.3551 105.892 43.9801C106.031 43.6051 106.1 43.1989 106.1 42.7614C106.1 42.3239 106.031 41.9162 105.892 41.5384C105.752 41.1605 105.538 40.8551 105.248 40.6222C104.958 40.3892 104.589 40.2727 104.14 40.2727C103.691 40.2727 103.322 40.3892 103.032 40.6222C102.742 40.8551 102.528 41.1605 102.389 41.5384C102.249 41.9162 102.18 42.3239 102.18 42.7614C102.18 43.1989 102.249 43.6051 102.389 43.9801C102.528 44.3551 102.742 44.6577 103.032 44.8878C103.322 45.1179 103.691 45.233 104.14 45.233ZM108.641 46V39.4545H109.613V40.4432H109.681C109.8 40.1193 110.016 39.8565 110.329 39.6548C110.641 39.4531 110.993 39.3523 111.385 39.3523C111.459 39.3523 111.552 39.3537 111.662 39.3565C111.773 39.3594 111.857 39.3636 111.914 39.3693V40.392C111.88 40.3835 111.802 40.3707 111.68 40.3537C111.56 40.3338 111.434 40.3239 111.3 40.3239C110.982 40.3239 110.698 40.3906 110.448 40.5241C110.201 40.6548 110.005 40.8366 109.86 41.0696C109.718 41.2997 109.647 41.5625 109.647 41.858V46H108.641ZM25.3081 66.1364C24.7626 66.1364 24.2811 65.9986 23.8635 65.723C23.4458 65.4446 23.1191 65.0526 22.8833 64.5469C22.6475 64.0384 22.5297 63.4375 22.5297 62.7443C22.5297 62.0568 22.6475 61.4602 22.8833 60.9545C23.1191 60.4489 23.4473 60.0582 23.8677 59.7827C24.2882 59.5071 24.774 59.3693 25.3251 59.3693C25.7512 59.3693 26.0879 59.4403 26.335 59.5824C26.585 59.7216 26.7754 59.8807 26.9061 60.0597C27.0396 60.2358 27.1433 60.3807 27.2172 60.4943H27.3024V57.2727H28.3081V66H27.3365V64.9943H27.2172C27.1433 65.1136 27.0382 65.2642 26.9018 65.446C26.7654 65.625 26.5708 65.7855 26.318 65.9276C26.0652 66.0668 25.7285 66.1364 25.3081 66.1364ZM25.4444 65.233C25.8478 65.233 26.1887 65.1278 26.4672 64.9176C26.7456 64.7045 26.9572 64.4105 27.1021 64.0355C27.247 63.6577 27.3194 63.2216 27.3194 62.7273C27.3194 62.2386 27.2484 61.8111 27.1064 61.4446C26.9643 61.0753 26.7541 60.7884 26.4757 60.5838C26.1973 60.3764 25.8535 60.2727 25.4444 60.2727C25.0183 60.2727 24.6632 60.3821 24.3791 60.6009C24.0978 60.8168 23.8862 61.1108 23.7441 61.483C23.6049 61.8523 23.5353 62.267 23.5353 62.7273C23.5353 63.1932 23.6064 63.6165 23.7484 63.9972C23.8933 64.375 24.1064 64.6761 24.3876 64.9006C24.6717 65.1222 25.024 65.233 25.4444 65.233ZM30.2896 66V59.4545H31.2612V60.4432H31.3294C31.4487 60.1193 31.6646 59.8565 31.9771 59.6548C32.2896 59.4531 32.6419 59.3523 33.0339 59.3523C33.1078 59.3523 33.2001 59.3537 33.3109 59.3565C33.4217 59.3594 33.5055 59.3636 33.5623 59.3693V60.392C33.5282 60.3835 33.4501 60.3707 33.3279 60.3537C33.2086 60.3338 33.0822 60.3239 32.9487 60.3239C32.6305 60.3239 32.3464 60.3906 32.0964 60.5241C31.8493 60.6548 31.6532 60.8366 31.5083 61.0696C31.3663 61.2997 31.2953 61.5625 31.2953 61.858V66H30.2896ZM36.6806 66.1534C36.2658 66.1534 35.8894 66.0753 35.5513 65.919C35.2132 65.7599 34.9448 65.5312 34.7459 65.233C34.5471 64.9318 34.4476 64.5682 34.4476 64.142C34.4476 63.767 34.5215 63.4631 34.6692 63.2301C34.8169 62.9943 35.0144 62.8097 35.2615 62.6761C35.5087 62.5426 35.7814 62.4432 36.0797 62.3778C36.3809 62.3097 36.6834 62.2557 36.9874 62.2159C37.3851 62.1648 37.7076 62.1264 37.9547 62.1009C38.2047 62.0724 38.3865 62.0256 38.5002 61.9602C38.6167 61.8949 38.6749 61.7812 38.6749 61.6193V61.5852C38.6749 61.1648 38.5598 60.8381 38.3297 60.6051C38.1025 60.3722 37.7573 60.2557 37.2942 60.2557C36.8141 60.2557 36.4377 60.3608 36.165 60.571C35.8922 60.7812 35.7005 61.0057 35.5897 61.2443L34.6351 60.9034C34.8056 60.5057 35.0328 60.196 35.3169 59.9744C35.6039 59.75 35.9164 59.5937 36.2544 59.5057C36.5953 59.4148 36.9306 59.3693 37.2601 59.3693C37.4703 59.3693 37.7118 59.3949 37.9846 59.446C38.2601 59.4943 38.5257 59.5952 38.7814 59.7486C39.04 59.902 39.2544 60.1335 39.4249 60.4432C39.5953 60.7528 39.6806 61.1676 39.6806 61.6875V66H38.6749V65.1136H38.6238C38.5556 65.2557 38.4419 65.4077 38.2828 65.5696C38.1238 65.7315 37.9121 65.8693 37.6479 65.983C37.3837 66.0966 37.0613 66.1534 36.6806 66.1534ZM36.834 65.25C37.2317 65.25 37.5669 65.1719 37.8397 65.0156C38.1152 64.8594 38.3226 64.6577 38.4618 64.4105C38.6039 64.1634 38.6749 63.9034 38.6749 63.6307V62.7102C38.6323 62.7614 38.5385 62.8082 38.3936 62.8509C38.2516 62.8906 38.0868 62.9261 37.8993 62.9574C37.7147 62.9858 37.5343 63.0114 37.3581 63.0341C37.1848 63.054 37.0442 63.071 36.9363 63.0852C36.6749 63.1193 36.4306 63.1747 36.2033 63.2514C35.9789 63.3253 35.7971 63.4375 35.6578 63.5881C35.5215 63.7358 35.4533 63.9375 35.4533 64.1932C35.4533 64.5426 35.5826 64.8068 35.8411 64.9858C36.1025 65.1619 36.4334 65.25 36.834 65.25ZM44.1582 68.5909C43.6724 68.5909 43.2548 68.5284 42.9054 68.4034C42.5559 68.2812 42.2647 68.1193 42.0318 67.9176C41.8017 67.7188 41.6184 67.5057 41.4821 67.2784L42.2832 66.7159C42.3741 66.8352 42.4892 66.9716 42.6284 67.125C42.7676 67.2812 42.9579 67.4162 43.1994 67.5298C43.4437 67.6463 43.7633 67.7045 44.1582 67.7045C44.6866 67.7045 45.1227 67.5767 45.4664 67.321C45.8102 67.0653 45.9821 66.6648 45.9821 66.1193V64.7898H45.8968C45.823 64.9091 45.7179 65.0568 45.5815 65.233C45.448 65.4062 45.2548 65.5611 45.002 65.6974C44.752 65.831 44.4139 65.8977 43.9877 65.8977C43.4593 65.8977 42.9849 65.7727 42.5645 65.5227C42.1468 65.2727 41.8159 64.9091 41.5716 64.4318C41.3301 63.9545 41.2093 63.375 41.2093 62.6932C41.2093 62.0227 41.3272 61.4389 41.563 60.9418C41.7988 60.4418 42.127 60.0554 42.5474 59.7827C42.9679 59.5071 43.4537 59.3693 44.0048 59.3693C44.4309 59.3693 44.769 59.4403 45.019 59.5824C45.2718 59.7216 45.465 59.8807 45.5985 60.0597C45.7349 60.2358 45.84 60.3807 45.9139 60.4943H46.0162V59.4545H46.9877V66.1875C46.9877 66.75 46.8599 67.2074 46.6042 67.5597C46.3514 67.9148 46.0105 68.1747 45.5815 68.3395C45.1554 68.5071 44.6809 68.5909 44.1582 68.5909ZM44.1241 64.9943C44.5275 64.9943 44.8684 64.902 45.1468 64.7173C45.4252 64.5327 45.6369 64.267 45.7818 63.9205C45.9267 63.5739 45.9991 63.1591 45.9991 62.6761C45.9991 62.2045 45.9281 61.7884 45.786 61.4276C45.644 61.0668 45.4338 60.7841 45.1554 60.5795C44.877 60.375 44.5332 60.2727 44.1241 60.2727C43.698 60.2727 43.3429 60.3807 43.0588 60.5966C42.7775 60.8125 42.5659 61.1023 42.4238 61.4659C42.2846 61.8295 42.215 62.233 42.215 62.6761C42.215 63.1307 42.286 63.5327 42.4281 63.8821C42.573 64.2287 42.786 64.5014 43.0673 64.7003C43.3514 64.8963 43.7037 64.9943 44.1241 64.9943ZM54.1298 66.1534C53.715 66.1534 53.3386 66.0753 53.0005 65.919C52.6625 65.7599 52.394 65.5312 52.1951 65.233C51.9963 64.9318 51.8968 64.5682 51.8968 64.142C51.8968 63.767 51.9707 63.4631 52.1184 63.2301C52.2662 62.9943 52.4636 62.8097 52.7108 62.6761C52.9579 62.5426 53.2306 62.4432 53.5289 62.3778C53.8301 62.3097 54.1326 62.2557 54.4366 62.2159C54.8343 62.1648 55.1568 62.1264 55.4039 62.1009C55.6539 62.0724 55.8358 62.0256 55.9494 61.9602C56.0659 61.8949 56.1241 61.7812 56.1241 61.6193V61.5852C56.1241 61.1648 56.0091 60.8381 55.7789 60.6051C55.5517 60.3722 55.2065 60.2557 54.7434 60.2557C54.2633 60.2557 53.8869 60.3608 53.6142 60.571C53.3414 60.7812 53.1497 61.0057 53.0389 61.2443L52.0843 60.9034C52.2548 60.5057 52.4821 60.196 52.7662 59.9744C53.0531 59.75 53.3656 59.5937 53.7037 59.5057C54.0446 59.4148 54.3798 59.3693 54.7093 59.3693C54.9196 59.3693 55.161 59.3949 55.4338 59.446C55.7093 59.4943 55.975 59.5952 56.2306 59.7486C56.4892 59.902 56.7037 60.1335 56.8741 60.4432C57.0446 60.7528 57.1298 61.1676 57.1298 61.6875V66H56.1241V65.1136H56.073C56.0048 65.2557 55.8912 65.4077 55.7321 65.5696C55.573 65.7315 55.3613 65.8693 55.0971 65.983C54.8329 66.0966 54.5105 66.1534 54.1298 66.1534ZM54.2832 65.25C54.6809 65.25 55.0162 65.1719 55.2889 65.0156C55.5645 64.8594 55.7718 64.6577 55.911 64.4105C56.0531 64.1634 56.1241 63.9034 56.1241 63.6307V62.7102C56.0815 62.7614 55.9877 62.8082 55.8429 62.8509C55.7008 62.8906 55.536 62.9261 55.3485 62.9574C55.1639 62.9858 54.9835 63.0114 54.8074 63.0341C54.6341 63.054 54.4934 63.071 54.3855 63.0852C54.1241 63.1193 53.8798 63.1747 53.6525 63.2514C53.4281 63.3253 53.2463 63.4375 53.1071 63.5881C52.9707 63.7358 52.9025 63.9375 52.9025 64.1932C52.9025 64.5426 53.0318 64.8068 53.2903 64.9858C53.5517 65.1619 53.8826 65.25 54.2832 65.25ZM59.9711 62.0625V66H58.9654V59.4545H59.937V60.4773H60.0222C60.1756 60.1449 60.4086 59.8778 60.7211 59.6761C61.0336 59.4716 61.437 59.3693 61.9313 59.3693C62.3745 59.3693 62.7623 59.4602 63.0946 59.642C63.427 59.821 63.6855 60.0938 63.8702 60.4602C64.0549 60.8239 64.1472 61.2841 64.1472 61.8409V66H63.1415V61.9091C63.1415 61.3949 63.008 60.9943 62.7409 60.7074C62.4739 60.4176 62.1074 60.2727 61.6415 60.2727C61.3205 60.2727 61.0336 60.3423 60.7807 60.4815C60.5307 60.6207 60.3333 60.8239 60.1884 61.0909C60.0435 61.358 59.9711 61.6818 59.9711 62.0625ZM68.4565 66.1364C67.911 66.1364 67.4295 65.9986 67.0119 65.723C66.5943 65.4446 66.2676 65.0526 66.0318 64.5469C65.796 64.0384 65.6781 63.4375 65.6781 62.7443C65.6781 62.0568 65.796 61.4602 66.0318 60.9545C66.2676 60.4489 66.5957 60.0582 67.0162 59.7827C67.4366 59.5071 67.9224 59.3693 68.4735 59.3693C68.8997 59.3693 69.2363 59.4403 69.4835 59.5824C69.7335 59.7216 69.9238 59.8807 70.0545 60.0597C70.188 60.2358 70.2917 60.3807 70.3656 60.4943H70.4508V57.2727H71.4565V66H70.4849V64.9943H70.3656C70.2917 65.1136 70.1866 65.2642 70.0502 65.446C69.9139 65.625 69.7193 65.7855 69.4664 65.9276C69.2136 66.0668 68.877 66.1364 68.4565 66.1364ZM68.5929 65.233C68.9963 65.233 69.3372 65.1278 69.6156 64.9176C69.894 64.7045 70.1056 64.4105 70.2505 64.0355C70.3954 63.6577 70.4679 63.2216 70.4679 62.7273C70.4679 62.2386 70.3968 61.8111 70.2548 61.4446C70.1127 61.0753 69.9025 60.7884 69.6241 60.5838C69.3457 60.3764 69.002 60.2727 68.5929 60.2727C68.1667 60.2727 67.8116 60.3821 67.5275 60.6009C67.2463 60.8168 67.0346 61.1108 66.8926 61.483C66.7534 61.8523 66.6838 62.267 66.6838 62.7273C66.6838 63.1932 66.7548 63.6165 66.8968 63.9972C67.0417 64.375 67.2548 64.6761 67.536 64.9006C67.8201 65.1222 68.1724 65.233 68.5929 65.233ZM79.2846 66.1364C78.7392 66.1364 78.2576 65.9986 77.84 65.723C77.4224 65.4446 77.0957 65.0526 76.8599 64.5469C76.6241 64.0384 76.5062 63.4375 76.5062 62.7443C76.5062 62.0568 76.6241 61.4602 76.8599 60.9545C77.0957 60.4489 77.4238 60.0582 77.8443 59.7827C78.2647 59.5071 78.7505 59.3693 79.3017 59.3693C79.7278 59.3693 80.0645 59.4403 80.3116 59.5824C80.5616 59.7216 80.752 59.8807 80.8826 60.0597C81.0162 60.2358 81.1199 60.3807 81.1937 60.4943H81.2789V57.2727H82.2846V66H81.313V64.9943H81.1937C81.1199 65.1136 81.0147 65.2642 80.8784 65.446C80.742 65.625 80.5474 65.7855 80.2946 65.9276C80.0417 66.0668 79.7051 66.1364 79.2846 66.1364ZM79.421 65.233C79.8244 65.233 80.1653 65.1278 80.4437 64.9176C80.7221 64.7045 80.9338 64.4105 81.0787 64.0355C81.2235 63.6577 81.296 63.2216 81.296 62.7273C81.296 62.2386 81.225 61.8111 81.0829 61.4446C80.9409 61.0753 80.7306 60.7884 80.4522 60.5838C80.1738 60.3764 79.8301 60.2727 79.421 60.2727C78.9949 60.2727 78.6397 60.3821 78.3556 60.6009C78.0744 60.8168 77.8627 61.1108 77.7207 61.483C77.5815 61.8523 77.5119 62.267 77.5119 62.7273C77.5119 63.1932 77.5829 63.6165 77.725 63.9972C77.8699 64.375 78.0829 64.6761 78.3642 64.9006C78.6483 65.1222 79.0005 65.233 79.421 65.233ZM84.2662 66V59.4545H85.2377V60.4432H85.3059C85.4252 60.1193 85.6412 59.8565 85.9537 59.6548C86.2662 59.4531 86.6184 59.3523 87.0105 59.3523C87.0843 59.3523 87.1767 59.3537 87.2875 59.3565C87.3983 59.3594 87.4821 59.3636 87.5389 59.3693V60.392C87.5048 60.3835 87.4267 60.3707 87.3045 60.3537C87.1852 60.3338 87.0588 60.3239 86.9252 60.3239C86.6071 60.3239 86.323 60.3906 86.073 60.5241C85.8258 60.6548 85.6298 60.8366 85.4849 61.0696C85.3429 61.2997 85.2718 61.5625 85.2718 61.858V66H84.2662ZM91.1909 66.1364C90.6 66.1364 90.0815 65.9957 89.6355 65.7145C89.1923 65.4332 88.8457 65.0398 88.5957 64.5341C88.3485 64.0284 88.225 63.4375 88.225 62.7614C88.225 62.0795 88.3485 61.4844 88.5957 60.9759C88.8457 60.4673 89.1923 60.0724 89.6355 59.7912C90.0815 59.5099 90.6 59.3693 91.1909 59.3693C91.7818 59.3693 92.2988 59.5099 92.742 59.7912C93.188 60.0724 93.5346 60.4673 93.7818 60.9759C94.0318 61.4844 94.1568 62.0795 94.1568 62.7614C94.1568 63.4375 94.0318 64.0284 93.7818 64.5341C93.5346 65.0398 93.188 65.4332 92.742 65.7145C92.2988 65.9957 91.7818 66.1364 91.1909 66.1364ZM91.1909 65.233C91.6397 65.233 92.0091 65.1179 92.2988 64.8878C92.5886 64.6577 92.8031 64.3551 92.9423 63.9801C93.0815 63.6051 93.1511 63.1989 93.1511 62.7614C93.1511 62.3239 93.0815 61.9162 92.9423 61.5384C92.8031 61.1605 92.5886 60.8551 92.2988 60.6222C92.0091 60.3892 91.6397 60.2727 91.1909 60.2727C90.742 60.2727 90.3727 60.3892 90.0829 60.6222C89.7931 60.8551 89.5787 61.1605 89.4395 61.5384C89.3002 61.9162 89.2306 62.3239 89.2306 62.7614C89.2306 63.1989 89.3002 63.6051 89.4395 63.9801C89.5787 64.3551 89.7931 64.6577 90.0829 64.8878C90.3727 65.1179 90.742 65.233 91.1909 65.233ZM95.6919 68.4545V59.4545H96.6635V60.4943H96.7828C96.8567 60.3807 96.959 60.2358 97.0897 60.0597C97.2232 59.8807 97.4135 59.7216 97.6607 59.5824C97.9107 59.4403 98.2488 59.3693 98.6749 59.3693C99.226 59.3693 99.7118 59.5071 100.132 59.7827C100.553 60.0582 100.881 60.4489 101.117 60.9545C101.352 61.4602 101.47 62.0568 101.47 62.7443C101.47 63.4375 101.352 64.0384 101.117 64.5469C100.881 65.0526 100.554 65.4446 100.137 65.723C99.7189 65.9986 99.2374 66.1364 98.6919 66.1364C98.2715 66.1364 97.9348 66.0668 97.682 65.9276C97.4292 65.7855 97.2346 65.625 97.0982 65.446C96.9618 65.2642 96.8567 65.1136 96.7828 64.9943H96.6976V68.4545H95.6919ZM96.6806 62.7273C96.6806 63.2216 96.753 63.6577 96.8979 64.0355C97.0428 64.4105 97.2544 64.7045 97.5328 64.9176C97.8113 65.1278 98.1522 65.233 98.5556 65.233C98.976 65.233 99.3269 65.1222 99.6081 64.9006C99.8922 64.6761 100.105 64.375 100.247 63.9972C100.392 63.6165 100.465 63.1932 100.465 62.7273C100.465 62.267 100.394 61.8523 100.252 61.483C100.112 61.1108 99.9007 60.8168 99.6167 60.6009C99.3354 60.3821 98.9817 60.2727 98.5556 60.2727C98.1465 60.2727 97.8027 60.3764 97.5243 60.5838C97.2459 60.7884 97.0357 61.0753 96.8936 61.4446C96.7516 61.8111 96.6806 62.2386 96.6806 62.7273Z"
                      fill="#6A7282"
                    />
                  </svg>
                </button>

                <input
                  bind:this={fileInput}
                  class="upload-input"
                  type="file"
                  onchange={onUploadFile}
                  hidden
                />
              </div>
            </div>
          {:else}
            <!-- Keep your existing tab bodies here (categories/variants/meta_info) -->
            <slot name="otherTabs" />
          {/if}
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
            class="btn-secondary"
            onclick={showCreateModal ? closeCreateModal : closeEditModal}
            type="button"
          >
            {$_("common.cancel") || "Cancel"}
          </button>

          <button
            class="btn-primary"
            onclick={showCreateModal
              ? handleCreateProduct
              : handleUpdateProduct}
            disabled={isUploadingImages}
            type="button"
          >
            {#if isUploadingImages}
              {$_("admin_dashboard.uploading_images") || "Uploading images..."}
            {:else}
              {showCreateModal
                ? $_("common.create") || "Create"
                : $_("common.update") || "Update"}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Modal -->
  {#if showDeleteModal}
    <div class="modal-overlay" onclick={closeDeleteModal}>
      <div class="modal-container small" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{$_("admin_dashboard.delete_product") || "Delete Product"}</h2>
          <button class="modal-close" onclick={closeDeleteModal}>&times;</button
          >
        </div>
        <div class="modal-body">
          <div class="delete-warning">
            <div class="warning-icon">⚠️</div>
            <p>
              {$_("admin_dashboard.delete_product_confirmation") ||
                "Are you sure you want to delete this product?"}
            </p>
            <p class="product-name-highlight">
              {selectedProduct ? getLocalizedDisplayName(selectedProduct) : ""}
            </p>
            <p class="warning-text">
              {$_("admin_dashboard.action_cannot_be_undone") ||
                "This action cannot be undone."}
            </p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick={closeDeleteModal}
            >{$_("common.cancel") || "Cancel"}</button
          >
          <button class="btn-danger" onclick={handleDeleteProduct}
            >{$_("common.delete") || "Delete"}</button
          >
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Wrapper (keeps your existing spacing) */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    background: white;
    border-radius: 0 0 12px 12px;
    border: 1px solid #e5e7eb;
  }

  /* Left text */
  .pagination-info {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .pagination-info__label {
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);
  }

  .pagination-info__strong {
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);
  }

  /* Right side */
  .pagination-controls {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }

  /* Arrow buttons */
  .pager-arrow {
    width: 36px;
    height: 36px;
    padding: 0;
    background: var(--colors-background-bg-primary-soft, #ffffff);
    border: 1px solid var(--colors-border-border-base, #e5e7eb);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  }

  .pager-arrow--left {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .pager-arrow--right {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .pager-arrow:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Pages group (keeps borders aligned with arrows) */
  .pagination-pages {
    display: inline-flex;
    align-items: center;
    gap: 0;
  }

  .page-chip {
    width: 36px;
    height: 36px;
    padding: 8px 12px;
    background: var(--colors-background-bg-primary-soft, #ffffff);
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-left: 0;
    border-right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);

    cursor: pointer;
  }

  /* Add a vertical separator between page chips (like individual boxes) */
  .page-chip + .page-chip {
    border-left: 1px solid var(--colors-border-border-base, #e5e7eb);
  }

  .page-chip.active {
    color: var(--colors-text-text-fg-brand, #1447e6);
  }

  .page-chip:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .page-ellipsis {
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-left: 1px solid var(--colors-border-border-base, #e5e7eb);
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    color: var(--colors-text-text-body, #4a5565);
  }
  .bg-icon {
    background-color: #f4f5fe;
    height: 70px;
    width: 70px;
  }

  .products-page {
    background: #f9fafb;
    min-height: 100vh;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    padding-bottom: 20px;
    padding-top: 20px;
  }
  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    display: flex;
    align-items: center;
    gap: 16px;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .stat-content {
    flex: 1;
    min-width: 0;
  }
  .stat-title {
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
    margin: 0 0 4px 0;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  /* Table */
  .products-table-container {
    background: white;
    overflow: hidden;
  }

  .products-table {
    width: 100%;
    border-collapse: collapse;
  }

  .products-table thead th {
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #667085;
    padding: 14px 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
  }

  .products-table tbody td {
    padding: 14px 16px;
    border-bottom: 1px solid #f2f4f7;
    vertical-align: middle;
  }

  .product-row--clickable {
    cursor: pointer;
  }
  .product-row--clickable:hover {
    background: #fafbff;
  }

  .product-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .product-image {
    width: 44px;
    height: 44px;
    border-radius: 24px;
    overflow: hidden;
    flex: 0 0 auto;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .product-image-placeholder {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #98a2b3;
    flex: 0 0 auto;
  }

  .product-name--truncate {
    display: inline-block;
    max-width: 320px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tags-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tag-badge {
    display: inline-block;
    padding: 4px 10px;
    background: #f3f4f6;
    color: #374151;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tag-more {
    display: inline-block;
    padding: 4px 8px;
    background: #e5e7eb;
    color: #6b7280;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .status-badge.active {
    background: #ecfdf3;
    color: #027a48;
    border-color: #abefc6;
  }
  .status-badge.inactive {
    background: #f2f4f7;
    color: #667085;
    border-color: #e4e7ec;
  }

  .expanded-row td {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding: 0;
  }

  .expanded-content {
    padding: 16px;
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
  }

  /* Product Images cards (4 in row) */
  .product-images-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(208px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .product-image-card {
    height: 160px;
    min-width: 208px;
    border-radius: 12px;
    padding: 16px;
    background: var(--colors-background-bg-secondary-soft, #f9fafb);
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-right: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-left: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-image-img {
    width: 272.75px;
    height: 80px;
    border-radius: 8px;
    object-fit: cover;
  }

  @media (max-width: 1200px) {
    .product-images-grid {
      grid-template-columns: repeat(2, minmax(208px, 1fr));
    }
    .product-image-card,
    .product-image-img {
      width: 100%;
    }
  }
  @media (max-width: 680px) {
    .product-images-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Details typography */
  .details-block {
    margin: 6px 0 16px 0;
  }

  .details-title {
    font-family: var(--typography-font-family-font-base, inherit);
    font-weight: 500;
    font-size: 18px;
    line-height: 28px;
    letter-spacing: 0%;
    color: var(--colors-text-text-heading, #101828);
    margin-bottom: 6px;
  }

  .details-text {
    font-family: var(--typography-font-family-font-base, inherit);
    font-weight: 400;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);
  }

  /* Specs cards grid (max 4 per row) */
  .specs-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(264px, 1fr));
    gap: 16px;
    margin-top: 14px;
  }

  .spec-card {
    height: 84px;
    min-width: 264px;
    border-radius: 12px;
    padding: 16px;
    background: var(--colors-background-bg-secondary-soft, #f9fafb);
    border: 1px solid var(--colors-border-border-base, #e5e7eb);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .spec-title {
    font-family: var(--typography-font-family-font-base, inherit);
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
    text-align: center;
    color: var(--colors-text-text-heading, #101828);
  }

  .spec-text {
    font-family: var(--typography-font-family-font-base, inherit);
    font-weight: 400;
    font-size: 16px;
    line-height: 24px;
    text-align: center;
    color: var(--colors-text-text-body, #4a5565);
    margin-top: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  @media (max-width: 1200px) {
    .specs-grid {
      grid-template-columns: repeat(2, minmax(264px, 1fr));
    }
    .spec-card {
      width: 100%;
    }
  }

  @media (max-width: 680px) {
    .specs-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Colors circles */
  .color-circles {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .color-circle {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #e5e7eb;
  }

  .color-circle--placeholder {
    background: #cbd5e1;
  }

  /* State pill */
  .state-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #ecfdf3;
    color: #027a48;
    border: 1px solid #abefc6;
    font-weight: 600;
    font-size: 12px;
    line-height: 18px;
  }

  /* Expanded buttons */
  .expanded-buttons {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  .btn-expanded {
    height: 36px;
    border-radius: 12px;
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    border: 1px solid transparent;
    cursor: pointer;
  }

  /* Edit */
  .btn-edit {
    width: 129px;
    background: #3c307f;
    color: #ffffff;
  }
  .btn-edit:hover {
    background: #2f2666;
  }

  /* Preview */
  .btn-preview {
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    color: var(--colors-text-text-body, #4a5565);
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
  }
  .btn-preview:hover {
    background: #f3f4f6;
  }

  /* Delete */
  .btn-delete {
    background: var(--colors-background-bg-danger, #c70036);
    color: var(--colors-text-text-white, #ffffff);
  }
  .btn-delete:hover {
    filter: brightness(0.95);
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    gap: 20px;
    background: white;
    border-radius: 0 0 12px 12px;
  }
  .pagination-pages {
    display: flex;
    align-items: center;
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
    background: #3c307f;
    color: white;
    border-color: #3c307f;
    font-weight: 600;
  }
  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 600;
  }
  .pagination-info {
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
    font-weight: 500;
  }
  /* ---------- Modal shell width ---------- */
  .modal-container.modal-large {
    padding: 24px;
    width: 37%; /* spec */
    max-width: calc(100vw - 32px);
    overflow-y: auto;
  }

  /* ---------- Header (title row) ---------- */
  .product-modal-header {
    width: 482px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;

    padding: 0 0 20px 0; /* bottom spacing/5 = 20px */
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
  }

  .product-modal-title {
    margin: 0;
    font-weight: 500;
    font-size: 18px; /* text-lg */
    line-height: 28px; /* leading-7 */
    letter-spacing: 0%;
    color: var(--colors-text-text-heading, #101828);
  }

  .product-modal-close {
    width: 36px;
    height: 36px;
    border: 0;
    background: transparent;
    border-radius: 10px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  /* ---------- Main tabs ---------- */
  .product-modal-tabs {
    width: 482px;
    height: 42px;
    display: flex;
    align-items: flex-end;
    gap: 20px; /* you can adjust spacing between tabs */
    padding-top: 6px; /* spacing/1.5 */
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
  }

  .product-tab {
    border: 0;
    background: transparent;
    cursor: pointer;

    padding: 10px 0; /* keep underline tight */
    font-weight: 500;
    font-size: 14px; /* text-sm */
    line-height: 20px; /* leading-5 */
    color: var(--colors-text-text-body, #4a5565);
    border-bottom: 1px solid transparent;
  }

  .product-tab.active {
    color: #3c307f;
    border-bottom: 1px solid #3c307f;
  }

  /* ---------- Body spacing ---------- */
  .product-modal-body {
    padding-top: 16px;
  }

  /* ---------- Language tabs (segmented) ---------- */
  .lang-tabs {
    width: 482px;
    height: 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;

    border-radius: 10px; /* rounded-base */
    border: 1px solid var(--colors-border-border-base, #e5e7eb);
    background: var(--colors-background-bg-primary-soft, #ffffff);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    overflow: hidden;
    margin-bottom: 16px;
  }

  .lang-tab {
    border: 0;
    cursor: pointer;
    background: transparent;
    font-weight: 500;
    font-size: 12px; /* text-xs */
    line-height: 20px; /* your spec says leading-5 */
    color: var(--colors-text-text-heading, #101828);
  }

  .lang-tab.active {
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
  }

  /* ---------- Form ---------- */
  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 482px;
  }

  .field-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    color: var(--colors-text-text-heading, #101828);
    margin-bottom: 8px;
  }

  .req {
    color: #d92d20;
  }

  .hint {
    font-size: 12px;
    color: #98a2b3;
    cursor: help;
  }

  .text-input {
    width: 482px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;

    padding: 10px 12px; /* spacing/2.5 top-bottom, spacing/3 left-right */
    outline: none;
  }

  .textarea-input {
    width: 482px;
    height: 146px;
    border-radius: 10px;
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;

    padding: 14px; /* spacing/3.5 */
    resize: none;
    outline: none;
  }

  .divider {
    height: 1px;
    background: #eaecf0;
    margin: 8px 0;
  }

  /* ---------- Amount row ---------- */
  .amount-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .amount-input {
    width: 384px;
    height: 48px;
    display: flex;
    align-items: center;
    gap: 8px;

    border-radius: 10px;
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;

    padding: 8px 12px 8px 10px; /* spacing/2 top, spacing/2 right, spacing/2 bottom, spacing/2.5 left */
  }

  .amount-icon {
    display: grid;
    place-items: center;
  }

  .amount-text {
    flex: 1;
    border: 0;
    background: transparent;
    outline: none;
    color: #101828;
  }

  .unit-select {
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    background: #ffffff;
    padding: 8px 10px;
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    cursor: pointer;
  }

  /* ---------- Boost control ---------- */
  .boost {
    display: flex;
    align-items: center;
  }

  .boost-btn {
    width: 40px;
    height: 40px;
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }

  .boost-btn.left {
    border-top-left-radius: 10px;
    border-bottom-left-radius: 10px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .boost-btn.right {
    border-top-right-radius: 10px;
    border-bottom-right-radius: 10px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .boost-input {
    width: 80px;
    height: 40px;
    text-align: center;
    border-top: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    border-bottom: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
    border-left: 0;
    border-right: 0;
    background: #ffffff;
    outline: none;
  }

  /* ---------- Switch ---------- */
  .switch-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .switch {
    width: 36px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid #3c307f;
    background: #e5e7eb;
    padding: 0;
    position: relative;
    cursor: pointer;
  }

  .switch.on {
    background: #3c307f;
    border-top: 1px solid #3c307f;
  }

  .switch-thumb {
    width: 16px;
    height: 16px;
    border-radius: 40px;
    background: var(--colors-background-bg-white, #ffffff);
    box-shadow: 0px 1px 2px 0px #1d293d0d;

    position: absolute;
    top: 2px;
    left: 2px;
    transition: left 0.2s ease;
  }

  .switch.on .switch-thumb {
    left: 18px; /* spec */
  }

  .switch-title {
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    color: #101828;
  }

  .switch-desc {
    margin-top: 2px;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: var(--colors-text-text-body, #4a5565);
  }

  /* ---------- Upload ---------- */
  .upload-box {
    width: 140px;
    height: 140px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    border-radius: 10px;
    border: 1px dashed var(--colors-border-border-base-medium, #e5e7eb);
    background: var(--colors-background-bg-secondary-medium, #f9fafb);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;

    padding: 10px;
    cursor: pointer;
  }

  .upload-input {
    display: none;
  }

  .upload-text {
    font-size: 12px;
    line-height: 16px;
    color: #667085;
    text-align: center;
  }
</style>

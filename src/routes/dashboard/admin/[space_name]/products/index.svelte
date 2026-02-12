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
  import { ResourceType, ContentType, Dmart } from "@edraj/tsdmart";
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

  let products = $state([]);
  let categories = $state([]);
  let variations = $state({ colors: [], storages: [] });
  let specifications = $state([]);
  let isLoading = $state(true);
  let isLoadingCategories = $state(false);
  let isLoadingVariations = $state(false);
  let isLoadingSpecifications = $state(false);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedProduct = $state(null);
  let selectedCategoryFilter = $state("all");
  let totalProductsCount = $state(0);
  let expandedRows = $state(new Set());
  let activeTab = $state("basic_info");
  let activeLanguageTab = $state("english");
  let searchQuery = $state("");
  let totalActiveProducts = $state(0);
  let totalInactiveProducts = $state(0);
  let lowStockCount = $state(0);

  let currentPage = $state(1);
  let itemsPerPage = $state(20);

  let productForm = $state({
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

      if (response?.records) {
        categories = response.records;
      } else {
        console.error("No categories found in response:", response);
      }
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
          (v) => v.shortname === "colors",
        );
        const storagesData = response.records.find(
          (v) => v.shortname === "storages",
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

      if (response?.records) {
        specifications = response.records;
      }
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

  function openEditModal(product) {
    selectedProduct = product;
    const content = product.attributes?.payload?.body;
    const displayname = product.attributes?.displayname || {};
    const description = product.attributes?.description || {};

    const categorySpecs = content?.category_specifications || [];
    const normalizedSpecs = categorySpecs.map((spec: any) => {
      if (spec.value && !spec.values) {
        return { ...spec, values: [spec.value] };
      }
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

  function openDeleteModal(product) {
    selectedProduct = product;
    showDeleteModal = true;
  }

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

  function getLocalizedDisplayName(item) {
    const displayname = item?.attributes?.displayname.en;

    if (!displayname) {
      return item?.shortname || "Untitled";
    }

    if (typeof displayname === "string") {
      return displayname;
    }

    const localizedName =
      displayname[$locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku;
    return localizedName || item?.shortname || "Untitled";
  }

  function getProductMainCategory(product) {
    const content = product.attributes?.payload?.body;
    return content?.main_category_shortname || null;
  }

  function getProductCategories(product) {
    const content = product.attributes?.payload?.body;
    return content?.categories_shortnames || [];
  }

  function getCategoryName(categoryId) {
    const category = categories.find((c) => c.shortname === categoryId);
    return category ? getLocalizedDisplayName(category) : categoryId;
  }

  function getCategoryParentId(category) {
    const content = category.attributes?.payload?.body;
    return content?.parent_category_shortname || null;
  }

  function isParentCategory(category) {
    return !getCategoryParentId(category);
  }

  function getSubCategories(parentId) {
    return categories.filter((c) => getCategoryParentId(c) === parentId);
  }

  const parentCategories = $derived.by(() => {
    return categories.filter((c) => isParentCategory(c));
  });

  function toggleCategory(categoryId) {
    const index = productForm.categories.indexOf(categoryId);
    if (index > -1) {
      productForm.categories = productForm.categories.filter(
        (id) => id !== categoryId,
      );
      if (productForm.main_category === categoryId) {
        productForm.main_category = "";
      }
    } else {
      productForm.categories = [...productForm.categories, categoryId];
      if (!productForm.main_category) {
        productForm.main_category = categoryId;
      }
    }
  }

  function setMainCategory(categoryId) {
    if (!productForm.categories.includes(categoryId)) {
      productForm.categories = [...productForm.categories, categoryId];
    }
    productForm.main_category = categoryId;
  }

  function toggleVariationValue(variationType: string, valueKey: string) {
    const existingOption = productForm.variation_options.find(
      (opt) => opt.variation_shortname === variationType,
    );

    if (existingOption) {
      if (existingOption.values.includes(valueKey)) {
        existingOption.values = existingOption.values.filter(
          (v) => v !== valueKey,
        );
        if (existingOption.values.length === 0) {
          productForm.variation_options = productForm.variation_options.filter(
            (opt) => opt.variation_shortname !== variationType,
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
      (opt) => opt.variation_shortname === variationType,
    );
    return option ? option.values.includes(valueKey) : false;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString($locale);
  }

  let totalPages = $derived.by(() => {
    return Math.ceil(totalProductsCount / itemsPerPage);
  });

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
      (c) =>
        c.name?.en?.toLowerCase().includes(term) ||
        c.name?.ar?.toLowerCase().includes(term) ||
        c.key?.toLowerCase().includes(term),
    );
  });

  const filteredStorages = $derived.by(() => {
    if (!storageSearchTerm) return variations.storages;
    const term = storageSearchTerm.toLowerCase();
    return variations.storages.filter(
      (s) =>
        s.name?.en?.toLowerCase().includes(term) ||
        s.name?.ar?.toLowerCase().includes(term) ||
        s.key?.toLowerCase().includes(term),
    );
  });

  const displayedColors = $derived.by(() => {
    if (showAllColors || filteredColors.length <= INITIAL_VARIATION_DISPLAY) {
      return filteredColors;
    }
    return filteredColors.slice(0, INITIAL_VARIATION_DISPLAY);
  });

  const displayedStorages = $derived.by(() => {
    if (
      showAllStorages ||
      filteredStorages.length <= INITIAL_VARIATION_DISPLAY
    ) {
      return filteredStorages;
    }
    return filteredStorages.slice(0, INITIAL_VARIATION_DISPLAY);
  });

  const availableSpecifications = $derived.by(() => {
    if (productForm.categories.length === 0) return [];

    const specShortnames = new Set<string>();
    productForm.categories.forEach((categoryShortname) => {
      const category = categories.find(
        (c) => c.shortname === categoryShortname,
      );
      if (category) {
        const content = category.attributes?.payload?.body;
        const specs = content?.specification_shortnames || [];
        specs.forEach((spec: string) => specShortnames.add(spec));
      }
    });

    const filtered = specifications.filter((spec) =>
      specShortnames.has(spec.shortname),
    );
    return filtered;
  });

  function getSpecificationOptions(spec: any): any[] {
    const content = spec?.attributes?.payload?.body?.content;
    return content?.options || [];
  }

  function getSpecificationDisplayName(spec: any): string {
    const displayname = spec?.attributes?.displayname;
    if (displayname) {
      return (
        displayname.en || displayname.ar || displayname.ku || spec.shortname
      );
    }
    return spec?.shortname || "";
  }

  function getOptionDisplayName(option: any): string {
    if (!option?.name) return option?.key || "";
    if (typeof option.name === "string") return option.name;
    return option.name.en || option.name.ar || option.name.ku || option.key;
  }

  function toggleProductSpecification(specShortname: string) {
    const index = productForm.product_specifications.findIndex(
      (ps) => ps.specification_shortname === specShortname,
    );

    if (index > -1) {
      productForm.product_specifications =
        productForm.product_specifications.filter(
          (ps) => ps.specification_shortname !== specShortname,
        );
      productForm.category_specifications =
        productForm.category_specifications.filter(
          (cs) => cs.specification_shortname !== specShortname,
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
      (ps) => ps.specification_shortname === specShortname,
    );
  }

  function updateCategorySpecification(
    specShortname: string,
    values: string[],
  ) {
    const index = productForm.category_specifications.findIndex(
      (cs) => cs.specification_shortname === specShortname,
    );

    if (values.length === 0) {
      if (index > -1) {
        productForm.category_specifications =
          productForm.category_specifications.filter(
            (cs) => cs.specification_shortname !== specShortname,
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
      (cs) => cs.specification_shortname === specShortname,
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
    let newValues: string[];

    if (currentValues.includes(valueKey)) {
      newValues = currentValues.filter((v) => v !== valueKey);
    } else {
      newValues = [...currentValues, valueKey];
    }

    updateCategorySpecification(specShortname, newValues);
  }

  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);

      const validFiles = files.filter((file) => {
        const isImage = file.type.startsWith("image/");
        if (!isImage) {
          errorToastMessage(`${file.name} is not a valid image file`);
        }
        return isImage;
      });

      if (validFiles.length > 0) {
        selectedImages = [...selectedImages, ...validFiles];

        validFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              imagePreviews = [...imagePreviews, e.target.result as string];
            }
          };
          reader.readAsDataURL(file);
        });
      }
    }
  }

  function removeImage(index: number) {
    selectedImages = selectedImages.filter((_, i) => i !== index);
    if (imagePreviews[index]) {
      URL.revokeObjectURL(imagePreviews[index]);
    }
    imagePreviews = imagePreviews.filter((_, i) => i !== index);
  }

  async function uploadProductImages(productShortname: string) {
    const uploadPromises = selectedImages.map(async (file, index) => {
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

      if (successCount > 0) {
        successToastMessage(`${successCount} image(s) uploaded successfully`);
      }
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

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadProducts();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      loadProducts();
    }
  }

  function toggleExpandRow(productShortname: string) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productShortname)) {
      newExpanded.delete(productShortname);
    } else {
      newExpanded.add(productShortname);
    }
    expandedRows = newExpanded;
  }

  const filteredProducts = $derived.by(() => {
    let filtered = products;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) => {
        const displayname = getLocalizedDisplayName(product).toLowerCase();
        const shortname = product.shortname.toLowerCase();
        return displayname.includes(query) || shortname.includes(query);
      });
    }

    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter((product) => {
        const categories = getProductCategories(product);
        return categories.includes(selectedCategoryFilter);
      });
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

  // actions dropdown state (same as previous table)
  let openActionsFor = $state<string | null>(null);

  function getRowId(product: any) {
    return String(product.id ?? product.shortname ?? crypto.randomUUID());
  }

  function toggleActions(product: any) {
    const id = getRowId(product);
    openActionsFor = openActionsFor === id ? null : id;
  }

  function closeActions() {
    openActionsFor = null;
  }

  function onWindowClick() {
    if (openActionsFor) closeActions();
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
            d="M7.53572 5.6746C7.68823 4.9883 8.29695 4.5 9 4.5H27C27.703 4.5 28.3118 4.9883 28.4643 5.6746L31.4643 19.1746C31.488 19.2814 31.5 19.3906 31.5 19.5V28.5C31.5 29.2956 31.1839 30.0587 30.6213 30.6213C30.0587 31.1839 29.2956 31.5 28.5 31.5H7.5C6.70435 31.5 5.94129 31.1839 5.37868 30.6213C4.81607 30.0587 4.5 29.2956 4.5 28.5V19.5C4.5 19.3906 4.51198 19.2814 4.53572 19.1746L7.53572 5.6746ZM10.2033 7.5L7.86992 18H11.1624C11.7452 18.0015 12.3148 18.1735 12.8011 18.4948C13.2873 18.8161 13.6689 19.2727 13.8988 19.8082C14.2443 20.6086 14.8166 21.2904 15.5449 21.7696C16.2739 22.2492 17.1274 22.5048 18 22.5048C18.8726 22.5048 19.7261 22.2492 20.4551 21.7696C21.1837 21.2903 21.7561 20.608 22.1016 19.8072C22.3316 19.2721 22.713 18.8159 23.1989 18.4948C23.6852 18.1735 24.2548 18.0015 24.8376 18L24.8415 18L28.1301 18L25.7967 7.5H10.2033ZM28.5 21H24.8543C24.2766 22.3368 23.3205 23.4755 22.1038 24.2759C20.8853 25.0776 19.4586 25.5048 18 25.5048C16.5414 25.5048 15.1147 25.0776 13.8962 24.2759C12.6795 23.4755 11.7234 22.3368 11.1457 21H7.5V28.5H28.5V21ZM12 10.5C12 9.67157 12.6716 9 13.5 9H22.5C23.3284 9 24 9.67157 24 10.5C24 11.3284 23.3284 12 22.5 12H13.5C12.6716 12 12 11.3284 12 10.5ZM10.5 15C10.5 14.1716 11.1716 13.5 12 13.5H24C24.8284 13.5 25.5 14.1716 25.5 15C25.5 15.8284 24.8284 16.5 24 16.5H12C11.1716 16.5 10.5 15.8284 10.5 15Z"
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
   <div
    class="flex flex-col md:flex-row search-table_header md:items-end justify-between bg-white rounded-t-xl gap-3 w-full p-6"
  >
    <!-- SEARCH -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {$_("common.search")}
      </label>

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
          class="w-full h-9 pl-9 pr-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm
               focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>

    <!-- CATEGORY FILTER DROPDOWN -->
    <div class="flex items-end">
      <!-- CREATE BUTTON -->
      <button
        onclick={openCreateModal}
        class="inline-flex items-center justify-center mx-2
            h-9 cursor-pointer
           px-3 py-2
           bg-[#3C307F] text-white text-sm font-medium
           rounded-[12px]
           shadow-[0px_1px_0.5px_0.05px_#1D293D05]
           hover:bg-[#2f2666]
           transition-colors duration-200"
      >
        <PlusOutline size="sm" />
        <span class="ml-2">
          {$_("admin_dashboard.create_product") || "Create Product"}
        </span>
      </button>
      <div class="mx-2">
        <details class="relative">
          <summary
            class="list-none cursor-pointer select-none
                h-9
               inline-flex items-center justify-between
               px-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm text-gray-700
               hover:bg-gray-50"
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

      <!-- ACTIONS DROPDOWN -->
      <div class="mx-2">
        <details class="relative">
          <summary
            class="list-none cursor-pointer select-none
               h-9
               inline-flex items-center justify-between
               px-3 py-2
               bg-[#F9FAFB]
               border border-[#E5E7EB]
               rounded-[12px]
               shadow-[0px_1px_0.5px_0.05px_#1D293D05]
               text-sm text-gray-700
               hover:bg-gray-50"
          >
            <span>Actions</span>

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
            class="absolute z-20 mt-2 w-[180px] rounded-[12px] border border-gray-200 bg-white shadow-lg p-2"
          >
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
            >
              Sort A → Z
            </button>

            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50"
            >
              Sort Z → A
            </button>
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
            <th class="col-expand"></th>
            <th class="col-product">{$_("common.product") || "Product"}</th>
            <th class="col-category"
              >{$_("admin_dashboard.category") || "Category"}</th
            >
            <th class="col-tags">{$_("admin_dashboard.tags") || "Tags"}</th>
            <th class="col-status">{$_("common.status") || "Status"}</th>
            <th class="col-actions">{$_("common.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {#each products as product}
            <tr
              class="product-row"
              class:expanded={expandedRows.has(product.shortname)}
            >
              <td class="col-expand">
                <button
                  class="expand-btn"
                  onclick={() => toggleExpandRow(product.shortname)}
                  aria-label="Expand row"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    class="expand-icon"
                    class:rotated={expandedRows.has(product.shortname)}
                  >
                    <path
                      d="M5.5 11.5L8 9L10.5 11.5L11.5 10.5L8 7L4.5 10.5L5.5 11.5Z"
                    />
                  </svg>
                </button>
              </td>
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
                  <span class="category-text">
                    {getCategoryName(getProductMainCategory(product))}
                  </span>
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
              <td class="col-actions">
                <div class="relative" onclick={(e) => e.stopPropagation()}>
                  <button
                    class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 transition"
                    aria-label={$_("common.actions") || "Actions"}
                    aria-haspopup="menu"
                    aria-expanded={openActionsFor === getRowId(product)}
                    onclick={() => toggleActions(product)}
                  >
                    <span class="text-xl leading-none">…</span>
                  </button>

                  {#if openActionsFor === getRowId(product)}
                    <div
                      class="absolute z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
                      style={$isRTL ? "right:-85px;" : "left:-85px;"}
                      role="menu"
                    >
                      <button
                        class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          toggleExpandRow(product.shortname); // or your manage action
                        }}
                        role="menuitem"
                      >
                        {$_("admin_dashboard.actions.manage") || "Manage"}
                      </button>

                      <button
                        class="w-full px-3 py-2 text-sm hover:bg-gray-50"
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openEditModal(product);
                        }}
                        role="menuitem"
                      >
                        {$_("common.edit") || "Edit"}
                      </button>

                      <button
                        class="w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                        class:text-right={$isRTL}
                        onclick={() => {
                          closeActions();
                          openDeleteModal(product);
                        }}
                        role="menuitem"
                      >
                        {$_("common.delete") || "Delete"}
                      </button>
                    </div>
                  {/if}
                </div>
              </td>
            </tr>
            {#if expandedRows.has(product.shortname)}
              <tr class="expanded-row">
                <td colspan="6">
                  <div class="expanded-content">
                    {#if getProductImages(product).length > 0}
                      <div class="product-images-gallery">
                        {#each getProductImages(product) as image}
                          <div class="gallery-image">
                            <img
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

                    <div class="product-main-info">
                      <h2 class="product-title">
                        {getLocalizedDisplayName(product)}
                      </h2>
                      <div class="product-description-section">
                        <h3 class="section-label">
                          {$_("admin_dashboard.details") || "Details"}
                        </h3>
                        <p class="product-description">
                          {stripHtmlTags(
                            $locale === "ar"
                              ? product.attributes?.description?.ar
                              : product.attributes?.description?.en,
                          ) ||
                            $_("admin_dashboard.no_description_available") ||
                            "No description available"}
                        </p>
                      </div>
                    </div>

                    <!-- Product Info Cards -->
                    <div class="product-info-cards">
                      <!-- Product State Card -->
                      <div class="info-card">
                        <div class="card-title">
                          {$_("admin_dashboard.product_state") ||
                            "Product state"}
                        </div>
                        <div class="card-value">
                          <span
                            class="state-badge"
                            class:new={product.attributes?.is_active}
                          >
                            {#if product.attributes?.is_active}
                              <CheckOutline size="xs" />
                              {$_("admin_dashboard.new") || "New"}
                            {:else}
                              {$_("common.inactive") || "Inactive"}
                            {/if}
                          </span>
                        </div>
                      </div>

                      <!-- Colors Card -->
                      {#if product.attributes?.payload?.body?.variation_options?.find((v) => v.variation_shortname === "colors")}
                        {@const colorVariation =
                          product.attributes.payload.body.variation_options.find(
                            (v) => v.variation_shortname === "colors",
                          )}
                        {#if colorVariation?.values && colorVariation.values.length > 0}
                          <div class="info-card">
                            <div class="card-title">
                              {$_("admin_dashboard.colors_label") || "Colors"}
                            </div>
                            <div class="card-value">
                              <div class="color-dots">
                                {#each colorVariation.values.slice(0, 5) as colorKey}
                                  {@const color = variations.colors.find(
                                    (c) => c.key === colorKey,
                                  )}
                                  {#if color}
                                    {@const isHexColor =
                                      color.value?.startsWith("#")}
                                    {@const isImagePath =
                                      color.value?.startsWith("/")}

                                    {#if isHexColor}
                                      <!-- Solid color circle -->
                                      <div
                                        class="color-dot"
                                        style="background-color: {color.value};"
                                        title={getOptionDisplayName(color)}
                                      ></div>
                                    {:else if isImagePath}
                                      <!-- Image-based color -->
                                      <div
                                        class="color-dot image-color"
                                        style="background-image: url('https://api.zainmart.com/public{color.value}'); background-size: cover;"
                                        title={getOptionDisplayName(color)}
                                      ></div>
                                    {:else}
                                      <span
                                        class="color-text-label"
                                        title={getOptionDisplayName(color)}
                                      >
                                        {getOptionDisplayName(color)}
                                      </span>
                                    {/if}
                                  {:else}
                                    <div
                                      class="color-dot placeholder"
                                      title={colorKey}
                                    >
                                      ?
                                    </div>
                                  {/if}
                                {/each}
                                {#if colorVariation.values.length > 5}
                                  <span class="color-more"
                                    >+{colorVariation.values.length - 5}</span
                                  >
                                {/if}
                              </div>
                            </div>
                          </div>
                        {/if}
                      {/if}

                      <!-- Brand Card -->
                      <div class="info-card">
                        <div class="card-title">
                          {$_("admin_dashboard.brand_label") || "Brand"}
                        </div>
                        <div class="card-value">
                          {product.attributes?.payload?.body?.brand_shortname ||
                            "—"}
                        </div>
                      </div>

                      <!-- Category Card -->
                      <div class="info-card">
                        <div class="card-title">
                          {$_("admin_dashboard.category_label") || "Category"}
                        </div>
                        <div class="card-value">
                          {#if getProductMainCategory(product)}
                            {getCategoryName(getProductMainCategory(product))}
                          {:else}
                            —
                          {/if}
                        </div>
                      </div>

                      {#if product.attributes?.payload?.body?.category_specifications?.find( (s) => s.specification_shortname
                            ?.toLowerCase()
                            .includes("dimension"), )}
                        {@const dimSpec =
                          product.attributes.payload.body.category_specifications.find(
                            (s) =>
                              s.specification_shortname
                                ?.toLowerCase()
                                .includes("dimension"),
                          )}
                        <div class="info-card">
                          <div class="card-title">
                            {$_("admin_dashboard.dimensions_label") ||
                              "Dimensions"}
                          </div>
                          <div class="card-value">
                            {(dimSpec?.values || [dimSpec?.value]).join(", ")}
                          </div>
                        </div>
                      {/if}

                      {#if product.attributes?.payload?.body?.category_specifications?.find( (s) => s.specification_shortname
                            ?.toLowerCase()
                            .includes("weight"), )}
                        {@const weightSpec =
                          product.attributes.payload.body.category_specifications.find(
                            (s) =>
                              s.specification_shortname
                                ?.toLowerCase()
                                .includes("weight"),
                          )}
                        <div class="info-card">
                          <div class="card-title">
                            {$_("admin_dashboard.item_weight_label") ||
                              "Item weight"}
                          </div>
                          <div class="card-value">
                            {(weightSpec?.values || [weightSpec?.value]).join(
                              ", ",
                            )}
                          </div>
                        </div>
                      {/if}
                    </div>

                    <!-- Action Buttons -->
                    <div class="expanded-actions">
                      <button
                        class="action-btn-expanded edit"
                        onclick={() => openEditModal(product)}
                      >
                        <EditOutline size="sm" />
                        {$_("admin_dashboard.edit_product_button") ||
                          "Edit product"}
                      </button>
                      <button
                        class="action-btn-expanded delete"
                        onclick={() => openDeleteModal(product)}
                      >
                        <TrashBinOutline size="sm" />
                        {$_("admin_dashboard.delete_button") || "Delete"}
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
        <div class="pagination-info">
          {$_("common.showing") || "Showing"}
          {formatNumber((currentPage - 1) * itemsPerPage + 1, $locale)}
          -
          {formatNumber(
            Math.min(currentPage * itemsPerPage, totalProductsCount),
            $locale,
          )}
          {$_("common.of") || "of"}
          {formatNumber(totalProductsCount, $locale)}
          {$_("common.products") || "products"}
        </div>

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
      </div>
    {/if}
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div
    class="modal-overlay"
    onclick={showCreateModal ? closeCreateModal : closeEditModal}
  >
    <div
      class="modal-container modal-large"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2 class="modal-title">
          {showCreateModal
            ? $_("admin_dashboard.add_new_product") || "Add new product"
            : $_("admin_dashboard.edit_product") || "Edit Product"}
        </h2>
        <button
          class="modal-close-btn"
          onclick={showCreateModal ? closeCreateModal : closeEditModal}
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>

      <!-- Main Tabs -->
      <div class="tabs-container">
        <div class="tabs">
          <button
            class="tab-btn"
            class:active={activeTab === "basic_info"}
            onclick={() => (activeTab = "basic_info")}
          >
            {$_("admin_dashboard.basic_info") || "Basic info"}
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "categories"}
            onclick={() => (activeTab = "categories")}
          >
            {$_("admin_dashboard.categories") || "Categories"}
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "variants"}
            onclick={() => (activeTab = "variants")}
          >
            {$_("admin_dashboard.variants") || "Variants"}
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "meta_info"}
            onclick={() => (activeTab = "meta_info")}
          >
            {$_("admin_dashboard.meta_info") || "Meta info"}
          </button>
        </div>
      </div>

      <div class="modal-body">
        {#if activeTab === "basic_info"}
          <div class="language-tabs">
            <button
              class="lang-tab"
              class:active={activeLanguageTab === "arabic"}
              onclick={() => (activeLanguageTab = "arabic")}
            >
              {$_("admin_dashboard.arabic") || "Arabic"}
            </button>
            <button
              class="lang-tab"
              class:active={activeLanguageTab === "english"}
              onclick={() => (activeLanguageTab = "english")}
            >
              {$_("admin_dashboard.english") || "English"}
            </button>
          </div>

          <div class="form-content">
            {#if activeLanguageTab === "english"}
              <div class="form-group">
                <label for="product-name-en" class="form-label">
                  {$_("admin_dashboard.product_name") || "Product name"}
                </label>
                <input
                  id="product-name-en"
                  type="text"
                  bind:value={productForm.displayname_en}
                  placeholder="e.g iMac Pro"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label for="description-en" class="form-label">
                  {$_("admin_dashboard.description") || "Description"}
                </label>
                <textarea
                  id="description-en"
                  bind:value={productForm.description_en}
                  placeholder="Write description here ..."
                  class="form-textarea"
                  rows="5"
                ></textarea>
              </div>
            {:else}
              <div class="form-group">
                <label for="product-name-ar" class="form-label">
                  {$_("admin_dashboard.product_name") || "Product name"}
                </label>
                <input
                  id="product-name-ar"
                  type="text"
                  bind:value={productForm.displayname_ar}
                  placeholder="\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C"
                  class="form-input"
                  dir="rtl"
                />
              </div>

              <div class="form-group">
                <label for="description-ar" class="form-label">
                  {$_("admin_dashboard.description") || "Description"}
                </label>
                <textarea
                  id="description-ar"
                  bind:value={productForm.description_ar}
                  placeholder="\u0648\u0635\u0641 \u0627\u0644\u0645\u0646\u062A\u062C"
                  class="form-textarea"
                  rows="5"
                  dir="rtl"
                ></textarea>
              </div>
            {/if}

            <div class="form-row">
              <div class="form-group">
                <label for="amount" class="form-label">
                  {$_("admin_dashboard.amount") || "Amount"}
                  <span class="required">*</span>
                  <button type="button" class="help-icon" title="Help">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                    >
                      <circle
                        cx="7"
                        cy="7"
                        r="6"
                        stroke="currentColor"
                        fill="none"
                        stroke-width="1.5"
                      />
                      <text
                        x="7"
                        y="10"
                        text-anchor="middle"
                        font-size="10"
                        font-weight="bold">?</text
                      >
                    </svg>
                  </button>
                </label>
                <div class="input-with-select">
                  <input
                    id="amount"
                    type="number"
                    min="0"
                    bind:value={productForm.low_stock_quantity}
                    placeholder={$_(
                      "admin_dashboard.low_stock_quantity_placeholder",
                    ) || "Low Stock Quantity"}
                    class="form-input"
                  />
                  <select bind:value={productForm.unit} class="unit-select">
                    <option value="PC"
                      >{$_("admin_dashboard.unit_select.unit") ||
                        "Unit"}</option
                    >
                    <option value="KG"
                      >{$_("admin_dashboard.unit_select.kg") || "KG"}</option
                    >
                    <option value="M"
                      >{$_("admin_dashboard.unit_select.m") || "M"}</option
                    >
                    <option value="L"
                      >{$_("admin_dashboard.unit_select.l") || "L"}</option
                    >
                    <option value="BOX"
                      >{$_("admin_dashboard.unit_select.box") || "BOX"}</option
                    >
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="boost-value" class="form-label">
                  {$_("admin_dashboard.boost_value") || "Boost value"}
                  <span class="required">*</span>
                  <button type="button" class="help-icon" title="Help">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                    >
                      <circle
                        cx="7"
                        cy="7"
                        r="6"
                        stroke="currentColor"
                        fill="none"
                        stroke-width="1.5"
                      />
                      <text
                        x="7"
                        y="10"
                        text-anchor="middle"
                        font-size="10"
                        font-weight="bold">?</text
                      >
                    </svg>
                  </button>
                </label>
                <div class="number-input-group">
                  <button
                    type="button"
                    class="number-btn"
                    onclick={() =>
                      (productForm.boost_value = Math.max(
                        0,
                        productForm.boost_value - 1,
                      ))}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path
                        d="M3 8h10"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <input
                    id="boost-value"
                    type="number"
                    min="0"
                    bind:value={productForm.boost_value}
                    class="form-input number-input"
                  />
                  <button
                    type="button"
                    class="number-btn"
                    onclick={() =>
                      (productForm.boost_value = productForm.boost_value + 1)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="checkbox-container">
                <div class="toggle-switch">
                  <input
                    type="checkbox"
                    bind:checked={productForm.is_digital}
                  />
                  <span class="toggle-slider"></span>
                </div>
                <div class="checkbox-label-text">
                  <span class="label-title"
                    >{$_("admin_dashboard.digital_product") ||
                      "Digital product"}</span
                  >
                  <span class="label-description">
                    {$_("admin_dashboard.digital_product_description") ||
                      "Enable the option if the product is not a physical item."}
                  </span>
                </div>
              </label>
            </div>

            <div class="form-group">
              <label for="upload-file" class="form-label">
                {$_("admin_dashboard.upload_file") || "Upload file"}
                <span class="required">*</span>
                <button type="button" class="help-icon" title="Help">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="currentColor"
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="6"
                      stroke="currentColor"
                      fill="none"
                      stroke-width="1.5"
                    />
                    <text
                      x="7"
                      y="10"
                      text-anchor="middle"
                      font-size="10"
                      font-weight="bold">?</text
                    >
                  </svg>
                </button>
              </label>
              <div class="file-upload-area">
                <input
                  id="upload-file"
                  type="file"
                  accept="image/*"
                  multiple
                  onchange={handleImageSelect}
                  class="file-input-hidden"
                />
                <label for="upload-file" class="file-upload-label">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 48 48"
                    fill="currentColor"
                    class="upload-icon"
                  >
                    <path
                      d="M24 16v16m-8-8l8-8 8 8"
                      stroke="currentColor"
                      stroke-width="2"
                      fill="none"
                      stroke-linecap="round"
                    />
                    <path
                      d="M38 32v6a2 2 0 01-2 2H12a2 2 0 01-2-2v-6"
                      stroke="currentColor"
                      stroke-width="2"
                      fill="none"
                    />
                  </svg>
                  <p class="upload-text">
                    <span class="upload-action"
                      >{$_("admin_dashboard.click_to_upload") ||
                        "Click to upload"}</span
                    >
                    {$_("admin_dashboard.or_drag_and_drop") ||
                      "or drag and drop"}
                  </p>
                </label>
              </div>
              {#if imagePreviews.length > 0}
                <div class="image-previews-grid">
                  {#each imagePreviews as preview, index}
                    <div class="image-preview-card">
                      <img src={preview} alt="Preview {index + 1}" />
                      <button
                        type="button"
                        class="remove-preview-btn"
                        onclick={() => removeImage(index)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="white"
                        >
                          <path
                            d="M12 4L4 12M4 4l8 8"
                            stroke="white"
                            stroke-width="2"
                            stroke-linecap="round"
                          />
                        </svg>
                      </button>
                      {#if index === 0}
                        <span class="preview-badge"
                          >{$_("admin_dashboard.thumbnail") ||
                            "Thumbnail"}</span
                        >
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else if activeTab === "categories"}
          <div class="form-content">
            <h3 class="section-title">
              {$_("admin_dashboard.categories") || "Categories *"}
            </h3>
            <p class="section-description">
              {$_("admin_dashboard.categories_description") ||
                "Select one or more categories. Mark one as main category."}
            </p>

            {#if isLoadingCategories}
              <div class="loading-message">
                {$_("admin_dashboard.loading_categories") ||
                  "Loading categories..."}
              </div>
            {:else if categories.length === 0}
              <div class="warning-message">
                <p>
                  {$_("admin_dashboard.no_categories_warning") ||
                    "⚠️ No categories found. Please create categories first."}
                </p>
              </div>
            {:else}
              <div class="categories-selection">
                {#each parentCategories as category}
                  <div class="category-item">
                    <label class="category-checkbox">
                      <input
                        type="checkbox"
                        checked={productForm.categories.includes(
                          category.shortname,
                        )}
                        onchange={() => toggleCategory(category.shortname)}
                      />
                      <span>{getLocalizedDisplayName(category)}</span>
                    </label>

                    {#if productForm.categories.includes(category.shortname)}
                      <button
                        type="button"
                        class="btn-main-category"
                        class:is-main={productForm.main_category ===
                          category.shortname}
                        onclick={() => setMainCategory(category.shortname)}
                        title={$_("admin_dashboard.set_as_main_category") ||
                          "Set as main category"}
                      >
                        {#if productForm.main_category === category.shortname}
                          <CheckOutline size="xs" />
                          {$_("admin_dashboard.main") || "Main"}
                        {:else}
                          {$_("admin_dashboard.set_as_main") || "Set as Main"}
                        {/if}
                      </button>
                    {/if}
                  </div>

                  <!-- Sub-categories -->
                  {#each getSubCategories(category.shortname) as subCategory}
                    <div class="category-item sub">
                      <label class="category-checkbox">
                        <input
                          type="checkbox"
                          checked={productForm.categories.includes(
                            subCategory.shortname,
                          )}
                          onchange={() => toggleCategory(subCategory.shortname)}
                        />
                        <span>└ {getLocalizedDisplayName(subCategory)}</span>
                      </label>

                      {#if productForm.categories.includes(subCategory.shortname)}
                        <button
                          type="button"
                          class="btn-main-category"
                          class:is-main={productForm.main_category ===
                            subCategory.shortname}
                          onclick={() => setMainCategory(subCategory.shortname)}
                          title={$_("admin_dashboard.set_as_main_category") ||
                            "Set as main category"}
                        >
                          {#if productForm.main_category === subCategory.shortname}
                            <CheckOutline size="xs" />
                            {$_("admin_dashboard.main") || "Main"}
                          {:else}
                            {$_("admin_dashboard.set_as_main") || "Set as Main"}
                          {/if}
                        </button>
                      {/if}
                    </div>
                  {/each}
                {/each}
              </div>
            {/if}
          </div>
        {:else if activeTab === "variants"}
          <div class="form-content">
            <h3 class="section-title">
              {$_("admin_dashboard.variations_optional") ||
                "Variations (Optional)"}
            </h3>

            {#if variations.colors.length > 0}
              <div class="variation-group">
                <div class="variation-header">
                  <h4 class="variation-title">
                    {$_("admin_dashboard.colors") || "Colors"}
                  </h4>
                  {#if variations.colors.length > INITIAL_VARIATION_DISPLAY}
                    <input
                      type="text"
                      bind:value={colorSearchTerm}
                      placeholder={$_("admin_dashboard.search_colors") ||
                        "Search colors..."}
                      class="variation-search"
                    />
                  {/if}
                </div>
                <div class="variation-options">
                  {#each displayedColors as color}
                    <button
                      type="button"
                      class="variation-option color"
                      class:selected={isVariationSelected("colors", color.key)}
                      onclick={() => toggleVariationValue("colors", color.key)}
                      title={color.name?.en || color.name?.ar}
                    >
                      <span
                        class="color-swatch"
                        style="background-color: {color.value}"
                      ></span>
                      <span class="color-name"
                        >{color.name?.en || color.name?.ar}</span
                      >
                    </button>
                  {/each}
                </div>
                {#if filteredColors.length > INITIAL_VARIATION_DISPLAY}
                  <button
                    type="button"
                    class="show-more-btn"
                    onclick={() => (showAllColors = !showAllColors)}
                  >
                    {showAllColors
                      ? $_("admin_dashboard.show_less") || "Show Less"
                      : `${$_("admin_dashboard.show_more") || "Show More"} (${filteredColors.length - INITIAL_VARIATION_DISPLAY})`}
                  </button>
                {/if}
                {#if colorSearchTerm && filteredColors.length === 0}
                  <p class="no-results">
                    {$_("admin_dashboard.no_colors_found") || "No colors found"}
                  </p>
                {/if}
              </div>
            {/if}

            {#if variations.storages.length > 0}
              <div class="variation-group">
                <div class="variation-header">
                  <h4 class="variation-title">
                    {$_("admin_dashboard.storage") || "Storage"}
                  </h4>
                  {#if variations.storages.length > INITIAL_VARIATION_DISPLAY}
                    <input
                      type="text"
                      bind:value={storageSearchTerm}
                      placeholder={$_("admin_dashboard.search_storage") ||
                        "Search storage..."}
                      class="variation-search"
                    />
                  {/if}
                </div>
                <div class="variation-options">
                  {#each displayedStorages as storage}
                    <button
                      type="button"
                      class="variation-option"
                      class:selected={isVariationSelected(
                        "storages",
                        storage.key,
                      )}
                      onclick={() =>
                        toggleVariationValue("storages", storage.key)}
                    >
                      {storage.name?.en || storage.name?.ar}
                    </button>
                  {/each}
                </div>
                {#if filteredStorages.length > INITIAL_VARIATION_DISPLAY}
                  <button
                    type="button"
                    class="show-more-btn"
                    onclick={() => (showAllStorages = !showAllStorages)}
                  >
                    {showAllStorages
                      ? $_("admin_dashboard.show_less") || "Show Less"
                      : `${$_("admin_dashboard.show_more") || "Show More"} (${filteredStorages.length - INITIAL_VARIATION_DISPLAY})`}
                  </button>
                {/if}
                {#if storageSearchTerm && filteredStorages.length === 0}
                  <p class="no-results">
                    {$_("admin_dashboard.no_storage_found") ||
                      "No storage options found"}
                  </p>
                {/if}
              </div>
            {/if}

            <h3 class="section-title" style="margin-top: 2rem;">
              {$_("admin_dashboard.specifications_optional") ||
                "Specifications (Optional)"}
            </h3>
            <p class="section-description">
              {$_("admin_dashboard.specifications_select_description") ||
                "Select specifications and their values based on the selected categories"}
            </p>

            {#if productForm.categories.length === 0}
              <div class="info-message">
                <p>
                  {$_("admin_dashboard.select_category_first") ||
                    "ℹ️ Please select at least one category to see available specifications"}
                </p>
              </div>
            {:else if availableSpecifications.length === 0}
              <div class="info-message">
                <p>
                  {$_("admin_dashboard.no_specifications_available") ||
                    "ℹ️ No specifications available for the selected categories"}
                </p>
              </div>
            {:else}
              <div class="specifications-selection">
                {#each availableSpecifications as spec}
                  <div class="specification-item">
                    <div class="spec-header">
                      <label class="spec-checkbox">
                        <input
                          type="checkbox"
                          checked={isSpecificationSelected(spec.shortname)}
                          onchange={() =>
                            toggleProductSpecification(spec.shortname)}
                        />
                        <span class="spec-name"
                          >{getSpecificationDisplayName(spec)}</span
                        >
                      </label>
                    </div>

                    {#if isSpecificationSelected(spec.shortname)}
                      <div class="spec-values">
                        <div class="spec-values-header">
                          {$_("admin_dashboard.select_values") ||
                            "Select Values:"}
                        </div>
                        <div class="spec-values-grid">
                          {#each getSpecificationOptions(spec) as option}
                            <label class="spec-value-checkbox">
                              <input
                                type="checkbox"
                                checked={isSpecificationValueSelected(
                                  spec.shortname,
                                  option.key,
                                )}
                                onchange={() =>
                                  toggleSpecificationValue(
                                    spec.shortname,
                                    option.key,
                                  )}
                              />
                              <span>{getOptionDisplayName(option)}</span>
                            </label>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if activeTab === "meta_info"}
          <div class="form-content">
            <h3 class="section-title">
              {$_("admin_dashboard.seo_meta_information") ||
                "SEO & Meta Information"}
            </h3>

            <div class="form-group">
              <label for="meta-title"
                >{$_("admin_dashboard.meta_title") || "Meta Title"}</label
              >
              <input
                id="meta-title"
                type="text"
                bind:value={productForm.meta_title}
                placeholder={$_("admin_dashboard.seo_meta_title_placeholder") ||
                  "SEO meta title"}
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="meta-description"
                >{$_("admin_dashboard.meta_description") ||
                  "Meta Description"}</label
              >
              <textarea
                id="meta-description"
                bind:value={productForm.meta_description}
                placeholder={$_(
                  "admin_dashboard.seo_meta_description_placeholder",
                ) || "SEO meta description"}
                class="form-textarea"
                rows="2"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="brand"
                >{$_("admin_dashboard.brand_shortname") ||
                  "Brand Shortname"}</label
              >
              <input
                id="brand"
                type="text"
                bind:value={productForm.brand_shortname}
                placeholder={$_("admin_dashboard.brand_identifier") ||
                  "Brand identifier"}
                class="form-input"
              />
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={showCreateModal ? closeCreateModal : closeEditModal}
        >
          {$_("common.cancel") || "Cancel"}
        </button>
        <button
          class="btn-primary"
          onclick={showCreateModal ? handleCreateProduct : handleUpdateProduct}
          disabled={isUploadingImages}
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
        <button class="modal-close" onclick={closeDeleteModal}>&times;</button>
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
        <button class="btn-secondary" onclick={closeDeleteModal}>
          {$_("common.cancel") || "Cancel"}
        </button>
        <button class="btn-danger" onclick={handleDeleteProduct}>
          {$_("common.delete") || "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bg-icon {
    background-color: #f4f5fe;
    height: 70px;
    width: 70px;
  }
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 20px;
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
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
    font-weight: 500;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
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
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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

  /* Search and Filters */
  .search-and-filters {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 0 20px 20px 20px;
    flex-wrap: wrap;
  }

  .search-bar {
    flex: 1;
    min-width: 250px;
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 10px 40px 10px 16px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #3c307f;
    box-shadow: 0 0 0 3px rgba(60, 48, 127, 0.1);
  }

  .search-btn {
    position: absolute;
    right: 30px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .search-btn:hover {
    color: #3c307f;
    background: #f3f4f6;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-select {
    padding: 10px 16px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 180px;
  }

  .filter-select:focus {
    outline: none;
    border-color: #3c307f;
    box-shadow: 0 0 0 3px rgba(60, 48, 127, 0.1);
  }
  .product-name--truncate {
    display: inline-block;
    max-width: 320px; /* adjust per layout */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #3c307f;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-create:hover {
    background: #2d1f5f;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(60, 48, 127, 0.3);
  }

  .products-page {
    background: #f9fafb;
    min-height: 100vh;
  }

  /* Tags Styles */
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
</style>

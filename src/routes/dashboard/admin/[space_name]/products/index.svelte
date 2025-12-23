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

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
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
  let showDetailsModal = $state(false);
  let selectedProduct = $state(null);
  let selectedCategoryFilter = $state("all");

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
    categories: [],
    main_category: "",
    variation_options: [],
    product_specifications: [],
    category_specifications: [],
    tags: [],
  });

  // Variation search and display state
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
        true
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
        true
      );

      if (response?.records) {
        const colorsData = response.records.find(
          (v) => v.shortname === "colors"
        );
        const storagesData = response.records.find(
          (v) => v.shortname === "storages"
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
        true
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
      const response = await getSpaceContents(
        website.main_space,
        "products",
        "managed",
        100,
        0,
        true
      );

      if (response?.records) {
        products = response.records;
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
      categories: [],
      main_category: "",
      variation_options: [],
      product_specifications: [],
      category_specifications: [],
      tags: [],
    };
    // Reset variation search and display
    colorSearchTerm = "";
    storageSearchTerm = "";
    showAllColors = false;
    showAllStorages = false;
    selectedImages = [];
    imagePreviews = [];
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

    // Normalize category_specifications to use values array
    const categorySpecs = content?.category_specifications || [];
    const normalizedSpecs = categorySpecs.map((spec: any) => {
      // Handle both old format (value: string) and new format (values: string[])
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

  function openDetailsModal(product) {
    selectedProduct = product;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
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
        ""
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
        ""
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
        selectedProduct.resource_type
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
        (id) => id !== categoryId
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
      (opt) => opt.variation_shortname === variationType
    );

    if (existingOption) {
      if (existingOption.values.includes(valueKey)) {
        existingOption.values = existingOption.values.filter(
          (v) => v !== valueKey
        );
        if (existingOption.values.length === 0) {
          productForm.variation_options = productForm.variation_options.filter(
            (opt) => opt.variation_shortname !== variationType
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
    valueKey: string
  ): boolean {
    const option = productForm.variation_options.find(
      (opt) => opt.variation_shortname === variationType
    );
    return option ? option.values.includes(valueKey) : false;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString($locale);
  }

  const filteredProducts = $derived.by(() => {
    if (selectedCategoryFilter === "all") {
      return products;
    }
    return products.filter((p) => {
      const categories = getProductCategories(p);
      return categories.includes(selectedCategoryFilter);
    });
  });

  // Filtered variations with search
  const filteredColors = $derived.by(() => {
    if (!colorSearchTerm) return variations.colors;
    const term = colorSearchTerm.toLowerCase();
    return variations.colors.filter(
      (c) =>
        c.name?.en?.toLowerCase().includes(term) ||
        c.name?.ar?.toLowerCase().includes(term) ||
        c.key?.toLowerCase().includes(term)
    );
  });

  const filteredStorages = $derived.by(() => {
    if (!storageSearchTerm) return variations.storages;
    const term = storageSearchTerm.toLowerCase();
    return variations.storages.filter(
      (s) =>
        s.name?.en?.toLowerCase().includes(term) ||
        s.name?.ar?.toLowerCase().includes(term) ||
        s.key?.toLowerCase().includes(term)
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
        (c) => c.shortname === categoryShortname
      );
      if (category) {
        const content = category.attributes?.payload?.body;
        const specs = content?.specification_shortnames || [];
        specs.forEach((spec: string) => specShortnames.add(spec));
      }
    });

    const filtered = specifications.filter((spec) =>
      specShortnames.has(spec.shortname)
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
      (ps) => ps.specification_shortname === specShortname
    );

    if (index > -1) {
      // Remove from product_specifications
      productForm.product_specifications =
        productForm.product_specifications.filter(
          (ps) => ps.specification_shortname !== specShortname
        );
      // Also remove from category_specifications
      productForm.category_specifications =
        productForm.category_specifications.filter(
          (cs) => cs.specification_shortname !== specShortname
        );
    } else {
      // Add to product_specifications
      productForm.product_specifications = [
        ...productForm.product_specifications,
        { specification_shortname: specShortname },
      ];
    }
  }

  function isSpecificationSelected(specShortname: string): boolean {
    return productForm.product_specifications.some(
      (ps) => ps.specification_shortname === specShortname
    );
  }

  function updateCategorySpecification(
    specShortname: string,
    values: string[]
  ) {
    const index = productForm.category_specifications.findIndex(
      (cs) => cs.specification_shortname === specShortname
    );

    if (values.length === 0) {
      // Remove if no values selected
      if (index > -1) {
        productForm.category_specifications =
          productForm.category_specifications.filter(
            (cs) => cs.specification_shortname !== specShortname
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
      (cs) => cs.specification_shortname === specShortname
    );
    // Handle both old format (value: string) and new format (values: string[])
    if (spec?.values) return spec.values;
    if (spec?.value) return [spec.value];
    return [];
  }

  function isSpecificationValueSelected(
    specShortname: string,
    valueKey: string
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
          file
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
          `${failedCount} image(s) failed to upload: ${failedFiles}`
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
</script>

<div class="products-page" class:rtl={$isRTL}>
  <div class="header">
    <div class="header-content">
      <h1 class="page-title">
        {$_("admin_dashboard.products") || "Products Management"}
      </h1>
      <p class="page-description">
        {$_("admin_dashboard.products_description") ||
          "Manage your products with categories, variations, and specifications"}
      </p>
    </div>
    <button class="btn-create" onclick={openCreateModal}>
      <PlusOutline size="sm" />
      <span>{$_("admin_dashboard.create_product") || "Create Product"}</span>
    </button>
  </div>

  <div class="filters">
    <label for="category-filter">
      {$_("common.filter_by_category") || "Filter by Category"}:
    </label>
    <select
      id="category-filter"
      bind:value={selectedCategoryFilter}
      class="filter-select"
    >
      <option value="all">
        {$_("common.all_categories") || "All Categories"}
      </option>
      {#each categories as category}
        <option value={category.shortname}>
          {getLocalizedDisplayName(category)}
        </option>
      {/each}
    </select>
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
            <th class="col-thumbnail">{$_("common.image") || "Image"}</th>
            <th class="col-name">{$_("common.name") || "Name"}</th>
            <th class="col-shortname"
              >{$_("common.shortname") || "Shortname"}</th
            >
            <th class="col-category"
              >{$_("admin_dashboard.main_category") || "Main Category"}</th
            >
            <th class="col-date">{$_("common.created_at") || "Created"}</th>
            <th class="col-status">{$_("common.status") || "Status"}</th>
            <th class="col-actions">{$_("common.actions") || "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredProducts as product}
            <tr class="product-row">
              <td class="col-thumbnail">
                {#if getProductThumbnail(product)}
                  <div class="table-thumbnail">
                    <img
                      src={getProductThumbnail(product)}
                      alt={getLocalizedDisplayName(product)}
                      loading="lazy"
                    />
                    {#if getProductImages(product).length > 1}
                      <span class="thumbnail-badge"
                        >{getProductImages(product).length}</span
                      >
                    {/if}
                  </div>
                {:else}
                  <div class="table-thumbnail-placeholder">
                    <span>📷</span>
                  </div>
                {/if}
              </td>
              <td class="col-name">
                <div class="product-name-cell">
                  <span class="name-text"
                    >{getLocalizedDisplayName(product)}</span
                  >
                </div>
              </td>
              <td class="col-shortname">
                <span class="shortname-text">{product.shortname}</span>
              </td>
              <td class="col-category">
                {#if getProductMainCategory(product)}
                  <span class="category-badge main">
                    {getCategoryName(getProductMainCategory(product))}
                  </span>
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>
              <td class="col-date">
                <span class="date-text">
                  {formatDate(product.attributes?.created_at)}
                </span>
              </td>
              <td class="col-status">
                <span
                  class="status-badge"
                  class:active={product.attributes?.is_active}
                >
                  {product.attributes?.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td class="col-actions">
                <div class="table-actions">
                  <button
                    class="btn-icon view"
                    onclick={() => openDetailsModal(product)}
                    title={$_("common.view_details") || "View Details"}
                  >
                    <EyeOutline size="sm" />
                  </button>
                  <button
                    class="btn-icon edit"
                    onclick={() => openEditModal(product)}
                    title={$_("common.edit") || "Edit"}
                  >
                    <EditOutline size="sm" />
                  </button>
                  <button
                    class="btn-icon delete"
                    onclick={() => openDeleteModal(product)}
                    title={$_("common.delete") || "Delete"}
                  >
                    <TrashBinOutline size="sm" />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div
    class="modal-overlay"
    onclick={showCreateModal ? closeCreateModal : closeEditModal}
  >
    <div class="modal-container large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>
          {showCreateModal
            ? $_("admin_dashboard.create_product") || "Create Product"
            : $_("admin_dashboard.edit_product") || "Edit Product"}
        </h2>
        <button
          class="modal-close"
          onclick={showCreateModal ? closeCreateModal : closeEditModal}
        >
          &times;
        </button>
      </div>

      <div class="modal-body">
        <!-- Basic Information -->
        <div class="form-section">
          <h3 class="section-title">
            {$_("admin_dashboard.basic_information") || "Basic Information"}
          </h3>

          <div class="form-row">
            <div class="form-group">
              <label for="displayname-en"
                >{$_("admin_dashboard.display_name_en") ||
                  "Display Name (English) *"}</label
              >
              <input
                id="displayname-en"
                type="text"
                bind:value={productForm.displayname_en}
                placeholder={$_("admin_dashboard.enter_product_name_en") ||
                  "Enter product name in English"}
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="displayname-ar"
                >{$_("admin_dashboard.display_name_ar") ||
                  "Display Name (Arabic) *"}</label
              >
              <input
                id="displayname-ar"
                type="text"
                bind:value={productForm.displayname_ar}
                placeholder={$_("admin_dashboard.enter_product_name_ar") ||
                  "أدخل اسم المنتج بالعربية"}
                class="form-input"
                dir="rtl"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="description-en"
                >{$_("admin_dashboard.description_en") ||
                  "Description (English)"}</label
              >
              <textarea
                id="description-en"
                bind:value={productForm.description_en}
                placeholder={$_("admin_dashboard.enter_description_en") ||
                  "Enter product description in English"}
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="description-ar"
                >{$_("admin_dashboard.description_ar") ||
                  "Description (Arabic)"}</label
              >
              <textarea
                id="description-ar"
                bind:value={productForm.description_ar}
                placeholder={$_("admin_dashboard.enter_description_ar") ||
                  "أدخل وصف المنتج بالعربية"}
                class="form-textarea"
                rows="3"
                dir="rtl"
              ></textarea>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="unit">{$_("admin_dashboard.unit") || "Unit *"}</label>
              <select
                id="unit"
                bind:value={productForm.unit}
                class="form-input"
              >
                <option value="PC"
                  >{$_("admin_dashboard.unit_pc") || "PC (Piece)"}</option
                >
                <option value="KG"
                  >{$_("admin_dashboard.unit_kg") || "KG (Kilogram)"}</option
                >
                <option value="M"
                  >{$_("admin_dashboard.unit_m") || "M (Meter)"}</option
                >
                <option value="L"
                  >{$_("admin_dashboard.unit_l") || "L (Liter)"}</option
                >
                <option value="BOX"
                  >{$_("admin_dashboard.unit_box") || "BOX"}</option
                >
              </select>
            </div>

            <div class="form-group">
              <label for="low-stock"
                >{$_("admin_dashboard.low_stock_quantity") ||
                  "Low Stock Quantity"}</label
              >
              <input
                id="low-stock"
                type="number"
                min="0"
                bind:value={productForm.low_stock_quantity}
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={productForm.is_digital} />
              <span
                >{$_("admin_dashboard.digital_product") ||
                  "Digital Product"}</span
              >
            </label>
          </div>
        </div>

        <!-- Categories -->
        <div class="form-section">
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
                        category.shortname
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
                          subCategory.shortname
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

        <!-- Variations -->
        <div class="form-section">
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
                      storage.key
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
        </div>

        <!-- Specifications -->
        <div class="form-section">
          <h3 class="section-title">
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
                                option.key
                              )}
                              onchange={() =>
                                toggleSpecificationValue(
                                  spec.shortname,
                                  option.key
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

        <!-- SEO Meta -->
        <div class="form-section">
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
                "admin_dashboard.seo_meta_description_placeholder"
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

        <!-- Product Images -->
        <div class="form-section">
          <h3 class="section-title">
            {$_("admin_dashboard.product_images") || "Product Images"}
          </h3>
          <p class="section-description">
            {$_("admin_dashboard.product_images_description") ||
              "Upload product images. First image will be used as thumbnail."}
          </p>

          <div class="form-group">
            <label for="product-images" class="file-upload-label">
              <input
                id="product-images"
                type="file"
                accept="image/*"
                multiple
                onchange={handleImageSelect}
                class="file-input"
              />
              <span class="file-upload-button"
                >{$_("admin_dashboard.choose_images") ||
                  "📷 Choose Images"}</span
              >
            </label>
          </div>

          {#if imagePreviews.length > 0}
            <div class="image-previews">
              {#each imagePreviews as preview, index}
                <div class="image-preview-item">
                  <img src={preview} alt="Preview {index + 1}" />
                  <button
                    type="button"
                    class="remove-image-btn"
                    onclick={() => removeImage(index)}
                    title={$_("admin_dashboard.remove_image") || "Remove image"}
                  >
                    ×
                  </button>
                  {#if index === 0}
                    <span class="thumbnail-badge"
                      >{$_("admin_dashboard.thumbnail") || "Thumbnail"}</span
                    >
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if showEditModal && selectedProduct}
            <div class="existing-images">
              <h4>
                {$_("admin_dashboard.existing_images") || "Existing Images"}
              </h4>
              <div class="image-previews">
                {#each getProductImages(selectedProduct) as image}
                  <div class="image-preview-item existing">
                    <img
                      src={Dmart.getAttachmentUrl({
                        resource_type: ResourceType.media,
                        space_name: website.main_space,
                        subpath: selectedProduct.subpath + "/",
                        parent_shortname: selectedProduct.shortname,
                        shortname: image.attributes.payload.body,
                        ext: null,
                      })}
                      alt={image.shortname}
                      loading="lazy"
                    />
                    <span class="image-name">{image.shortname}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
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

<!-- Details Modal -->
{#if showDetailsModal && selectedProduct}
  <div class="modal-overlay" onclick={closeDetailsModal}>
    <div class="modal-container large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{$_("admin_dashboard.product_details") || "Product Details"}</h2>
        <button class="modal-close" onclick={closeDetailsModal}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="details-section">
          <h3 class="details-title">
            {$_("admin_dashboard.basic_information") || "Basic Information"}
          </h3>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label"
                >{$_("admin_dashboard.display_name_en") ||
                  "Display Name (EN)"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.displayname?.en || "—"}</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("admin_dashboard.display_name_ar") ||
                  "Display Name (AR)"}:</span
              >
              <span class="detail-value" dir="rtl"
                >{selectedProduct.attributes?.displayname?.ar || "—"}</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("common.shortname") || "Shortname"}:</span
              >
              <span class="detail-value">{selectedProduct.shortname}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("admin_dashboard.unit") || "Unit"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.payload?.body?.unit || "—"}</span
              >
            </div>
            <div class="detail-item full-width">
              <span class="detail-label"
                >{$_("admin_dashboard.description_en") ||
                  "Description (EN)"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.description?.en || "—"}</span
              >
            </div>
            <div class="detail-item full-width">
              <span class="detail-label"
                >{$_("admin_dashboard.description_ar") ||
                  "Description (AR)"}:</span
              >
              <span class="detail-value" dir="rtl"
                >{selectedProduct.attributes?.description?.ar || "—"}</span
              >
            </div>
          </div>
        </div>

        {#if getProductImages(selectedProduct).length > 0}
          <div class="details-section">
            <h3 class="details-title">
              {$_("admin_dashboard.product_images") || "Product Images"}
            </h3>
            <div class="details-images">
              {#each getProductImages(selectedProduct) as image}
                <div class="details-image">
                  <img
                    src={Dmart.getAttachmentUrl({
                      resource_type: ResourceType.media,
                      space_name: website.main_space,
                      subpath: selectedProduct.subpath + "/",
                      parent_shortname: selectedProduct.shortname,
                      shortname: image.attributes.payload.body,
                      ext: null,
                    })}
                    alt={image.shortname}
                    loading="lazy"
                  />
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if getProductCategories(selectedProduct).length > 0}
          <div class="details-section">
            <h3 class="details-title">
              {$_("admin_dashboard.categories") || "Categories"}
            </h3>
            <div class="details-categories">
              {#each getProductCategories(selectedProduct) as categoryId}
                <span
                  class="category-badge"
                  class:main={categoryId ===
                    getProductMainCategory(selectedProduct)}
                >
                  {getCategoryName(categoryId)}
                  {#if categoryId === getProductMainCategory(selectedProduct)}
                    <span class="badge-indicator"
                      >({$_("admin_dashboard.main") || "Main"})</span
                    >
                  {/if}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedProduct.attributes?.payload?.body?.variation_options?.length > 0}
          <div class="details-section">
            <h3 class="details-title">
              {$_("admin_dashboard.variations") || "Variations"}
            </h3>
            <div class="details-variations">
              {#each selectedProduct.attributes.payload.body.variation_options as variation}
                <div class="variation-detail">
                  <span class="variation-type"
                    >{variation.variation_shortname}:</span
                  >
                  <span class="variation-values"
                    >{variation.values.join(", ")}</span
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedProduct.attributes?.payload?.body?.category_specifications?.length > 0}
          <div class="details-section">
            <h3 class="details-title">
              {$_("admin_dashboard.specifications") || "Specifications"}
            </h3>
            <div class="details-specifications">
              {#each selectedProduct.attributes.payload.body.category_specifications as spec}
                <div class="spec-detail">
                  <span class="spec-name">{spec.specification_shortname}:</span>
                  <span class="spec-values"
                    >{spec.values
                      ? spec.values.join(", ")
                      : spec.value || "—"}</span
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="details-section">
          <h3 class="details-title">
            {$_("admin_dashboard.seo_meta_information") || "SEO & Meta"}
          </h3>
          <div class="details-grid">
            <div class="detail-item full-width">
              <span class="detail-label"
                >{$_("admin_dashboard.meta_title") || "Meta Title"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.payload?.body?.meta_title ||
                  "—"}</span
              >
            </div>
            <div class="detail-item full-width">
              <span class="detail-label"
                >{$_("admin_dashboard.meta_description") ||
                  "Meta Description"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.payload?.body?.meta_description ||
                  "—"}</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("admin_dashboard.brand_shortname") || "Brand"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.payload?.body?.brand_shortname ||
                  "—"}</span
              >
            </div>
          </div>
        </div>

        <div class="details-section">
          <h3 class="details-title">{$_("common.metadata") || "Metadata"}</h3>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label"
                >{$_("common.created_at") || "Created"}:</span
              >
              <span class="detail-value"
                >{formatDate(selectedProduct.attributes?.created_at)}</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("common.updated_at") || "Updated"}:</span
              >
              <span class="detail-value"
                >{formatDate(selectedProduct.attributes?.updated_at)}</span
              >
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("common.status") || "Status"}:</span
              >
              <span
                class="status-badge"
                class:active={selectedProduct.attributes?.is_active}
              >
                {selectedProduct.attributes?.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label"
                >{$_("admin_dashboard.low_stock_quantity") ||
                  "Low Stock"}:</span
              >
              <span class="detail-value"
                >{selectedProduct.attributes?.payload?.body
                  ?.low_stock_quantity || "—"}</span
              >
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeDetailsModal}>
          {$_("common.close") || "Close"}
        </button>
        <div style="display: flex; gap: 0.5rem;">
          <button
            class="btn-primary"
            onclick={() => {
              closeDetailsModal();
              openEditModal(selectedProduct);
            }}
          >
            <EditOutline size="xs" />
            {$_("common.edit") || "Edit"}
          </button>
          <button
            class="btn-danger"
            onclick={() => {
              closeDetailsModal();
              openDeleteModal(selectedProduct);
            }}
          >
            <TrashBinOutline size="xs" />
            {$_("common.delete") || "Delete"}
          </button>
        </div>
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

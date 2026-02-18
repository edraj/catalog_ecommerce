<script lang="ts">
  import { _ } from "@/i18n";

  let {
    formData = $bindable(),
    validateFn = $bindable(),
  }: {
    formData: any;
    validateFn: () => boolean;
  } = $props();

  let form;

  // Initialize form data
  formData = {
    ...formData,
    shortname: formData.shortname || "",
    displayname: formData.displayname || { en: "", ar: "", ku: "" },
    description: formData.description || { en: "", ar: "", ku: "" },
    order: formData.order ?? 0,
    is_active: formData.is_active ?? true,
    for_single_order: formData.for_single_order ?? false,
    for_employees_only: formData.for_employees_only ?? false,
  };

  function validate() {
    const isValid = form?.checkValidity();
    if (!isValid) {
      form?.reportValidity();
      return false;
    }

    if (!formData.displayname.en && !formData.displayname.ar) {
      alert($_("validation.requireDisplayname"));
      return false;
    }

    return true;
  }

  validateFn = validate;
</script>

<form bind:this={form} class="payment-method-form">
  <div class="card">
    <h2 class="card-title">{$_("paymentMethod.basicInfo")}</h2>

    <div class="form-group">
      <label class="form-label" for="shortname">
        <span class="required">*</span>
        {$_("paymentMethod.shortname")}
      </label>
      <input
        id="shortname"
        type="text"
        class="form-input"
        bind:value={formData.shortname}
        pattern="^[a-zA-Z0-9_]&#123;1,64&#125;$"
        required
        placeholder={$_("paymentMethod.shortnamePlaceholder")}
      />
      <small class="form-hint">{$_("paymentMethod.shortnameHint")}</small>
    </div>

    <div class="form-group">
      <label class="form-label" for="order">
        {$_("paymentMethod.order")}
      </label>
      <input
        id="order"
        type="number"
        class="form-input"
        bind:value={formData.order}
        min="0"
        placeholder={$_("paymentMethod.orderPlaceholder")}
      />
      <small class="form-hint">{$_("paymentMethod.orderHint")}</small>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" bind:checked={formData.is_active} />
        {$_("common.isActive")}
      </label>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" bind:checked={formData.for_single_order} />
        {$_("paymentMethods.singleOrderOnly") || "Single order only"}
      </label>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" bind:checked={formData.for_employees_only} />
        {$_("paymentMethods.employeesOnly") || "Employees only"}
      </label>
    </div>
  </div>

  <div class="card">
    <h2 class="card-title">{$_("paymentMethod.displayNames")}</h2>

    <div class="form-group">
      <label class="form-label" for="displayname_en">
        <span class="required">*</span>
        {$_("paymentMethod.displaynameEn")}
      </label>
      <input
        id="displayname_en"
        type="text"
        class="form-input"
        bind:value={formData.displayname.en}
        placeholder={$_("paymentMethod.displaynameEnPlaceholder")}
      />
    </div>

    <div class="form-group">
      <label class="form-label" for="displayname_ar">
        {$_("paymentMethod.displaynameAr")}
      </label>
      <input
        id="displayname_ar"
        type="text"
        class="form-input"
        bind:value={formData.displayname.ar}
        placeholder={$_("paymentMethod.displaynameArPlaceholder")}
      />
    </div>

    <div class="form-group">
      <label class="form-label" for="displayname_ku">
        {$_("paymentMethod.displaynameKu")}
      </label>
      <input
        id="displayname_ku"
        type="text"
        class="form-input"
        bind:value={formData.displayname.ku}
        placeholder={$_("paymentMethod.displaynameKuPlaceholder")}
      />
    </div>
  </div>

  <div class="card">
    <h2 class="card-title">{$_("paymentMethod.descriptions")}</h2>

    <div class="form-group">
      <label class="form-label" for="description_en">
        {$_("paymentMethod.descriptionEn")}
      </label>
      <textarea
        id="description_en"
        class="form-textarea"
        bind:value={formData.description.en}
        rows="3"
        placeholder={$_("paymentMethod.descriptionEnPlaceholder")}
      ></textarea>
    </div>

    <div class="form-group">
      <label class="form-label" for="description_ar">
        {$_("paymentMethod.descriptionAr")}
      </label>
      <textarea
        id="description_ar"
        class="form-textarea"
        bind:value={formData.description.ar}
        rows="3"
        placeholder={$_("paymentMethod.descriptionArPlaceholder")}
      ></textarea>
    </div>

    <div class="form-group">
      <label class="form-label" for="description_ku">
        {$_("paymentMethod.descriptionKu")}
      </label>
      <textarea
        id="description_ku"
        class="form-textarea"
        bind:value={formData.description.ku}
        rows="3"
        placeholder={$_("paymentMethod.descriptionKuPlaceholder")}
      ></textarea>
    </div>
  </div>
</form>

<style>
  .payment-method-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card {
    background: #f9fafb;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1.25rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: block;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .form-label input[type="checkbox"] {
    margin-right: 0.5rem;
  }

  .required {
    color: #ef4444;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-textarea {
    resize: vertical;
    font-family: inherit;
  }

  .form-hint {
    display: block;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }
</style>

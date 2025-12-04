<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import {
    EnvelopeSolid,
    EyeSlashSolid,
    EyeSolid,
    LockSolid,
    UserSolid,
    CheckCircleSolid,
    PlusOutline,
    UserAddSolid,
  } from "flowbite-svelte-icons";
  import { createSeller, createFolder } from "@/lib/dmart_services";

  $goto;

  let formData = $state({
    email: "",
    shortname: "auto",
    password: "",
    confirmPassword: "",
    gender: "",
    age: "",
    address: "",
    profession: "",
    description: "",
  });

  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let isSubmitting = $state(false);
  let showSuccess = $state(false);
  let showError = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");

  type Errors = {
    email?: string;
    password?: string;
    confirmPassword?: string;
    gender?: string;
    shortname?: string;
    age?: string;
    address?: string;
    profession?: string;
    description?: string;
  };
  let errors: Errors = $state({});

  const isRTL = $locale === "ar" || $locale === "ku";

  async function handleSubmit(event: Event) {
    event.preventDefault();

    errors = {
      email: "",
      password: "",
      confirmPassword: "",
      gender: "",
      age: "",
      address: "",
      profession: "",
      description: "",
    };

    let isValid = true;

    const trimmedEmail = formData.email.trim();

    if (!trimmedEmail) {
      errors.email = $_("EmailRequired") || "Email is required";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = $_("InvalidEmail") || "Invalid email format";
      isValid = false;
    }

    if (!formData.password) {
      errors.password = $_("PasswordRequired") || "Password is required";
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password =
        $_("PasswordTooShort") || "Password must be at least 6 characters";
      isValid = false;
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword =
        $_("ConfirmPasswordRequired") || "Please confirm password";
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword =
        $_("PasswordsDoNotMatch") || "Passwords do not match";
      isValid = false;
    }

    if (!formData.gender) {
      errors.gender = $_("GenderRequired") || "Gender is required";
      isValid = false;
    }

    if (
      formData.age &&
      (isNaN(Number(formData.age)) ||
        Number(formData.age) < 1 ||
        Number(formData.age) > 150)
    ) {
      errors.age = $_("InvalidAge") || "Invalid age";
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    isSubmitting = true;

    try {
      const sellerData = {
        shortname: formData.shortname,
        email: trimmedEmail,
        password: formData.password,
        role: "seller",
        gender: formData.gender,
        ...(formData.age && { age: Number(formData.age) }),
        ...(formData.address && { address: formData.address.trim() }),
        ...(formData.profession && { profession: formData.profession.trim() }),
        ...(formData.description && {
          description: formData.description.trim(),
        }),
      };

      const createdSellerShortname = await createSeller(sellerData);

      if (createdSellerShortname) {
        await createSellerFolders(createdSellerShortname);

        showSuccess = true;
        successMessage =
          $_("SellerCreatedSuccessfully") ||
          "Seller account created successfully!";

        formData = {
          email: "",
          shortname: "auto",
          password: "",
          confirmPassword: "",
          gender: "",
          age: "",
          address: "",
          profession: "",
          description: "",
        };

        setTimeout(() => {
          showSuccess = false;
          $goto("/dashboard/admin");
        }, 3000);
      } else {
        throw new Error("Failed to create seller account");
      }
    } catch (error: any) {
      console.error("Seller creation error:", error);
      showError = true;
      errorMessage =
        error.message ||
        $_("SellerCreationError") ||
        "Failed to create seller account";

      setTimeout(() => {
        showError = false;
      }, 5000);
    } finally {
      isSubmitting = false;
    }
  }

  async function createSellerFolders(sellerShortname: string) {
    const spaceName = "e_commerce";
    const folderConfigs = [
      {
        subpath: "available",
        shortname: sellerShortname,
        displayname: {
          en: `${sellerShortname} Available Products`,
          ar: `منتجات ${sellerShortname} المتاحة`,
        },
      },
      {
        subpath: "discounts",
        shortname: sellerShortname,
        displayname: {
          en: `${sellerShortname} Discounts`,
          ar: `خصومات ${sellerShortname}`,
        },
      },
      {
        subpath: "orders",
        shortname: sellerShortname,
        displayname: {
          en: `${sellerShortname} Orders`,
          ar: `طلبات ${sellerShortname}`,
        },
      },
      {
        subpath: "sellers_coupons",
        shortname: sellerShortname,
        displayname: {
          en: `${sellerShortname} Coupons`,
          ar: `كوبونات ${sellerShortname}`,
        },
      },
      {
        subpath: "warranties",
        shortname: sellerShortname,
        displayname: {
          en: `${sellerShortname} Warranties`,
          ar: `ضمانات ${sellerShortname}`,
        },
      },
    ];

    try {
      for (const config of folderConfigs) {
        const folderData = {
          shortname: config.shortname,
          displayname: config.displayname,
          description: {},
          folderContent: {},
        };

        await createFolder(spaceName, config.subpath, folderData, false);
      }
      console.log(
        `Successfully created folder structure for seller: ${sellerShortname}`
      );
    } catch (error) {
      console.error("Error creating seller folders:", error);
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function toggleConfirmPasswordVisibility() {
    showConfirmPassword = !showConfirmPassword;
  }

  function goBack() {
    $goto("/dashboard/admin");
  }
</script>

<div class="seller-management-container" class:rtl={isRTL}>
  <div class="page-header">
    <button class="back-button" onclick={goBack}>
      <svg
        class="back-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      <span>{$_("Back") || "Back"}</span>
    </button>

    <div class="header-content">
      <div class="title-section">
        <div class="icon-badge">
          <UserAddSolid class="title-icon" />
        </div>
        <div>
          <h1 class="page-title">
            {$_("CreateNewSeller") || "Create New Seller"}
          </h1>
          <p class="page-subtitle">
            {$_("AddSellerDescription") ||
              "Add a new seller account to the system"}
          </p>
        </div>
      </div>
    </div>
  </div>

  {#if showSuccess}
    <div class="alert alert-success" class:rtl={isRTL}>
      <CheckCircleSolid class="alert-icon" />
      <div class="alert-content">
        <h3 class="alert-title">{$_("Success") || "Success"}</h3>
        <p>{successMessage}</p>
      </div>
    </div>
  {/if}

  {#if showError}
    <div class="alert alert-error" class:rtl={isRTL}>
      <svg class="alert-icon" fill="currentColor" viewBox="0 0 20 20">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="alert-content">
        <h3 class="alert-title">{$_("Error") || "Error"}</h3>
        <p>{errorMessage}</p>
      </div>
    </div>
  {/if}

  <div class="form-card">
    <form onsubmit={handleSubmit} class="seller-form">
      <!-- Basic Information Section -->
      <div class="form-section">
        <h2 class="section-title">
          <UserSolid class="section-icon" />
          <span>{$_("BasicInformation") || "Basic Information"}</span>
        </h2>

        <div class="form-grid">
          <div class="form-group">
            <label for="shortname" class="form-label">
              {$_("Shortname") || "Shortname"}
              <span class="optional-text">({$_("Optional") || "Optional"})</span
              >
            </label>
            <input
              id="shortname"
              type="text"
              bind:value={formData.shortname}
              placeholder={$_("ShortnamePlaceholder") ||
                "Leave empty for auto-generation"}
              class="form-input"
              class:error={errors.shortname}
              disabled={isSubmitting}
            />
            {#if errors.shortname}
              <p class="error-text">{errors.shortname}</p>
            {/if}
            <p class="help-text">
              {$_("ShortnameHelp") ||
                "Unique identifier for the seller (auto-generated if empty)"}
            </p>
          </div>

          <div class="form-group">
            <label for="email" class="form-label">
              <EnvelopeSolid class="label-icon" />
              {$_("Email") || "Email"} *
            </label>
            <input
              id="email"
              type="email"
              bind:value={formData.email}
              placeholder={$_("EmailPlaceholder") || "seller@example.com"}
              class="form-input"
              class:error={errors.email}
              disabled={isSubmitting}
              required
            />
            {#if errors.email}
              <p class="error-text">{errors.email}</p>
            {/if}
          </div>

          <div class="form-group">
            <label for="gender" class="form-label">
              {$_("Gender") || "Gender"} *
            </label>
            <select
              id="gender"
              bind:value={formData.gender}
              class="form-input"
              class:error={errors.gender}
              disabled={isSubmitting}
              required
            >
              <option value="">{$_("SelectGender") || "Select gender"}</option>
              <option value="male">{$_("Male") || "Male"}</option>
              <option value="female">{$_("Female") || "Female"}</option>
            </select>
            {#if errors.gender}
              <p class="error-text">{errors.gender}</p>
            {/if}
          </div>

          <div class="form-group">
            <label for="age" class="form-label">
              {$_("Age") || "Age"}
              <span class="optional-text">({$_("Optional") || "Optional"})</span
              >
            </label>
            <input
              id="age"
              type="number"
              bind:value={formData.age}
              placeholder={$_("AgePlaceholder") || "e.g., 25"}
              class="form-input"
              class:error={errors.age}
              disabled={isSubmitting}
              min="1"
              max="150"
            />
            {#if errors.age}
              <p class="error-text">{errors.age}</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Security Section -->
      <div class="form-section">
        <h2 class="section-title">
          <LockSolid class="section-icon" />
          <span>{$_("SecurityCredentials") || "Security Credentials"}</span>
        </h2>

        <div class="form-grid">
          <div class="form-group">
            <label for="password" class="form-label">
              {$_("Password") || "Password"} *
            </label>
            <div class="password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                bind:value={formData.password}
                placeholder={$_("PasswordPlaceholder") || "Enter password"}
                class="form-input"
                class:error={errors.password}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                class="password-toggle"
                onclick={togglePasswordVisibility}
                aria-label={$_("TogglePasswordVisibility") ||
                  "Toggle password visibility"}
              >
                {#if showPassword}
                  <EyeSlashSolid class="toggle-icon" />
                {:else}
                  <EyeSolid class="toggle-icon" />
                {/if}
              </button>
            </div>
            {#if errors.password}
              <p class="error-text">{errors.password}</p>
            {/if}
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">
              {$_("ConfirmPassword") || "Confirm Password"} *
            </label>
            <div class="password-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                bind:value={formData.confirmPassword}
                placeholder={$_("ConfirmPasswordPlaceholder") ||
                  "Re-enter password"}
                class="form-input"
                class:error={errors.confirmPassword}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                class="password-toggle"
                onclick={toggleConfirmPasswordVisibility}
                aria-label={$_("TogglePasswordVisibility") ||
                  "Toggle password visibility"}
              >
                {#if showConfirmPassword}
                  <EyeSlashSolid class="toggle-icon" />
                {:else}
                  <EyeSolid class="toggle-icon" />
                {/if}
              </button>
            </div>
            {#if errors.confirmPassword}
              <p class="error-text">{errors.confirmPassword}</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Additional Information Section -->
      <div class="form-section">
        <h2 class="section-title">
          <svg class="section-icon" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
          <span
            >{$_("AdditionalInformation") || "Additional Information"}
            <span class="optional-badge">({$_("Optional") || "Optional"})</span
            ></span
          >
        </h2>

        <div class="form-grid">
          <div class="form-group full-width">
            <label for="profession" class="form-label">
              {$_("Profession") || "Profession"}
            </label>
            <input
              id="profession"
              type="text"
              bind:value={formData.profession}
              placeholder={$_("ProfessionPlaceholder") ||
                "e.g., Electronics Retailer"}
              class="form-input"
              class:error={errors.profession}
              disabled={isSubmitting}
            />
            {#if errors.profession}
              <p class="error-text">{errors.profession}</p>
            {/if}
          </div>

          <div class="form-group full-width">
            <label for="address" class="form-label">
              {$_("Address") || "Address"}
            </label>
            <textarea
              id="address"
              bind:value={formData.address}
              placeholder={$_("AddressPlaceholder") || "Enter business address"}
              class="form-textarea"
              class:error={errors.address}
              disabled={isSubmitting}
              rows="3"
            ></textarea>
            {#if errors.address}
              <p class="error-text">{errors.address}</p>
            {/if}
          </div>

          <div class="form-group full-width">
            <label for="description" class="form-label">
              {$_("BioDescription") || "Description"}
            </label>
            <textarea
              id="description"
              bind:value={formData.description}
              placeholder={$_("BioDescriptionPlaceholder") ||
                "Brief description about the seller"}
              class="form-textarea"
              class:error={errors.description}
              disabled={isSubmitting}
              rows="4"
            ></textarea>
            {#if errors.description}
              <p class="error-text">{errors.description}</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={goBack}
          disabled={isSubmitting}
        >
          {$_("Cancel") || "Cancel"}
        </button>
        <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
          {#if isSubmitting}
            <div class="spinner"></div>
            <span>{$_("CreatingSeller") || "Creating Seller..."}</span>
          {:else}
            <PlusOutline class="btn-icon" />
            <span>{$_("CreateSeller") || "Create Seller"}</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .seller-management-container {
    min-height: 100vh;
    background: #f8f9fa;
    padding: 2rem;
  }

  .seller-management-container.rtl {
    direction: rtl;
  }

  /* Page Header */
  .page-header {
    max-width: 1200px;
    margin: 0 auto 2rem;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1.5rem;
  }

  .back-button:hover {
    background: #f9fafb;
    color: #374151;
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .header-content {
    background: white;
    border-radius: 0.75rem;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .title-section {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .icon-badge {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .title-icon {
    width: 2rem;
    height: 2rem;
    color: white;
  }

  .page-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0;
  }

  /* Alerts */
  .alert {
    max-width: 1200px;
    margin: 0 auto 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid;
  }

  .alert-success {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
  }

  .alert-error {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .alert-icon {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
  }

  .alert-content {
    flex: 1;
  }

  .alert-title {
    font-weight: 600;
    font-size: 0.875rem;
    margin: 0 0 0.25rem 0;
  }

  .alert-content p {
    margin: 0;
    font-size: 0.875rem;
  }

  /* Form Card */
  .form-card {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    border-radius: 0.75rem;
    padding: 2.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .seller-form {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  /* Form Sections */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f3f4f6;
    margin: 0;
  }

  .section-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: #3b82f6;
  }

  .optional-badge {
    font-size: 0.75rem;
    font-weight: 400;
    color: #9ca3af;
  }

  /* Form Grid */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .label-icon {
    width: 1rem;
    height: 1rem;
    color: #9ca3af;
  }

  .optional-text {
    font-size: 0.75rem;
    font-weight: 400;
    color: #9ca3af;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #111827;
    background: white;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input.error,
  .form-textarea.error {
    border-color: #ef4444;
  }

  .form-input:disabled,
  .form-textarea:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }

  .help-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  .error-text {
    font-size: 0.75rem;
    color: #ef4444;
    margin: 0;
  }

  /* Password Input */
  .password-wrapper {
    position: relative;
  }

  .password-toggle {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .password-toggle:hover {
    color: #6b7280;
  }

  .toggle-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Form Actions */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid #f3f4f6;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    border-color: #d1d5db;
    color: #6b7280;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .btn-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .seller-management-container {
      padding: 1rem;
    }

    .form-card {
      padding: 1.5rem;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .title-section {
      flex-direction: column;
      text-align: center;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .form-actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>

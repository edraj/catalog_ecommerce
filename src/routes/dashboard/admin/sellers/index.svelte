<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import "./styles/index.css";
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
  import { createSeller } from "@/lib/dmart_services";
  import { validateSellerForm } from "@/lib/utils/validationUtils";

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

    // Use validation utility
    const validation = validateSellerForm(formData, $_);
    errors = validation.errors;

    if (!validation.isValid) {
      return;
    }

    isSubmitting = true;

    try {
      const trimmedEmail = formData.email.trim();
      const sellerData = {
        shortname: formData.shortname,
        email: trimmedEmail,
        password: formData.password,
        role: "zm_seller",
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

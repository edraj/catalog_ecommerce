<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import {
    EyeSlashSolid,
    EyeSolid,
    LockSolid,
    UserSolid,
  } from "flowbite-svelte-icons";
  import { loginBy, signin, roles } from "@/stores/user";
  import { getProfile } from "@/lib/dmart_services";
  import { getDefaultPathForRole } from "@/lib/roleAccess";

  $goto;
  let identifier = "";
  let password = "";
  let showPassword = false;
  let isSubmitting = false;
  let showError = false;
  let rememberMe = false;
  let errors: { identifier?: string; password?: string } = {};
  let isError: boolean;
  const isRTL = $locale === "ar" || $locale === "ku";

  function isEmail(input: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    isError = false;
    showError = false;
    errors = {};
    isSubmitting = true;

    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      if (!trimmedIdentifier) errors.identifier = $_("ThisFieldIsRequired");
      if (!password) errors.password = $_("ThisFieldIsRequired");
      isSubmitting = false;
      return;
    }

    try {
      if (isEmail(trimmedIdentifier)) {
        await loginBy(trimmedIdentifier, password);
      } else {
        await signin(trimmedIdentifier, password);
      }

      try {
        const profile = await getProfile();

        if (profile?.roles || profile?.attributes?.roles) {
          const userRoles = profile.roles || profile.attributes.roles || [];
          roles.set(userRoles);
          localStorage.setItem("roles", JSON.stringify(userRoles));

          const defaultPath = getDefaultPathForRole(userRoles);
          $goto(defaultPath, { space_name: "zainmart" });
        } else {
          $goto("/dashboard");
        }
      } catch (profileError) {
        const storedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
        if (storedRoles.length > 0) {
          const defaultPath = getDefaultPathForRole(storedRoles);
          $goto(defaultPath, { space_name: "zainmart" });
        } else {
          $goto("/dashboard");
        }
      }
    } catch (error) {
      isError = true;
      showError = true;
      isSubmitting = false;
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }

  function goToRegister() {
    $goto("/register");
  }

  function goToForgotPassword() {
    console.log("Forgot password clicked");
  }
</script>

<div class="login-container">
  <div class="login-wrapper">
    <!-- Left Side: Login Form -->
    <div class="login-form-section">
      <div class="logo-section">
        <img
          src="/assets/images/logo.svg"
          alt="Zain Mart Logo"
          class="logo-image"
        />
      </div>

      <div class="form-content">
        <h2 class="form-title">{$_("SignIn")}</h2>

        {#if showError}
          <div class="error-message" class:rtl={isRTL}>
            <svg
              class="shrink-0 inline w-4 h-4 me-3"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
              />
            </svg>
            <div class="error-content">
              <p class="error-text">{$_("InvalidCredentials")}</p>
            </div>
          </div>
        {/if}

        <form onsubmit={handleSubmit} class="login-form">
          <div class="form-group">
            <label for="identifier" class="form-label" class:rtl={isRTL}>
              {$_("YourEmail")} / Username *
            </label>
            <div class="input-wrapper">
              <input
                id="identifier"
                type="text"
                bind:value={identifier}
                placeholder="Enter your email or username"
                class="form-input"
                class:error={errors.identifier}
                class:rtl={isRTL}
                disabled={isSubmitting}
              />
              <span class="input-icon">
                <UserSolid class="icon" />
              </span>
            </div>
            {#if errors.identifier}
              <p class="error-text-small" class:rtl={isRTL}>
                {errors.identifier}
              </p>
            {/if}
          </div>

          <div class="form-group">
            <label for="password" class="form-label" class:rtl={isRTL}>
              {$_("YourPassword")} *
            </label>
            <div class="input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                bind:value={password}
                placeholder={$_("EnterYourPassword")}
                class="form-input password-input"
                class:error={errors.password}
                class:rtl={isRTL}
                disabled={isSubmitting}
              />
              <span class="input-icon">
                <LockSolid class="icon" />
              </span>
              <button
                aria-label={`Toggle password visibility`}
                type="button"
                class="password-toggle"
                onclick={togglePasswordVisibility}
                class:rtl={isRTL}
              >
                {#if showPassword}
                  <EyeSlashSolid class="toggle-icon" />
                {:else}
                  <EyeSolid class="toggle-icon" />
                {/if}
              </button>
            </div>
            {#if errors.password}
              <p class="error-text-small" class:rtl={isRTL}>
                {errors.password}
              </p>
            {/if}
          </div>

          <div class="form-options">
            <label class="remember-me" class:rtl={isRTL}>
              <input
                type="checkbox"
                bind:checked={rememberMe}
                class="checkbox-input"
              />
              <span class="checkbox-label">{$_("RememberMe")}</span>
            </label>
            <button
              type="button"
              class="forgot-password-link"
              onclick={goToForgotPassword}
            >
              {$_("ForgotPassword")}?
            </button>
          </div>

          <button
            type="submit"
            class="submit-button"
            class:loading={isSubmitting}
            disabled={isSubmitting}
            aria-label={`Log in`}
          >
            {#if isSubmitting}
              <div class="loading-spinner"></div>
              {$_("LoggingIn")}
            {:else}
              {$_("LogIn")}
            {/if}
          </button>
        </form>

        <div class="signup-section" class:rtl={isRTL}>
          <span class="signup-text">{$_("DontHaveAccount")}</span>
          <button type="button" class="signup-link" onclick={goToRegister}>
            {$_("SignUpHere")}
          </button>
        </div>
      </div>
    </div>

    <!-- Right Side: Illustration -->
    <div class="illustration-section">
      <div class="illustration-content">
        <img
          src="/assets/images/employees-working-charts-dark.png"
          alt="Employees working on charts"
          class="illustration-image"
        />
      </div>
    </div>
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    font-family:
      "uthmantn",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif;
  }

  .login-wrapper {
    display: flex;
    align-items: center;
    max-width: 1200px;
    width: 100%;
    gap: 0;
    min-height: 600px;
  }

  .login-form-section {
    flex: 0 0 auto;
    width: 450px;
    background: white;
    border-radius: 24px;
    padding: 2rem 3rem;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 10;
    margin-right: -3rem;
  }

  .logo-section {
    margin-bottom: 2rem;
    justify-items: center;
  }

  .logo-image {
    height: 35px;
    width: auto;
  }

  .form-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 400px;
  }

  .form-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 1.5rem;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    color: #991b1b;
  }

  .error-message.rtl {
    flex-direction: row-reverse;
  }

  .error-text {
    font-size: 0.875rem;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #2d3748;
  }

  .form-label.rtl {
    text-align: right;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .form-input {
    width: 100%;
    padding: 0.875rem 1rem;
    padding-left: 2.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    background: #f7fafc;
  }

  .form-input:focus {
    outline: none;
    border-color: #8b7fe8;
    background: white;
    box-shadow: 0 0 0 3px rgba(139, 127, 232, 0.1);
  }

  .form-input::placeholder {
    color: #a0aec0;
  }

  .form-input.error {
    border-color: #fc8181;
    background: #fff5f5;
  }

  .form-input.rtl {
    text-align: right;
    padding-right: 2.75rem;
    padding-left: 1rem;
  }

  .input-icon {
    position: absolute;
    left: 1rem;
    color: #a0aec0;
    pointer-events: none;
  }

  .input-icon .icon {
    width: 1.125rem;
    height: 1.125rem;
  }

  .form-input.rtl ~ .input-icon {
    left: auto;
    right: 1rem;
  }

  .password-input {
    padding-right: 3rem;
  }

  .password-input.rtl {
    padding-left: 3rem;
    padding-right: 2.75rem;
  }

  .password-toggle {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #a0aec0;
    padding: 0.25rem;
    transition: color 0.2s ease;
  }

  .password-toggle:hover {
    color: #718096;
  }

  .password-toggle.rtl {
    right: auto;
    left: 1rem;
  }

  .toggle-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .error-text-small {
    font-size: 0.75rem;
    color: #e53e3e;
    margin-top: 0.25rem;
  }

  .error-text-small.rtl {
    text-align: right;
  }

  .form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }

  .remember-me {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #4a5568;
  }

  .remember-me.rtl {
    flex-direction: row-reverse;
  }

  .checkbox-input {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    accent-color: #8b7fe8;
  }

  .forgot-password-link {
    background: none;
    border: none;
    color: #8b7fe8;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .forgot-password-link:hover {
    color: #6b5fd8;
    text-decoration: underline;
  }

  .submit-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: #553c9a;
    color: white;
    font-weight: 600;
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
    margin-top: 0.5rem;
  }

  .submit-button:hover:not(:disabled) {
    background: #44307a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(85, 60, 154, 0.3);
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .signup-section {
    margin-top: 1.25rem;
    text-align: center;
    font-size: 0.875rem;
    color: #4a5568;
  }

  .signup-section.rtl {
    direction: rtl;
  }

  .signup-text {
    margin-right: 0.25rem;
  }

  .signup-link {
    background: none;
    border: none;
    color: #8b7fe8;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .signup-link:hover {
    color: #6b5fd8;
    text-decoration: underline;
  }

  .illustration-section {
    flex: 1;
    background: linear-gradient(135deg, #8b7fe8 0%, #6b5fd8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    position: relative;
    border-radius: 24px;
    min-height: 700px;
  }

  .illustration-content {
    width: 100%;
    max-width: 600px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .illustration-image {
    width: 100%;
    height: auto;
    object-fit: contain;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @media (max-width: 968px) {
    .illustration-section {
      display: none;
    }

    .login-wrapper {
      max-width: 500px;
    }
  }

  @media (max-width: 640px) {
    .login-container {
      padding: 1rem;
    }

    .login-form-section {
      padding: 2rem 1.5rem;
    }

    .login-wrapper {
      border-radius: 16px;
    }

    .form-content {
      max-width: 100%;
    }

    .form-title {
      font-size: 1.25rem;
    }
  }
</style>

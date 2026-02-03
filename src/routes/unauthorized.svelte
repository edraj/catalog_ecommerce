<script lang="ts">
  import { goto } from "@roxi/routify";
  import { _ } from "@/i18n";
  import { roles } from "@/stores/user";
  import { getDefaultPathForRole } from "@/lib/roleAccess";
  import { get } from "svelte/store";

  $goto;

  function goToHomePage() {
    const userRoles = get(roles);
    const defaultPath = getDefaultPathForRole(userRoles);
    $goto(defaultPath);
  }

  function goToLogin() {
    $goto("/login");
  }
</script>

<div class="unauthorized-container">
  <div class="unauthorized-content">
    <div class="error-icon">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="120"
        height="120"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
      </svg>
    </div>

    <h1 class="error-title">{$_("access_denied") || "Access Denied"}</h1>
    <p class="error-message">
      {$_("unauthorized_access_message") ||
        "You don't have permission to access this page. Please contact your administrator if you believe this is an error."}
    </p>

    <div class="action-buttons">
      <button class="btn btn-primary" onclick={goToHomePage}>
        {$_("go_to_home") || "Go to Home"}
      </button>
      <button class="btn btn-secondary" onclick={goToLogin}>
        {$_("login") || "Login"}
      </button>
    </div>
  </div>
</div>

<style>
  .unauthorized-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
  }

  .unauthorized-content {
    background: white;
    border-radius: 16px;
    padding: 60px 40px;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .error-icon {
    margin-bottom: 30px;
    color: #ef4444;
    display: flex;
    justify-content: center;
  }

  .error-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 16px;
  }

  .error-message {
    font-size: 1.125rem;
    color: #6b7280;
    line-height: 1.6;
    margin-bottom: 32px;
  }

  .action-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 12px 28px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background: #667eea;
    color: white;
  }

  .btn-primary:hover {
    background: #5568d3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 2px solid #e5e7eb;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    .unauthorized-content {
      padding: 40px 24px;
    }

    .error-title {
      font-size: 1.5rem;
    }

    .error-message {
      font-size: 1rem;
    }

    .action-buttons {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>

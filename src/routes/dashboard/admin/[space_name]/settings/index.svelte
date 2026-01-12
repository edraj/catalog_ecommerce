<script lang="ts">
  import { _ } from "@/i18n";
  import { goto } from "@roxi/routify";
  $goto;
  const settingsLinks = [
    {
      path: "collections",
      label: $_("admin.settings_collections") || "Collections",
    },
    { path: "tiles", label: $_("admin.settings_tiles") || "Tiles" },
    {
      path: "payment_methods",
      label: $_("admin.settings_payment_methods") || "Payment Methods",
    },
    { path: "widgets", label: $_("admin.settings_widgets") || "Widgets" },
  ];
</script>

<div class="settings-page-container">
  <div class="settings-header">
    <button
      class="back-button"
      on:click={() => $goto(`/dashboard/admin/[space_name]`)}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        width="22"
        height="22"
      >
        <path
          d="M12 5l-5 5 5 5"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      {$_("common.back") || "Back"}
    </button>
    <h1>{$_("admin.settings") || "Settings"}</h1>
    <p>
      {$_("admin.settings_navigation_help") ||
        "Quickly navigate to settings features below:"}
    </p>
  </div>
  <div class="settings-links-list">
    {#each settingsLinks as link}
      <button
        class="settings-link"
        on:click={() =>
          $goto(`/dashboard/admin/[space_name]/settings/${link.path}`)}
      >
        <span class="settings-link-label">{link.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          width="18"
          height="18"
        >
          <path
            d="M7 5l5 5-5 5"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/each}
  </div>
</div>

<style>
  .settings-page-container {
    max-width: 480px;
    margin: 48px auto 0 auto;
    padding: 32px 24px 28px 24px;
    background: linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%);
    border-radius: 18px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
    border: 1.5px solid #e5e7eb;
  }
  .settings-header {
    margin-bottom: 2.5rem;
    text-align: center;
  }
  .settings-header h1 {
    font-size: 2.1rem;
    margin-bottom: 0.5rem;
    color: #1e293b;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .settings-header p {
    color: #64748b;
    margin-bottom: 0.5rem;
    font-size: 1.08rem;
  }
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #475569;
    font-size: 1.05rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 1.2rem;
    transition: color 0.18s;
  }
  .back-button:hover {
    color: #1e293b;
  }
  .settings-links-list {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .settings-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 10px;
    font-size: 1.13rem;
    font-weight: 500;
    color: #334155;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(30, 41, 59, 0.04);
    transition:
      background 0.18s,
      box-shadow 0.18s,
      border 0.18s;
  }
  .settings-link:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(30, 41, 59, 0.07);
  }
  .settings-link-label {
    flex: 1;
    text-align: left;
  }
</style>

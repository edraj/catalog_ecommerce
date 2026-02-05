<script lang="ts">
  import { onMount } from "svelte";
  import { goto, params, url } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { roles, user } from "@/stores/user";
  import { authToken } from "@/stores/auth";

  $goto;
  $url;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let spaceName = $state("");
  let currentPath = $state("");
  let isSidebarOpen = $state(true);
  let isZmAdmin = $state(false);

  const adminFeatures = [
    {
      name: "products",
      i18nKey: "sidebar.products",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>`,
      path: "products",
    },
    {
      name: "categories",
      i18nKey: "sidebar.categories",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>`,
      path: "categories",
    },
    {
      name: "brands",
      i18nKey: "sidebar.brands",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>`,
      path: "brands",
    },
    {
      name: "orders",
      i18nKey: "sidebar.orders",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>`,
      path: "orders",
    },
    {
      name: "available_products",
      i18nKey: "sidebar.available_products",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`,
      path: "available_products",
    },
    {
      name: "variations",
      i18nKey: "sidebar.variations",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>`,
      path: "variations",
    },
    {
      name: "specifications",
      i18nKey: "sidebar.specifications",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>`,
      path: "specifications",
    },
    {
      name: "warranties",
      i18nKey: "sidebar.warranties",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>`,
      path: "warranties",
    },
    {
      name: "shipping",
      i18nKey: "sidebar.shipping",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>`,
      path: "shipping",
    },
    {
      name: "discounts",
      i18nKey: "sidebar.discounts",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>`,
      path: "discounts",
    },
    {
      name: "coupons",
      i18nKey: "sidebar.coupons",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>`,
      path: "coupons",
    },
    {
      name: "service",
      i18nKey: "sidebar.services",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>`,
      path: "service",
    },
    {
      name: "settings",
      i18nKey: "sidebar.settings",
      icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>`,
      path: "settings",
    },
  ];

  onMount(() => {
    spaceName = $params.space_name || "";
    updateCurrentPath();

    const userRoles = $roles || [];
    isZmAdmin =
      userRoles.includes("zm_admin") && !userRoles.includes("super_admin");
  });

  $effect(() => {
    if ($url) {
      updateCurrentPath();
    }
  });

  function updateCurrentPath() {
    const path = window.location.pathname;
    const match = path.match(/\/dashboard\/admin\/[^/]+\/([^/]+)/);
    currentPath = match ? match[1] : "";
  }

  function navigateTo(featurePath: string) {
    $goto(`/dashboard/admin/[space_name]/${featurePath}`);
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  function isActive(featurePath: string): boolean {
    return currentPath === featurePath;
  }

  function logout() {
    authToken.set("");
    user.set({ signedin: false, locale: "en" as any });
    roles.set([]);
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("roles");
    }
    $goto("/login");
  }
</script>

<div class="admin-layout" class:rtl={$isRTL}>
  <aside class="sidebar {isSidebarOpen ? 'open' : 'closed'}" class:rtl={$isRTL}>
    <!-- Sidebar Header -->
    <div class="sidebar-header">
      <button
        onclick={toggleSidebar}
        class="menu-toggle"
        aria-label={$_("sidebar.toggle_menu")}
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      {#if isSidebarOpen}
        <div class="sidebar-title">
          <div class="profile-avatar">
            <svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="profile-info">
            <h2>
              {$user?.localized_displayname || $user?.shortname || "User"}
            </h2>
          </div>
        </div>
      {/if}
    </div>

    <!-- Sidebar Navigation -->
    <nav class="sidebar-nav">
      {#each adminFeatures as feature}
        {@const active = isActive(feature.path)}
        <button
          onclick={() => navigateTo(feature.path)}
          class="nav-item"
          class:active
          class:rtl={$isRTL}
        >
          <span class="nav-icon" aria-hidden="true">
            {@html feature.icon}
          </span>
          <span class="nav-label">{$_(feature.i18nKey)}</span>
        </button>
      {/each}
    </nav>

    <!-- Logout Button -->
    <div class="sidebar-footer">
      <button onclick={logout} class="nav-item logout-btn" class:rtl={$isRTL}>
        <span class="nav-icon" aria-hidden="true">
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </span>
        <span class="nav-label">{$_("sidebar.logout") || "Logout"}</span>
      </button>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="main-content" class:sidebar-closed={!isSidebarOpen}>
    <slot />
  </main>
</div>

<style>
  .admin-layout {
    display: flex;
    min-height: 100vh;
    background: #f9fafb;
  }

  .admin-layout.rtl {
    direction: rtl;
  }

  /* Sidebar Styles */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;
    background: white;
    border-right: 1px solid #e5e7eb;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 40;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar.rtl {
    left: auto;
    right: 0;
    border-right: none;
    border-left: 1px solid #e5e7eb;
  }

  .sidebar.closed {
    width: 72px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    min-height: 70px;
  }

  .menu-toggle {
    background: none;
    border: none;
    color: #4b5563;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .menu-toggle:hover {
    background: #f3f4f6;
    color: #281f51;
  }

  .sidebar-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .profile-avatar {
    height: 40px;
    width: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3c307f 0%, #5a4a9f 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 8px;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-info h2 {
    font-size: 0.95rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1rem;
    margin: 0.25rem 0.5rem;
    border: none;
    background: transparent;
    color: #4b5563;
    cursor: pointer;
    border-radius: 0.75rem;
    transition: all 0.2s;
    font-size: 0.9375rem;
    font-weight: 500;
    text-align: left;
  }

  .nav-item.rtl {
    text-align: right;
    flex-direction: row-reverse;
  }

  .sidebar.closed .nav-item {
    justify-content: center;
    padding: 0.875rem 0.5rem;
  }

  .nav-item:hover {
    background: #f3f4f6;
    color: #281f51;
  }

  .nav-item.active {
    background: transparent;
    color: #3c307f;
    font-weight: 600;
  }

  .nav-item.active .nav-icon {
    color: #3c307f;
  }

  .nav-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar.closed .nav-label {
    display: none;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    margin-left: 260px;
    transition: margin 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-x: hidden;
  }

  .rtl .main-content {
    margin-left: 0;
    margin-right: 260px;
  }

  .main-content.sidebar-closed {
    margin-left: 72px;
  }

  .rtl .main-content.sidebar-closed {
    margin-left: 0;
    margin-right: 72px;
  }

  /* Scrollbar Styling */
  .sidebar-nav::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-nav::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  .sidebar-nav::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  /* Sidebar Footer */
  .sidebar-footer {
    padding: 1rem 0;
    border-top: 1px solid #e5e7eb;
    margin-top: auto;
  }

  .logout-btn {
    margin: 0 0.5rem;
  }

  .logout-btn:hover {
    background: #fef2f2;
    color: #dc2626;
  }

  .logout-btn:hover .nav-icon {
    color: #dc2626;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .sidebar {
      transform: translateX(-100%);
    }

    .sidebar.rtl {
      transform: translateX(100%);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .main-content {
      margin-left: 0;
    }

    .rtl .main-content {
      margin-right: 0;
    }
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 100%;
      max-width: 280px;
    }

    .sidebar.closed {
      width: 100%;
      max-width: 280px;
    }
  }
</style>

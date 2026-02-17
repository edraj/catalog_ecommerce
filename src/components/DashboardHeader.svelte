<script lang="ts">
  import SearchBar from "./SearchBar.svelte";
  import { onDestroy, onMount } from "svelte";
  import { website } from "@/config.js";
  import { newNotificationType } from "@/stores/newNotificationType";
  import { _, locale, switchLocale } from "@/i18n";
  import { roles, signout, user } from "@/stores/user";
  import { goto, url } from "@roxi/routify";

  $goto;
  const ADMIN_HOME = "/dashboard/admin";

  type Crumb = { label: string; href: string; isHome?: boolean };

  let currentPath = $state<string>("/");
  let breadcrumbs = $state<Crumb[]>([]);

  function titleize(segment: string) {
    return segment
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase());
  }

function buildCrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  const isSuperAdmin = $roles.includes("super_admin");
  const HOME_PATH = isSuperAdmin ? ADMIN_HOME : "/";
  const HOME_LABEL = isSuperAdmin ? "Dashboard" : "Home";

  // Always start with Home/Dashboard
  const crumbs: Crumb[] = [{ label: HOME_LABEL, href: HOME_PATH, isHome: true }];

  // --------------------------
  // Admin routes
  // --------------------------
  const isAdminRoute = segments[0] === "dashboard" && segments[1] === "admin";

  if (isAdminRoute) {
    // Cases:
    // 1) /dashboard/admin                       -> only Dashboard
    // 2) /dashboard/admin/users                 -> Dashboard > Users
    // 3) /dashboard/admin/:space/products       -> Dashboard > Products  (skip :space)
    if (segments.length <= 2) return crumbs;

    const isSpaceScoped = segments.length >= 4; // has /dashboard/admin/:space/...
    const space = isSpaceScoped ? segments[2] : null;

    const base = space ? `/dashboard/admin/${space}` : ADMIN_HOME;
    const tail = space ? segments.slice(3) : segments.slice(2); // ✅ skip dashboard/admin/(space)

    let acc = base;
    for (const seg of tail) {
      acc += `/${seg}`;
      crumbs.push({ label: titleize(seg), href: acc });
    }

    return crumbs;
  }

  // --------------------------
  // Public routes
  // --------------------------
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ label: titleize(seg), href: acc });
  }

  return crumbs;
}





  onMount(() => {
    // init
    currentPath = window.location.pathname;

    // ✅ reliable route change detection (works no matter how router updates URL)
    let last = window.location.pathname;

    const id = window.setInterval(() => {
      const now = window.location.pathname;
      if (now !== last) {
        last = now;
        currentPath = now;
      }
    }, 150); // 100–250ms is fine

    return () => window.clearInterval(id);
  });

  $effect(() => {
    breadcrumbs = buildCrumbs(currentPath);
  });
  let ws = $state(null);
  let isMenuOpen = $state(false);
  let isAdminExpanded = $state(false);
  let isRTL = $locale === "ar" || $locale === "ku";

  onMount(() => {
    if ($user.signedin) {
      if (isWSOpen(ws)) {
        ws.send(JSON.stringify({ type: "notification_unsubscribe" }));
      }
      if ("websocket" in website) {
        try {
          const authToken = localStorage.getItem("authToken") || "";
          ws = new WebSocket(`${website.websocket}?token=${authToken}`);
        } catch (e) {
          console.error({ e });
        }
      }

      if (ws) {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "notification_subscription",
              space_name: "__ALL__",
              subpath: "__ALL__",
            }),
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event?.data ?? "");
          if (data.type === "notification") {
            if (data?.message?.action_type === "create") {
              if (data?.message?.resource_type === "reaction") {
                $newNotificationType = "create_reaction";
              } else if (data?.message?.resource_type === "comment") {
                $newNotificationType = "create_comment";
              }
            } else if (data?.message?.action_type === "progress_ticket") {
              $newNotificationType = "progress";
            }
          }
        };
      }
    }
  });

  onDestroy(() => {
    if (ws != null) ws.close();
  });

  function isWSOpen(ws: any) {
    return ws != null && ws.readyState === ws.OPEN;
  }

  function renderNotificationIconColor() {
    switch ($newNotificationType) {
      case "create_comment":
        return "text-blue-500";
      case "create_reaction":
        return "text-red-500";
      case "progress":
        return "text-amber-500";
      default:
        return "text-gray-500";
    }
  }

  function handleLogin() {
    $goto("/login");
  }

  async function handleLogout() {
    await signout();
    $goto("/login");
    isMenuOpen = false;
  }

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  function closeMenu() {
    isMenuOpen = false;
    isAdminExpanded = false;
  }

  function toggleAdminMenu() {
    isAdminExpanded = !isAdminExpanded;
  }

  function handleMenuItemClick(href: string) {
    $goto(href);
    closeMenu();
  }

  $effect(() => {
    renderNotificationIconColor();
  });

  $effect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest(".menu-container")) {
        closeMenu();
      }
    }

    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  });
</script>

<header class="sticky top-0 z-40 w-full backdrop-blur-md bg-transparent">
  <div>
    <div class="flex h-16 items-center justify-between" style='    padding: 1.5rem;'>
      <!-- Breadcrumbs -->
      <nav
        class="breadcrumbs {isRTL ? 'breadcrumbs-rtl' : 'breadcrumbs-ltr'}"
        aria-label="Breadcrumb"
      >
        {#each breadcrumbs as crumb, i}
          {#if i > 0}
            <span class="breadcrumb-sep" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M9.74582 6.58756C9.97362 6.81537 9.97362 7.18471 9.74582 7.41252L5.66248 11.4959C5.43468 11.7237 5.06533 11.7237 4.83753 11.4959C4.60972 11.268 4.60972 10.8987 4.83753 10.6709L8.50838 7.00004L4.83753 3.32919C4.60972 3.10138 4.60972 2.73203 4.83753 2.50423C5.06533 2.27642 5.43468 2.27642 5.66248 2.50423L9.74582 6.58756Z"
                  fill="#4A5565"
                />
              </svg>
            </span>
          {/if}

          {#if i === breadcrumbs.length - 1}
            <span class="breadcrumb-current" aria-current="page"
              >{#if crumb.isHome}
                <button  class="crumb-icon" aria-hidden="true">
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
                      d="M7.5286 2.19526C7.78895 1.93491 8.21106 1.93491 8.4714 2.19526L13.8047 7.5286C14.0651 7.78895 14.0651 8.21106 13.8047 8.4714C13.5444 8.73175 13.1223 8.73175 12.8619 8.4714L12.6667 8.27614V12.6667C12.6667 13.403 12.0697 14 11.3333 14H9.33333C8.96514 14 8.66667 13.7015 8.66667 13.3333V11.3333H7.33333V13.3333C7.33333 13.7015 7.03486 14 6.66667 14H4.66667C3.93029 14 3.33333 13.403 3.33333 12.6667V8.27614L3.13807 8.4714C2.87772 8.73175 2.45561 8.73175 2.19526 8.4714C1.93491 8.21106 1.93491 7.78895 2.19526 7.5286L7.5286 2.19526Z"
                      fill="#4A5565"
                    />
                  </svg>
                </button>
              {/if}{crumb.label}</span
            >
          {:else}
            <button
              type="button"
              class="breadcrumb-link {isRTL
                ? 'breadcrumb-link-rtl'
                : 'breadcrumb-link-ltr'}"
              onclick={() => $goto(crumb.href)}
            >
              {#if crumb.isHome}
                <span class="crumb-icon" aria-hidden="true">
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
                      d="M7.5286 2.19526C7.78895 1.93491 8.21106 1.93491 8.4714 2.19526L13.8047 7.5286C14.0651 7.78895 14.0651 8.21106 13.8047 8.4714C13.5444 8.73175 13.1223 8.73175 12.8619 8.4714L12.6667 8.27614V12.6667C12.6667 13.403 12.0697 14 11.3333 14H9.33333C8.96514 14 8.66667 13.7015 8.66667 13.3333V11.3333H7.33333V13.3333C7.33333 13.7015 7.03486 14 6.66667 14H4.66667C3.93029 14 3.33333 13.403 3.33333 12.6667V8.27614L3.13807 8.4714C2.87772 8.73175 2.45561 8.73175 2.19526 8.4714C1.93491 8.21106 1.93491 7.78895 2.19526 7.5286L7.5286 2.19526Z"
                      fill="#4A5565"
                    />
                  </svg>
                </span>
              {/if}{crumb.label}
            </button>
          {/if}
        {/each}
      </nav>

      <!-- Navigation Items -->
      <div class="flex items-center space-x-3">
        {#if $user.signedin}
          <SearchBar />

          <!-- Menu Dropdown (pill-shaped: name + bell + hamburger) -->
          <div class="relative menu-container">
            <button
              onclick={toggleMenu}
              class="dropdown-trigger-pill menu-trigger"
              aria-label="Menu"
              title="Menu"
              aria-expanded={isMenuOpen}
            >
              <span class="dropdown-trigger-label">
                {(website.main_space || website.display_name || "Menu").replace(
                  /^\w/,
                  (c) => c.toUpperCase(),
                )}
              </span>
              <span class="dropdown-trigger-icon-wrap" aria-hidden="true">
                <svg
                  class="dropdown-trigger-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {#if $newNotificationType}
                  <span class="dropdown-trigger-notification-dot"></span>
                {/if}
              </span>
              <svg
                class="dropdown-trigger-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {#if isMenuOpen}
              <div
                class="dropdown-menu {isRTL
                  ? 'dropdown-menu-rtl'
                  : 'dropdown-menu-ltr'}"
              >
                <div class="dropdown-content">
                  {#if $roles.includes("super_admin") || $roles.includes("zm_admin")}
                    <!-- Admin Collapsible Section -->
                    <div class="menu-section">
                      <button
                        onclick={toggleAdminMenu}
                        class="menu-section-header"
                        aria-expanded={isAdminExpanded}
                      >
                        <svg
                          class="section-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span class="section-title">{$_("admin")}</span>
                        <svg
                          class="chevron {isAdminExpanded
                            ? 'chevron-expanded'
                            : ''}"
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
                      </button>

                      <div
                        class="admin-submenu {isAdminExpanded
                          ? 'admin-submenu-expanded'
                          : ''}"
                      >
                        <button
                          aria-label={`Admin Dashboard`}
                          onclick={() =>
                            handleMenuItemClick("/dashboard/admin")}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8v-10h-8v10zm0-18v6h8V3h-8z"
                            />
                          </svg>
                          <span>{$_("dashboard")}</span>
                        </button>
                        <button
                          aria-label={`Contact Messages`}
                          onclick={() =>
                            handleMenuItemClick(
                              "/dashboard/admin/contact-messages",
                            )}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          <span>{$_("contact_messages")}</span>
                        </button>

                        <button
                          aria-label={`Manage Permissions`}
                          onclick={() =>
                            handleMenuItemClick("/dashboard/permissions")}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12l2 2 4-4"
                            />
                          </svg>
                          <span>{$_("permission")}</span>
                        </button>
                        <button
                          aria-label={`Manage Roles`}
                          onclick={() =>
                            handleMenuItemClick("/dashboard/roles")}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5.121 17.804A9 9 0 1112 21v-1a7 7 0 100-14v1m0 4a3 3 0 013 3 3 3 0 01-3 3 3 3 0 01-3-3 3 3 0 013-3z"
                            />
                          </svg>
                          <span>{$_("roles")}</span>
                        </button>
                        <button
                          aria-label={`Manage Users`}
                          onclick={() =>
                            handleMenuItemClick("/dashboard/admin/users")}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M15 17h5v-1a4 4 0 00-4-4h-1M9 17H4v-1a4 4 0 014-4h1m3-4a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>{$_("Users")}</span>
                        </button>
                        <button
                          aria-label={`Manage Sellers`}
                          onclick={() =>
                            handleMenuItemClick("/dashboard/admin/sellers")}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                            />
                          </svg>
                          <span>{$_("sellers")}</span>
                        </button>
                        <button
                          aria-label={`Check Variation Requests`}
                          onclick={() =>
                            handleMenuItemClick(
                              "/dashboard/admin/variation_requests",
                            )}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M12 20h9M12 4h9M5 4h.01M5 20h.01M3 8h18M3 16h18M9 12h6"
                            />
                          </svg>
                          <span>{$_("variation_requests")}</span>
                        </button>
                        <button
                          aria-label={`Services`}
                          onclick={() =>
                            handleMenuItemClick(
                              `/dashboard/admin/[space_name]/service`,
                            )}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                          </svg>
                          <span>{$_("admin.services.title")}</span>
                        </button>
                        <button
                          aria-label={`Settings`}
                          onclick={() =>
                            handleMenuItemClick(
                              "/dashboard/admin/[space_name]/settings",
                            )}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 4c0-.64-.06-1.27-.18-1.89l2.03-1.58a1 1 0 00.24-1.32l-1.92-3.32a1 1 0 00-1.25-.45l-2.39.96a7.03 7.03 0 00-1.63-.95l-.36-2.53A1 1 0 0014 2h-4a1 1 0 00-1 .84l-.36 2.53c-.6.23-1.17.54-1.7.9l-2.39-.96a1 1 0 00-1.25.45l-1.92 3.32a1 1 0 00.24 1.32l2.03 1.58c-.12.62-.18 1.25-.18 1.89s.06 1.27.18 1.89l-2.03 1.58a1 1 0 00-.24 1.32l1.92 3.32a1 1 0 001.25.45l2.39-.96c.52.36 1.09.67 1.7.9l.36 2.53A1 1 0 0010 22h4a1 1 0 001-.84l.36-2.53c.6-.23 1.17-.54 1.7-.9l2.39.96a1 1 0 001.25-.45l1.92-3.32a1 1 0 00-.24-1.32l-2.03-1.58c.12-.62.18-1.25.18-1.89z"
                            />
                          </svg>
                          <span>{$_("admin.settings")}</span>
                        </button>
                        <button
                          aria-label={`Manage Configurations`}
                          onclick={() =>
                            handleMenuItemClick("/dashboard/admin/configs")}
                          class="menu-item submenu-item"
                        >
                          <svg
                            class="menu-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M11.983 13.983a2 2 0 100-4 2 2 0 000 4zM19.4 15a1.65 1.65 0 01.33 1.82l-.58 1a1.65 1.65 0 01-1.51.88h-1.12a6.66 6.66 0 01-1.3.76l-.17 1.12a1.65 1.65 0 01-.88 1.51l-1 .58a1.65 1.65 0 01-1.82-.33l-.8-.8a6.66 6.66 0 01-.76-1.3H7.4a1.65 1.65 0 01-1.51-.88l-.58-1a1.65 1.65 0 01.33-1.82l.8-.8a6.66 6.66 0 010-1.52l-.8-.8a1.65 1.65 0 01-.33-1.82l.58-1a1.65 1.65 0 011.51-.88h1.12c.23-.46.49-.89.76-1.3l-.17-1.12a1.65 1.65 0 01.88-1.51l1-.58a1.65 1.65 0 011.82.33l.8.8c.51-.13 1.03-.24 1.52-.24s1.01.11 1.52.24l.8-.8a1.65 1.65 0 011.82-.33l1 .58a1.65 1.65 0 01.88 1.51l-.17 1.12c.46.23.89.49 1.3.76h1.12a1.65 1.65 0 011.51.88l.58 1a1.65 1.65 0 01-.33 1.82l-.8.8c.13.51.24 1.03.24 1.52s-.11 1.01-.24 1.52l.8.8z"
                            />
                          </svg>
                          <span>{$_("DefaultRole")}</span>
                        </button>
                      </div>
                    </div>
                    <div class="menu-divider"></div>
                  {/if}

                  <!-- Main Navigation -->
                  <div class="menu-section">
                    <button
                      aria-label={`Chat & Messaging`}
                      onclick={() => handleMenuItemClick("/messaging")}
                      class="menu-item"
                    >
                      <svg
                        class="menu-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M7 8h10M7 12h6m-9 8l2-4h10a4 4 0 004-4V6a4 4 0 00-4-4H6a4 4 0 00-4 4v10a4 4 0 004 4z"
                        />
                      </svg>

                      <span>{$_("chat")}</span>
                    </button>

                    <button
                      aria-label={`Notifications`}
                      onclick={() => handleMenuItemClick("/notifications")}
                      class="menu-item"
                    >
                      <svg
                        class="menu-icon {renderNotificationIconColor()}"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                      <span>{$_("notifications")}</span>
                      {#if $newNotificationType}
                        <span class="notification-badge"></span>
                      {/if}
                    </button>
                    <button
                      aria-label={`My Profile`}
                      onclick={() => handleMenuItemClick("/me")}
                      class="menu-item"
                    >
                      <svg
                        class="menu-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>{$_("my_profile")}</span>
                    </button>
                  </div>

                  <div class="menu-divider"></div>

                  <!-- Settings & Actions -->
                  <div class="menu-section">
                    <div class="menu-item language-item">
                      <svg
                        class="menu-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                        />
                      </svg>
                      <label for="language-select"></label>
                      <select
                        aria-label={$_("language_select")}
                        bind:value={$locale}
                        onchange={(e) =>
                          switchLocale((e.target as HTMLSelectElement).value)}
                        class="language-select-dropdown"
                      >
                        <option value="en">{$_("english")}</option>
                        <option value="ar">{$_("arabic")}</option>
                        <option value="ku">{$_("kurdish")}</option>
                      </select>
                    </div>
                    <button
                      aria-label={`Logout`}
                      onclick={handleLogout}
                      class="menu-item logout-item"
                    >
                      <svg
                        class="menu-icon"
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
                      <span>{$_("sign_out")}</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Language selector for larger screens -->
          <div class="relative ml-2 hidden sm:block">
            <label for="language-select"></label>
            <select
              aria-label={$_("language_select")}
              bind:value={$locale}
              onchange={(e) =>
                switchLocale((e.target as HTMLSelectElement).value)}
              class="language-select"
            >
              <option value="en">EN</option>
              <option value="ar">AR</option>
              <option value="ku">KU</option>
            </select>
          </div>
        {:else}
          <div class="flex items-center space-x-3">
            <div class="relative">
              <label for="language-select"></label>
              <select
                aria-label={$_("language_select")}
                bind:value={$locale}
                onchange={(e) =>
                  switchLocale((e.target as HTMLSelectElement).value)}
                class="language-select"
              >
                <option value="en">EN</option>
                <option value="ar">AR</option>
                <option value="ku">KU</option>
              </select>
            </div>

            <button onclick={handleLogin} class="login-btn">
              {$_("Login")}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>

<style>
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--colors-border-border-base-medium, #e5e7eb);
  }
  .breadcrumbs-rtl {
    flex-direction: row-reverse;
  }

  .breadcrumb-link,
  .breadcrumb-current {
    font-family: var(--typography-font-family-font-base, inherit);
    font-weight: 500;
    display: flex;
    font-size: var(--typography-font-size-text-sm, 0.875rem);
    line-height: var(--typography-line-height-leading-5, 1.25rem);
    letter-spacing: 0%;
    color: var(--colors-text-text-body, #4a5565);
    white-space: nowrap;
  }

  .breadcrumb-link {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-link-rtl {
    flex-direction: row-reverse;
  }

  .breadcrumb-current {
    opacity: 0.9;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 32ch;
  }

  .breadcrumb-sep {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
  }

  /* Pill-shaped dropdown trigger (name + bell + hamburger) */
  .dropdown-trigger-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 1rem 0.5rem 1.25rem;
    border-radius: 9999px;
    background: #f3f4f6;
    border: 1px solid rgba(229, 231, 235, 0.8);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease;
    cursor: pointer;
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #374151;
    position: relative;
  }

  .dropdown-trigger-pill:hover {
    background: #e5e7eb;
    border-color: rgba(209, 213, 219, 0.9);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  }

  .dropdown-trigger-pill:active {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .menu-trigger[aria-expanded="true"].dropdown-trigger-pill {
    background: #e5e7eb;
    border-color: rgba(209, 213, 219, 0.95);
  }

  .dropdown-trigger-label {
    white-space: nowrap;
    font-family: inherit;
  }

  .dropdown-trigger-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dropdown-trigger-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #4b5563;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }

  .dropdown-trigger-pill:hover .dropdown-trigger-icon {
    color: #374151;
  }

  .dropdown-trigger-notification-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #ef4444;
    border: 2px solid #f3f4f6;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .nav-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.75rem;
    background: rgba(249, 250, 251, 0.8);
    border: 1px solid rgba(229, 231, 235, 0.6);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    backdrop-filter: blur(8px);
    cursor: pointer;
    text-decoration: none;
  }

  .nav-icon-btn:hover {
    background: rgba(243, 244, 246, 0.9);
    border-color: rgba(209, 213, 219, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .nav-icon-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .nav-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #6b7280;
    transition: color 0.2s ease;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    z-index: 50;
    min-width: 16rem;
    max-width: 20rem;
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
    background: white;
    border: 1px solid rgba(229, 231, 235, 0.8);
    border-radius: 1rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(16px);
    animation: dropdown-enter 0.2s ease-out;
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
  }

  .dropdown-menu::-webkit-scrollbar {
    width: 6px;
  }

  .dropdown-menu::-webkit-scrollbar-track {
    background: transparent;
  }

  .dropdown-menu::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  .dropdown-menu::-webkit-scrollbar-thumb:hover {
    background: rgba(107, 114, 128, 0.7);
  }

  @keyframes dropdown-enter {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dropdown-content {
    padding: 0.75rem;
  }

  .menu-section {
    margin-bottom: 0.5rem;
  }

  .menu-section:last-child {
    margin-bottom: 0;
  }

  .menu-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.5rem 0.75rem 0.25rem;
    margin-bottom: 0.25rem;
  }

  .menu-section-header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
    border: none;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.08),
      rgba(37, 99, 235, 0.05)
    );
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    color: #1e40af;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .menu-section-header:hover {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.12),
      rgba(37, 99, 235, 0.08)
    );
    transform: translateX(2px);
  }

  .section-icon {
    width: 1.25rem;
    height: 1.25rem;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .section-title {
    flex: 1;
    font-size: 0.875rem;
  }

  .chevron {
    width: 1.125rem;
    height: 1.125rem;
    transition: transform 0.2s ease;
  }

  .chevron-expanded {
    transform: rotate(180deg);
  }

  .admin-submenu {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
    padding-left: 0.5rem;
  }

  .admin-submenu-expanded {
    max-height: 600px;
  }

  .submenu-item {
    font-size: 0.8125rem;
    padding: 0.625rem 0.75rem;
    margin-bottom: 0.125rem;
  }

  .submenu-item .menu-icon {
    width: 1.125rem;
    height: 1.125rem;
    opacity: 0.8;
  }

  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem;
    border: none;
    background: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
  }

  .menu-item:hover {
    background: rgba(243, 244, 246, 0.8);
    color: #111827;
  }

  .menu-icon {
    width: 1.25rem;
    height: 1.25rem;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .menu-item span {
    flex: 1;
  }

  .logout-item:hover {
    background: rgba(254, 242, 242, 0.8);
    color: #dc2626;
  }

  .logout-item:hover .menu-icon {
    color: #dc2626;
  }

  .language-item {
    padding: 0.5rem 0.75rem;
  }

  .language-select-dropdown {
    appearance: none;
    background: transparent;
    border: none;
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    outline: none;
    flex: 1;
  }

  .menu-divider {
    height: 1px;
    background: rgba(229, 231, 235, 0.6);
    margin: 0.5rem 0;
  }

  .notification-badge {
    width: 0.5rem;
    height: 0.5rem;
    background: #ef4444;
    border-radius: 50%;
    margin-left: auto;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .login-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    background: #281f51;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px rgba(59, 130, 246, 0.25);
  }

  .login-btn:hover {
    background: #281f51;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
  }

  .login-btn:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .language-select {
    appearance: none;
    background: rgba(249, 250, 251, 0.8);
    border: 1px solid rgba(229, 231, 235, 0.6);
    border-radius: 0.75rem;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    color: #374151;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1rem 1rem;
    min-width: 4rem;
  }

  .language-select:hover {
    background-color: rgba(243, 244, 246, 0.9);
    border-color: rgba(209, 213, 219, 0.8);
  }

  .language-select:focus {
    outline: none;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.5);
    border-color: #3b82f6;
  }

  @media (max-width: 640px) {
    .dropdown-trigger-pill {
      padding: 0.4rem 0.75rem 0.4rem 1rem;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .dropdown-trigger-icon {
      width: 1.125rem;
      height: 1.125rem;
    }

    .nav-icon-btn {
      width: 2.5rem;
      height: 2.5rem;
    }

    .nav-icon {
      width: 1.125rem;
      height: 1.125rem;
    }

    .login-btn {
      padding: 0.625rem 1.25rem;
      font-size: 0.8rem;
    }

    .language-select {
      padding: 0.5rem 1.75rem 0.5rem 0.625rem;
      font-size: 0.8rem;
      min-width: 3.5rem;
    }

    .dropdown-menu {
      min-width: 14rem;
      right: -1rem;
    }
  }

  /* Animation for notification badge */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .dropdown-trigger-pill:focus {
    outline: none;
    box-shadow:
      0 0 0 2px white,
      0 0 0 4px rgba(59, 130, 246, 0.4);
  }

  .nav-icon-btn:focus {
    outline: none;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.5);
    ring-offset: 2px;
  }

  .login-btn:focus {
    outline: none;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.5);
    ring-offset: 2px;
  }

  .menu-item:focus {
    outline: none;
    background: rgba(59, 130, 246, 0.1);
    color: #1d4ed8;
  }
  .dropdown-menu-ltr {
    right: 0;
  }

  .dropdown-menu-rtl {
    left: 0;
  }
  @media (max-width: 640px) {
    .dropdown-menu-ltr {
      right: -1rem;
    }

    .dropdown-menu-rtl {
      left: -1rem;
    }
  }
</style>

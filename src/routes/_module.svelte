<script lang="ts">
  import "./global.css";
  import DashboardHeader from "@/components/DashboardHeader.svelte";
  import Sidebar from "@/components/sidebar/Sidebar.svelte";

  import { signout, roles, user } from "@/stores/user";
  import { onMount, onDestroy } from "svelte";
  import { getProfile } from "@/lib/dmart_services";
  import { menu } from "@/lib/menu";
  import { goto } from "@roxi/routify";
  import { Dmart } from "@edraj/tsdmart";
  import { website } from "@/config";
  import { filterMenuByRoles, toSidebarItems } from "@/lib/menuToSidebar";
  import type {
    SidebarItem as SidebarItemType,
    SidebarUser as SidebarUserType,
  } from "@/components/sidebar/Sidebar.svelte";
  import axios, { type AxiosInstance } from "axios";
  import {
    canAccessPath,
    isPublicRoute,
    getDefaultPathForRole,
  } from "@/lib/roleAccess";

  // ✅ seller folders -> sidebar links
  import { _ } from "@/i18n";
  import { createSellerFolders } from "@/lib/utils/sellerUtils";

  $goto;

  // -------------------------------
  // Route + UI state
  // -------------------------------
  let currentPath = "/";
  let activePath = "/";
  let isAuthed = false; // ✅ single source of truth for showing shell
  let showShell = false;

  const ICONS: Record<string, string> = {
    shoppingBag: `
   <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#281F51" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M14 7h-4v3a1 1 0 0 1-2 0V7H6a1 1 0 0 0-.997.923l-.917 11.924A2 2 0 0 0 6.08 22h11.84a2 2 0 0 0 1.994-2.153l-.917-11.924A1 1 0 0 0 18 7h-2v3a1 1 0 1 1-2 0V7Zm-2-3a2 2 0 0 0-2 2v1H8V6a4 4 0 0 1 8 0v1h-2V6a2 2 0 0 0-2-2Z" clip-rule="evenodd"/>
</svg>

  `,
    discount: `
   <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#281F51" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M12 2c-.791 0-1.55.314-2.11.874l-.893.893a.985.985 0 0 1-.696.288H7.04A2.984 2.984 0 0 0 4.055 7.04v1.262a.986.986 0 0 1-.288.696l-.893.893a2.984 2.984 0 0 0 0 4.22l.893.893a.985.985 0 0 1 .288.696v1.262a2.984 2.984 0 0 0 2.984 2.984h1.262c.261 0 .512.104.696.288l.893.893a2.984 2.984 0 0 0 4.22 0l.893-.893a.985.985 0 0 1 .696-.288h1.262a2.984 2.984 0 0 0 2.984-2.984V15.7c0-.261.104-.512.288-.696l.893-.893a2.984 2.984 0 0 0 0-4.22l-.893-.893a.985.985 0 0 1-.288-.696V7.04a2.984 2.984 0 0 0-2.984-2.984h-1.262a.985.985 0 0 1-.696-.288l-.893-.893A2.984 2.984 0 0 0 12 2Zm3.683 7.73a1 1 0 1 0-1.414-1.413l-4.253 4.253-1.277-1.277a1 1 0 0 0-1.415 1.414l1.985 1.984a1 1 0 0 0 1.414 0l4.96-4.96Z" clip-rule="evenodd"/>
</svg>

  `,
    orders: `
    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#281F51" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M8 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1h2a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2Zm6 1h-4v2H9a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2h-1V4Zm-3 8a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm-2-1a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2H9Zm2 5a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm-2-1a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2H9Z" clip-rule="evenodd"/>
</svg>

  `,
    coupons: `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#281F51" viewBox="0 0 24 24">
  <path d="M4 5a2 2 0 0 0-2 2v2.5a1 1 0 0 0 1 1 1.5 1.5 0 1 1 0 3 1 1 0 0 0-1 1V17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2.5a1 1 0 0 0-1-1 1.5 1.5 0 1 1 0-3 1 1 0 0 0 1-1V7a2 2 0 0 0-2-2H4Z"/>
</svg>

  `,
    warranties: `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#281F51" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M11.644 3.066a1 1 0 0 1 .712 0l7 2.666A1 1 0 0 1 20 6.68a17.694 17.694 0 0 1-2.023 7.98 17.406 17.406 0 0 1-5.402 6.158 1 1 0 0 1-1.15 0 17.405 17.405 0 0 1-5.403-6.157A17.695 17.695 0 0 1 4 6.68a1 1 0 0 1 .644-.949l7-2.666Zm4.014 7.187a1 1 0 0 0-1.316-1.506l-3.296 2.884-.839-.838a1 1 0 0 0-1.414 1.414l1.5 1.5a1 1 0 0 0 1.366.046l4-3.5Z" clip-rule="evenodd"/>
</svg>
 `,
    shipping: `<svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#281F51" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M4 4a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1h.535a3.5 3.5 0 1 0 6.93 0h3.07a3.5 3.5 0 1 0 6.93 0H21a1 1 0 0 0 1-1v-4a.999.999 0 0 0-.106-.447l-2-4A1 1 0 0 0 19 6h-5a2 2 0 0 0-2-2H4Zm14.192 11.59.016.02a1.5 1.5 0 1 1-.016-.021Zm-10 0 .016.02a1.5 1.5 0 1 1-.016-.021Zm5.806-5.572v-2.02h4.396l1 2.02h-5.396Z" clip-rule="evenodd"/>
</svg>
`,
  };
  function computeShell() {
    showShell = isAuthed && !isPublicRoute(currentPath);
  }

  function syncPath() {
    if (typeof window === "undefined") return;
    currentPath = window.location.pathname || "/";
    activePath = currentPath;
    computeShell();
  }

  function resolveIconHtml(icon: any): string {
    // If createSellerFolders already gives HTML, use it
    if (typeof icon === "string" && icon.trim().startsWith("<svg")) return icon;

    // If it gives a name like "ShoppingBagSolid" map it
    const key = String(icon || "").toLowerCase();

    console.log(key);
    // common aliases
    if (key.includes("shoppingbagsolid")) return ICONS.shoppingBag;
    if (key.includes("badgechecksolid")) return ICONS.discount;
    if (key.includes("clipboardlistsolid")) return ICONS.orders;
    if (key.includes("ticketsolid")) return ICONS.coupons;
    if (key.includes("shieldchecksolid")) return ICONS.warranties;
    if (key.includes("trucksolid")) return ICONS.shipping;

    // fallback
    return ICONS.folder;
  }
  // -------------------------------
  // Sidebar state
  // -------------------------------
  type SidebarUser = SidebarUserType;
  type SidebarItem = SidebarItemType;

  let sidebarUser: SidebarUser = { name: "User", role: "" };
  let sidebarItems: SidebarItem[] = [];

  let isSidebarOpen = true;
  let rtl = false;

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  function handleNavigate(path: string) {
    $goto(path);
  }

  async function handleLogout() {
    // ✅ Hide immediately (no waiting for navigation)
    isAuthed = false;
    computeShell();

    await signout();
    $goto("/login");
  }

  // -------------------------------
  // Seller sidebar items (name + icon + route)
  // -------------------------------
  function isSellerContextPath(path: string) {
    return path === "/seller" || path.startsWith("/seller/");
  }

  function hasSellerRole(r: any) {
    return Array.isArray(r) && r.includes("seller");
  }

  function buildSellerSidebarItems(): SidebarItem[] {
    const sellerShortname = $user?.shortname ?? "";
    const t = $_ || ((k: string) => k);
    const baseFolders = createSellerFolders(sellerShortname, t);

    return baseFolders.map((folder: any) => {
      const label = folder.attributes.displayname.en;

      const name = folder?.shortname || label; // unique key for {#each items as item (item.name)}
      const path = `/seller/${folder.shortname}`;

      return {
        name,
        label,
        path,
        icon: resolveIconHtml(folder?.icon),
      };
    });
  }
  // -------------------------------
  // Build sidebar items (menu OR seller folders)
  // -------------------------------
  $: {
    const sellerCtx = isSellerContextPath(currentPath) || hasSellerRole($roles);

    if (sellerCtx) {
      sidebarItems = buildSellerSidebarItems();
    } else {
      const filtered = filterMenuByRoles(menu, $roles);
      sidebarItems = toSidebarItems(filtered, (key) => key) as SidebarItem[];
    }
  }

  // -------------------------------
  // Axios + Auth Setup
  // -------------------------------
  const dmartAxios: AxiosInstance = axios.create({
    baseURL: website.backend,
    withCredentials: true,
    timeout: 30000,
  });

  dmartAxios.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.code === "ERR_NETWORK") {
        console.warn("Network error: Check connection or server.");
      }

      if (error.response?.status === 401 && !isPublicRoute(currentPath)) {
        // ✅ Hide immediately on auth failure
        isAuthed = false;
        computeShell();

        $goto("/login");
      }

      return Promise.reject(error);
    },
  );

  Dmart.setAxiosInstance(dmartAxios);
  Dmart.setToken(localStorage.getItem("authToken") || "");

  function buildSidebarUser(p: any, userRoles: any): SidebarUser {
    const name = p?.name ?? p?.attributes?.name ?? p?.data?.name ?? "User";
    const role = (Array.isArray(userRoles) && userRoles[0]) ?? p?.role ?? "";
    const avatarUrl =
      p?.avatarUrl ?? p?.avatar_url ?? p?.attributes?.avatar_url ?? undefined;

    return { name, role, avatarUrl };
  }

  // -------------------------------
  // Auth check (callable on demand)
  // -------------------------------
  let checking = false;

  async function ensureAuthed() {
    if (checking) return;
    checking = true;

    try {
      const p = await getProfile();

      const isAuthError =
        !p ||
        p === null ||
        p?.error?.type === "jwtauth" ||
        p?.response?.data?.error?.type === "jwtauth" ||
        p?.data?.error?.type === "jwtauth";

      if (isAuthError) {
        isAuthed = false;
        computeShell();

        await signout();
        $goto("/login");
        return;
      }

      // ✅ authenticated
      isAuthed = true;
      computeShell();

      let userRoles = p?.roles || p?.attributes?.roles;

      if (userRoles && Array.isArray(userRoles)) {
        roles.set(userRoles);
        localStorage.setItem("roles", JSON.stringify(userRoles));
      } else {
        const storedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
        if (storedRoles.length > 0) {
          roles.set(storedRoles);
          userRoles = storedRoles;
        }
      }

      sidebarUser = buildSidebarUser(p, userRoles);

      // role-based access
      if (userRoles && userRoles.length > 0) {
        const hasAccess = canAccessPath(userRoles, currentPath);
        if (!hasAccess) {
          const defaultPath = getDefaultPathForRole(userRoles);
          $goto(defaultPath);
          return;
        }
      }

      // optional redirect
      if (currentPath === "/" || currentPath === "/login") {
        const defaultPath =
          userRoles && userRoles.length > 0
            ? getDefaultPathForRole(userRoles)
            : "/dashboard";
        $goto(defaultPath);
      }
    } catch (error: any) {
      console.error("Authentication check failed:", error);

      isAuthed = false;
      computeShell();

      await signout();
      $goto("/login");
    } finally {
      checking = false;
    }
  }

  // -------------------------------
  // Mount: reactive path sync + auto auth on protected routes
  // -------------------------------
  let stop = false;

  onMount(() => {
    syncPath();

    const timer = window.setInterval(async () => {
      if (stop) return;

      const prev = currentPath;
      syncPath();

      if (prev !== currentPath && !isPublicRoute(currentPath) && !isAuthed) {
        await ensureAuthed();
      }
    }, 100);

    if (!isPublicRoute(currentPath)) {
      ensureAuthed();
    } else {
      isAuthed = false;
      computeShell();
    }

    return () => window.clearInterval(timer);
  });

  onDestroy(() => {
    stop = true;
  });
</script>

{#if showShell}
  <div
    class="dashboardShell"
    class:rtl
    style="--sidebar-w: {isSidebarOpen ? '288px' : '72px'};"
  >
    <Sidebar
      user={sidebarUser}
      items={sidebarItems}
      {activePath}
      isOpen={isSidebarOpen}
      {rtl}
      onToggle={toggleSidebar}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    />

    <main class="dashboardMain">
      <DashboardHeader />
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}

<style>
  .dashboardShell {
    min-height: 100vh;
    display: flex;
    background: var(--app-bg, #f7f7fb);
  }

  .dashboardMain {
    min-height: 100vh;
    padding-left: 16px;
    padding-bottom: 16px;
    padding-right: 16px;
    width: calc(100% - var(--sidebar-w));
    box-sizing: border-box;

    transition:
      margin-left 160ms ease,
      width 160ms ease;
  }

  .dashboardShell.rtl .dashboardMain {
    margin-left: 0;
    margin-right: var(--sidebar-w);
    width: calc(100% - var(--sidebar-w));

    transition:
      margin-right 160ms ease,
      width 160ms ease;
  }
</style>

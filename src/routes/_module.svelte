<script lang="ts">
  import "./global.css";
  import DashboardHeader from "@/components/DashboardHeader.svelte";
  import Sidebar from "@/components/sidebar/Sidebar.svelte";

  import { signout, roles } from "@/stores/user";
  import { onMount, onDestroy } from "svelte";
  import { getProfile } from "@/lib/dmart_services";
  import { menu } from "@/lib/menu";
  import { goto } from "@roxi/routify";
  import { Dmart } from "@edraj/tsdmart";
  import { website } from "@/config";
  import { filterMenuByRoles, toSidebarItems } from "@/lib/menuToSidebar";
  import type { SidebarItem as SidebarItemType, SidebarUser as SidebarUserType } from "@/components/sidebar/Sidebar.svelte";
  import axios, { type AxiosInstance } from "axios";
  import {
    canAccessPath,
    isPublicRoute,
    getDefaultPathForRole,
  } from "@/lib/roleAccess";

  $goto;

  // -------------------------------
  // Route + UI state
  // -------------------------------
  let currentPath = "/";
  let activePath = "/";
  let isAuthed = false; // ✅ single source of truth for showing shell
  let showShell = false;

  function computeShell() {
    showShell = isAuthed && !isPublicRoute(currentPath);
  }

  function syncPath() {
    if (typeof window === "undefined") return;
    currentPath = window.location.pathname || "/";
    activePath = currentPath;
    computeShell();
  }

  // -------------------------------
  // Sidebar state
  // -------------------------------
  // ✅ IMPORTANT: use Sidebar's exported types to avoid type mismatch
type SidebarUser = SidebarUserType;
type SidebarItem = SidebarItemType;

  let sidebarUser: SidebarUser = { name: "User", role: "" };
  let sidebarItems: SidebarItem[] = [];

  // ✅ build sidebar items from menu + roles
  $: {
    const filtered = filterMenuByRoles(menu, $roles);
    sidebarItems = toSidebarItems(filtered, (key) => key) as SidebarItem[];
  }

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
      activePath={activePath}
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

    transition: margin-left 160ms ease, width 160ms ease;
  }

  .dashboardShell.rtl .dashboardMain {
    margin-left: 0;
    margin-right: var(--sidebar-w);
    /* ✅ same idea for RTL */
    width: calc(100% - var(--sidebar-w));

    transition: margin-right 160ms ease, width 160ms ease;
  }
</style>

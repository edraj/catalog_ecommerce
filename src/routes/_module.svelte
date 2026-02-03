<script lang="ts">
  import "./global.css";
  import DashboardHeader from "@/components/DashboardHeader.svelte";
  import { signout, roles } from "@/stores/user";
  import { onMount } from "svelte";
  import { getProfile } from "@/lib/dmart_services";
  import { goto } from "@roxi/routify";
  import { Dmart } from "@edraj/tsdmart";
  import { website } from "@/config";
  import axios, { type AxiosInstance } from "axios";
  import {
    canAccessPath,
    isPublicRoute,
    getDefaultPathForRole,
  } from "@/lib/roleAccess";

  $goto;

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
      if (
        error.response?.status === 401 &&
        !isPublicRoute(window.location.pathname)
      ) {
        $goto("/login");
      }
      return Promise.reject(error);
    },
  );

  Dmart.setAxiosInstance(dmartAxios);
  Dmart.setToken(localStorage.getItem("authToken") || "");

  onMount(async () => {
    const currentPath = window.location.pathname;

    if (isPublicRoute(currentPath)) {
      return;
    }

    try {
      const p = await getProfile();
      const isAuthError =
        !p ||
        p === null ||
        p?.error?.type === "jwtauth" ||
        p?.response?.data?.error?.type === "jwtauth" ||
        p?.data?.error?.type === "jwtauth";

      if (isAuthError) {
        await signout();
        $goto("/login");
      } else {
        let userRoles = p?.roles || p?.attributes?.roles;

        if (userRoles && Array.isArray(userRoles)) {
          roles.set(userRoles);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("roles", JSON.stringify(userRoles));
          }
        } else if (typeof localStorage !== "undefined") {
          const storedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
          if (storedRoles.length > 0) {
            roles.set(storedRoles);
            userRoles = storedRoles;
          }
        }

        // Check role-based access control
        if (userRoles && userRoles.length > 0) {
          const hasAccess = canAccessPath(userRoles, currentPath);

          if (!hasAccess) {
            // Redirect to appropriate default page for user's role
            const defaultPath = getDefaultPathForRole(userRoles);
            console.warn(
              `Access denied to ${currentPath}. Redirecting to ${defaultPath}`,
            );
            $goto(defaultPath);
            return;
          }
        }

        if (currentPath === "/" || currentPath === "/login") {
          // Redirect to role-based default page
          const defaultPath =
            userRoles && userRoles.length > 0
              ? getDefaultPathForRole(userRoles)
              : "/dashboard";
          $goto(defaultPath);
        }
      }
    } catch (error) {
      console.error("Authentication check failed:", error);

      if (error.response?.status === 401 || error.status === 401) {
        await signout();
        $goto("/login");
      } else {
        console.warn("Non-auth error during profile check:", error);
        await signout();
        $goto("/login");
      }
    }
  });
</script>

<DashboardHeader />
<slot />

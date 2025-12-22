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

  $goto;

  const publicRoutes = [
    "/register",
    "/contact",
    "/home",
    "/",
    { path: "/catalogs", wildcard: true },
  ];

  function isPublicRoute(path) {
    return publicRoutes.some((route) => {
      if (typeof route === "string") {
        return path === route;
      }
      if (route.wildcard) {
        return path.startsWith(route.path);
      }
      return path === route.path;
    });
  }

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
    }
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
        console.log("Authentication failed, redirecting to login");
        await signout();
        $goto("/login");
      } else {
        let userRoles = p?.roles || p?.attributes?.roles;
        console.log("Profile response:", p);
        console.log("Roles from profile:", userRoles);

        if (userRoles && Array.isArray(userRoles)) {
          console.log("Setting roles from profile:", userRoles);
          roles.set(userRoles);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("roles", JSON.stringify(userRoles));
          }
        } else if (typeof localStorage !== "undefined") {
          const storedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
          console.log("Setting roles from localStorage:", storedRoles);
          if (storedRoles.length > 0) {
            roles.set(storedRoles);
          }
        }

        if (currentPath === "/" || currentPath === "/login") {
          $goto("/dashboard");
        }
      }
    } catch (error) {
      console.error("Authentication check failed:", error);

      if (error.response?.status === 401 || error.status === 401) {
        console.log("401 error - redirecting to login");
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

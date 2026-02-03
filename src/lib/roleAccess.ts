/**
 * Role-based access control utilities
 * Defines access rules for different user roles
 */

export interface RoleAccessRule {
  role: string;
  allowedPaths: string[];
  isFullAccess?: boolean;
}

/**
 * Define access rules for each role
 * - zm_seller: access only to /seller/* pages
 * - zm_admin: access only to /dashboard/admin/zainmart/* pages
 * - super_admin: full access to all pages
 */
export const ROLE_ACCESS_RULES: RoleAccessRule[] = [
  {
    role: "super_admin",
    allowedPaths: [],
    isFullAccess: true,
  },
  {
    role: "zm_admin",
    allowedPaths: ["/dashboard/admin/zainmart"],
  },
  {
    role: "zm_seller",
    allowedPaths: ["/seller"],
  },
];

/**
 * Check if a user with given roles can access a specific path
 * @param userRoles - Array of user roles
 * @param path - The path to check access for
 * @returns true if user has access, false otherwise
 */
export function canAccessPath(userRoles: string[], path: string): boolean {
  // No roles means no access to protected routes
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  // Check if user has super_admin role (full access)
  if (userRoles.includes("super_admin")) {
    return true;
  }

  // Check access rules for each user role
  for (const userRole of userRoles) {
    const rule = ROLE_ACCESS_RULES.find((r) => r.role === userRole);

    if (rule) {
      // If role has full access
      if (rule.isFullAccess) {
        return true;
      }

      // Check if path matches any allowed path pattern
      for (const allowedPath of rule.allowedPaths) {
        if (path.startsWith(allowedPath)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get the default landing page for a user based on their roles
 * @param userRoles - Array of user roles
 * @returns The default path for the user
 */
export function getDefaultPathForRole(userRoles: string[]): string {
  if (!userRoles || userRoles.length === 0) {
    return "/login";
  }

  // Super admin goes to dashboard
  if (userRoles.includes("super_admin")) {
    return "/dashboard/admin";
  }

  // zm_admin goes to their admin section
  if (userRoles.includes("zm_admin")) {
    return "/dashboard/admin/zainmart";
  }

  // zm_seller goes to seller pages
  if (userRoles.includes("zm_seller")) {
    return "/seller";
  }

  // Default fallback
  return "/dashboard";
}

/**
 * Check if the current path is accessible without authentication
 * @param path - The path to check
 * @returns true if path is public, false otherwise
 */
export function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    "/register",
    "/contact",
    "/home",
    "/",
    "/login",
    "/privacy",
    "/help",
    "/community",
    "/unauthorized",
  ];

  // Check exact matches
  if (publicRoutes.includes(path)) {
    return true;
  }

  // Check wildcard routes
  if (path.startsWith("/catalogs")) {
    return true;
  }

  return false;
}

import type { MenuNode } from "./menu";

export type SidebarItem = {
  name: string;
  label: string;
  icon?: string;
  path?: string;
  children?: SidebarItem[];
};

/* ---------------------------------- */
/* Role checking */
/* ---------------------------------- */

export function hasAnyRole(userRoles: string[], required?: string[]) {
  if (!required || required.length === 0) return true;
  return required.some((r) => userRoles.includes(r));
}

/* ---------------------------------- */
/* Recursive filter by roles */
/* ---------------------------------- */

export function filterMenuByRoles(
  menu: MenuNode[],
  userRoles: string[],
): MenuNode[] {
  return menu
    .filter((node) => hasAnyRole(userRoles, node.rolesAny))
    .map((node) => {
      if (!node.children) return node;

      const filteredChildren = filterMenuByRoles(node.children, userRoles);

      return {
        ...node,
        children: filteredChildren,
      };
    })
    .filter(
      (node) =>
        node.path || (node.children && node.children.length > 0),
    );
}

/* ---------------------------------- */
/* Recursive Menu → Sidebar mapping */
/* ---------------------------------- */

export function toSidebarItems(
  menu: MenuNode[],
  t: (key: string) => string,
): SidebarItem[] {
  return menu.map((node) => {
    const item: SidebarItem = {
      name: node.key,
      label: t(node.labelKey),
      icon: node.icon,
      path: node.path,
    };

    if (node.children && node.children.length > 0) {
      const children = toSidebarItems(node.children, t);

      if (children.length > 0) {
        item.children = children;
        delete item.path; // parent becomes collapsible
      }
    }

    return item;
  });
}

export type Role = string;

export type MenuNode = {
  key: string;                 // stable id
  labelKey: string;            // i18n key, like "chat" or "admin.settings"
  path?: string;               // if leaf
  icon?: string;               // optional html or empty
  rolesAny?: Role[];           // show if user has ANY of these roles
  children?: MenuNode[];       // collapsible section
  dividerAfter?: boolean;      // optional
};

export const menu: MenuNode[] = [
  {
    key: "admin",
    labelKey: "Overview",
    rolesAny: ["super_admin", "zm_admin"],
    children: [
      { key: "admin_dashboard", labelKey: "Dashboard", path: "/dashboard/admin" },
      { key: "contact_messages", labelKey: "Contact messages", path: "/dashboard/admin/contact-messages" },
      { key: "permissions", labelKey: "Permission", path: "/dashboard/permissions" },
      { key: "roles", labelKey: "Roles", path: "/dashboard/roles" },
      { key: "users", labelKey: "Users", path: "/dashboard/admin/users" },
      { key: "sellers", labelKey: "Sellers", path: "/dashboard/admin/sellers" },
      { key: "variation_requests", labelKey: "Variation requests", path: "/dashboard/admin/variation_requests" },
      { key: "admin_services", labelKey: "Admin services title", path: "/dashboard/admin/[space_name]/service" },
      { key: "admin_settings", labelKey: "Admin settings", path: "/dashboard/admin/[space_name]/settings" },
      { key: "configs", labelKey: "DefaultRole", path: "/dashboard/admin/configs" },
    ],
    icon:'<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M10.8398 1.68503C10.9533 1.67707 11.102 1.66663 11.25 1.66663C13.1286 1.66663 14.9303 2.4129 16.2587 3.74129C17.5871 5.06967 18.3333 6.87134 18.3333 8.74996C18.3333 8.89798 18.3229 9.04669 18.3149 9.16014C18.3134 9.18207 18.3119 9.20269 18.3107 9.22173C18.2817 9.65961 17.918 9.99996 17.4792 9.99996H10.8333C10.3731 9.99996 10 9.62686 10 9.16663V2.52079C10 2.08194 10.3403 1.7183 10.7782 1.68928C10.7973 1.68802 10.8179 1.68657 10.8398 1.68503ZM11.6667 3.34933V8.33329H16.6506C16.5516 7.04914 15.9973 5.83695 15.0802 4.9198C14.163 4.00264 12.9508 3.44835 11.6667 3.34933ZM8.90297 4.41255C9.0712 4.57011 9.16666 4.7903 9.16666 5.02079V10.8333H14.9792C15.2097 10.8333 15.4298 10.9288 15.5874 11.097C15.745 11.2652 15.8258 11.4912 15.8107 11.7212C15.7216 13.0797 15.2428 14.3838 14.4317 15.4772C13.6206 16.5707 12.5116 17.4073 11.2374 17.8868C9.96322 18.3663 8.57783 18.4685 7.24707 18.181C5.91631 17.8936 4.69659 17.2287 3.7339 16.2661C2.77122 15.3034 2.10636 14.0836 1.81892 12.7529C1.53147 11.4221 1.63363 10.0367 2.11315 8.76253C2.59267 7.48833 3.42924 6.37931 4.52271 5.56823C5.61619 4.75716 6.92024 4.27839 8.27876 4.18925C8.50876 4.17416 8.73473 4.255 8.90297 4.41255ZM7.5 5.98516C6.78576 6.1535 6.11001 6.46598 5.51562 6.90686C4.67943 7.52709 4.0397 8.37516 3.67301 9.34955C3.30632 10.3239 3.2282 11.3834 3.44801 12.401C3.66782 13.4186 4.17624 14.3514 4.91241 15.0875C5.64859 15.8237 6.58132 16.3321 7.59895 16.5519C8.61659 16.7718 9.67601 16.6936 10.6504 16.3269C11.6248 15.9602 12.4729 15.3205 13.0931 14.4843C13.534 13.8899 13.8465 13.2142 14.0148 12.5H8.33333C7.87309 12.5 7.5 12.1269 7.5 11.6666V5.98516Z" fill="#4A5565"/></svg>',
    dividerAfter: true,
  },
   { key: "me", labelKey: "Account", path: "/me", dividerAfter: true, icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.08334 2.15478C7.3959 1.84222 7.81983 1.66663 8.26185 1.66663H15C15.9205 1.66663 16.6667 2.41282 16.6667 3.33329V16.6666C16.6667 17.5871 15.9205 18.3333 15 18.3333H5.00001C4.07954 18.3333 3.33334 17.5871 3.33334 16.6666V6.59514C3.33334 6.15311 3.50894 5.72919 3.8215 5.41663L7.08334 2.15478ZM5.00001 7.49996V16.6666H15V3.33329H9.16668V5.83329C9.16668 6.75377 8.42048 7.49996 7.50001 7.49996H5.00001ZM7.50001 4.09514V5.83329H5.76185L7.50001 4.09514ZM6.66668 9.99996C6.66668 9.53972 7.03977 9.16663 7.50001 9.16663H12.5C12.9602 9.16663 13.3333 9.53972 13.3333 9.99996C13.3333 10.4602 12.9602 10.8333 12.5 10.8333H7.50001C7.03977 10.8333 6.66668 10.4602 6.66668 9.99996ZM6.66668 13.3333C6.66668 12.8731 7.03977 12.5 7.50001 12.5H12.5C12.9602 12.5 13.3333 12.8731 13.3333 13.3333C13.3333 13.7935 12.9602 14.1666 12.5 14.1666H7.50001C7.03977 14.1666 6.66668 13.7935 6.66668 13.3333Z" fill="#4A5565"/></svg>' },
  { key: "messaging", labelKey: "Chat", path: "/messaging" },
  { key: "notifications", labelKey: "Notifications", path: "/notifications" },
 
];

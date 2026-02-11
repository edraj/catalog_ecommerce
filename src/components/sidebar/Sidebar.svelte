<script context="module" lang="ts">
  export type SidebarUser = {
    name: string;
    role: string;
    avatarUrl?: string;
  };

  export type SidebarItem = {
    name: string;
    label: string;
    icon?: string; // html string or empty
    path: string;

    // ✅ new
    children?: SidebarItem[];
  };
</script>

<script lang="ts">
  export let user: SidebarUser;
  export let items: SidebarItem[] = [];
  export let activePath = "";
  export let isOpen = true;
  export let rtl = false;

  export let onToggle: () => void;
  export let onNavigate: (path: string) => void;
  export let onLogout: () => void;

  // ✅ which groups are expanded
  let openGroups = new Set<string>();

  const norm = (p?: string) => (p || "/").replace(/\/+$/, "") || "/";
  const isActive = (p?: string) => !!p && norm(activePath) === norm(p);

  const hasChildren = (item: SidebarItem) => !!(item.children && item.children.length);

  const isItemOrChildActive = (item: SidebarItem): boolean => {
    if (isActive(item.path)) return true;
    if (!hasChildren(item)) return false;
    return item.children!.some((c) => isItemOrChildActive(c));
  };
  const toggleGroup = (key: string) => {
    const next = new Set(openGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    openGroups = next;
  };

  const groupKey = (item: SidebarItem) => item.name || item.path;

  // ✅ auto expand group when a child becomes active
  $: {
    const next = new Set(openGroups);
    for (const it of items) {
      if (hasChildren(it) && isItemOrChildActive(it)) next.add(groupKey(it));
    }
    openGroups = next;
  }
</script>

<aside class="sidebar {isOpen ? 'open' : 'closed'}" class:rtl>
  <!-- User header -->
  <div class="user">
    <div class="userLeft">
      <img class="avatar" src={user.avatarUrl || "https://placehold.co/64x64"} alt="User avatar" />
      <div class="userText">
        <div class="username">{user.name}</div>
        <div class="role">{user.role}</div>
      </div>
    </div>

    <button type="button" class="toggle" on:click={onToggle} aria-label="Toggle sidebar">
      <span class="toggleIcon" aria-hidden="true"></span>
    </button>
  </div>

  <!-- Nav -->
  <nav class="nav" aria-label="Sidebar navigation">
  {#each items as item (item.name)}
    {@const collapsible = !!(item.children && item.children.length)}
    {@const key = item.name}
    {@const expanded = collapsible && openGroups.has(key)}

    <div class="group">
      <button
        type="button"
        class="item"
        class:rtl
        class:collapsible={collapsible}
        class:active={isItemOrChildActive(item)}
        aria-expanded={collapsible ? expanded : undefined}
        on:click={() => {
          if (collapsible) toggleGroup(key);
          else if (item.path) onNavigate(item.path);
        }}
      >
        <span class="left">
          <span class="icon" aria-hidden="true">
            {@html item.icon || ""}
          </span>
          <span class="label">{item.label}</span>
        </span>

        {#if collapsible}
          <span class="chev" class:open={expanded} aria-hidden="true">
            <svg width="11" height="6" viewBox="0 0 11 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M4.86193 5.80474C5.12228 6.06509 5.54439 6.06509 5.80474 5.80474L10.4714 1.13807C10.7318 0.877722 10.7318 0.455611 10.4714 0.195262C10.2111 -0.0650878 9.78895 -0.0650878 9.5286 0.195262L5.33333 4.39052L1.13807 0.195262C0.877722 -0.0650878 0.455612 -0.0650878 0.195262 0.195262C-0.0650874 0.455611 -0.0650874 0.877722 0.195262 1.13807L4.86193 5.80474Z"
                fill="#4A5565"
              />
            </svg>
          </span>
        {/if}
      </button>

      {#if collapsible && expanded && isOpen}
        <div class="children" class:rtl>
          {#each item.children as child (child.name)}
            <button
              type="button"
              class="child"
              class:rtl
              class:active={isActive(child.path)} 
              on:click={() => child.path && onNavigate(child.path)}
            >
              <span class="dot" aria-hidden="true"></span>
              <span class="label">{child.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</nav>


  <!-- Logout -->
  <div class="footer">
    <button type="button" class="logout" class:rtl on:click={onLogout}>
      <span class="icon" aria-hidden="true"></span>
      <span class="label">Logout</span>
    </button>
  </div>
</aside>

<style>
  /* ===== Sidebar shell (your desired layout) ===== */
  .sidebar {
    top: 0;
    min-height: 100vh;
    height: 100%;
    width: 288px;

    background: var(--colors-background-bg-primary-soft, #fff);
    border: 1px solid var(--colors-border-border-base, #e5e7eb);
    border-radius: var(--border-radius-rounded-lg, 16px);
    box-shadow: 0px 1px 0.5px 0.05px #1d293d05;

    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 40;

    padding: var(--spacing-5, 20px);
    gap: 20px;
    box-sizing: border-box;
  }

  .sidebar.rtl {
    left: auto;
    right: 20px;
  }

  .sidebar.closed {
    width: 84px;
    padding: 16px;
  }

  /* ===== User card ===== */
  .user {
    width: 100%;
    border-radius: var(--border-radius-rounded-base, 12px);
    display: flex;
    justify-content: space-between;
    align-items: center;

    padding: 18px;
    border-bottom: 1px solid var(--colors-border-border-base, #e5e7eb);
    box-sizing: border-box;
    gap: 10px;
  }

  .userLeft {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--border-radius-rounded, 999px);
    object-fit: cover;
    flex-shrink: 0;
  }

  .userText {
    min-width: 0;
  }

  .username {
    font-family: var(--font-base, system-ui);
    font-weight: 500;
    font-size: var(--text-base, 16px);
    line-height: 16px;
    color: var(--colors-text-text-heading, #101828);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .role {
    font-family: var(--font-base, system-ui);
    font-weight: 400;
    font-size: var(--text-sm, 14px);
    line-height: 14px;
    color: var(--colors-text-text-body, #4a5565);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toggle {
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .toggle:hover {
    background: rgba(16, 24, 40, 0.04);
  }

  /* ===== Nav area ===== */
  .nav {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 2px;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ===== Items ===== */
  .item {
    width: 100%;
    height: 44px;
    border-radius: var(--border-radius-rounded-base, 12px);
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 10px 12px;
    border: 0;
    background: transparent;
    cursor: pointer;
    box-sizing: border-box;
    text-align: left;
    gap: 10px;
  }

  .item.rtl {
    text-align: right;
    flex-direction: row-reverse;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .label {
    font-family: var(--font-base, system-ui);
    font-weight: 500;
    font-size: var(--text-base, 16px);
    line-height: var(--leading-6, 24px);
    color: var(--colors-text-text-body, #4a5565);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .item:hover {
    background: #f7f8fa;
  }

  .item.active {
    background: #f4f5fe;
  }

  /* ===== Chevron for collapsible ===== */
  .chev {
    width: 22px;
    height: 22px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 160ms ease;
  }

  .chev.open {
    transform: rotate(180deg);
  }

  /* ===== Children ===== */
  .children {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 34px;
  }

  .children.rtl {
    padding-left: 0;
    padding-right: 34px;
  }

  .child {
    width: 100%;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;

    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 8px 10px;
    text-align: left;
    box-sizing: border-box;
  }

  .child.rtl {
    text-align: right;
    flex-direction: row-reverse;
  }

  .child:hover {
    background: #f7f8fa;
  }

  .child.active {
    background: #f4f5fe;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #cbd5e1;
    flex-shrink: 0;
  }

  .child.active .dot {
    background: #3c307f;
  }

  /* ===== Footer ===== */
  .footer {
    border-top: 1px solid var(--colors-border-border-base, #e5e7eb);
    padding-top: 10px;
  }

  .logout {
    width: 100%;
    height: 44px;
    border-radius: var(--border-radius-rounded-base, 12px);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;

    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
    color: var(--colors-text-text-fg-danger, #c70036);

    font-family: var(--font-base, system-ui);
    font-weight: 500;
    font-size: var(--text-base, 16px);
    line-height: var(--leading-6, 24px);
    box-sizing: border-box;
  }

  .logout.rtl {
    text-align: right;
    flex-direction: row-reverse;
  }

  .logout:hover {
    background: rgba(199, 0, 54, 0.06);
  }

  /* ===== Closed mode behavior ===== */
  .sidebar.closed .label,
  .sidebar.closed .userText,
  .sidebar.closed .chev,
  .sidebar.closed .children {
    display: none;
  }

  .sidebar.closed .item,
  .sidebar.closed .logout {
    justify-content: center;
    padding: 10px;
  }

  .sidebar.closed .left {
    justify-content: center;
  }
</style>

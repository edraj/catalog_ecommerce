<script lang="ts">
  import { onMount } from "svelte";
  import {
    getAllUsers,
    filterUserByRole,
    getSpaceContents,
    updateUserRoles,
    updateEntity,
    createSeller,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import { _, locale } from "@/i18n";
  import { formatNumber } from "@/lib/helpers";
  import { derived } from "svelte/store";
  import { ResourceType } from "@edraj/tsdmart";

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku",
  );

  let users = $state([]);
  let availableRoles = $state([]);
  let isLoading = $state(true);
  let isUpdating = $state(false);
  let selectedUser = $state(null);
  let showRoleModal = $state(false);
  let selectedRoles = $state([]);
  let searchTerm = $state("");
  let filteredUsers = $state([]);
  let selectedRoleFilter = $state("");
  let roleSearchTerm = $state("");
  let filteredRoles = $state([]);
  let showAddUserModal = $state(false);
  let isCreatingUser = $state(false);
  let addUserForm = $state({
    displayname: "",
    email: "",
    password: "",
    confirmPassword: "",
    roles: [] as string[],
  });
  let addUserErrors = $state({
    displayname: "",
    email: "",
    password: "",
    confirmPassword: "",
    roles: "",
    submit: "",
  });

  let showConfirmModal = $state(false);
  let confirmAction = $state(null);
  let confirmUser = $state(null);
  let confirmMessage = $state("");
  let confirmTitle = $state("");
  let isConfirmDanger = $state(false);

  let currentPage = $state(1);
  let itemsPerPage = $state(20);
  let totalUsers = $state(0);
  let totalPages = $state(0);

  async function loadUsers() {
    try {
      isLoading = true;
      let usersResponse;

      if (selectedRoleFilter) {
        usersResponse = await filterUserByRole(
          selectedRoleFilter,
          itemsPerPage,
          (currentPage - 1) * itemsPerPage,
        );
      } else {
        usersResponse = await getAllUsers(
          itemsPerPage,
          (currentPage - 1) * itemsPerPage,
        );
      }

      if (usersResponse && usersResponse.status === "success") {
        users = usersResponse.records.map((user) => ({
          shortname: user.shortname,
          displayname: user.attributes?.displayname?.en || user.shortname,
          email: user.attributes?.email || "N/A",
          roles: user.attributes?.roles || [],
          is_active: user.attributes?.is_active ?? true,
          created_at: user.attributes?.created_at || "N/A",
        }));

        totalUsers = usersResponse.attributes?.total || users.length;
        totalPages = Math.ceil(totalUsers / itemsPerPage);

        updateFilteredUsers();
      } else {
        errorToastMessage($_("failed_to_load_users"));
      }
    } catch (error) {
      console.error("Error loading users:", error);
      errorToastMessage($_("failed_to_load_users"));
    } finally {
      isLoading = false;
    }
  }

  async function loadRoles() {
    try {
      const rolesResponse = await getSpaceContents(
        "management",
        "roles",
        "managed",
      );

      if (rolesResponse.status === "success") {
        availableRoles = rolesResponse.records.map((role) => ({
          shortname: role.shortname,
          displayname: role.attributes?.displayname?.en || role.shortname,
          description:
            role.attributes?.description?.en || `Role: ${role.shortname}`,
        }));
      } else {
        errorToastMessage($_("failed_to_load_roles"));
      }
    } catch (error) {
      console.error("Error loading roles:", error);
      errorToastMessage($_("failed_to_load_roles"));
    }
  }

  function updateFilteredUsers() {
    let filtered = users;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.shortname.toLowerCase().includes(term) ||
          user.displayname.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          user.roles.some((role) => role.toLowerCase().includes(term)),
      );
    }

    filteredUsers = filtered;
  }

  function openRoleModal(user) {
    selectedUser = user;
    selectedRoles = [...user.roles];
    roleSearchTerm = ""; // Reset search when opening modal
    filteredRoles = availableRoles; // Initialize filtered roles
    showRoleModal = true;
  }

  function closeRoleModal() {
    selectedUser = null;
    selectedRoles = [];
    roleSearchTerm = "";
    filteredRoles = [];
    showRoleModal = false;
  }

  function toggleRole(roleShortname) {
    const index = selectedRoles.indexOf(roleShortname);
    if (index > -1) {
      selectedRoles = selectedRoles.filter((r) => r !== roleShortname);
    } else {
      selectedRoles = [...selectedRoles, roleShortname];
    }
  }

  function filterAvailableRoles() {
    if (!roleSearchTerm.trim()) {
      filteredRoles = availableRoles;
      return;
    }

    const term = roleSearchTerm.toLowerCase();
    filteredRoles = availableRoles.filter(
      (role) =>
        role.shortname.toLowerCase().includes(term) ||
        role.displayname.toLowerCase().includes(term) ||
        role.description.toLowerCase().includes(term),
    );
  }

  async function saveUserRoles() {
    if (!selectedUser) return;

    isUpdating = true;
    try {
      const success = await updateUserRoles(
        selectedUser.shortname,
        selectedRoles,
      );
      if (success) {
        const userIndex = users.findIndex(
          (u) => u.shortname === selectedUser.shortname,
        );
        if (userIndex > -1) {
          users[userIndex].roles = [...selectedRoles];

          updateFilteredUsers();
        }

        successToastMessage(`Updated roles for ${selectedUser.displayname}`);
        closeRoleModal();
      } else {
        errorToastMessage($_("failed_to_update_user_roles"));
      }
    } catch (error) {
      console.error("Error updating user roles:", error);
      errorToastMessage($_("failed_to_update_user_roles"));
    } finally {
      isUpdating = false;
    }
  }

  function getRoleDisplayName(roleShortname) {
    const role = availableRoles.find((r) => r.shortname === roleShortname);
    return role ? role.displayname : roleShortname;
  }

  function openConfirmModal(user) {
    const newStatus = !user.is_active;
    confirmUser = user;
    confirmAction = newStatus ? "activate" : "deactivate";
    isConfirmDanger = !newStatus;

    if (newStatus) {
      confirmTitle = $_("confirm_activate_user_title") || "Activate User";
      confirmMessage =
        $_("confirm_activate_user") ||
        `Are you sure you want to activate ${user.displayname}? This will restore their access to the system.`;
    } else {
      confirmTitle = $_("confirm_deactivate_user_title") || "Deactivate User";
      confirmMessage =
        $_("confirm_deactivate_user") ||
        `Are you sure you want to deactivate ${user.displayname}? They will lose access to the system.`;
    }

    showConfirmModal = true;
  }

  function closeConfirmModal() {
    showConfirmModal = false;
    confirmAction = null;
    confirmUser = null;
    confirmMessage = "";
    confirmTitle = "";
    isConfirmDanger = false;
  }

  async function confirmToggleActivation() {
    if (!confirmUser) return;

    // Store reference before closing modal (which resets confirmUser to null)
    const userToUpdate = confirmUser;
    const newStatus = !userToUpdate.is_active;
    closeConfirmModal();

    try {
      const updateData = {
        is_active: newStatus,
      };

      const result = await updateEntity(
        userToUpdate.shortname,
        "management",
        "users",
        ResourceType.user,
        updateData,
        "",
        "",
      );

      if (result) {
        const userIndex = users.findIndex(
          (u) => u.shortname === userToUpdate.shortname,
        );
        if (userIndex > -1) {
          users[userIndex].is_active = newStatus;
          updateFilteredUsers();
        }

        const statusText = newStatus
          ? $_("activated") || "activated"
          : $_("deactivated") || "deactivated";
        successToastMessage(
          `${userToUpdate.displayname} has been ${statusText}`,
        );
      } else {
        errorToastMessage(
          $_("failed_to_update_user_status") || "Failed to update user status",
        );
      }
    } catch (error) {
      console.error("Error toggling user activation:", error);
      errorToastMessage(
        $_("failed_to_update_user_status") || "Failed to update user status",
      );
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      loadUsers();
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
      loadUsers();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  }

  async function handleRoleFilterChange() {
    currentPage = 1;
    await loadUsers();
  }

  function openAddUserModal() {
    addUserForm = {
      displayname: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: [],
    };
    addUserErrors = {
      displayname: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: "",
      submit: "",
    };
    showAddUserModal = true;
  }

  function closeAddUserModal() {
    if (isCreatingUser) return;
    showAddUserModal = false;
  }

  function toggleAddUserRole(roleShortname: string) {
    const exists = addUserForm.roles.includes(roleShortname);
    addUserForm = {
      ...addUserForm,
      roles: exists
        ? addUserForm.roles.filter((role) => role !== roleShortname)
        : [...addUserForm.roles, roleShortname],
    };
  }

  async function createUserByAdmin() {
    addUserErrors = {
      displayname: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: "",
      submit: "",
    };

    const displayname = addUserForm.displayname.trim();
    const email = addUserForm.email.trim().toLowerCase();
    const password = addUserForm.password;
    const confirmPassword = addUserForm.confirmPassword;

    let hasError = false;

    if (!email) {
      addUserErrors.email = $_("EmailRequired") || "Email is required";
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addUserErrors.email = $_("InvalidEmail") || "Invalid email address";
      hasError = true;
    }

    if (!password) {
      addUserErrors.password = $_("PasswordRequired") || "Password is required";
      hasError = true;
    } else if (password.length < 6) {
      addUserErrors.password =
        $_("PasswordTooShort") || "Password must be at least 6 characters";
      hasError = true;
    }

    if (!confirmPassword) {
      addUserErrors.confirmPassword =
        $_("ConfirmPasswordRequired") || "Confirm password is required";
      hasError = true;
    } else if (password !== confirmPassword) {
      addUserErrors.confirmPassword =
        $_("PasswordsDoNotMatch") || "Passwords do not match";
      hasError = true;
    }

    if (addUserForm.roles.length === 0) {
      addUserErrors.roles =
        $_("admin_users.roles_required") || "Please assign at least one role";
      hasError = true;
    }

    if (hasError) return;

    isCreatingUser = true;
    try {
      const primaryRole = addUserForm.roles[0];
      const createdUserShortname = await createSeller({
        displayname,
        email,
        password,
        role: primaryRole,
      });

      if (createdUserShortname) {
        if (addUserForm.roles.length > 1) {
          const rolesUpdated = await updateUserRoles(
            createdUserShortname,
            addUserForm.roles,
          );

          if (!rolesUpdated) {
            addUserErrors.submit =
              $_("failed_to_update_user_roles") ||
              "User created but failed to assign all roles";
            return;
          }
        }

        successToastMessage(
          $_("admin_users.user_created") || "User created successfully",
        );
        closeAddUserModal();
        await loadUsers();
      } else {
        addUserErrors.submit =
          $_("admin_users.create_user_failed") || "Failed to create user";
      }
    } catch (error: any) {
      addUserErrors.submit =
        error?.message ||
        $_("admin_users.create_user_failed") ||
        "Failed to create user";
    } finally {
      isCreatingUser = false;
    }
  }

  $effect(() => {
    updateFilteredUsers();
  });

  onMount(async () => {
    isLoading = true;
    await Promise.all([loadUsers(), loadRoles()]);
    isLoading = false;
  });
</script>

<div class="container" class:rtl={$isRTL}>
  <div class="page-header">
    <h1 class="page-title">{$_("user_management")}</h1>
    <p class="page-subtitle">{$_("manage_users_and_roles")}</p>
  </div>
  <div class="stats-card">
    <h3 class="card-title">{$_("statistics")}</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(totalUsers, $locale)}
        </div>
        <div class="stat-label">{$_("total_users")}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(users.filter((u) => u.is_active).length, $locale)}
        </div>
        <div class="stat-label">{$_("active_users")}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(availableRoles.length, $locale)}
        </div>
        <div class="stat-label">{$_("available_roles")}</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">
          {formatNumber(
            users.filter((u) => u.roles.length === 0).length,
            $locale,
          )}
        </div>
        <div class="stat-label">{$_("users_without_roles")}</div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">{$_("users_overview")}</h2>
      <div class="filters-container">
        <div class="search-container">
          <label for="search-input" class="visually-hidden"></label>
          <input
            type="text"
            class="search-input"
            placeholder={$_("search_users")}
            bind:value={searchTerm}
            oninput={updateFilteredUsers}
          />
        </div>
        <div class="role-filter-container">
          <select
            class="role-filter-select"
            bind:value={selectedRoleFilter}
            onchange={handleRoleFilterChange}
          >
            <option value="">{$_("all_roles")}</option>
            {#each availableRoles as role}
              <option value={role.shortname}>{role.displayname}</option>
            {/each}
          </select>
        </div>
        <button class="btn add-user-btn" onclick={openAddUserModal}>
          {$_("admin_users.add_user") || "Add User"}
        </button>
      </div>
    </div>

    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>{$_("loading_users")}</span>
      </div>
    {:else if filteredUsers.length === 0}
      <div class="empty-state">
        {#if searchTerm || selectedRoleFilter}
          <p>{$_("no_users_match_filters")}</p>
          {#if searchTerm}
            <p class="filter-info">Search: "{searchTerm}"</p>
          {/if}
          {#if selectedRoleFilter}
            <p class="filter-info">
              Role: {getRoleDisplayName(selectedRoleFilter)}
            </p>
          {/if}
        {:else}
          <p>{$_("no_users_found")}</p>
        {/if}
      </div>
    {:else}
      <div class="users-table">
        <div class="table-header">
          <div class="header-cell">{$_("user")}</div>
          <div class="header-cell">{$_("email")}</div>
          <div class="header-cell">{$_("roles")}</div>
          <div class="header-cell">{$_("status")}</div>
          <div class="header-cell">{$_("actions")}</div>
        </div>

        {#each filteredUsers as user}
          <div class="table-row">
            <div class="cell user-cell">
              <div class="user-info">
                <div class="user-name">{user.displayname}</div>
                <div class="user-shortname">@{user.shortname}</div>
              </div>
            </div>

            <div class="cell email-cell">
              {user.email}
            </div>

            <div class="cell roles-cell">
              {#if user.roles.length > 0}
                <div class="roles-list">
                  {#each user.roles as role}
                    <span class="role-badge">{getRoleDisplayName(role)}</span>
                  {/each}
                </div>
              {:else}
                <span class="no-roles">{$_("no_roles_assigned")}</span>
              {/if}
            </div>

            <div class="cell status-cell">
              <span
                class="status-badge"
                class:active={user.is_active}
                class:inactive={!user.is_active}
              >
                {user.is_active ? $_("active") : $_("inactive")}
              </span>
            </div>

            <div class="cell actions-cell">
              <div class="actions-buttons">
                <button
                  class="btn btn-small btn-primary"
                  aria-label={$_("manage_roles")}
                  title={$_("manage_roles")}
                  onkeydown={(e) => {
                    if (e.key === "Enter") openRoleModal(user);
                  }}
                  onclick={() => openRoleModal(user)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </button>
                <button
                  class="btn btn-small"
                  class:btn-success={!user.is_active}
                  class:btn-danger={user.is_active}
                  aria-label={user.is_active
                    ? $_("deactivate")
                    : $_("activate")}
                  title={user.is_active ? $_("deactivate") : $_("activate")}
                  onclick={() => openConfirmModal(user)}
                >
                  {#if user.is_active}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M18 6 6 18"></path>
                      <path d="m6 6 12 12"></path>
                    </svg>
                  {:else}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if totalPages > 1}
        <div class="pagination">
          <button
            class="btn btn-secondary btn-small"
            onclick={previousPage}
            disabled={currentPage === 1}
          >
            {$_("previous")}
          </button>

          <div class="pagination-pages">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, index}
                <button
                  class="page-btn"
                  class:active={currentPage === index + 1}
                  onclick={() => goToPage(index + 1)}
                >
                  {formatNumber(index + 1, $locale)}
                </button>
              {/each}
            {:else}
              <button
                class="page-btn"
                class:active={currentPage === 1}
                onclick={() => goToPage(1)}
              >
                {formatNumber(1, $locale)}
              </button>

              {#if currentPage > 3}
                <span class="page-ellipsis">...</span>
              {/if}

              {#each Array(totalPages) as _, index}
                {#if index + 1 > 1 && index + 1 < totalPages && Math.abs(currentPage - (index + 1)) <= 1}
                  <button
                    class="page-btn"
                    class:active={currentPage === index + 1}
                    onclick={() => goToPage(index + 1)}
                  >
                    {formatNumber(index + 1, $locale)}
                  </button>
                {/if}
              {/each}

              {#if currentPage < totalPages - 2}
                <span class="page-ellipsis">...</span>
              {/if}

              <button
                class="page-btn"
                class:active={currentPage === totalPages}
                onclick={() => goToPage(totalPages)}
              >
                {formatNumber(totalPages, $locale)}
              </button>
            {/if}
          </div>

          <div class="pagination-info">
            <span>{formatNumber(totalUsers, $locale)} {$_("total_users")}</span>
          </div>

          <button
            class="btn btn-secondary btn-small"
            onclick={nextPage}
            disabled={currentPage === totalPages}
          >
            {$_("next")}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showRoleModal && selectedUser}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === "Escape") closeRoleModal();
    }}
    onclick={closeRoleModal}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      onkeydown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 id="modal-title">
          {$_("manageRolesFor")}
          {selectedUser.displayname}
        </h3>
        <button
          class="close-btn"
          aria-label={$_("close")}
          onkeydown={(e) => {
            if (e.key === "Enter") closeRoleModal();
          }}
          onclick={closeRoleModal}>×</button
        >
      </div>

      <div class="modal-body">
        <p class="modal-description">
          {$_("selectRolesToAssignDescription")}
        </p>

        {#if availableRoles.length === 0}
          <div class="alert alert-warning">
            <div class="alert-icon">⚠</div>
            <div>{$_("noRolesAvailable")}</div>
          </div>
        {:else}
          <div class="role-search-container">
            <input
              type="text"
              class="role-search-input"
              placeholder={$_("search_roles") || "Search roles..."}
              bind:value={roleSearchTerm}
              oninput={filterAvailableRoles}
            />
          </div>

          {#if filteredRoles.length === 0}
            <div class="empty-roles-state">
              <p>
                {$_("no_roles_match_search") || "No roles match your search"}
              </p>
            </div>
          {:else}
            <div class="roles-selection">
              {#each filteredRoles as role}
                <label class="role-option">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.shortname)}
                    onchange={() => toggleRole(role.shortname)}
                  />
                  <div class="role-content">
                    <div class="role-name">{role.displayname}</div>
                    <div class="role-description">{role.description}</div>
                  </div>
                </label>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onkeydown={(e) => {
            if (e.key === "Enter") closeRoleModal();
          }}
          onclick={closeRoleModal}
          disabled={isUpdating}
        >
          {$_("cancel")}
        </button>
        <button
          class="btn btn-primary"
          onkeydown={(e) => {
            if (e.key === "Enter") saveUserRoles();
          }}
          onclick={saveUserRoles}
          disabled={isUpdating || availableRoles.length === 0}
        >
          {#if isUpdating}
            <div class="spinner small"></div>
            {$_("saving")}
          {:else}
            {$_("saveChanges")}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showAddUserModal}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-user-modal-title"
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === "Escape") closeAddUserModal();
    }}
    onclick={closeAddUserModal}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      onkeydown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 id="add-user-modal-title">
          {$_("admin_users.add_user") || "Add User"}
        </h3>
        <button class="close-btn" onclick={closeAddUserModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group-modal">
          <label for="add-user-displayname"
            >{$_("DisplayName") || "Display Name"}</label
          >
          <input
            id="add-user-displayname"
            type="text"
            class="role-search-input"
            bind:value={addUserForm.displayname}
            placeholder={$_("DisplayName") || "Display Name"}
            disabled={isCreatingUser}
          />
          {#if addUserErrors.displayname}
            <p class="error-text-small">{addUserErrors.displayname}</p>
          {/if}
        </div>

        <div class="form-group-modal">
          <label for="add-user-email">{$_("Email") || "Email"}</label>
          <input
            id="add-user-email"
            type="email"
            class="role-search-input"
            bind:value={addUserForm.email}
            placeholder={$_("EmailPlaceholder") || "Enter email"}
            disabled={isCreatingUser}
          />
          {#if addUserErrors.email}
            <p class="error-text-small">{addUserErrors.email}</p>
          {/if}
        </div>

        <div class="form-group-modal">
          <label for="add-user-password">{$_("Password") || "Password"}</label>
          <input
            id="add-user-password"
            type="password"
            class="role-search-input"
            bind:value={addUserForm.password}
            placeholder={$_("Password") || "Password"}
            disabled={isCreatingUser}
          />
          {#if addUserErrors.password}
            <p class="error-text-small">{addUserErrors.password}</p>
          {/if}
        </div>

        <div class="form-group-modal">
          <label for="add-user-confirm-password"
            >{$_("ConfirmPassword") || "Confirm Password"}</label
          >
          <input
            id="add-user-confirm-password"
            type="password"
            class="role-search-input"
            bind:value={addUserForm.confirmPassword}
            placeholder={$_("ConfirmPassword") || "Confirm Password"}
            disabled={isCreatingUser}
          />
          {#if addUserErrors.confirmPassword}
            <p class="error-text-small">{addUserErrors.confirmPassword}</p>
          {/if}
        </div>

        <div class="form-group-modal">
          <span class="form-label-modal">{$_("roles") || "Roles"}</span>
          <div class="roles-selection">
            {#each availableRoles as role}
              <label class="role-option">
                <input
                  type="checkbox"
                  checked={addUserForm.roles.includes(role.shortname)}
                  onchange={() => toggleAddUserRole(role.shortname)}
                  disabled={isCreatingUser}
                />
                <div class="role-content">
                  <div class="role-name">{role.displayname}</div>
                  <div class="role-description">{role.description}</div>
                </div>
              </label>
            {/each}
          </div>
          {#if addUserErrors.roles}
            <p class="error-text-small">{addUserErrors.roles}</p>
          {/if}
        </div>

        {#if addUserErrors.submit}
          <div class="alert alert-warning">
            <div class="alert-icon">⚠</div>
            <div>{addUserErrors.submit}</div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          onclick={closeAddUserModal}
          disabled={isCreatingUser}
        >
          {$_("cancel") || "Cancel"}
        </button>
        <button
          class="btn add-user-btn"
          onclick={createUserByAdmin}
          disabled={isCreatingUser}
        >
          {#if isCreatingUser}
            <div class="spinner small"></div>
            {$_("saving") || "Saving..."}
          {:else}
            {$_("admin_users.create_user") || "Create User"}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showConfirmModal && confirmUser}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-modal-title"
    tabindex="-1"
    onkeydown={(e) => {
      if (e.key === "Escape") closeConfirmModal();
    }}
    onclick={closeConfirmModal}
  >
    <div
      class="modal modal-confirm"
      role="dialog"
      tabindex="-1"
      onkeydown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header-confirm" class:danger={isConfirmDanger}>
        <div class="confirm-icon">
          {#if isConfirmDanger}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          {/if}
        </div>
        <h3 id="confirm-modal-title" class="confirm-title">
          {confirmTitle}
        </h3>
      </div>

      <div class="modal-body-confirm">
        <p class="confirm-message">{confirmMessage}</p>
        <div class="confirm-user-info">
          <div class="user-detail-label">{$_("user") || "User"}:</div>
          <div class="user-detail-value">
            <strong>{confirmUser.displayname}</strong>
            <span class="user-email">({confirmUser.email})</span>
          </div>
        </div>
      </div>

      <div class="modal-footer-confirm">
        <button class="btn btn-secondary" onclick={closeConfirmModal}>
          {$_("cancel") || "Cancel"}
        </button>
        <button
          class="btn"
          class:btn-danger={isConfirmDanger}
          class:btn-success={!isConfirmDanger}
          onclick={confirmToggleActivation}
        >
          {#if isConfirmDanger}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
            {$_("deactivate") || "Deactivate"}
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {$_("activate") || "Activate"}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .rtl {
    direction: rtl;
  }
  .filters-container {
    display: flex;
    gap: 16px;
    flex: 1;
    max-width: 600px;
    justify-content: flex-end;
  }

  .role-filter-container {
    min-width: 200px;
  }

  .add-user-btn {
    background: #281f51;
    color: #fff;
    border: none;
    white-space: nowrap;
  }

  .add-user-btn:hover:not(:disabled) {
    background: #221a45;
  }

  .form-group-modal {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .form-group-modal label {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }

  .form-label-modal {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }

  .role-filter-select {
    width: 100%;
    padding: 10px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .role-filter-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }

  .page-header {
    margin-bottom: 32px;
  }

  .page-title {
    font-size: 32px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 8px;
  }

  .page-subtitle {
    color: #6b7280;
    font-size: 16px;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 24px;
    margin-top: 24px;
  }

  .card-header {
    background-color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .card-title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .search-container {
    flex: 1;
    max-width: 300px;
  }

  .search-input {
    width: 100%;
    padding: 10px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px;
    color: #6b7280;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 12px;
  }

  .spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
    margin-right: 8px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 64px;
    color: #6b7280;
  }

  .users-table {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 2fr 2fr 2fr 1fr 1.5fr;
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
  }

  .table-row {
    display: grid;
    grid-template-columns: 2fr 2fr 2fr 1fr 1.5fr;
    background: white;
    transition: background-color 0.2s ease;
  }

  .table-row:hover {
    background: #f9fafb;
  }

  .header-cell,
  .cell {
    padding: 16px;
    display: flex;
    align-items: center;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .user-name {
    font-weight: 600;
    color: #111827;
  }

  .user-shortname {
    font-size: 12px;
    color: #6b7280;
    font-family: "uthmantn", "Monaco", "Menlo", "Ubuntu Mono", monospace;
  }

  .roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .role-badge {
    background: #dbeafe;
    color: #1e40af;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .no-roles {
    color: #9ca3af;
    font-style: italic;
    font-size: 14px;
  }

  .status-badge {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.active {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.inactive {
    background: #fef2f2;
    color: #dc2626;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    width: 100%;
    height: 100%;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-success {
    background: #10b981;
    color: white;
    width: 100%;
    height: 100%;
  }

  .btn-success:hover:not(:disabled) {
    background: #059669;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
    width: 100%;
    height: 100%;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .actions-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .stats-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 24px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 24px;
    margin-top: 16px;
  }

  .stat-item {
    text-align: center;
  }

  .stat-number {
    font-size: 32px;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 4px;
  }

  .stat-label {
    color: #6b7280;
    font-size: 14px;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 24px 0 24px;
    margin-bottom: 16px;
  }

  .modal-header h3 {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .modal-body {
    padding: 0 24px 24px 24px;
  }

  .modal-description {
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .role-search-container {
    margin-bottom: 16px;
  }

  .role-search-input {
    width: 100%;
    padding: 10px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .role-search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .empty-roles-state {
    text-align: center;
    padding: 32px;
    color: #9ca3af;
    font-size: 14px;
  }

  .alert {
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .alert-warning {
    background: #fffbeb;
    border: 1px solid #fed7aa;
    color: #92400e;
  }

  .alert-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .roles-selection {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .role-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .role-option:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .role-option:has(:global(input:checked)) {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .role-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    accent-color: #3b82f6;
  }

  .role-content {
    flex: 1;
  }

  .role-name {
    font-weight: 600;
    color: #111827;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .role-description {
    color: #6b7280;
    font-size: 13px;
    line-height: 1.4;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 24px;
    border-top: 1px solid #e5e7eb;
  }

  .modal-confirm {
    max-width: 500px;
  }

  .modal-header-confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 24px 24px 24px;
    text-align: center;
    background: #281f51;
    border-radius: 12px 12px 0 0;
  }

  .modal-header-confirm.danger {
    background: #281f51;
  }

  .confirm-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    background: white;
    color: #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  }

  .modal-header-confirm.danger .confirm-icon {
    color: #ef4444;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
  }

  .confirm-title {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .modal-body-confirm {
    padding: 24px;
  }

  .confirm-message {
    color: #4b5563;
    font-size: 15px;
    line-height: 1.6;
    margin: 0 0 20px 0;
  }

  .confirm-user-info {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
  }

  .user-detail-label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .user-detail-value {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .user-detail-value strong {
    color: #111827;
    font-size: 16px;
  }

  .user-email {
    color: #6b7280;
    font-size: 14px;
  }

  .modal-footer-confirm {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px 24px;
    background: #f9fafb;
    border-radius: 0 0 12px 12px;
  }

  .modal-footer-confirm .btn {
    min-width: 120px;
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid #e5e7eb;
    margin-top: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pagination-pages {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .page-btn {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-btn:hover:not(.active) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .page-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
    font-weight: 600;
  }

  .page-ellipsis {
    padding: 0 8px;
    color: #9ca3af;
    font-weight: 600;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    font-size: 14px;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .filters-container {
      flex-direction: column;
      max-width: none;
    }

    .role-filter-container {
      min-width: auto;
    }
    .table-header,
    .table-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .header-cell,
    .cell {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .header-cell:last-child,
    .cell:last-child {
      border-bottom: none;
    }

    .card-header {
      flex-direction: column;
      align-items: stretch;
    }

    .search-container {
      max-width: none;
    }

    .pagination {
      flex-direction: column;
      gap: 16px;
    }

    .pagination-pages {
      order: 2;
      justify-content: center;
      width: 100%;
    }

    .pagination-info {
      order: 1;
      justify-content: center;
    }

    .page-btn {
      min-width: 32px;
      height: 32px;
      font-size: 13px;
    }
  }
</style>

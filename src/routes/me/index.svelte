<script lang="ts">
  import { preventDefault, run } from "svelte/legacy";

  import { onMount } from "svelte";
  import {
    getAvatar,
    getMyEntities,
    getProfile,
    getSpaceSchema,
    setAvatar,
    updatePassword,
    updateProfile,
  } from "@/lib/dmart_services";
  import {
    errorToastMessage,
    successToastMessage,
  } from "@/lib/toasts_messages";
  import Avatar from "@/components/Avatar.svelte";
  import {
    formatDate,
    formatNumberInText,
    renderStateString,
  } from "@/lib/helpers";
  import { goto } from "@roxi/routify";
  import { Diamonds } from "svelte-loading-spinners";
  import { _, locale } from "@/i18n";
  import { loginBy } from "@/stores/user";
  import { writable } from "svelte/store";
  import DynamicSchemaBasedForms from "@/components/forms/DynamicSchemaBasedForms.svelte";
  import "./styles/index.css";

  $goto;
  const ProfileSection = {
    ME: "ME",
    IDEAS: "IDEAS",
  };
  let profileSection = writable(ProfileSection.ME);

  let isLoading = writable(true);
  let isUploadingAvatar = writable(false);
  let user = writable(null);
  let avatar = writable(null);
  let entities = writable([]);
  let displayname = writable("");
  let description = writable("");
  let email = writable("");
  let msisdn = writable("");
  let fileInput = writable(null);

  let userSchema = writable(null);
  let profileData = writable({});
  let loadingSchema = writable(false);

  let oldPassword = writable("");
  let newPassword = writable("");
  let confirmPassword = writable("");
  let isChangingPassword = writable(false);
  let showChangePassword = writable(false);

  onMount(async () => {
    isLoading.set(true);

    user.set(await getProfile());
    const currentUser = $user;

    displayname.set(currentUser?.attributes?.displayname?.[$locale] ?? "");
    if (!displayname && $locale === "en") {
      displayname.set(currentUser.attributes.email);
    }
    description.set(currentUser.attributes?.description?.[$locale] ?? "");
    email.set(currentUser.attributes?.email ?? "");
    msisdn.set(currentUser.attributes?.msisdn ?? "");

    avatar.set(await getAvatar(currentUser.shortname));

    await loadUserSchema();

    await fetchEntities();
    isLoading.set(false);
  });

  async function loadUserSchema() {
    loadingSchema.set(true);
    try {
      const response = await getSpaceSchema("management", "schema", "managed");

      if (response?.status === "success" && response?.records) {
        const userSchemaRecord = response.records.find(
          (record) => record.shortname === "user"
        );

        if (userSchemaRecord && userSchemaRecord.attributes?.payload?.body) {
          userSchema.set(userSchemaRecord.attributes.payload.body);

          const currentUser = $user;
          const existingProfileData =
            currentUser?.attributes?.payload?.body || {};
          profileData.set(existingProfileData);
        }
      }
    } catch (error) {
      console.error("Error loading user schema:", error);
      errorToastMessage("Failed to load profile schema");
    } finally {
      loadingSchema.set(false);
    }
  }

  async function fetchEntities() {
    isLoading.set(true);
    try {
      const rawEntities = await getMyEntities();

      entities.set(
        rawEntities.map((entity) => ({
          shortname: entity.shortname,
          title:
            entity.attributes?.payload?.body?.title ||
            entity.attributes?.displayname?.en ||
            "Untitled",
          content: entity.attributes?.payload?.body?.content || "",
          tags: entity.attributes?.tags || [],
          state: entity.attributes?.state || "unknown",
          is_active: entity.attributes?.is_active || false,
          created_at: entity.attributes?.created_at
            ? formatDate(entity.attributes.created_at)
            : "",
          updated_at: entity.attributes?.updated_at
            ? formatDate(entity.attributes.updated_at)
            : "",
          raw_created_at: entity.attributes?.created_at || "",
          raw_updated_at: entity.attributes?.updated_at || "",
          space_name: entity.attributes?.space_name || "",
          subpath: entity?.subpath || "",
          owner_shortname: entity.attributes?.owner_shortname || "",
          comment: entity.attachments?.comment?.length ?? 0,
          reaction: entity.attachments?.reaction?.length ?? 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching entities:", error);
      errorToastMessage("An error occurred while fetching your entries");
      entities.set([]);
    } finally {
      isLoading.set(false);
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();

    if ($newPassword !== $confirmPassword) {
      errorToastMessage("New passwords do not match");
      return;
    }

    if ($newPassword.length < 8) {
      errorToastMessage("New password must be at least 8 characters long");
      return;
    }

    if ($oldPassword === $newPassword) {
      errorToastMessage(
        "New password must be different from the current password"
      );
      return;
    }

    isChangingPassword.set(true);

    try {
      const loginResult = await loginBy($user.attributes.email, $oldPassword);

      if (!loginResult) {
        errorToastMessage("Current password is incorrect");
        return;
      }
      const response = await updatePassword({
        shortname: $user.shortname,
        password: $newPassword,
      });

      if (response) {
        successToastMessage("Password changed successfully");
        oldPassword.set("");
        newPassword.set("");
        confirmPassword.set("");
        showChangePassword.set(false);
      } else {
        errorToastMessage("Failed to change password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      errorToastMessage("An error occurred while changing your password");
    } finally {
      isChangingPassword.set(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!$displayname.trim()) {
      errorToastMessage(
        `Display name is required for ${$locale === "ar" ? "Arabic" : $locale === "en" ? "English" : $locale.toUpperCase()}`
      );
      return;
    }

    if (!$description.trim()) {
      errorToastMessage(
        `Description is required for ${$locale === "ar" ? "Arabic" : $locale === "en" ? "English" : $locale.toUpperCase()}`
      );
      return;
    }

    const updatedDisplayname = { ...$user.attributes.displayname };
    const updatedDescription = { ...$user.attributes.description };

    updatedDisplayname[$locale] = $displayname.trim();
    updatedDescription[$locale] = $description.trim();

    // Include profile data in the update
    const response = await updateProfile({
      shortname: $user.shortname,
      displayname: updatedDisplayname,
      description: updatedDescription,
      email: $email,
      msisdn: $msisdn,
      payload: {
        content_type: "json",
        body: $profileData,
      },
    });

    if (response) {
      successToastMessage("Profile updated successfully");
      $user.attributes.displayname = updatedDisplayname;
      $user.attributes.description = updatedDescription;
      // Update user with new profile data
      if (!$user.attributes.payload) {
        $user.attributes.payload = {};
      }
      $user.attributes.payload.body = $profileData;
    } else {
      errorToastMessage("Error updating profile");
    }
  }

  function handleME() {
    profileSection.set(ProfileSection.ME);
  }
  function handleEntities() {
    profileSection.set(ProfileSection.IDEAS);
  }

  function gotoEntityDetails(entity: any) {
    $goto("/entries/[shortname]", {
      shortname: entity.shortname,
      space_name: entity.space_name,
      subpath: entity.subpath,
    });
  }

  function triggerFileInput() {
    $fileInput?.click();
  }

  async function handleAvatarChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      errorToastMessage("Please select a valid image file");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      errorToastMessage("File size must be less than 5MB");
      return;
    }

    isUploadingAvatar.set(true);

    try {
      const success = await setAvatar($user.shortname, file);

      if (success) {
        avatar.set(await getAvatar($user.shortname));
        successToastMessage("Profile picture updated successfully");
      } else {
        errorToastMessage("Failed to update profile picture");
      }
    } catch (error) {
      console.error("Error updating avatar:", error);
      errorToastMessage(
        "An error occurred while updating your profile picture"
      );
    } finally {
      isUploadingAvatar.set(false);
      target.value = "";
    }
  }

  run(() => {
    if ($user && $locale) {
      displayname.set($user?.attributes?.displayname?.[$locale] ?? "");

      if (!displayname && $locale === "en") {
        displayname.set($user.attributes.email);
      }

      description.set($user.attributes?.description?.[$locale] ?? "");
    }
  });
</script>

<div class="profile-page">
  <div class="container">
    <!-- Header Navigation -->
    <div class="navigation-header">
      <nav class="nav-tabs">
        <button
          class="nav-tab {$profileSection === 'ME' ? 'active' : ''}"
          onclick={handleME}
        >
          <div class="tab-content">
            <svg class="tab-icon" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clip-rule="evenodd"
              />
            </svg>
            {$_("MyProfile")}
          </div>
        </button>
        <button
          class="nav-tab {$profileSection === 'IDEAS' ? 'active' : ''}"
          onclick={handleEntities}
        >
          <div class="tab-content">
            <svg class="tab-icon" fill="currentColor" viewBox="0 0 20 20">
              <path
                d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 005.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"
              />
            </svg>
            {$_("MyEntities")}
            <span class="entity-count">
              {formatNumberInText($entities.length, $locale)}
            </span>
          </div>
        </button>
      </nav>
    </div>

    {#if $isLoading}
      <div class="loading-container">
        <div class="loading-content">
          <Diamonds color="#2563eb" size="60" unit="px" />
          <p class="loading-text">Loading your profile...</p>
        </div>
      </div>
    {:else if $profileSection === ProfileSection.ME}
      <div class="profile-grid">
        <!-- Profile Sidebar -->
        <div class="profile-sidebar">
          <!-- Avatar Card -->
          <div class="avatar-card">
            <div class="avatar-header">
              <div class="avatar-container">
                <div class="avatar-wrapper">
                  <div class="avatar-image">
                    <Avatar src={$avatar} size="128" />
                  </div>

                  <div
                    class="avatar-overlay"
                    onclick={triggerFileInput}
                    onkeydown={(e) => {
                      if (e.key === "Enter") triggerFileInput();
                    }}
                    role="button"
                    tabindex="0"
                  >
                    {#if $isUploadingAvatar}
                      <Diamonds color="#ffffff" size="24" unit="px" />
                    {:else}
                      <div class="overlay-content">
                        <svg
                          class="overlay-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span class="overlay-text">{$_("EditPhoto")}</span>
                      </div>
                    {/if}
                  </div>
                </div>

                <input
                  bind:this={$fileInput}
                  type="file"
                  accept="image/*"
                  class="hidden"
                  onchange={handleAvatarChange}
                  disabled={$isUploadingAvatar}
                />
              </div>

              <div class="user-info">
                <h2 class="user-name">
                  {$displayname || $user.shortname}
                </h2>
                <p class="user-handle">@{$user.shortname}</p>
              </div>
            </div>

            <div class="avatar-actions">
              <button
                class="change-photo-btn"
                onclick={triggerFileInput}
                disabled={$isUploadingAvatar}
              >
                {#if $isUploadingAvatar}
                  <Diamonds color="#ffffff" size="16" unit="px" />
                  Uploading...
                {:else}
                  <svg
                    class="btn-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {$_("ChangePhoto")}
                {/if}
              </button>
            </div>
          </div>

          <!-- Quick Stats -->
          <div class="stats-card">
            <h3 class="stats-title">
              <svg class="stats-icon" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
              </svg>
              {$_("QuickStats")}
            </h3>
            <div class="stats-list">
              <div class="stat-item">
                <span class="stat-label">{$_("TotalEntities")}</span>
                <span class="stat-value">{$entities.length}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{$_("ProfileStatus")}</span>
                <span class="status-badge active">{$_("Active")}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
          <!-- Basic Profile Information -->
          <div class="form-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg
                  class="card-icon"
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
                {$_("ProfilePreferences")}
              </h3>
              <p class="card-subtitle">{$_("ManageBasicProfile")}</p>
            </div>

            <div class="card-content">
              <form
                onsubmit={preventDefault(handleSubmit)}
                class="profile-form"
              >
                <div class="form-row">
                  <div class="form-group">
                    <label for="displayname" class="form-label">
                      {$_("DisplayName")} ({$_($locale.toUpperCase())})
                      <span class="required">*</span>
                    </label>
                    <input
                      id="displayname"
                      type="text"
                      required
                      bind:value={$displayname}
                      class="form-input"
                      placeholder={$_("DisplayNamePlaceholder")}
                      dir={$locale === "ar" || $locale === "ku" ? "rtl" : "ltr"}
                    />
                  </div>

                  <div class="form-group">
                    <label for="email" class="form-label">
                      {$_("EmailAddress")}
                    </label>
                    <input
                      id="email"
                      type="email"
                      bind:value={$email}
                      class="form-input"
                      placeholder={$_("EmailPlaceholder")}
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="msisdn" class="form-label">
                    {$_("MobileNumber")}
                  </label>
                  <input
                    id="msisdn"
                    type="tel"
                    bind:value={$msisdn}
                    class="form-input"
                    placeholder={$_("MobileNumberPlaceholder")}
                  />
                </div>

                <div class="form-group">
                  <label for="description" class="form-label">
                    {$_("Description")} ({$_($locale.toUpperCase())})
                    <span class="required">*</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    bind:value={$description}
                    rows="4"
                    class="form-textarea"
                    placeholder={$_("DescriptionPlaceholder")}
                    dir={$locale === "ar" || $locale === "ku" ? "rtl" : "ltr"}
                  ></textarea>
                </div>

                <button type="submit" class="submit-btn">
                  <svg
                    class="btn-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {$_("SaveChanges")}
                </button>
              </form>
            </div>
          </div>

          <!-- Dynamic Profile Fields -->
          {#if $userSchema}
            <div class="form-card">
              <div class="card-header secondary">
                <h3 class="card-title">
                  <svg
                    class="card-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {$_("AdditionalProfileInfo")}
                </h3>
                <p class="card-subtitle">
                  {$_("CompleteProfileDetails")}
                </p>
              </div>

              <div class="card-content">
                {#if $loadingSchema}
                  <div class="loading-container">
                    <div class="loading-content">
                      <Diamonds color="#6b21a8" size="40" unit="px" />
                      <p class="loading-text">{$_("LoadingProfileFields")}</p>
                    </div>
                  </div>
                {:else}
                  <DynamicSchemaBasedForms
                    bind:content={$profileData}
                    schema={$userSchema}
                  />
                {/if}
              </div>
            </div>
          {/if}

          <!-- Account Settings -->
          {#if $user}
            <div class="form-card">
              <div class="card-header success">
                <h3 class="card-title">
                  <svg
                    class="card-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {$_("AccountSettings")}
                </h3>
                <p class="card-subtitle">
                  {$_("ManageAccountSecurity")}
                </p>
              </div>

              <div class="card-content">
                <div class="account-status">
                  <div class="status-info">
                    <h4 class="status-title">{$_("AccountStatus")}</h4>
                    <p class="status-description">{$_("AccountActive")}</p>
                  </div>
                  <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span class="status-badge active">{$_("Active")}</span>
                  </div>
                </div>

                <div class="password-section">
                  <div class="password-header">
                    <div class="password-info">
                      <h4 class="password-title">
                        <svg
                          class="password-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        {$_("Password")}
                      </h4>
                      <p class="password-description">
                        {$_("SecureAccountPassword")}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="password-toggle-btn"
                      onclick={() =>
                        showChangePassword.set(!$showChangePassword)}
                    >
                      {$showChangePassword
                        ? $_("Cancel")
                        : $_("ChangePassword")}
                    </button>
                  </div>

                  {#if $showChangePassword}
                    <form
                      onsubmit={preventDefault(handlePasswordChange)}
                      class="password-form"
                    >
                      <div class="password-fields">
                        <div class="password-field full-width">
                          <label for="oldPassword" class="form-label">
                            {$_("CurrentPassword")}
                          </label>
                          <input
                            id="oldPassword"
                            type="password"
                            required
                            bind:value={$oldPassword}
                            class="form-input"
                            placeholder={$_("EnterCurrentPassword")}
                            disabled={$isChangingPassword}
                          />
                        </div>

                        <div class="password-field">
                          <label for="newPassword" class="form-label">
                            {$_("NewPassword")}
                          </label>
                          <input
                            id="newPassword"
                            type="password"
                            required
                            minlength="8"
                            bind:value={$newPassword}
                            class="form-input"
                            placeholder={$_("EnterNewPassword")}
                            disabled={$isChangingPassword}
                          />
                        </div>

                        <div class="password-field">
                          <label for="confirmPassword" class="form-label">
                            {$_("ConfirmNewPassword")}
                          </label>
                          <input
                            id="confirmPassword"
                            type="password"
                            required
                            bind:value={$confirmPassword}
                            class="form-input"
                            placeholder={$_("ConfirmNewPassword")}
                            disabled={$isChangingPassword}
                          />
                        </div>
                      </div>

                      <div class="password-hint">
                        💡 {$_("PasswordHint")}
                      </div>

                      <div class="password-actions">
                        <button
                          type="submit"
                          disabled={$isChangingPassword}
                          class="submit-btn"
                        >
                          {#if $isChangingPassword}
                            <Diamonds color="#ffffff" size="16" unit="px" />
                            {$_("ChangingPassword")}
                          {:else}
                            <svg
                              class="btn-icon"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            {$_("ChangePassword")}
                          {/if}
                        </button>
                        <button
                          type="button"
                          onclick={() => {
                            showChangePassword.set(false);
                            oldPassword.set("");
                            newPassword.set("");
                            confirmPassword.set("");
                          }}
                          class="cancel-btn"
                          disabled={$isChangingPassword}
                        >
                          {$_("Cancel")}
                        </button>
                      </div>
                    </form>
                  {:else}
                    <div class="password-display">
                      <svg
                        class="password-display-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <span class="password-dots">••••••••••••</span>
                      <span class="protected-badge">{$_("Protected")}</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {:else if $entities.length === 0}
      <div class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">
            <svg
              class="empty-svg"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 class="empty-title">{$_("NoEntities")}</h3>
          <p class="empty-description">{$_("CreateNewEntityMsg")}</p>
          <button class="create-entity-btn">{$_("CreateFirstEntity")}</button>
        </div>
      </div>
    {:else}
      <div class="entities-grid">
        {#each $entities as entity}
          <div
            class="entity-card"
            role="button"
            tabindex="0"
            onclick={() => gotoEntityDetails(entity)}
            onkeydown={(e) => {
              if (e.key === "Enter") gotoEntityDetails(entity);
            }}
          >
            <div class="entity-content">
              <div class="entity-info">
                <div class="entity-main">
                  <h3 class="entity-title">{entity.title}</h3>
                  <div class="entity-meta">
                    <span class="entity-meta-item">
                      <svg
                        class="meta-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {$_("Updated")}
                      {entity.updated_at}
                    </span>
                    <span class="entity-status">
                      {renderStateString(entity)}
                    </span>
                  </div>
                </div>

                <div class="entity-actions">
                  <div class="entity-stats">
                    <span class="stat-item reactions">
                      <svg
                        class="stat-icon"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        />
                      </svg>
                      <span class="stat-count"
                        >{formatNumberInText(entity.reaction, $locale) ??
                          0}</span
                      >
                    </span>
                    <span class="stat-item comments">
                      <svg
                        class="stat-icon"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                        />
                      </svg>
                      <span class="stat-count"
                        >{formatNumberInText(entity.comment, $locale) ??
                          0}</span
                      >
                    </span>
                  </div>

                  <div class="entity-arrow">
                    <svg
                      class="arrow-icon {$locale === 'ar' || $locale === 'ku'
                        ? 'rtl'
                        : ''}"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

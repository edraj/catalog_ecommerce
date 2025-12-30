<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "@roxi/routify";
  import { _, locale } from "@/i18n";
  import { derived } from "svelte/store";
  import { user } from "@/stores/user";
  import FolderCard from "@/components/sellers/FolderCard.svelte";
  import { createSellerFolders } from "@/lib/utils/sellerUtils";
  import "./styles/index.css";

  $goto;

  const isRTL = derived(
    locale,
    ($locale) => $locale === "ar" || $locale === "ku"
  );

  let folders = $state([]);

  onMount(() => {
    const sellerShortname = $user.shortname;
    const baseFolders = createSellerFolders(sellerShortname, $_);

    folders = baseFolders.map((folder) => ({
      ...folder,
      route: `/seller/${folder.shortname}`,
    }));
  });

  function navigateToFolder(folderShortname: string) {
    $goto(`/seller/${folderShortname}`);
  }
</script>

<div class="seller-dashboard-container">
  <div class="seller-dashboard-content">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="dashboard-title" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("seller_dashboard.title")}
          </h1>
          <p class="dashboard-subtitle" dir={$isRTL ? "rtl" : "ltr"}>
            {$_("seller_dashboard.subtitle")}
          </p>
        </div>
      </div>
    </div>

    <!-- Folders Grid -->
    <div class="folders-grid">
      {#each folders as folder (folder.shortname)}
        <FolderCard
          {folder}
          onSelect={() => navigateToFolder(folder.shortname)}
        />
      {/each}
    </div>
  </div>
</div>

<script lang="ts">
  import { FolderOutline } from "flowbite-svelte-icons";
  import { _ } from "@/i18n";

  interface Props {
    folder: any;
    onSelect: (shortname: string) => void;
  }

  let { folder, onSelect }: Props = $props();

  function getLocalizedDisplayName(item: any) {
    const displayname = item.attributes?.displayname;
    if (!displayname) return item.shortname || "Untitled";
    if (typeof displayname === "string") return displayname;

    const locale = localStorage.getItem("locale") || "en";
    return (
      displayname[locale] ||
      displayname.en ||
      displayname.ar ||
      displayname.ku ||
      item.shortname ||
      "Untitled"
    );
  }
</script>

<button class="folder-card" onclick={() => onSelect(folder.shortname)}>
  <div class="folder-card-icon">
    <FolderOutline class="folder-icon" />
  </div>
  <div class="folder-card-body">
    <h3 class="folder-title">{getLocalizedDisplayName(folder)}</h3>
    <span class="folder-shortname">{folder.shortname}</span>
  </div>
  <div class="folder-card-footer">
    <div class="folder-meta">
      <svg
        class="meta-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <span class="meta-text">
        {$_("seller_dashboard.folder") || "Folder"}
      </span>
    </div>
  </div>
</button>

<style>
  .folder-card {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .folder-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transform: scaleX(0);
    transition: transform 0.4s ease;
  }

  .folder-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    border-color: #667eea;
  }

  .folder-card:hover::before {
    transform: scaleX(1);
  }

  .folder-card-icon {
    width: 5rem;
    height: 5rem;
    background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    transition: all 0.3s ease;
  }

  .folder-card:hover .folder-card-icon {
    transform: scale(1.1) rotate(5deg);
    background: linear-gradient(135deg, #667eea25 0%, #764ba225 100%);
  }

  :global(.folder-card .folder-icon) {
    width: 3rem;
    height: 3rem;
    color: #667eea;
  }

  .folder-card-body {
    flex: 1;
  }

  .folder-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 0.5rem 0;
  }

  .folder-shortname {
    font-size: 0.85rem;
    color: #a0aec0;
    font-family: "SF Mono", "Monaco", "Courier New", monospace;
    margin: 0 0 0.75rem 0;
    padding: 0.25rem 0.75rem;
    background: #f7fafc;
    border-radius: 6px;
    display: inline-block;
  }

  .folder-card-footer {
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
  }

  .folder-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #718096;
    font-size: 0.875rem;
  }

  .meta-icon {
    width: 1rem;
    height: 1rem;
    stroke-width: 2;
  }

  .meta-text {
    font-size: 0.875rem;
  }
</style>

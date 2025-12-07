<script>
    import {goto} from "@roxi/routify";
    import {
        BellSolid,
        EditSolid,
        EyeSolid,
        HeartSolid,
        MessageCaptionSolid,
        MessagesOutline,
        UserSolid,
    } from "flowbite-svelte-icons";
    import {_} from "@/i18n";
    import "./styles/index.css";

    $goto;

    const features = [
    {
      icon: HeartSolid,
      title: $_("InteractiveEngagement"),
      description: $_("InteractiveEngagementDesc"),
    },
    {
      icon: BellSolid,
      title: $_("RealtimeNotifications"),
      description: $_("RealtimeNotificationsDesc"),
    },
    {
      icon: UserSolid,
      title: $_("PersonalProfile"),
      description: $_("PersonalProfileDesc"),
    },
    {
      icon: EyeSolid,
      title: $_("PublicBrowseMode"),
      description: $_("PublicBrowseModeDesc"),
    },
    {
      icon: EditSolid,
      title: $_("ContentManagement"),
      description: $_("ContentManagementDesc"),
    },
    {
      icon: MessageCaptionSolid,
      title: $_("RichDiscussions"),
      description: $_("RichDiscussionsDesc"),
    },
  ];

  function handleStartExploring() {
    $goto("/catalogs");
  }

  function handleSignIn() {
    $goto("/login");
  }

  function handleRegister() {
    $goto("/register");
  }

  function handleExploreAsGuest() {
    $goto("/catalogs");
  }

  function handleContactUs() {
    $goto("/contact");
  }
</script>

<div class="home-container">
  <section class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="hero-title">
          {$_("ShareIdeas")},
          <span class="gradient-text"> {$_("BuildCommunity")} </span>
        </h1>
        <p class="hero-description">
          {$_("HeroDescription")}
        </p>

        <div class="hero-buttons">
          <button class="btn-primary" onclick={handleStartExploring}>
            {$_("StartExploring")}
          </button>
          <button class="btn-secondary" onclick={handleSignIn}>
            {$_("SignIn")}
          </button>
          <button class="btn-secondary" onclick={handleRegister}>
            {$_("CreateAccount")}
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="features-section">
    <div class="features-content">
      <div class="features-header">
        <h2 class="features-title">{$_("FeaturesTitle")}</h2>
        <p class="features-description">
          {$_("FeaturesDescription")}
        </p>
      </div>

      <div class="features-grid">
        {#each features as feature}
          <div class="feature-card">
            <div class="feature-icon">
              <feature.icon class="icon" color="white" />
            </div>
            <h3 class="feature-title">
              {feature.title}
            </h3>
            <p class="feature-description">
              {feature.description}
            </p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="cta-section">
    <div class="cta-content">
      <h2 class="cta-title">{$_("CTATitle")}</h2>
      <p class="cta-description">
        {$_("CTADescription")}
      </p>

      <div class="cta-buttons">
        <button class="btn-cta-secondary" onclick={handleExploreAsGuest}>
          {$_("ExploreAsGuest")}
        </button>
        <button
          aria-label={$_("CTADescription")}
          class="btn-cta-secondary flex items-center"
          onclick={handleContactUs}
        >
          <MessagesOutline
            aria-label={$_("CTADescription")}
            class="button-icon mr-2"
          />
          {$_("ContactUs")}
        </button>
      </div>
    </div>
  </section>

  <footer class="footer-section">
    <div class="footer-content">
      <div class="footer-grid">
        <div class="footer-brand">
          <h3 class="brand-name">{$_("Catalog")}</h3>
          <p class="brand-description">
            {$_("BrandDescription")}
          </p>
        </div>

        <div class="footer-column">
          <h4 class="footer-column-title">{$_("Support")}</h4>
          <ul class="footer-links">
            <li><a href="/help">{$_("HelpCenter")}</a></li>
            <li><a href="/community">{$_("Community")}</a></li>
            <li>
              <button onclick={handleContactUs} class="footer-link-button"
                >{$_("ContactUs")}</button
              >
            </li>
            <li><a href="/privacy">{$_("Privacy")}</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>{$_("Copyright")}</p>
      </div>
    </div>
  </footer>
</div>

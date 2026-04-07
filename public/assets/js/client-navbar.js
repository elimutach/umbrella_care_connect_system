class NavbarComponent extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <nav class="navbar navbar-expand-lg fixed-top">
        <div class="container-fluid px-lg-5">
          <a class="navbar-brand" href="/" aria-label="Umbrella Care Connect home">
            <img src="https://placehold.co/120x50/2F394C/white?text=Umbrella+Care" alt="Umbrella logo">
          </a>

          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon" style="filter: invert(1);"></span>
          </button>

          <div class="collapse navbar-collapse" id="mainNavbar">
            <ul class="navbar-nav mx-auto mb-2 mb-lg-0">
              <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
              <li class="nav-item"><a class="nav-link" href="/#about">About</a></li>
              <li class="nav-item"><a class="nav-link" href="/needs/">Live Needs</a></li>
              <li class="nav-item"><a class="nav-link" href="/volunteer/">Volunteer</a></li>
              <li class="nav-item"><a class="nav-link" href="/contact/">Contact</a></li>
            </ul>

            <div class="d-flex align-items-center flex-wrap gap-2">
              <button class="mode-toggle" id="globalThemeToggle" type="button">light/dark</button>
              <a href="/signin/" class="btn btn-login">Log in</a>
              <a href="/signup/" class="btn btn-signup">Sign up</a>
            </div>
          </div>
        </div>
      </nav>
    `;

    this.bindThemeToggle();
    this.ensureBootstrapBundle();
  }

  bindThemeToggle() {
    const toggle = this.querySelector("#globalThemeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
      document.body.classList.toggle("dark-mode", nextTheme === "dark");
      document.body.classList.toggle("light-mode", nextTheme !== "dark");
      localStorage.setItem("umbrellaTheme", nextTheme);
    });
  }

  ensureBootstrapBundle() {
    if (window.bootstrap || document.querySelector('script[data-bootstrap-bundle="true"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js";
    script.defer = true;
    script.dataset.bootstrapBundle = "true";
    document.body.appendChild(script);
  }
}

customElements.define("main-navbar-component", NavbarComponent);

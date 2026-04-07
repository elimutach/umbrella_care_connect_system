(() => {
  const SEARCH_LIMIT = 10;
  let currentUser = null;

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(value = "") {
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getFullName(user = {}) {
    return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "User";
  }

  function getFirstName(user = {}) {
    return user.first_name || getFullName(user).split(" ")[0] || "there";
  }

  function getProfilePhoto(user = {}) {
    const name = encodeURIComponent(getFullName(user));
    return user.profile_photo || `https://ui-avatars.com/api/?name=${name}&background=F4A623&color=fff&bold=true`;
  }

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = text;
    });
  }

  function setCurrentDate() {
    const dateText = new Date().toLocaleDateString("en-KE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    setText("#currentDate, #todayLabel, .navbar-date", dateText);
  }

  function updateUserUI(user) {
    currentUser = user;
    const firstName = getFirstName(user);
    const fullName = getFullName(user);
    const role = titleCase(user.role || "User");
    const photo = getProfilePhoto(user);

    setText(".navbar-greeting", `Hello, ${firstName}👋🏾`);

    const donorEyebrow = document.querySelector(".topbar .eyebrow");
    if (donorEyebrow && document.querySelector(".shell .sidebar")) {
      donorEyebrow.textContent = `Hello, ${firstName}👋🏾`;
    }

    document.querySelectorAll(".profile-chip").forEach((chip) => {
      const img = chip.querySelector("img");
      if (img) {
        img.src = photo;
        img.alt = `${fullName} profile`;
      }

      const nameNode =
        chip.querySelector(".profile-name") ||
        chip.querySelector("strong");
      if (nameNode) nameNode.textContent = fullName;

      const roleNode =
        chip.querySelector(".profile-role") ||
        chip.querySelector("span:last-child");
      if (roleNode && roleNode !== nameNode) roleNode.textContent = role;
    });

    window.dispatchEvent(new CustomEvent("umbrella:user-ready", { detail: user }));
  }

  function loadCurrentUser() {
    fetch("/api/me/", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((user) => {
        if (user) updateUserUI(user);
      })
      .catch((error) => {
        console.warn("Current user could not be loaded:", error);
      });
  }

  function normalizeLabel(value = "") {
    return titleCase(String(value || "").replaceAll("-", " ")).trim();
  }

  function normalizeSpaces(value = "") {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function truncateText(value = "", maxLength = 92) {
    const text = normalizeSpaces(value);
    if (text.length <= maxLength) return text;

    const clipped = text.slice(0, maxLength + 1);
    const lastSpace = clipped.lastIndexOf(" ");
    const safeText = lastSpace > 36 ? clipped.slice(0, lastSpace) : clipped.slice(0, maxLength);
    return `${safeText.trim()}...`;
  }

  function getPageDescription(page) {
    const descriptions = {
      analytics: "Open analytics overview and operational summary.",
      dashboard: "Open the main dashboard command center.",
      donations: "Review donations, donors, status and payment records.",
      needs: "Manage needs, fulfillment and donor support.",
      volunteers: "Open volunteer records and participation tools.",
      stock: "Open stock inventory and item movement.",
      reports: "Generate and export reports.",
      calendar: "Open events, schedules and calendar planning.",
      settings: "Open signed-in user settings.",
      messages: "Open dashboard messages.",
      overview: "Open donor overview.",
      events: "Open upcoming events.",
      history: "Open contribution history.",
      pledges: "Open donor pledges.",
      profile: "Open donor profile.",
      opportunities: "Open volunteer activities.",
      applications: "Open volunteer applications.",
    };
    return descriptions[page] || `Go to ${normalizeLabel(page)}.`;
  }

  function getSearchScope(input) {
    return (
      input.closest(".admin-main") ||
      input.closest(".volunteer-main") ||
      input.closest(".main") ||
      document.body
    );
  }

  function getSectionPage(node) {
    const section = node.closest(".app-page[data-page], .page[data-page], .page-pane[data-page]");
    return section ? section.dataset.page : "";
  }

  function getPageSelector(page) {
    return `.app-page[data-page="${page}"], .page[data-page="${page}"], .page-pane[data-page="${page}"]`;
  }

  function getNodeDescription(node, fallbackPage) {
    const card = node.closest("article, .panel, .panel-card, .stat-card, .dashboard-shortcut-card, .need-card, .event-card") || node.parentElement;
    const desc = card ? card.querySelector("p, small, .text-mute, .text-muted") : null;
    const descText = desc && desc !== node ? normalizeSpaces(desc.textContent) : "";
    return descText || getPageDescription(fallbackPage);
  }

  function collectSearchItems(input) {
    const scope = getSearchScope(input);
    const map = new Map();
    let order = 0;

    function add(page, title, description, selector) {
      const cleanTitle = normalizeSpaces(title || normalizeLabel(page));
      if (!cleanTitle || (!page && !selector)) return;

      const key = `${page || ""}:${cleanTitle.toLowerCase()}`;
      if (map.has(key)) return;
      map.set(key, {
        page,
        title: cleanTitle,
        description: normalizeSpaces(description || getPageDescription(page)),
        selector,
        order: order,
      });
      order += 1;
    }

    scope.querySelectorAll("[data-page], [data-page-target], [data-go], [data-go-page]").forEach((node) => {
      if (node.closest(".dashboard-search-results")) return;
      const page = node.dataset.page || node.dataset.pageTarget || node.dataset.go || node.dataset.goPage;
      const text = normalizeSpaces(node.textContent);
      add(page, text || normalizeLabel(page), getPageDescription(page));
    });

    scope.querySelectorAll(".app-page[data-page], .page[data-page], .page-pane[data-page]").forEach((section) => {
      const page = section.dataset.page;
      const heading = section.querySelector("h1, h2, h3, .panel-title");
      const desc = section.querySelector("p, .text-mute, .text-muted");
      add(page, heading ? heading.textContent : normalizeLabel(page), desc ? desc.textContent : getPageDescription(page), getPageSelector(page));
    });

    scope.querySelectorAll(".app-page[data-page] h1, .app-page[data-page] h2, .app-page[data-page] h3, .app-page[data-page] h4, .app-page[data-page] .panel-title, .page[data-page] h1, .page[data-page] h2, .page[data-page] h3, .page[data-page] h4, .page[data-page] .panel-title, .page-pane[data-page] h1, .page-pane[data-page] h2, .page-pane[data-page] h3, .page-pane[data-page] h4, .page-pane[data-page] .panel-title").forEach((node) => {
      if (node.closest(".dashboard-search-results")) return;
      const page = getSectionPage(node);
      add(page, node.textContent, getNodeDescription(node, page), getPageSelector(page));
    });

    return Array.from(map.values()).filter((item) => item.title);
  }

  function scoreSearchItem(item, query) {
    const title = item.title.toLowerCase();
    const page = String(item.page || "").toLowerCase();
    const description = item.description.toLowerCase();

    if (title === query || page === query) return 0;
    if (title.startsWith(query)) return 1;
    if (page.startsWith(query)) return 2;
    if (title.includes(query)) return 3;
    if (description.includes(query)) return 4;
    return 5;
  }

  function showPage(page) {
    const adminNav = document.querySelector(`.admin-sidebar .nav-item[data-page="${page}"]`);
    const donorNav = document.querySelector(`.shell .nav-item[data-page="${page}"]`);
    const volunteerNav = document.querySelector(`.volunteer-nav-item[data-page-target="${page}"]`);
    const nav = adminNav || donorNav || volunteerNav;

    if (nav) {
      nav.click();
      return;
    }

    document.querySelectorAll(".app-page, .page, .page-pane").forEach((section) => {
      if (!section.dataset.page) return;
      section.classList.toggle("active", section.dataset.page === page);
    });
  }

  function navigateToResult(item) {
    if (item.page) showPage(item.page);

    window.setTimeout(() => {
      const target =
        (item.selector && document.querySelector(item.selector)) ||
        document.querySelector(getPageSelector(item.page));

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);
  }

  function attachSearch(input) {
    if (!input || input.dataset.dashboardSearchReady === "true") return;
    input.dataset.dashboardSearchReady = "true";

    const parent = input.closest(".dashboard-search, .search-wrap") || input.parentElement;
    if (!parent) return;

    parent.classList.add("dashboard-search-host");

    const panel = document.createElement("div");
    panel.className = "dashboard-search-results is-hidden";
    panel.setAttribute("role", "listbox");
    parent.appendChild(panel);

    function render() {
      const query = input.value.trim().toLowerCase();
      if (!query) {
        panel.classList.add("is-hidden");
        panel.innerHTML = "";
        return;
      }

      const results = collectSearchItems(input)
        .filter((item) => {
          const haystack = `${item.title} ${item.description} ${item.page}`.toLowerCase();
          return haystack.includes(query);
        })
        .sort((a, b) => scoreSearchItem(a, query) - scoreSearchItem(b, query) || a.order - b.order)
        .slice(0, SEARCH_LIMIT);

      if (!results.length) {
        panel.innerHTML = `
          <div class="dashboard-search-empty">
            <strong>No results</strong>
            <span>Try another letter or dashboard section name.</span>
          </div>
        `;
        panel.classList.remove("is-hidden");
        return;
      }

      panel.innerHTML = results
        .map((item, index) => `
          <button class="dashboard-search-result" type="button" data-result-index="${index}">
            <span title="${escapeHtml(item.title)}">${escapeHtml(truncateText(item.title, 54))}</span>
            <small title="${escapeHtml(item.description)}">${escapeHtml(truncateText(item.description, 94))}</small>
          </button>
        `)
        .join("");

      panel.querySelectorAll("[data-result-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const item = results[Number(button.dataset.resultIndex)];
          panel.classList.add("is-hidden");
          navigateToResult(item);
        });
      });

      panel.classList.remove("is-hidden");
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", render);

    document.addEventListener("click", (event) => {
      if (!parent.contains(event.target)) panel.classList.add("is-hidden");
    });
  }

  function initSearch() {
    document
      .querySelectorAll(".dashboard-search input, .search-wrap input")
      .forEach(attachSearch);
  }

  function boot() {
    setCurrentDate();
    initSearch();
    loadCurrentUser();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("umbrella:user-updated", (event) => {
    if (event.detail) updateUserUI(event.detail);
  });
})();

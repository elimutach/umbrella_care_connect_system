(function () {
  const NEEDS_API_URL = "/needs/api/";
  const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80";
  const CLOSED_STATUSES = new Set(["closed", "fulfilled", "expired"]);

  const NEEDS_GRID = document.getElementById("needsGrid");
  const SEARCH_INPUT = document.getElementById("needSearch");
  const STATUS_FILTER = document.getElementById("statusFilter");
  const SORT_FILTER = document.getElementById("sortFilter");
  const THEME_TOGGLE = document.getElementById("themeToggle");
  const GLOBAL_MODAL = document.getElementById("globalModal");
  const GLOBAL_MODAL_CARD = document.getElementById("globalModalCard");
  const GLOBAL_MODAL_ICON = document.getElementById("globalModalIcon");
  const GLOBAL_MODAL_TITLE = document.getElementById("globalModalTitle");
  const GLOBAL_MODAL_TEXT = document.getElementById("globalModalText");
  const CLOSE_MODAL_BTN = document.getElementById("closeModalBtn");

  let needsCache = null;
  let needsLoadPromise = null;
  let needsLoadError = null;

  const currentState = {
    search: "",
    status: "open",
    sort: "latest",
  };

  function escapeHTML(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      if (arguments[index] !== null && typeof arguments[index] !== "undefined") {
        return arguments[index];
      }
    }

    return undefined;
  }

  function formatNumber(value) {
    const number = toNumber(value);
    if (Number.isInteger(number)) {
      return number.toLocaleString("en-KE");
    }
    return number.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatKES(value) {
    return `KES ${formatNumber(value)}`;
  }

  function formatNeedValue(amount, unit, needType) {
    const normalizedUnit = String(unit || "").trim();
    const normalizedType = String(needType || "").trim().toLowerCase();

    if (normalizedType === "cash" || normalizedUnit.toLowerCase() === "kes") {
      return formatKES(amount);
    }

    return `${formatNumber(amount)} ${normalizedUnit || "units"}`.trim();
  }

  function formatDate(value) {
    if (!value) return "Recently posted";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function truncateText(value, maxLength) {
    const text = String(value || "").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
  }

  function buildProgressGraph(raised, goal) {
    const target = Math.max(toNumber(goal), 1);
    const current = Math.max(toNumber(raised), 0);
    const steps = [0.12, 0.24, 0.38, 0.52, 0.68, 0.84, 1];

    return steps.map((step) => Math.min(current, Math.round(target * step)));
  }

  function needNeedsDonations(need) {
    return !CLOSED_STATUSES.has(need.status) && toNumber(need.quantityRemaining) > 0;
  }

  function normalizeNeed(rawNeed) {
    const raw = rawNeed || {};
    const needType = String(raw.need_type || raw.category || "cash").trim().toLowerCase();
    const unit = raw.unit || (needType === "cash" ? "KES" : "units");
    const goal = toNumber(firstDefined(raw.amount_needed, raw.quantity_required, raw.goal));
    const raised = toNumber(firstDefined(raw.amount_received, raw.quantity_fulfilled, raw.raised));
    const remaining = Math.max(
      toNumber(firstDefined(raw.quantity_remaining, raw.amount_remaining, goal - raised)),
      0
    );
    const donors = Array.isArray(raw.donors) ? raw.donors : [];
    const donorsCount = toNumber(firstDefined(raw.donors_count, raw.donor_count, raw.number_of_donors, donors.length));
    const description = String(raw.description || raw.summary || "This need is awaiting more details from the team.").trim();
    const createdAt = raw.created_at || raw.date || raw.updated_at || "";
    const status = String(raw.status || "active").toLowerCase();

    return {
      id: String(raw.id || raw.needs_registration_code || raw.title || "need"),
      registrationCode: raw.needs_registration_code || "",
      title: String(raw.title || "Untitled need").trim(),
      status,
      statusLabel: titleCase(status || "active"),
      date: formatDate(createdAt),
      rawDate: createdAt,
      summary: truncateText(description, 150),
      description,
      image: raw.image_url || raw.image || FALLBACK_IMAGE,
      goal,
      raised,
      quantityRemaining: remaining,
      donors: donorsCount,
      graph: Array.isArray(raw.graph) && raw.graph.length ? raw.graph.map(toNumber) : buildProgressGraph(raised, goal),
      comments: Array.isArray(raw.comments) ? raw.comments : [],
      updates: Array.isArray(raw.updates) && raw.updates.length
        ? raw.updates
        : [
            `Status is currently ${titleCase(status)}.`,
            remaining > 0
              ? `${formatNeedValue(remaining, unit, needType)} still needed.`
              : "This need has reached its current target.",
          ],
      needType,
      needTypeLabel: needType === "cash" ? "Cash" : "In-kind",
      unit,
      amountNeededDisplay: raw.display_amount_needed || formatNeedValue(goal, unit, needType),
      amountReceivedDisplay: raw.display_amount_received || formatNeedValue(raised, unit, needType),
      amountRemainingDisplay: raw.display_amount_remaining || formatNeedValue(remaining, unit, needType),
      progressPercent: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
      raw,
    };
  }

  function loadNeeds(options) {
    options = options || {};
    if (needsCache && !options.force) return needsCache;
    if (needsLoadPromise && !options.force) return needsLoadPromise;

    needsLoadPromise = fetch(NEEDS_API_URL, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (payload) {
          if (!response.ok) {
            throw new Error(payload.error || payload.message || "Failed to load needs.");
          }

          const rawNeeds = Array.isArray(payload) ? payload : payload.results || [];
          needsCache = rawNeeds.map(normalizeNeed);
          needsLoadError = null;
          window.UMBRELLA_NEEDS = needsCache;
          return needsCache;
        });
      })
      .catch(function (error) {
        needsLoadError = error;
        needsCache = [];
        window.UMBRELLA_NEEDS = needsCache;
        return needsCache;
      })
      .then(function (needs) {
        needsLoadPromise = null;
        return needs;
      });

    return needsLoadPromise;
  }

  function getNeedById(needId) {
    if (!needId) return Promise.resolve(null);

    return Promise.resolve(loadNeeds()).then(function (needs) {
      return needs.find(function (need) {
        return need.id === needId || need.registrationCode === needId;
      }) || null;
    });
  }

  function setTheme(theme) {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("umbrellaTheme", theme);
  }

  function hydrateTheme() {
    const saved = localStorage.getItem("umbrellaTheme") || "light";
    setTheme(saved);
  }

  function openModal(type, title, text) {
    if (!GLOBAL_MODAL || !GLOBAL_MODAL_CARD || !GLOBAL_MODAL_TITLE || !GLOBAL_MODAL_TEXT) {
      window.alert(text || title || "Action completed.");
      return;
    }

    GLOBAL_MODAL_CARD.classList.remove("error");
    if (GLOBAL_MODAL_ICON) {
      GLOBAL_MODAL_ICON.innerHTML = type === "error"
        ? '<i class="bi bi-x-circle"></i>'
        : '<i class="bi bi-check2-circle"></i>';
    }

    if (type === "error") {
      GLOBAL_MODAL_CARD.classList.add("error");
    }

    GLOBAL_MODAL_TITLE.textContent = title;
    GLOBAL_MODAL_TEXT.textContent = text;
    GLOBAL_MODAL.classList.remove("hidden");
  }

  function closeModal() {
    if (GLOBAL_MODAL) {
      GLOBAL_MODAL.classList.add("hidden");
    }
  }

  function saveNeedSelection(needId, amount) {
    localStorage.setItem("selectedNeedId", needId);
    localStorage.setItem("selectedAmount", String(amount || ""));
  }

  function getSelectedAmount(card) {
    const checked = card ? card.querySelector('input[name^="amount-"]:checked') : null;
    return checked ? checked.value : "custom";
  }

  function filteredNeeds(data) {
    let needs = [...data];

    if (currentState.search) {
      const query = currentState.search.toLowerCase();
      needs = needs.filter((item) =>
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.statusLabel.toLowerCase().includes(query) ||
        item.needTypeLabel.toLowerCase().includes(query)
      );
    }

    if (currentState.status === "open") {
      needs = needs.filter(needNeedsDonations);
    } else if (currentState.status !== "all") {
      needs = needs.filter((item) => item.status === currentState.status);
    }

    switch (currentState.sort) {
      case "target-high":
        needs.sort((a, b) => b.goal - a.goal);
        break;
      case "progress-high":
        needs.sort((a, b) => b.progressPercent - a.progressPercent);
        break;
      case "remaining-high":
        needs.sort((a, b) => b.quantityRemaining - a.quantityRemaining);
        break;
      case "donors-high":
        needs.sort((a, b) => b.donors - a.donors);
        break;
      default:
        needs.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
        break;
    }

    return needs;
  }

  function buildNeedCard(item) {
    const canDonate = needNeedsDonations(item);
    const escapedId = escapeHTML(item.id);
    const cashAmountOptions = item.needType === "cash"
      ? `
        <div class="amount-title">Select an amount</div>
        <div class="amount-options">
          <label class="amount-option kes-50">
            <input type="radio" name="amount-${escapedId}" value="50">
            <span>KES 50</span>
          </label>
          <label class="amount-option kes-500">
            <input type="radio" name="amount-${escapedId}" value="500">
            <span>KES 500</span>
          </label>
          <label class="amount-option kes-1000">
            <input type="radio" name="amount-${escapedId}" value="1000" checked>
            <span>KES 1000</span>
          </label>
          <label class="amount-option">
            <input type="radio" name="amount-${escapedId}" value="custom">
            <span>Custom</span>
          </label>
        </div>
      `
      : `
        <div class="need-kind-callout">
          <strong>In-kind need</strong>
          <span>Coordinate item quantity, delivery, or pledge support with the team.</span>
        </div>
      `;

    return `
      <article class="need-card" data-need-id="${escapedId}">
        <div class="need-card-media">
          <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}">
          <span class="need-status-pill">${escapeHTML(item.statusLabel)}</span>
        </div>

        <div class="need-card-body">
          <div class="need-head">
            <h3 class="need-title">${escapeHTML(item.title)}</h3>
            <div class="need-date">Date: ${escapeHTML(item.date)}</div>
          </div>

          <p class="need-desc">${escapeHTML(item.summary)}</p>

          <div class="need-meta">
            <div class="need-meta-block">
              <strong>Target:</strong>
              <span class="need-meta-highlight">${escapeHTML(item.amountNeededDisplay)}</span>
            </div>

            <div class="need-meta-block">
              <strong>Donors:</strong>
              <span class="need-meta-highlight">${formatNumber(item.donors)}</span>
            </div>
          </div>

          <div class="need-progress-row">
            <span class="raised">${escapeHTML(item.amountReceivedDisplay)}</span>
            out of ${escapeHTML(item.amountNeededDisplay)}
          </div>

          <div class="progress-track">
            <div class="progress-fill" style="width:${item.progressPercent}%"></div>
          </div>

          <div class="need-remaining">Remaining: ${escapeHTML(item.amountRemainingDisplay)}</div>

          ${cashAmountOptions}

          <div class="action-row">
            <button class="action-btn btn-pledge" data-action="pledge" ${canDonate ? "" : "disabled"}>Pledge</button>
            <button class="action-btn btn-donate" data-action="donate" ${canDonate ? "" : "disabled"}>Donate</button>
            <button class="action-btn btn-details" data-action="details">View Details</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderGridMessage(message) {
    if (!NEEDS_GRID) return;
    NEEDS_GRID.innerHTML = `<div class="no-results">${escapeHTML(message)}</div>`;
  }

  function renderNeeds() {
    if (!NEEDS_GRID) return;

    renderGridMessage("Loading live needs from the database...");
    Promise.resolve(loadNeeds()).then(function (needs) {
      const data = filteredNeeds(needs);

      if (needsLoadError) {
        renderGridMessage("We could not load live needs right now. Please refresh or try again shortly.");
        return;
      }

      if (!data.length) {
        renderGridMessage("No needs matched your search or filters.");
        return;
      }

      NEEDS_GRID.innerHTML = data.map(buildNeedCard).join("");
    });
  }

  function goToNeedFlow(pathname, needId, amount) {
    saveNeedSelection(needId, amount);
    window.location.href = `${pathname}?need=${encodeURIComponent(needId)}`;
  }

  function handleCardActions(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;

    const card = button.closest(".need-card");
    const needId = card && card.dataset ? card.dataset.needId : null;
    const selectedAmount = getSelectedAmount(card);

    if (!needId) {
      openModal("error", "Need not found", "The selected need could not be resolved.");
      return;
    }

    if (button.dataset.action === "pledge") {
      goToNeedFlow("/pledge/", needId, selectedAmount);
      return;
    }

    if (button.dataset.action === "details") {
      goToNeedFlow("/need-details/", needId, selectedAmount);
      return;
    }

    if (button.dataset.action === "donate") {
      saveNeedSelection(needId, selectedAmount);
      const query = selectedAmount === "custom"
        ? `need=${encodeURIComponent(needId)}&mode=custom`
        : `need=${encodeURIComponent(needId)}&amount=${encodeURIComponent(selectedAmount)}`;
      window.location.href = `/donate/?${query}`;
    }
  }

  function initEvents() {
    if (SEARCH_INPUT) {
      SEARCH_INPUT.addEventListener("input", function (event) {
        currentState.search = event.target.value.trim();
        renderNeeds();
      });
    }

    if (STATUS_FILTER) {
      STATUS_FILTER.addEventListener("change", function (event) {
        currentState.status = event.target.value;
        renderNeeds();
      });
    }

    if (SORT_FILTER) {
      SORT_FILTER.addEventListener("change", function (event) {
        currentState.sort = event.target.value;
        renderNeeds();
      });
    }

    if (NEEDS_GRID) {
      NEEDS_GRID.addEventListener("click", handleCardActions);
    }

    if (THEME_TOGGLE) {
      THEME_TOGGLE.addEventListener("click", function () {
        const next = document.body.classList.contains("dark-mode") ? "light" : "dark";
        setTheme(next);
      });
    }

    if (CLOSE_MODAL_BTN) {
      CLOSE_MODAL_BTN.addEventListener("click", closeModal);
    }

    if (GLOBAL_MODAL) {
      GLOBAL_MODAL.addEventListener("click", function (event) {
        if (event.target === GLOBAL_MODAL) closeModal();
      });
    }
  }

  window.UMBRELLA_NEEDS = window.UMBRELLA_NEEDS || [];
  window.UMBRELLA_NEEDS_API = {
    loadNeeds,
    getNeedById,
    formatKES,
    formatNeedValue,
    formatNumber,
    escapeHTML,
    needNeedsDonations,
  };
  window.UMBRELLA_UTILS = {
    formatKES,
    formatNeedValue,
    formatNumber,
    openModal,
  };
  window.UMBRELLA_NEEDS_READY = loadNeeds();

  hydrateTheme();
  initEvents();
  renderNeeds();
})();

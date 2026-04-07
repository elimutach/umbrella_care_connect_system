const API_BASE = "";

const NEEDS_API = `${API_BASE}/donations/api/donor/needs/`;
const HISTORY_API = `${API_BASE}/donations/api/donor/history/`;
const STATS_API = `${API_BASE}/donations/api/donor/stats/`;
const SUBMIT_DONATION_API = `${API_BASE}/donations/api/donor/submit/`;
const PLEDGES_API = `${API_BASE}/donations/api/donor/pledges/`;
const EVENTS_API = `${API_BASE}/calendar/events/`;

const state = {
  activePage: "overview",
  search: "",
  needStatus: "all",
  needSort: "latest",
  selectedAmounts: {},
  needs: [],
  events: [],
  history: [],
  stats: null,
  pledges: {
    active: [],
    past: []
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCookie(name) {
  const cookieValue = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return cookieValue ? decodeURIComponent(cookieValue.split("=")[1]) : "";
}

async function apiRequest(url, options = {}) {
  const method = options.method || "GET";
  const headers = {
    Accept: "application/json",
    ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    ...(method !== "GET" ? { "X-CSRFToken": getCookie("csrftoken") } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    method,
    headers
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {}

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }

  return data;
}

function formatNeedNumber(value) {
  const num = Number(value || 0);

  return num.toLocaleString("en-KE", {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function getNeedType(item) {
  return String(item.need_type || item.type || "in_kind").toLowerCase();
}

function getNeedUnit(item) {
  const type = getNeedType(item);
  const rawUnit = String(item.unit || "").trim();

  if (type === "cash") return "KES";
  if (rawUnit && rawUnit.toLowerCase() !== "kes") return rawUnit;

  return "units";
}

function getNeedGoal(item) {
  return Number(item.goal ?? item.amount_needed ?? item.quantity_required ?? 0);
}

function getNeedRaised(item) {
  return Number(item.raised ?? item.amount_received ?? item.quantity_fulfilled ?? 0);
}

function getNeedDonors(item) {
  return Number(item.donors ?? item.donors_count ?? 0);
}

function getNeedSummary(item) {
  return item.summary || item.description || "";
}

function formatNeedValue(item, value) {
  const type = getNeedType(item);
  const amount = formatNeedNumber(value);
  const unit = getNeedUnit(item);

  if (type === "cash") {
    return `KES ${amount}`;
  }

  return `${amount} ${unit}`;
}

function formatNeedStatus(status) {
  return String(status || "pending").replaceAll("_", " ").toUpperCase();
}

function formatNeedDate(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function parseMoneyValue(value) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isSuccessfulDonation(item = {}) {
  return ["confirmed", "received"].includes(String(item.status || "").toLowerCase());
}

function getEventBoundaryDate(item = {}, boundary = "start") {
  const raw =
    boundary === "end"
      ? item.endDate || item.date || item.startDate
      : item.date || item.startDate;

  if (!raw) return null;

  const rawText = String(raw);
  const parsed = new Date(rawText.includes("T") ? rawText : `${rawText}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isUpcomingEvent(item = {}) {
  const status = String(item.status || "scheduled").toLowerCase();
  if (["cancelled", "completed"].includes(status)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = getEventBoundaryDate(item, "end") || getEventBoundaryDate(item, "start");
  return Boolean(endDate && endDate >= today);
}

function setPage(page) {
  state.activePage = page;

  document.querySelectorAll(".page").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  document.getElementById("pageTitle").textContent =
    page.charAt(0).toUpperCase() + page.slice(1);

  document.getElementById("breadcrumbs").textContent =
    `Home / ${page.charAt(0).toUpperCase() + page.slice(1)}`;
}

function normalizeNeed(item = {}) {
  return {
    id: item.id,
    title: item.title || "Untitled need",
    status: String(item.status || "pending").toLowerCase(),
    date: item.date || item.created_at || item.expiring_at || "",
    summary: item.description || "No description provided.",
    image:
      item.image_url ||
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    goal: Number(item.amount_needed || 0),
    raised: Number(item.amount_received || 0),
    donors: Number(item.donor_count || 0),
    needType: item.need_type || "cash",
    unit: item.unit || "units",
    registrationCode: item.needs_registration_code || ""
  };
}

function normalizeEvent(item = {}) {
  const startDate =
    item.start_date ||
    item.date ||
    item.start ||
    (item.start_datetime ? String(item.start_datetime).slice(0, 10) : "");

  const startTime = item.start_time || "";
  const endTime = item.end_time || "";

  return {
    id: item.id,
    title: item.title || "Untitled event",
    date: startDate,
    startDate,
    endDate: item.end_date || startDate,
    status: item.status || "scheduled",
    time:
      item.all_day
        ? "All day"
        : [startTime, endTime].filter(Boolean).join(" - ") || "Time not set",
    venue: item.location || item.venue || "Location not set",
    summary: item.description || "No description provided."
  };
}

function filteredNeeds() {
  let data = [...state.needs];

  if (state.search) {
    const q = state.search.toLowerCase();
    data = data.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      item.needType.toLowerCase().includes(q) ||
      item.registrationCode.toLowerCase().includes(q)
    );
  }

  if (state.needStatus !== "all") {
    data = data.filter((item) => item.status === state.needStatus);
  }

  if (state.needSort === "goal") {
    data.sort((a, b) => b.goal - a.goal);
  } else if (state.needSort === "progress") {
    data.sort((a, b) => {
      const aPct = a.goal > 0 ? a.raised / a.goal : 0;
      const bPct = b.goal > 0 ? b.raised / b.goal : 0;
      return bPct - aPct;
    });
  } else {
    data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  return data;
}

function getPresetAmounts(item) {
  return getNeedType(item) === "cash"
    ? ["500", "1000", "5000", "custom"]
    : ["1", "5", "10", "custom"];
}

function formatPresetLabel(item, value) {
  if (value === "custom") return "Custom";
  return formatNeedValue(item, Number(value));
}

function buildNeedCard(item) {
  const goal = getNeedGoal(item);
  const raised = getNeedRaised(item);
  const donors = getNeedDonors(item);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const selected = state.selectedAmounts[item.id] || (getNeedType(item) === "cash" ? "1000" : "1");
  const presets = getPresetAmounts(item);

  return `
    <article class="need-card">
      <div class="need-media">
        <img src="${item.image}" alt="${item.title}">
        <span class="status-pill ${item.status}">${formatNeedStatus(item.status)}</span>
      </div>

      <div class="need-body">
        <div class="need-head">
          <h4>${item.title}</h4>
          <div class="need-date">${formatNeedDate(item.date || item.created_at || item.deadline)}</div>
        </div>

        <p class="need-desc">${getNeedSummary(item)}</p>

        <div class="need-meta">
          <div>
            <strong>Amount</strong>
            <span>${formatNeedValue(item, goal)}</span>
          </div>
          <div>
            <strong>Donors</strong>
            <span>${donors.toLocaleString("en-KE")}</span>
          </div>
        </div>

        <div class="progress-text">
          <span class="raised">${formatNeedValue(item, raised)}</span>
          out of ${formatNeedValue(item, goal)}
        </div>

        <div class="progress">
          <span style="width:${pct}%"></span>
        </div>

        <div class="amounts" data-need="${item.id}">
          ${presets
            .map((v) => `
              <button class="${selected === v ? "active" : ""}" data-amount="${v}">
                ${formatPresetLabel(item, v)}
              </button>
            `)
            .join("")}
        </div>

        <div class="action-row">
          <button class="pledge" data-action="pledge" data-id="${item.id}">Pledge</button>
          <button class="donate" data-action="donate" data-id="${item.id}">Donate</button>
          <button class="details" data-action="details" data-id="${item.id}">View Details</button>
        </div>
      </div>
    </article>
  `;
}

function renderNeeds() {
  const data = filteredNeeds();

  const markup =
    data.map(buildNeedCard).join("") ||
    `<div class="mini-card"><p>No needs matched the current filters.</p></div>`;

  document.getElementById("overviewNeeds").innerHTML = data
    .slice(0, 3)
    .map(buildNeedCard)
    .join("");

  document.getElementById("needsBoard").innerHTML = markup;
}

function renderEvents() {
  const upcoming = [...state.events]
    .filter(isUpcomingEvent)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const eventMarkup =
    upcoming.map((item) => `
      <article class="event-card">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.summary)}</p>
        <div class="meta-row">
          <span><i class="bi bi-calendar3"></i> ${escapeHtml(formatDate(item.date))}</span>
          <span><i class="bi bi-clock"></i> ${escapeHtml(item.time)}</span>
          <span><i class="bi bi-geo-alt"></i> ${escapeHtml(item.venue)}</span>
        </div>
      </article>
    `).join("") || `<div class="mini-card"><p>No upcoming events.</p></div>`;

  document.getElementById("eventsBoard").innerHTML = eventMarkup;

  document.getElementById("overviewEvents").innerHTML =
    upcoming.slice(0, 2).map((item) => `
      <article class="mini-card">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.summary)}</p>
        <div class="meta-row">
          <span>${escapeHtml(formatDate(item.date))}</span>
          <span>${escapeHtml(item.time)}</span>
        </div>
      </article>
    `).join("") || `<div class="mini-card"><p>No upcoming events.</p></div>`;
}

function renderHistory() {
  document.getElementById("historyTable").innerHTML =
    state.history.map((item) => `
      <tr>
        <td>${escapeHtml(item.datetime || "-")}</td>
        <td>${escapeHtml(item.reference_code || "-")}</td>
        <td>${escapeHtml(item.donation_type === "in_kind" ? "In kind" : "Donation")}</td>
        <td>${escapeHtml(item.donation_towards || "-")}</td>
        <td>${escapeHtml(item.amount || "-")}</td>
        <td><span class="badge ${escapeHtml(item.status || "pending")}">${escapeHtml(item.status_label || item.status || "-")}</span></td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="6">No donation history yet.</td>
      </tr>
    `;

  document.getElementById("overviewHistory").innerHTML =
    state.history.slice(0, 3).map((item) => `
      <article class="mini-card">
        <h4>${escapeHtml(item.method_label || "Donation")} · ${escapeHtml(item.amount || "-")}</h4>
        <p>${escapeHtml(item.donation_towards || "-")}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.datetime || "-")}</span>
          <span>${escapeHtml(item.reference_code || "-")}</span>
          <span class="badge ${escapeHtml(item.status || "pending")}">${escapeHtml(item.status_label || item.status || "-")}</span>
        </div>
      </article>
    `).join("") || `<div class="mini-card"><p>No recent activity yet.</p></div>`;
}

function renderPledges() {
  document.getElementById("activePledges").innerHTML =
    state.pledges.active.map((item) => `
      <article class="pledge-card">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.amount_label)}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.frequency)}</span>
          <span>Next: ${escapeHtml(formatDate(item.next_due_date))}</span>
          <span class="badge ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
        </div>
      </article>
    `).join("") || `<div class="mini-card"><p>No active pledges.</p></div>`;

  document.getElementById("pastPledges").innerHTML =
    state.pledges.past.map((item) => `
      <article class="pledge-card">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.amount_label)}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.frequency)}</span>
          <span>${escapeHtml(formatDate(item.next_due_date))}</span>
          <span class="badge ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
        </div>
      </article>
    `).join("") || `<div class="mini-card"><p>No past pledges.</p></div>`;
}

function renderStats() {
  if (state.stats) {
    document.getElementById("statTotalDonated").textContent =
      state.stats.total_donated_label || formatKES(state.stats.total_donated || 0);
    document.getElementById("statActivePledges").textContent = String(state.stats.active_pledges || 0);
    document.getElementById("statNeedsSupported").textContent = String(state.stats.needs_supported || 0);
    document.getElementById("statUpcomingEvents").textContent = String(state.stats.upcoming_events || 0);
    return;
  }

  const totalConfirmedCash = state.history.reduce((sum, item) => {
    if (!isSuccessfulDonation(item) || item.donation_type === "in_kind") return sum;
    return sum + Number(item.amount_value || parseMoneyValue(item.amount) || 0);
  }, 0);

  const supportedNeedIds = new Set();
  state.history.forEach((item) => {
    if (!isSuccessfulDonation(item)) return;

    const supportKey =
      item.need_id ||
      item.donation_towards ||
      item.item_name ||
      item.reference_code;

    if (supportKey) supportedNeedIds.add(String(supportKey).toLowerCase());
  });

  const activePledgeCount = state.pledges.active.filter((item) => (
    String(item.status || "active").toLowerCase() === "active"
  )).length;
  const upcomingCount = state.events.filter(isUpcomingEvent).length;

  document.getElementById("statTotalDonated").textContent = formatKES(totalConfirmedCash);
  document.getElementById("statActivePledges").textContent = String(activePledgeCount);
  document.getElementById("statNeedsSupported").textContent = String(supportedNeedIds.size);
  document.getElementById("statUpcomingEvents").textContent = String(upcomingCount);
}

function openModal(html) {
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("actionModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("actionModal").classList.add("hidden");
}

function findNeed(id) {
  return state.needs.find((x) => String(x.id) === String(id));
}

async function submitDonation(needId) {
  const need = findNeed(needId);
  if (!need) return;

  const notes = document.getElementById("donationNotes")?.value?.trim() || "";

  if (need.needType === "cash") {
    const amount = Number(document.getElementById("donationAmount")?.value || 0);
    if (!amount || amount <= 0) {
      alert("Enter a valid donation amount.");
      return;
    }

    await apiRequest(SUBMIT_DONATION_API, {
      method: "POST",
      body: JSON.stringify({
        need_id: needId,
        donation_type: "cash",
        amount,
        notes
      })
    });
  } else {
    const quantity = Number(document.getElementById("donationQuantity")?.value || 0);
    const itemName = document.getElementById("donationItemName")?.value?.trim() || "";
    const unit = document.getElementById("donationUnit")?.value?.trim() || need.unit || "units";
    const itemDescription = document.getElementById("donationItemDescription")?.value?.trim() || "";

    if (!quantity || quantity <= 0) {
      alert("Enter a valid quantity.");
      return;
    }

    if (!itemName) {
      alert("Item name is required.");
      return;
    }

    await apiRequest(SUBMIT_DONATION_API, {
      method: "POST",
      body: JSON.stringify({
        need_id: needId,
        donation_type: "in_kind",
        quantity,
        item_name: itemName,
        unit,
        item_description: itemDescription,
        notes
      })
    });
  }

  closeModal();
  await loadDashboardData();
  setPage("history");
}

async function submitPledge(needId) {
  const need = findNeed(needId);
  if (!need) return;

  if (need.needType !== "cash") {
    alert("Only cash needs can be pledged.");
    return;
  }

  const amount = Number(document.getElementById("pledgeAmount")?.value || 0);
  const frequency = document.getElementById("pledgeFrequency")?.value || "monthly";
  const startDate = document.getElementById("pledgeStartDate")?.value || "";
  const notes = document.getElementById("pledgeNotes")?.value?.trim() || "";

  if (!amount || amount <= 0) {
    alert("Enter a valid pledge amount.");
    return;
  }

  await apiRequest(PLEDGES_API, {
    method: "POST",
    body: JSON.stringify({
      need_id: needId,
      amount,
      frequency,
      start_date: startDate,
      notes
    })
  });

  closeModal();
  await loadDashboardData();
  setPage("pledges");
}

function handleNeedAction(action, id) {
  const need = findNeed(id);
  if (!need) return;

  const selected = state.selectedAmounts[id] || "1000";
  const presetAmount = selected === "custom" ? "" : selected;

  if (action === "details") {
    openModal(`
      <h3>${escapeHtml(need.title)}</h3>
      <p style="color:var(--muted);line-height:1.8;">${escapeHtml(need.summary)}</p>
      <div class="meta-row">
        <span>Goal: ${escapeHtml(formatKES(need.goal))}</span>
        <span>Raised: ${escapeHtml(formatKES(need.raised))}</span>
        <span>Donors: ${escapeHtml(String(need.donors))}</span>
      </div>
      <div class="modal-actions">
        <button class="primary-btn" onclick="handleNeedAction('donate','${escapeHtml(id)}')">Donate</button>
        <button class="ghost-btn" onclick="handleNeedAction('pledge','${escapeHtml(id)}')">Pledge</button>
      </div>
    `);
    return;
  }

  if (action === "donate") {
    if (need.needType === "cash") {
      openModal(`
        <h3>Donate to ${escapeHtml(need.title)}</h3>
        <div style="display:grid;gap:12px">
          <input id="donationAmount" class="input" type="number" min="1" step="0.01" value="${escapeHtml(presetAmount)}" placeholder="Amount in KES">
          <textarea id="donationNotes" class="input" placeholder="Optional note"></textarea>
          <button class="primary-btn" onclick="submitDonation('${escapeHtml(id)}')">Submit donation</button>
        </div>
      `);
    } else {
      openModal(`
        <h3>Donate items to ${escapeHtml(need.title)}</h3>
        <div style="display:grid;gap:12px">
          <input id="donationItemName" class="input" placeholder="Item name">
          <input id="donationQuantity" class="input" type="number" min="1" step="0.01" placeholder="Quantity">
          <input id="donationUnit" class="input" value="${escapeHtml(need.unit)}" placeholder="Unit">
          <textarea id="donationItemDescription" class="input" placeholder="Optional item description"></textarea>
          <textarea id="donationNotes" class="input" placeholder="Optional note"></textarea>
          <button class="primary-btn" onclick="submitDonation('${escapeHtml(id)}')">Submit donation</button>
        </div>
      `);
    }
    return;
  }

  openModal(`
    <h3>Create pledge for ${escapeHtml(need.title)}</h3>
    <div style="display:grid;gap:12px">
      <input id="pledgeAmount" class="input" type="number" min="1" step="0.01" value="${escapeHtml(presetAmount)}" placeholder="Pledge amount in KES">
      <select id="pledgeFrequency" class="input">
        <option value="weekly">Weekly</option>
        <option value="biweekly">Every 2 weeks</option>
        <option value="monthly" selected>Monthly</option>
        <option value="quarterly">Quarterly</option>
      </select>
      <input id="pledgeStartDate" class="input" type="date">
      <textarea id="pledgeNotes" class="input" placeholder="Optional note"></textarea>
      <button class="primary-btn" onclick="submitPledge('${escapeHtml(id)}')">Save pledge</button>
    </div>
  `);
}

async function loadDashboardData() {
  const [needsData, historyData, pledgesData, eventsData, statsData] = await Promise.all([
    apiRequest(`${NEEDS_API}?status=${encodeURIComponent(state.needStatus === "all" ? "all" : state.needStatus)}&search=${encodeURIComponent(state.search)}`),
    apiRequest(HISTORY_API),
    apiRequest(PLEDGES_API),
    apiRequest(EVENTS_API),
    apiRequest(STATS_API)
  ]);

  state.needs = (needsData.results || []).map(normalizeNeed);
  state.history = historyData.results || [];
  state.pledges = {
    active: pledgesData.active || [],
    past: pledgesData.past || []
  };
  state.events = (Array.isArray(eventsData) ? eventsData : (eventsData.results || [])).map(normalizeEvent);
  state.stats = statsData || null;

  renderNeeds();
  renderEvents();
  renderHistory();
  renderPledges();
  renderStats();
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => setPage(btn.dataset.page));
  });

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => setPage(btn.dataset.go));
  });

  document.getElementById("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(
      "donor-dashboard-theme",
      document.body.classList.contains("dark-mode") ? "dark" : "light"
    );
  });

  document.getElementById("globalSearch").addEventListener("input", async (e) => {
    state.search = e.target.value.trim();
    await loadDashboardData();
  });

  document.getElementById("needStatusFilter").addEventListener("change", async (e) => {
    state.needStatus = e.target.value;
    await loadDashboardData();
  });

  document.getElementById("needSortFilter").addEventListener("change", (e) => {
    state.needSort = e.target.value;
    renderNeeds();
  });

  document.body.addEventListener("click", (e) => {
    const amountBtn = e.target.closest(".amounts button");
    if (amountBtn) {
      const wrap = amountBtn.closest(".amounts");
      const needId = wrap.dataset.need;
      state.selectedAmounts[needId] = amountBtn.dataset.amount;
      renderNeeds();
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      handleNeedAction(actionBtn.dataset.action, actionBtn.dataset.id);
    }
  });

  document.getElementById("closeModal").addEventListener("click", closeModal);

  document.getElementById("actionModal").addEventListener("click", (e) => {
    if (e.target.id === "actionModal") {
      closeModal();
    }
  });
}

function initTheme() {
  if (localStorage.getItem("donor-dashboard-theme") === "dark") {
    document.body.classList.add("dark-mode");
  }
}

async function init() {
  initTheme();
  bindEvents();

  try {
    await loadDashboardData();
  } catch (error) {
    console.error("Donor dashboard load error:", error);
    document.getElementById("overviewNeeds").innerHTML =
      `<div class="mini-card"><p>Failed to load donor dashboard data.</p></div>`;
    document.getElementById("overviewEvents").innerHTML =
      `<div class="mini-card"><p>Failed to load events.</p></div>`;
    document.getElementById("overviewHistory").innerHTML =
      `<div class="mini-card"><p>Failed to load history.</p></div>`;
  }
}

window.handleNeedAction = handleNeedAction;
window.submitDonation = submitDonation;
window.submitPledge = submitPledge;

init();

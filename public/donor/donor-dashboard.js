const API_BASE = "";
const state = {
  activePage: "overview",
  search: "",
  needStatus: "all",
  needSort: "latest",
  selectedAmounts: {}
};

const demoNeeds = [
  {
    id: "n1",
    title: "Blankets",
    status: "active",
    date: "06 Apr 2026",
    summary: "Blankets needed for the children",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
    goal: 57,
    raised: 0,
    donors: 0,
    need_type: "in_kind",
    unit: "blankets"
  },
  {
    id: "n2",
    title: "Rice Bags",
    status: "partially_funded",
    date: "02 Apr 2026",
    summary: "Rice bags needed for food support.",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80",
    goal: 20,
    raised: 10,
    donors: 2,
    need_type: "in_kind",
    unit: "bags"
  },
  {
    id: "n3",
    title: "School Fees Support",
    status: "partially_funded",
    date: "02 Apr 2026",
    summary: "Support school fees for the children.",
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    goal: 50000,
    raised: 15000,
    donors: 2,
    need_type: "cash",
    unit: "KES"
  }
];

const demoEvents = [
  {
    id: "e1",
    title: "Children Home Visit",
    date: "12 Apr 2026",
    time: "10:00 AM",
    venue: "Umbrella Children Home",
    summary: "Donor visit and live impact briefing with the operations team."
  },
  {
    id: "e2",
    title: "Quarterly Donor Briefing",
    date: "25 Apr 2026",
    time: "2:00 PM",
    venue: "Zoom / Hybrid",
    summary: "Leadership update on priority needs, projects and pledge performance."
  },
  {
    id: "e3",
    title: "Community Food Drive",
    date: "04 May 2026",
    time: "9:00 AM",
    venue: "Nairobi Collection Hub",
    summary: "Mobilisation event for food and hygiene supplies."
  }
];

const demoHistory = [
  {
    date: "04 Apr 2026",
    reference: "#UCC1A9D2",
    type: "Donation",
    towards: "10 Metallic Beds",
    amount: "KES 1,000",
    status: "confirmed"
  },
  {
    date: "18 Mar 2026",
    reference: "#UCC9K3Q2",
    type: "Donation",
    towards: "Food and Clothes Support",
    amount: "KES 5,000",
    status: "received"
  },
  {
    date: "01 Mar 2026",
    reference: "#UCC7M2N9",
    type: "Pledge",
    towards: "School Fees Balance",
    amount: "KES 2,500 / month",
    status: "active"
  },
  {
    date: "16 Feb 2026",
    reference: "#UCC6W0X5",
    type: "Donation",
    towards: "Medical Care Fund",
    amount: "KES 3,000",
    status: "confirmed"
  }
];

const demoPledges = [
  {
    id: "p1",
    title: "School Fees Balance",
    amount: "KES 2,500 / month",
    schedule: "Every month",
    nextCharge: "01 May 2026",
    status: "active"
  },
  {
    id: "p2",
    title: "Food and Clothes Support",
    amount: "KES 1,000 / 2 weeks",
    schedule: "Every 2 weeks",
    nextCharge: "18 Apr 2026",
    status: "active"
  },
  {
    id: "p3",
    title: "Medical Care Fund",
    amount: "KES 1,500 / month",
    schedule: "Cancelled",
    nextCharge: "-",
    status: "cancelled"
  }
];

function formatKES(value) {
  return `KES ${Number(value).toLocaleString("en-KE")}`;
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

function getPresetAmounts(item) {
  return getNeedType(item) === "cash"
    ? ["500", "1000", "5000", "custom"]
    : ["1", "5", "10", "custom"];
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

function formatPresetLabel(item, value) {
  if (value === "custom") return "Custom";
  return formatNeedValue(item, Number(value));
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

function filteredNeeds() {
  let data = [...demoNeeds];

  if (state.search) {
    const q = state.search.toLowerCase();
    data = data.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  }

  if (state.needStatus !== "all") {
    data = data.filter((item) => item.status === state.needStatus);
  }

  if (state.needSort === "goal") {
    data.sort((a, b) => b.goal - a.goal);
  } else if (state.needSort === "progress") {
    data.sort((a, b) => (b.raised / b.goal) - (a.raised / a.goal));
  } else {
    data.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return data;
}

function buildNeedCard(item) {
  const pct = Math.min(100, Math.round((item.raised / item.goal) * 100));
  const selected = state.selectedAmounts[item.id] || (getNeedType(item) === "cash" ? "1000" : "1");
  const presets = getPresetAmounts(item);

  return `
    <article class="need-card">
      <div class="need-media">
        <img src="${item.image}" alt="${item.title}">
        <span class="status-pill ${item.status}">${item.status}</span>
      </div>

      <div class="need-body">
        <div class="need-head">
          <h4>${item.title}</h4>
          <div class="need-date">${item.date}</div>
        </div>

        <p class="need-desc">${item.summary}</p>

        <div class="need-meta">
          <div>
            <strong>Amount</strong>
            <span>${formatNeedValue(item, item.goal)}</span>
          </div>
          <div>
            <strong>Donors</strong>
            <span>${item.donors.toLocaleString("en-KE")}</span>
          </div>
        </div>

        <div class="progress-text">
          <span class="raised">${formatNeedValue(item, item.raised)}</span>
          out of ${formatNeedValue(item, item.goal)}
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
  const eventMarkup = demoEvents
    .map((item) => `
      <article class="event-card">
        <h4>${item.title}</h4>
        <p>${item.summary}</p>
        <div class="meta-row">
          <span><i class="bi bi-calendar3"></i> ${item.date}</span>
          <span><i class="bi bi-clock"></i> ${item.time}</span>
          <span><i class="bi bi-geo-alt"></i> ${item.venue}</span>
        </div>
      </article>
    `)
    .join("");

  document.getElementById("eventsBoard").innerHTML = eventMarkup;

  document.getElementById("overviewEvents").innerHTML = demoEvents
    .slice(0, 2)
    .map((item) => `
      <article class="mini-card">
        <h4>${item.title}</h4>
        <p>${item.summary}</p>
        <div class="meta-row">
          <span>${item.date}</span>
          <span>${item.time}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderHistory() {
  document.getElementById("historyTable").innerHTML = demoHistory
    .map((item) => `
      <tr>
        <td>${item.date}</td>
        <td>${item.reference}</td>
        <td>${item.type}</td>
        <td>${item.towards}</td>
        <td>${item.amount}</td>
        <td><span class="badge ${item.status}">${item.status}</span></td>
      </tr>
    `)
    .join("");

  document.getElementById("overviewHistory").innerHTML = demoHistory
    .slice(0, 3)
    .map((item) => `
      <article class="mini-card">
        <h4>${item.type} · ${item.amount}</h4>
        <p>${item.towards}</p>
        <div class="meta-row">
          <span>${item.date}</span>
          <span>${item.reference}</span>
          <span class="badge ${item.status}">${item.status}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderPledges() {
  document.getElementById("activePledges").innerHTML = demoPledges
    .filter((x) => x.status === "active")
    .map((item) => `
      <article class="pledge-card">
        <h4>${item.title}</h4>
        <p>${item.amount}</p>
        <div class="meta-row">
          <span>${item.schedule}</span>
          <span>Next: ${item.nextCharge}</span>
          <span class="badge active">${item.status}</span>
        </div>
      </article>
    `)
    .join("");

  document.getElementById("pastPledges").innerHTML = demoPledges
    .filter((x) => x.status !== "active")
    .map((item) => `
      <article class="pledge-card">
        <h4>${item.title}</h4>
        <p>${item.amount}</p>
        <div class="meta-row">
          <span>${item.schedule}</span>
          <span>${item.nextCharge}</span>
          <span class="badge ${item.status}">${item.status}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderStats() {
  const total = 1000 + 5000 + 3000;

  document.getElementById("statTotalDonated").textContent = formatKES(total);
  document.getElementById("statActivePledges").textContent =
    demoPledges.filter((x) => x.status === "active").length;
  document.getElementById("statNeedsSupported").textContent =
    new Set(demoHistory.map((x) => x.towards)).size;
  document.getElementById("statUpcomingEvents").textContent = demoEvents.length;
}

function openModal(html) {
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("actionModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("actionModal").classList.add("hidden");
}

function findNeed(id) {
  return demoNeeds.find((x) => x.id === id);
}

function handleNeedAction(action, id) {
  const need = findNeed(id);
  if (!need) return;

  const amount = state.selectedAmounts[id] || (getNeedType(need) === "cash" ? "1000" : "1");

  if (action === "details") {
    openModal(`
      <h3>${need.title}</h3>
      <p style="color:var(--muted);line-height:1.8;">${need.summary}</p>
      <div class="meta-row">
        <span>Goal: ${formatKES(need.goal)}</span>
        <span>Raised: ${formatKES(need.raised)}</span>
        <span>Donors: ${need.donors.toLocaleString("en-KE")}</span>
      </div>
      <div class="modal-actions">
        <button class="primary-btn" onclick="handleNeedAction('donate','${id}')">Donate</button>
        <button class="ghost-btn" onclick="handleNeedAction('pledge','${id}')">Pledge</button>
      </div>
    `);
    return;
  }

  if (action === "donate") {
    openModal(`
      <h3>Donate to ${need.title}</h3>
      <p style="color:var(--muted);line-height:1.8;">
        Selected amount: ${amount === "custom" ? "Custom amount" : formatNeedValue(need, Number(amount))}
      </p>
      <div class="modal-actions">
        <input class="input" placeholder="M-Pesa phone / card reference">
        <button class="primary-btn" onclick="closeModal()">Submit donation</button>
      </div>
    `);
    return;
  }

  openModal(`
    <h3>Create pledge for ${need.title}</h3>
    <p style="color:var(--muted);line-height:1.8;">
      Preset amount: ${amount === "custom" ? "Custom amount" : formatNeedValue(need, Number(amount))}
    </p>
    <div style="display:grid;gap:12px">
      <select class="input">
        <option>Every 2 days</option>
        <option>Every 3 days</option>
        <option>Every 2 weeks</option>
        <option>Every 1 month</option>
        <option>Every 2 months</option>
      </select>
      <input class="input" type="date">
      <button class="primary-btn" onclick="closeModal()">Save pledge</button>
    </div>
  `);
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

  document.getElementById("globalSearch").addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    renderNeeds();
  });

  document.getElementById("needStatusFilter").addEventListener("change", (e) => {
    state.needStatus = e.target.value;
    renderNeeds();
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

function init() {
  initTheme();
  renderStats();
  renderEvents();
  renderHistory();
  renderPledges();
  renderNeeds();
  bindEvents();
}

init();

fetch("/api/me/", { credentials: "include" })

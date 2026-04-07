
  const API = {
    activities: "/api/volunteer/activities/",
    applications: "/api/volunteer/applications/",
    me: "/api/volunteer/me/",
    calendarEvents: "/calendar/events/"
  };

  const ENABLE_DEMO_FALLBACK = false;

  const demoActivities = [
    {
      id: "2dff2b3f-1",
      slug: "feeding-day-kasarani",
      title: "Feeding Day Support",
      description: "Support food distribution, queue coordination, child guidance and cleanup for the outreach day.",
      image_url: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80",
      is_active: true,
      number_of_volunteers: 18,
      slots_taken: 9,
      slots_remaining: 9
    },
    {
      id: "2dff2b3f-2",
      slug: "reading-club",
      title: "Weekend Reading Club",
      description: "Help children through reading exercises, story time and literacy support sessions.",
      image_url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80",
      is_active: true,
      number_of_volunteers: 12,
      slots_taken: 5,
      slots_remaining: 7
    },
    {
      id: "2dff2b3f-3",
      slug: "compound-cleanup",
      title: "Compound Clean-up Drive",
      description: "Outdoor cleanup, sorting, yard organization and sanitation work around the home grounds.",
      image_url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
      is_active: true,
      number_of_volunteers: 10,
      slots_taken: 3,
      slots_remaining: 7
    }
  ];

  const demoCalendarEvents = [
    {
      id: "evt-1",
      title: "Staff Briefing",
      description: "General operations briefing.",
      start_date: "2026-04-11",
      end_date: "2026-04-11",
      start_time: "07:00",
      end_time: "08:00",
      all_day: false,
      color: "#2563eb",
      status: "scheduled",
      position: 0
    },
    {
      id: "evt-2",
      title: "Food Donation Delivery",
      description: "Receiving and counting stock.",
      start_date: "2026-04-11",
      end_date: "2026-04-11",
      start_time: "10:30",
      end_time: "12:00",
      all_day: false,
      color: "#7c3aed",
      status: "scheduled",
      position: 1
    },
    {
      id: "evt-3",
      title: "Monthly Cleanup Window",
      description: "All-day compound maintenance.",
      start_date: "2026-04-14",
      end_date: "2026-04-15",
      all_day: true,
      color: "#0f766e",
      status: "tentative",
      position: 0
    }
  ];

  const demoApplications = [
    {
      id: "app-1",
      application_code: "VAC-2026-001",
      first_name: "Jeff",
      last_name: "Volunteer",
      phone: "+254700000001",
      email: "volunteer@example.com",
      county: "Nairobi",
      id_passport: "12345678",
      passport_photo_url: "",
      activity_id: "2dff2b3f-1",
      activity_title: "Feeding Day Support",
      status: "approved",
      notes: "Report by 8:00 AM at the main gate.",
      created_at: "2026-04-01T08:30:00Z",
      scheduled_start: "2026-04-11T08:00:00Z",
      scheduled_end: "2026-04-11T13:00:00Z"
    },
    {
      id: "app-2",
      application_code: "VAC-2026-002",
      first_name: "Jeff",
      last_name: "Volunteer",
      phone: "+254700000001",
      email: "volunteer@example.com",
      county: "Nairobi",
      id_passport: "12345678",
      passport_photo_url: "",
      activity_id: "2dff2b3f-2",
      activity_title: "Weekend Reading Club",
      status: "pending",
      notes: "Awaiting review.",
      created_at: "2026-04-03T10:20:00Z"
    },
    {
      id: "app-3",
      application_code: "VAC-2026-003",
      first_name: "Jeff",
      last_name: "Volunteer",
      phone: "+254700000001",
      email: "volunteer@example.com",
      county: "Kiambu",
      id_passport: "12345678",
      passport_photo_url: "",
      activity_id: "2dff2b3f-3",
      activity_title: "Compound Clean-up Drive",
      status: "reviewing",
      notes: "Shortlist under review.",
      created_at: "2026-04-02T14:45:00Z"
    }
  ];

  const state = {
    activities: [],
    applications: [],
    filteredActivities: [],
    filteredApplications: [],
    selectedActivity: null,
    calendarDate: new Date(),
    selectedCalendarDate: new Date(),
    activePage: "dashboard",
    applyStep: 1,
    profile: null,
    calendarEvents: [],
    assignments: []
  };

  const el = (selector, scope = document) => scope.querySelector(selector);
  const els = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(dateLike, options = { dateStyle: "medium" }) {
    if (!dateLike) return "—";
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-KE", options).format(d);
  }

  function getCookie(name) {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="));
    return cookieValue ? decodeURIComponent(cookieValue.split("=")[1]) : null;
  }

  function showToast(text, type = "info", title = "") {
    const stack = el("#toastStack");
    if (!stack) {
      console[type === "error" ? "error" : "log"](text);
      return;
    }

    const label =
      title || (type === "success" ? "Success" : type === "error" ? "Error" : "Info");

    if (stack.children.length >= 10) {
      stack.removeChild(stack.firstElementChild);
    }

    const toast = document.createElement("div");
    toast.className = `app-toast ${type}`;
    const duration = type === "error" ? 6500 : 5000;

    toast.innerHTML = `
      <div class="app-toast-head">
        <div class="app-toast-icon">
          <i class="bi ${
            type === "success"
              ? "bi-check2-circle"
              : type === "error"
              ? "bi-x-circle"
              : "bi-info-circle"
          }"></i>
        </div>
        <div style="min-width:0;">
          <div class="app-toast-title">${escapeHtml(label)}</div>
          <div class="app-toast-text">${escapeHtml(text)}</div>
        </div>
        <button class="app-toast-close" type="button">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="app-toast-progress" style="animation-duration:${duration}ms;"></div>
    `;

    const remove = () => {
      if (toast.classList.contains("removing")) return;
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector(".app-toast-close")?.addEventListener("click", remove);
    stack.appendChild(toast);
    setTimeout(remove, duration);
  }

  async function safeFetchJSON(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
      headers["X-CSRFToken"] = getCookie("csrftoken") || "";
    }

    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Request failed with status ${response.status}`
      );
    }

    return data;
  }

  function normalizeCalendarEvent(event = {}) {
    const startDate =
      event.start_date ||
      event.date ||
      event.start ||
      (event.start_datetime ? String(event.start_datetime).slice(0, 10) : "");

    const endDate =
      event.end_date ||
      event.end ||
      startDate;

    const startTime =
      event.start_time ||
      (event.start_datetime ? String(event.start_datetime).slice(11, 16) : "");

    const endTime =
      event.end_time ||
      (event.end_datetime ? String(event.end_datetime).slice(11, 16) : "");

    return {
      ...event,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      title: event.title || "Untitled event",
      description: event.description || "",
      color: event.color || "#2563eb",
      status: event.status || "scheduled",
      all_day: Boolean(event.all_day),
      position: Number(event.position || 0)
    };
  }

  function setTodayLabel() {
    const todayLabel = el("#todayLabel");
    if (!todayLabel) return;

    todayLabel.textContent = new Intl.DateTimeFormat("en-KE", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(new Date());
  }

  function switchPage(page) {
    state.activePage = page;

    els(".volunteer-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.pageTarget === page);
    });

    els(".page-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.page === page);
    });
  }

  function initNavigation() {
    els(".volunteer-nav-item").forEach((item) => {
      item.addEventListener("click", () => switchPage(item.dataset.pageTarget));
    });

    els("[data-jump-page]").forEach((btn) => {
      btn.addEventListener("click", () => switchPage(btn.dataset.jumpPage));
    });
  }

  function initTheme() {
    const applyTheme = (isDark) => {
      document.body.classList.toggle("dark-mode", isDark);
      document.body.classList.toggle("light-mode", !isDark);
    };

    const saved = localStorage.getItem("volunteer-dashboard-theme");
    applyTheme(saved === "dark");

    [el("#themeToggle"), el("#themeToggleSide")].forEach((btn) => {
      btn?.addEventListener("click", () => {
        const isDark = !document.body.classList.contains("dark-mode");
        applyTheme(isDark);
        localStorage.setItem("volunteer-dashboard-theme", isDark ? "dark" : "light");
      });
    });
  }

  async function loadProfile() {
    try {
      const data = await safeFetchJSON(API.me);
      state.profile = data;
    } catch (error) {
      if (ENABLE_DEMO_FALLBACK) {
        state.profile = {
          first_name: "Jeff",
          last_name: "Volunteer",
          phone: "+254700000001",
          email: "volunteer@example.com",
          county: "Nairobi",
          username: "jeff.volunteer",
          role: "volunteer",
          status: "active",
          verified: true,
          reg_code: "VOL-DEMO-001",
          created_at: "2026-03-28T09:20:00Z",
          updated_at: new Date().toISOString(),
          profile_photo: "https://i.pravatar.cc/140?img=12"
        };
      } else {
        console.error("Profile load failed:", error);
      }
    }

    if (state.profile) {
      const displayName =
        [state.profile.first_name, state.profile.last_name].filter(Boolean).join(" ") ||
        state.profile.name ||
        "Volunteer";

      const profileNameChip = el("#profileNameChip");
      if (profileNameChip) profileNameChip.textContent = displayName;

      prefillApplyForm();
      populateSettings(state.profile);
    }
  }

  async function loadActivities() {
    try {
      const data = await safeFetchJSON(API.activities);
      state.activities = Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
    } catch (error) {
      if (!ENABLE_DEMO_FALLBACK) throw error;
      state.activities = demoActivities;
      showToast(
        "Backend activities endpoint is not ready, so demo data is rendering instead.",
        "info"
      );
    }

    filterActivities();
  }

  async function loadApplications() {
    try {
      const data = await safeFetchJSON(API.applications);
      state.applications = Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
    } catch (error) {
      if (!ENABLE_DEMO_FALLBACK) throw error;
      state.applications = demoApplications;
    }

    renderAssignmentOptions();
    filterApplications();
    renderCalendar();
    renderDashboard();
  }

  async function loadCalendarEvents() {
    try {
      const data = await safeFetchJSON(API.calendarEvents);
      const rawEvents = Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];

      state.calendarEvents = rawEvents.map(normalizeCalendarEvent);
    } catch (error) {
      if (!ENABLE_DEMO_FALLBACK) throw error;
      state.calendarEvents = demoCalendarEvents.map(normalizeCalendarEvent);
    }

    renderCalendar();
  }

  function loadAssignments() {
    try {
      const stored = JSON.parse(
        localStorage.getItem("volunteer-dashboard-assignments") || "[]"
      );
      state.assignments = Array.isArray(stored) ? stored : [];
    } catch (error) {
      state.assignments = [];
    }

    renderAssignmentOptions();
    renderAssignmentsTable();
    renderCalendar();
  }

  function persistAssignments() {
    localStorage.setItem(
      "volunteer-dashboard-assignments",
      JSON.stringify(state.assignments)
    );
    renderAssignmentsTable();
    renderCalendar();
  }

  function resolveActivityTitle(activityId) {
    const activity = state.activities.find((item) => item.id === activityId);
    return activity?.title || "Volunteer activity";
  }

  function resolveVolunteerName(app) {
    return [app.first_name, app.last_name].filter(Boolean).join(" ") || app.email || "Volunteer";
  }

  function filterActivities() {
    const search = (el("#globalSearchInput")?.value || "").trim().toLowerCase();
    const mode = el("#activityStatusFilter")?.value || "all";
    const appliedIds = new Set(state.applications.map((app) => app.activity_id));

    state.filteredActivities = state.activities.filter((activity) => {
      const matchesSearch =
        !search ||
        [activity.title, activity.description, activity.slug]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);

      const openSlots =
        Number(activity.slots_remaining ?? activity.number_of_volunteers ?? 0) > 0;

      const matchesMode =
        mode === "all"
          ? true
          : mode === "open"
          ? openSlots
          : mode === "applied"
          ? appliedIds.has(activity.id)
          : true;

      return matchesSearch && matchesMode;
    });

    renderActivities();
    renderDashboard();
  }

  function filterApplications() {
    const search = (el("#globalSearchInput")?.value || "").trim().toLowerCase();
    const status = el("#historyStatusFilter")?.value || "all";

    state.filteredApplications = state.applications.filter((app) => {
      const matchesSearch =
        !search ||
        [app.application_code, app.activity_title, app.notes, app.email, app.county]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);

      const matchesStatus = status === "all" ? true : app.status === status;
      return matchesSearch && matchesStatus;
    });

    renderApplicationHistory();
    renderDashboard();
  }

  function createActivityCard(activity) {
    const applied = state.applications.some((app) => app.activity_id === activity.id);
    const remaining = Number(activity.slots_remaining ?? activity.number_of_volunteers ?? 0);

    return `
      <article class="activity-card">
        <div class="activity-image">
          <img
            src="${escapeHtml(
              activity.image_url ||
              "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=900&q=80"
            )}"
            alt="${escapeHtml(activity.title)}"
          >
          <span class="activity-chip">${activity.is_active ? "Active" : "Inactive"}</span>
        </div>

        <div class="activity-body">
          <h4>${escapeHtml(activity.title)}</h4>

          <div class="activity-meta">
            <span><i class="bi bi-people me-1"></i>${escapeHtml(String(activity.number_of_volunteers ?? 0))} needed</span>
            <span><i class="bi bi-door-open me-1"></i>${escapeHtml(String(remaining))} left</span>
            <span><i class="bi bi-link-45deg me-1"></i>${escapeHtml(activity.slug || "activity")}</span>
          </div>

          <p class="activity-desc">
            ${escapeHtml(activity.description || "No description was provided for this activity yet.")}
          </p>

          <div class="activity-actions">
            <button class="ghost-btn flex-grow-1" type="button" onclick="openActivityDetail('${activity.id}')">
              View
            </button>
            <button
              class="primary-pill-btn flex-grow-1"
              type="button"
              ${applied ? "disabled" : ""}
              onclick="openApplyFlow('${activity.id}')"
            >
              ${applied ? "Applied" : "Apply"}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderActivities() {
    const main = el("#activityGridMain");
    const featured = el("#featuredActivities");

    if (main) {
      if (!state.filteredActivities.length) {
        main.innerHTML = `
          <div class="mini-state" style="grid-column:1/-1;">
            No activities matched the current search or filter.
          </div>
        `;
      } else {
        main.innerHTML = state.filteredActivities.map(createActivityCard).join("");
      }
    }

    if (featured) {
      const featuredItems = state.filteredActivities.slice(0, 2);
      featured.innerHTML = featuredItems.length
        ? featuredItems.map(createActivityCard).join("")
        : `<div class="mini-state" style="grid-column:1/-1;">No featured activities available.</div>`;
    }
  }

  function renderApplicationHistory() {
    const tbody = el("#applicationHistoryBody");
    if (!tbody) return;

    if (!state.filteredApplications.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-muted">No applications found.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.filteredApplications
      .map((app) => `
        <tr>
          <td>${escapeHtml(app.application_code || "Pending code")}</td>
          <td>${escapeHtml(app.activity_title || resolveActivityTitle(app.activity_id))}</td>
          <td>
            <span class="status-pill ${escapeHtml(app.status || "pending")}">
              ${escapeHtml(app.status || "pending")}
            </span>
          </td>
          <td>${formatDate(app.created_at, { dateStyle: "medium", timeStyle: "short" })}</td>
          <td>${escapeHtml(app.county || "—")}</td>
          <td>${escapeHtml(app.notes || "—")}</td>
        </tr>
      `)
      .join("");
  }

  function getApprovedCalendarItems() {
    return state.applications
      .filter(
        (app) =>
          app.status === "approved" &&
          (app.scheduled_start || app.activity_date || app.event_date)
      )
      .map((app) => ({
        ...app,
        start: new Date(app.scheduled_start || app.activity_date || app.event_date),
        end: new Date(
          app.scheduled_end ||
          app.scheduled_start ||
          app.activity_date ||
          app.event_date
        )
      }))
      .filter((item) => !Number.isNaN(item.start.getTime()));
  }

  function renderDashboard() {
    const openActivities = state.activities.filter((a) => a.is_active !== false).length;
    const myApplications = state.applications.length;
    const approvedApplications = state.applications.filter(
      (app) => String(app.status || "").toLowerCase() === "approved"
    );

    const approvedSchedule = getApprovedCalendarItems()
      .sort((a, b) => a.start - b.start)
      .slice(0, 4);

    const openEl = el("#dashboardOpenActivities");
    const appsEl = el("#dashboardMyApplications");
    const approvedEl = el("#dashboardApprovedCount");
    const previewEl = el("#dashboardApprovedPreview");

    if (openEl) openEl.textContent = String(openActivities);
    if (appsEl) appsEl.textContent = String(myApplications);
    if (approvedEl) approvedEl.textContent = String(approvedApplications.length);

    if (!previewEl) return;

    if (!approvedSchedule.length) {
      previewEl.innerHTML = `
        <div class="mini-state">
          No approved volunteer schedule yet.
        </div>
      `;
      return;
    }

    previewEl.innerHTML = approvedSchedule
      .map((item) => `
        <article class="legend-item mb-2">
          <div>
            <strong>${escapeHtml(item.activity_title || resolveActivityTitle(item.activity_id))}</strong>
            <div class="text-mute small">
              ${formatDate(item.start, { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <div class="text-mute small">
              ${escapeHtml(item.event_location || "Location not set")}
            </div>
          </div>
        </article>
      `)
      .join("");
  }

  function renderAssignmentOptions() {
    const select = el("#assignmentApprovedSelect");
    if (!select) return;

    const approved = state.applications.filter((app) => app.status === "approved");

    if (!approved.length) {
      select.innerHTML = `<option value="">No approved volunteers available</option>`;
      return;
    }

    select.innerHTML =
      `<option value="">Select approved volunteer</option>` +
      approved
        .map(
          (app) => `
            <option value="${escapeHtml(app.id)}">
              ${escapeHtml(resolveVolunteerName(app))} — ${escapeHtml(
                app.activity_title || resolveActivityTitle(app.activity_id)
              )}
            </option>
          `
        )
        .join("");
  }

  function renderAssignmentsTable() {
    const tbody = el("#assignmentTableBody");
    if (!tbody) return;

    if (!state.assignments.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-muted">
            No volunteer day assignments yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.assignments
      .sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date))
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.volunteer_name)}</td>
            <td>${escapeHtml(item.activity_title)}</td>
            <td>${formatDate(item.assigned_date, { dateStyle: "medium" })}</td>
            <td>${escapeHtml(item.shift || "—")}</td>
            <td>${escapeHtml(item.notes || "—")}</td>
            <td>
              <button class="ghost-btn" type="button" onclick="deleteAssignment('${item.id}')">
                Remove
              </button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function getGeneralCalendarEventsForDate(dateObj) {
    return state.calendarEvents
      .filter((event) => {
        if (!event.start_date) return false;
        const start = new Date(`${event.start_date}T00:00:00`);
        const end = new Date(`${event.end_date || event.start_date}T23:59:59`);
        return dateObj >= start && dateObj <= end;
      })
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }

  function getVolunteerAssignmentsForDate(dateObj) {
    const key = dateObj.toISOString().slice(0, 10);
    return state.assignments.filter((item) => item.assigned_date === key);
  }

  function saveAssignment() {
    const appId = el("#assignmentApprovedSelect")?.value;
    const assignedDate = el("#assignmentDate")?.value;
    const shift = el("#assignmentShift")?.value.trim() || "";
    const notes = el("#assignmentNotes")?.value.trim() || "";

    if (!appId || !assignedDate) {
      showToast("Pick an approved volunteer and an assignment date first.", "error");
      return;
    }

    const app = state.applications.find((item) => String(item.id) === String(appId));
    if (!app) {
      showToast("Selected approved volunteer record was not found.", "error");
      return;
    }

    state.assignments.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      application_id: app.id,
      volunteer_name: resolveVolunteerName(app),
      activity_title: app.activity_title || resolveActivityTitle(app.activity_id),
      assigned_date: assignedDate,
      shift,
      notes
    });

    persistAssignments();

    if (el("#assignmentShift")) el("#assignmentShift").value = "";
    if (el("#assignmentNotes")) el("#assignmentNotes").value = "";

    showToast("Volunteer day assignment saved.", "success");
  }

  async function deleteAssignment(id) {
    const confirmed = window.UmbrellaConfirm
      ? await window.UmbrellaConfirm.ask({
          title: "Remove assignment?",
          message: "This will remove this volunteer day assignment from your dashboard.",
          confirmText: "Remove assignment",
          kicker: "Volunteer schedule warning",
        })
      : confirm("Remove this volunteer day assignment?");
    if (!confirmed) return;

    state.assignments = state.assignments.filter((item) => item.id !== id);
    persistAssignments();
    showToast("Volunteer day assignment removed.", "info");
  }

  function renderCalendar() {
    const miniTitle = el("#calendarMiniTitle");
    const mainTitle = el("#calendarMainTitle");
    const approvedMeta = el("#calendarApprovedMeta");
    const miniGrid = el("#calendarMiniGrid");
    const mainGrid = el("#calendarMainGrid");

    if (!miniGrid || !mainGrid) return;

    const date = new Date(state.calendarDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startIndex = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevMonthLast = new Date(year, month, 0).getDate();
    const assignmentCount = state.assignments.length;
    const generalEventsCount = state.calendarEvents.length;

    const titleText = new Intl.DateTimeFormat("en-KE", {
      month: "long",
      year: "numeric"
    }).format(date);

    if (miniTitle) miniTitle.textContent = titleText;
    if (mainTitle) mainTitle.textContent = titleText;
    if (approvedMeta) {
      approvedMeta.textContent = `${assignmentCount} assignments · ${generalEventsCount} general events`;
    }

    const miniCells = [];
    const mainCells = [];
    const today = new Date();

    const isSameDate = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    for (let i = 0; i < 42; i += 1) {
      let cellDate;
      let muted = false;

      if (i < startIndex) {
        cellDate = new Date(year, month - 1, prevMonthLast - startIndex + i + 1);
        muted = true;
      } else if (i >= startIndex + totalDays) {
        cellDate = new Date(year, month + 1, i - (startIndex + totalDays) + 1);
        muted = true;
      } else {
        cellDate = new Date(year, month, i - startIndex + 1);
      }

      const volunteerAssignments = getVolunteerAssignmentsForDate(cellDate);
      const generalEvents = getGeneralCalendarEventsForDate(cellDate);
      const todayClass = isSameDate(cellDate, today) ? "today" : "";
      const selectedClass = isSameDate(cellDate, state.selectedCalendarDate) ? "selected" : "";
      const hasEvent = volunteerAssignments.length || generalEvents.length;

      miniCells.push(`
        <button
          class="mini-day ${muted ? "muted" : ""} ${todayClass} ${selectedClass} ${hasEvent ? "has-event" : ""}"
          data-calendar-date="${cellDate.toISOString()}"
          type="button"
        >
          ${cellDate.getDate()}
        </button>
      `);

      const volunteerHtml = volunteerAssignments
        .slice(0, 2)
        .map(
          (item) => `
            <div
              class="calendar-entry approved"
              title="${escapeHtml(item.volunteer_name)} · ${escapeHtml(item.activity_title)}"
            >
              ${escapeHtml(item.volunteer_name)} · ${escapeHtml(item.shift || item.activity_title)}
            </div>
          `
        )
        .join("");

      const generalHtml = generalEvents
        .slice(0, 2)
        .map(
          (item) => `
            <div
              class="calendar-entry"
              style="background:${escapeHtml(item.color || "#2563eb")};"
              title="${escapeHtml(item.title)}"
            >
              ${escapeHtml(item.title)}
            </div>
          `
        )
        .join("");

      const moreCount =
        Math.max(0, volunteerAssignments.length - 2) +
        Math.max(0, generalEvents.length - 2);

      mainCells.push(`
        <div class="calendar-cell ${muted ? "muted" : ""} ${todayClass}">
          <div class="calendar-date-row">
            <span class="calendar-date-num">${cellDate.getDate()}</span>
            ${hasEvent ? `<small class="text-mute">${volunteerAssignments.length + generalEvents.length}</small>` : ""}
          </div>
          ${volunteerHtml}
          ${generalHtml}
          ${moreCount > 0 ? `<div class="text-mute small">+${moreCount} more</div>` : ""}
        </div>
      `);
    }

    miniGrid.innerHTML = miniCells.join("");
    mainGrid.innerHTML = mainCells.join("");

    els("[data-calendar-date]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedCalendarDate = new Date(button.dataset.calendarDate);
        if (el("#assignmentDate")) {
          el("#assignmentDate").value = button.dataset.calendarDate.slice(0, 10);
        }
        renderCalendar();
      });
    });
  }

  function prefillApplyForm() {
    const p = state.profile || {};
    if (el("#applyFirstName")) el("#applyFirstName").value = p.first_name || "";
    if (el("#applyLastName")) el("#applyLastName").value = p.last_name || "";
    if (el("#applyPhone")) el("#applyPhone").value = p.phone || "";
    if (el("#applyEmail")) el("#applyEmail").value = p.email || "";
    if (el("#applyCounty")) el("#applyCounty").value = p.county || "";
  }

  function populateSettings(profile = {}) {
    const first = profile.first_name || "Volunteer";
    const last = profile.last_name || "";
    const fullName = [first, last].filter(Boolean).join(" ");
    const email = profile.email || "user@email.com";
    const phone = profile.phone || "";
    const username = profile.username || (email.split("@")[0] || "volunteer");
    const role = profile.role || "volunteer";
    const status = profile.status || "active";
    const verified = Boolean(profile.verified ?? true);
    const photo =
      profile.profile_photo ||
      profile.passport_photo_url ||
      "https://i.pravatar.cc/140?img=12";
    const created = profile.created_at || new Date().toISOString();
    const updated = profile.updated_at || new Date().toISOString();
    const regCode = profile.reg_code || "VOL-DEMO-001";

    if (el("#settingsProfilePhoto")) el("#settingsProfilePhoto").src = photo;
    if (el("#settingsFullName")) el("#settingsFullName").textContent = fullName;
    if (el("#settingsEmailHero")) el("#settingsEmailHero").textContent = email;
    if (el("#settingsRoleHero")) el("#settingsRoleHero").textContent = role;
    if (el("#settingsStatusHero")) el("#settingsStatusHero").textContent = status;
    if (el("#settingsVerifiedHero")) {
      el("#settingsVerifiedHero").textContent = verified ? "Verified" : "Not verified";
    }

    if (el("#settingsUserId")) el("#settingsUserId").value = profile.id || "";
    if (el("#settingsProfilePhotoInput")) el("#settingsProfilePhotoInput").value = photo;
    if (el("#settingsFirstName")) el("#settingsFirstName").value = first;
    if (el("#settingsLastName")) el("#settingsLastName").value = last;
    if (el("#settingsUsername")) el("#settingsUsername").value = username;
    if (el("#settingsRole")) el("#settingsRole").value = role;
    if (el("#settingsStatus")) el("#settingsStatus").value = status;
    if (el("#settingsVerified")) el("#settingsVerified").checked = verified;
    if (el("#settingsEmail")) el("#settingsEmail").value = email;
    if (el("#settingsPhone")) el("#settingsPhone").value = phone;
    if (el("#settingsRegCode")) el("#settingsRegCode").value = regCode;
    if (el("#settingsFullNameReadOnly")) el("#settingsFullNameReadOnly").value = fullName;
    if (el("#settingsCreatedAt")) {
      el("#settingsCreatedAt").value = formatDate(created, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    }
    if (el("#settingsLastSeen")) {
      el("#settingsLastSeen").value = profile.last_seen
        ? formatDate(profile.last_seen, {
            dateStyle: "medium",
            timeStyle: "short"
          })
        : "Just now";
    }
    if (el("#settingsUpdatedAt")) {
      el("#settingsUpdatedAt").value = formatDate(updated, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    }
  }

  function settingsNotice(text, type = "success") {
    const box = el("#settingsMessage");
    if (!box) return;

    box.className = `settings-message ${type}`;
    box.textContent = text;
    box.classList.remove("is-hidden");

    setTimeout(() => box.classList.add("is-hidden"), 4500);
  }

  function openActivityDetail(activityId) {
    const activity = state.activities.find((item) => item.id === activityId);
    if (!activity) return;

    state.selectedActivity = activity;

    if (el("#detailTitle")) el("#detailTitle").textContent = activity.title;
    if (el("#detailImage")) {
      el("#detailImage").src =
        activity.image_url ||
        "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=900&q=80";
    }
    if (el("#detailDescription")) {
      el("#detailDescription").textContent =
        activity.description || "No activity description available.";
    }
    if (el("#detailMeta")) {
      el("#detailMeta").innerHTML = `
        <span><i class="bi bi-link-45deg me-1"></i>${escapeHtml(activity.slug || "activity")}</span>
        <span><i class="bi bi-people me-1"></i>${escapeHtml(String(activity.number_of_volunteers ?? 0))} needed</span>
        <span><i class="bi bi-door-open me-1"></i>${escapeHtml(String(activity.slots_remaining ?? activity.number_of_volunteers ?? 0))} left</span>
      `;
    }
    if (el("#detailList")) {
      el("#detailList").innerHTML = `
        <div class="detail-item"><small>Activity slug</small><strong>${escapeHtml(activity.slug || "—")}</strong></div>
        <div class="detail-item"><small>Total volunteers needed</small><strong>${escapeHtml(String(activity.number_of_volunteers ?? 0))}</strong></div>
        <div class="detail-item"><small>Current state</small><strong>${activity.is_active ? "Active" : "Inactive"}</strong></div>
        <div class="detail-item"><small>Activity ID</small><strong>${escapeHtml(activity.id)}</strong></div>
      `;
    }

    el("#detailDrawerBackdrop")?.classList.add("active");
  }

  function closeActivityDetail() {
    el("#detailDrawerBackdrop")?.classList.remove("active");
  }

  function setApplyStep(step) {
    state.applyStep = step;

    els(".apply-step").forEach((section) => {
      section.classList.toggle("active", Number(section.dataset.step) === step);
    });

    els("[data-step-indicator]").forEach((dot) => {
      dot.classList.toggle("active", Number(dot.dataset.stepIndicator) === step);
    });

    if (step === 3) fillReview();
  }

  function fillReview() {
    const grid = el("#reviewGrid");
    if (!grid) return;

    const activity = state.selectedActivity || {};

    const values = {
      "First name": el("#applyFirstName")?.value.trim() || "",
      "Last name": el("#applyLastName")?.value.trim() || "",
      "Phone": el("#applyPhone")?.value.trim() || "",
      "Email": el("#applyEmail")?.value.trim() || "",
      "County": el("#applyCounty")?.value.trim() || "",
      "ID / Passport": el("#applyIdPassport")?.value.trim() || "",
      "Activity": activity.title || "—",
      "Activity slug": activity.slug || "—"
    };

    grid.innerHTML = Object.entries(values)
      .map(
        ([label, value]) => `
          <div class="detail-item">
            <small>${escapeHtml(label)}</small>
            <strong>${escapeHtml(value || "—")}</strong>
          </div>
        `
      )
      .join("");
  }

  function openApplyFlow(activityId) {
    const activity = state.activities.find((item) => item.id === activityId);
    if (!activity) return;

    state.selectedActivity = activity;

    if (el("#applyActivityId")) el("#applyActivityId").value = activity.id;
    if (el("#applyPreviewImage")) {
      el("#applyPreviewImage").src =
        activity.image_url ||
        "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=900&q=80";
    }
    if (el("#applyPreviewTitle")) el("#applyPreviewTitle").textContent = activity.title;
    if (el("#applyPreviewDescription")) {
      el("#applyPreviewDescription").textContent =
        activity.description || "No activity description available.";
    }
    if (el("#applyPreviewMeta")) {
      el("#applyPreviewMeta").innerHTML = `
        <span><i class="bi bi-link-45deg me-1"></i>${escapeHtml(activity.slug || "activity")}</span>
        <span><i class="bi bi-people me-1"></i>${escapeHtml(String(activity.number_of_volunteers ?? 0))} needed</span>
      `;
    }

    setApplyStep(1);
    el("#applyModalBackdrop")?.classList.add("active");
  }

  function closeApplyFlow() {
    el("#applyModalBackdrop")?.classList.remove("active");
    setApplyStep(1);
  }

  function validateApplyStep1() {
    const fields = [
      el("#applyFirstName"),
      el("#applyLastName"),
      el("#applyPhone"),
      el("#applyEmail"),
      el("#applyCounty"),
      el("#applyIdPassport")
    ].filter(Boolean);

    for (const field of fields) {
      if (!field.reportValidity()) return false;
    }

    return true;
  }

  async function submitApplication(event) {
    event.preventDefault();

    const activity = state.selectedActivity;
    if (!activity || !el("#applyActivityId")?.value) {
      showToast("No activity selected.", "error");
      return;
    }

    const payload = {
      first_name: el("#applyFirstName")?.value.trim() || "",
      last_name: el("#applyLastName")?.value.trim() || "",
      phone: el("#applyPhone")?.value.trim() || "",
      email: el("#applyEmail")?.value.trim() || "",
      county: el("#applyCounty")?.value.trim() || "",
      id_passport: el("#applyIdPassport")?.value.trim() || "",
      passport_photo_url: el("#applyPassportPhotoUrl")?.value.trim() || null,
      activity_id: activity.id,
      source: "dashboard"
    };

    const submitBtn = el("#submitApplicationBtn");
    const original = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="bi bi-hourglass-split me-2"></i>Submitting...`;
    }

    try {
      if (ENABLE_DEMO_FALLBACK) {
        throw new Error("demo-fallback");
      }

      await safeFetchJSON(API.applications, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showToast(`Application for ${activity.title} submitted successfully.`, "success");
    } catch (error) {
      if (ENABLE_DEMO_FALLBACK) {
        state.applications.unshift({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          application_code: `VAC-DEMO-${String(state.applications.length + 1).padStart(3, "0")}`,
          activity_id: activity.id,
          activity_title: activity.title,
          status: "pending",
          notes: "Submitted from volunteer dashboard.",
          created_at: new Date().toISOString(),
          ...payload
        });

        showToast(
          `Application for ${activity.title} was added in demo mode. Wire the POST endpoint to persist it for real.`,
          "success"
        );
      } else {
        showToast(error.message || "Failed to submit application.", "error");
        return;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      }
    }

    closeApplyFlow();
    await loadApplications();
    await loadActivities();
  }

  function initCalendarControls() {
    el("#calendarPrevBtn")?.addEventListener("click", () => {
      state.calendarDate = new Date(
        state.calendarDate.getFullYear(),
        state.calendarDate.getMonth() - 1,
        1
      );
      renderCalendar();
    });

    el("#calendarNextBtn")?.addEventListener("click", () => {
      state.calendarDate = new Date(
        state.calendarDate.getFullYear(),
        state.calendarDate.getMonth() + 1,
        1
      );
      renderCalendar();
    });

    el("#calendarTodayBtn")?.addEventListener("click", () => {
      state.calendarDate = new Date();
      state.selectedCalendarDate = new Date();
      renderCalendar();
    });
  }

  function initApplyModal() {
    el("#closeApplyModal")?.addEventListener("click", closeApplyFlow);

    els("[data-next-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextStep = Number(btn.dataset.nextStep);

        if (state.applyStep === 1 && nextStep > 1 && !validateApplyStep1()) {
          return;
        }

        if (nextStep >= 2 && !el("#applyActivityId")?.value) {
          showToast("Select an activity first.", "error");
          return;
        }

        setApplyStep(nextStep);
      });
    });

    els("[data-prev-step]").forEach((btn) => {
      btn.addEventListener("click", () => setApplyStep(Number(btn.dataset.prevStep)));
    });

    el("#applyForm")?.addEventListener("submit", submitApplication);

    el("#applyModalBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "applyModalBackdrop") closeApplyFlow();
    });
  }

  function initDetails() {
    el("#closeDetailDrawer")?.addEventListener("click", closeActivityDetail);
    el("#detailCloseBtn")?.addEventListener("click", closeActivityDetail);

    el("#detailApplyBtn")?.addEventListener("click", () => {
      closeActivityDetail();
      if (state.selectedActivity) openApplyFlow(state.selectedActivity.id);
    });

    el("#detailDrawerBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "detailDrawerBackdrop") closeActivityDetail();
    });
  }

  function initFilters() {
    el("#globalSearchInput")?.addEventListener("input", () => {
      filterActivities();
      filterApplications();
    });

    el("#activityStatusFilter")?.addEventListener("change", filterActivities);
    el("#historyStatusFilter")?.addEventListener("change", filterApplications);

    el("#refreshActivitiesBtn")?.addEventListener("click", () => {
      loadActivities().catch((error) => {
        console.error("Activities refresh failed:", error);
        showToast(error.message || "Failed to refresh activities.", "error");
      });
    });

    el("#refreshHistoryBtn")?.addEventListener("click", () => {
      loadApplications().catch((error) => {
        console.error("Applications refresh failed:", error);
        showToast(error.message || "Failed to refresh applications.", "error");
      });
    });

    el("#saveAssignmentBtn")?.addEventListener("click", saveAssignment);

    el("#logoutBtn")?.addEventListener("click", () => {
      showToast("Wire this button to your real logout endpoint.", "info");
    });
  }

  function initSettings() {
    els("[data-settings-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.settingsTab;

        els("[data-settings-tab]").forEach((x) => x.classList.toggle("active", x === btn));
        els("[data-settings-panel]").forEach((panel) => {
          panel.classList.toggle("active", panel.dataset.settingsPanel === target);
        });
      });
    });

    el("#refreshSettingsBtn")?.addEventListener("click", () => {
      populateSettings(state.profile || {});
      settingsNotice("Settings panel refreshed.", "success");
    });

    el("#resetProfileSettingsBtn")?.addEventListener("click", () => {
      populateSettings(state.profile || {});
    });

    el("#resetDetailsSettingsBtn")?.addEventListener("click", () => {
      populateSettings(state.profile || {});
    });

    el("#resetPasswordSettingsBtn")?.addEventListener("click", () => {
      if (el("#settingsCurrentPassword")) el("#settingsCurrentPassword").value = "";
      if (el("#settingsNewPassword")) el("#settingsNewPassword").value = "";
      if (el("#settingsConfirmPassword")) el("#settingsConfirmPassword").value = "";
    });

    el("#settingsProfileForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      state.profile = {
        ...(state.profile || {}),
        first_name: el("#settingsFirstName")?.value.trim() || "",
        last_name: el("#settingsLastName")?.value.trim() || "",
        username: el("#settingsUsername")?.value.trim() || "",
        role: el("#settingsRole")?.value || "volunteer",
        status: el("#settingsStatus")?.value || "active",
        verified: Boolean(el("#settingsVerified")?.checked),
        profile_photo: el("#settingsProfilePhotoInput")?.value.trim() || "",
        updated_at: new Date().toISOString()
      };

      populateSettings(state.profile);
      showToast(
        "Profile settings updated in the UI. Hook this form to your backend to persist.",
        "success"
      );
    });

    el("#settingsDetailsForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      state.profile = {
        ...(state.profile || {}),
        email: el("#settingsEmail")?.value.trim() || "",
        phone: el("#settingsPhone")?.value.trim() || "",
        updated_at: new Date().toISOString()
      };

      populateSettings(state.profile);
      showToast(
        "Detail settings updated in the UI. Persist with your API next.",
        "success"
      );
    });

    el("#settingsPasswordForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      const newPassword = el("#settingsNewPassword")?.value || "";
      const confirmPassword = el("#settingsConfirmPassword")?.value || "";

      if (newPassword !== confirmPassword) {
        showToast("New password and confirmation do not match.", "error");
        return;
      }

      if (newPassword.length < 8) {
        showToast("New password must be at least 8 characters.", "error");
        return;
      }

      showToast("Password form validated. Wire it to your password endpoint.", "success");

      if (el("#settingsCurrentPassword")) el("#settingsCurrentPassword").value = "";
      if (el("#settingsNewPassword")) el("#settingsNewPassword").value = "";
      if (el("#settingsConfirmPassword")) el("#settingsConfirmPassword").value = "";
    });
  }

  async function boot() {
    setTodayLabel();
    initNavigation();
    initTheme();
    initCalendarControls();
    initApplyModal();
    initDetails();
    initFilters();
    initSettings();

    el("#applyActivityId")?.removeAttribute("required");

    loadAssignments();
    await loadProfile();
    await loadActivities();
    await loadApplications();
    await loadCalendarEvents();

    populateSettings(state.profile || {});

    if (el("#assignmentDate")) {
      el("#assignmentDate").value = new Date().toISOString().slice(0, 10);
    }

    showToast(
      "Volunteer dashboard upgraded: toasts, settings page and layered calendar are live.",
      "success"
    );
  }

  window.openActivityDetail = openActivityDetail;
  window.openApplyFlow = openApplyFlow;
  window.deleteAssignment = deleteAssignment;

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((error) => {
      console.error("Volunteer dashboard boot failed:", error);
      showToast(error.message || "Dashboard failed to load.", "error");
    });
  });

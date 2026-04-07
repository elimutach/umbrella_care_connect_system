(() => {
  const LOGOUT_URL = "/api/auth/logout/";
  const FALLBACK_REDIRECT = "/signin/";
  const TRIGGER_SELECTOR = "[data-logout-trigger], #logout, #logoutBtn";
  const AUTH_STORAGE_PATTERN = /(auth|otp|session|token|current_user)/i;

  let modal = null;
  let lastFocusedElement = null;
  let isLoggingOut = false;

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(";").shift() : "";
  }

  function ensureModal() {
    if (modal) return modal;

    const wrapper = document.createElement("div");
    wrapper.className = "logout-modal-backdrop is-hidden";
    wrapper.id = "logoutConfirmModal";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = `
      <section class="logout-modal-card" role="dialog" aria-modal="true" aria-labelledby="logoutModalTitle">
        <button class="logout-modal-close" type="button" data-logout-cancel aria-label="Cancel logout">
          <i class="bi bi-x-lg"></i>
        </button>

        <div class="logout-modal-icon" aria-hidden="true">
          <i class="bi bi-exclamation-triangle-fill"></i>
        </div>

        <div class="logout-modal-copy">
          <p class="logout-modal-kicker">Session warning</p>
          <h3 id="logoutModalTitle">Do you really want to logout?</h3>
          <p>
            Continuing will end this dashboard session, you will be redirect you back to sign in.
          </p>
        </div>

        <div class="logout-modal-message" id="logoutModalMessage" aria-live="polite"></div>

        <div class="logout-modal-actions">
          <button class="logout-modal-btn cancel" type="button" data-logout-cancel>
            <i class="bi bi-arrow-left-circle"></i>
            Cancel
          </button>
          <button class="logout-modal-btn continue" type="button" data-logout-continue>
            <i class="bi bi-box-arrow-right"></i>
            Continue logout
          </button>
        </div>
      </section>
    `;

    document.body.appendChild(wrapper);
    modal = wrapper;

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-logout-cancel]")) {
        closeModal();
      }

      if (event.target.closest("[data-logout-continue]")) {
        confirmLogout();
      }
    });

    return modal;
  }

  function getContinueButton() {
    return ensureModal().querySelector("[data-logout-continue]");
  }

  function getMessageBox() {
    return ensureModal().querySelector("#logoutModalMessage");
  }

  function setMessage(text = "", type = "error") {
    const box = getMessageBox();
    if (!box) return;
    box.textContent = text;
    box.className = `logout-modal-message ${text ? type : ""}`;
  }

  function setLoading(isLoading) {
    const button = getContinueButton();
    if (!button) return;

    button.disabled = isLoading;
    button.innerHTML = isLoading
      ? `<i class="bi bi-hourglass-split"></i> Logging out...`
      : `<i class="bi bi-box-arrow-right"></i> Continue logout`;
  }

  function openModal(trigger) {
    const dialog = ensureModal();
    lastFocusedElement = trigger || document.activeElement;
    setMessage("");
    dialog.classList.remove("is-hidden");
    dialog.setAttribute("aria-hidden", "false");
    const continueButton = getContinueButton();
    if (continueButton) continueButton.focus();
  }

  function closeModal() {
    if (!modal || isLoggingOut) return;
    modal.classList.add("is-hidden");
    modal.setAttribute("aria-hidden", "true");
    setMessage("");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function removeAuthStorageKeys(storage) {
    if (!storage) return;

    Object.keys(storage).forEach((key) => {
      if (AUTH_STORAGE_PATTERN.test(key)) {
        storage.removeItem(key);
      }
    });
  }

  function clearBrowserSessionState() {
    try {
      sessionStorage.clear();
    } catch (_) {}

    try {
      removeAuthStorageKeys(localStorage);
    } catch (_) {}

    if (!("caches" in window)) return Promise.resolve();

    try {
      return caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((name) => /(umbrella|dashboard|auth|session)/i.test(name))
              .map((name) => caches.delete(name))
          )
        )
        .catch(() => {});
    } catch (_) {
      return Promise.resolve();
    }
  }

  function redirectToSignin(url = FALLBACK_REDIRECT) {
    window.history.replaceState(null, "", url);
    window.location.replace(url);
  }

  function confirmLogout() {
    if (isLoggingOut) return;

    isLoggingOut = true;
    setLoading(true);
    setMessage("");

    fetch(LOGOUT_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({ action: "logout" }),
    })
      .then((response) =>
        response.json().catch(() => ({})).then((data) => {
          if (!response.ok) {
            throw new Error(data.message || data.detail || "Logout failed. Please try again.");
          }

          return data;
        })
      )
      .then((data) =>
        clearBrowserSessionState().then(() => {
          redirectToSignin(data.redirect_url || FALLBACK_REDIRECT);
        })
      )
      .catch((error) => {
        isLoggingOut = false;
        setLoading(false);
        setMessage(error.message || "Logout failed. Please try again.", "error");
      });
  }

  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target.closest ? event.target.closest(TRIGGER_SELECTOR) : null;
      if (!trigger) return;

      event.preventDefault();
      event.stopPropagation();
      openModal(trigger);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      const trigger = event.target.closest ? event.target.closest(TRIGGER_SELECTOR) : null;
      if (trigger && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
        openModal(trigger);
        return;
      }

      if (event.key === "Escape" && modal && !modal.classList.contains("is-hidden")) {
        closeModal();
      }
    },
    true
  );
})();

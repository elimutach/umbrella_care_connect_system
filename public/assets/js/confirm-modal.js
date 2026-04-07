(() => {
  let modal = null;
  let resolver = null;
  let lastFocusedElement = null;

  function ensureModal() {
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "confirm-modal-backdrop is-hidden";
    modal.id = "appConfirmModal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <section class="confirm-modal-card" role="dialog" aria-modal="true" aria-labelledby="confirmModalTitle">
        <button class="confirm-modal-close" type="button" data-confirm-cancel aria-label="Cancel action">
          <i class="bi bi-x-lg"></i>
        </button>

        <div class="confirm-modal-head">
          <span class="confirm-modal-icon">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </span>
          <div>
            <p class="confirm-modal-kicker" id="confirmModalKicker">Please confirm</p>
            <h3 id="confirmModalTitle">Are you sure?</h3>
            <p id="confirmModalMessage">This action needs your confirmation.</p>
          </div>
        </div>

        <div class="confirm-modal-actions">
          <button class="confirm-modal-btn cancel" type="button" data-confirm-cancel>
            <i class="bi bi-x-circle"></i>
            Cancel
          </button>
          <button class="confirm-modal-btn continue" type="button" data-confirm-continue>
            <i class="bi bi-check2-circle"></i>
            Continue
          </button>
        </div>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-confirm-cancel]")) {
        close(false);
      }

      if (event.target.closest("[data-confirm-continue]")) {
        close(true);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!modal || modal.classList.contains("is-hidden")) return;
      if (event.key === "Escape") close(false);
    });

    return modal;
  }

  function setText(selector, text) {
    const node = modal.querySelector(selector);
    if (node) node.textContent = text;
  }

  function close(answer) {
    if (!modal || modal.classList.contains("is-hidden")) return;

    modal.classList.add("is-hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-dashboard-modal");

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }

    if (resolver) resolver(answer);
    resolver = null;
  }

  function ask(options = {}) {
    ensureModal();
    lastFocusedElement = document.activeElement;

    modal.classList.toggle("is-danger", options.type !== "info");
    modal.classList.toggle("is-info", options.type === "info");

    setText("#confirmModalKicker", options.kicker || "Please confirm");
    setText("#confirmModalTitle", options.title || "Are you sure?");
    setText("#confirmModalMessage", options.message || "This action needs your confirmation.");

    const continueBtn = modal.querySelector("[data-confirm-continue]");
    const cancelBtn = modal.querySelector(".confirm-modal-actions [data-confirm-cancel]");

    if (continueBtn) {
      continueBtn.innerHTML = `
        <i class="bi ${options.icon || (options.type === "info" ? "bi-check2-circle" : "bi-trash3")}"></i>
        ${options.confirmText || "Continue"}
      `;
    }

    if (cancelBtn) {
      cancelBtn.innerHTML = `
        <i class="bi bi-x-circle"></i>
        ${options.cancelText || "Cancel"}
      `;
    }

    modal.classList.remove("is-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-dashboard-modal");
    if (continueBtn) continueBtn.focus();

    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  window.UmbrellaConfirm = { ask };
})();

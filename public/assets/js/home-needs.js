(function () {
  const track = document.getElementById("homeNeedsTrack");
  if (!track || !window.UMBRELLA_NEEDS_API) return;

  const { escapeHTML, needNeedsDonations } = window.UMBRELLA_NEEDS_API;

  function renderMessage(message) {
    track.innerHTML = `<div class="home-needs-empty">${escapeHTML(message)}</div>`;
  }

  function buildCard(need) {
    const detailUrl = `/need-details/?need=${encodeURIComponent(need.id)}`;
    const donateUrl = `/donate/?need=${encodeURIComponent(need.id)}&mode=custom`;

    return `
      <article class="home-need-card">
        <div class="home-need-image">
          <img src="${escapeHTML(need.image)}" alt="${escapeHTML(need.title)}">
          <span>${escapeHTML(need.statusLabel)}</span>
        </div>

        <div class="home-need-body">
          <p class="home-need-type">${escapeHTML(need.needTypeLabel)} need</p>
          <h3>${escapeHTML(need.title)}</h3>
          <p>${escapeHTML(need.summary)}</p>

          <div class="home-need-progress">
            <div>
              <strong>${escapeHTML(need.amountReceivedDisplay)}</strong>
              <small>raised of ${escapeHTML(need.amountNeededDisplay)}</small>
            </div>
            <span>${need.progressPercent}%</span>
          </div>

          <div class="progress-track">
            <div class="progress-fill" style="width:${need.progressPercent}%"></div>
          </div>

          <div class="home-need-actions">
            <a href="${detailUrl}" data-need-link="${escapeHTML(need.id)}">View need</a>
            <a href="${donateUrl}" data-need-link="${escapeHTML(need.id)}" class="home-need-donate">Donate</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderHomeNeeds() {
    renderMessage("Loading live needs...");

    window.UMBRELLA_NEEDS_READY.then(function (needs) {
      const openNeeds = needs.filter(needNeedsDonations).slice(0, 5);

      if (!openNeeds.length) {
        renderMessage("No open needs are available right now. Please check the live needs board again soon.");
        return;
      }

      track.innerHTML = openNeeds.map(buildCard).join("");
    });
  }

  track.addEventListener("click", (event) => {
    const link = event.target.closest("[data-need-link]");
    if (!link) return;

    localStorage.setItem("selectedNeedId", link.dataset.needLink);
    localStorage.setItem("selectedAmount", "custom");
  });

  renderHomeNeeds();
})();

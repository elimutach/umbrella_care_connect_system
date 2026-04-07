class NavbarComponent extends HTMLElement {
connectedCallback(){
    this.innerHTML=`<div class="dashboard-navbar">
  <div class="navbar-left">
    <div class="navbar-greeting">Hello</div>
    <div class="navbar-date" id="currentDate">Loading date...</div>
  </div>


<div class="dashboard-search navbar-center">
      <i class="bi bi-search"></i>
      <input type="text" placeholder="Search donations, needs..." />
    </div>

  <div class="navbar-right">
    <button class="nav-icon-btn" id="themeToggle" type="button" title="Toggle theme">
      <i class="bi bi-sun"></i>
      <i class="bi bi-moon"></i>
    </button>

    <button class="nav-icon-btn" type="button" title="Notifications">
      <i class="bi bi-bell"></i>
    </button>

    <div class="profile-chip">
      <img src="https://ui-avatars.com/api/?name=User&background=F4A623&color=fff&bold=true" alt="Current user">
      <div class="profile-info">
        <span class="profile-name">Loading user...</span>
        <span class="profile-role">Signed in</span>
      </div>
      <i class="bi bi-chevron-right"></i>
    </div>
  </div>
</div>`
}
}

customElements.define('navbar-component', NavbarComponent);

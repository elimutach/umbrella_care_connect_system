(function () {
  function applySavedTheme() {
    const savedTheme = localStorage.getItem("umbrellaTheme");
    const body = document.body;

    if (savedTheme === "dark") {
      body.classList.add("dark-mode");
      body.classList.remove("light-mode");
    } else {
      body.classList.add("light-mode");
      body.classList.remove("dark-mode");
    }
  }

  function initPasswordToggles() {
    const toggles = document.querySelectorAll("[data-toggle-password]");

    toggles.forEach((btn) => {
      btn.addEventListener("click", function () {
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        const icon = btn.querySelector("i");

        if (!input) return;

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        if (icon) {
          icon.classList.toggle("fa-eye", !isPassword);
          icon.classList.toggle("fa-eye-slash", isPassword);
        }

        btn.setAttribute(
          "aria-label",
          isPassword ? "Hide password" : "Show password"
        );
      });
    });
  }

  function initSlider() {
    const sliders = document.querySelectorAll("[data-slider]");

    sliders.forEach((slider) => {
      const track = slider.querySelector(".auth-slider-track");
      const originalSlides = Array.from(track.children);
      const dots = Array.from(slider.querySelectorAll(".dot"));

      if (!track || originalSlides.length <= 1) return;

      const firstClone = originalSlides[0].cloneNode(true);
      track.appendChild(firstClone);

      let index = 0;
      const total = originalSlides.length;
      let isResetting = false;

      function updateDots(realIndex) {
        dots.forEach((dot, i) => {
          dot.classList.toggle("is-active", i === realIndex);
        });
      }

      function moveTo(newIndex, animate = true) {
        track.style.transition = animate ? "transform 0.7s ease" : "none";
        track.style.transform = `translateX(-${newIndex * 100}%)`;
      }

      function nextSlide() {
        if (isResetting) return;

        index += 1;
        moveTo(index, true);

        if (index === total) {
          updateDots(0);
        } else {
          updateDots(index);
        }
      }

      track.addEventListener("transitionend", () => {
        if (index === total) {
          isResetting = true;
          index = 0;
          moveTo(0, false);

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              isResetting = false;
            });
          });
        }
      });

      dots.forEach((dot, dotIndex) => {
        dot.addEventListener("click", () => {
          index = dotIndex;
          moveTo(index, true);
          updateDots(dotIndex);
        });
      });

      updateDots(0);
      moveTo(0, false);
      setInterval(nextSlide, 5000);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applySavedTheme();
    initPasswordToggles();
    initSlider();
  });
})();
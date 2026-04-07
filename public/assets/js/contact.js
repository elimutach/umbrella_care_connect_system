(function () {
  const form = document.getElementById("contactForm");
  const statusBox = document.getElementById("contactStatus");
  const submitBtn = document.getElementById("contactSubmitBtn");

  if (!form || !statusBox || !submitBtn) return;

  function setLoading(isLoading) {
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    submitBtn.disabled = isLoading;
    if (btnText) btnText.classList.toggle("hidden", isLoading);
    if (btnLoader) btnLoader.classList.toggle("hidden", !isLoading);
  }

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.classList.remove("hidden", "error");
    if (type === "error") statusBox.classList.add("error");
  }

  function getPayload() {
    const nameInput = document.getElementById("contactName");
    const emailInput = document.getElementById("contactEmail");
    const subjectInput = document.getElementById("contactSubject");
    const messageInput = document.getElementById("contactMessage");

    return {
      name: nameInput ? nameInput.value.trim() : "",
      email: emailInput ? emailInput.value.trim() : "",
      subject: subjectInput ? subjectInput.value.trim() : "",
      message: messageInput ? messageInput.value.trim() : "",
    };
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const payload = getPayload();
    if (!payload.name || !payload.email || !payload.message) {
      showStatus("Please add your name, email, and message before sending.", "error");
      return;
    }

    if (payload.message.length < 10) {
      showStatus("Please write a slightly longer message so the team has enough context.", "error");
      return;
    }

    setLoading(true);
    showStatus("Sending your message through the secure mail channel...", "info");

    fetch("/api/contact/", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (result) {
          if (!response.ok) {
            throw new Error(result.message || "Could not send your message right now.");
          }
          return result;
        });
      })
      .then(function (result) {
        form.reset();
        showStatus(result.message || "Message sent. Please check your email for the confirmation.", "success");
      })
      .catch(function (error) {
        showStatus(error.message, "error");
      })
      .then(function () {
        setLoading(false);
      });
  });
})();

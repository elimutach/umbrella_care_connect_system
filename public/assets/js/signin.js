document.addEventListener("DOMContentLoaded", function () {
  const loginInput = document.getElementById("login");

  if (!loginInput) return;

  loginInput.addEventListener("input", function () {
    loginInput.setCustomValidity("");
  });
});
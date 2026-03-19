document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const password = document.getElementById("signup_password");
  const confirmPassword = document.getElementById("confirm_password");

  if (!form || !password || !confirmPassword) return;

  function validatePasswords() {
    if (confirmPassword.value && password.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity("Passwords do not match.");
    } else {
      confirmPassword.setCustomValidity("");
    }
  }

  password.addEventListener("input", validatePasswords);
  confirmPassword.addEventListener("input", validatePasswords);
  form.addEventListener("submit", validatePasswords);
});
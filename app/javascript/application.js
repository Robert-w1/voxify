// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails";
import "controllers";
import "@popperjs/core";
import "bootstrap";

// SIDEBAR STUFF

document.addEventListener("turbo:load", () => {
  // Bootstrap dropdowns
  document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach((el) => {
    new bootstrap.Dropdown(el);
  });

  // Sidebar collapse toggle
  const toggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
  }

  // Avatar dropdown (opens upward above the avatar)
  const avatarBtn = document.getElementById("avatar-toggle");
  const avatarDropdown = document.getElementById("avatar-dropdown");
  if (avatarBtn && avatarDropdown) {
    avatarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpening = !avatarDropdown.classList.contains("open");
      if (isOpening) {
        const rect = avatarBtn.getBoundingClientRect();
        avatarDropdown.style.bottom = window.innerHeight - rect.top + 6 + "px";
        avatarDropdown.style.left = rect.left + "px";
      }
      avatarDropdown.classList.toggle("open");
    });
    // Close when clicking anywhere else on the page
    document.addEventListener("click", () => {
      avatarDropdown.classList.remove("open");
    });
  }
});

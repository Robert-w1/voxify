import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input", "results"];

  connect() {
    this._timer = null;
    this._boundClose = this._closeOnOutsideClick.bind(this);
    document.addEventListener("mousedown", this._boundClose);
  }

  disconnect() {
    document.removeEventListener("mousedown", this._boundClose);
  }

  onInput() {
    clearTimeout(this._timer);
    const q = this.inputTarget.value.trim();
    if (q.length < 2) {
      this._close();
      return;
    }
    this._timer = setTimeout(() => this._fetch(q), 300);
  }

  onKeydown(e) {
    if (e.key === "Escape") this._close();
  }

  async _fetch(q) {
    const res = await fetch(`/sessions.json?q=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const results = await res.json();
    this._render(results);
  }

  _render(results) {
    this.resultsTarget.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getInstance(el)?.dispose();
    });

    if (!results.length) {
      this.resultsTarget.innerHTML = `<div class="search-popup-empty">No results</div>`;
    } else {
      this.resultsTarget.innerHTML = results
        .map((r) => {
          const short = this._shortLabel(r.label);
          const tooltip = r.created_at ? this._formatDatetime(r.created_at) : null;
          const tooltipAttrs = tooltip
            ? `data-bs-toggle="tooltip" data-bs-placement="bottom" title="${this._escape(tooltip)}"`
            : "";
          return `
          <a href="${r.url}" class="search-popup-item" data-turbo-frame="_top">
            <i class="fa-solid fa-file-lines"></i>
            <span class="search-popup-label" ${tooltipAttrs}>${this._escape(short)}</span>
          </a>
        `;
        })
        .join("");
    }

    this._positionPopup();
    this.resultsTarget.hidden = false;

    this.resultsTarget.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getOrCreateInstance(el, { trigger: "hover" });
    });
  }

  _shortLabel(label) {
    return label.split(" - ")[0] || label;
  }

  _formatDatetime(iso) {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return null;
    const day = dt.getDate();
    const month = dt.toLocaleString(undefined, { month: "long" });
    const year = dt.getFullYear();
    const time = dt.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    return `${day} ${month} ${year} · ${time}`;
  }

  _positionPopup() {
    const rect = this.inputTarget.closest(".sessions-search-field").getBoundingClientRect();
    const popup = this.resultsTarget;
    popup.style.top = `${rect.bottom + 6}px`;
    popup.style.left = `${rect.left}px`;
    popup.style.width = `${rect.width}px`;
  }

  _close() {
    this.resultsTarget.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getInstance(el)?.dispose();
    });
    this.resultsTarget.hidden = true;
    this.resultsTarget.innerHTML = "";
  }

  _escape(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _closeOnOutsideClick(e) {
    if (!this.element.contains(e.target)) this._close();
  }
}

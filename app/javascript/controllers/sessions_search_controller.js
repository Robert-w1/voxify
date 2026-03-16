import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "results"]

  connect() {
    this._timer = null
    this._boundClose = this._closeOnOutsideClick.bind(this)
    document.addEventListener("mousedown", this._boundClose)
  }

  disconnect() {
    document.removeEventListener("mousedown", this._boundClose)
  }

  onInput() {
    clearTimeout(this._timer)
    const q = this.inputTarget.value.trim()
    if (q.length < 2) {
      this._close()
      return
    }
    this._timer = setTimeout(() => this._fetch(q), 300)
  }

  onKeydown(e) {
    if (e.key === "Escape") this._close()
  }

  async _fetch(q) {
    const res = await fetch(`/sessions.json?q=${encodeURIComponent(q)}`, {
      headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" }
    })
    const results = await res.json()
    this._render(results)
  }

  _render(results) {
    if (!results.length) {
      this.resultsTarget.innerHTML = `<div class="search-popup-empty">No results</div>`
    } else {
      this.resultsTarget.innerHTML = results.map(r => `
        <a href="${r.url}" class="search-popup-item" data-turbo-frame="_top">
          <i class="fa-solid fa-file-lines"></i>
          <span class="search-popup-label">${this._escape(r.label)}</span>
        </a>
      `).join("")
    }

    this._positionPopup()
    this.resultsTarget.hidden = false
  }

  _positionPopup() {
    const rect = this.inputTarget.closest(".sessions-search-field").getBoundingClientRect()
    const popup = this.resultsTarget
    popup.style.top   = `${rect.bottom + 6}px`
    popup.style.left  = `${rect.left}px`
    popup.style.width = `${rect.width}px`
  }

  _close() {
    this.resultsTarget.hidden = true
    this.resultsTarget.innerHTML = ""
  }

  _escape(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  _closeOnOutsideClick(e) {
    if (!this.element.contains(e.target)) this._close()
  }
}

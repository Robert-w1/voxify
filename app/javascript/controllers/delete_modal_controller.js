import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal", "backdrop", "title", "form"]

  open(e) {
    const btn   = e.currentTarget
    const label = btn.dataset.deleteModalTitleValue
    const url   = btn.dataset.deleteModalUrlValue
    this.show(label, url)
  }

  openWith(label, url) {
    this.show(label, url)
  }

  show(label, url) {
    this.titleTarget.textContent      = `Delete "${label}"?`
    this.formTarget.action            = url
    this.modalTarget.style.display    = "flex"
    this.backdropTarget.style.display = "block"
    document.body.style.overflow      = "hidden"
  }

  close() {
    this.modalTarget.style.display    = "none"
    this.backdropTarget.style.display = "none"
    document.body.style.overflow      = ""
  }

  connect() {
    this._keyHandler = (e) => { if (e.key === "Escape") this.close() }
    document.addEventListener("keydown", this._keyHandler)
  }

  disconnect() {
    document.removeEventListener("keydown", this._keyHandler)
  }
}

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display", "input", "trigger"]
  static values  = { url: String, original: String }

  startEditing(e) {
    e.stopPropagation()
    this.displayTarget.style.display = "none"
    this.inputTarget.style.display   = "block"
    this.inputTarget.focus()
    this.inputTarget.select()
  }

  async save(e) {
    if (e.type === "keydown" && e.key !== "Enter") return
    const newTitle = this.inputTarget.value.trim() || this.originalValue

    this.displayTarget.textContent   = newTitle
    this.displayTarget.style.display = "inline"
    this.inputTarget.style.display   = "none"

    try {
      await fetch(this.urlValue, {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ recording_session: { title: newTitle } })
      })
    } catch {
      this.displayTarget.textContent = this.originalValue
    }
  }

  cancel() {
    this.inputTarget.value           = this.originalValue
    this.displayTarget.style.display = "inline"
    this.inputTarget.style.display   = "none"
  }
}

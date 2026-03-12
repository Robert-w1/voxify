import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["trigger", "menu"]
  static values  = { title: String, url: String }

  toggle(e) {
    e.preventDefault()
    e.stopPropagation()
    const isOpen = this.menuTarget.style.display === "block"
    this.closeAll()
    if (!isOpen) {
      this.menuTarget.style.display = "block"
      this._outsideHandler = (ev) => {
        if (!this.element.contains(ev.target)) this.close()
      }
      document.addEventListener("click", this._outsideHandler)
    }
  }

  close() {
    this.menuTarget.style.display = "none"
    document.removeEventListener("click", this._outsideHandler)
  }

  closeAll() {
    document.querySelectorAll("[data-session-menu-target='menu']").forEach(m => {
      m.style.display = "none"
    })
  }

  rename(e) {
    e.preventDefault()
    this.close()

    SidebarModals.openRename({
      title:  this.titleValue,
      url:    this.urlValue,
      onSave: (newTitle) => {
        const label = this.element.querySelector(".recent-label")
        if (label) label.textContent = newTitle
        this.titleValue = newTitle
      }
    })
  }

  addToFolder(e) {
    e.preventDefault()
    this.close()
    // stubbed
  }

  confirmDelete(e) {
    e.preventDefault()
    this.close()

    SidebarModals.openDelete({
      title:     this.titleValue,
      url:       this.urlValue,
      onSuccess: () => {
        this.element.remove()
        const rowId = `recording_session_${this.urlValue.split("/").pop()}`
        const row   = document.getElementById(rowId)
        if (row) row.remove()
      }
    })
  }
}

const SidebarModals = (() => {

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]').content
  }

  function removeModal(backdrop, modal) {
    backdrop.remove()
    modal.remove()
    document.body.style.overflow = ""
  }

  function makeBackdrop(onClose) {
    const backdrop = document.createElement("div")
    backdrop.className = "delete-modal-backdrop"
    backdrop.addEventListener("click", onClose)
    return backdrop
  }

  function closeOnEsc(handler) {
    const fn = (e) => {
      if (e.key === "Escape") {
        handler()
        document.removeEventListener("keydown", fn)
      }
    }
    document.addEventListener("keydown", fn)
  }

  function openRename({ title, url, onSave }) {
    const backdrop = makeBackdrop(close)
    const modal    = document.createElement("div")
    modal.className    = "delete-modal"
    modal.style.display = "flex"
    modal.innerHTML = `
      <h4>Rename session</h4>
      <input class="input-field" style="width:100%; text-align:left; margin-top:4px;"
             type="text" value="${title}" />
      <div class="delete-modal__actions">
        <button class="btn btn-secondary btn-sm" data-role="cancel">Cancel</button>
        <button class="btn btn-primary btn-sm"   data-role="save">Save</button>
      </div>
    `

    function close() { removeModal(backdrop, modal) }

    modal.querySelector("[data-role='cancel']").addEventListener("click", close)
    modal.querySelector("[data-role='save']").addEventListener("click", async () => {
      const newTitle = modal.querySelector("input").value.trim()
      if (!newTitle || newTitle === title) { close(); return }

      await fetch(url, {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken()
        },
        body: JSON.stringify({ recording_session: { title: newTitle } })
      })

      if (onSave) onSave(newTitle)
      close()
    })

    modal.querySelector("input").addEventListener("keydown", (e) => {
      if (e.key === "Enter")  modal.querySelector("[data-role='save']").click()
      if (e.key === "Escape") close()
    })

    backdrop.style.display = "block"
    document.body.append(backdrop, modal)
    document.body.style.overflow = "hidden"
    setTimeout(() => {
      const input = modal.querySelector("input")
      input.focus()
      input.select()
    }, 50)

    closeOnEsc(close)
  }

  function openDelete({ title, url, onSuccess }) {
    const backdrop = makeBackdrop(close)
    const modal    = document.createElement("div")
    modal.className    = "delete-modal"
    modal.style.display = "flex"
    modal.innerHTML = `
      <div class="delete-modal__icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h4>Delete "${title}"?</h4>
      <p class="text-caption">This can't be undone. All recordings and reports will be permanently removed.</p>
      <div class="delete-modal__actions">
        <button class="btn btn-secondary btn-sm" data-role="cancel">Cancel</button>
        <button class="btn btn-danger btn-sm"    data-role="confirm">Delete</button>
      </div>
    `

    function close() { removeModal(backdrop, modal) }

    modal.querySelector("[data-role='cancel']").addEventListener("click", close)
    modal.querySelector("[data-role='confirm']").addEventListener("click", async () => {
      await fetch(url, {
        method:  "DELETE",
        headers: { "X-CSRF-Token": csrfToken() }
      })

      if (onSuccess) onSuccess()
      close()
    })

    backdrop.style.display = "block"
    document.body.append(backdrop, modal)
    document.body.style.overflow = "hidden"
    closeOnEsc(close)
  }

  return { openRename, openDelete }
})()

window.SidebarModals = SidebarModals

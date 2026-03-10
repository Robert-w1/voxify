import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="session-form"
export default class extends Controller {
  static targets = ["requiredField", "checkboxField", "submitButton"]

  validate() {
    const allValid = this.#radioGroupsSelected() && this.#atLeastOneCheckbox()
    this.submitButtonTarget.disabled = !allValid
  }

  // ── Private ──

  #radioGroupsSelected() {
    // Get unique radio button names, then check each group has a selection
    const radioNames = [...new Set(
      this.requiredFieldTargets.map(el => el.name)
    )]

    return radioNames.every(name =>
      this.requiredFieldTargets.some(el => el.name === name && el.checked)
    )
  }

  #atLeastOneCheckbox() {
    return this.checkboxFieldTargets.some(el => el.checked)
  }
}

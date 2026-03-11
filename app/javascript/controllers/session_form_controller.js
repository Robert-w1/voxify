import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="session-form"
export default class extends Controller {
  static targets = ["requiredField", "checkboxField", "submitButton"]

  connect() {
    this.previouslyChecked = {}
  }

  validate() {
    const allValid = this.#radioGroupsSelected() && this.#atLeastOneCheckbox()
    this.submitButtonTarget.disabled = !allValid
    this.#greyOutUnselectedRadios()
  }

  toggleRadio(event) {
    const radio = event.target
    const name = radio.name

    if (this.previouslyChecked[name] === radio.id) {
      radio.checked = false
      delete this.previouslyChecked[name]
    } else {
      this.previouslyChecked[name] = radio.id
    }

    this.validate()
  }

  // ── Private ──

  #radioGroupsSelected() {
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

  #greyOutUnselectedRadios() {
    const radioNames = [...new Set(
      this.requiredFieldTargets.map(el => el.name)
    )]

    radioNames.forEach(name => {
      const radiosInGroup = this.requiredFieldTargets.filter(el => el.name === name)
      const hasSelection = radiosInGroup.some(el => el.checked)

      radiosInGroup.forEach(radio => {
        const label = radio.nextElementSibling
        if (!label) return

        if (hasSelection && !radio.checked) {
          label.style.opacity = "0.4"
        } else {
          label.style.opacity = "1"
        }
      })
    })
  }
}

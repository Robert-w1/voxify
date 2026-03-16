import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="session-form"
export default class extends Controller {
  static targets = [
    "requiredField", "checkboxField", "submitButton", "warningMessage",
    "card", "stepDot", "prevButton", "nextButton", "selectionWarning"
  ]

  connect() {
    this.previouslyChecked = {}
    this.currentStep = 1
  }

  validate() {
    const allValid = this.#radioGroupsSelected()
    this.submitButtonTarget.disabled = !allValid
    if (allValid) this.warningMessageTarget.style.display = "none"
    this.#greyOutUnselectedRadios()
    // Hide selection warning when user makes a choice
    if (this.#currentStepHasSelection()) {
      this.selectionWarningTarget.style.display = "none"
    }
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

  nextStep() {
    if (this.currentStep >= 3) return

    if (!this.#currentStepHasSelection()) {
      this.selectionWarningTarget.style.display = "block"
      return
    }

    this.selectionWarningTarget.style.display = "none"
    this.#showStep(this.currentStep + 1)
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.#showStep(this.currentStep - 1)
    }
  }

  goToStep(event) {
    const step = parseInt(event.currentTarget.dataset.step)
    if (step <= this.#maxUnlockedStep()) {
      this.#showStep(step)
    }
  }

  attemptSubmit() {
    if (this.submitButtonTarget.disabled) {
      this.warningMessageTarget.style.display = "block"
    }
  }

  // ── Private ──

  #currentStepHasSelection() {
    if (this.currentStep === 1) {
      return this.requiredFieldTargets
        .filter(el => el.name.includes("presentation_type"))
        .some(el => el.checked)
    }
    if (this.currentStep === 2) {
      return this.requiredFieldTargets
        .filter(el => el.name.includes("audience"))
        .some(el => el.checked)
    }
    return true
  }

  #showStep(step) {
    this.currentStep = step
    this.selectionWarningTarget.style.display = "none"

    this.cardTargets.forEach(card => {
      card.hidden = parseInt(card.dataset.step) !== step
    })

    this.prevButtonTarget.hidden = (step === 1)
    this.nextButtonTarget.hidden = (step === 3)

    const maxUnlocked = this.#maxUnlockedStep()
    this.stepDotTargets.forEach(dot => {
      const s = parseInt(dot.dataset.step)
      dot.classList.toggle("active",    s === step)
      dot.classList.toggle("completed", s < step)
      dot.classList.toggle("locked",    s > maxUnlocked)
      if (s === step) dot.classList.remove("completed", "locked")
      if (s < step)   dot.classList.remove("active",    "locked")
    })
  }

  #maxUnlockedStep() {
    const hasType = this.requiredFieldTargets
      .filter(el => el.name.includes("presentation_type"))
      .some(el => el.checked)
    const hasAudience = this.requiredFieldTargets
      .filter(el => el.name.includes("audience"))
      .some(el => el.checked)

    if (hasType && hasAudience) return 3
    if (hasType) return 2
    return 1
  }

  #radioGroupsSelected() {
    const radioNames = [...new Set(
      this.requiredFieldTargets.map(el => el.name)
    )]

    return radioNames.every(name =>
      this.requiredFieldTargets.some(el => el.name === name && el.checked)
    )
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

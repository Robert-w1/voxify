import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="recorder"
export default class extends Controller {
  static targets = ["status"]

  connect() {
    this.requestMicrophone()
  }

  async requestMicrophone() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.statusTarget.textContent = "Microphone access granted 🎤"
    } catch (error) {
      console.error("Microphone permission denied:", error)
      this.statusTarget.textContent = "Microphone access denied ❌"
    }
  }
}

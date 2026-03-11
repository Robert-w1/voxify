import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="recorder"
export default class extends Controller {
  static targets = ["microphoneStatus", "recordingStatus"]

  connect() {
    this.requestMicrophone()
  }

  async requestMicrophone() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.microphoneStatusTarget.textContent = "Microphone access granted 🎤"
    } catch (error) {
      console.error("Microphone permission denied:", error)
      this.microphoneStatusTarget.textContent = "Microphone access denied ❌"
    }
  }

  start() {
    this.chunks = []

    this.mediaRecorder = new MediaRecorder(this.stream)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/webm" })
      console.log("Recorded blob:", this.audioBlob)

      // for testing: playback
      const audioURL = URL.createObjectURL(this.audioBlob)
      const audio = new Audio(audioURL)
      audio.controls = true
      document.body.appendChild(audio)
    }

    this.mediaRecorder.start()
    this.recordingStatusTarget.textContent = "Recording..."
  }

  stop() {
    this.mediaRecorder.stop()
    this.recordingStatusTarget.textContent = "Recording stopped"
  }
}

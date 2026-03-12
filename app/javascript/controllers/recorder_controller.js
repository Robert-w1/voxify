import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="recorder"
export default class extends Controller {
  static targets = ["microphoneStatus", "recordingStatus"]

  // Request Mic access
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

  // Start recording
  start() {
    this.chunks = []
    this.startTime = Date.now()

    this.mediaRecorder = new MediaRecorder(this.stream)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/webm" })
      this.durationSeconds = Math.round((Date.now() - this.startTime) / 1000)
      console.log("Recorded blob:", this.audioBlob)

      // for testing: playback
      // const audioURL = URL.createObjectURL(this.audioBlob)
      // const audio = new Audio(audioURL)
      // audio.controls = true
      // document.body.appendChild(audio)
      // URL.revokeObjectURL(audioURL)

      await this.upload()
    }

    this.mediaRecorder.start()
    this.recordingStatusTarget.textContent = "Recording..."
    this.stopTimer = setTimeout(() => this.stop(), 30000)
  }

  // Stop Recording
  stop() {
    clearTimeout(this.stopTimer)
    this.mediaRecorder.stop()
    this.recordingStatusTarget.textContent = "Recording stopped"
  }

  // Save recording to data base
  async upload() {
    const formData = new FormData()

    formData.append("audio", this.audioBlob, "recording.webm")
    formData.append("duration_seconds", this.durationSeconds)

    const sessionId = document.querySelector("[data-session-id]").dataset.sessionId

    console.log("fetching...")
    const response = await fetch(`/sessions/${sessionId}/recordings`, {
      method: "POST",
      body: formData,
      headers: {
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
      }
    })
    console.log("successful fetched")

    const data = await response.json()

    console.log("Upload finished:", data)
  }
}

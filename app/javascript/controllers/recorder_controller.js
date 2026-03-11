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

    this.mediaRecorder = new MediaRecorder(this.stream)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/webm" })
      console.log("Recorded blob:", this.audioBlob)

      // for testing: playback
      const audioURL = URL.createObjectURL(this.audioBlob)
      const audio = new Audio(audioURL)
      audio.controls = true
      document.body.appendChild(audio)
      URL.revokeObjectURL(url)

      await this.upload()
    }

    this.mediaRecorder.start()
    this.recordingStatusTarget.textContent = "Recording..."
  }

  // Stop Recording
  stop() {
    this.mediaRecorder.stop()
    this.recordingStatusTarget.textContent = "Recording stopped"
  }

  // Save recording to data base
  async upload() {
    const formData = new FormData()

    formData.append(
      "audio",
      this.audioBlob,
      "recording.webm"
    )

    const response = await fetch("/recordings", {
      method: "POST",
      body: formData,
      headers: {
        "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
      }
    })

    const data = await response.json()

    console.log("Upload finished:", data)
  }
}

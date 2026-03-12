import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="recorder"
// Manages the full session lifecycle: ready → recording → processing → completed
export default class extends Controller {
  static targets = [
    "stateReady", "stateRecording", "stateProcessing", "stateCompleted",
    "waveformCanvas", "timer", "micSelect",
    "pauseButton", "resumeButton", "restartButton",
    "uploadInput",
    "titleDisplay", "titleEdit", "titleInput",
    "overallScore", "reportSummary", "reportScores", "reportMetrics",
    "startOverButton", "tryAgainButton"
  ]

  static values = {
    sessionId: Number,
    maxDuration: { type: Number, default: 30 },
    focuses: { type: Array, default: [] }
  }

  // ────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────

  connect() {
    this.currentState = "ready"
    this.chunks = []
    this.elapsed = 0
    this.isPaused = false
    this.reportData = null
    this.enumerateDevices()
  }

  disconnect() {
    this._stopWaveformLoop()
    this._stopTimer()
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
    }
    if (this.audioContext) {
      this.audioContext.close()
    }
  }

  // ────────────────────────────────────────
  // STATE MANAGEMENT
  // ────────────────────────────────────────

  _transitionTo(state) {
    this.currentState = state

    // Toggle state panels
    const panels = {
      ready:      this.stateReadyTarget,
      recording:  this.stateRecordingTarget,
      processing: this.stateProcessingTarget,
      completed:  this.stateCompletedTarget
    }

    Object.entries(panels).forEach(([key, el]) => {
      el.hidden = (key !== state)
    })

    // Toggle bottom buttons
    this.startOverButtonTarget.hidden  = (state !== "processing")
    this.tryAgainButtonTarget.hidden   = (state !== "completed")
  }

  // ────────────────────────────────────────
  // MIC ENUMERATION
  // ────────────────────────────────────────

  async enumerateDevices() {
    try {
      // Need a stream first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tempStream.getTracks().forEach(t => t.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === "audioinput")

      const select = this.micSelectTarget
      select.innerHTML = ""

      audioInputs.forEach((device, i) => {
        const option = document.createElement("option")
        option.value = device.deviceId
        option.textContent = device.label || `Microphone ${i + 1}`
        select.appendChild(option)
      })

      this.selectedDeviceId = audioInputs[0]?.deviceId || null
    } catch (err) {
      console.error("Could not enumerate audio devices:", err)
      const select = this.micSelectTarget
      select.innerHTML = "<option>Microphone unavailable</option>"
    }
  }

  switchMic() {
    this.selectedDeviceId = this.micSelectTarget.value
    // If currently recording, restart the stream with the new mic
    if (this.currentState === "recording" && !this.isPaused) {
      this._restartStreamWithNewMic()
    }
  }

  async _restartStreamWithNewMic() {
    // Stop old stream
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: this.selectedDeviceId } }
      })
      this._connectAudioAnalyser()
    } catch (err) {
      console.error("Failed to switch mic:", err)
    }
  }

  // ────────────────────────────────────────
  // RECORDING
  // ────────────────────────────────────────

  async startRecording() {
    try {
      const constraints = this.selectedDeviceId
        ? { audio: { deviceId: { exact: this.selectedDeviceId } } }
        : { audio: true }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      console.error("Microphone permission denied:", err)
      alert("Microphone access is required to record. Please allow microphone access and try again.")
      return
    }

    this.chunks = []
    this.elapsed = 0
    this.isPaused = false
    this.startTime = Date.now()

    // Set up MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.stream)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/webm" })
      this.durationSeconds = Math.round(this.elapsed)
      await this._upload()
    }

    this.mediaRecorder.start(250) // collect data every 250ms

    // Set up audio visualization
    this._setupAudioContext()
    this._connectAudioAnalyser()
    this._startWaveformLoop()

    // Start timer
    this._startTimer()

    // Auto-stop at max duration
    this.maxDurationTimer = setTimeout(() => {
      this.stopRecording()
    }, this.maxDurationValue * 1000)

    // Show recording controls
    this.pauseButtonTarget.hidden = false
    this.resumeButtonTarget.hidden = true
    this.restartButtonTarget.hidden = true

    this._transitionTo("recording")
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause()
      this.isPaused = true
      this._stopTimer()
      this._stopWaveformLoop()

      // Toggle control visibility
      this.pauseButtonTarget.hidden = true
      this.resumeButtonTarget.hidden = false
      this.restartButtonTarget.hidden = false
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume()
      this.isPaused = false
      this._startTimer()
      this._startWaveformLoop()

      // Toggle control visibility
      this.pauseButtonTarget.hidden = false
      this.resumeButtonTarget.hidden = true
      this.restartButtonTarget.hidden = true
    }
  }

  stopRecording() {
    clearTimeout(this.maxDurationTimer)
    this._stopTimer()
    this._stopWaveformLoop()

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
    }

    this._transitionTo("processing")
  }

  restartRecording() {
    // Stop everything and go back to ready
    clearTimeout(this.maxDurationTimer)
    this._stopTimer()
    this._stopWaveformLoop()

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
      // Override the onstop handler so it doesn't upload
      this.mediaRecorder.onstop = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
    }

    this.chunks = []
    this.elapsed = 0
    this._updateTimerDisplay()

    this._transitionTo("ready")
  }

  // ────────────────────────────────────────
  // FILE UPLOAD
  // ────────────────────────────────────────

  triggerUpload() {
    this.uploadInputTarget.click()
  }

  async handleUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    // Validate it's an audio file
    if (!file.type.startsWith("audio/")) {
      alert("Please select an audio file.")
      return
    }

    // Validate size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert("File is too large. Maximum size is 50MB.")
      return
    }

    this.audioBlob = file
    this.durationSeconds = null // server can calculate from file

    this._transitionTo("processing")
    await this._upload()
  }

  // ────────────────────────────────────────
  // UPLOAD TO SERVER
  // ────────────────────────────────────────

  async _upload() {
    const formData = new FormData()
    formData.append("audio", this.audioBlob, "recording.webm")
    if (this.durationSeconds) {
      formData.append("duration_seconds", this.durationSeconds)
    }

    try {
      const response = await fetch(`/sessions/${this.sessionIdValue}/recordings`, {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        }
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const data = await response.json()
      this.reportData = data.report

      // Update title if AI suggested one
      if (data.suggested_title) {
        this._updateTitleDisplay(data.suggested_title)
      }

      this._renderReport(data.report)
      this._transitionTo("completed")

    } catch (err) {
      console.error("Upload error:", err)
      alert("Something went wrong processing your recording. Please try again.")
      this._transitionTo("ready")
    }
  }

  // ────────────────────────────────────────
  // AUDIO CONTEXT & WAVEFORM
  // ────────────────────────────────────────

  _setupAudioContext() {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.bufferLength = this.analyser.frequencyBinCount
    this.dataArray = new Uint8Array(this.bufferLength)
  }

  _connectAudioAnalyser() {
    if (this.sourceNode) {
      this.sourceNode.disconnect()
    }
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.sourceNode.connect(this.analyser)
  }

  _startWaveformLoop() {
    const canvas = this.waveformCanvasTarget
    const ctx = canvas.getContext("2d")
    const width = canvas.width
    const height = canvas.height

    const draw = () => {
      this.animationFrame = requestAnimationFrame(draw)
      this.analyser.getByteFrequencyData(this.dataArray)

      // Background
      ctx.fillStyle = "#F7F5F0"
      ctx.fillRect(0, 0, width, height)

      const barCount = this.bufferLength
      const barWidth = (width / barCount) * 1.2
      const gap = 1

      for (let i = 0; i < barCount; i++) {
        const value = this.dataArray[i]
        const barHeight = (value / 255) * height * 0.85

        const x = i * (barWidth + gap)
        const y = (height - barHeight) / 2

        // Gradient from teal to accent
        const ratio = i / barCount
        const r = Math.round(13 + ratio * (232 - 13))
        const g = Math.round(115 + ratio * (145 - 115))
        const b = Math.round(119 + ratio * (58 - 119))

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, 2)
        ctx.fill()
      }
    }

    draw()
  }

  _stopWaveformLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  // ────────────────────────────────────────
  // TIMER
  // ────────────────────────────────────────

  _startTimer() {
    this.timerStart = Date.now() - (this.elapsed * 1000)

    this.timerInterval = setInterval(() => {
      this.elapsed = (Date.now() - this.timerStart) / 1000

      // Auto-stop at max duration
      if (this.elapsed >= this.maxDurationValue) {
        this.stopRecording()
        return
      }

      this._updateTimerDisplay()
    }, 100)
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  _updateTimerDisplay() {
    const mins = Math.floor(this.elapsed / 60).toString().padStart(2, "0")
    const secs = Math.floor(this.elapsed % 60).toString().padStart(2, "0")
    this.timerTarget.textContent = `${mins}:${secs}`
  }

  // ────────────────────────────────────────
  // TITLE EDITING
  // ────────────────────────────────────────

  editTitle() {
    this.titleDisplayTarget.hidden = true
    this.titleEditTarget.hidden = false
    this.titleInputTarget.focus()
    this.titleInputTarget.select()
  }

  async saveTitle() {
    const newTitle = this.titleInputTarget.value.trim()
    if (!newTitle) return

    try {
      const response = await fetch(`/sessions/${this.sessionIdValue}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        },
        body: JSON.stringify({ recording_session: { title: newTitle } })
      })

      if (response.ok) {
        this._updateTitleDisplay(newTitle)
      }
    } catch (err) {
      console.error("Failed to update title:", err)
    }

    this.titleEditTarget.hidden = true
    this.titleDisplayTarget.hidden = false
  }

  cancelEditTitle() {
    this.titleEditTarget.hidden = true
    this.titleDisplayTarget.hidden = false
  }

  _updateTitleDisplay(title) {
    const h1 = this.titleDisplayTarget.querySelector("h1")
    if (h1) h1.textContent = title
    this.titleInputTarget.value = title
  }

  // ────────────────────────────────────────
  // START OVER / TRY AGAIN
  // ────────────────────────────────────────

  startOver() {
    this._transitionTo("ready")
  }

  tryAgain() {
    this._transitionTo("ready")
  }

  // ────────────────────────────────────────
  // REPORT RENDERING
  // ────────────────────────────────────────

  _renderReport(report) {
    if (!report) return

    // Overall score
    const scoreEl = this.overallScoreTarget
    const scoreNum = scoreEl.querySelector(".score-number")
    scoreNum.textContent = report.overall_score
    scoreEl.className = `report-overall-score ${this._scoreClass(report.overall_score)}`

    // Summary
    this.reportSummaryTarget.innerHTML = `
      <h4 class="mb-2">Summary</h4>
      <p>${report.summary}</p>
    `

    // Focus feedbacks (detailed cards)
    const scoresContainer = this.reportScoresTarget
    scoresContainer.innerHTML = ""

    const feedbacks = report.focus_feedbacks || {}
    Object.entries(feedbacks).forEach(([key, data]) => {
      const card = document.createElement("div")
      card.className = "report-score-card info-card p-3 mb-3"

      let detailsHtml = ""
      if (data.details) {
        if (key === "filler_words" && data.details.words) {
          detailsHtml = `
            <div class="score-details mt-2">
              <span class="text-caption">Count: <strong>${data.details.count}</strong></span>
              <div class="filler-word-tags mt-1">
                ${data.details.words.map(w =>
                  `<span class="filler-tag">${w.word} <span class="text-caption">&times;${w.count}</span></span>`
                ).join("")}
              </div>
            </div>
          `
        }
        if (key === "pace" && data.details.wpm) {
          detailsHtml = `
            <div class="score-details mt-2">
              <span class="text-caption">${data.details.wpm} words per minute</span>
            </div>
          `
        }
      }

      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h4 class="mb-0">${this._formatLabel(key)}</h4>
          <span class="score-badge ${this._scoreClass(data.score)}">${data.score}</span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill ${this._scoreClass(data.score)}" style="width: ${data.score}%"></div>
        </div>
        <p class="text-caption mt-2 mb-0">${data.feedback}</p>
        ${detailsHtml}
      `
      scoresContainer.appendChild(card)
    })

    // Metrics bar
    if (report.metrics) {
      this.reportMetricsTarget.innerHTML = `
        <div class="report-metric text-center">
          <span class="metric-value">${report.metrics.duration_seconds}s</span>
          <span class="text-caption">Duration</span>
        </div>
        <div class="report-metric text-center">
          <span class="metric-value">${report.metrics.words_per_minute}</span>
          <span class="text-caption">Words/min</span>
        </div>
        <div class="report-metric text-center">
          <span class="metric-value">${report.metrics.filler_word_count}</span>
          <span class="text-caption">Filler words</span>
        </div>
      `
    }
  }

  _scoreClass(score) {
    if (score >= 80) return "score-high"
    if (score >= 60) return "score-mid"
    return "score-low"
  }

  _formatLabel(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  // ────────────────────────────────────────
  // DOWNLOAD REPORT
  // ────────────────────────────────────────

  downloadReport() {
    if (!this.reportData) return

    const blob = new Blob([JSON.stringify(this.reportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `travis-report-${this.sessionIdValue}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

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
    "overallScore", "reportSummary", "reportStrengths", "reportImprovements",
    "reportFocus", "reportMetrics",
    "startOverButton", "tryAgainButton",
    "downloadButton"
  ]

  static values = {
    sessionId: Number,
    maxDuration: { type: Number, default: 30 },
    focuses: { type: Array, default: [] },
    initialStatus: { type: String, default: "" },
    initialReport: { type: Object, default: {} },
    pdfStatusUrl: { type: String, default: "" },
    reportStatusUrl: { type: String, default: "" },
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
    this._initFromStatus()
  }

  disconnect() {
    this._stopWaveformLoop()
    this._stopTimer()
    this._stopReportPolling()
    this._stopPdfPolling()
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
    }
    if (this.audioContext) {
      this.audioContext.close()
    }
  }

  // ────────────────────────────────────────
  // INIT FROM SERVER STATE
  // ────────────────────────────────────────

  _initFromStatus() {
    const status = this.initialStatusValue
    const report = this.initialReportValue

    if (status === "processing") {
      this._transitionTo("processing")
      this._startReportPolling()
    } else if (status === "completed") {
      if (report && Object.keys(report).length > 0) {
        this.reportData = report
        this._renderReport(report)
      }
      this._transitionTo("completed")
    }
    // "recording", "failed" → stay in "ready"
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

      this._startReportPolling()

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

  startOver() { this._transitionTo("ready") }
  tryAgain()   { this._transitionTo("ready") }

  // ────────────────────────────────────────
  // REPORT STATUS POLLING
  // ────────────────────────────────────────

  _startReportPolling() {
    this._stopReportPolling()
    this.reportPollInterval = setInterval(async () => {
      try {
        const response = await fetch(this.reportStatusUrlValue, {
          headers: { "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content }
        })
        const data = await response.json()

        if (data.status === "completed") {
          this._stopReportPolling()
          this.reportData = data.report
          this._renderReport(data.report)
          this._transitionTo("completed")
        } else if (data.status === "failed") {
          this._stopReportPolling()
          alert("Something went wrong processing your recording. Please try again.")
          this._transitionTo("ready")
        }
      } catch (err) {
        console.error("Report status check failed:", err)
      }
    }, 3000)
  }

  _stopReportPolling() {
    if (this.reportPollInterval) {
      clearInterval(this.reportPollInterval)
      this.reportPollInterval = null
    }
  }

  // ────────────────────────────────────────
  // PDF STATUS POLLING
  // ────────────────────────────────────────

  _setPdfButtonState(ready) {
    if (!this.hasDownloadButtonTarget) return
    const btn = this.downloadButtonTarget
    if (ready) {
      btn.removeAttribute("disabled")
      btn.style.pointerEvents = ""
      btn.style.opacity = ""
      btn.innerHTML = '<i class="fa fa-download"></i> Download full report'
    } else {
      btn.setAttribute("disabled", "disabled")
      btn.style.pointerEvents = "none"
      btn.style.opacity = "0.6"
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating PDF...'
    }
  }

  _startPdfPolling() {
    this._stopPdfPolling()
    this.pdfPollInterval = setInterval(async () => {
      try {
        const response = await fetch(this.pdfStatusUrlValue, {
          headers: { "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content }
        })
        const data = await response.json()
        if (data.ready) {
          this._stopPdfPolling()
          this._setPdfButtonState(true)
        }
      } catch (err) {
        console.error("PDF status check failed:", err)
      }
    }, 3000)
  }

  _stopPdfPolling() {
    if (this.pdfPollInterval) {
      clearInterval(this.pdfPollInterval)
      this.pdfPollInterval = null
    }
  }

  // ────────────────────────────────────────
  // REPORT RENDERING
  // ────────────────────────────────────────

  _renderReport(report) {
    if (!report) return

    // PDF button
    this._setPdfButtonState(report.pdf_ready || false)
    if (!report.pdf_ready) this._startPdfPolling()

    // Overall score (1-100)
    const scoreEl = this.overallScoreTarget
    scoreEl.querySelector(".score-number").textContent = report.overall_score
    scoreEl.className = `report-overall-score flex-shrink-0 ${this._overallScoreClass(report.overall_score)}`

    // Summary
    this.reportSummaryTarget.innerHTML = `<p class="mb-0">${report.summary || ""}</p>`

    // Strengths
    const strengths = report.top_strengths || []
    this.reportStrengthsTarget.innerHTML = `
      <div class="insight-header mb-3">
        <span class="insight-icon insight-icon--success"><i class="fa fa-star"></i></span>
        <h5 class="mb-0">Strengths</h5>
      </div>
      <ul class="report-insight-list">
        ${strengths.map(s => `<li>${s}</li>`).join("")}
      </ul>
    `

    // Improvements
    const improvements = report.top_improvements || []
    this.reportImprovementsTarget.innerHTML = `
      <div class="insight-header mb-3">
        <span class="insight-icon insight-icon--accent"><i class="fa fa-arrow-up"></i></span>
        <h5 class="mb-0">To Improve</h5>
      </div>
      <ul class="report-insight-list">
        ${improvements.map(i => `<li>${i}</li>`).join("")}
      </ul>
    `

    // Recommended focus
    const focus = report.recommended_focus || ""
    const focusData = (report.focus_feedbacks || {})[focus]
    const focusScore = focusData?.score
    const focusWhy = focusData?.summary || ""
    this.reportFocusTarget.innerHTML = `
      <div class="report-focus-card">
        <div class="insight-header mb-2">
          <span class="insight-icon insight-icon--primary"><i class="fa fa-bullseye"></i></span>
          <h5 class="mb-0">Recommended Focus</h5>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="focus-category-label">${this._formatLabel(focus)}</span>
          ${focusScore != null ? `<span class="score-badge ${this._scoreClass(focusScore)}">${focusScore} / 10</span>` : ""}
        </div>
        ${focusWhy ? `<p class="text-caption mb-0">${focusWhy}</p>` : ""}
      </div>
    `

    // Metrics
    if (report.metrics) {
      const dur = report.metrics.duration_seconds
      const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`
      this.reportMetricsTarget.innerHTML = `
        <div class="report-metric text-center">
          <span class="metric-value">${durLabel}</span>
          <span class="text-caption">Duration</span>
        </div>
        <div class="report-metric text-center">
          <span class="metric-value">${report.metrics.words_per_minute}</span>
          <span class="text-caption">Words / min</span>
        </div>
        <div class="report-metric text-center">
          <span class="metric-value">${report.metrics.filler_word_count}</span>
          <span class="text-caption">Filler words</span>
        </div>
      `
    }
  }

  _overallScoreClass(score) {
    if (score >= 80) return "score-high"
    if (score >= 60) return "score-mid"
    return "score-low"
  }

  _scoreClass(score) {
    if (score >= 8) return "score-high"
    if (score >= 6) return "score-mid"
    return "score-low"
  }

  _formatLabel(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

}

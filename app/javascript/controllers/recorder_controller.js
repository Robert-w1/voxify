import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="recorder"
// State machine: ready → countdown → recording → review → processing → completed
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
    "downloadButton",
    "stateLabel",
    "timerDisplay",
    "countdownArea", "countdown",
    "waveformWrapper",
    "recordButtonArea", "recordButton", "recordIcon", "buttonLabel",
    "micBar",
    "micGrantArea",
    "uploadArea", "fileInput",
    "reviewControls",
    "processingIndicator"
  ]

  static values = {
    sessionId:     Number,
    initialStatus: { type: String, default: "" },
    initialReport: { type: Object, default: {} },
    pdfStatusUrl: { type: String, default: "" },
    reportStatusUrl: { type: String, default: "" },
  }

  // ────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────

  connect() {
    this.currentState     = "ready"
    this.chunks           = []
    this.elapsed          = 0
    this.stream           = null
    this.audioBlob        = null
    this.reportData       = null
    this.selectedDeviceId = null
    this._initFromStatus()
    this._initMic()
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
    if (this.countdownInterval) clearInterval(this.countdownInterval)
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

    const labels = {
      ready:      "Ready to record",
      countdown:  "Get ready\u2026",
      recording:  "Recording",
      review:     "Review recording",
      processing: "Processing",
      completed:  "Complete",
    }
    this.stateLabelTarget.textContent = labels[state] || state

    // Waveform opacity per state
    const opacities = { ready: 0.2, countdown: 0.1, recording: 1, review: 0.6, processing: 0.1, completed: 0 }
    this.waveformWrapperTarget.style.opacity = opacities[state] ?? 0.2

    // Timer: visible during recording + review only
    this.timerDisplayTarget.hidden = !["recording", "review"].includes(state)

    // Countdown overlay
    this.countdownAreaTarget.hidden = (state !== "countdown")

    // Record button: visible in ready + recording
    this.recordButtonAreaTarget.hidden = !["ready", "recording"].includes(state)

    // Morph record icon: circle (ready) → rounded square (recording)
    if (state === "recording") {
      this.recordIconTarget.style.borderRadius = "4px"
      this.recordButtonTarget.classList.add("record-btn--active")
      this.buttonLabelTarget.textContent = "Tap to stop"
    } else {
      this.recordIconTarget.style.borderRadius = "50%"
      this.recordButtonTarget.classList.remove("record-btn--active")
      this.buttonLabelTarget.textContent = "Tap to record"
    }

    // Mic bar: visible in ready + recording
    this.micBarTarget.hidden = !["ready", "recording"].includes(state)

    // Grant prompt: hidden once we've left the ready state (or never shown if permission already held)
    if (state !== "ready") this.micGrantAreaTarget.hidden = true

    // Upload area: visible in ready state only
    this.uploadAreaTarget.hidden = (state !== "ready")

    this.reviewControlsTarget.hidden     = (state !== "review")
    this.processingIndicatorTarget.hidden = (state !== "processing")
    this.stateCompletedTarget.hidden      = (state !== "completed")

    // Keep sidebar status dot in sync without a page refresh.
    // Rails dom_id(session, :sidebar_title) → "sidebar_title_recording_session_<id>"
    const sidebarStatusMap = {
      recording:  "recording",
      processing: "processing",
      completed:  "completed",
    }
    if (sidebarStatusMap[state]) {
      const frame = document.getElementById(`sidebar_title_recording_session_${this.sessionIdValue}`)
      const dot   = frame?.querySelector(".status-dot")
      if (dot) dot.className = `status-dot status-dot--${sidebarStatusMap[state]}`
    }
  }

  // ────────────────────────────────────────
  // RECORD BUTTON (morphing — dispatches based on state)
  // ────────────────────────────────────────

  handleRecordButton() {
    if (this.currentState === "ready") {
      this.startCountdown()
    } else if (this.currentState === "recording") {
      this.stopRecording()
    }
  }

  // ────────────────────────────────────────
  // COUNTDOWN
  // ────────────────────────────────────────

  startCountdown() {
    if (this.currentState !== "ready") return
    this._transitionTo("countdown")

    let count = 3
    this.countdownTarget.textContent = count
    this._animateCountdown()

    this.countdownInterval = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(this.countdownInterval)
        this.startRecording()
      } else {
        this.countdownTarget.textContent = count
        this._animateCountdown()
      }
    }, 1000)
  }

  skipCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
    this.startRecording()
  }

  _animateCountdown() {
    const el = this.countdownTarget
    el.style.animation = "none"
    el.offsetHeight // force reflow
    el.style.animation = "countdownPop 0.4s ease-out forwards"
  }

  // ────────────────────────────────────────
  // MIC ACQUISITION & ENUMERATION
  // ────────────────────────────────────────

  // On load: check if mic permission is already granted.
  // If yes, acquire silently. If no, show the grant button — getUserMedia requires a user gesture.
  async _initMic() {
    if (["completed", "processing"].includes(this.currentState)) return

    this.recordButtonTarget.disabled = true

    const alreadyGranted = await this._checkMicPermission()
    if (alreadyGranted) {
      try {
        await this._acquireMic()
        await this._enumerateDevices()
        this.stateLabelTarget.textContent = "Ready to record"
        this.recordButtonTarget.disabled = false
      } catch (err) {
        console.error("Mic init failed:", err)
        this._showGrantPrompt()
      }
    } else {
      this._showGrantPrompt()
    }
  }

  _showGrantPrompt() {
    this.micGrantAreaTarget.hidden = false
    this.stateLabelTarget.textContent = "Microphone access required"
  }

  // Called by the "Grant microphone access" button — runs inside a user gesture.
  async requestMicAccess() {
    this.micGrantAreaTarget.hidden = true
    this.stateLabelTarget.textContent = "Requesting microphone access\u2026"

    try {
      await this._acquireMic()
      await this._enumerateDevices()
      this.stateLabelTarget.textContent = "Ready to record"
      this.recordButtonTarget.disabled = false
    } catch (err) {
      console.error("Mic access denied:", err)
      this.stateLabelTarget.textContent = "Microphone access denied \u2014 check System Preferences \u203a Privacy \u203a Microphone"
      this.micGrantAreaTarget.hidden = false
    }
  }

  // Returns true if microphone permission has already been granted (no dialog needed).
  async _checkMicPermission() {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: "microphone" })
        return result.state === "granted"
      }
      // Fallback: if enumerateDevices returns a labelled audioinput, permission was granted before
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some(d => d.kind === "audioinput" && d.label)
    } catch {
      return false
    }
  }

  async _acquireMic() {
    // Reuse the stream if it's still active (avoids re-triggering permission dialog)
    if (this.stream && this.stream.active) return
    this.stream = null
    const constraints = this.selectedDeviceId
      ? { audio: { deviceId: { exact: this.selectedDeviceId } } }
      : { audio: true }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints)
  }

  // ────────────────────────────────────────
  // MIC ENUMERATION & SELECTION
  // ────────────────────────────────────────

  async _enumerateDevices() {
    try {
      const devices    = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === "audioinput")
      if (audioInputs.length === 0) return

      const select = this.micSelectTarget
      const currentValue = select.value
      select.innerHTML = ""

      audioInputs.forEach((device, i) => {
        const option = document.createElement("option")
        option.value = device.deviceId
        option.textContent = device.label || `Microphone ${i + 1}`
        select.appendChild(option)
      })

      // Restore previously selected device if still present
      if (currentValue && [...select.options].some(o => o.value === currentValue)) {
        select.value = currentValue
      }

      this.selectedDeviceId = select.value || null
    } catch (err) {
      console.error("Could not enumerate audio devices:", err)
    }
  }

  async switchMic() {
    this.selectedDeviceId = this.micSelectTarget.value
    // Stop the old stream and re-acquire with the selected device
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
    try {
      await this._acquireMic()
    } catch (err) {
      console.error("Could not switch microphone:", err)
    }
  }

  // ────────────────────────────────────────
  // RECORDING
  // ────────────────────────────────────────

  async startRecording() {
    this.chunks  = []
    this.elapsed = 0

    this.mediaRecorder = new MediaRecorder(this.stream)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }

    this.mediaRecorder.onstop = () => {
      this.audioBlob       = new Blob(this.chunks, { type: "audio/webm" })
      this.durationSeconds = Math.round(this.elapsed)
    }

    this.mediaRecorder.start(250)

    this._setupAudioContext()
    this._connectAudioAnalyser()
    this._startWaveformLoop()
    this._startTimer()

    this._transitionTo("recording")
  }

  stopRecording() {
    this._stopTimer()
    this._stopWaveformLoop()

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }

    this._transitionTo("review")
  }

  // ────────────────────────────────────────
  // REVIEW
  // ────────────────────────────────────────

  reRecord() {
    this.chunks    = []
    this.audioBlob = null
    this.elapsed   = 0
    this._updateTimerDisplay()
    // Keep stream alive — stopping it would re-trigger the permission dialog next time
    this._transitionTo("ready")
  }

  triggerFileUpload() {
    this.fileInputTarget.click()
  }

  handleFileSelected(event) {
    const file = event.target.files[0]
    if (!file) return
    this.audioBlob       = file
    this.durationSeconds = null
    // Reset the input so the same file can be re-selected if needed
    event.target.value = ""
    this._transitionTo("review")
  }

  playRecording() {
    if (!this.audioBlob) return
    const url   = URL.createObjectURL(this.audioBlob)
    const audio = new Audio(url)
    audio.play()
  }

  async submitRecording() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
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
        body:   formData,
        headers: {
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        }
      })

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`)

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
      this.audioContext = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)()
    }
    this.analyser        = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.bufferLength    = this.analyser.frequencyBinCount
    this.dataArray       = new Uint8Array(this.bufferLength)
  }

  _connectAudioAnalyser() {
    if (this.sourceNode) this.sourceNode.disconnect()
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.sourceNode.connect(this.analyser)
  }

  _startWaveformLoop() {
    const canvas = this.waveformCanvasTarget
    const ctx    = canvas.getContext("2d")
    const width  = canvas.width
    const height = canvas.height

    const draw = () => {
      this.animationFrame = requestAnimationFrame(draw)
      this.analyser.getByteFrequencyData(this.dataArray)

      ctx.fillStyle = "#F7F5F0"
      ctx.fillRect(0, 0, width, height)

      const barCount = this.bufferLength
      const barWidth = (width / barCount) * 1.2
      const gap      = 1

      for (let i = 0; i < barCount; i++) {
        const value     = this.dataArray[i]
        const barHeight = (value / 255) * height * 0.85
        const x         = i * (barWidth + gap)
        const y         = (height - barHeight) / 2

        const ratio = i / barCount
        const r = Math.round(13  + ratio * (232 - 13))
        const g = Math.round(115 + ratio * (145 - 115))
        const b = Math.round(119 + ratio * (58  - 119))

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
    const mins = Math.floor(this.elapsed / 60).toString()
    const secs = Math.floor(this.elapsed % 60).toString().padStart(2, "0")
    this.timerTarget.textContent = `${mins}:${secs}`
  }

  // ────────────────────────────────────────
  // TITLE EDITING
  // ────────────────────────────────────────

  editTitle() {
    const el = this.titleDisplayTarget
    this._titleOriginal = el.textContent
    el.contentEditable = "true"
    el.focus()
    // Place cursor at end
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
  }

  titleKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault()
      this.titleDisplayTarget.blur()
    } else if (event.key === "Escape") {
      this.titleDisplayTarget.textContent = this._titleOriginal
      this.titleDisplayTarget.contentEditable = "false"
    }
  }

  async saveTitle() {
    const el = this.titleDisplayTarget
    if (el.contentEditable !== "true") return
    el.contentEditable = "false"

    const newTitle = el.textContent.trim()
    if (!newTitle || newTitle === this._titleOriginal) return

    try {
      const response = await fetch(`/sessions/${this.sessionIdValue}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content,
          "Accept": "application/json"
        },
        body: JSON.stringify({ recording_session: { title: newTitle } })
      })

      if (!response.ok) throw new Error(`Save failed: ${response.status}`)

      // Update sidebar label instantly without a page refresh
      const frame = document.getElementById(`sidebar_title_recording_session_${this.sessionIdValue}`)
      const label = frame?.querySelector(".recent-label")
      if (label) label.textContent = newTitle
    } catch (err) {
      console.error("Title save error:", err)
      el.textContent = this._titleOriginal
      alert("Could not save title. Please try again.")
    }
  }

  _updateTitleDisplay(title) {
    this.titleDisplayTarget.textContent = title.split(" - ")[0]
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
    const scoreNum = scoreEl.querySelector(".score-number")
    scoreNum.textContent = report.overall_score
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

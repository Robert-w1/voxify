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
    "processingIndicator",
    "playIcon",
    "processingMessage",
    "cardBody",
    "card",
    "reportSecondary", "reportFadeOverlay", "reportFocusAll", "focusChevron"
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
    this._localizeTimestamps()
  }

  disconnect() {
    this._stopWaveformLoop()
    this._stopTimer()
    this._stopReportPolling()
    this._stopPdfPolling()
    this._stopProcessingMessages()
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

    // Card: lock height in completed state, release on other states
    if (this.hasCardTarget) {
      if (state === "completed") {
        this.cardTarget.classList.add("session-card--completed")
      } else {
        this.cardTarget.classList.remove("session-card--completed", "expanded")
      }
    }

    // Card body: hidden in completed state so the report section fills the space
    if (this.hasCardBodyTarget) {
      this.cardBodyTarget.style.display = (state === "completed") ? "none" : ""
      // Top-align content during waveform states so the waveform stays at the same Y
      // position regardless of how much content is below it. Center in ready/countdown.
      const topAlignStates = ["recording", "review", "processing"]
      this.cardBodyTarget.style.justifyContent = topAlignStates.includes(state) ? "flex-start" : ""
    }

    // Waveform: hidden in ready (not yet recording) and completed states
    const opacities = { countdown: 0.1, recording: 1, review: 1, processing: 0.1 }
    this.waveformWrapperTarget.style.opacity = opacities[state] ?? 0.2
    this.waveformWrapperTarget.style.display = (state === "completed" || state === "ready") ? "none" : ""
    this.waveformWrapperTarget.style.cursor  = (state === "review") ? "pointer" : ""

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

    // Mic bar: visible in ready only (hide once recording starts to reduce card height)
    this.micBarTarget.hidden = (state !== "ready")

    // Grant prompt: hidden once we've left the ready state (or never shown if permission already held)
    if (state !== "ready") this.micGrantAreaTarget.hidden = true

    // Upload area: visible in ready state only
    this.uploadAreaTarget.hidden = (state !== "ready")

    this.reviewControlsTarget.hidden     = (state !== "review")
    this.processingIndicatorTarget.hidden = (state !== "processing")
    this.stateCompletedTarget.hidden      = (state !== "completed")

    // Processing message (sits right below waveform)
    if (this.hasProcessingMessageTarget) {
      this.processingMessageTarget.hidden = (state !== "processing")
    }

    if (state === "processing") {
      this._startProcessingMessages()
    } else {
      this._stopProcessingMessages()
    }

    // Keep sidebar status dot in sync without a page refresh.
    // Rails dom_id(session, :sidebar_title) → "sidebar_title_recording_session_<id>"
    const sidebarStatusMap = {
      ready:      "pending",
      countdown:  "pending",
      recording:  "recording",
      review:     "pending",
      processing: "processing",
      completed:  "completed",
    }
    const frame = document.getElementById(`sidebar_title_recording_session_${this.sessionIdValue}`)
    const dot   = frame?.querySelector(".status-dot")
    if (dot) dot.className = `status-dot status-dot--${sidebarStatusMap[state] ?? "pending"}`
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
      this._setupReviewWaveform()
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
    // Clean up review waveform
    if (this.reviewAudio) { this.reviewAudio.pause(); this.reviewAudio = null }
    this._waveformData     = null
    this._waveformDuration = null
    if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play"
    const canvas = this.waveformCanvasTarget
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height)
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
    this._setupReviewWaveform()
  }

  playRecording() {
    if (!this.reviewAudio) return
    if (this.reviewAudio.paused) {
      this.reviewAudio.play()
      if (this.hasPlayIconTarget) {
        this.playIconTarget.className = "fa-solid fa-pause"
      }
    } else {
      this.reviewAudio.pause()
      if (this.hasPlayIconTarget) {
        this.playIconTarget.className = "fa-solid fa-play"
      }
    }
  }

  async submitRecording() {
    if (this.reviewAudio) {
      this.reviewAudio.pause()
      if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play"
    }
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
      btn.innerHTML = '<i class="fa fa-download"></i> Download report'
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
  // PROCESSING MESSAGES
  // ────────────────────────────────────────

  _startProcessingMessages() {
    this._stopProcessingMessages()
    const messages = [
      "Listening to your delivery\u2026",
      "Running speech recognition\u2026",
      "Analyzing your speaking patterns\u2026",
      "Measuring pacing, tone, and clarity\u2026",
      "Writing your personalized report\u2026",
    ]
    let i = 0
    const update = () => {
      if (this.hasProcessingMessageTarget) {
        this.processingMessageTarget.textContent = messages[i % messages.length]
      }
      i++
    }
    update()
    this._processingMsgInterval = setInterval(update, 5000)
  }

  _stopProcessingMessages() {
    if (this._processingMsgInterval) {
      clearInterval(this._processingMsgInterval)
      this._processingMsgInterval = null
    }
  }

  // ────────────────────────────────────────
  // REPORT EXPAND / BREAKDOWN
  // ────────────────────────────────────────

  expandReport() {
    if (this.hasCardTarget) this.cardTarget.classList.add("expanded")
    if (this.hasReportSecondaryTarget) this.reportSecondaryTarget.hidden = false
    if (this.hasReportFadeOverlayTarget) this.reportFadeOverlayTarget.hidden = true
  }

  toggleFocusBreakdown() {
    if (!this.hasReportFocusAllTarget) return
    const el = this.reportFocusAllTarget
    el.hidden = !el.hidden
    if (this.hasFocusChevronTarget) {
      this.focusChevronTarget.classList.toggle("report-chevron--open", !el.hidden)
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
    scoreEl.className = "report-overall-score flex-shrink-0"
    const overallColor = this._scoreColor(report.overall_score, 100)
    scoreEl.style.borderColor = overallColor
    scoreNum.style.color = overallColor

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
          ${focusScore != null ? `<span class="score-badge" style="background-color:${this._scoreColor(focusScore)}">${focusScore} / 10</span>` : ""}
        </div>
        ${focusWhy ? `<p class="text-caption mb-0">${focusWhy}</p>` : ""}
      </div>
    `

    // Metrics
    if (report.metrics) {
      const dur = report.metrics.duration_seconds
      const durLabel = `${String(Math.floor(dur / 60)).padStart(2, "0")}:${String(dur % 60).padStart(2, "0")}`
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

    // Focus breakdown bars (all focus areas)
    if (this.hasReportFocusAllTarget && report.focus_feedbacks) {
      const recommended = report.recommended_focus || ""
      this.reportFocusAllTarget.innerHTML = Object.entries(report.focus_feedbacks).map(([key, data]) => {
        const score    = data.score ?? 0
        const pct      = Math.round((score / 10) * 100)
        const isRec    = key === recommended
        const barColor = this._scoreColor(score)
        return `
          <div class="focus-bar-item${isRec ? " focus-bar-item--recommended" : ""}">
            <div class="focus-bar-header">
              <span class="focus-bar-label">${this._formatLabel(key)}${isRec ? ' <span class="focus-bar-rec-tag">Recommended focus</span>' : ""}</span>
              <span class="score-badge" style="background-color:${barColor}">${score}<span style="font-size:10px;opacity:0.7">/10</span></span>
            </div>
            <div class="focus-bar-track">
              <div class="focus-bar-fill" style="width:${pct}%; background-color:${barColor};"></div>
            </div>
            ${data.summary ? `<p class="focus-bar-summary">${data.summary}</p>` : ""}
          </div>
        `
      }).join("")
    }
  }

  // Interpolates between orange (#E8750A) at 1 and teal (#0D7377) at max
  _scoreColor(score, max = 10) {
    const t = Math.max(0, Math.min((score - 1) / (max - 1), 1))
    const r = Math.round(232 + (13  - 232) * t)
    const g = Math.round(117 + (115 - 117) * t)
    const b = Math.round(10  + (119 - 10)  * t)
    return `rgb(${r},${g},${b})`
  }

  _formatLabel(key) {
    const s = key.replace(/_/g, " ").toLowerCase()
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  // ────────────────────────────────────────
  // REVIEW WAVEFORM
  // ────────────────────────────────────────

  async _setupReviewWaveform() {
    if (!this.audioBlob) return
    try {
      const arrayBuffer = await this.audioBlob.arrayBuffer()
      const tmpCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)()
      const audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer)
      tmpCtx.close()

      this._waveformData     = audioBuffer.getChannelData(0)
      this._waveformDuration = audioBuffer.duration
      this._drawStaticWaveform(0)

      const url = URL.createObjectURL(this.audioBlob)
      if (this.reviewAudio) this.reviewAudio.pause()
      this.reviewAudio = new Audio(url)
      this.reviewAudio.addEventListener("timeupdate", () => {
        this._drawStaticWaveform(this.reviewAudio.currentTime)
      })
      this.reviewAudio.addEventListener("ended", () => {
        this._drawStaticWaveform(0)
        if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play"
      })
    } catch (err) {
      console.warn("Could not set up review waveform:", err)
    }
  }

  _drawStaticWaveform(playheadTime = 0) {
    const canvas = this.waveformCanvasTarget
    const ctx    = canvas.getContext("2d")
    const width  = canvas.width
    const height = canvas.height

    ctx.fillStyle = "#F7F5F0"
    ctx.fillRect(0, 0, width, height)
    if (!this._waveformData || !this._waveformDuration) return

    const barCount      = 80
    const samplesPerBar = Math.floor(this._waveformData.length / barCount)
    const barWidth      = (width / barCount) * 0.65
    const barGap        = (width / barCount) * 0.35
    const playheadRatio = playheadTime / this._waveformDuration

    for (let i = 0; i < barCount; i++) {
      let sumSq = 0
      const start = i * samplesPerBar
      for (let j = start; j < start + samplesPerBar; j++) {
        sumSq += this._waveformData[j] * this._waveformData[j]
      }
      const rms       = Math.sqrt(sumSq / samplesPerBar)
      const barHeight = Math.max(rms * height * 4, 2)
      const x         = i * (barWidth + barGap)
      const y         = (height - barHeight) / 2

      const ratio = i / barCount
      const r = Math.round(13  + ratio * (232 - 13))
      const g = Math.round(115 + ratio * (145 - 115))
      const b = Math.round(119 + ratio * (58  - 119))

      ctx.globalAlpha = (i / barCount) > playheadRatio ? 0.3 : 1.0
      ctx.fillStyle   = `rgb(${r},${g},${b})`
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1

    // Playhead line
    const px = playheadRatio * width
    ctx.fillStyle = "#0D7377"
    ctx.fillRect(px - 1, 0, 3, height)

    // Time label bubble above playhead
    if (playheadTime > 0 && this._waveformDuration) {
      const mins = Math.floor(playheadTime / 60).toString()
      const secs = Math.floor(playheadTime % 60).toString().padStart(2, "0")
      const label = `${mins}:${secs}`
      ctx.font = "bold 11px Inter, sans-serif"
      const textW = ctx.measureText(label).width
      const bubbleW = textW + 10
      const bubbleH = 18
      const bubbleX = Math.min(Math.max(px - bubbleW / 2, 2), width - bubbleW - 2)
      const bubbleY = 4

      ctx.fillStyle = "#0D7377"
      ctx.beginPath()
      ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4)
      ctx.fill()

      ctx.fillStyle = "#fff"
      ctx.fillText(label, bubbleX + 5, bubbleY + 13)
    }
  }

  seekWaveform(event) {
    if (this.currentState !== "review") return
    if (!this._waveformData || !this._waveformDuration) return

    const canvas    = this.waveformCanvasTarget
    const rect      = canvas.getBoundingClientRect()
    const ratio     = Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1))
    const seekTime  = ratio * this._waveformDuration

    if (this.reviewAudio) this.reviewAudio.currentTime = seekTime
    this._drawStaticWaveform(seekTime)
  }

  // ────────────────────────────────────────
  // TIMESTAMP LOCALIZATION
  // ────────────────────────────────────────

  _localizeTimestamps() {
    this.element.querySelectorAll("time[data-localize]").forEach(el => {
      const dt = new Date(el.getAttribute("datetime"))
      if (isNaN(dt.getTime())) return
      const opts = { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }
      el.textContent = dt.toLocaleString(undefined, opts)
    })
  }

}

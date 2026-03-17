import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="recorder"
// State machine: ready → countdown → recording → review → processing → completed
export default class extends Controller {
  static targets = [
    "stateLabel",
    "timerDisplay", "timer",
    "countdownArea", "countdown",
    "waveformWrapper", "waveformCanvas",
    "recordButtonArea", "recordButton", "recordIcon", "buttonLabel",
    "micBar", "micSelect",
    "micGrantArea",
    "uploadArea", "fileInput",
    "reviewControls",
    "processingIndicator",
    "stateCompleted",
    "overallScore", "reportSummary", "reportScores", "reportMetrics",
    "titleDisplay"
  ]

  static values = {
    sessionId:     Number,
    initialStatus: { type: String, default: "" },
    initialReport: { type: Object, default: {} },
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
    if (this.countdownInterval) clearInterval(this.countdownInterval)
    if (this.stream) this.stream.getTracks().forEach(t => t.stop())
    if (this.audioContext) this.audioContext.close()
  }

  // ────────────────────────────────────────
  // INIT FROM SERVER STATE
  // ────────────────────────────────────────

  _initFromStatus() {
    const status = this.initialStatusValue
    const report = this.initialReportValue

    if (status === "processing") {
      this._transitionTo("processing")
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

      const data = await response.json()
      this.reportData = data.report

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
  // REPORT RENDERING
  // ────────────────────────────────────────

  _renderReport(report) {
    if (!report) return

    // Overall score
    const scoreEl  = this.overallScoreTarget
    const scoreNum = scoreEl.querySelector(".score-number")
    scoreNum.textContent = report.overall_score
    scoreEl.className    = `report-overall-score ${this._scoreClass(report.overall_score)}`

    // Summary
    this.reportSummaryTarget.innerHTML = `
      <h4 class="mb-2">Summary</h4>
      <p>${report.summary}</p>
    `

    // Focus feedbacks
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

}

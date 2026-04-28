import { Controller } from "@hotwired/stimulus";
import { MicMixin } from "controllers/recorder_mic_mixin";
import { WaveformMixin } from "controllers/recorder_waveform_mixin";
import { ReportMixin } from "controllers/recorder_report_mixin";

// Connects to data-controller="recorder"
// State machine: ready → countdown → recording → review → processing → completed
class RecorderController extends Controller {
  static targets = [
    "stateReady",
    "stateRecording",
    "stateProcessing",
    "stateCompleted",
    "waveformCanvas",
    "timer",
    "micSelect",
    "pauseButton",
    "resumeButton",
    "restartButton",
    "uploadInput",
    "titleDisplay",
    "titleEdit",
    "titleInput",
    "overallScore",
    "reportSummary",
    "reportStrengths",
    "reportImprovements",
    "reportFocus",
    "reportMetrics",
    "startOverButton",
    "tryAgainButton",
    "downloadButton",
    "stateLabel",
    "timerDisplay",
    "countdownArea",
    "countdown",
    "waveformWrapper",
    "recordButtonArea",
    "recordButton",
    "recordIcon",
    "buttonLabel",
    "micBar",
    "micGrantArea",
    "uploadArea",
    "fileInput",
    "reviewControls",
    "processingIndicator",
    "playIcon",
    "processingMessage",
    "cardBody",
    "card",
    "reportSecondary",
    "reportFadeOverlay",
    "reportFocusAll",
    "focusChevron",
  ];

  static values = {
    sessionId: Number,
    initialStatus: { type: String, default: "" },
    initialReport: { type: Object, default: {} },
    pdfStatusUrl: { type: String, default: "" },
    reportStatusUrl: { type: String, default: "" },
  };

  // ────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────

  connect() {
    this.currentState = "ready";
    this.chunks = [];
    this.elapsed = 0;
    this.stream = null;
    this.audioBlob = null;
    this.reportData = null;
    this.selectedDeviceId = null;
    this._initFromStatus();
    this._initMic();
    this._localizeTimestamps();
  }

  disconnect() {
    this._stopWaveformLoop();
    this._stopTimer();
    this._stopReportPolling();
    this._stopPdfPolling();
    this._stopProcessingMessages();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.audioContext) this.audioContext.close();
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  // ────────────────────────────────────────
  // INIT FROM SERVER STATE
  // ────────────────────────────────────────

  _initFromStatus() {
    const status = this.initialStatusValue;
    const report = this.initialReportValue;

    if (status === "processing") {
      this._transitionTo("processing");
      this._startReportPolling();
    } else if (status === "completed") {
      if (report && Object.keys(report).length > 0) {
        this.reportData = report;
        this._renderReport(report);
      }
      this._transitionTo("completed");
    }
    // "recording", "failed" → stay in "ready"
  }

  // ────────────────────────────────────────
  // STATE MANAGEMENT
  // ────────────────────────────────────────

  _transitionTo(state) {
    this.currentState = state;

    const labels = {
      ready: "Ready to record",
      countdown: "Get ready\u2026",
      recording: "Recording",
      review: "Review recording",
      processing: "Processing",
      completed: "Complete",
    };
    this.stateLabelTarget.textContent = labels[state] || state;

    this._applyCardState(state);
    this._applyWaveformState(state);
    this._applyControlsState(state);
    this._applyRecordButtonState(state);
    this._updateSidebarDot(state);

    if (state === "processing") {
      this._startProcessingMessages();
    } else {
      this._stopProcessingMessages();
    }
  }

  // Card visibility and flex alignment
  _applyCardState(state) {
    if (this.hasCardTarget) {
      if (state === "completed") {
        this.cardTarget.classList.add("session-card--completed");
      } else {
        this.cardTarget.classList.remove("session-card--completed", "expanded");
      }
    }

    if (this.hasCardBodyTarget) {
      // Hidden in completed so the report section fills the space
      this.cardBodyTarget.style.display = state === "completed" ? "none" : "";
      // Top-align during waveform states so the waveform stays at the same Y position
      const topAlignStates = ["recording", "review", "processing"];
      this.cardBodyTarget.style.justifyContent = topAlignStates.includes(state) ? "flex-start" : "";
    }
  }

  // Waveform wrapper opacity/visibility and timer/countdown visibility
  _applyWaveformState(state) {
    const opacities = { countdown: 0.1, recording: 1, review: 1, processing: 0.1 };
    this.waveformWrapperTarget.style.opacity = opacities[state] ?? 0.2;
    this.waveformWrapperTarget.style.display =
      state === "completed" || state === "ready" ? "none" : "";
    this.waveformWrapperTarget.style.cursor = state === "review" ? "pointer" : "";

    this.timerDisplayTarget.hidden = !["recording", "review"].includes(state);
    this.countdownAreaTarget.hidden = state !== "countdown";
  }

  // Mic bar, upload area, review/processing/completed panels
  _applyControlsState(state) {
    this.micBarTarget.hidden = state !== "ready";
    this.uploadAreaTarget.hidden = state !== "ready";
    this.reviewControlsTarget.hidden = state !== "review";
    this.processingIndicatorTarget.hidden = state !== "processing";
    this.stateCompletedTarget.hidden = state !== "completed";

    // Grant prompt stays hidden once we've left ready (or if permission was already held)
    if (state !== "ready") this.micGrantAreaTarget.hidden = true;

    if (this.hasProcessingMessageTarget) {
      this.processingMessageTarget.hidden = state !== "processing";
    }
  }

  // Record button shape and label morph (circle → rounded square)
  _applyRecordButtonState(state) {
    this.recordButtonAreaTarget.hidden = !["ready", "recording"].includes(state);

    if (state === "recording") {
      this.recordIconTarget.style.borderRadius = "4px";
      this.recordButtonTarget.classList.add("record-btn--active");
      this.buttonLabelTarget.textContent = "Tap to stop";
    } else {
      this.recordIconTarget.style.borderRadius = "50%";
      this.recordButtonTarget.classList.remove("record-btn--active");
      this.buttonLabelTarget.textContent = "Tap to record";
    }
  }

  // Keep sidebar status dot in sync without a page refresh
  _updateSidebarDot(state) {
    const statusMap = {
      ready: "pending",
      countdown: "pending",
      recording: "recording",
      review: "pending",
      processing: "processing",
      completed: "completed",
    };
    const frame = document.getElementById(`sidebar_title_recording_session_${this.sessionIdValue}`);
    const dot = frame?.querySelector(".status-dot");
    if (dot) dot.className = `status-dot status-dot--${statusMap[state] ?? "pending"}`;
  }

  // ────────────────────────────────────────
  // RECORD BUTTON (dispatches based on state)
  // ────────────────────────────────────────

  handleRecordButton() {
    if (this.currentState === "ready") this.startCountdown();
    if (this.currentState === "recording") this.stopRecording();
  }

  // ────────────────────────────────────────
  // COUNTDOWN
  // ────────────────────────────────────────

  startCountdown() {
    if (this.currentState !== "ready") return;
    this._transitionTo("countdown");

    let count = 3;
    this.countdownTarget.textContent = count;
    this._animateCountdown();

    this.countdownInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(this.countdownInterval);
        this.startRecording();
      } else {
        this.countdownTarget.textContent = count;
        this._animateCountdown();
      }
    }, 1000);
  }

  skipCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.startRecording();
  }

  _animateCountdown() {
    const el = this.countdownTarget;
    el.style.animation = "none";
    el.offsetHeight; // force reflow
    el.style.animation = "countdown-pop 0.4s ease-out forwards";
  }

  // ────────────────────────────────────────
  // RECORDING
  // ────────────────────────────────────────

  async startRecording() {
    this.chunks = [];
    this.elapsed = 0;

    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    this.mediaRecorder.onstop = () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/webm" });
      this.durationSeconds = Math.round(this.elapsed);
      this._setupReviewWaveform();
    };

    this.mediaRecorder.start(250);

    this._setupAudioContext();
    this._connectAudioAnalyser();
    this._startWaveformLoop();
    this._startTimer();

    this._transitionTo("recording");
  }

  stopRecording() {
    this._stopTimer();
    this._stopWaveformLoop();

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    this._transitionTo("review");
  }

  // ────────────────────────────────────────
  // REVIEW
  // ────────────────────────────────────────

  reRecord() {
    this.chunks = [];
    this.audioBlob = null;
    this.elapsed = 0;
    this._updateTimerDisplay();
    if (this.reviewAudio) {
      this.reviewAudio.pause();
      this.reviewAudio = null;
    }
    this._waveformData = null;
    this._waveformDuration = null;
    if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play";
    const canvas = this.waveformCanvasTarget;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    // Keep stream alive — stopping it would re-trigger the permission dialog next time
    this._transitionTo("ready");
  }

  triggerFileUpload() {
    this.fileInputTarget.click();
  }

  handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.audioBlob = file;
    this.durationSeconds = null;
    // Reset so the same file can be re-selected if needed
    event.target.value = "";
    this._transitionTo("review");
    this._setupReviewWaveform();
  }

  playRecording() {
    if (!this.reviewAudio) return;
    if (this.reviewAudio.paused) {
      this.reviewAudio.play();
      if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-pause";
    } else {
      this.reviewAudio.pause();
      if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play";
    }
  }

  async submitRecording() {
    if (this.reviewAudio) {
      this.reviewAudio.pause();
      if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play";
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this._transitionTo("processing");
    await this._upload();
  }

  // ────────────────────────────────────────
  // UPLOAD
  // ────────────────────────────────────────

  async _upload() {
    const formData = new FormData();
    formData.append("audio", this.audioBlob, "recording.webm");
    if (this.durationSeconds) formData.append("duration_seconds", this.durationSeconds);

    try {
      const response = await fetch(`/sessions/${this.sessionIdValue}/recordings`, {
        method: "POST",
        body: formData,
        headers: { "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content },
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      this._startReportPolling();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Something went wrong processing your recording. Please try again.");
      this._transitionTo("ready");
    }
  }

  // ────────────────────────────────────────
  // TIMER
  // ────────────────────────────────────────

  _startTimer() {
    this.timerStart = Date.now() - this.elapsed * 1000;
    this.timerInterval = setInterval(() => {
      this.elapsed = (Date.now() - this.timerStart) / 1000;
      this._updateTimerDisplay();
    }, 100);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  _updateTimerDisplay() {
    const mins = Math.floor(this.elapsed / 60).toString();
    const secs = Math.floor(this.elapsed % 60)
      .toString()
      .padStart(2, "0");
    this.timerTarget.textContent = `${mins}:${secs}`;
  }

  // ────────────────────────────────────────
  // TITLE EDITING
  // ────────────────────────────────────────

  editTitle() {
    const el = this.titleDisplayTarget;
    this._titleOriginal = el.textContent;
    el.contentEditable = "true";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  titleKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.titleDisplayTarget.blur();
    } else if (event.key === "Escape") {
      this.titleDisplayTarget.textContent = this._titleOriginal;
      this.titleDisplayTarget.contentEditable = "false";
    }
  }

  async saveTitle() {
    const el = this.titleDisplayTarget;
    if (el.contentEditable !== "true") return;
    el.contentEditable = "false";

    const newTitle = el.textContent.trim();
    if (!newTitle || newTitle === this._titleOriginal) return;

    try {
      const response = await fetch(`/sessions/${this.sessionIdValue}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content,
          Accept: "application/json",
        },
        body: JSON.stringify({ recording_session: { title: newTitle } }),
      });

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);

      // Update sidebar label instantly without a page refresh
      const frame = document.getElementById(
        `sidebar_title_recording_session_${this.sessionIdValue}`
      );
      const label = frame?.querySelector(".recent-label");
      if (label) label.textContent = newTitle;
    } catch (err) {
      console.error("Title save error:", err);
      el.textContent = this._titleOriginal;
      alert("Could not save title. Please try again.");
    }
  }

  _updateTitleDisplay(title) {
    this.titleDisplayTarget.textContent = title.split(" - ")[0];
  }

  // ────────────────────────────────────────
  // START OVER / TRY AGAIN
  // ────────────────────────────────────────

  startOver() {
    this._transitionTo("ready");
  }
  tryAgain() {
    this._transitionTo("ready");
  }

  // ────────────────────────────────────────
  // TIMESTAMP LOCALIZATION
  // ────────────────────────────────────────

  _localizeTimestamps() {
    this.element.querySelectorAll("time[data-localize]").forEach((el) => {
      const dt = new Date(el.getAttribute("datetime"));
      if (isNaN(dt.getTime())) return;
      const opts = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      };
      el.textContent = dt.toLocaleString(undefined, opts);
    });
  }
}

Object.assign(RecorderController.prototype, MicMixin, WaveformMixin, ReportMixin);

export default RecorderController;

// Report and PDF status polling, cycling processing messages, expand/breakdown UI, and report rendering.
export const ReportMixin = {
  // ── Report status polling ─────────────────────────────────────────────────

  _startReportPolling() {
    this._stopReportPolling();
    this.reportPollInterval = setInterval(async () => {
      try {
        const response = await fetch(this.reportStatusUrlValue, {
          headers: { "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content },
        });
        const data = await response.json();

        if (data.status === "completed") {
          this._stopReportPolling();
          this.reportData = data.report;
          this._renderReport(data.report);
          this._transitionTo("completed");
        } else if (data.status === "failed") {
          this._stopReportPolling();
          alert("Something went wrong processing your recording. Please try again.");
          this._transitionTo("ready");
        }
      } catch (err) {
        console.error("Report status check failed:", err);
      }
    }, 3000);
  },

  _stopReportPolling() {
    if (this.reportPollInterval) {
      clearInterval(this.reportPollInterval);
      this.reportPollInterval = null;
    }
  },

  // ── PDF status polling ────────────────────────────────────────────────────

  _setPdfButtonState(ready) {
    if (!this.hasDownloadButtonTarget) return;
    const btn = this.downloadButtonTarget;
    if (ready) {
      btn.removeAttribute("disabled");
      btn.style.pointerEvents = "";
      btn.style.opacity = "";
      btn.innerHTML = '<i class="fa fa-download"></i> Download report';
    } else {
      btn.setAttribute("disabled", "disabled");
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.6";
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating PDF...';
    }
  },

  _startPdfPolling() {
    this._stopPdfPolling();
    this.pdfPollInterval = setInterval(async () => {
      try {
        const response = await fetch(this.pdfStatusUrlValue, {
          headers: { "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content },
        });
        const data = await response.json();
        if (data.ready) {
          this._stopPdfPolling();
          this._setPdfButtonState(true);
        }
      } catch (err) {
        console.error("PDF status check failed:", err);
      }
    }, 3000);
  },

  _stopPdfPolling() {
    if (this.pdfPollInterval) {
      clearInterval(this.pdfPollInterval);
      this.pdfPollInterval = null;
    }
  },

  // ── Processing messages ───────────────────────────────────────────────────

  _startProcessingMessages() {
    this._stopProcessingMessages();
    const messages = [
      "Listening to your delivery\u2026",
      "Running speech recognition\u2026",
      "Analyzing your speaking patterns\u2026",
      "Measuring pacing, tone, and clarity\u2026",
      "Writing your personalized report\u2026",
    ];
    let i = 0;
    const update = () => {
      if (this.hasProcessingMessageTarget) {
        this.processingMessageTarget.textContent = messages[i % messages.length];
      }
      i++;
    };
    update();
    this._processingMsgInterval = setInterval(update, 5000);
  },

  _stopProcessingMessages() {
    if (this._processingMsgInterval) {
      clearInterval(this._processingMsgInterval);
      this._processingMsgInterval = null;
    }
  },

  // ── Report expand / focus breakdown ──────────────────────────────────────

  expandReport() {
    if (this.hasCardTarget) this.cardTarget.classList.add("expanded");
    if (this.hasReportSecondaryTarget) this.reportSecondaryTarget.hidden = false;
    if (this.hasReportFadeOverlayTarget) this.reportFadeOverlayTarget.hidden = true;
  },

  toggleFocusBreakdown() {
    if (!this.hasReportFocusAllTarget) return;
    const el = this.reportFocusAllTarget;
    el.hidden = !el.hidden;
    if (this.hasFocusChevronTarget) {
      this.focusChevronTarget.classList.toggle("report-chevron--open", !el.hidden);
    }
  },

  // ── Report rendering ──────────────────────────────────────────────────────

  _renderReport(report) {
    if (!report) return;

    this._setPdfButtonState(report.pdf_ready || false);
    if (!report.pdf_ready) this._startPdfPolling();

    this._renderScore(report);
    this._renderSummary(report);
    this._renderStrengths(report);
    this._renderImprovements(report);
    this._renderRecommendedFocus(report);
    this._renderMetrics(report);
    this._renderFocusBreakdown(report);
  },

  _renderScore(report) {
    const scoreEl = this.overallScoreTarget;
    const scoreNum = scoreEl.querySelector(".score-number");
    const color = this._scoreColor(report.overall_score, 100);
    scoreNum.textContent = report.overall_score;
    scoreEl.className = "report-overall-score flex-shrink-0";
    scoreEl.style.borderColor = color;
    scoreNum.style.color = color;
  },

  _renderSummary(report) {
    this.reportSummaryTarget.innerHTML = `<p class="mb-0">${report.summary || ""}</p>`;
  },

  _renderStrengths(report) {
    const items = (report.top_strengths || []).map((s) => `<li>${s}</li>`).join("");
    this.reportStrengthsTarget.innerHTML = `
      <div class="insight-header mb-3">
        <span class="insight-icon insight-icon--success"><i class="fa fa-star"></i></span>
        <h5 class="mb-0">Strengths</h5>
      </div>
      <ul class="report-insight-list">${items}</ul>
    `;
  },

  _renderImprovements(report) {
    const items = (report.top_improvements || []).map((i) => `<li>${i}</li>`).join("");
    this.reportImprovementsTarget.innerHTML = `
      <div class="insight-header mb-3">
        <span class="insight-icon insight-icon--accent"><i class="fa fa-arrow-up"></i></span>
        <h5 class="mb-0">To improve</h5>
      </div>
      <ul class="report-insight-list">${items}</ul>
    `;
  },

  _renderRecommendedFocus(report) {
    const focus = report.recommended_focus || "";
    const focusData = (report.focus_feedbacks || {})[focus];
    const focusScore = focusData?.score;
    const focusWhy = focusData?.summary || "";
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
    `;
  },

  _renderMetrics(report) {
    if (!report.metrics) return;
    const dur = report.metrics.duration_seconds;
    const durLabel = `${String(Math.floor(dur / 60)).padStart(2, "0")}:${String(dur % 60).padStart(2, "0")}`;
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
    `;
  },

  _renderFocusBreakdown(report) {
    if (!this.hasReportFocusAllTarget || !report.focus_feedbacks) return;
    const recommended = report.recommended_focus || "";
    this.reportFocusAllTarget.innerHTML = Object.entries(report.focus_feedbacks)
      .map(([key, data]) => {
        const score = data.score ?? 0;
        const pct = Math.round((score / 10) * 100);
        const isRec = key === recommended;
        const barColor = this._scoreColor(score);
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
      `;
      })
      .join("");
  },

  // Interpolates between orange (#E8750A) at 1 and teal (#0D7377) at max
  _scoreColor(score, max = 10) {
    const t = Math.max(0, Math.min((score - 1) / (max - 1), 1));
    const r = Math.round(232 + (13 - 232) * t);
    const g = Math.round(117 + (115 - 117) * t);
    const b = Math.round(10 + (119 - 10) * t);
    return `rgb(${r},${g},${b})`;
  },

  _formatLabel(key) {
    const s = key.replace(/_/g, " ").toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
};

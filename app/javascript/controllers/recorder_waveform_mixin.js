// Audio context setup, live recording waveform (canvas loop), and review/static waveform with seek.
export const WaveformMixin = {
  // ── Audio context ─────────────────────────────────────────────────────────

  _setupAudioContext() {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (
        window.AudioContext || /** @type {any} */ (window).webkitAudioContext
      )();
    }
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
  },

  _connectAudioAnalyser() {
    if (this.sourceNode) this.sourceNode.disconnect();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyser);
  },

  // ── Live waveform (during recording) ─────────────────────────────────────

  _startWaveformLoop() {
    const canvas = this.waveformCanvasTarget;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      this.animationFrame = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(this.dataArray);

      ctx.fillStyle = "#F7F5F0";
      ctx.fillRect(0, 0, width, height);

      const barCount = this.bufferLength;
      const barWidth = (width / barCount) * 1.2;
      const gap = 1;

      for (let i = 0; i < barCount; i++) {
        const value = this.dataArray[i];
        const barHeight = (value / 255) * height * 0.85;
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const ratio = i / barCount;
        const r = Math.round(13 + ratio * (232 - 13));
        const g = Math.round(115 + ratio * (145 - 115));
        const b = Math.round(119 + ratio * (58 - 119));

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();
  },

  _stopWaveformLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  },

  // ── Review waveform (static, after recording) ─────────────────────────────

  async _setupReviewWaveform() {
    if (!this.audioBlob) return;
    try {
      const arrayBuffer = await this.audioBlob.arrayBuffer();
      const tmpCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
      const audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
      tmpCtx.close();

      this._waveformData = audioBuffer.getChannelData(0);
      this._waveformDuration = audioBuffer.duration;
      this._drawStaticWaveform(0);

      const url = URL.createObjectURL(this.audioBlob);
      if (this.reviewAudio) this.reviewAudio.pause();
      this.reviewAudio = new Audio(url);
      this.reviewAudio.addEventListener("timeupdate", () => {
        this._drawStaticWaveform(this.reviewAudio.currentTime);
      });
      this.reviewAudio.addEventListener("ended", () => {
        this._drawStaticWaveform(0);
        if (this.hasPlayIconTarget) this.playIconTarget.className = "fa-solid fa-play";
      });
    } catch (err) {
      console.warn("Could not set up review waveform:", err);
    }
  },

  _drawStaticWaveform(playheadTime = 0) {
    const canvas = this.waveformCanvasTarget;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#F7F5F0";
    ctx.fillRect(0, 0, width, height);
    if (!this._waveformData || !this._waveformDuration) return;

    const barCount = 80;
    const samplesPerBar = Math.floor(this._waveformData.length / barCount);
    const barWidth = (width / barCount) * 0.65;
    const barGap = (width / barCount) * 0.35;
    const playheadRatio = playheadTime / this._waveformDuration;

    for (let i = 0; i < barCount; i++) {
      let sumSq = 0;
      const start = i * samplesPerBar;
      for (let j = start; j < start + samplesPerBar; j++) {
        sumSq += this._waveformData[j] * this._waveformData[j];
      }
      const rms = Math.sqrt(sumSq / samplesPerBar);
      const barHeight = Math.max(rms * height * 4, 2);
      const x = i * (barWidth + barGap);
      const y = (height - barHeight) / 2;

      const ratio = i / barCount;
      const r = Math.round(13 + ratio * (232 - 13));
      const g = Math.round(115 + ratio * (145 - 115));
      const b = Math.round(119 + ratio * (58 - 119));

      ctx.globalAlpha = i / barCount > playheadRatio ? 0.3 : 1.0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Playhead line
    const px = playheadRatio * width;
    ctx.fillStyle = "#0D7377";
    ctx.fillRect(px - 1, 0, 3, height);

    // Time label bubble above playhead
    if (playheadTime > 0 && this._waveformDuration) {
      const mins = Math.floor(playheadTime / 60).toString();
      const secs = Math.floor(playheadTime % 60)
        .toString()
        .padStart(2, "0");
      const label = `${mins}:${secs}`;
      ctx.font = "bold 11px Inter, sans-serif";
      const textW = ctx.measureText(label).width;
      const bubbleW = textW + 10;
      const bubbleH = 18;
      const bubbleX = Math.min(Math.max(px - bubbleW / 2, 2), width - bubbleW - 2);
      const bubbleY = 4;

      ctx.fillStyle = "#0D7377";
      ctx.beginPath();
      ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(label, bubbleX + 5, bubbleY + 13);
    }
  },

  seekWaveform(event) {
    if (this.currentState !== "review") return;
    if (!this._waveformData || !this._waveformDuration) return;

    const canvas = this.waveformCanvasTarget;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1));
    const seekTime = ratio * this._waveformDuration;

    if (this.reviewAudio) this.reviewAudio.currentTime = seekTime;
    this._drawStaticWaveform(seekTime);
  },
};

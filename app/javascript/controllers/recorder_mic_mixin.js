// Microphone permission checking, stream acquisition, device enumeration, and switching.
export const MicMixin = {
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
        this.recordButtonTarget.disabled  = false
      } catch (err) {
        console.error("Mic init failed:", err)
        this._showGrantPrompt()
      }
    } else {
      this._showGrantPrompt()
    }
  },

  _showGrantPrompt() {
    this.micGrantAreaTarget.hidden    = false
    this.stateLabelTarget.textContent = "Microphone access required"
  },

  // Called by the "Grant microphone access" button — runs inside a user gesture.
  async requestMicAccess() {
    this.micGrantAreaTarget.hidden    = true
    this.stateLabelTarget.textContent = "Requesting microphone access\u2026"

    try {
      await this._acquireMic()
      await this._enumerateDevices()
      this.stateLabelTarget.textContent = "Ready to record"
      this.recordButtonTarget.disabled  = false
    } catch (err) {
      console.error("Mic access denied:", err)
      this.stateLabelTarget.textContent = "Microphone access denied \u2014 check System Preferences \u203a Privacy \u203a Microphone"
      this.micGrantAreaTarget.hidden    = false
    }
  },

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
  },

  async _acquireMic() {
    // Reuse the stream if it's still active (avoids re-triggering permission dialog)
    if (this.stream && this.stream.active) return
    this.stream       = null
    const constraints = this.selectedDeviceId
      ? { audio: { deviceId: { exact: this.selectedDeviceId } } }
      : { audio: true }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints)
  },

  async _enumerateDevices() {
    try {
      const devices     = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === "audioinput")
      if (audioInputs.length === 0) return

      const select       = this.micSelectTarget
      const currentValue = select.value
      select.innerHTML   = ""

      audioInputs.forEach((device, i) => {
        const option       = document.createElement("option")
        option.value       = device.deviceId
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
  },

  async switchMic() {
    this.selectedDeviceId = this.micSelectTarget.value
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
    try {
      await this._acquireMic()
    } catch (err) {
      console.error("Could not switch microphone:", err)
    }
  },
}

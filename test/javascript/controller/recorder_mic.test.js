import RecorderController from "controllers/recorder_controller"
import { createMockController } from "../helpers/controller_factory"

afterEach(() => {
  jest.restoreAllMocks()
})

// ── _checkMicPermission ────────────────────────────────────────────────────────

describe("_checkMicPermission", () => {
  it("returns true when the Permissions API reports 'granted'", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: jest.fn().mockResolvedValue({ state: "granted" }) },
      configurable: true,
    })
    const result = await RecorderController.prototype._checkMicPermission.call(
      createMockController()
    )
    expect(result).toBe(true)
  })

  it("returns false when the Permissions API reports 'denied'", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: jest.fn().mockResolvedValue({ state: "denied" }) },
      configurable: true,
    })
    const result = await RecorderController.prototype._checkMicPermission.call(
      createMockController()
    )
    expect(result).toBe(false)
  })

  it("falls back to enumerateDevices and returns true when a labelled audioinput exists", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        enumerateDevices: jest.fn().mockResolvedValue([
          { kind: "audioinput", label: "Built-in Microphone" },
        ]),
      },
      configurable: true,
    })
    const result = await RecorderController.prototype._checkMicPermission.call(
      createMockController()
    )
    expect(result).toBe(true)
  })

  it("falls back to enumerateDevices and returns false when no device has a label", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        enumerateDevices: jest.fn().mockResolvedValue([
          { kind: "audioinput", label: "" },
        ]),
      },
      configurable: true,
    })
    const result = await RecorderController.prototype._checkMicPermission.call(
      createMockController()
    )
    expect(result).toBe(false)
  })

  it("returns false when the Permissions API throws", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: jest.fn().mockRejectedValue(new Error("API unavailable")) },
      configurable: true,
    })
    const result = await RecorderController.prototype._checkMicPermission.call(
      createMockController()
    )
    expect(result).toBe(false)
  })
})

// ── _acquireMic ───────────────────────────────────────────────────────────────

describe("_acquireMic", () => {
  it("reuses an active stream without calling getUserMedia", async () => {
    const activeStream = { active: true }
    const getUserMedia = jest.fn()
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    })
    const ctrl = createMockController({ stream: activeStream })

    await RecorderController.prototype._acquireMic.call(ctrl)

    expect(getUserMedia).not.toHaveBeenCalled()
    expect(ctrl.stream).toBe(activeStream)
  })

  it("calls getUserMedia when the existing stream is inactive", async () => {
    const newStream = { active: true }
    const getUserMedia = jest.fn().mockResolvedValue(newStream)
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    })
    const ctrl = createMockController({ stream: { active: false } })

    await RecorderController.prototype._acquireMic.call(ctrl)

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(ctrl.stream).toBe(newStream)
  })

  it("calls getUserMedia when stream is null", async () => {
    const newStream = { active: true }
    const getUserMedia = jest.fn().mockResolvedValue(newStream)
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    })
    const ctrl = createMockController({ stream: null })

    await RecorderController.prototype._acquireMic.call(ctrl)

    expect(getUserMedia).toHaveBeenCalled()
    expect(ctrl.stream).toBe(newStream)
  })

  it("passes an exact deviceId constraint when selectedDeviceId is set", async () => {
    const getUserMedia = jest.fn().mockResolvedValue({})
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    })
    const ctrl = createMockController({ stream: null, selectedDeviceId: "device-abc" })

    await RecorderController.prototype._acquireMic.call(ctrl)

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: "device-abc" } },
    })
  })
})

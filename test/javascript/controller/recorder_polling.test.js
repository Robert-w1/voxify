import RecorderController from "controllers/recorder_controller"
import { createMockController } from "../helpers/controller_factory"

// Captures the callback passed to setInterval so tests can trigger it manually
// without relying on fake timers and async promise-flushing complexity.
function spyOnInterval() {
  let captured = null
  jest.spyOn(global, "setInterval").mockImplementation((fn) => {
    captured = fn
    return 1
  })
  jest.spyOn(global, "clearInterval").mockImplementation(() => {})
  return { trigger: () => captured() }
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="csrf-token" content="test-token">'
})

afterEach(() => {
  jest.restoreAllMocks()
  delete global.fetch
})

describe("_startReportPolling", () => {
  it("renders report and transitions to completed on 'completed' response", async () => {
    const report = { overall_score: 9, summary: "Excellent" }
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: "completed", report }),
    })
    const { trigger } = spyOnInterval()
    const ctrl = createMockController({ _transitionTo: jest.fn() })

    RecorderController.prototype._startReportPolling.call(ctrl)
    await trigger()

    expect(ctrl._renderReport).toHaveBeenCalledWith(report)
    expect(ctrl._transitionTo).toHaveBeenCalledWith("completed")
    expect(ctrl._stopReportPolling).toHaveBeenCalledTimes(2) // initial + on completion
  })

  it("alerts and resets to ready on 'failed' response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: "failed" }),
    })
    window.alert = jest.fn()
    const { trigger } = spyOnInterval()
    const ctrl = createMockController({ _transitionTo: jest.fn() })

    RecorderController.prototype._startReportPolling.call(ctrl)
    await trigger()

    expect(window.alert).toHaveBeenCalled()
    expect(ctrl._transitionTo).toHaveBeenCalledWith("ready")
    expect(ctrl._stopReportPolling).toHaveBeenCalledTimes(2)
  })

  it("does not transition on an intermediate 'processing' response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: "processing" }),
    })
    const { trigger } = spyOnInterval()
    const ctrl = createMockController({ _transitionTo: jest.fn() })

    RecorderController.prototype._startReportPolling.call(ctrl)
    await trigger()

    expect(ctrl._transitionTo).not.toHaveBeenCalled()
    // only the initial _stopReportPolling call, not a second one
    expect(ctrl._stopReportPolling).toHaveBeenCalledTimes(1)
  })

  it("sends the CSRF token in the request header", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ status: "processing" }),
    })
    const { trigger } = spyOnInterval()
    const ctrl = createMockController()

    RecorderController.prototype._startReportPolling.call(ctrl)
    await trigger()

    expect(global.fetch).toHaveBeenCalledWith(
      "/sessions/1/report_status",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "test-token" }),
      })
    )
  })

  it("does not transition when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network error"))
    jest.spyOn(console, "error").mockImplementation(() => {})
    const { trigger } = spyOnInterval()
    const ctrl = createMockController({ _transitionTo: jest.fn() })

    RecorderController.prototype._startReportPolling.call(ctrl)
    await trigger()

    expect(ctrl._transitionTo).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      "Report status check failed:",
      expect.any(Error)
    )
  })
})

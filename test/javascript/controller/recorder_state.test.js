import RecorderController from "controllers/recorder_controller"
import { createMockController } from "../helpers/controller_factory"

describe("_transitionTo", () => {
  it("updates currentState", () => {
    const ctrl = createMockController()
    RecorderController.prototype._transitionTo.call(ctrl, "recording")
    expect(ctrl.currentState).toBe("recording")
  })

  it.each([
    ["ready",      "Ready to record"],
    ["countdown",  "Get ready…"],
    ["recording",  "Recording"],
    ["review",     "Review recording"],
    ["processing", "Processing"],
    ["completed",  "Complete"],
  ])("sets label to '%s' for state '%s'", (state, label) => {
    const ctrl = createMockController()
    RecorderController.prototype._transitionTo.call(ctrl, state)
    expect(ctrl.stateLabelTarget.textContent).toBe(label)
  })

  it("starts processing messages when entering processing", () => {
    const ctrl = createMockController()
    RecorderController.prototype._transitionTo.call(ctrl, "processing")
    expect(ctrl._startProcessingMessages).toHaveBeenCalled()
    expect(ctrl._stopProcessingMessages).not.toHaveBeenCalled()
  })

  it("stops processing messages when leaving any other state", () => {
    const ctrl = createMockController()
    RecorderController.prototype._transitionTo.call(ctrl, "review")
    expect(ctrl._stopProcessingMessages).toHaveBeenCalled()
    expect(ctrl._startProcessingMessages).not.toHaveBeenCalled()
  })

  it("hides the record button area for states other than ready and recording", () => {
    const ctrl = createMockController()
    RecorderController.prototype._transitionTo.call(ctrl, "review")
    expect(ctrl.recordButtonAreaTarget.hidden).toBe(true)
  })

  it("shows the record button area for ready state", () => {
    const ctrl = createMockController()
    RecorderController.prototype._transitionTo.call(ctrl, "ready")
    expect(ctrl.recordButtonAreaTarget.hidden).toBe(false)
  })
})

describe("_initFromStatus", () => {
  it("transitions to processing and starts polling when status is 'processing'", () => {
    const ctrl = createMockController({
      initialStatusValue: "processing",
      _transitionTo: jest.fn(),
    })
    RecorderController.prototype._initFromStatus.call(ctrl)
    expect(ctrl._transitionTo).toHaveBeenCalledWith("processing")
    expect(ctrl._startReportPolling).toHaveBeenCalled()
  })

  it("renders report and transitions to completed when status is 'completed' with data", () => {
    const report = { overall_score: 8, summary: "Good job" }
    const ctrl = createMockController({
      initialStatusValue:  "completed",
      initialReportValue:  report,
      _transitionTo: jest.fn(),
    })
    RecorderController.prototype._initFromStatus.call(ctrl)
    expect(ctrl._renderReport).toHaveBeenCalledWith(report)
    expect(ctrl._transitionTo).toHaveBeenCalledWith("completed")
  })

  it("transitions to completed without rendering when report is empty", () => {
    const ctrl = createMockController({
      initialStatusValue: "completed",
      initialReportValue: {},
      _transitionTo: jest.fn(),
    })
    RecorderController.prototype._initFromStatus.call(ctrl)
    expect(ctrl._renderReport).not.toHaveBeenCalled()
    expect(ctrl._transitionTo).toHaveBeenCalledWith("completed")
  })

  it("does nothing for statuses that fall back to ready (e.g. 'recording')", () => {
    const ctrl = createMockController({
      initialStatusValue: "recording",
      _transitionTo: jest.fn(),
    })
    RecorderController.prototype._initFromStatus.call(ctrl)
    expect(ctrl._transitionTo).not.toHaveBeenCalled()
    expect(ctrl._startReportPolling).not.toHaveBeenCalled()
  })
})

describe("handleRecordButton", () => {
  it("calls startCountdown when in ready state", () => {
    const ctrl = createMockController({
      currentState:   "ready",
      startCountdown: jest.fn(),
      stopRecording:  jest.fn(),
    })
    RecorderController.prototype.handleRecordButton.call(ctrl)
    expect(ctrl.startCountdown).toHaveBeenCalled()
    expect(ctrl.stopRecording).not.toHaveBeenCalled()
  })

  it("calls stopRecording when in recording state", () => {
    const ctrl = createMockController({
      currentState:   "recording",
      startCountdown: jest.fn(),
      stopRecording:  jest.fn(),
    })
    RecorderController.prototype.handleRecordButton.call(ctrl)
    expect(ctrl.stopRecording).toHaveBeenCalled()
    expect(ctrl.startCountdown).not.toHaveBeenCalled()
  })

  it("does nothing in other states", () => {
    const ctrl = createMockController({
      currentState:   "review",
      startCountdown: jest.fn(),
      stopRecording:  jest.fn(),
    })
    RecorderController.prototype.handleRecordButton.call(ctrl)
    expect(ctrl.startCountdown).not.toHaveBeenCalled()
    expect(ctrl.stopRecording).not.toHaveBeenCalled()
  })
})

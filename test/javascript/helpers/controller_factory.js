import RecorderController from "controllers/recorder_controller"

const makeEl = (extra = {}) => ({
  style: {},
  hidden: false,
  textContent: "",
  innerHTML: "",
  disabled: false,
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn(),
    contains: jest.fn(() => false),
  },
  querySelector: jest.fn(() => null),
  ...extra,
})

// Returns an object whose prototype is RecorderController.prototype so every
// real method resolves naturally. Own properties (mocks) shadow prototype
// methods that are dependencies of whatever method is under test.
export function createMockController(overrides = {}) {
  const ctrl = Object.create(RecorderController.prototype)

  Object.assign(ctrl, {
    // state
    currentState:         "ready",
    sessionIdValue:       1,
    reportStatusUrlValue: "/sessions/1/report_status",
    pdfStatusUrlValue:    "/sessions/1/pdf_status",
    initialStatusValue:   "",
    initialReportValue:   {},
    reportData:           null,
    stream:               null,
    selectedDeviceId:     null,

    // targets
    stateLabelTarget:          makeEl(),
    recordButtonTarget:        makeEl(),
    micGrantAreaTarget:        makeEl(),
    waveformWrapperTarget:     makeEl(),
    timerDisplayTarget:        makeEl(),
    countdownAreaTarget:       makeEl(),
    micBarTarget:              makeEl(),
    uploadAreaTarget:          makeEl(),
    reviewControlsTarget:      makeEl(),
    processingIndicatorTarget: makeEl(),
    stateCompletedTarget:      makeEl(),
    recordButtonAreaTarget:    makeEl(),
    recordIconTarget:          { style: {} },
    buttonLabelTarget:         makeEl(),
    cardTarget:                makeEl(),
    cardBodyTarget:            { style: {} },

    // has* guards
    hasCardTarget:              true,
    hasCardBodyTarget:          true,
    hasProcessingMessageTarget: false,
    hasDownloadButtonTarget:    false,
    hasPlayIconTarget:          false,
    hasReportSecondaryTarget:   false,
    hasReportFadeOverlayTarget: false,
    hasReportFocusAllTarget:    false,
    hasFocusChevronTarget:      false,

    // mocked cross-method dependencies
    _startReportPolling:      jest.fn(),
    _stopReportPolling:       jest.fn(),
    _renderReport:            jest.fn(),
    _startProcessingMessages: jest.fn(),
    _stopProcessingMessages:  jest.fn(),

    ...overrides,
  })

  return ctrl
}

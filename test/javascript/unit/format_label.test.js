import { ReportMixin } from "controllers/recorder_report_mixin"

const formatLabel = ReportMixin._formatLabel

describe("_formatLabel", () => {
  it("replaces underscores with spaces and capitalizes the first letter", () => {
    expect(formatLabel("speaking_pace")).toBe("Speaking pace")
  })

  it("handles a single word with no underscores", () => {
    expect(formatLabel("clarity")).toBe("Clarity")
  })

  it("lowercases everything except the first letter", () => {
    expect(formatLabel("EYE_CONTACT")).toBe("Eye contact")
  })

  it("handles multiple consecutive underscores", () => {
    expect(formatLabel("body__language")).toBe("Body  language")
  })

  it("returns an empty string unchanged", () => {
    expect(formatLabel("")).toBe("")
  })
})

import { ReportMixin } from "controllers/recorder_report_mixin"

const scoreColor = ReportMixin._scoreColor

describe("_scoreColor", () => {
  it("returns orange at minimum score (1)", () => {
    expect(scoreColor(1)).toBe("rgb(232,117,10)")
  })

  it("returns teal at maximum score (10)", () => {
    expect(scoreColor(10)).toBe("rgb(13,115,119)")
  })

  it("clamps scores below 1 to the orange end", () => {
    expect(scoreColor(0)).toBe(scoreColor(1))
    expect(scoreColor(-5)).toBe(scoreColor(1))
  })

  it("clamps scores above max to the teal end", () => {
    expect(scoreColor(11)).toBe(scoreColor(10))
  })

  it("produces a midpoint color for score 5 out of 10", () => {
    const mid = scoreColor(5)
    expect(mid).toMatch(/^rgb\(\d+,\d+,\d+\)$/)
    // Must be between orange (232) and teal (13) on the red channel
    const r = parseInt(mid.match(/rgb\((\d+)/)[1])
    expect(r).toBeGreaterThan(13)
    expect(r).toBeLessThan(232)
  })

  it("accepts a custom max for the 100-point overall score", () => {
    const atMin = scoreColor(1, 100)
    const atMax = scoreColor(100, 100)
    expect(atMin).toBe("rgb(232,117,10)")
    expect(atMax).toBe("rgb(13,115,119)")
  })
})

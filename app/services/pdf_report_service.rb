require "prawn"
Prawn::Fonts::AFM.hide_m17n_warning = true

class PdfReportService
  # ── Palette ────────────────────────────────────────────────────────────────
  BRAND   = "0D7377"
  BLACK   = "1C1C1C"
  MUTED   = "6B6B6B"
  BORDER  = "DDD8D0"
  HIGH    = "16A34A"   # score ≥ 80
  MID     = "D97706"   # score ≥ 60
  LOW     = "DC2626"   # score  < 60
  BAR_BG  = "E5E7EB"
  WHITE   = "FFFFFF"

  def initialize(session, recording, report)
    @session   = session
    @recording = recording
    @report    = report
  end

  # Returns raw PDF binary string.
  def generate
    @pdf = Prawn::Document.new(page_size: "A4", margin: [48, 52, 48, 52])
    @pdf.font "Helvetica"

    render_header
    divider(after: 14)
    render_session_details
    divider
    render_overall_score
    divider
    render_summary
    divider
    render_feedback
    divider
    render_metrics
    divider
    render_transcript_excerpt
    render_footer

    @pdf.render
  end

  private

  # ── Helpers ─────────────────────────────────────────────────────────────────

  def w = @pdf.bounds.width

  def summary_text
    return @report.summary.to_s unless @report.summary.is_a?(Hash)
    @report.summary["text"].to_s
  end

  def overall_score
    @report.llm_raw_response&.dig("overall_score") || begin
      scores = (@report.focus_feedbacks || {}).values
                 .filter_map { |v| v["score"].to_i if v.is_a?(Hash) }
      scores.any? ? (scores.sum.to_f / scores.size).round : 0
    end
  end

  def score_color(score)  = score.to_i >= 80 ? HIGH : score.to_i >= 60 ? MID : LOW
  def score_label(score)  = score.to_i >= 80 ? "Excellent" : score.to_i >= 60 ? "Good" : "Needs work"

  def format_duration(seconds)
    seconds >= 60 ? "#{seconds / 60}m #{seconds % 60}s" : "#{seconds}s"
  end

  # Strip characters outside Windows-1252 range so Prawn's built-in fonts don't choke.
  def safe(text)
    text.to_s
        .gsub("\u2014", "--")   # em dash
        .gsub("\u2013", "-")    # en dash
        .gsub("\u201C", '"')    # left double quote
        .gsub("\u201D", '"')    # right double quote
        .gsub("\u2018", "'")    # left single quote
        .gsub("\u2019", "'")    # right single quote
        .gsub("\u2026", "...")  # ellipsis
        .encode("Windows-1252", invalid: :replace, undef: :replace, replace: "?")
        .encode("UTF-8")
  end

  def section_label(text)
    @pdf.fill_color MUTED
    @pdf.text text, size: 8, style: :bold, character_spacing: 1.5
  end

  def divider(before: 0, after: 14)
    @pdf.move_down before
    @pdf.stroke_color BORDER
    @pdf.line_width 0.5
    @pdf.stroke_horizontal_rule
    @pdf.move_down after
  end

  # ── Sections ─────────────────────────────────────────────────────────────────

  def render_header
    # Brand name (top-left) + date (top-right) on same line
    @pdf.fill_color BRAND
    @pdf.text_box "VOXIFY",
                  at: [0, @pdf.cursor],
                  width: 80,
                  size: 10,
                  style: :bold,
                  character_spacing: 2

    @pdf.fill_color MUTED
    @pdf.text_box @session.created_at.strftime("%-d %B %Y · %l:%M %p").strip,
                  at: [0, @pdf.cursor],
                  width: w,
                  size: 8,
                  align: :right

    @pdf.move_down 16

    # Thick brand-coloured rule under brand line
    @pdf.stroke_color BRAND
    @pdf.line_width 1.5
    @pdf.stroke_horizontal_rule
    @pdf.move_down 16

    # Session title
    @pdf.fill_color BLACK
    @pdf.text safe(@session.title.presence || "Untitled Session"),
              size: 22, style: :bold, leading: 2
    @pdf.move_down 4
  end

  def render_session_details
    section_label "SESSION DETAILS"
    @pdf.move_down 8

    rows = []
    rows << ["Presentation type", safe(@session.presentation_type.humanize)]   if @session.presentation_type.present?
    rows << ["Audience",          safe(@session.audience.humanize)]             if @session.audience.present?

    focuses = @session.focus.reject(&:blank?)
    rows << ["Focus areas", safe(focuses.map(&:humanize).join("  .  "))] if focuses.any?

    rows << ["Duration", format_duration(@recording.duration_seconds)] if @recording&.duration_seconds
    rows << ["Date recorded", @session.created_at.strftime("%-d %B %Y, %l:%M %p").strip]

    rows.each do |label, value|
      y = @pdf.cursor
      @pdf.fill_color MUTED
      @pdf.text_box safe(label), at: [0, y], width: 130, size: 9
      @pdf.fill_color BLACK
      @pdf.text_box safe(value), at: [135, y], width: w - 135, size: 9
      @pdf.move_down 15
    end
  end

  def render_overall_score
    score = overall_score
    color = score_color(score)

    section_label "OVERALL SCORE"
    @pdf.move_down 10

    @pdf.fill_color color
    @pdf.text score.to_s, size: 42, style: :bold, align: :center
    @pdf.move_down 4

    @pdf.fill_color MUTED
    @pdf.text safe("out of 100  -  #{score_label(score)}"), size: 9, align: :center
    @pdf.move_down 6
  end

  def render_summary
    return if summary_text.blank?

    section_label "SUMMARY"
    @pdf.move_down 8
    @pdf.fill_color BLACK
    @pdf.text safe(summary_text), size: 10, leading: 5
  end

  def render_feedback
    feedbacks = @report.focus_feedbacks || {}
    return if feedbacks.empty?

    section_label "DETAILED FEEDBACK"
    @pdf.move_down 12

    feedbacks.each_with_index do |(key, data), idx|
      next unless data.is_a?(Hash)

      score = data["score"].to_i
      color = score_color(score)
      label = safe(key.to_s.gsub("_", " ").split.map(&:capitalize).join(" "))

      @pdf.move_down 10 if idx > 0

      # Label (left) + score (right) on the same line
      y = @pdf.cursor
      @pdf.fill_color BLACK
      @pdf.text_box label, at: [0, y], width: w - 75, size: 11, style: :bold
      @pdf.fill_color color
      @pdf.text_box "#{score} / 100", at: [w - 70, y], width: 70,
                    size: 11, style: :bold, align: :right
      @pdf.move_down 16

      # Score bar
      bar_y = @pdf.cursor
      @pdf.fill_color BAR_BG
      @pdf.fill_rounded_rectangle [0, bar_y], w, 5, 2
      fill_w = [[(score / 100.0 * w).round, 6].max, w].min
      @pdf.fill_color color
      @pdf.fill_rounded_rectangle [0, bar_y], fill_w, 5, 2
      @pdf.move_down 11

      # Feedback text
      if data["feedback"].present?
        @pdf.fill_color MUTED
        @pdf.text safe(data["feedback"].to_s), size: 9, leading: 3
        @pdf.move_down 5
      end

      # Filler words detail
      if key.to_s == "filler_words" && data.dig("details", "words").present?
        tags = data.dig("details", "words")
                   .map { |fw| "#{fw["word"]} ×#{fw["count"]}" }.join("   ")
        @pdf.fill_color MUTED
        @pdf.text "Words detected:  #{tags}", size: 8
        @pdf.move_down 3
      end

      # Pace detail
      if key.to_s == "pace" && data.dig("details", "wpm").present?
        @pdf.fill_color MUTED
        @pdf.text "#{data.dig("details", "wpm")} words per minute", size: 8
        @pdf.move_down 3
      end
    end
  end

  def render_metrics
    metrics = @report.llm_raw_response&.dig("metrics") || {}

    items = []
    items << { label: "Duration",    value: format_duration(@recording.duration_seconds) } if @recording&.duration_seconds
    items << { label: "Words / min", value: metrics["words_per_minute"].to_s }             if metrics["words_per_minute"]
    items << { label: "Filler words", value: metrics["filler_word_count"].to_s }           if metrics["filler_word_count"]

    return if items.empty?

    section_label "METRICS"
    @pdf.move_down 10

    col_w = w / items.size
    y     = @pdf.cursor

    items.each_with_index do |item, i|
      x = i * col_w
      @pdf.fill_color BLACK
      @pdf.text_box item[:value], at: [x, y], width: col_w,
                    size: 20, style: :bold, align: :center
      @pdf.fill_color MUTED
      @pdf.text_box item[:label], at: [x, y - 24], width: col_w,
                    size: 8, align: :center
    end

    @pdf.move_down 44
  end

  def render_transcript_excerpt
    excerpt = @report.llm_raw_response&.dig("transcript_excerpt")

    # Fall back to first 60 words of the raw transcript
    if excerpt.blank? && @recording&.transcript.present?
      words   = @recording.transcript.split
      excerpt = words.first(60).join(" ")
      excerpt += " \u2026" if words.size > 60
    end

    return if excerpt.blank?

    section_label "TRANSCRIPT EXCERPT"
    @pdf.move_down 8
    @pdf.fill_color MUTED
    @pdf.text safe("\"#{excerpt}\""), size: 9, leading: 4, style: :italic
    @pdf.move_down 4
  end

  def render_footer
    @pdf.move_down 20
    @pdf.stroke_color BORDER
    @pdf.line_width 0.5
    @pdf.stroke_horizontal_rule
    @pdf.move_down 6
    @pdf.fill_color MUTED
    @pdf.text safe("Generated by Voxify  -  #{@session.created_at.strftime("%-d %B %Y")}"),
              size: 7, align: :center
  end
end

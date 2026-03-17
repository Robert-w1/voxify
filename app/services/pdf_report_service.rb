require "prawn"
Prawn::Fonts::AFM.hide_m17n_warning = true

class PdfReportService
  # ── Palette ────────────────────────────────────────────────────────────────
  BRAND   = "0D7377"
  BLACK   = "1C1C1C"
  MUTED   = "6B6B6B"
  BORDER  = "DDD8D0"
  HIGH    = "16A34A"   # score ≥ 8 (per-category) or ≥ 80 (overall)
  MID     = "D97706"   # score ≥ 6 / ≥ 60
  LOW     = "DC2626"   # score  < 6 / < 60
  BAR_BG  = "E5E7EB"
  WHITE   = "FFFFFF"
  FOCUS_ACCENT = "0D7377"   # teal header for user-chosen focus sections

  # Maps the 9 user-facing focus options → LLM category keys
  FOCUS_TO_CATEGORY = {
    "filler_words" => "delivery_context",
    "tone"         => "delivery_context",
    "pace"         => "delivery_context",
    "clarity"      => "clarity",
    "confidence"   => "confidence",
    "vocabulary"   => "word_choice",
    "conciseness"  => "conciseness",
    "engagement"   => "engagement",
    "storytelling" => "engagement"
  }.freeze

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
    render_strengths_improvements
    divider
    render_feedback
    divider
    render_metrics
    divider
    render_transcript
    render_footer

    @pdf.render
  end

  private

  # ── Helpers ─────────────────────────────────────────────────────────────────

  def w = @pdf.bounds.width

  def summary_text
    return @report.summary.to_s unless @report.summary.is_a?(Hash)
    @report.summary["summary"].to_s
  end

  def overall_score
    @report.summary&.dig("score") || begin
      scores = (@report.focus_feedbacks || {}).values
                 .filter_map { |v| v["score"].to_i if v.is_a?(Hash) }
      scores.any? ? ((scores.sum.to_f / scores.size) * 10).round : 0
    end
  end

  # overall score is 1-100; per-category scores are 1-10
  def overall_score_color(score)  = score.to_i >= 80 ? HIGH : score.to_i >= 60 ? MID : LOW
  def overall_score_label(score)  = score.to_i >= 80 ? "Excellent" : score.to_i >= 60 ? "Good" : "Needs work"
  def score_color(score)          = score.to_i >= 8 ? HIGH : score.to_i >= 6 ? MID : LOW

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
    logo_top = @pdf.cursor
    logo_mid  = logo_top - 7

    # Waveform logo bars (mirrored waveform: short, mid, tall, mid, short)
    bars = [[0, 4], [5, 10], [10, 14], [15, 10], [20, 4]]
    @pdf.fill_color BRAND
    bars.each do |x, h|
      @pdf.fill_rounded_rectangle [x, logo_mid + (h / 2.0)], 3, h, 1.5
    end

    # Brand name next to logo
    @pdf.fill_color BRAND
    @pdf.text_box "VOXIFY",
                  at: [28, logo_top],
                  width: 70,
                  size: 10,
                  style: :bold,
                  character_spacing: 2

    # Date top-right
    @pdf.fill_color MUTED
    @pdf.text_box @session.created_at.strftime("%-d %B %Y · %l:%M %p").strip,
                  at: [0, logo_top],
                  width: w,
                  size: 8,
                  align: :right

    @pdf.move_down 22

    # Thick brand rule
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
    color = overall_score_color(score)

    section_label "OVERALL SCORE"
    @pdf.move_down 10

    @pdf.fill_color color
    @pdf.text score.to_s, size: 42, style: :bold, align: :center
    @pdf.move_down 4

    @pdf.fill_color MUTED
    @pdf.text safe("out of 100  -  #{overall_score_label(score)}"), size: 9, align: :center
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

    # Determine which category keys the user specifically focused on
    chosen_categories = (@session.focus || [])
                          .reject(&:blank?)
                          .map { |f| FOCUS_TO_CATEGORY[f] }
                          .compact.uniq

    focus_feedbacks = chosen_categories.any? ? feedbacks.select { |k, _| chosen_categories.include?(k) } : {}
    other_feedbacks = feedbacks.reject { |k, _| chosen_categories.include?(k) }

    if focus_feedbacks.any?
      render_feedback_section("YOUR FOCUS AREAS", focus_feedbacks, accent: true)
      divider
    end

    render_feedback_section("ALL CATEGORIES", other_feedbacks) if other_feedbacks.any?
  end

  def render_feedback_section(title, feedbacks, accent: false)
    section_label title
    @pdf.move_down 12

    feedbacks.each_with_index do |(key, data), idx|
      next unless data.is_a?(Hash)

      score = data["score"].to_i
      color = score_color(score)
      label = safe(key.to_s.gsub("_", " ").split.map(&:capitalize).join(" "))

      @pdf.move_down 10 if idx > 0

      # Teal left accent bar for user-chosen focus categories
      if accent
        @pdf.fill_color FOCUS_ACCENT
        @pdf.fill_rounded_rectangle [0, @pdf.cursor + 2], 3, 18, 1.5
      end

      indent = accent ? 8 : 0

      y = @pdf.cursor
      @pdf.fill_color BLACK
      @pdf.text_box label, at: [indent, y], width: w - indent - 75, size: 11, style: :bold
      @pdf.fill_color color
      @pdf.text_box "#{score} / 10", at: [w - 70, y], width: 70,
                    size: 11, style: :bold, align: :right
      @pdf.move_down 16

      bar_y = @pdf.cursor
      @pdf.fill_color BAR_BG
      @pdf.fill_rounded_rectangle [indent, bar_y], w - indent, 5, 2
      fill_w = [[(score / 10.0 * (w - indent)).round, 6].max, w - indent].min
      @pdf.fill_color color
      @pdf.fill_rounded_rectangle [indent, bar_y], fill_w, 5, 2
      @pdf.move_down 11

      if data["summary"].present?
        @pdf.fill_color MUTED
        @pdf.text safe(data["summary"].to_s), size: 9, leading: 3
        @pdf.move_down 5
      end

      # Improvements list for this category
      improvements = data["improvements"] || []
      if improvements.any?
        improvements.each do |item|
          render_bullet(item, color: MID)
        end
        @pdf.move_down 3
      end
    end
  end

  def render_metrics
    metrics = @report.llm_raw_response&.dig("meta") || {}

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

  def render_strengths_improvements
    strengths    = @report.summary&.dig("top_strengths") || []
    improvements = @report.summary&.dig("top_improvements") || []
    return if strengths.empty? && improvements.empty?

    if strengths.any?
      section_label "KEY STRENGTHS"
      @pdf.move_down 8
      strengths.each do |item|
        render_bullet(item, color: HIGH)
      end
      @pdf.move_down 6
    end

    if improvements.any?
      section_label "AREAS TO IMPROVE"
      @pdf.move_down 8
      improvements.each do |item|
        render_bullet(item, color: MID)
      end
    end
  end

  def render_bullet(text, color:)
    y = @pdf.cursor
    @pdf.fill_color color
    @pdf.fill_circle [4, y - 4], 2.5
    @pdf.bounding_box([12, y], width: w - 12) do
      @pdf.fill_color BLACK
      @pdf.text safe(text), size: 9, leading: 3
    end
    @pdf.move_down 5
  end

  def render_transcript
    return if @recording&.transcript.blank?

    section_label "TRANSCRIPT"
    @pdf.move_down 8
    @pdf.fill_color MUTED
    @pdf.text safe(@recording.transcript), size: 9, leading: 4
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

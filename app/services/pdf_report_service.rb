require "prawn"
Prawn::Fonts::AFM.hide_m17n_warning = true

class PdfReportService
  # ── Palette ────────────────────────────────────────────────────────────────
  BRAND        = "0D7377"   # primary teal
  ORANGE       = "E8750A"   # brand orange (score low end)
  FADED_TEAL   = "7AAEB1"   # light teal for logo extremity bars
  BLACK        = "1C1C1C"
  MUTED        = "6B6B6B"
  BORDER       = "DDD8D0"
  BAR_BG       = "E5E7EB"
  WHITE        = "FFFFFF"
  FOCUS_ACCENT = "0D7377"
  COMMON_FILLER_WORDS = %w[um uh mhmm mm-mm uh-uh uh-huh nuh-uh like you\ know basically literally actually just really
                           so anyway sort\ of kind\ of].freeze

  # Maps the 9 user-facing focus options → LLM category keys
  # FOCUS_TO_CATEGORY = {
  #   "filler_words" => "delivery_context",
  #   "tone"         => "delivery_context",
  #   "pacing"       => "delivery_context",
  #   "clarity"      => "clarity",
  #   "confidence"   => "confidence",
  #   "vocabulary"   => "vocabulary",
  #   "conciseness"  => "conciseness",
  #   "engagement"   => "engagement",
  #   "storytelling" => "engagement"
  # }.freeze

  def initialize(session, recording, report)
    @session   = session
    @recording = recording
    @report    = report
  end

  BEBAS_PATH = Rails.root.join("app", "assets", "fonts", "BebasNeue-Regular.ttf").to_s

  # Returns raw PDF binary string.
  def generate
    @pdf = Prawn::Document.new(page_size: "A4", margin: [48, 52, 48, 52])
    @pdf.font_families.update("BebasNeue" => { normal: BEBAS_PATH })
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
               .filter_map do |v|
        v["score"].to_i if v.is_a?(Hash)
      end
      scores.any? ? ((scores.sum.to_f / scores.size) * 10).round : 0
    end
  end

  # Interpolates orange (#E8750A) at 1 → teal (#0D7377) at max, returns hex string
  def score_color_hex(score, max = 10)
    t = ((score.to_f - 1) / (max - 1)).clamp(0.0, 1.0)
    r = (232 + ((13  - 232) * t)).round
    g = (117 + ((115 - 117) * t)).round
    b = (10  + ((119 - 10)  * t)).round
    format("%<r>02X%<g>02X%<b>02X", r: r, g: g, b: b)
  end

  def overall_score_color(score) = score_color_hex(score.to_i, 100)

  def overall_score_label(score)
    if score.to_i >= 80
      "Excellent"
    else
      score.to_i >= 60 ? "Good" : "Needs work"
    end
  end

  def score_color(score) = score_color_hex(score.to_i)

  def format_duration(seconds)
    mins = seconds / 60
    secs = seconds % 60
    parts = []
    parts << "#{mins} #{mins == 1 ? 'minute' : 'minutes'}" if mins.positive?
    parts << "#{secs} #{secs == 1 ? 'second' : 'seconds'}" if secs.positive? || mins.zero?
    parts.join(" ")
  end

  def format_duration_clock(seconds)
    format("%<min>02d:%<sec>02d", min: seconds / 60, sec: seconds % 60)
  end

  def humanize_type(value)
    value.to_s.humanize.gsub("1on1", "1-on-1")
  end

  # Strip characters outside Windows-1252 range so Prawn's built-in fonts don't choke.
  def safe(text)
    text.to_s
        .gsub("\u2014", "--") # em dash
        .tr("\u2013", "-")    # en dash
        .tr("\u201C", '"')    # left double quote
        .tr("\u201D", '"')    # right double quote
        .tr("\u2018", "'")    # left single quote
        .tr("\u2019", "'")    # right single quote
        .gsub("\u2026", "...") # ellipsis
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
    render_logo
    @pdf.stroke_color BRAND
    @pdf.line_width 1.5
    @pdf.stroke_horizontal_rule
    @pdf.move_down 16

    @pdf.fill_color BLACK
    @pdf.font("BebasNeue") do
      @pdf.text safe((@session.title.presence || "Untitled Session").split(' - ').first),
                size: 36, leading: 2
    end
    @pdf.move_down 4

    local_time = session_local_time
    @pdf.fill_color MUTED
    @pdf.text local_time.strftime("%-d %B %Y  .  %-I:%M %p #{format_utc_offset(local_time)}"),
              size: 10, leading: 2
    @pdf.move_down 6
  end

  def render_logo
    logo_mid = @pdf.cursor - 7
    bar_colors = [FADED_TEAL, BRAND, ORANGE, BRAND, FADED_TEAL]
    [[0, 4], [5, 10], [10, 14], [15, 10], [20, 4]].each_with_index do |(x, h), i|
      @pdf.fill_color bar_colors[i]
      @pdf.fill_rounded_rectangle [x, logo_mid + (h / 2.0)], 3, h, 1.5
    end
    @pdf.fill_color BRAND
    @pdf.text_box "VOXIFY",
                  at: [28, logo_mid + 4], width: 70,
                  size: 10, style: :bold, character_spacing: 2
    @pdf.move_down 22
  end

  def session_local_time
    return @session.created_at.utc if @session.timezone.blank?

    tz = begin
      ActiveSupport::TimeZone[@session.timezone] || ActiveSupport::TimeZone.find_tzinfo(@session.timezone)
    rescue StandardError
      nil
    end
    tz ? @session.created_at.in_time_zone(tz) : @session.created_at.utc
  end

  def format_utc_offset(time)
    total_mins = time.utc_offset / 60
    return "GMT" if total_mins.zero?

    sign = total_mins.positive? ? "+" : "-"
    hrs  = total_mins.abs / 60
    mins = total_mins.abs % 60
    mins.positive? ? "GMT#{sign}#{hrs}:#{mins.to_s.rjust(2, '0')}" : "GMT#{sign}#{hrs}"
  end

  def render_session_details
    section_label "SESSION DETAILS"
    @pdf.move_down 8

    rows = []
    if @session.presentation_type.present?
      rows << ["Presentation type",
               safe(humanize_type(@session.presentation_type))]
    end
    rows << ["Audience", safe(@session.audience.humanize)] if @session.audience.present?

    focuses = @session.focus.compact_blank
    rows << ["Focus areas", safe(focuses.map(&:humanize).join("  .  "))] if focuses.any?

    rows << ["Duration", format_duration(@recording.duration_seconds)] if @recording&.duration_seconds

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

    @pdf.formatted_text [
      { text: score.to_s,  color: color, styles: [:bold], size: 42 },
      { text: "/100",      color: MUTED,                  size: 20 }
    ], align: :center
    @pdf.move_down 4

    @pdf.fill_color MUTED
    @pdf.text safe(overall_score_label(score)), size: 9, align: :center
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
                        .compact_blank
                        # .map { |f| FOCUS_TO_CATEGORY[f] }
                        .compact.uniq

    focus_feedbacks = chosen_categories.any? ? feedbacks.slice(*chosen_categories) : {}
    other_feedbacks = feedbacks.except(*chosen_categories)

    if focus_feedbacks.any?
      render_feedback_section("YOUR FOCUS AREAS", focus_feedbacks)
      divider
    end

    render_feedback_section("ALL CATEGORIES", other_feedbacks) if other_feedbacks.any?
  end

  def render_feedback_section(title, feedbacks)
    section_label title
    @pdf.move_down 12
    feedbacks.each_with_index do |(key, data), idx|
      next unless data.is_a?(Hash)

      render_feedback_item(key, data, title, idx)
    end
  end

  def render_feedback_item(key, data, section_title, idx)
    score = data["score"].to_i
    color = score_color(score)
    label = safe(key.to_s.tr("_", " ").capitalize)

    @pdf.move_down 10 if idx.positive?
    ensure_page_space(section_title)
    render_feedback_row(label, score, color)
    render_feedback_bar(score, color)

    if data["summary"].present?
      @pdf.fill_color MUTED
      @pdf.text safe(data["summary"].to_s), size: 9, leading: 3
      @pdf.move_down 5
    end

    improvements = data["improvements"] || []
    return unless improvements.any?

    improvements.each { |item| render_bullet(item, color: color) }
    @pdf.move_down 3
  end

  def ensure_page_space(section_title)
    return unless @pdf.cursor < 120

    @pdf.start_new_page
    section_label section_title
    @pdf.move_down 12
  end

  def render_feedback_row(label, score, color)
    y = @pdf.cursor
    @pdf.fill_color BLACK
    @pdf.text_box label, at: [0, y], width: w - 75, size: 11, style: :bold
    @pdf.fill_color color
    @pdf.text_box "#{score} / 10", at: [w - 70, y], width: 70,
                                   size: 11, style: :bold, align: :right
    @pdf.move_down 16
  end

  def render_feedback_bar(score, color)
    bar_y = @pdf.cursor
    @pdf.fill_color BAR_BG
    @pdf.fill_rounded_rectangle [0, bar_y], w, 5, 2
    @pdf.fill_color color
    @pdf.fill_rounded_rectangle [0, bar_y], (score / 10.0 * w).round.clamp(6, w), 5, 2
    @pdf.move_down 11
  end

  def render_metrics
    items = metric_items
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

  def metric_items
    metrics = @report.llm_raw_response&.dig("meta") || {}
    [
      @recording&.duration_seconds && { label: "Duration", value: format_duration_clock(@recording.duration_seconds) },
      metrics["words_per_minute"]   && { label: "Words / min", value: metrics["words_per_minute"].to_s },
      metrics["filler_word_count"]  && { label: "Filler words", value: metrics["filler_word_count"].to_s }
    ].compact
  end

  def render_strengths_improvements
    strengths    = @report.summary&.dig("top_strengths") || []
    improvements = @report.summary&.dig("top_improvements") || []
    return if strengths.empty? && improvements.empty?

    render_bullet_section("KEY STRENGTHS", strengths, BRAND) { @pdf.move_down 6 }
    render_bullet_section("AREAS TO IMPROVE", improvements, ORANGE)
  end

  def render_bullet_section(title, items, color)
    return unless items.any?

    section_label title
    @pdf.move_down 8
    items.each { |item| render_bullet(item, color: color) }
    yield if block_given?
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
    render_transcript_body
    @pdf.move_down 4
  end

  def render_transcript_body
    text    = safe(@recording.transcript)
    pattern = filler_word_pattern
    if pattern
      @pdf.text text.gsub(pattern) { "<b>#{::Regexp.last_match(1)}</b>" },
                size: 9, leading: 4, inline_format: true
    else
      @pdf.text text, size: 9, leading: 4
    end
  end

  def filler_word_pattern
    llm_fillers = (@report.llm_raw_response&.dig("meta", "filler_words") || [])
                  .map { |x| x.to_s.downcase }.reject(&:empty?)
    words = llm_fillers.any? ? llm_fillers : COMMON_FILLER_WORDS
    return unless words.any?

    /\b(#{words.map { |fw| Regexp.escape(fw) }.join('|')})\b/i
  end

  def render_footer
    @pdf.move_down 20
    @pdf.stroke_color BORDER
    @pdf.line_width 0.5
    @pdf.stroke_horizontal_rule
    @pdf.move_down 6
    @pdf.fill_color MUTED
    @pdf.text safe("Generated by Voxify  -  #{@session.created_at.strftime('%-d %B %Y')}"),
              size: 7, align: :center
  end
end

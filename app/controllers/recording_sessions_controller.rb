require "open-uri"

class RecordingSessionsController < ApplicationController
  before_action :authenticate_user!
  before_action :enable_sidebar
  before_action :set_recording_session, only: [:show, :edit, :update, :destroy, :download_pdf, :pdf_status, :report_status, :update_folder]

  def new
    @recording_session = RecordingSession.new
  end

  def create
    @recording_session = current_user.recording_sessions.build(recording_session_params)
    @recording_session.status = :recording

    if @recording_session.save
      redirect_to recording_session_path(@recording_session, source: "new")
    else
      render :new, status: :unprocessable_content
    end
  end

  def index
    @query = params[:q].to_s.strip
    @recording_sessions = if @query.present?
      current_user.recording_sessions.search_by_title(@query)
    else
      current_user.recording_sessions.order(created_at: :desc)
    end

    respond_to do |format|
      format.html
      format.json do
        q = @query
        return render json: [] if q.length < 2

        results = current_user.recording_sessions.search_by_title(q).limit(8).map do |s|
          { type: "session", label: s.title.presence || "Untitled", url: recording_session_path(s), created_at: s.created_at.iso8601 }
        end

        render json: results
      end
    end
  end

  def show
    @recording = @recording_session.recordings.order(created_at: :desc).first
    @report = @recording&.report
    @report_json = build_report_json(@report, @recording).to_json if @report
  end

  def report_status
    recording = @recording_session.recordings.order(created_at: :desc).first
    report    = recording&.report

    if @recording_session.completed? && report
      render json: { status: "completed", report: build_report_json(report, recording) }
    elsif @recording_session.failed? || @recording_session.completed?
      render json: { status: "failed" }
    else
      render json: { status: "processing" }
    end
  end

  def pdf_status
    recording = @recording_session.recordings.order(created_at: :desc).first
    report = recording&.report
    render json: { ready: report&.pdf_file&.attached? || false }
  end

  def download_pdf
    recording = @recording_session.recordings.order(created_at: :desc).first
    report = recording&.report

    unless report&.pdf_file&.attached?
      redirect_to recording_session_path(@recording_session), alert: "PDF not available"
      return
    end

    url = Cloudinary::Utils.cloudinary_url(
      "#{Rails.env}/#{report.pdf_file.blob.key}",
      resource_type: "raw"
    )

    pdf_data = URI.open(url, &:read)

    send_data pdf_data,
              filename: "voxify-report-#{report.id}.pdf",
              type: "application/pdf",
              disposition: "attachment"
  rescue OpenURI::HTTPError, SocketError, Errno::ECONNREFUSED
    redirect_to recording_session_path(@recording_session), alert: "PDF download failed. Please try again."
  end

  def edit; end

  def update
    if @recording_session.update(update_params)
      respond_to do |format|
        format.json { render json: { ok: true } }
        format.turbo_stream
        format.html { redirect_to recording_sessions_path }
      end
    else
      respond_to do |format|
        format.json { render json: { ok: false, errors: @recording_session.errors.full_messages }, status: :unprocessable_content }
        format.html { render :edit, status: :unprocessable_content }
      end
    end
  end

  def destroy
    referer_path = URI.parse(request.referer).path rescue nil
    on_show_page = referer_path == recording_session_path(@recording_session)

    @recording_session.destroy

    if on_show_page
      redirect_to recording_sessions_path
    else
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to recording_sessions_path }
      end
    end
  end

  def update_folder
    folder_id = params[:folder_id].presence
    if folder_id && !current_user.folders.exists?(folder_id)
      return redirect_back_or_to recording_sessions_path, alert: "Folder not found"
    end
    @recording_session.update(folder_id: folder_id)
    redirect_back_or_to recording_sessions_path
  end

  private

  def build_report_json(report, recording)
    feedbacks = report.focus_feedbacks || {}
    scores = feedbacks.values.filter_map { |v| v["score"].to_i if v.is_a?(Hash) }
    overall = report.summary&.dig("score") ||
              (scores.any? ? ((scores.sum.to_f / scores.size) * 10).round : 0)

    summary_text = report.summary.is_a?(Hash) ? report.summary["summary"] : report.summary.to_s

    {
      overall_score: overall,
      summary: summary_text,
      top_strengths: report.summary&.dig("top_strengths") || [],
      top_improvements: report.summary&.dig("top_improvements") || [],
      recommended_focus: report.summary&.dig("recommended_focus") || "",
      focus_feedbacks: feedbacks,
      pdf_ready: report.pdf_file.attached?,
      metrics: {
        duration_seconds: recording&.duration_seconds || 0,
        words_per_minute: report.llm_raw_response&.dig("meta", "words_per_minute") || 0,
        filler_word_count: report.llm_raw_response&.dig("meta", "filler_word_count") || 0
      }
    }
  end

  def set_recording_session
    @recording_session = current_user.recording_sessions.find(params[:id])
  end

  def recording_session_params
    params.require(:recording_session).permit(:audience, :presentation_type, :timezone, focus: [])
  end

  def update_params
    params.require(:recording_session).permit(:title)
  end
end

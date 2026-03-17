class RecordingSessionsController < ApplicationController
  before_action :authenticate_user!
  before_action :enable_sidebar
  before_action :set_recording_session, only: [:show, :edit, :update, :destroy, :download_pdf]

  def new
    @recording_session = RecordingSession.new
  end

  def create
    @recording_session = current_user.recording_sessions.build(recording_session_params)
    @recording_session.status = :recording

    if @recording_session.save
      redirect_to recording_session_path(@recording_session), notice: "Session started!"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def index
    @recording_sessions = current_user.recording_sessions.order(created_at: :desc)
  end

  def show
    @recording = @recording_session.recordings.order(created_at: :desc).first
    @report = @recording&.report
    @report_json = build_report_json(@report, @recording).to_json if @report
  end

  def download_pdf
    recording = @recording_session.recordings.order(created_at: :desc).first
    report = recording&.report

    if report.present?
      pdf_binary = PdfReportService.new(@recording_session, recording, report).generate
      send_data pdf_binary,
                filename: "voxify-report-#{report.id}.pdf",
                type: "application/pdf",
                disposition: "attachment"
    else
      redirect_to recording_session_path(@recording_session), alert: "PDF not available"
    end
  end

  def edit; end

  def update
    @recording_session.update(update_params)
    respond_to do |format|
      format.json { render json: { ok: true } }
      format.turbo_stream
      format.html { redirect_to recording_sessions_path }
    end
  end

  def destroy
    @recording_session.destroy
    redirect_to recording_sessions_path
  end

  private

  def build_report_json(report, recording)
    feedbacks = report.focus_feedbacks || {}
    scores = feedbacks.values.filter_map { |v| v["score"].to_i if v.is_a?(Hash) }
    overall = report.llm_raw_response&.dig("overall_score") ||
              (scores.any? ? (scores.sum.to_f / scores.size).round : 0)

    summary_text = report.summary.is_a?(Hash) ? report.summary["text"] : report.summary.to_s

    {
      overall_score: overall,
      summary: summary_text,
      focus_feedbacks: feedbacks,
      metrics: {
        duration_seconds: recording&.duration_seconds || 0,
        words_per_minute: report.llm_raw_response&.dig("metrics", "words_per_minute") || 0,
        filler_word_count: report.llm_raw_response&.dig("metrics", "filler_word_count") || 0
      }
    }
  end

  def set_recording_session
    @recording_session = current_user.recording_sessions.find(params[:id])
  end

  def recording_session_params
    params.require(:recording_session).permit(:audience, :presentation_type, focus: [])
  end

  def update_params
    params.require(:recording_session).permit(:title)
  end
end

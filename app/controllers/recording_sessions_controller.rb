class RecordingSessionsController < ApplicationController
  before_action :authenticate_user!
  before_action :enable_sidebar

  def index
    # @recording_sessions = current_user.recording_sessions.order(created_at: :desc)
  end

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

  def show
    @recording_session = current_user.recording_sessions.find(params[:id])
  end

  def update
    @recording_session = current_user.recording_sessions.find(params[:id])
    @recording_session.update(rename_params)
    redirect_to recording_sessions_path, status: :see_other
  end

  def destroy
    @recording_session = current_user.recording_sessions.find(params[:id])
    @recording_session.destroy
    # redirect_to recording_sessions_path, notice: "Session deleted."
  end

  private

  def rename_params
    params.require(:recording_session).permit(:title)
  end

  def recording_session_params
    params.require(:recording_session).permit(:audience, :presentation_type, focus: [])
  end
end

class RecordingSessionsController < ApplicationController
  before_action :authenticate_user!
  before_action :enable_sidebar

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

  private

  def recording_session_params
    params.require(:recording_session).permit(:audience, :presentation_type, focus: [])
  end
end

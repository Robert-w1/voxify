class RecordingsController < ApplicationController
  before_action :enable_sidebar

  def create
    session = current_user.recording_sessions.find(params[:recording_session_id])

    recording = session.recordings.build
    recording.duration_seconds = params[:duration_seconds]
    recording.audio.attach(params[:audio])
    recording.save!
    recording.update!(audio_url: url_for(recording.audio))

    render json: { status: "ok" }
  end
end

class RecordingsController < ApplicationController
  def create
    raise
    recording = Recording.new
    recording.audio.attach(params[:audio])
    recording.save!

    render json: { status: "ok" }
  end
end

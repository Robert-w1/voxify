# Deepgram Transcription Setup
# ==============================
# No local installation needed — Deepgram is a cloud API.
#
# 1. Sign up at https://deepgram.com and create an API key
# 2. Add to your .env file:
#      DEEPGRAM_API_KEY=your_key_here

require "net/http"
require "uri"
require "json"

class TranscribeRecordingJob < ApplicationJob
  queue_as :default

  DEEPGRAM_URL = URI("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&words=true").freeze

  def perform(recording_id, user_id)
    recording = Recording.find(recording_id)

    raise "Unauthorized" unless recording.user.id == user_id

    recording.audio.blob.open do |tempfile|
      result = call_deepgram(tempfile, recording.audio.blob.content_type)
      recording.update!(
        transcript: result["transcript"],
        transcript_words: result["words"]
      )
    end

    AnalyzeTranscriptJob.perform_later(recording_id, user_id)
  rescue StandardError => e
    Recording.find_by(id: recording_id)&.recording_session&.failed!
    raise e
  end

  private

  def call_deepgram(tempfile, content_type)
    http = Net::HTTP.new(DEEPGRAM_URL.host, DEEPGRAM_URL.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(DEEPGRAM_URL)
    request["Authorization"] = "Token #{ENV.fetch('DEEPGRAM_API_KEY')}"
    request["Content-Type"] = content_type
    request.body = tempfile.read

    response = http.request(request)
    body = JSON.parse(response.body)

    raise "Deepgram API error: #{body['err_msg']}" if body["error"]

    alternative = body.dig("results", "channels", 0, "alternatives", 0)
    raise "Deepgram returned no transcription — audio may be empty or too short" if alternative.nil?

    {
      "transcript" => alternative["transcript"],
      "words" => alternative["words"].map { |w| w.slice("word", "start", "end") }
    }
  end
end

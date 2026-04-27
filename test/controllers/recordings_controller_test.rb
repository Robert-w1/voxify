require "test_helper"

class RecordingsControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActiveJob::TestHelper

  setup do
    @user = users(:one)
    @session = recording_sessions(:one)
    sign_in @user
  end

  def audio_fixture
    fixture_file_upload("audio.webm", "audio/webm")
  end

  test "creates recording and returns ok on valid upload" do
    assert_difference("Recording.count", 1) do
      post recording_session_recordings_path(@session),
           params: { audio: audio_fixture, duration_seconds: 30 }
    end

    assert_response :success
    assert_equal({ "status" => "ok" }, response.parsed_body)
  end

  test "attaches audio and sets duration on recording" do
    post recording_session_recordings_path(@session),
         params: { audio: audio_fixture, duration_seconds: 30 }

    recording = @session.recordings.last

    assert_predicate recording.audio, :attached?
    assert_equal 30, recording.duration_seconds
  end

  test "transitions session to processing" do
    post recording_session_recordings_path(@session),
         params: { audio: audio_fixture, duration_seconds: 10 }

    @session.reload

    assert_equal "processing", @session.status
  end

  test "enqueues TranscribeRecordingJob with recording and user ids" do
    post recording_session_recordings_path(@session),
         params: { audio: audio_fixture, duration_seconds: 10 }

    recording = @session.recordings.last

    assert_enqueued_with(job: TranscribeRecordingJob, args: [recording.id, @user.id])
  end

  test "returns 404 when session not found" do
    post recording_session_recordings_path(0),
         params: { audio: audio_fixture, duration_seconds: 10 }

    assert_response :not_found
  end

  test "returns 404 when session belongs to another user" do
    other_user = User.create!(email: "other@example.com", username: "other_user", password: "password123")
    other_session = other_user.recording_sessions.create!(
      audience: "colleagues",
      presentation_type: "presentation",
      status: "recording",
      focus: ["clarity"]
    )

    post recording_session_recordings_path(other_session),
         params: { audio: audio_fixture, duration_seconds: 10 }

    assert_response :not_found
  end

  test "returns unprocessable_entity when audio is missing" do
    post recording_session_recordings_path(@session),
         params: { duration_seconds: 10 }

    assert_response :unprocessable_content
    assert_equal "Audio is required", response.parsed_body["error"]
  end
end

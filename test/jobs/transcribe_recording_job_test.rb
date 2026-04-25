require "test_helper"
require "minitest/mock"

class TranscribeRecordingJobTest < ActiveJob::TestCase
  include ActiveJob::TestHelper

  setup do
    @user      = users(:one)
    @other_user = users(:two)
    @session   = recording_sessions(:one)
    @recording = recordings(:one)
    @recording.audio.attach(
      io: File.open(Rails.root.join("test/fixtures/files/audio.webm")),
      filename: "audio.webm",
      content_type: "audio/webm"
    )
  end

  test "updates transcript and words on successful Deepgram response" do
    stub_deepgram(deepgram_success_response) do
      TranscribeRecordingJob.new.perform(@recording.id, @user.id)
    end

    @recording.reload
    assert_equal "Hello world", @recording.transcript
    assert_equal [
      { "word" => "Hello", "start" => 0.1, "end" => 0.5 },
      { "word" => "world", "start" => 0.6, "end" => 1.0 }
    ], @recording.transcript_words
  end

  test "strips extra word fields returned by Deepgram" do
    stub_deepgram(deepgram_success_response) do
      TranscribeRecordingJob.new.perform(@recording.id, @user.id)
    end

    @recording.reload.transcript_words.each do |w|
      assert_equal %w[end start word], w.keys.sort
    end
  end

  test "enqueues AnalyzeTranscriptJob after transcription" do
    stub_deepgram(deepgram_success_response) do
      assert_enqueued_with(job: AnalyzeTranscriptJob, args: [ @recording.id, @user.id ]) do
        TranscribeRecordingJob.new.perform(@recording.id, @user.id)
      end
    end
  end

  test "raises Unauthorized when user_id does not match recording owner" do
    error = assert_raises(RuntimeError) do
      TranscribeRecordingJob.new.perform(@recording.id, @other_user.id)
    end

    assert_equal "Unauthorized", error.message
  end

  test "marks session failed when user_id is wrong" do
    assert_raises(RuntimeError) do
      TranscribeRecordingJob.new.perform(@recording.id, @other_user.id)
    end

    assert_equal "failed", @session.reload.status
  end

  test "raises when Deepgram returns an error body" do
    error_body = { "error" => true, "err_msg" => "invalid credentials" }

    stub_deepgram(error_body) do
      error = assert_raises(RuntimeError) do
        TranscribeRecordingJob.new.perform(@recording.id, @user.id)
      end

      assert_match(/Deepgram API error/, error.message)
    end
  end

  test "marks session failed on Deepgram API error" do
    stub_deepgram({ "error" => true, "err_msg" => "invalid credentials" }) do
      assert_raises(RuntimeError) do
        TranscribeRecordingJob.new.perform(@recording.id, @user.id)
      end
    end

    assert_equal "failed", @session.reload.status
  end

  test "raises when Deepgram returns no alternatives" do
    empty_response = { "results" => { "channels" => [ { "alternatives" => [] } ] } }

    stub_deepgram(empty_response) do
      error = assert_raises(RuntimeError) do
        TranscribeRecordingJob.new.perform(@recording.id, @user.id)
      end

      assert_match(/no transcription/, error.message)
    end
  end

  test "marks session failed when Deepgram returns no alternatives" do
    empty_response = { "results" => { "channels" => [ { "alternatives" => [] } ] } }

    stub_deepgram(empty_response) do
      assert_raises(RuntimeError) do
        TranscribeRecordingJob.new.perform(@recording.id, @user.id)
      end
    end

    assert_equal "failed", @session.reload.status
  end

  private

  def deepgram_success_response
    {
      "results" => {
        "channels" => [ {
          "alternatives" => [ {
            "transcript" => "Hello world",
            "words" => [
              { "word" => "Hello", "start" => 0.1, "end" => 0.5, "confidence" => 0.99 },
              { "word" => "world", "start" => 0.6, "end" => 1.0, "confidence" => 0.98 }
            ]
          } ]
        } ]
      }
    }
  end

  def stub_deepgram(response_body)
    mock_response = Minitest::Mock.new
    mock_response.expect(:body, response_body.to_json)

    http_stub = Object.new
    http_stub.define_singleton_method(:use_ssl=) { |_| }
    http_stub.define_singleton_method(:request) { |_| mock_response }

    Net::HTTP.stub(:new, http_stub) { yield }
  end
end

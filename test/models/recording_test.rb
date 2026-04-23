require "test_helper"

class RecordingTest < ActiveSupport::TestCase
  def setup
    @recording = recordings(:one)
  end

  # recording_session presence

  test "valid with a recording_session" do
    assert @recording.valid?
  end

  test "invalid without a recording_session" do
    @recording.recording_session = nil
    assert_not @recording.valid?
    assert_includes @recording.errors[:recording_session], "must exist"
  end

  # duration_seconds numericality

  test "valid with nil duration_seconds" do
    @recording.duration_seconds = nil
    assert @recording.valid?
  end

  test "valid with a positive duration_seconds" do
    @recording.duration_seconds = 30
    assert @recording.valid?
  end

  test "invalid with duration_seconds of zero" do
    @recording.duration_seconds = 0
    assert_not @recording.valid?
    assert_includes @recording.errors[:duration_seconds], "must be greater than 0"
  end

  test "invalid with a negative duration_seconds" do
    @recording.duration_seconds = -5
    assert_not @recording.valid?
    assert_includes @recording.errors[:duration_seconds], "must be greater than 0"
  end
end

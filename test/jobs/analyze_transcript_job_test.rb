require "test_helper"
require "minitest/mock"

class AnalyzeTranscriptJobTest < ActiveJob::TestCase
  include ActiveJob::TestHelper

  setup do
    @user       = users(:one)
    @other_user = users(:two)
    @session    = recording_sessions(:one)
    @recording  = recordings(:one)
    @recording.update!(transcript: "Hello, welcome to this presentation.")
  end

  test "creates report with summary and focus_feedbacks" do
    stub_llm(valid_llm_json) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
    end

    report = @recording.reload.report
    assert_not_nil report
    assert_equal({ "score" => 80, "summary" => "Good job" }, report.summary)
    assert_equal({ "clarity" => { "score" => 8, "feedback" => "Very clear" } }, report.focus_feedbacks)
  end

  test "stores full LLM response in llm_raw_response" do
    stub_llm(valid_llm_json) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
    end

    assert_not_nil @recording.reload.report.llm_raw_response
  end

  test "excludes overall and meta from focus_feedbacks" do
    stub_llm(valid_llm_json) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
    end

    keys = @recording.reload.report.focus_feedbacks.keys
    assert_not_includes keys, "overall"
    assert_not_includes keys, "meta"
  end

  test "marks session completed on success" do
    stub_llm(valid_llm_json) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
    end

    assert_equal "completed", @session.reload.status
  end

  test "enqueues GenerateReportPdfJob after creating the report" do
    stub_llm(valid_llm_json) do
      assert_enqueued_with(job: GenerateReportPdfJob) do
        AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
      end
    end
  end

  test "raises Unauthorized when user_id does not match recording owner" do
    error = assert_raises(RuntimeError) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @other_user.id)
    end

    assert_equal "Unauthorized", error.message
  end

  test "marks session failed when user_id is wrong" do
    assert_raises(RuntimeError) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @other_user.id)
    end

    assert_equal "failed", @session.reload.status
  end

  test "handles LLM response wrapped in markdown code fences" do
    fenced = "```json\n#{valid_llm_json}\n```"

    stub_llm(fenced) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
    end

    assert_not_nil @recording.reload.report
  end

  test "handles LLM response with JSON embedded in prose" do
    prose = "Here is the analysis:\n#{valid_llm_json}\nHope this helps."

    stub_llm(prose) do
      AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
    end

    assert_not_nil @recording.reload.report
  end

  test "raises when LLM returns completely unparseable content" do
    stub_llm("Sorry, I cannot analyze this.") do
      error = assert_raises(RuntimeError) do
        AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
      end

      assert_match(/Could not extract JSON/, error.message)
    end
  end

  test "marks session failed when LLM response is unparseable" do
    stub_llm("not json at all") do
      assert_raises(RuntimeError) do
        AnalyzeTranscriptJob.new.perform(@recording.id, @user.id)
      end
    end

    assert_equal "failed", @session.reload.status
  end

  private

  def valid_llm_json
    {
      "overall"  => { "score" => 80, "summary" => "Good job" },
      "meta"     => { "words_per_minute" => 120 },
      "clarity"  => { "score" => 8, "feedback" => "Very clear" }
    }.to_json
  end

  def stub_llm(content)
    response_mock = Minitest::Mock.new
    response_mock.expect(:content, content)

    client_mock = Minitest::Mock.new
    client_mock.expect(:with_instructions, client_mock, [ String ])
    client_mock.expect(:ask, response_mock, [ String ])

    RubyLLM.stub(:chat, client_mock) do
      yield
      client_mock.verify
      response_mock.verify
    end
  end
end

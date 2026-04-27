require "json"

class AnalyzeTranscriptJob < ApplicationJob
  queue_as :default

  def perform(recording_id, user_id)
    recording = Recording.find(recording_id)
    raise "Unauthorized" unless recording.user.id == user_id

    session = recording.recording_session

    client = RubyLLM.chat # gpt-4.1-nano
    response = client.with_instructions(system_prompt).ask(build_user_message(recording, session))
    llm_data = parse_llm_json(response.content)

    report = recording.create_report!(
      llm_raw_response: llm_data,
      summary: llm_data["overall"],
      focus_feedbacks: llm_data.except("overall", "meta")
    )

    GenerateReportPdfJob.perform_later(report.id)
    session.completed!
  rescue StandardError => e
    Recording.find_by(id: recording_id)&.recording_session&.failed!
    raise e
  end

  private

  def build_user_message(recording, session)
    <<~MSG
      INPUTS:
      - Transcript: #{recording.transcript}
      - context.type: #{session.presentation_type}
      - context.audience: #{session.audience}
      - context.duration_seconds: #{recording.duration_seconds}
      - context.focus: #{session.focus.empty? ? [] : session.focus.join(', ')}
    MSG
  end

  def parse_llm_json(content)
    JSON.parse(content)
  rescue JSON::ParserError
    # Strip markdown fences if present, then extract the outermost {...}
    cleaned = content.gsub(/\A```(?:json)?\s*/i, "").gsub(/\s*```\z/, "").strip
    match = cleaned.match(/\{.+\}/m)
    raise "Could not extract JSON from LLM response" unless match

    JSON.parse(match[0])
  end

  def system_prompt
    file_path = Rails.root.join("lib", "2_voxify_system_prompt.txt")
    File.read(file_path)
  end
end

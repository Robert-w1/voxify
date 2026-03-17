# Anthropic API Setup
# ====================
# No local installation needed — Anthropic is a cloud API.
#
# 1. Sign up at https://console.anthropic.com and create an API key
# 2. Add to your .env file:
#      ANTHROPIC_API_KEY=your_key_here

require "json"

class AnalyzeTranscriptJob < ApplicationJob
  queue_as :default

  def perform(recording_id, user_id)
    recording = Recording.find(recording_id)
    raise "Unauthorized" unless recording.user.id == user_id

    session = recording.recording_session

    # --- Start: Use of Anthropic API
    # client = Anthropic::Client.new(api_key: ENV.fetch("ANTHROPIC_API_KEY"))

    # response = client.messages.create(
    #   model:      "claude-sonnet-4-6",
    #   max_tokens: 4096,
    #   system:     SYSTEM_PROMPT,
    #   messages: [
    #     { role: "user", content: build_user_message(recording, session) }
    #   ]
    # )

    # recording.create_report!(llm_raw_response: response.content.first.text)
    # --- End: Use of Anthropic API

    # --- Start: Use of Github API
    client = RubyLLM.chat
    response = client.with_instructions(system_prompt).ask(build_user_message(recording, session))

    recording.create_report!(
      llm_raw_response: JSON.parse(response.content),
      # Placeholders
      summary: {
        overall_score: 72,
        strengths: ["Placeholder strength 1", "Placeholder strength 2"],
        improvements: ["Placeholder improvement 1", "Placeholder improvement 2"],
        overall_feedback: "Placeholder overall feedback"
      },
      focus_feedbacks: { feedback: "This is placeholder focus feedback" }
      )
    # --- End: Use of Github API
    session.completed!
  rescue => e
    Recording.find_by(id: recording_id)&.recording_session&.failed!
    raise e
  end

  private
  # TODO add word-level timing to the prompt
  # Word-level timing (word, start_sec, end_sec): #{recording.transcript_words.map { |w| "#{w["word"]} #{w["start"]} #{w["end"]}" }.join("\n")}

  def build_user_message(recording, session)
    <<~MSG
      INPUTS:
      - Transcript: #{recording.transcript}
      - context.type: #{session.presentation_type}
      - context.audience: #{session.audience}
      - context.duration_seconds: #{recording.duration_seconds}
      - context.focus: #{ session.focus.empty? ? [] : session.focus.join(", ")}
    MSG
  end

  def system_prompt
    file_path = Rails.root.join("lib", "voxify_system_prompt.txt")
    File.read(file_path)
  end
end

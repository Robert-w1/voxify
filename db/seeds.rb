# db/seeds.rb
# ===========================================================================
# Voxify Seed Data
# Run with: rails db:seed
# Reset and reseed: rails db:seed:replant  (Rails 6+)
# ===========================================================================

puts "🧹 Clearing existing data..."
Report.destroy_all
Recording.destroy_all
RecordingSession.destroy_all
# Folder.destroy_all
User.destroy_all

puts "👤 Creating users..."

alice = User.create!(
  email: "alice@example.com",
  password: "password123",
  username: "alice_presenter"
)

bob = User.create!(
  email: "bob@example.com",
  password: "password123",
  username: "bob_pitches"
)

# puts "📁 Creating folders..."

# # Alice's folders
# work_folder      = alice.folders.create!(name: "Work Presentations")
# investor_folder  = alice.folders.create!(name: "Investor Pitches")
# practice_folder  = alice.folders.create!(name: "Practice Sessions")

# # Bob's folders
# sales_folder     = bob.folders.create!(name: "Sales Pitches")
# team_folder      = bob.folders.create!(name: "Team Updates")

puts "🎙️ Creating recording sessions and recordings..."

# ---------------------------------------------------------------------------
# Helper: build a realistic transcript snippet
# ---------------------------------------------------------------------------
TRANSCRIPTS = [
  "Good morning everyone. Today I'd like to walk you through our Q3 results and what we're planning for the next quarter. Um, so first let's look at revenue. We grew by about, uh, fifteen percent quarter over quarter which is, you know, really exciting for the team.",
  "Thanks for having me. So the core idea behind our product is pretty simple. We help sales teams close deals faster by, like, automating the follow-up process. Um, we've seen customers reduce their sales cycle by up to thirty percent.",
  "Alright team, quick update on where we are with the product roadmap. So basically we finished the authentication epic last sprint, and this week we're moving into the recording flow. Uh, there are a few blockers I want to flag.",
  "Hi, I'm here to talk about the future of machine learning in healthcare. Uh, it's a really fascinating space, and I think there's a lot of, you know, untapped potential. Let me start by sharing some statistics.",
  "Welcome everyone. I'll keep this brief. Um, the main ask today is budget approval for the new infrastructure upgrade. We're looking at roughly fifty thousand dollars over two quarters.",
].freeze

SUMMARY_TEMPLATES = [
  {
    overall_score: 72,
    strengths: ["Clear structure", "Good use of data", "Confident delivery"],
    improvements: ["Reduce filler words", "Vary pace more", "Stronger closing statement"],
    overall_feedback: "A solid presentation with clear structure. Focus on eliminating filler words and building a stronger conclusion to leave a lasting impression."
  },
  {
    overall_score: 85,
    strengths: ["Engaging storytelling", "Strong opening hook", "Appropriate vocabulary for audience"],
    improvements: ["Slightly too fast in the middle section", "Could add more pauses for emphasis"],
    overall_feedback: "Excellent delivery overall. The narrative arc was compelling and well-suited to the audience. Minor pacing adjustments would make this near-perfect."
  },
  {
    overall_score: 61,
    strengths: ["Good energy", "Relevant examples"],
    improvements: ["High filler word count", "Unclear call to action", "Tone inconsistent in places"],
    overall_feedback: "The enthusiasm came through clearly, but the message was diluted by frequent filler words. Work on sharpening your key message and practicing a clean close."
  }
].freeze

FOCUS_FEEDBACK_POOL = {
  filler_words:    "You used filler words (um, uh, like, you know) approximately 14 times during this 3-minute recording. This is above average. Try replacing pauses with a brief silence — it sounds far more confident to listeners.",
  tone:            "Your tone was generally warm and approachable, well-suited to the audience. There were a few moments mid-section where your tone became slightly flat. Try to vary your emotional register to keep listeners engaged.",
  pace:            "Your average pace was around 165 words per minute, which is slightly fast. The ideal range for presentations is 130–150 wpm. Slowing down at key points will give your audience time to absorb important information.",
  clarity:         "Your articulation was clear for most of the session. A few technical terms were rushed and may have been unclear to a non-specialist audience. Consider pausing briefly after introducing new concepts.",
  confidence:      "You sounded confident in the opening and closing sections. The middle section showed some hesitation — likely due to the increased use of fillers and trailing sentences. Strong, complete sentences will project more authority.",
  vocabulary:      "Your vocabulary was appropriate for the audience level. You avoided unnecessary jargon while still sounding credible. One area to improve: replacing vague words like 'basically' and 'kind of' with more precise language.",
  conciseness:     "Several points were repeated or over-explained. Aim to make each point once, clearly, and move on. Trimming roughly 15% of the content would make the presentation feel tighter and more impactful.",
  engagement:      "You asked one rhetorical question, which was effective. Consider adding 1–2 more interactive moments — even a brief pause to let the audience reflect can significantly increase perceived engagement.",
  storytelling:    "You included a brief anecdote which was a highlight of the session. Building more of the presentation around a narrative arc (problem → journey → resolution) would strengthen the emotional connection with your audience.",
  technical_depth: "The level of technical detail was well-calibrated for your stated audience. You successfully explained complex concepts without over-simplifying. Consider adding one concrete technical example to anchor the key claim."
}.freeze

# # ---------------------------------------------------------------------------
# # Helper to pick random subset of focus options
# # ---------------------------------------------------------------------------
# def random_focus(min: 2, max: 4)
#   RecordingSession::FEEDBACK_FOCUS_OPTIONS.sample(rand(min..max))
# end

# ---------------------------------------------------------------------------
# Session builder
# ---------------------------------------------------------------------------
def build_session(user:, status:, title:, audience:, presentation_type:, focus:,
                  transcript: nil, duration: nil)
  session = user.recording_sessions.create!(
    # folder:            folder,
    title:             title,
    audience:          audience,
    presentation_type: presentation_type,
    focus:             focus,
    status:            status
  )

  return session unless %w[processing completed failed].include?(status)

  recording = session.recordings.create!(
    audio_url:        "https://res.cloudinary.com/demo/video/upload/sample_audio.mp3",
    transcript:       transcript || TRANSCRIPTS.sample,
    duration_seconds: duration || rand(90..360)
  )

  return session unless status == "completed"

  summary_data   = SUMMARY_TEMPLATES.sample
  focus_feedbacks = focus.index_with { |f| FOCUS_FEEDBACK_POOL[f.to_sym] }.compact

  recording.create_report!(
    summary:          summary_data,
    focus_feedbacks:  focus_feedbacks,
    pdf_url:          "https://res.cloudinary.com/demo/raw/upload/sample_report.pdf",
    llm_raw_response: {
      model:        "claude-3-5-sonnet-20241022",
      generated_at: Time.current.iso8601,
      raw:          "{ \"summary\": #{summary_data.to_json}, \"focus_feedbacks\": #{focus_feedbacks.to_json} }"
    }
  )

  session
end

# ---------------------------------------------------------------------------
# Alice's sessions
# ---------------------------------------------------------------------------

# Completed sessions
build_session(
  user:              alice,
  # folder:            investor_folder,
  status:            "completed",
  title:             "Series A Pitch — Accel Partners",
  audience:          "vcs",
  presentation_type: "investor_pitch",
  focus:             %w[confidence storytelling tone],
  transcript:        TRANSCRIPTS[1],
  duration:          245
)

build_session(
  user:              alice,
  # folder:            work_folder,
  status:            "completed",
  title:             "Q3 Board Review",
  audience:          "board",
  presentation_type: "all_hands",
  focus:             %w[clarity conciseness pace],
  transcript:        TRANSCRIPTS[0],
  duration:          312
)

build_session(
  user:              alice,
  # folder:            work_folder,
  status:            "completed",
  title:             "Product Demo — Enterprise Clients",
  audience:          "clients",
  presentation_type: "product_demo",
  focus:             %w[engagement vocabulary filler_words],
  transcript:        TRANSCRIPTS[3],
  duration:          198
)

build_session(
  user:              alice,
  # folder:            practice_folder,
  status:            "completed",
  title:             "Conference Talk Rehearsal",
  audience:          "conference",
  presentation_type: "conference_talk",
  focus:             %w[storytelling technical_depth pace],
  transcript:        TRANSCRIPTS[3],
  duration:          420
)

# Processing session (job in progress)
build_session(
  user:              alice,
  # folder:            investor_folder,
  status:            "processing",
  title:             "Seed Round Pitch — Y Combinator",
  audience:          "vcs",
  presentation_type: "investor_pitch",
  focus:             %w[confidence tone filler_words],
  transcript:        TRANSCRIPTS[0],
  duration:          180
)

# Failed session
build_session(
  user:              alice,
  # folder:            practice_folder,
  status:            "failed",
  title:             "Untitled",
  audience:          "colleagues",
  presentation_type: "team_update",
  focus:             %w[clarity pace],
  transcript:        nil,
  duration:          nil
)

# Recording (just started, no audio yet)
alice.recording_sessions.create!(
  # folder:            nil,
  title:             "Untitled",
  audience:          "manager",
  presentation_type: "manager_1on1",
  focus:             %w[conciseness tone],
  status:            "recording"
)

# ---------------------------------------------------------------------------
# Bob's sessions
# ---------------------------------------------------------------------------

build_session(
  user:              bob,
  # folder:            sales_folder,
  status:            "completed",
  title:             "SaaS Sales Pitch — Mid-Market",
  audience:          "clients",
  presentation_type: "sales_pitch",
  focus:             %w[engagement confidence filler_words storytelling],
  transcript:        TRANSCRIPTS[1],
  duration:          275
)

build_session(
  user:              bob,
  # folder:            team_folder,
  status:            "completed",
  title:             "Sprint Review — Engineering",
  audience:          "colleagues",
  presentation_type: "team_update",
  focus:             %w[clarity conciseness],
  transcript:        TRANSCRIPTS[2],
  duration:          165
)

build_session(
  user:              bob,
  # folder:            sales_folder,
  status:            "completed",
  title:             "Enterprise Demo — ACME Corp",
  audience:          "executives",
  presentation_type: "product_demo",
  focus:             %w[tone vocabulary technical_depth],
  transcript:        TRANSCRIPTS[4],
  duration:          303
)

build_session(
  user:              bob,
  # folder:            nil,
  status:            "processing",
  title:             "Untitled",
  audience:          "general_public",
  presentation_type: "workshop",
  focus:             %w[pace engagement storytelling],
  transcript:        TRANSCRIPTS[3],
  duration:          390
)

puts ""
puts "✅ Seed complete!"
puts ""
puts "  Users:"
puts "    alice@example.com  / password123  (#{alice.recording_sessions.count} sessions)"
puts "    bob@example.com    / password123  (#{bob.recording_sessions.count} sessions)"
puts ""
puts "  Totals:"
# puts "    Folders:           #{Folder.count}"
puts "    RecordingSessions: #{RecordingSession.count} (#{RecordingSession.where(status: :completed).count} completed)"
puts "    Recordings:        #{Recording.count}"
puts "    Reports:           #{Report.count}"

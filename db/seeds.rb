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
  "Hi, I'm here to talk about the future of machine learning in healthcare. Uh, it's a really fascinating spacing, and I think there's a lot of, you know, untapped potential. Let me start by sharing some statistics.",
  "Welcome everyone. I'll keep this brief. Um, the main ask today is budget approval for the new infrastructure upgrade. We're looking at roughly fifty thousand dollars over two quarters.",
].freeze

SUMMARY_TEMPLATES = [
  "A solid presentation with clear structure and good use of data. Your confident delivery made the content feel trustworthy. Focus on eliminating filler words and building a stronger conclusion to leave a lasting impression on your audience.",
  "Excellent delivery overall. The narrative arc was compelling and well-suited to the audience. Your opening hook was particularly strong. Minor pacing adjustments in the middle section would make this near-perfect.",
  "The enthusiasm came through clearly, but the message was diluted by frequent filler words and an unclear call to action. Work on sharpening your key message and practicing a clean, memorable close."
].freeze

FOCUS_FEEDBACK_POOL = {
  filler_words: {
    score: 58,
    feedback: "You used filler words (um, uh, like, you know) approximately 14 times. This is above average. Try replacing pauses with a brief silence — it sounds far more confident to listeners.",
    details: { count: 14, words: [ { word: "um", count: 6 }, { word: "uh", count: 4 }, { word: "like", count: 3 }, { word: "you know", count: 1 } ] }
  },
  tone: {
    score: 76,
    feedback: "Your tone was generally warm and approachable, well-suited to the audience. There were a few moments mid-section where your tone became slightly flat. Vary your emotional register to keep listeners engaged.",
    details: {}
  },
  pacing: {
    score: 70,
    feedback: "Your average pacing was around 165 words per minute, which is slightly fast. The ideal range for presentations is 130–150 wpm. Slowing down at key points gives your audience time to absorb information.",
    details: { wpm: 165 }
  },
  clarity: {
    score: 82,
    feedback: "Your articulation was clear for most of the session. A few technical terms were rushed and may have been unclear to a non-specialist audience. Pause briefly after introducing new concepts.",
    details: {}
  },
  confidence: {
    score: 74,
    feedback: "You sounded confident in the opening and closing sections. The middle section showed some hesitation. Strong, complete sentences and fewer trailing thoughts will project more authority.",
    details: {}
  },
  vocabulary: {
    score: 80,
    feedback: "Your vocabulary was appropriate for the audience level. You avoided unnecessary jargon while still sounding credible. Replace vague words like 'basically' and 'kind of' with more precise language.",
    details: {}
  },
  conciseness: {
    score: 65,
    feedback: "Several points were repeated or over-explained. Aim to make each point once, clearly, and move on. Trimming roughly 15% of the content would make the presentation feel tighter and more impactful.",
    details: {}
  },
  engagement: {
    score: 78,
    feedback: "You asked one rhetorical question, which was effective. Consider adding 1–2 more interactive moments — even a brief pause to let the audience reflect can significantly increase perceived engagement.",
    details: {}
  },
  storytelling: {
    score: 83,
    feedback: "You included a brief anecdote which was a highlight of the session. Building more of the presentation around a narrative arc (problem → journey → resolution) would strengthen the emotional connection.",
    details: {}
  },
  technical_depth: {
    score: 88,
    feedback: "The level of technical detail was well-calibrated for your stated audience. You explained complex concepts without over-simplifying. Consider adding one concrete technical example to anchor the key claim.",
    details: {}
  }
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
    duration_seconds: duration || rand(10..30)
  )

  return session unless status == "completed"

  summary_text    = SUMMARY_TEMPLATES.sample
  focus_feedbacks = focus.index_with { |f| FOCUS_FEEDBACK_POOL[f.to_sym] }.compact
  scores          = focus_feedbacks.values.map { |v| v[:score] }
  overall_score   = scores.any? ? (scores.sum.to_f / scores.size).round : 70
  wpm             = rand(130..175)
  filler_count    = focus_feedbacks.key?(:filler_words) ? focus_feedbacks[:filler_words][:details][:count] : rand(3..10)

  report = recording.create_report!(
    summary:          summary_text,
    focus_feedbacks:  focus_feedbacks.transform_keys(&:to_s).transform_values { |v| v.transform_keys(&:to_s) },
    llm_raw_response: {
      "overall_score"      => overall_score,
      "transcript_excerpt" => (recording.transcript || "").split.first(50).join(" "),
      "metrics"            => { "words_per_minute" => wpm, "filler_word_count" => filler_count }
    }
  )

  begin
    GenerateReportPdfJob.perform_now(report.id)
    puts "  ✅ PDF generated for: #{session.title}"
  rescue => e
    puts "  ⚠️  PDF generation skipped for '#{session.title}': #{e.message}"
  end

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
  audience:          "investors",
  presentation_type: "investor_pitch",
  focus:             %w[confidence storytelling tone],
  transcript:        TRANSCRIPTS[1],
  duration:          24
)

build_session(
  user:              alice,
  # folder:            work_folder,
  status:            "completed",
  title:             "Q3 Board Review",
  audience:          "board",
  presentation_type: "all_hands",
  focus:             %w[clarity conciseness pacing],
  transcript:        TRANSCRIPTS[0],
  duration:          12
)

build_session(
  user:              alice,
  # folder:            work_folder,
  status:            "completed",
  title:             "Product Demo — Enterprise Clients",
  audience:          "clients",
  presentation_type: "daily_practice",
  focus:             %w[engagement vocabulary filler_words],
  transcript:        TRANSCRIPTS[3],
  duration:          19
)

build_session(
  user:              alice,
  # folder:            practice_folder,
  status:            "completed",
  title:             "Conference Talk Rehearsal",
  audience:          "conference",
  presentation_type: "conference_talk",
  focus:             %w[storytelling technical_depth pacing],
  transcript:        TRANSCRIPTS[3],
  duration:          20
)

# Processing session (job in progress)
build_session(
  user:              alice,
  # folder:            investor_folder,
  status:            "processing",
  title:             "Seed Round Pitch — Y Combinator",
  audience:          "investors",
  presentation_type: "investor_pitch",
  focus:             %w[confidence tone filler_words],
  transcript:        TRANSCRIPTS[0],
  duration:          30
)

# Failed session
build_session(
  user:              alice,
  # folder:            practice_folder,
  status:            "failed",
  title:             "Untitled",
  audience:          "colleagues",
  presentation_type: "team_update",
  focus:             %w[clarity pacing],
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
  duration:          27
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
  duration:          16
)

build_session(
  user:              bob,
  # folder:            sales_folder,
  status:            "completed",
  title:             "Enterprise Demo — ACME Corp",
  audience:          "executives",
  presentation_type: "daily_practice",
  focus:             %w[tone vocabulary technical_depth],
  transcript:        TRANSCRIPTS[4],
  duration:          30
)

build_session(
  user:              bob,
  # folder:            nil,
  status:            "processing",
  title:             "Untitled",
  audience:          "general_public",
  presentation_type: "conference_talk",
  focus:             %w[pacing engagement storytelling],
  transcript:        TRANSCRIPTS[3],
  duration:          19
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

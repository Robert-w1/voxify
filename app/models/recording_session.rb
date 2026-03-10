class RecordingSession < ApplicationRecord
  belongs_to :user
  belongs_to :folder, optional: true

  has_many :recordings, dependent: :destroy
  has_many :reports, through: :recordings

  AUDIENCE_OPTIONS = %w[
    vcs
    investors
    board
    executives
    manager
    colleagues
    clients
    students
    general_public
    conference
  ].freeze

  PRESENTATION_TYPE_OPTIONS = %w[
    investor_pitch
    product_demo
    sales_pitch
    manager_1on1
    team_update
    all_hands
    conference_talk
    workshop
    job_interview
    casual_chat
  ].freeze

    FEEDBACK_FOCUS_OPTIONS = %w[
    filler_words
    tone
    pace
    clarity
    confidence
    vocabulary
    conciseness
    engagement
    storytelling
    technical_depth
  ].freeze

  enum :status, {
    recording: "recording",
    processing: "processing",
    completed: "completed",
    failed: "failed"
  }

  validates :user, presence: true
  validates :title, presence: true
  validates :audience, presence: true, inclusion: { in: AUDIENCE_OPTIONS }
  validates :presentation_type, presence: true, inclusion: { in: PRESENTATION_TYPE_OPTIONS }
  validates :focus, presence: true
  validates :status, presence: true
end

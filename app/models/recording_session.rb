class RecordingSession < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search_by_title,
    against: { title: "A" },
    using: { tsearch: { prefix: true } }

  belongs_to :user
  belongs_to :folder, optional: true

  before_validation :set_default_title, on: :create

  has_many :recordings, dependent: :destroy
  has_many :reports, through: :recordings

  AUDIENCE_OPTIONS = %w[
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
    presentation
    job_interview
    sales_pitch
    daily_practice
    casual_chat
    manager_1on1
    team_update
    conference_talk
  ].freeze

  #   FEEDBACK_FOCUS_OPTIONS = %w[
  #   filler_words
  #   tone
  #   pace
  #   clarity
  #   confidence
  #   vocabulary
  #   conciseness
  #   engagement
  #   storytelling
  # ].freeze
  FEEDBACK_FOCUS_OPTIONS = %w[
    filler_words
    tone
    pacing
    clarity
    confidence
    vocabulary
    conciseness
    engagement
    storytelling
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
  validates :status, presence: true

  private

  def set_default_title
  self.title ||= "#{presentation_type&.titleize} - #{Time.current.strftime('%b %d, %Y %I:%M %p')}"
  end
end

class Recording < ApplicationRecord
  belongs_to :recording_session

  has_one :report, dependent: :destroy

  has_one_attached :audio, service: :local

  delegate :user, to: :recording_session

  validates :recording_session, presence: true
  validates :duration_seconds, numericality: { greater_than: 0, less_than_or_equal_to: 30 }, allow_nil: true
end

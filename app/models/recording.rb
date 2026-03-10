class Recording < ApplicationRecord
  belongs_to :recording_session

  has_one :report, dependent: :destroy

  validates :recording_sessions, presence: true
  validates :audio_url, presence: true
end

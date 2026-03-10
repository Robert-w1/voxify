class RecordingSession < ApplicationRecord
  belongs_to :user

  has_many :recordings, dependent: :destroy

  has_many :folder_sessions, dependent: :destroy
  has_many :folders, through: :folder_sessions

  validates :user, presence: true
  validates :title, presence: true
end

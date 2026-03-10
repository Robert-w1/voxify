class Folder < ApplicationRecord
  belongs_to :user

  has_many :folder_sessions, dependent: :destroy
  has_many :recording_sessions, through: :folder_sessions

  validates :name, presence: true
end

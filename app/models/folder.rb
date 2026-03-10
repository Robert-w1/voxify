class Folder < ApplicationRecord
  belongs_to :user

  has_many :recording_sessions, dependent: :nullify

  validates :name, presence: true
  validates :name, uniqueness: { scope: :user_id, message: "already exists" }
end

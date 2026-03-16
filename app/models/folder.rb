class Folder < ApplicationRecord
  include PgSearch::Model

  pg_search_scope :search_by_name,
    against: { name: "A", description: "B" },
    using: { tsearch: { prefix: true } }

  belongs_to :user

  has_many :recording_sessions, dependent: :nullify

  validates :name, presence: true
  validates :name, uniqueness: { scope: :user_id, message: "already exists" }
end

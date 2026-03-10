class Report < ApplicationRecord
  belongs_to :recording

  validates :recording, presence: true
end

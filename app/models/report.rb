class Report < ApplicationRecord
  belongs_to :recording
  has_one :recording_session, through: :recording
  has_one_attached :pdf_file, service: :cloudinary

  validates :summary, presence: true
  validates :focus_feedbacks, presence: true
end

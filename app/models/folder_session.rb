class FolderSession < ApplicationRecord
  belongs_to :recording_session
  belongs_to :folder

  validates :folder_id, uniqueness: { scope: :recording_session_id }
end

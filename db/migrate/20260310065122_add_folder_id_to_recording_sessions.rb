class AddFolderIdToRecordingSessions < ActiveRecord::Migration[7.1]
  def change
    add_column :recording_sessions, :folder_id, :bigint
    add_index :recording_sessions, :folder_id
    add_foreign_key :recording_sessions, :folders
  end
end

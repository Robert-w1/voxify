class DropFolderSessions < ActiveRecord::Migration[7.1]
  def change
    drop_table :folder_sessions
  end
end

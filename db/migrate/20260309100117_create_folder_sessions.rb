class CreateFolderSessions < ActiveRecord::Migration[7.1]
  def change
    create_table :folder_sessions do |t|
      t.references :recording_session, null: false, foreign_key: true
      t.references :folder, null: false, foreign_key: true

      t.timestamps
    end
  end
end

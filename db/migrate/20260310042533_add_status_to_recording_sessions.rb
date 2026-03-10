class AddStatusToRecordingSessions < ActiveRecord::Migration[7.1]
  def change
    add_column :recording_sessions, :status, :string
  end
end

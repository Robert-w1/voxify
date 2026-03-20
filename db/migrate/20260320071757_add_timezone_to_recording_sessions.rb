class AddTimezoneToRecordingSessions < ActiveRecord::Migration[7.1]
  def change
    add_column :recording_sessions, :timezone, :string
  end
end

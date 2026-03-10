class ChangeFocusToArrayInRecordingSessions < ActiveRecord::Migration[7.1]
  def change
    remove_column :recording_sessions, :focus
    add_column :recording_sessions, :focus, :string, array: true, default: []
  end
end

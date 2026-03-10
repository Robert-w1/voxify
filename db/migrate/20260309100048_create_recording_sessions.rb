class CreateRecordingSessions < ActiveRecord::Migration[7.1]
  def change
    create_table :recording_sessions do |t|
      t.string :title
      t.string :audience
      t.string :presentation_type
      t.jsonb :focus
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end

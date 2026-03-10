class CreateRecordings < ActiveRecord::Migration[7.1]
  def change
    create_table :recordings do |t|
      t.string :audio_url
      t.text :transcript
      t.integer :duration_seconds
      t.references :recording_session, null: false, foreign_key: true

      t.timestamps
    end
  end
end

class AddTranscriptWordsToRecordings < ActiveRecord::Migration[7.1]
  def change
    add_column :recordings, :transcript_words, :jsonb
  end
end

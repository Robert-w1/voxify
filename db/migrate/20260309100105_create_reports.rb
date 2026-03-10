class CreateReports < ActiveRecord::Migration[7.1]
  def change
    create_table :reports do |t|
      t.references :recording, null: false, foreign_key: true
      t.jsonb :summary
      t.string :pdf_url
      t.jsonb :llm_raw_response
      t.jsonb :focus_feedbacks

      t.timestamps
    end
  end
end

class RemovePdfUrlFromReports < ActiveRecord::Migration[7.1]
  def change
    remove_column :reports, :pdf_url, :string
  end
end

class AddDescriptionToFolders < ActiveRecord::Migration[7.1]
  def change
    add_column :folders, :description, :text
  end
end

# db/seeds.rb

Rails.logger.debug "🧹 Clearing existing data..."
Report.destroy_all
Recording.destroy_all
RecordingSession.destroy_all
User.destroy_all

Rails.logger.debug "👤 Creating users..."

User.create!(
  email: "alice@example.com",
  password: "password123",
  username: "alice_presenter"
)

User.create!(
  email: "bob@example.com",
  password: "password123",
  username: "bob_pitches"
)

Rails.logger.debug ""
Rails.logger.debug "✅ Seed complete!"
Rails.logger.debug ""
Rails.logger.debug "  Users:"
Rails.logger.debug "    alice@example.com  / password123"
Rails.logger.debug "    bob@example.com    / password123"
Rails.logger.debug ""

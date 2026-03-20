# db/seeds.rb

puts "🧹 Clearing existing data..."
Report.destroy_all
Recording.destroy_all
RecordingSession.destroy_all
User.destroy_all

puts "👤 Creating users..."

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

puts ""
puts "✅ Seed complete!"
puts ""
puts "  Users:"
puts "    alice@example.com  / password123"
puts "    bob@example.com    / password123"
puts ""

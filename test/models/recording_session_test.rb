require "test_helper"

class RecordingSessionTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
  end

  def new_session(presentation_type: "presentation", title: nil)
    RecordingSession.new(
      user: @user,
      audience: "colleagues",
      presentation_type: presentation_type,
      status: "recording",
      focus: [ "clarity" ],
      title: title
    )
  end

  test "generates title from presentation_type and current date when none given" do
    travel_to Time.zone.local(2026, 4, 7) do
      session = new_session
      session.valid?
      assert_equal "Presentation - 7 April 2026", session.title
    end
  end

  test "replaces 1on1 with 1-on-1 in generated title" do
    travel_to Time.zone.local(2026, 4, 25) do
      session = new_session(presentation_type: "manager_1on1")
      session.valid?
      assert_equal "Manager 1-on-1 - 25 April 2026", session.title
    end
  end

  test "does not overwrite a title that was already provided" do
    session = new_session(title: "My Custom Title")
    session.valid?
    assert_equal "My Custom Title", session.title
  end

  test "day in generated title has no leading zero" do
    travel_to Time.zone.local(2026, 4, 7) do
      session = new_session
      session.valid?
      assert_match(/- 7 April/, session.title)
      refute_match(/- 07 April/, session.title)
    end
  end

  test "does not change title on update" do
    session = new_session
    session.save!
    original_title = session.title

    travel_to Time.zone.local(2099, 12, 31) do
      session.update!(audience: "board")
    end

    assert_equal original_title, session.title
  end
end

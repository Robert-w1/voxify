require "test_helper"

class RecordingSessionsControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @user = users(:one)
    @session = recording_sessions(:one)
    sign_in @user
  end

  # create

  test "create redirects to session show page on success" do
    post recording_sessions_path, params: {
      recording_session: { audience: "colleagues", presentation_type: "presentation", focus: ["clarity"] }
    }

    new_session = RecordingSession.last

    assert_redirected_to recording_session_path(new_session, source: "new")
  end

  test "create re-renders new with 422 on invalid params" do
    post recording_sessions_path, params: {
      recording_session: { audience: "not_a_valid_audience", presentation_type: "presentation", focus: ["clarity"] }
    }

    assert_response :unprocessable_content
  end

  # report_status

  test "report_status returns completed when session is done and has a report" do
    get report_status_recording_session_path(recording_sessions(:completed)), as: :json

    assert_response :success
    body = response.parsed_body

    assert_equal "completed", body["status"]
    assert_predicate body["report"], :present?
    assert_equal 85, body["report"]["overall_score"]
  end

  test "report_status returns failed when session has failed" do
    get report_status_recording_session_path(recording_sessions(:failed)), as: :json

    assert_response :success
    assert_equal "failed", response.parsed_body["status"]
  end

  test "report_status returns processing when session is still processing" do
    get report_status_recording_session_path(recording_sessions(:processing)), as: :json

    assert_response :success
    assert_equal "processing", response.parsed_body["status"]
  end

  test "report_status returns failed when session is completed but has no report" do
    get report_status_recording_session_path(recording_sessions(:completed_no_report)), as: :json

    assert_response :success
    assert_equal "failed", response.parsed_body["status"]
  end

  # update

  test "update returns ok true on success" do
    patch recording_session_path(@session),
          params: { recording_session: { title: "New Title" } },
          as: :json

    assert_response :success
    assert_equal true, response.parsed_body["ok"]
    assert_equal "New Title", @session.reload.title
  end

  test "update returns ok false with errors when title is blank" do
    patch recording_session_path(@session),
          params: { recording_session: { title: "" } },
          as: :json

    assert_response :unprocessable_content
    body = response.parsed_body

    assert_equal false, body["ok"]
    assert_predicate body["errors"], :present?
  end

  # update_folder

  test "update_folder assigns own folder to session" do
    patch update_folder_recording_session_path(@session),
          params: { folder_id: folders(:one).id }

    assert_equal folders(:one).id, @session.reload.folder_id
  end

  test "update_folder clears folder when no folder_id given" do
    @session.update!(folder_id: folders(:one).id)

    patch update_folder_recording_session_path(@session), params: {}

    assert_nil @session.reload.folder_id
  end

  test "update_folder rejects folder belonging to another user" do
    patch update_folder_recording_session_path(@session),
          params: { folder_id: folders(:other).id }

    assert_nil @session.reload.folder_id
  end

  # destroy

  test "destroy from show page redirects to sessions index" do
    delete recording_session_path(@session),
           headers: { "HTTP_REFERER" => recording_session_url(@session) }

    assert_redirected_to recording_sessions_path
    assert_raises(ActiveRecord::RecordNotFound) { @session.reload }
  end

  test "destroy from another page redirects to sessions index" do
    delete recording_session_path(@session),
           headers: { "HTTP_REFERER" => recording_sessions_url }

    assert_redirected_to recording_sessions_path
    assert_raises(ActiveRecord::RecordNotFound) { @session.reload }
  end

  # index JSON search

  test "index JSON returns empty array for query shorter than 2 characters" do
    get recording_sessions_path, params: { q: "a" }, as: :json

    assert_response :success
    assert_equal [], response.parsed_body
  end

  test "index JSON returns sessions matching query with expected shape" do
    get recording_sessions_path, params: { q: "Completed" }, as: :json

    assert_response :success
    results = response.parsed_body

    assert_predicate results, :any?
    result = results.first

    assert_equal "session", result["type"]
    assert_predicate result["label"], :present?
    assert_predicate result["url"], :present?
    assert_predicate result["created_at"], :present?
  end

  # download_pdf

  test "download_pdf redirects with alert when PDF is not attached" do
    get download_pdf_recording_session_path(recording_sessions(:completed))

    assert_redirected_to recording_session_path(recording_sessions(:completed))
    assert_equal "PDF not available", flash[:alert]
  end
end

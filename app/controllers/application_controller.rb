class ApplicationController < ActionController::Base
  before_action :authenticate_user!
  before_action :configure_permitted_parameters, if: :devise_controller?
  # Call enable_sidebar as a before_action in any controller that renders an authenticated layout
  # It sets @show_sidebar = true which application.html.erb reads
  helper_method :show_sidebar?
  before_action :set_sidebar_data

  def configure_permitted_parameters
    # For additional fields in app/views/devise/registrations/new.html.erb
    devise_parameter_sanitizer.permit(:sign_up, keys: [:username])

    # For additional in app/views/devise/registrations/edit.html.erb
    devise_parameter_sanitizer.permit(:account_update, keys: [:username])
  end

  def after_sign_in_path_for(resource)
    new_recording_session_path
  end

  private

  def enable_sidebar
    @show_sidebar = true
  end

  def show_sidebar?
    @show_sidebar
  end

  def set_sidebar_data
    return unless user_signed_in?

    @recent_sessions = current_user.recording_sessions.order(created_at: :desc).limit(10)
  end

end

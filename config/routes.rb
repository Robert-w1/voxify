Rails.application.routes.draw do
  devise_for :users
  root to: "pages#home"

  resources :folders

  resources :recording_sessions, path: "sessions" do
    resources :recordings, only: [:create]
    member do
      get :download_pdf
      get :pdf_status
      get :report_status
      patch :update_folder
    end
  end
end

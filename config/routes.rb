Rails.application.routes.draw do
  devise_for :users
  root to: "pages#home"

  resources :folders

  resources :recording_sessions, path: "sessions" do
    resources :recordings, only: [:create]
    resources :reports, only: [:show]
    member do
      get :download_pdf
      patch :update_folder
    end
  end
end

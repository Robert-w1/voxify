Rails.application.routes.draw do
  root "home#index"

  devise_for :users

  resources :recording_sessions, path: "sessions" do
    resources :recordings, only: [:create]
    resources :reports, only: [:show]
  end
end

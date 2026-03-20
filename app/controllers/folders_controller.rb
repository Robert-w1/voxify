class FoldersController < ApplicationController
  before_action :authenticate_user!
  before_action :enable_sidebar
  before_action :set_folder, only: [:show, :edit, :update, :destroy]

  def index
    @query = params[:q].to_s.strip
    @folders = if @query.present?
      current_user.folders.search_by_name(@query)
    else
      current_user.folders.order(created_at: :desc)
    end

    respond_to do |format|
      format.html
      format.json do
        q = @query
        return render json: [] if q.length < 2

        results = current_user.folders.search_by_name(q).limit(8).map do |f|
          { type: "folder", label: f.name, url: folder_path(f), created_at: f.created_at.iso8601 }
        end

        render json: results
      end
    end
  end

  def show
    @sessions = @folder.recording_sessions.order(created_at: :desc)
  end

  def new
    @folder = Folder.new
    @session_id = params[:session_id]
  end

  def create
    @folder = current_user.folders.build(folder_params)
    @session_id = params[:session_id]

    if @folder.save
      if @session_id.present?
        session_record = current_user.recording_sessions.find_by(id: @session_id)
        session_record&.update(folder_id: @folder.id)
      end
      redirect_to folder_path(@folder)
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit; end

  def update
    @folder.update(folder_params)
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to folders_path }
    end
  end

  def destroy
    @folder.destroy
    redirect_to folders_path
  end

  private

  def set_folder
    @folder = current_user.folders.find(params[:id])
  end

  def folder_params
    params.require(:folder).permit(:name, :description)
  end
end

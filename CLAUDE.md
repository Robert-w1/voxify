# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
bundle install
rails db:create db:migrate

# Development server
bin/dev                    # starts Rails + asset watchers via Procfile.dev

# Database
rails db:migrate
rails db:rollup            # rollback last migration
rails db:seed

# Tests
rails test                 # all tests
rails test test/models/recording_session_test.rb  # single file
rails test:system          # system tests (Capybara + Selenium)

# Rails console
rails console

# Asset pipeline (handled by bin/dev, but manually)
rails assets:precompile
```

## Architecture

### Domain Model
The core flow is: `RecordingSession` → `Recording` (audio file) → `Report` (AI feedback).

- **RecordingSession**: Configured with `presentation_type`, `audience`, and `focus` (array of strings). Has a `status` enum: `recording → processing → completed → failed`. Title auto-generated from type + timestamp if not provided.
- **Recording**: Holds the audio blob via Active Storage (`has_one_attached :audio`) and eventual `transcript`.
- **Report**: Stores AI output in JSONB columns — `summary`, `focus_feedbacks`, `llm_raw_response`.
- **Folder**: Optional grouping of sessions per user.

### Request Flow for Audio Upload
1. User visits `GET /sessions/:id` — the recording environment (`recording_sessions#show`)
2. Stimulus `recorder_controller` requests mic access on `connect()`, records WebM audio via MediaRecorder API
3. On stop, it POSTs `FormData` with the audio blob to `POST /sessions/:id/recordings`
4. `RecordingsController#create` attaches the file via Active Storage and returns `{ status: "ok" }`
5. The session ID is read from `data-session-id` on a DOM element in the show view

### Frontend
- **Importmap** (no Node/webpack): JS dependencies declared in `config/importmap.rb`
- **Stimulus controllers** live in `app/javascript/controllers/`
  - `recorder_controller.js` — microphone + MediaRecorder + upload
  - `session_form_controller.js` — validates new session form (requires type + audience + ≥1 focus)
- **Bootstrap 5.3** via gem; customized in `app/assets/stylesheets/`

### Authentication
Devise with a custom `username` field. `ApplicationController` whitelists `:username` in `configure_permitted_parameters`. All routes require authentication (enforced via `before_action :authenticate_user!` in ApplicationController). Sidebar always shows the 10 most recent `RecordingSession` records for the current user.

### Active Storage
Configured for local disk in development. Audio files are WebM blobs attached to `Recording` records.

### Key Conventions
- `RecordingSession` uses string-backed enums (not integer), e.g. `status: "recording"` stored in DB
- `focus` column is a PostgreSQL `text[]` array — validated with a custom method requiring at least one non-blank entry
- Routes use `path: "sessions"` so URLs are `/sessions/...` not `/recording_sessions/...`

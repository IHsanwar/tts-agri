# Code Progress Report — TTS Arena

Platform: TTS Arena (English crossword competition platform)
Current State: Backend (Pure MySQL), Migrations & Frontend Fully Implemented.

## Completed Components

### 1. Environment & Database (Pure MySQL)
- Virtual environment (`backend/.venv`) configured with Python 3.12, dependencies installed via `uv`.
- Pure MySQL configuration (SQLite completely removed):
  - Async driver: `aiomysql` (`mysql+aiomysql://root@localhost:3306/ttsdulu?charset=utf8mb4`).
  - Sync driver for Alembic: `pymysql` (`mysql+pymysql://root@localhost:3306/ttsdulu?charset=utf8mb4`).
  - Connection pooling: `pool_pre_ping=True`, `pool_recycle=3600`.
- Alembic sync migrations executed successfully on MySQL database `ttsdulu`:
  - `32b3053da235`: Initial schema (`teachers`, `teacher_sessions`, `puzzle_sets`, `groups`, `competitions`, `competition_groups`, `game_sessions`, `game_events`, `score_ledger`, `session_entries`, `session_hints`, `audit_logs`, `join_attempts`).
  - `896d92c79979`: Add `token_hash` & `csrf_token_hash` to `competition_groups` for single-active-device session takeover.
- Naive UTC datetime handling configured in `app/core/time.py` for full MySQL `DateTime` compatibility.

### 2. Core & Security
- `app/core/security.py`: Argon2-cffi password hashing (executed on threadpool to prevent blocking the event loop), secure random token generation (CSRF, cookies, codes, PINs).
- `app/core/cookies.py`: HttpOnly auth cookies (`tts_teacher`, `tts_group`) and readable double-submit CSRF cookies (`tts_teacher_csrf`, `tts_group_csrf`).
- `app/core/rate_limit.py`: Token bucket rate limiting for register per IP, join per IP/group, events per session, wrong attempts per session.

### 3. API Routers (`/api`)
- **Health & Time**:
  - `GET /api/health` -> MySQL connectivity check (`SELECT 1`).
  - `GET /api/time` -> Server clock (`now_iso`, `now_ms`).
- **Auth (`/api/auth`)**:
  - `POST /api/auth/register` -> Enforces invite code, Argon2 hashing, sets cookies, records audit.
  - `POST /api/auth/login` -> Verifies credentials, updates `last_login_at`, sets cookies, records audit.
  - `POST /api/auth/logout` -> Revokes active session, clears cookies, records audit.
  - `GET /api/auth/me` -> Returns current teacher profile & CSRF token.
- **Teacher (`/api/teacher`)**:
  - **Puzzles**: `GET /puzzles`, `POST /puzzles` (upload & validate draft), `GET /puzzles/{id}` (preview with answers and cell numbers), `POST /puzzles/{id}/publish` (immutable), `DELETE /puzzles/{id}`.
  - **Groups**: `GET /groups`, `POST /groups` (auto-generates 4-char code and 6-digit PIN shown once), `PATCH /groups/{id}`, `POST /groups/{id}/reset-pin` (rotates PIN and revokes sessions).
  - **Competitions**: `GET /competitions`, `POST /competitions` (assigns published puzzle + groups, generates 6-char join code), `GET /competitions/{id}`, `PATCH /competitions/{id}`, `POST /open`, `POST /start` (spawns game sessions & session entries for joined groups), `POST /extend`, `POST /close`, `DELETE`.
  - **Monitoring & Results**: `GET /competitions/{id}/sessions` (live scores, solved count, hints used, last seen), `POST /sessions/{id}/void` (disqualifies group and excludes from leaderboard), `GET /competitions/{id}/export.csv` (CSV with anti-formula-injection protection), `GET /audit` (audit trail).
- **Participant Play (`/api`)**:
  - `POST /api/join` -> Validates join code, group code, and PIN. Handles open (waiting room), running (auto-takeover/resume from other devices), and closed states.
  - `GET /api/play/state` -> Returns participant view (answers completely stripped), revealed hints, cell states, server clock, score, and deadline. Throttles `last_seen_at`.
  - `POST /api/play/events` -> Batch processor under `write_session()`. Handles `word_submit` (+10 pts, idempotent, wrong attempt limiter), `hint_letter` (-3 pts, max 2 hints), `hint_word` (-10 pts, assisted status). Automatically triggers +20 completion bonus when all entries are solved/assisted.
  - `GET /api/play/result` -> Final group ranking, score, time taken.
- **Public (`/api/public`)**:
  - `GET /api/public/competitions/{join_code}/leaderboard` -> Public leaderboard when enabled by teacher (score DESC, time ASC, name ASC, voided excluded).

### 4. Frontend Client (`frontend/src`)
- **Architecture & Setup**:
  - React 18, TypeScript, Tailwind CSS, Lucide React, TanStack Query, React Router v6.
  - `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`.
  - Editorial "newspaper / scoreboard" aesthetic with warm paper palette, tabular nums, high contrast, and keyboard-centric focus.
- **API & State Layer**:
  - `src/api/client.ts`: Typed fetch wrapper with double-submit CSRF cookie forwarding (`x-csrf-token`), error envelopes, and blob streaming support.
  - `src/lib/outbox.ts`: Offline-tolerant FIFO event queue with exponential retries, localStorage session isolation, and 401 session takeover detection.
  - `src/lib/scoreFormat.ts`: Server-delta clock synchronization, tabular duration and score formatting.
  - `src/features/tts/ttsReducer.ts`: Crossword navigation engine handling physical desktop keyboard navigation (A-Z, Backspace with locked-cell skipping, Arrow keys, Tab/Shift-Tab cycle, Enter direction toggle), optimistic letter entry, automatic word submission on completion, and server event application.
- **Participant Flow**:
  - `LandingPage.tsx`: Join competition form (competition code + group code + PIN) with single-device session takeover notice.
  - `PlayPage.tsx`: Full arena view with `ScoreboardHeader`, `CrosswordGrid` (7-col), `ClueRail` (5-col bilingual clues), `HintDialog`, waiting room auto-sync, and modal on session takeover.
  - `ResultPage.tsx`: Final victory scoreboard with score, rank, and duration breakdown.
  - `PublicLeaderboardPage.tsx`: Live scoreboard polling every 5s for spectators and projectors.
- **Teacher Workspace (`/teacher`)**:
  - `TeacherLoginPage.tsx` & `TeacherRegisterPage.tsx`: Secure auth with school invite code validation.
  - `TeacherLayout.tsx`: Protected route guard, persistent navigation header, and teacher profile badge.
  - `TeacherDashboardPage.tsx`: Overview metrics (active competitions, puzzle bank count, active groups), quick launch shortcuts, and recent audit trail.
  - `TeacherPuzzlesPage.tsx`: Upload puzzle JSON modal with instant School V1 sample filler, validation error/warning list, full interactive visual grid preview with answers, immutable publish action, and draft deletion.
  - `TeacherGroupsPage.tsx`: Group creation modal with single-time PIN reveal warning, PIN reset with session invalidation, name/status modification, and printable student credential access cards.
  - `TeacherCompetitionsPage.tsx`: Competition builder (published puzzle selector, group multi-select, duration, public toggle) and list of all competitions.
  - `TeacherCompetitionDetailPage.tsx`: Mission control room with state machine actions (Open waiting room, Start competition, Extend time dialog, Close early), direct anti-formula CSV export, public leaderboard share, and live session monitor polling every 5s with Void/Disqualification action and reason logging.
  - `TeacherAuditPage.tsx`: Full audit log viewer with timestamp, action category badges, actor, target, IP address, and metadata inspector.

### 5. Fixtures & Infra
- Sample validated puzzle: `content/puzzles/school-v1.json` (10x10, verified 0 errors).
- CLI Script: `scripts/reset_teacher_password.py`.
- Infra: `docker-compose.yml`, `backend/Dockerfile`, `deploy/Caddyfile`, `deploy/backup.sh`, `.env.example`, `.gitignore`.

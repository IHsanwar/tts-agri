# Code Progress Report — TTS Arena

Platform: TTS Arena (English crossword competition platform)
Current State: Backend Phase 0 through Phase 5 Complete & Fully Functional.

## Completed Components

### 1. Environment & Database
- Virtual environment (`backend/.venv`) configured with Python 3.12, dependencies installed via `uv`.
- SQLite database configured with WAL mode, foreign keys enabled, and single-worker serialization (`write_session()` lock).
- Alembic sync migrations created and executed:
  - Initial schema: `teachers`, `teacher_sessions`, `puzzle_sets`, `groups`, `competitions`, `competition_groups`, `game_sessions`, `game_events`, `score_ledger`, `session_entries`, `session_hints`, `audit_logs`, `join_attempts`.
  - Added `token_hash` & `csrf_token_hash` to `competition_groups` for instant single-active-device session takeover.

### 2. Core & Security
- `app/core/security.py`: Argon2-cffi password hashing (executed on threadpool to prevent blocking the event loop), secure random token generation (CSRF, cookies, codes, PINs).
- `app/core/cookies.py`: HttpOnly auth cookies (`tts_teacher`, `tts_group`) and readable double-submit CSRF cookies (`tts_teacher_csrf`, `tts_group_csrf`).
- `app/core/rate_limit.py`: Token bucket rate limiting for register per IP, join per IP/group, events per session, wrong attempts per session.

### 3. API Routers (`/api`)
- **Health & Time**:
  - `GET /api/health` -> DB connectivity check.
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

### 4. Fixtures & Infra
- Sample validated puzzle: `content/puzzles/school-v1.json` (10x10, 5 entries, verified 0 validation errors).
- CLI Script: `scripts/reset_teacher_password.py`.
- Infra: `docker-compose.yml`, `backend/Dockerfile`, `deploy/Caddyfile`, `deploy/backup.sh`, `.env.example`, `.gitignore`.
- Documentation: `docs/PUZZLE_FORMAT.md`, `docs/SCORING.md`, `docs/RUNBOOK.md`, `docs/USER_GUIDE.md`, `README.md`.
- Automated tests: `tests/test_puzzle_service.py` passing cleanly.

## Ready For Next Phase
- Frontend client implementation: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui.
- Participant crossword keyboard navigation & local outbox.
- Teacher dashboard UI (puzzles, groups, competition management, live monitor).

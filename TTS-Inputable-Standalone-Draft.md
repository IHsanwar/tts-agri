# TTS Arena — Technical Design & Development Plan

**Status:** Design Draft v1  
**Repository:** `tts-arena/`  
**Product:** English Crossword Competition Platform
**Architecture:** React + Vite, FastAPI, SQLite

---

## 1. Ringkasan Produk

**TTS Arena** adalah aplikasi teka-teki silang (*crossword puzzle*) berbahasa Inggris yang dirancang untuk kompetisi antarkelompok di lingkungan sekolah.

Aplikasi memungkinkan guru membuat dan mengelola puzzle, membentuk kelompok peserta, menjalankan kompetisi, serta memantau hasil melalui leaderboard berbasis server.

Peserta memainkan puzzle secara langsung melalui browser menggunakan keyboard, baik pada desktop maupun perangkat mobile.

### 1.1 Tujuan

1. Menyediakan permainan crossword interaktif yang mudah digunakan.
2. Mendukung kompetisi antarkelompok secara terstruktur.
3. Memastikan perhitungan skor dilakukan sepenuhnya oleh server.
4. Menyediakan sistem hint dengan konsekuensi terhadap skor.
5. Menyediakan leaderboard yang deterministik dan transparan.
6. Memudahkan guru mengelola puzzle, kelompok, kompetisi, dan hasil.
7. Menjamin progres permainan dapat dipulihkan ketika halaman direload atau koneksi terputus.

### 1.2 Pengguna

**Guru**
- Login ke dashboard.
- Membuat dan mengelola puzzle set.
- Mengimpor dan mengelola kelompok.
- Membuat kompetisi.
- Mengatur aturan permainan.
- Memulai dan mengakhiri kompetisi.
- Memantau progres peserta.
- Melakukan void terhadap hasil yang bermasalah.
- Melihat leaderboard dan mengekspor hasil.

**Peserta (Grup)**
- Bergabung menggunakan kode kompetisi, kode grup, dan PIN.
- Memainkan puzzle menggunakan keyboard.
- Melihat petunjuk dalam bahasa Inggris dan Indonesia.
- Menggunakan hint dengan konsekuensi skor.
- Melihat progres permainan.
- Melihat hasil dan leaderboard.

### 1.3 Ruang Lingkup MVP

Fitur yang termasuk dalam pengembangan awal:

- Autentikasi guru.
- Manajemen kelompok.
- Manajemen puzzle.
- Puzzle validator.
- Manajemen kompetisi.
- Join menggunakan kode dan PIN.
- Crossword inputable.
- Keyboard navigation.
- Hint system.
- Server-side scoring.
- Event idempotency.
- Session recovery.
- Leaderboard.
- Anti-cheat.
- Audit log.
- CSV export.
- Responsive interface.

Fitur di luar MVP:

- Akun siswa individual.
- Aplikasi native Android/iOS.
- Input suara.
- Drag-and-drop huruf.
- Multiplayer real-time.
- Mode latihan tanpa autentikasi.
- Integrasi eksternal dan SSO.

---

## 2. Arsitektur Sistem

### 2.1 High-Level Architecture

```text
                    INTERNET
                       |
                    HTTPS/TLS
                       |
                 tts.example.com
                       |
                 Reverse Proxy
                       |
             +---------+---------+
             |                   |
           /                     /api
             |                   |
       React + Vite          FastAPI
       Static Frontend       Backend API
                                 |
                         SQLAlchemy Async
                                 |
                              SQLite
                                 |
                       ./data/tts.sqlite
                                 |
                         Daily Backups
                                 |
                         ./backups/
```

### 2.2 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| UI components | shadcn/ui |
| Routing | React Router |
| Server state | TanStack Query |
| Local state | Zustand |
| Backend | Python 3.11+ |
| API framework | FastAPI |
| ORM | SQLAlchemy 2.x |
| Database | SQLite |
| Migration | Alembic |
| Authentication | Argon2 |
| Validation | Pydantic |
| Testing backend | Pytest |
| Testing frontend | Vitest |
| E2E testing | Playwright |
| Deployment | Nginx + Uvicorn |

### 2.3 Architecture Decisions

**Single Origin**

Frontend dan backend menggunakan satu domain:

- `https://tts.example.com/` untuk frontend.
- `https://tts.example.com/api/` untuk backend.

Keuntungan:
- First-party session cookie.
- Tidak membutuhkan konfigurasi CORS ber-kredensial.
- Lebih sederhana untuk deployment.
- Mengurangi kompleksitas autentikasi browser.

**SQLite**

Database menggunakan SQLite dengan WAL mode.

Konfigurasi:
- WAL enabled.
- Foreign keys enabled.
- Busy timeout.
- Satu Uvicorn worker.
- Transaksi write menggunakan mekanisme terpusat.
- Backup database secara berkala.

Target awal adalah maksimal 40 kelompok yang bermain secara bersamaan dengan rata-rata satu submit per detik per kelompok.

**Request Size**

- Request API umum: maksimal 64 KB.
- Upload puzzle JSON: maksimal 512 KB.
- Batch event: maksimal 20 event.

---

## 3. Struktur Repository

Repository dimulai dari kondisi kosong.

```text
tts-arena/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── join.py
│   │   │   ├── play.py
│   │   │   ├── leaderboard.py
│   │   │   └── teacher.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── cookies.py
│   │   │   ├── errors.py
│   │   │   ├── middleware.py
│   │   │   └── time.py
│   │   │
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── engine.py
│   │   │
│   │   ├── models/
│   │   │   ├── auth.py
│   │   │   ├── competition.py
│   │   │   ├── content.py
│   │   │   └── game.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── game.py
│   │   │   └── teacher.py
│   │   │
│   │   ├── services/
│   │   │   ├── puzzle.py
│   │   │   ├── tts.py
│   │   │   ├── scoring.py
│   │   │   ├── sessions.py
│   │   │   ├── leaderboard.py
│   │   │   ├── achievements.py
│   │   │   ├── audit.py
│   │   │   └── export.py
│   │   │
│   │   └── main.py
│   │
│   ├── migrations/
│   ├── scripts/
│   │   ├── seed_teacher.py
│   │   ├── import_puzzles.py
│   │   └── backup_db.py
│   │
│   ├── tests/
│   ├── alembic.ini
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── AuthProvider.tsx
│   │   │   └── guards.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── lib/
│   │   │   └── outbox.ts
│   │   │
│   │   ├── pages/
│   │   │   ├── JoinPage.tsx
│   │   │   ├── PlayPage.tsx
│   │   │   ├── ResultPage.tsx
│   │   │   ├── LeaderboardPage.tsx
│   │   │   ├── TeacherLoginPage.tsx
│   │   │   └── teacher/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Puzzles.tsx
│   │   │       ├── Competitions.tsx
│   │   │       ├── Groups.tsx
│   │   │       └── Sessions.tsx
│   │   │
│   │   ├── features/
│   │   │   └── tts/
│   │   │       ├── TtsScreen.tsx
│   │   │       ├── TtsGrid.tsx
│   │   │       ├── TtsCell.tsx
│   │   │       ├── InputBridge.tsx
│   │   │       ├── ClueRail.tsx
│   │   │       ├── ClueBanner.tsx
│   │   │       ├── HintSheet.tsx
│   │   │       ├── useTtsSession.ts
│   │   │       ├── useServerClock.ts
│   │   │       ├── ttsReducer.ts
│   │   │       ├── keyboard.ts
│   │   │       ├── puzzleMask.ts
│   │   │       └── ttsScoring.ts
│   │   │
│   │   └── main.tsx
│   │
│   ├── public/
│   └── package.json
│
├── content/
│   └── puzzles/
│       └── school-v1.json
│
├── docs/
│   ├── DESIGN.md
│   ├── SCORING.md
│   └── RUNBOOK.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Database Design

Database menggunakan SQLite dengan baseline migration baru.

### 4.1 Authentication

**teachers**

| Column | Type |
|---|---|
| id | Integer PK |
| email | String UNIQUE |
| password_hash | String |
| is_active | Boolean |
| created_at | DateTime |
| last_login_at | DateTime |

**teacher_sessions**

| Column | Type |
|---|---|
| id | Integer PK |
| teacher_id | FK CASCADE |
| token_hash | String UNIQUE |
| csrf_token_hash | String |
| expires_at | DateTime |
| last_seen_at | DateTime |
| revoked_at | DateTime nullable |
| created_at | DateTime |

### 4.2 Puzzle Management

**puzzle_sets**

| Column | Type |
|---|---|
| id | Integer PK |
| version | String UNIQUE |
| schema_version | Integer |
| content_json | JSON |
| sha256 | String |
| status | draft / published |
| created_by_teacher_id | FK |
| created_at | DateTime |
| published_at | DateTime nullable |

Puzzle yang sudah dipublikasikan bersifat immutable.

### 4.3 Competition

**competitions**

| Column | Type |
|---|---|
| id | Integer PK |
| name | String |
| join_code | String UNIQUE |
| status | draft / open / running / closed |
| puzzle_set_id | FK |
| rules_json | JSON |
| leaderboard_public | Boolean |
| created_by_teacher_id | FK |
| created_at | DateTime |
| opened_at | DateTime |
| started_at | DateTime |
| closed_at | DateTime |
| ends_at | DateTime |

Setiap kompetisi menggunakan satu puzzle yang ditentukan ketika kompetisi dibuka.

### 4.4 Groups

**groups**

| Column | Type |
|---|---|
| id | Integer PK |
| group_code | String UNIQUE |
| name | String |
| pin_hash | String |
| status | active / disabled |
| created_at | DateTime |
| updated_at | DateTime |

**competition_groups**

| Column | Type |
|---|---|
| id | Integer PK |
| competition_id | FK |
| group_id | FK |
| status | joined / in_progress / completed / disqualified |
| joined_at | DateTime |
| completed_at | DateTime nullable |
| disqualified_at | DateTime nullable |
| reason | String nullable |

Unique constraint: `(competition_id, group_id)`.

### 4.5 Game Sessions

**group_sessions**

| Column | Type |
|---|---|
| id | Integer PK |
| group_id | FK
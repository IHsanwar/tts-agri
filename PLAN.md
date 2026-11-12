# TTS Arena — Rencana Implementasi

Status: Siap dieksekusi oleh agent implementasi.
Lokasi bangun: folder kerja saat ini (`English Game 1/`) sebagai root repo (TIDAK membuat subfolder `tts-arena/`, TIDAK bergantung pada folder lain di luar workspace).
Bahasa rencana: Bahasa Indonesia. Identifier kode/teknis: Inggris.

## 1. Tujuan dan Keputusan Terkunci

Produk: kompetisi crossword (teka-teki silang) berbahasa Inggris antar grup di sekolah, skor dihitung server, leaderboard deterministik.

Keputusan dari sesi tanya-jawab (dianggap final):

1. Deployment: **VPS publik** dengan domain/subdomain siap.
2. Registrasi guru: **publik tetapi diharuskan kode undangan sekolah** (`INVITE_CODE`); tidak ada layanan email.
3. Data guru: **terpisah per guru** (tenant = `teacher_id`); satu guru hanya melihat resource miliknya.
4. Puzzle: **unggah JSON + validator + preview**; tidak ada editor grid visual di MVP.
5. Grup: **input manual** (tambah/edit/disable satu per satu), kode grup + PIN dihasilkan otomatis.
6. Perangkat: **satu perangkat aktif per grup**; login ulang dengan PIN mengambil alih sesi dan mematikan perangkat lama.
7. Waktu: **start bersama**; guru menekan Start setelah grup bergabung; tidak ada join setelah start; bisa perpanjang/tutup lebih awal.
8. Skor: **berbasis kata** (lihat §6).
9. Perangkat didukung: **desktop/laptop dengan keyboard fisik saja**. Mobile dikeluarkan dari MVP (lihat §12).
10. Bahasa: **UI Indonesia + clue bilingual (English + Indonesia)**.
11. Anti-cheat: **server-authoritative**; tidak mencoba mencegah siswa mencari jawaban di perangkat lain.
12. Packaging: **Docker Compose + Caddy** (TLS otomatis), satu worker Uvicorn, volume SQLite/backup.

## 2. Catatan Perbaikan terhadap Draft

Draft berhenti di §4.5 Game Sessions. Bagian berikut belum ada dan akan didefinisikan di rencana ini: event model, scoring, hint, leaderboard, API, frontend gameplay, anti-cheat, testing, deployment.

Penyimpangan disengaja dari draft:
- Stack reverse proxy: **Caddy** (bukan Nginx) demi TLS otomatis.
- Mobile/responsive: **dikeluarkan dari MVP** (draft menyebut desktop+mobile; user memutuskan desktop saja).
- `achievements.py` **dihapus** dari MVP (tidak ada di ruang lingkup draft).
- `services/tts.py` diganti nama menjadi **`services/game.py`** untuk menghindari benturan dengan `services/puzzle.py`.
- `frontend/ttsScoring.ts` menjadi **`scoreFormat.ts`** (hanya format tampilan; tidak ada logika skor di client).
- `puzzle_sets.version` unik **per guru** (`(teacher_id, version)`), bukan global.
- `groups.group_code` unik **per guru** (`(teacher_id, group_code)`); `competitions.join_code` tetap unik global.
- `teachers` ditambah kolom `name`.
- Tambah model `audit_logs`, `join_attempts`, `game_events`, `score_ledger`, `session_entries`, `session_hints`.

## 3. Ruang Lingkup MVP

Termasuk: registrasi/login guru via kode undangan; CRUD grup manual + reset PIN + unduh kartu kredensial; unggah/validasi/preview/publikasi puzzle; CRUD kompetisi + pilih puzzle/grup; siklus open→running→closed; join via kode kompetisi+kode grup+PIN (termasuk rejoin/resume); grid crossword inputable desktop; keyboard navigation; hint huruf & hint jawaban; skor server-side idempotent; outbox + recovery sesi; server clock; leaderboard (teacher live + publik opsional); void; audit log; export CSV; Docker Compose + Caddy; backup harian.

Tidak termasuk: mobile/touch; editor puzzle visual; akun siswa individual; real-time multiplayer per grup; WebSocket/SSE; aplikasi native; voice/drag-drop; SSO/email; achievements; mode latihan; multi-tenant sekolah; password reset lewat UI (via CLI saja).

## 4. Stack

Backend: Python 3.11, FastAPI, SQLAlchemy 2 async + aiosqlite, Alembic (engine sync untuk migration), Pydantic v2, pydantic-settings, argon2-cffi. Dev/test: pytest, pytest-asyncio, httpx, ruff, mypy.
Frontend: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Zustand, Vitest, Testing Library, Playwright. API base `/api` (same-origin). Dev proxy Vite → `http://localhost:8000`.
Infra: Docker (Node 20 build → Caddy 2 alpine; Python 3.11-slim backend), satu worker Uvicorn, SQLite WAL, volume `./data` dan `./backups`.

## 5. Model Data (SQLite, semua waktu UTC)

Ditambah/sepenuhnya didefinisikan (draft §4.1–4.4 berlaku dengan penyesuaian):

- `teachers(id, email UNIQUE lower, password_hash, name, is_active, created_at, last_login_at)`
- `teacher_sessions(id, teacher_id FK, token_hash UNIQUE, csrf_token_hash, expires_at, last_seen_at, revoked_at nullable, ip, user_agent, created_at)`
- `puzzle_sets(id, teacher_id FK, version, schema_version, content_json, sha256, status[draft|published], created_at, published_at nullable)`; UNIQUE `(teacher_id, version)`
- `groups(id, teacher_id FK, group_code, name, pin_hash, status[active|disabled], created_at, updated_at)`; UNIQUE `(teacher_id, group_code)`
- `competitions(id, teacher_id FK, name, join_code UNIQUE, status[draft|open|running|closed], puzzle_set_id FK, rules_json, leaderboard_public, duration_minutes, created_at, opened_at, started_at, closed_at, ends_at)`
- `competition_groups(id, competition_id FK, group_id FK, status[joined|in_progress|completed|expired|disqualified], joined_at, completed_at nullable, disqualified_at nullable, reason nullable)`; UNIQUE `(competition_id, group_id)`
- `game_sessions(id, competition_id FK, group_id FK, status[active|completed|expired|voided], started_at, deadline_at, completed_at nullable, voided_at nullable, last_event_at, last_seen_at, last_seen_throttled_at, created_at)`; UNIQUE `(competition_id, group_id)`
- `game_events(id, session_id FK, event_id UUID UNIQUE, seq_client, type[word_submit|hint_letter|hint_word], payload_json, result_json, accepted BOOL, reject_reason nullable, created_at)`; UNIQUE `(session_id, event_id)`; INDEX `(session_id, created_at)`
- `score_ledger(id, session_id FK, event_id nullable, delta INT, reason_code, reason_key, created_at)`; UNIQUE `(session_id, reason_key)`; INDEX `(session_id)`
- `session_entries(id, session_id FK, entry_id, status[unsolved|solved|assisted], attempts INT DEFAULT 0, solved_at nullable, updated_at)`; UNIQUE `(session_id, entry_id)`
- `session_hints(id, session_id FK, entry_id, hint_key UNIQUE, hint_type[letter|word], cell_index nullable, created_at)`; INDEX `(session_id)`
- `audit_logs(id, teacher_id nullable, actor_type, actor_id, action, target_type, target_id nullable, metadata_json, ip, user_agent, created_at)`; INDEX `(teacher_id, created_at)`
- `join_attempts(id, competition_code, group_code, ip, success BOOL, created_at)`; INDEX `(created_at)`; untuk rate limit dan audit

Konfigurasi DB: WAL, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`, satu worker. Tulis via `core/db_write.py` (context manager dengan `asyncio.Lock` global + retry `database is locked`), transaksi pendek. Alembic: engine sync `sqlite:////data/tts.sqlite`; app: `sqlite+aiosqlite:////data/tts.sqlite`. Argon2 dijalankan via `run_in_threadpool`.

## 6. Aturan Gameplay dan Skor

Format event & skor:
- `word_submit {entry_id, letters}`: validasi huruf cocok jawaban. Benar: +10 (ledger reason_key `word:<entry_id>`, UNIQUE). Salah: `attempts++`, tidak ada poin, tidak ada penalti. Idempoten via `event_id`; duplikat event mengembalikan hasil tersimpan.
- `hint_letter {entry_id, cell_index}`: wajib cell belum terbuka dan entri belum solved; maks 2 huruf per entri. Delta -3 (reason_key `hint_letter:<entry_id>:<cell_index>`). Kembalikan huruf benar untuk cell itu.
- `hint_word {entry_id}`: satu kali per entri; tandai `assisted` (0 poin base); delta -10 (reason_key `hint_word:<entry_id>`); kembalikan seluruh huruf.
- Completion: otomatis saat semua `session_entries` berstatus solved/assisted, di transaksi yang sama dengan event pemicu; delta +20 sekali (reason_key `completion`); set `status=completed`, `completed_at`.
- Skor tampilan/ranking = `max(0, SUM(delta))`.
- Ranking: skor DESC, lalu `completed_at` ASC (nulls last), lalu `groups.name` ASC.
- Wrong attempt: tidak ada penalti; rate limit 10 attempt/menit/sesi.
- Event ditolak bila sesi `active` saja (bukan completed/expired/voided) dan `server_now < deadline_at`.

UX crossword:
- Server TIDAK pernah mengirim jawaban ke client. State hanya: mask grid (blok/angka/huruf terbuka), entries (id, number, direction, row, col, length, clue_en, clue_id, status), cells terbuka, skor, deadline, server time.
- Saat sebuah entri terisi penuh, client auto-`word_submit` (debounce; hanya kirim ulang jika tanda tangan huruf berubah). Tombol "Periksa kata ini" / "Periksa semua" untuk kasus tersisa.
- Benar: hijau + kunci cell entri. Salah: merah per-entri (tidak menandai huruf mana salah); merah hilang saat huruf berubah. Hint: biru/amber dan terkunci.
- Keyboard: huruf A–Z (normalize upper), Backspace (hapus+mundur, lewati cell terkunci), panah (pindah, lewati blok), Tab/Shift+Tab (entri berikut/sebelum), Enter (toggle arah; bila solved lanjut entri), klik cell (pilih; klik sama toggle arah). Fokus via satu hidden input; anti scroll untuk panah/space. Hanya desktop.

## 7. Format Puzzle (`content/puzzles/school-v1.json`)

```json
{
  "schema_version": 1,
  "version": "school-v1",
  "title": "School Life",
  "language": "en",
  "grid": ["SCHOOL#...", "..."],
  "entries": [
    {
      "id": "school-across",
      "row": 0, "col": 0,
      "direction": "across",
      "answer": "SCHOOL",
      "clue_en": "A place where students learn.",
      "clue_id": "Tempat siswa belajar."
    }
  ]
}
```

- `grid`: array string sama panjang, hanya `A-Z` dan `#` (blok). Dimensi 5–20 baris/kolom, maks 400 cell.
- `entries`: `id` unik, `row/col` valid, `direction` across/down, `answer` hanya A-Z panjang ≥2 dan sama dengan huruf di grid sepanjang arah, `clue_en` & `clue_id` non-kosong (≤300).
- Validator (services/puzzle.py):
  - Error (blok publish): dimensi di luar batas; grid tidak persegi; karakter ilegal; entri out-of-bounds; answer mismatch; `id`/`(row,col,direction)` duplikat; panjang <2; clue kosong; cell putih yang bukan milik entri mana pun; tidak ada across maupun down; total content >512KB.
  - Warning (tidak blok): clue mengandung kata answer; ada cell putih yang hanya milik satu arah (unchecked); versi pernah dipakai kompetisi.
  - Penomuan: scan row-major; sel yang memulai entri diberi nomor urut; satu sel bisa punya nomor across+down yang sama.
- `sha256` = canonical JSON. Published = immutable. Kompetisi hanya boleh memakai puzzle `published`. Draft bisa diedit ulang; hapus hanya draft tidak terpakai.
- Buat 1 sampel valid 10×10 dengan ~8–10 kata bertema sekolah sebagai fixture + demo.

## 8. API (semua `/api`, same-origin, JSON)

Konvensi: error envelope `{"error":{"code","message","details"}}`; status 400/401/403/404/409/422/429/500. Owner-mismatch → 404. Request max 64KB (puzzle 512KB). Request ID via `X-Request-Id`. Mutasi non-GET wajib CSRF (cookie double-submit + header) dan cek `Origin`/`APP_ORIGIN`.

Publik:
- `GET /api/health` → `{status, db}`
- `GET /api/time` → `{now_iso, now_ms}`
- `POST /api/auth/register` {email,password,name,invite_code} → set cookie teacher+csrf; rate limit
- `POST /api/auth/login` {email,password}
- `POST /api/auth/logout`
- `GET /api/auth/me` → {teacher, csrf_token?} (csrf dibaca dari cookie)

Teacher (auth + owner-scoped + CSRF mutasi):
- Puzzles: `GET /api/teacher/puzzles`, `POST /api/teacher/puzzles` (body JSON content), `GET /api/teacher/puzzles/{id}` (full, termasuk jawaban untuk preview), `POST /api/teacher/puzzles/{id}/publish`, `DELETE /api/teacher/puzzles/{id}` (draft saja).
- Groups: `GET /api/teacher/groups`, `POST /api/teacher/groups` {name} → {id,group_code,pin} (PIN tampil sekali), `PATCH /api/teacher/groups/{id}` {name,status}, `POST /api/teacher/groups/{id}/reset-pin` → {pin} (revoke sesi aktif).
- Competitions: `GET /api/teacher/competitions`, `POST` {name,puzzle_set_id,group_ids,duration_minutes,leaderboard_public}, `GET /api/teacher/competitions/{id}`, `PATCH` (draft saja), `POST /open`, `POST /start` (≥1 joined; buat game_sessions untuk semua joined), `POST /extend` {minutes} (hanya running, sebelum deadline), `POST /close`, `DELETE` (draft saja).
- Monitoring & results: `GET /api/teacher/competitions/{id}/sessions` (live: status, skor, solved, hints, last_seen), `POST /api/teacher/sessions/{id}/void` {reason} (final: session voided + group disqualified, exclude leaderboard), `GET /api/teacher/competitions/{id}/export.csv` (anti-formula-injection: prefiks `'` untuk sel yang dimulai `= + - @`), `GET /api/teacher/audit`.

Peserta (group session cookie + CSRF):
- `POST /api/join` {competition_code, group_code, pin} → status: open=buat/join `competition_group`+waiting; running & sudah joined=resume (rotate token, takeover); running & belum joined=409; closed & sudah joined=result. Set cookie `tts_group`+csrf.
- `GET /api/play/state` → state sesi (lihat §6) + `server_now`. Update `last_seen` throttled (~15s).
- `POST /api/play/events` → batch maks 20 event `{event_id,type,payload}`; proses urut dalam satu write transaction; return per-event {event_id, accepted, result/reject_reason} + state delta; idempoten.
- `GET /api/play/result` → hasil akhir grup.

Publik leaderboard:
- `GET /api/public/competitions/{join_code}/leaderboard` → hanya bila `leaderboard_public=true`; live bila running, final bila closed; exclude voided.

Cookie: `tts_teacher` (HttpOnly), `tts_teacher_csrf` (readable), `tts_group` (HttpOnly), `tts_group_csrf` (readable); `SameSite=Lax`, `Secure`=`COOKIE_SECURE` (prod true, dev false); `Path=/`; max-age teacher 7d, group 12h. Token 32 byte random, disimpan hash SHA-256. CSRF = random token, hash di tabel sesi, double-submit cookie. Takeover: rotate token grup, hapus/invalidasi token lama → request lama 401.

## 9. Frontend

Halaman: `/` (landing + form join + link guru), `/join`, `/play`, `/result`, `/leaderboard/:code`, `/teacher/login`, `/teacher/register`, `/teacher`, `/teacher/puzzles`, `/teacher/groups`, `/teacher/competitions`, `/teacher/competitions/:id` (detail+monitor+void+extend+close+export), `/teacher/audit`.

Struktur mengikuti draft (`src/app`, `src/api`, `src/lib/outbox.ts`, `src/pages`, `src/features/tts`, `src/features/teacher`). TanStack Query untuk server state guru & polling; Zustand untuk sesi play + outbox; reducer `ttsReducer` untuk grid lokal. `scoreFormat.ts` hanya format; `puzzleMask.ts` memetakan state server. Polling: waiting 2s, state/leaderboard/monitor 5s. Outbox di localStorage per sesi: antrian event dengan `event_id`, retry exponential, indikator koneksi. Recovery: `GET /api/play/state` saat reload, lalu flush outbox. 401 takeover → modal "Sesi dipindahkan", hentikan polling.

Aksesibilitas baseline: fokus terlihat, label ARIA sel (`baris/kolom/angka/huruf`), kontras tinggi, hormati `prefers-reduced-motion`. Indikator state tidak hanya warna (ikon/pola).

Visual: estetika "koran + scoreboard" — kertas off-white, tinta hitam, aksen kuning, hijau/coral/amber untuk state, numerik tabular untuk skor. Font sistem (serif untuk judul, system-ui untuk UI, monospace untuk kode). Tanpa emoji; ikon dari lucide-react. Layout desktop: grid 7 kolom + clue rail 5 kolom, min 1024px; uji di 1280×800 & 1440×900.

## 10. Fase Implementasi (urutan, ada acceptance criteria)

Fase 0 — Scaffold & infra dasar
- `git init`, `.gitignore`, `pyproject.toml`, `backend/`, `frontend/` (Vite+TS+Tailwind+shadcn), `docker-compose.yml`, `deploy/Caddyfile`, `.env.example`, `README.md`. Migrasi awal Alembic. Health + time endpoint.
- AC: `pip install -e .[dev]` & `npm install` jalan; `alembic upgrade head`; `/api/health` dan `/api/time` OK.

Fase 1 — Autentikasi guru + multitenant
- Register (kode undangan, rate limit, Argon2 threadpool), login, logout, `me`, CSRF double-submit, origin check, owner isolation helper, audit dasar.
- AC: register butuh kode benar; 409 email duplikat; login/logout; teacher A tidak bisa akses resource B (404); mutasi tanpa CSRF ditolak.

Fase 2 — Puzzle
- Model, unggah JSON, validator (error+warning), `sha256`, preview (full untuk guru), publish immutable, hapus draft. `docs/PUZZLE_FORMAT.md`. Sampel `school-v1.json`.
- AC: upload valid → draft; upload invalid → daftar error terformat; publish → immutable; preview menampilkan grid+jawaban+nomor.

Fase 3 — Grup & kompetisi (sebelum play)
- Grup manual (kode+PIN otomatis, PIN tampil sekali, reset-pin revoke sesi), disable. Kompetisi CRUD draft, pilih published puzzle+grup, open/start/extend/close, status machine, buat sesi saat start. `join` + waiting room.
- AC: guru buat grup, lihat PIN sekali; open→join sukses; start dengan 0 joined ditolak; join setelah start (belum joined) ditolak; rejoin running resume + takeover.

Fase 4 — Gameplay & skor
- Mask serializer (tanpa jawaban), event batch, scoring/ledger, hint, completion otomatis, deadline (lazy expire), server clock, frontend grid+keyboard+clue+hint+outbox+recovery.
- AC: solve kata +10 idempoten; hint -3/-10; completion +20; leaderboard ranking benar; event setelah deadline ditolak; reload pulihkan state; duplikat event idempoten.

Fase 5 — Leaderboard, void, export, audit
- Teacher live monitor (polling), public leaderboard (toggle), void final, CSV export (anti-injection), audit log view + record pada semua aksi guru penting.
- AC: void exclude dari leaderboard; export CSV terbuka di Excel; public leaderboard hanya saat flag true; audit mencatat open/start/void/export.

Fase 6 — Testing, deploy, runbook
- Lengkapi tes (§11); Dockerfile backend+frontend(Caddy); compose; Caddyfile; backup script; `docs/RUNBOOK.md`, `docs/SCORING.md`, `docs/USER_GUIDE.md`.
- AC: `ruff`, `mypy`, `pytest`, `npm run lint`, `npm run test`, `npm run build`, Playwright lulus; `docker compose up` menghidupkan app di domain dengan HTTPS; backup manual menghasilkan file SQLite valid (`PRAGMA integrity_check`).

## 11. Rencana Pengujian

Backend (pytest, DB temp per tes, clock di-inject via `core/time.py`):
- Validator: valid sampel + setiap kategori error/warning.
- Scoring: +10, duplikat idempoten, salah, hint -3/-10, completion +20, clamp 0, ranking tie-break.
- Sesi: join open, reject late join, rejoin/takeover invalidasi token lama, deadline reject, void exclude, extend.
- Auth: invite code, duplikat email, password policy, CSRF, session expiry, owner isolation (404).
- Konkurensi: 40 sesi paralel, event duplikat bersamaan, retry lock SQLite.
- Serializer: payload state peserta TIDAK mengandung string jawaban (assert grep kata jawaban di JSON).
- Export: formula-injection diprefix.

Frontend (Vitest + Testing Library):
- `ttsReducer`: pergerakan, pilih entri, ketik, backspace, tab, auto-submit trigger.
- `outbox`: antrian, retry, idempotency, persistensi localStorage.
- Komponen: ClueRail, HintSheet, state warna/ikon.

E2E (Playwright, viewport 1280×800 & 1440×900, fixture puzzle kecil):
- Registrasi via invite → unggah puzzle → buat grup → buat kompetisi → open.
- Dua context join (kode+PIN) → start → main (solve 2 kata + 1 hint) → selesai → leaderboard urut.
- Reload saat main pulih; takeover context kedua → context pertama 401 modal.
- Void satu grup → hilang dari leaderboard; export CSV hadir.
- Extend deadline & close lebih awal.

Load: skenario konkurensi 40 sesi + event burst sebagai tes pytest; opsional skrip manual.

## 12. Risiko, Batasan, dan Asumsi

- Risiko: kontensi tulis SQLite → mitigasi WAL + `asyncio.Lock` global + transaksi pendek + uji 40 sesi. PIN/brute force → PIN 6 digit + rate limit 5/menit/IP, 10/menit/grup + log `join_attempts`. Leakage jawaban → validator serializer + tes. Takeover abuse → butuh PIN + audit. Timer/clock → enforcement server-side + `/api/time`; klien hanya tampilan.
- Desktop-only: peserta dengan telepon TIDAK didukung di MVP; risiko jika lapangan hanya HP — didokumentasikan; mobile jadi fase berikut.
- Void final: tidak ada replay di MVP; bila perlu, buat kompetisi baru. Asumsi eksplisit.
- Password reset: tanpa email; via `scripts/reset_teacher_password.py` di server saja.
- Single-tenant deployment: satu `INVITE_CODE` global; tidak ada model sekolah/org; semua guru terisolasi per `teacher_id`.
- Backup: harian, retensi 14 hari, simpan di `./backups`, disarankan salin keluar VPS.

## 13. Open Items

Tidak ada keputusan material yang tertunda. Asumsi berikut dianggap disetuju jika tidak ditegaskan oleh user saat eksekusi: void final tanpa replay; PIN 6 digit; `leaderboard_public` default false; `INVITE_CODE` global; `APP_ORIGIN` wajib di env.

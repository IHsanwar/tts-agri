# TTS Arena — English Crossword Competition Platform

Platform kompetisi teka-teki silang (crossword) berbahasa Inggris antar grup sekolah berbasis web dengan penilaian server-side deterministik dan papan peringkat waktu-nyata (live leaderboard).

---

## Fitur Utama

- **Teacher Multi-tenant Isolation**: Setiap guru memiliki area kerja terisolasi untuk puzzle, grup siswa, dan kompetisi.
- **Unggah & Validasi Puzzle JSON**: Validator struktur otomatis memeriksa dimensi, konsistensi kotak, jawaban silang, penomoran sel, dan pratinjau guru.
- **Manajemen Kredensial Siswa**: Pembentukan kode grup otomatis dan PIN 6 digit unik. Sesi tunggal per perangkat dengan proteksi takeover otomatis saat login ulang.
- **Siklus Kompetisi Serentak**: Alur terstruktur `draft` $\rightarrow$ `open` (ruang tunggu) $\rightarrow$ `running` (mulai bersamaan) $\rightarrow$ `closed` (penilaian final).
- **Server-Authoritative Gameplay**: Jawaban kata tidak pernah dikirim ke browser peserta. Validasi tebakan, bantuan huruf (-3 poin), bantuan kata (-10 poin), dan bonus penyelesaian (+20 poin) dicatat di ledger transaksi.
- **Audit Logging & CSV Export**: Semua aktivitas penting dicatat. Ekspor hasil dalam format CSV yang aman dari formula injection.
- **Deployment Terpadu**: Terpaket dengan Docker Compose dan Caddy reverse proxy dengan penyediaan TLS/HTTPS otomatis.

---

## Struktur Repositori

```
.
├── backend/                  # Layanan backend FastAPI & SQLAlchemy
│   ├── app/
│   │   ├── api/              # Route handlers: auth, teacher, play, public
│   │   ├── core/             # Konfigurasi, keamanan, hashing, rate limit
│   │   ├── db/               # Inisialisasi engine SQLite WAL & Base model
│   │   ├── models/           # SQLAlchemy models: auth, content, game, audit
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Puzzle parser/validator, scoring, audit
│   ├── migrations/           # Skrip migrasi schema Alembic
│   ├── tests/                # Unit test (puzzle, scoring, auth)
│   └── pyproject.toml
├── content/
│   └── puzzles/
│       └── school-v1.json    # Sampel puzzle tervalidasi tema sekolah 10x10
├── deploy/
│   ├── Caddyfile             # Konfigurasi Caddy reverse proxy & TLS
│   └── backup.sh             # Skrip cadangan SQLite berkala
├── docs/
│   ├── PUZZLE_FORMAT.md      # Spesifikasi format JSON dan validasi
│   ├── RUNBOOK.md            # Panduan operasional & pemeliharaan VPS
│   ├── SCORING.md            # Aturan skor dan penentu peringkat
│   └── USER_GUIDE.md         # Panduan penggunaan untuk guru dan siswa
├── scripts/
│   └── reset_teacher_password.py # Utilitas CLI reset kata sandi guru
├── docker-compose.yml
├── .env.example
├── PLAN.md                   # Rencana implementasi teknis
└── note.md                   # Catatan progres pekerjaan
```

---

## Menjalankan Secara Lokal (Pengembangan)

### Backend
1. Masuk ke direktori `backend`:
   ```bash
   cd backend
   ```
2. Buat virtual environment dan pasang dependensi:
   ```bash
   uv venv
   uv pip install -e ".[dev]"
   ```
3. Jalankan migrasi basis data:
   ```bash
   alembic upgrade head
   ```
4. Jalankan server backend:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Akses dokumentasi OpenAPI di `http://localhost:8000/docs`.

### Menjalankan Tes
```bash
pytest
```

---

## Lisensi & Hak Cipta
Dibuat untuk Tugas Kuliah (IPB Moments) — English Game Crossword Competition.

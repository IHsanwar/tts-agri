# Runbook Operasional TTS Arena

Panduan operasional server, deployment, pemeliharaan basis data, dan penanganan insiden.

## Prasyarat Server VPS

- OS: Linux (Ubuntu 22.04 LTS atau 24.04 LTS direkomendasikan)
- Port terbuka: 80 (HTTP) dan 443 (HTTPS)
- Docker Engine dan Docker Compose Plugin terpasang.
- Domain/subdomain publik yang mengarah ke IP publik server (misal: `tts.sekolah.sch.id`).

## Deployment dengan Docker Compose

1. **Clone repository**:
   ```bash
   git clone <repo-url> /opt/tts-arena
   cd /opt/tts-arena
   ```

2. **Siapkan berkas lingkungan (`.env`)**:
   ```bash
   cp .env.example .env
   ```
   Sesuaikan variabel:
   - `DOMAIN=tts.sekolah.sch.id`
   - `INVITE_CODE=kode-undangan-rahasia-guru`
   - `TTS_COOKIE_SECURE=true`

3. **Jalankan container**:
   ```bash
   docker compose up -d --build
   ```
   Caddy akan otomatis mengonfigurasi sertifikat SSL/TLS gratis melalui Let's Encrypt / ZeroSSL.

4. **Verifikasi status layanan**:
   ```bash
   docker compose ps
   curl -f http://localhost:8000/api/health
   ```

## Backup & Pemulihan Basis Data

Basis data disimpan dalam format SQLite WAL di volume `./data/tts.sqlite`.

### Backup Manual
Jalankan skrip backup di dalam kontainer backend:
```bash
docker compose exec backend /bin/sh -c "/app/deploy/backup.sh"
```
File cadangan tersimpan di folder `./backups/`.

### Pemulihan (Restore)
1. Hentikan container backend:
   ```bash
   docker compose stop backend
   ```
2. Ganti file database:
   ```bash
   cp ./backups/tts_YYYYMMDD_HHMMSS.sqlite ./data/tts.sqlite
   ```
3. Mulai ulang kontainer backend:
   ```bash
   docker compose start backend
   ```

## Reset Password Guru via CLI

Jika guru lupa kata sandi:
```bash
docker compose exec backend python /app/scripts/reset_teacher_password.py "guru@sekolah.sch.id" "PasswordBaru123!"
```


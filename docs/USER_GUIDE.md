# Panduan Pengguna TTS Arena

Panduan penggunaan aplikasi untuk Guru dan Siswa.

---

## 1. Panduan untuk Guru

### Registrasi & Masuk Akun
1. Buka halaman `/teacher/register`.
2. Masukkan nama lengkap, alamat email, kata sandi (minimal 10 karakter), dan **Kode Undangan Guru** yang diberikan oleh administrator sekolah.
3. Setelah berhasil mendaftar, Anda langsung masuk ke Dashboard Guru.

### Mengelola Puzzle
1. Masuk ke menu **Puzzle**.
2. Klik **Unggah Puzzle** dan pilih berkas JSON sesuai format (lihat `docs/PUZZLE_FORMAT.md`).
3. Sistem akan memvalidasi grid dan kata. Anda dapat melihat pratinjau grid beserta jawaban dan nomor sel.
4. Klik **Publikasikan** agar puzzle siap digunakan dalam kompetisi.

### Mengelola Grup
1. Masuk ke menu **Grup**.
2. Klik **Tambah Grup**, beri nama grup (contoh: "Kelompok 1", "Tim Garuda").
3. Sistem akan menghasilkan **Kode Grup** (4 karakter) dan **PIN Grup** (6 digit angka).
4. Catat atau cetak PIN tersebut untuk dibagikan kepada peserta (PIN hanya ditampilkan sekali saat dibuat). Jika peserta lupa PIN, Anda dapat menekan tombol **Reset PIN**.

### Menyelenggarakan Kompetisi
1. Masuk ke menu **Kompetisi** lalu klik **Buat Kompetisi**.
2. Masukkan judul kompetisi, pilih puzzle yang telah dipublikasikan, centang grup peserta yang berpartisipasi, dan tentukan durasi pengerjaan (misal 15 menit).
3. Klik **Buka Kompetisi** (status menjadi `open`). Bagikan **Kode Kompetisi** (6 karakter) kepada siswa.
4. Tunggu siswa masuk ke ruang tunggu (waiting room).
5. Setelah semua siswa siap, klik **Mulai Kompetisi** (status menjadi `running`).
6. Guru dapat memantau progres langsung (live monitor) setiap grup, memperpanjang durasi jika diperlukan, atau membatalkan sesi grup tertentu (`void`) jika terjadi pelanggaran.
7. Setelah selesai, klik **Tutup Kompetisi** dan unduh laporan hasil dalam format CSV.

---

## 2. Panduan untuk Peserta (Siswa)

### Bergabung ke Kompetisi
1. Buka halaman utama aplikasi `/`.
2. Masukkan:
   - **Kode Kompetisi** (dari guru)
   - **Kode Grup**
   - **PIN Grup**
3. Klik **Gabung**. Anda akan masuk ke ruang tunggu sampai guru memulai kompetisi.

### Bermain Crossword
1. Gunakan komputer atau laptop dengan keyboard fisik.
2. **Navigasi Keyboard**:
   - Huruf `A-Z`: Mengisi huruf pada kotak yang aktif.
   - `Backspace`: Menghapus huruf dan mundur ke kotak sebelumnya.
   - `Panah (Arrow Keys)`: Berpindah kotak.
   - `Tab` / `Shift+Tab`: Pindah ke kata berikutnya atau sebelumnya.
   - `Enter` / Klik sel yang sama: Mengubah arah (Across $\leftrightarrow$ Down).
3. Ketika semua huruf dalam satu kata terisi lengkap, sistem otomatis memeriksa jawaban ke server:
   - Warna **Hijau**: Jawaban benar (+10 poin). Kotak terkunci.
   - Warna **Merah**: Jawaban masih keliru (0 poin). Anda dapat memperbaiki kembali.
4. **Bantuan (Hint)**:
   - *Buka 1 Huruf*: Mengurangi 3 poin, membuka huruf pada kotak yang dipilih.
   - *Buka Seluruh Kata*: Mengurangi 10 poin, membuka seluruh kata dan mengubah status kata menjadi berbantuan.
5. Selesaikan seluruh kata sebelum timer berakhir untuk mendapatkan bonus +20 poin!


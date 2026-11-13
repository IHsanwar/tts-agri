# Aturan Penilaian & Skor TTS Arena

Platform TTS Arena menggunakan sistem penilaian **server-authoritative** dan **deterministik** dengan pencatatan mutasi transaksi (`score_ledger`).

## Komponen Poin

1. **Penyelesaian Kata Benar (`word_submit`)**
   - Nilai: **+10 poin**
   - Diberikan sekali per kata yang berhasil dijawab benar.
   - Sifat idempoten melalui `event_id` unik dan constraint basis data `(session_id, "word:<entry_id>")`.

2. **Jawaban Salah**
   - Nilai: **0 poin** (tidak ada penalti pengurangan poin).
   - Rate limit proteksi: maksimal 10 percobaan salah per menit per grup untuk mencegah teknik brute force.

3. **Bantuan Huruf (`hint_letter`)**
   - Biaya: **-3 poin** per huruf yang diminta.
   - Maksimal 2 petunjuk huruf per kata.
   - Mengembalikan huruf jawaban yang benar untuk sel yang dipilih dan mengunci sel tersebut di tampilan peserta.

4. **Bantuan Kata Penuh (`hint_word`)**
   - Biaya: **-10 poin**
   - Status kata berubah menjadi `assisted`.
   - Mengisi seluruh huruf pada kata tersebut dan menguncinya. Kata dengan status `assisted` tidak memperoleh +10 poin kata benar.

5. **Bonus Penyelesaian Seluruh Puzzle (`completion`)**
   - Nilai: **+20 poin**
   - Diberikan otomatis di server ketika seluruh kata dalam puzzle telah berstatus `solved` atau `assisted` sebelum batas waktu kompetisi berakhir.

## Batasan & Peringkat

- **Floor Nol**: Skor akhir yang ditampilkan dan diperhitungkan selalu dibatasi minimal 0:
  $$\text{Skor} = \max(0, \sum \Delta_{\text{ledger}})$$
- **Penentu Peringkat (Tie-Breaking)**:
  1. Skor Tertinggi (`Score DESC`)
  2. Waktu Selesai Tercepat (`Completed At ASC`, nulls last)
  3. Urutan Abjad Nama Grup (`Group Name ASC`)
- **Diskualifikasi / Pembatalan (`voided`)**:
  Sesi yang dibatalkan oleh guru (`void`) dikeluarkan dari perhitungan leaderboard dan diberi tanda status diskualifikasi.


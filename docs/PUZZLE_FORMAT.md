# Format Puzzle TTS Arena (JSON)

Dokumen ini menjelaskan struktur data puzzle teka-teki silang (crossword) untuk platform TTS Arena.

## Struktur JSON

```json
{
  "schema_version": 1,
  "version": "school-v1",
  "title": "School Life",
  "language": "en",
  "grid": [
    "###G######",
    "##LESSON##",
    "###E##P###",
    "BOOK##E###",
    "###S##N###",
    "####DESK##",
    "##########",
    "##########",
    "##########",
    "##########"
  ],
  "entries": [
    {
      "id": "lesson",
      "row": 1,
      "col": 2,
      "direction": "across",
      "answer": "LESSON",
      "clue_en": "A period of learning or teaching in a class.",
      "clue_id": "Masa atau waktu pembelajaran di kelas."
    }
  ]
}
```

## Spesifikasi Field

1. `schema_version` (integer): Versi skema, saat ini harus bernilai `1`.
2. `version` (string): Slug versi unik per guru, 1-60 karakter (`^[a-z0-9-]+$`).
3. `title` (string): Judul puzzle, 1-120 karakter.
4. `language` (string): Bahasa teka-teki, default `"en"`.
5. `grid` (array of string):
   - Dimensi grid antara 5x5 hingga 20x20. Maksimal 400 sel.
   - Semua baris harus sama panjang (grid persegi/persegi panjang valid).
   - Karakter hanya diperbolehkan `A-Z` (huruf kapital) dan `#` (sel hitam / blok tertutup).
6. `entries` (array of object):
   - `id` (string): Identifier unik untuk setiap kata dalam puzzle.
   - `row` (integer): Indeks baris awal (0-indexed).
   - `col` (integer): Indeks kolom awal (0-indexed).
   - `direction` (string): Arah kata, `"across"` (mendatar) atau `"down"` (menurun).
   - `answer` (string): Jawaban huruf kapital (panjang minimal 2 karakter), harus persis cocok dengan huruf di grid.
   - `clue_en` (string): Petunjuk dalam bahasa Inggris (1-300 karakter).
   - `clue_id` (string): Petunjuk dalam bahasa Indonesia (1-300 karakter).

## Aturan Validasi

### Error (Memblokir Publikasi)
- Ukuran grid di luar batas (5-20 baris/kolom atau > 400 sel).
- Baris grid tidak sama panjang.
- Karakter di luar `A-Z` dan `#`.
- Posisi entry keluar dari batas grid.
- Entry menabrak sel blok (`#`).
- Huruf pada `answer` tidak cocok dengan huruf pada `grid`.
- Sel sebelum entry dimulai atau sel setelah entry berakhir bukan blok atau batas grid (kata terpotong di tengah grid).
- Sel putih tidak tercakup oleh entry mana pun (orphan white cells).
- Tidak ada entry arah across atau tidak ada entry arah down.
- Ukuran payload JSON melebihi 512KB.

### Warning (Peringatan, Tidak Memblokir)
- Teks petunjuk mengandung kata jawaban.
- Sel putih hanya dilalui oleh satu arah saja (unchecked cell).


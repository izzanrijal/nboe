# Revisi `template_workbook_soal_board.docx` — Workbook sebagai *Attachment Prompt* untuk Generate Excel

## Pemahaman ulang tujuan

Alur yang user inginkan:

```
Penyusun isi workbook (.docx)
        ↓
Workbook dilampirkan ke prompt AI (ChatGPT/Claude/Lovable AI)
        ↓
AI membaca workbook + instruksi di dalamnya
        ↓
AI menghasilkan file Excel (.xlsx) sesuai schema importer aplikasi
        ↓
Excel di-upload via Admin → Cases → Import Excel
```

Jadi workbook berfungsi **dua peran sekaligus**:
1. **Form isian manusia** — mudah diisi penyusun soal (boleh narasi bebas, poin-poin, tabel kasar).
2. **Spesifikasi teknis untuk AI** — berisi kontrak skema Excel yang harus dipatuhi AI saat konversi.

## Schema target (sumber: `src/components/admin/ExcelImporter.tsx`)

File Excel hasil generate harus berisi 2 sheet:

**Sheet `Cases`** — header baris 1, data mulai baris 2:
| Kolom | Tipe | Catatan |
|---|---|---|
| `title` | string | Wajib unik; jadi kunci join ke Rubric |
| `exam_mode` | enum | `oral_board` atau `panel_exam` |
| `initial_prompt` | longtext | Vignette pasien untuk reading phase |
| `questions_text` | longtext | Daftar pertanyaan penguji (multi-line: pakai line break dalam cell) |
| `answer_key_text` | longtext | Kunci jawaban (admin-only, masuk ke `case_answer_keys`) |
| `reading_time_seconds` | int | Default 120 |
| `time_limit_seconds` | int | Default 360 |
| `show_results_to_candidate` | bool | `TRUE` / `FALSE` |

**Sheet `Rubric`** — banyak baris per kasus:
| Kolom | Tipe | Catatan |
|---|---|---|
| `case_title` | string | Harus identik dengan `title` di Cases |
| `item_text` | string | Butir tilikan |
| `points` | number | Bobot |
| `is_critical` | bool | `TRUE` / `FALSE` |

Aset (gambar EKG, echo, audio, dsb.) **tidak** masuk Excel — di-upload manual setelah import via tombol Upload pada baris kasus (`AssetUploader`).

## Struktur workbook baru

### Halaman 1 — INSTRUKSI UNTUK AI (wajib, diletakkan paling depan)

Blok teks tegas yang berfungsi sebagai *meta-prompt*. Penyusun cukup menulis: *"Generate Excel sesuai instruksi di halaman 1 dokumen terlampir"* dan AI akan tahu apa yang harus dilakukan. Isi blok:

- Peran: "Anda adalah konverter. Tugas Anda mengubah workbook ini menjadi satu file Excel `.xlsx`."
- Schema persis 2 sheet di atas, termasuk nama kolom (case-sensitive, snake_case), tipe, default, dan enum.
- Aturan ketat:
  - Output **hanya** file `.xlsx`, tanpa narasi tambahan.
  - Nama kolom **persis** seperti spesifikasi (huruf kecil, underscore).
  - `case_title` di Rubric **identik** dengan `title` di Cases (case-sensitive, trim spasi).
  - Multi-line cell: pakai line break dalam cell (Alt+Enter equivalent / `\n`), bukan baris baru di Excel.
  - `exam_mode` hanya boleh `oral_board` atau `panel_exam`.
  - Boolean ditulis `TRUE`/`FALSE` (huruf besar).
  - Jika field opsional kosong, isi default (reading 120, time_limit 360, show_results FALSE).
  - Jika satu workbook berisi banyak kasus → satu baris per kasus di Cases, banyak baris di Rubric.
  - Aset tidak dimasukkan ke Excel; cukup pertahankan di lampiran terpisah.
- Contoh output mini (2 baris Cases, 4 baris Rubric) sebagai *few-shot reference*.

### Halaman 2 dst. — FORM ISIAN PENYUSUN (per kasus, ulangi blok untuk multi-kasus)

Format **bebas tapi terstruktur** — penyusun boleh menulis narasi panjang; AI yang akan memadatkan/memformat saat konversi.

**Blok A — Identitas Kasus**
- Judul kasus
- Mode ujian (oral_board / panel_exam) — beri penjelasan singkat tiap pilihan
- Reading time (default 120 dtk)
- Time limit aktif (default 360 dtk)
- Tampilkan hasil ke kandidat? (Ya/Tidak)

**Blok B — Vignette / Initial Prompt**
Kotak teks bebas. Anjuran isi: identitas pasien, keluhan utama, riwayat singkat, vital sign awal. Akan dipetakan ke `initial_prompt`.

**Blok C — Pertanyaan Penguji**
Daftar bernomor (boleh ditulis bebas). Akan dipetakan ke `questions_text`.

**Blok D — Kunci Jawaban**
Struktur anjuran: Diagnosis Utama, DD, Pemeriksaan Penunjang, Tatalaksana, Edukasi, Prognosis. Akan dipetakan ke `answer_key_text`.

**Blok E — Rubrik Tilikan**
Tabel 3 kolom: butir tilikan | bobot | kritis (Ya/Tidak). Anjuran 10–20 item. Akan dipetakan ke sheet `Rubric` dengan `case_title` = judul Blok A.

**Blok F — Catatan Aset (tidak masuk Excel)**
Daftar lampiran yang nanti di-upload manual: nama file/deskripsi, kategori (case_media / examination / additional_info), trigger keywords bila kondisional. Murni dokumentasi untuk penyusun — AI diinstruksikan **mengabaikan** blok ini saat membuat Excel.

### Halaman akhir — Checklist Pra-Konversi
Daftar centang singkat: judul tiap kasus unik, mode valid, rubrik ≥ 5 item, tidak ada baris kosong, semua field wajib terisi.

## Implementasi teknis

- Tools: skill `docx` (`docx-js` via Node).
- File output: overwrite `/mnt/documents/template_workbook_soal_board.docx`.
- Font Arial, US Letter, margin 1", heading bertingkat.
- Blok "INSTRUKSI UNTUK AI" diberi shading mencolok (mis. background kuning lembut `FFF4CC`) agar penyusun tidak mengeditnya.
- Sediakan 3 blok kasus kosong sebagai contoh (penyusun bisa duplikasi halaman untuk tambah).
- Tambahkan satu contoh kasus terisi (mini-vignette + 5 rubrik) di bagian akhir sebagai referensi gaya.
- Setelah generate: validasi via `validate_document.py`, lalu QA dengan render PDF → image semua halaman.
- Tidak menyentuh kode aplikasi; hanya artefak dokumen.

## Hasil akhir

Satu file `template_workbook_soal_board.docx` di `/mnt/documents/` yang:
- Bisa diisi penyusun soal dalam gaya naratif (cepat, manusiawi).
- Begitu dilampirkan ke prompt AI, AI punya semua yang dibutuhkan untuk menghasilkan `.xlsx` valid yang langsung lolos importer aplikasi tanpa revisi manual.

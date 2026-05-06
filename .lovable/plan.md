# Plan: Template DOCX "Workbook Soal Ujian Board"

## Tujuan
Buat satu file `.docx` yang berfungsi sebagai **briefing form**. Anda isi field-fieldnya, copy seluruh isi ke chat, lalu saya generate soal OSCE/Oral Board lengkap (skenario + dialog + rubrik tilikan berbobot + answer key + cheat sheet) dengan format konsisten dengan Station 1–5 yang sudah dibuat.

## Lokasi Output
`/mnt/documents/template_workbook_soal_board.docx` (~6–8 halaman)

## Struktur Workbook (8 Bagian)

**BAGIAN A — Identitas Station**
- Nama station, kategori (Vaskular/HF/IACC/Pediatri/dll), level (PPDS-1/2/3/Konsultan), durasi total, reading time, exam mode (oral_board / panel_exam).

**BAGIAN B — Blueprint Kompetensi**
- Domain kompetensi (Knowledge/Skill/Attitude), guideline acuan (ESC/AHA/PERKI tahun), referensi utama (textbook/trial), kata kunci high-yield (≤15 item).

**BAGIAN C — Konteks Klinis Inti** (boleh diisi bullet kasar — saya akan ekspansi)
- Diagnosis utama + diagnosis banding wajib
- Patofisiologi singkat (3–5 poin)
- Red flags / pitfall
- Pesan pembelajaran (take-home message) max 5

**BAGIAN D — Skenario OSCE** (template untuk 1–5 skenario)
Per skenario: judul, profil pasien (umur/jenis kelamin/komorbid), vital sign, hasil pemeriksaan (EKG/echo/lab/imaging — boleh narasi), pertanyaan inti penguji (3–6), tindakan/keputusan kunci yang diharapkan.

**BAGIAN E — Bobot Rubrik & Critical Actions**
- Total poin (default 100)
- Distribusi: Anamnesis %, Pemeriksaan %, Diagnosis %, Tatalaksana %, Komunikasi %
- **Critical action** (auto-fail jika terlewat) — daftar 1–3 item
- Passing score (default 70%)

**BAGIAN F — Bank Soal Tambahan**
- Jumlah MCQ/SAQ yang diinginkan (default 20)
- Topik fokus tambahan untuk bank soal
- Sertakan trial/landmark study? (Y/N + daftar)

**BAGIAN G — Output Preferensi**
- Bahasa (Indonesia/Inggris/campur)
- Panjang target (kata): default 6.500–7.500
- Sertakan H-1 cheat sheet? (Y/N)
- Sertakan tabel dosis obat? (Y/N)
- Format file akhir (markdown only / + PDF / + import ke Excel uploader)

**BAGIAN H — Soal Historis / Referensi Tambahan**
- Free-text area: tempel soal historis, foto deskripsi, nomor halaman buku, link guideline.
- Catatan khusus untuk AI (style penulisan, tone, hindari topik X, dll).

## Fitur Visual DOCX
- Font Arial 11pt, heading biru gelap (#1E3A5F konsisten dengan branding klinis)
- Tabel terstruktur untuk Bagian A, D, E (mudah diisi di Word)
- Checkbox "☐" untuk pilihan Y/N
- Contoh terisi (italic abu-abu) di Bagian C dan D Skenario #1, sebagai panduan
- Halaman terakhir: **"Cara Pakai"** — 4 langkah: (1) Isi semua field, (2) Select All + Copy, (3) Paste ke chat dengan prefix `Generate soal:`, (4) Tunggu AI rakit station lengkap.

## Teknis Implementasi
- Gunakan skill `docx` (docx-js via Node) — sudah tersedia.
- Page US Letter, margin 1", style Heading1/2 di-override.
- Validasi via `validate_document.py`, lalu QA: convert ke PDF + ambil screenshot tiap halaman untuk cek layout.
- Tidak menyentuh codebase project.

## Setelah Approve
1. Tulis script Node generator di `/tmp/`.
2. Generate `.docx` ke `/mnt/documents/`.
3. QA: PDF + image preview tiap halaman, perbaiki bila ada overflow.
4. Kirim `<lov-artifact>` agar bisa diunduh.
5. Pesan akhir: ringkas isi 8 bagian + instruksi cara pakai singkat.

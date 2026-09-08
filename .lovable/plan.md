# Plan: Endpoint & Skill untuk AI Agent Input Soal

Tujuan: satu endpoint aman + satu file SKILL.md siap-download yang bisa saya berikan ke AI agent (Hermes / OpenClaw / Claude Code) supaya mereka bisa mengirim soal baru yang lengkap langsung ke aplikasi.

## 1. Upgrade endpoint `ingest-case`

Endpoint sudah ada (`POST /functions/v1/ingest-case`, validasi header `X-Agent-Api-Key` terhadap secret `CASE_INGEST_API_KEY`). Yang ditambahkan:

- **Waktu dalam menit**: terima `reading_time_minutes` dan `time_limit_minutes` (lebih natural untuk agent), tetap menerima versi `_seconds` untuk kompatibilitas. Konversi ke detik saat insert.
- **Kunci jawaban tersinkron**: selain isi `answer_key_text` di `clinical_cases`, otomatis tulis juga ke `case_answer_keys` supaya penilaian AI langsung aktif (seperti soal-soal yang sudah ada).
- **Rubrik aktif**: simpan `checklist_rubric` sebagai `{ enabled: true, items: [...] }` supaya daftar tilik langsung menyala.
- **Catatan media**: terima `media_notes[]` (deskripsi + kategori + trigger keywords). Media tidak diupload otomatis; daftar ini dikembalikan di response supaya penguji tahu apa yang perlu diupload manual.
- **Kepemilikan**: isi `created_by` dengan admin master (opsional field `created_by_email`) agar soal muncul rapi di Case Manager.
- **Endpoint bantu**: `GET /functions/v1/ingest-case` (dengan API key) mengembalikan skema JSON + contoh, supaya agent bisa self-check tanpa dokumen.

Gerbang kualitas dipertahankan dan disebutkan eksplisit di error message: panjang minimum vignette/tugas/kunci jawaban, minimal 5 tugas bernomor, minimal 15 butir rubrik, minimal 8 butir kritis, total poin ≥ 40, judul unik (409 kalau duplikat).

Kode respons: 200 sukses, 400 validasi, 401 token salah, 409 duplikat, 500 error server.

## 2. File SKILL.md untuk didownload

Buat `/mnt/documents/agent_skills/nboe-case-author/SKILL.md` (plus referensi & contoh) berisi:

- Kapan skill dipakai, dan aturan mutlak: soal harus setara kualitas ujian asli (contoh: 6MWT, DUS Karotis, ABPM, RHC anak).
- Struktur wajib satu soal: judul, mode ujian, menit baca, menit ujian, vignette pasien lengkap (riwayat, pemeriksaan fisis, penunjang), daftar tugas bernomor (6 tugas standar), kunci jawaban naratif berisi perkiraan verbalisasi benar peserta, dan rubrik daftar tilik biner dengan poin + tanda kritis.
- Aturan penting: tugas **tidak boleh membocorkan** isi rubrik — peserta menyusun urutan sendiri.
- Cara kirim: contoh `curl` lengkap + variabel token, contoh body JSON penuh (satu contoh soal jadi), dan daftar error umum beserta cara memperbaikinya.
- Catatan media: agent hanya membuat daftar media yang perlu diupload manual + trigger keywords.
- Cara pasang di Claude Code / Hermes / OpenClaw.

File yang sama juga diperbarui di skill internal proyek agar tetap sinkron. Semuanya dibundel jadi satu file ZIP di `/mnt/documents` supaya mudah didownload dan diberikan ke agent.

## 3. Yang tidak diubah
- Tidak ada tabel baru, tidak ada perubahan RLS.
- Upload media tetap manual lewat Asset Uploader.
- UI admin tidak diubah.

## Ringkasan teknis
| Item | Detail |
|---|---|
| Endpoint | `POST/GET /functions/v1/ingest-case` |
| Auth | Header `X-Agent-Api-Key` = secret `CASE_INGEST_API_KEY` |
| Tabel tujuan | `clinical_cases` + `case_answer_keys` (service role) |
| Field waktu | `reading_time_minutes`, `time_limit_minutes` (fallback `_seconds`) |
| Deliverable | `/mnt/documents/agent_skills/nboe-case-author/` + ZIP |

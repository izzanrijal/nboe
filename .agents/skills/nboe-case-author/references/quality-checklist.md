# Quality Checklist — jalankan SEBELUM submit

Centang semua. Kalau ada yang gagal, revisi dulu.

## Konten klinis
- [ ] Topik & prosedur dipetakan ke guideline mutakhir (ESC / AHA / Perki) — sebut sumbernya di answer_key kalau ada.
- [ ] Skenario pasien realistis: umur, jenis kelamin, riwayat, obat, PF, penunjang konsisten.
- [ ] Tugas ke kandidat jelas, tidak ambigu, tidak tumpang tindih.
- [ ] Angka spesifik dipakai: threshold diagnostik, dosis, ukuran, waktu, %. Bukan "beberapa" atau "cukup".
- [ ] Indikasi ≥5 disebut eksplisit (kalau ada tugas indikasi).
- [ ] Kontraindikasi / red flag disebut minimal sekali.
- [ ] Edukasi pasien komprehensif: aktivitas, tanda bahaya, kepatuhan obat, follow-up.

## Format payload
- [ ] `title` unik & mengikuti pola `TOPIK — Skenario (Inisial, umur th)`.
- [ ] `initial_prompt` ≥400 char, ada blok RIWAYAT + PEMERIKSAAN + TUGAS.
- [ ] `questions_text` punya ≥5 nomor `1.` … `5.`.
- [ ] `answer_key_text` ≥800 char, urut sesuai questions.
- [ ] `checklist_rubric.items` ≥15 item.
- [ ] `isCritical:true` ≥8 item.
- [ ] Total `points` ≥40.
- [ ] Setiap item rubrik dapat dinilai objektif (kata kerja jelas: "menyebutkan", "memasang", "menghitung").

## Konsistensi silang
- [ ] Setiap tugas di `questions_text` punya jawaban di `answer_key_text`.
- [ ] Setiap kompetensi di `answer_key_text` punya minimal 1 item rubrik.
- [ ] Tidak ada item rubrik yang menilai hal di luar tugas.

## Kebijakan platform
- [ ] Tidak ada instruksi ke AI untuk menafsirkan media klinis (EKG/USG/CT) — interpretasi dilakukan kandidat/manusia.
- [ ] Tidak menyimpan API key / data pasien nyata / PHI.

## Setelah submit
- [ ] Terima 200 + `id` — catat ID.
- [ ] Kirim ke user: daftar media yang harus di-upload manual + trigger keywords (lihat `media-hints.md`).

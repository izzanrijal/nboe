---
name: nboe-case-author
description: Author dan submit soal ujian kardiovaskular (OSCE / oral board) berkualitas ujian nasional ke platform NBOE (Neuro Board Oral Exam) via endpoint ingest-case. Gunakan saat user meminta pembuatan soal ujian jantung, OSCE kardio, atau oral board dengan format Perki / ESC untuk simulasi ujian dokter spesialis jantung.
---

# NBOE Case Author

Skill ini mengajarkan AI agent (Hermes / OpenClaw / Claude Code) cara membuat dan mem-push soal ujian kardiovaskular berkualitas tinggi ke platform NBOE.

## Kapan pakai skill ini
- User minta "buat soal OSCE / oral board" untuk platform NBOE.
- User menyebut topik klinis kardiologi (6MWT, DUS Karotis, ABPM, TEE, PCI post-care, dll) dan ingin dipakai sebagai simulasi ujian.
- User memberi rubrik mentah / checklist Perki dan minta dikonversi ke case scenario.

## Workflow wajib

1. **Riset dulu**. Cari guideline mutakhir (ESC, AHA/ACC, Perki) untuk topik yang diminta. Kutip angka spesifik (threshold, dosis, ukuran) — jangan mengarang.
2. **Rancang skenario pasien** yang realistis: nama inisial, umur, riwayat, obat, PF, EKG, lab, kemudian TUGAS.
3. **Susun 6 tugas standar** (urutan wajib untuk oral board prosedural):
   1. Perkenalan & konfirmasi identitas
   2. Penjelasan prosedur + minimal 5 indikasi (+ relevansi kasus)
   3. Informed consent verbal
   4. Persiapan / persiapan alat / peragaan teknis
   5. Instruksi / edukasi pasien (komprehensif)
   6. Interpretasi hasil + rencana intervensi + edukasi lanjutan
4. **Tulis answer key lengkap** (≥800 karakter) — model jawaban ideal per tugas, dengan angka spesifik.
5. **Bangun rubrik ≥15 item**, minimal 8 `isCritical:true`, total points ≥40. Baca `references/format-spec.md` dan `references/quality-checklist.md`.
6. **Validasi lokal** dengan quality-checklist sebelum submit.
7. **POST** ke endpoint. Kalau 400 → perbaiki sesuai pesan error, kirim ulang.
8. **Laporkan ke user** ID case yang dibuat + list media yang harus di-upload manual (lihat `references/media-hints.md`).

## Endpoint

```
POST https://nowebjmwrtkspvdwgevj.supabase.co/functions/v1/ingest-case
Headers:
  Content-Type: application/json
  X-Agent-Api-Key: <CASE_INGEST_API_KEY>   # env var, jangan hardcode
Body: JSON sesuai schema (lihat references/format-spec.md)
```

### Response
- `200`: `{ id, title, rubric_items, critical_items, total_points }`
- `400`: validasi gagal — baca `error` + `details`, perbaiki, kirim ulang.
- `401`: API key salah / tidak ada.
- `409`: title duplikat — ubah title (tambahkan varian skenario).

## Cara submit

Simpan payload JSON, lalu:

```bash
export CASE_INGEST_API_KEY="<key-dari-user>"
bash scripts/submit_case.sh path/to/case.json
```

Atau curl langsung:

```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "X-Agent-Api-Key: $CASE_INGEST_API_KEY" \
  --data-binary @case.json \
  https://nowebjmwrtkspvdwgevj.supabase.co/functions/v1/ingest-case
```

## Aturan mutlak
- **Bahasa Indonesia klinis** untuk seluruh konten soal.
- **Jangan** submit soal tanpa angka/threshold spesifik dari guideline.
- **Jangan** upload media — hanya beri user daftar media + trigger keywords.
- **Jangan** meng-generate atau memasukkan interpretasi AI atas gambar/klip (kebijakan platform).
- **Jangan** menghardcode API key di file yang akan di-commit.

## Bacaan pendukung
- `references/format-spec.md` — schema JSON field-by-field.
- `references/quality-checklist.md` — checklist wajib sebelum kirim.
- `references/media-hints.md` — cara melaporkan kebutuhan media ke user.
- `assets/example_case.json` — template soal lengkap.
- `scripts/submit_case.sh` — helper submit.

## Distribusi ke agent lain
- **Claude Code**: copy folder ini ke `~/.claude/skills/nboe-case-author/` atau `.claude/skills/` di project.
- **Hermes / OpenClaw**: masukkan isi `SKILL.md` + references ke system prompt agent, atau mount folder sebagai tool doc.
- Set env `CASE_INGEST_API_KEY` di environment agent — minta ke admin NBOE.

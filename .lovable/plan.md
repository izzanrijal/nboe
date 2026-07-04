# Plan: AI Agent → DB Case Ingestion

Tujuan: AI agent eksternal (Hermes / OpenClaw / Claude Code) bisa mem-POST soal baru langsung ke database Supabase melalui satu endpoint terjaga, dengan format yang **wajib** komprehensif seperti kualitas soal 6MWT / DUS Karotis / ABPM yang sudah ada.

## 1. Endpoint: Edge Function `ingest-case`

File baru: `supabase/functions/ingest-case/index.ts`
Config: `verify_jwt = false` (auth pakai API key sendiri).

**URL**: `https://nowebjmwrtkspvdwgevj.supabase.co/functions/v1/ingest-case`

**Auth**: header `X-Agent-Api-Key: <CASE_INGEST_API_KEY>` — secret baru yang saya generate & simpan di Supabase Secrets. Tanpa key valid → 401.

**Method**: `POST` JSON.

**Request body (validasi ketat via Zod)**:
```json
{
  "title": "string (wajib, format: '<TOPIK> — <Skenario Singkat> (<Inisial>, <umur> th)')",
  "exam_mode": "oral_board" | "osce",
  "reading_time_seconds": 180,
  "time_limit_seconds": 600,
  "show_results_to_candidate": false,
  "initial_prompt": "string (skenario pasien lengkap: riwayat, PF, penunjang, tugas)",
  "questions_text": "string (daftar tugas bernomor)",
  "answer_key_text": "string (model answer lengkap per tugas)",
  "checklist_rubric": {
    "items": [
      { "text": "string", "points": 1-5, "isCritical": true|false }
    ]
  }
}
```

**Validasi minimum kualitas** (400 kalau gagal — biar AI agent nggak nge-push soal sampah):
- `initial_prompt` ≥ 400 karakter & mengandung minimal 3 dari: `RIWAYAT`, `PEMERIKSAAN`, `TUGAS`, `EKG`, `Lab`.
- `questions_text` ≥ 300 karakter & mengandung minimal 5 nomor tugas (`1.` … `5.`).
- `answer_key_text` ≥ 800 karakter.
- `checklist_rubric.items` ≥ 15 item; minimal 8 `isCritical:true`; total points ≥ 40.
- Title unik (cek `SELECT 1 FROM clinical_cases WHERE title = ?`) → 409 kalau duplikat.

**Response 200**:
```json
{ "id": "<uuid>", "title": "...", "rubric_items": 22, "total_points": 62 }
```

**Error**: 400 (validasi), 401 (key salah), 409 (duplikat), 500 (DB error) — dengan pesan spesifik supaya agent bisa self-correct.

Handler pakai `SUPABASE_SERVICE_ROLE_KEY` untuk insert bypass RLS. CORS enabled. Log ringkas (title + jumlah item) ke console.

## 2. Secret baru
Saya generate `CASE_INGEST_API_KEY` (random 48-char) via secrets tool dan tampilkan sekali di chat supaya kamu bisa kasih ke agent.

## 3. Skill lengkap untuk AI agent

Buat direktori skill: `.agents/skills/nboe-case-author/`
- `SKILL.md` — instruksi kapan dipicu ("saat user minta buat soal ujian jantung / OSCE / oral board untuk platform NBOE"), workflow riset (ESC guidelines / Perki), struktur soal, checklist kualitas, cara call endpoint via `curl`, contoh full body.
- `references/format-spec.md` — spec detail tiap field, konvensi penomoran tugas (6 tugas standar: Perkenalan → Prosedur/Indikasi → Consent → Persiapan → Instruksi/Peragaan → Interpretasi/Edukasi), aturan rubric (points 1-5, kapan `isCritical`), gaya bahasa Indonesia klinis + sitasi guideline.
- `references/quality-checklist.md` — checklist wajib sebelum submit (min items, coverage indikasi ≥5, kontraindikasi, angka spesifik/threshold, edukasi komprehensif).
- `references/media-hints.md` — cara AI agent memberi tahu user media apa yang harus di-upload manual (agent TIDAK boleh upload media; hanya list kebutuhan + trigger keywords).
- `scripts/submit_case.sh` — helper script `curl` yang baca JSON dari file dan POST ke endpoint. Baca API key dari env `CASE_INGEST_API_KEY`.
- `assets/example_case.json` — contoh soal lengkap (mengacu ABPM) sebagai template.

Skill akan di-apply via `skills--apply_draft` supaya aktif di workspace.

## 4. Dokumentasi cara distribusi ke Hermes / OpenClaw / Claude Code
Di akhir SKILL.md ada bagian "Distribution":
- Copy folder `.agents/skills/nboe-case-author/` ke direktori skills agent target.
- Set env `CASE_INGEST_API_KEY` di environment agent.
- Untuk Claude Code: taruh di `~/.claude/skills/` atau project `.claude/skills/`.
- Untuk Hermes / OpenClaw: instruksikan sistem prompt untuk mengikuti `SKILL.md`.

## 5. Yang TIDAK termasuk (agar scope tetap fokus)
- Tidak menambah upload media otomatis — media tetap manual via `AssetUploader` (sesuai memory constraint).
- Tidak mengubah UI admin.
- Tidak menambah tabel baru — insert langsung ke `clinical_cases` yang sudah ada.
- Tidak ada perubahan RLS.

## Technical summary
| Item | Detail |
|---|---|
| Endpoint | `POST /functions/v1/ingest-case` |
| Auth | Header `X-Agent-Api-Key` vs `CASE_INGEST_API_KEY` secret |
| DB write | `service_role` insert ke `public.clinical_cases` |
| Validasi | Zod + custom quality gates (length, item count, uniqueness) |
| Skill path | `.agents/skills/nboe-case-author/` |
| Aktivasi skill | `skills--apply_draft` |

Approve untuk saya lanjut build?

# Konfigurasi AI ujian (OpenAI)

Fitur **Jawaban AI** (`generate-model-answer`), **Evaluasi AI** (`evaluate-exam`), dan
**chat pemeriksaan** (`exam-chat`) memakai OpenAI — sama seperti transkripsi Whisper
yang sudah ada.

Integrasi GripHub/DeepSeek **dibatalkan** karena ada floor price yang tidak fair.

## Secrets

| Secret | Wajib | Default | Keterangan |
|---|---|---|---|
| `OPENAI_API_KEY` | **Ya** | — | Sudah ada (dipakai Whisper). Tidak perlu diubah. |
| `OPENAI_MODEL` | Tidak | `gpt-5.6-luna` | Override model bila perlu. |
| `OPENAI_BASE_URL` | Tidak | `https://api.openai.com/v1` | Override base URL bila perlu. |

## Deploy

```bash
supabase functions deploy generate-model-answer evaluate-exam exam-chat
```

## Catatan model

`gpt-5.6-luna` adalah model reasoning, jadi:

- Kode memakai `max_completion_tokens` (bukan `max_tokens`) dengan anggaran
  besar, karena sebagian token terpakai untuk penalaran tersembunyi.
- `temperature` tidak dikirim (tidak didukung sebagian model reasoning).
- Bila anggaran token habis sebelum jawaban ditulis, fungsi memberi pesan jelas
  ("Model kehabisan token...") alih-alih gagal tanpa sebab.

Untuk penilaian, kode meminta `response_format: json_object` **dan** mengulang
sekali dengan instruksi tegas bila model tetap membalas prosa. Parser JSON
memindai objek berimbang, jadi tidak bergantung pada jawaban yang murni JSON.

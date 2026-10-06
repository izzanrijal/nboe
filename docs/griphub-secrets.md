# GripHub (DeepSeek) secrets untuk fitur AI ujian

Fitur **Jawaban AI** (`generate-model-answer`), **Evaluasi AI** (`evaluate-exam`), dan
**chat pemeriksaan** (`exam-chat`) kini memakai GripHub (OpenAI-compatible), bukan lagi
gateway Lovable.

## Secrets yang WAJIB disetel

| Secret | Wajib | Contoh / default | Keterangan |
|---|---|---|---|
| `GRIPHUB_API_KEY` | **Ya** | `gr_xxxxxxxx` | Kunci API GripHub. Tanpa ini fungsi balas error jelas. |
| `GRIPHUB_MODEL` | **Ya** | `deepseek-v4.1-flash` | **Slug model persis** dari dashboard GripHub. Lihat catatan di bawah. |
| `GRIPHUB_BASE_URL` | Tidak | `https://griphubrouter.web.id/v1` | Override bila base URL berubah. |

## Cara setel

```bash
supabase secrets set \
  GRIPHUB_API_KEY="<kunci-anda>" \
  GRIPHUB_MODEL="<slug-model-anda>"

supabase functions deploy generate-model-answer evaluate-exam exam-chat
```

## Catatan penting soal `GRIPHUB_MODEL`

Saya belum bisa memverifikasi **slug model** DeepSeek V4.1 Flash karena `/v1/models`
butuh kunci API. Jadi `GRIPHUB_MODEL` **wajib Anda isi** dengan slug yang benar dari
dashboard GripHub. Kalau salah, fungsi akan mengembalikan error dari GripHub (bukan
gagal senyap).

Untuk melihat daftar model yang tersedia:

```bash
curl -s https://griphubrouter.web.id/v1/models \
  -H "Authorization: Bearer $GRIPHUB_API_KEY" | jq '.data[].id'
```

Lalu set `GRIPHUB_MODEL` ke slug DeepSeek V4.1 Flash yang muncul di daftar itu.

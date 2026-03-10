

# Revisi Format Feedback AI — Lebih Terperinci & Terstruktur

## Tujuan

Mengubah output AI dari 2 field teks bebas (`reasoning` + `tips`) menjadi struktur terperinci per-pertanyaan/topik, sehingga ketika 100 feedback dikumpulkan dan di-ingest ke AI, problematika mahasiswa bisa langsung dipetakan dan diprioritaskan.

## Perubahan

### 1. Update AI Prompt — `supabase/functions/evaluate-exam/index.ts`

Ubah JSON schema yang diminta AI dari:
```json
{
  "reasoning": "string",
  "tips": "string"
}
```

Menjadi:
```json
{
  "reasoning": "Ringkasan keseluruhan penilaian",
  "detailedFeedback": [
    {
      "topic": "Nama topik/pertanyaan (e.g. 'Anamnesis', 'Diagnosis Banding')",
      "questionRef": "Referensi pertanyaan terkait (jika ada)",
      "candidateAnswer": "Ringkasan apa yang dijawab peserta",
      "expectedAnswer": "Ringkasan jawaban yang benar dari kunci jawaban",
      "gaps": ["Poin spesifik yang terlewat atau salah"],
      "misconceptions": ["Kesalahan pemahaman konsep yang terdeteksi"],
      "score": 0-100,
      "feedbackText": "Penjelasan detail per topik dalam Bahasa Indonesia"
    }
  ],
  "overallWeaknesses": ["Kelemahan utama secara keseluruhan"],
  "overallStrengths": ["Kekuatan yang sudah baik"],
  "prioritizedImprovements": ["Saran perbaikan diurutkan dari yang paling kritis"],
  "tips": "Ringkasan saran perbaikan"
}
```

System prompt diperbarui untuk menginstruksikan AI menganalisis per-topik/pertanyaan, mengidentifikasi gap dan misconception, serta memberikan prioritas improvement.

### 2. Update Candidate Results UI — `src/components/exam/CandidateResultsList.tsx`

Tambahkan rendering untuk field baru:
- **Per-topic cards**: Setiap `detailedFeedback` item ditampilkan sebagai card dengan topic, score bar, gap list, dan feedback text
- **Strengths & Weaknesses**: Section ringkasan kekuatan dan kelemahan
- **Prioritized Improvements**: Numbered list saran perbaikan

Backward compatible — jika `detailedFeedback` tidak ada (hasil lama), tampilkan `reasoning` + `tips` seperti sebelumnya.

### 3. Update Admin Results UI — `src/components/admin/ResultsViewer.tsx`

Tambahkan rendering `detailedFeedback` yang sama di panel admin agar admin juga melihat detail per-topik. Backward compatible.

### 4. Redeploy Edge Function

Deploy ulang `evaluate-exam` dengan prompt baru.

## File yang Diubah

| File | Perubahan |
|------|-----------|
| `supabase/functions/evaluate-exam/index.ts` | Update JSON schema & system prompt |
| `src/components/exam/CandidateResultsList.tsx` | Render detailed feedback per-topic |
| `src/components/admin/ResultsViewer.tsx` | Render detailed feedback per-topic |

Tidak perlu migrasi database — `ai_score_report` sudah bertipe `jsonb`.


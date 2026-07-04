# Format Spec — ingest-case payload

Semua field wajib kecuali dinyatakan default.

```jsonc
{
  "title": "TOPIK — Skenario Singkat (Inisial, umur th)",
  //  contoh: "ABPM — Suspek White-Coat vs HT Tidak Terkontrol (Ny. M, 55 th)"
  //  15–200 char, HARUS unik di DB.

  "exam_mode": "oral_board",   // atau "osce". default "oral_board".
  "reading_time_seconds": 180, // 30–900. default 180.
  "time_limit_seconds": 600,   // 120–1800. default 600.
  "show_results_to_candidate": false, // default false (ujian formal).

  "initial_prompt": "…",   // ≥400 char. WAJIB berisi minimal 3 dari:
                           // RIWAYAT, PEMERIKSAAN, TUGAS, EKG, Lab
                           // Format:
                           //   Paragraf pembuka 1–2 kalimat.
                           //   RIWAYAT: bullet dash.
                           //   PEMERIKSAAN FISIK HARI INI: bullet dash.
                           //   (opsional) EKG / Lab / Penunjang.
                           //   TUGAS: paragraf naratif ke kandidat.

  "questions_text": "…",   // ≥300 char, minimal 5 tugas bernomor (1. 2. 3. 4. 5.)
                           // Gaya: judul tugas KAPITAL + 1–3 kalimat instruksi.

  "answer_key_text": "…",  // ≥800 char. Model jawaban ideal per tugas,
                           // urut sesuai questions_text. Sertakan angka
                           // spesifik dari guideline (dosis, threshold, %).

  "checklist_rubric": {
    "items": [
      {
        "text": "Kalimat penilaian aksi/kompetensi (10–500 char)",
        "points": 1,       // 1–5. Kritikal biasanya 3–5.
        "isCritical": true // true untuk item yang harus dilakukan
      }
      // ≥15 item total. ≥8 harus isCritical:true. Total points ≥40.
    ]
  }
}
```

## Konvensi 6 tugas standar (oral_board prosedural)

1. **PERKENALAN & KOMUNIKASI AWAL** — nama, peran, konfirmasi identitas.
2. **PENJELASAN PROSEDUR & INDIKASI** — sebut ≥5 indikasi + relevansi kasus.
3. **INFORMED CONSENT** — verbal, jelas.
4. **PERSIAPAN / PERAGAAN TEKNIS** — alat, posisi, langkah prosedural, kontraindikasi.
5. **INSTRUKSI / EDUKASI PASIEN** — hal boleh/tidak, apa yang dicatat, tanda bahaya.
6. **INTERPRETASI HASIL & INTERVENSI** — kriteria validitas, ambang diagnostik, klasifikasi, rencana lanjutan, edukasi jangka panjang.

Untuk OSCE non-prosedural (mis. konseling murni) boleh 5 tugas, tapi validasi tetap ≥5 nomor.

## Aturan `isCritical`

Tandai `true` untuk item yang **jika tidak dilakukan → kandidat gagal aspek**:
- Perkenalan & identifikasi pasien.
- Informed consent.
- Penyebutan indikasi (dihitung sebagai 1 item multi-kriteria).
- Kontraindikasi absolut / red flag.
- Setiap langkah prosedural yang berpengaruh pada keselamatan / akurasi.
- Ambang diagnostik & rencana intervensi.

Tandai `false` untuk item pendukung (dokumentasi, kenyamanan, hal opsional).

## Contoh nilai poin

| Bobot | Contoh |
|------:|--------|
| 1 | Item pelengkap kecil (mis. "menanyakan pekerjaan pasien"). |
| 2 | Aksi standar tapi tidak menentukan (mis. "menjelaskan durasi 10–15 menit"). |
| 3 | Langkah teknis penting (posisi manset, sudut probe). |
| 4 | Klasifikasi/kalkulasi/kompleks (rumus dipping + 4 kategori). |
| 5 | Item multi-kriteria (5 indikasi, 3 ambang diagnostik sekaligus). |

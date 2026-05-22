# Station: 6-Minute Walk Test (6MWT) — CHF + CCS Post-PCI

Saya sudah meriset ATS 2002, ERS/ATS 2014, ESC 2021 HF, ESC 2024 CCS, AACVPR 2024, dan PERKI 2019 (Panduan Rehabilitasi Kardiovaskular). Dari riset itu saya susun **1 station oral_board** yang siap di-import ke aplikasi (format Cases + Rubric, sesuai `ExcelImporter.tsx`).

## Output

File markdown station: `/mnt/documents/stations_wip/06_6mwt.md` + PDF `06_6mwt.pdf`.
Struktur sama dengan station echo (Bab A–H), tapi inti yang akan jadi soal ujian = **Bab C: Skenario Ujian** (1 kasus tunggal, kompleks).

## Skenario ujian (1 kasus, oral_board)

**Title:** `6MWT — CHF Post-PCI (Tn. S, 62 th)`
**Mode:** `oral_board` · **Reading:** 180 dtk · **Time limit:** 600 dtk (10 menit; peragaan + hitung + edukasi padat)
**Show results:** FALSE

**Initial prompt (vignette):**
Tn. S, 62 th, dirujuk ke poli rehabilitasi kardiovaskular untuk Phase II CR. Riwayat: STEMI anterior 6 minggu lalu → primary PCI LAD (DES, TIMI 3). Echo terbaru EF 38% (HFrEF), tanpa LV thrombus. NYHA II, CCS I. Obat: bisoprolol 2.5 mg, ramipril 5 mg, spironolakton 25 mg, dapagliflozin 10 mg, atorvastatin 40 mg, aspirin 80 mg, tikagrelor 2×90 mg. Tidak ada angina sejak PCI. BB 72 kg, TB 168 cm. TD 118/72, HR 64, SpO₂ 98%, Borg dyspnea 0. EKG: sinus, Q patologis V1–V3, tanpa ST deviasi. Pasien akan menjalani **6MWT** sebagai baseline sebelum exercise prescription.

**Questions text (5 tugas, kandidat menjawab mandiri, tanpa tanya-jawab):**
1. Jelaskan **persiapan 6MWT** secara profesional di depan pasien (indikasi/kontraindikasi yg di-screen, lingkungan & alat, persiapan pasien, baseline yg diukur, kriteria stop).
2. **Peragakan prosedur 6MWT** sesuai standar ATS 2002 — termasuk instruksi pembuka verbatim, *standardized encouragement phrases* tiap menit, dan penutupan tes.
3. **Hitung VO₂peak dan METs** pasien bila 6MWD = **280 m**. Tampilkan rumus, angka, % prediksi (Enright–Sherrill), dan interpretasi klinis.
4. Susun **exercise prescription FITT-VP** untuk pasien ini (aerobik + resistance + flexibility) berdasarkan hasil 6MWT, ESC 2021 HF, ESC 2024 CCS, AACVPR 2024 dan PERKI 2019.
5. Berikan **edukasi komprehensif** pasien CHF + post-PCI: kepatuhan DAPT & HF-GDMT, warning signs stop exercise, sick-day rules, monitoring BB harian & restriksi cairan/garam, diet, seksual, kembali kerja/menyetir, vaksinasi, faktor risiko, follow-up.

**Answer key (model jawaban, ringkas tapi lengkap):**
- Kontraindikasi absolut: UA / MI dalam 1 bulan terakhir; relatif: HR >120, TDS ≥180/TDD >100, AV block tinggi, HOCM, LM disease. Pasien ini: 6 minggu post-PCI, stabil, NYHA II → **boleh**.
- Lingkungan: koridor lurus datar 30 m, dua cone, kursi, stopwatch, lap counter, sfigmo, pulse oksimetri, skala Borg, O₂ + nitrat rescue + AED standby.
- Persiapan pasien: baju & sepatu nyaman, makan ringan ≥2 jam sebelumnya, **lanjutkan obat termasuk β-blocker**, hindari latihan berat 2 jam sebelumnya, **tanpa warm-up**, duduk istirahat 10 menit; catat baseline TD, HR, SpO₂, Borg dyspnea & fatigue.
- Instruksi ATS verbatim ("The object of this test is to walk as far as possible for 6 minutes…", encouragement tiap menit: "You are doing well. You have 5 minutes to go" dst.), boleh berhenti & melanjutkan, tidak berbicara dengan pasien selain frasa baku.
- Hitungan:
  - Cahalin/Ross: **VO₂peak = 0.03 × 280 + 3.98 = 12.38 mL/kg/min**
  - METs = 12.38 / 3.5 ≈ **3.5 METs**
  - Kecepatan 280 m / 6 min ≈ 46.7 m/min ≈ 2.8 km/jam
  - Prediksi Enright–Sherrill pria: 7.57·TB(cm) − 5.02·umur − 1.76·BB − 309 = 7.57·168 − 5.02·62 − 1.76·72 − 309 = **+ ~336 m** (LLN ≈ −153 m). 280 m = **~83% prediksi** → kapasitas fungsional sedang–rendah, konsisten HFrEF NYHA II.
- FITT-VP: F 3–5×/mg, I 40–70% HRR (atau 50–80% VO₂peak / Borg RPE 11–13 awal → 14), T 20–30 → 45–60 min, Type treadmill/sepeda + resistance 2×/mg 8–10 grup otot 30–70% 1RM, flex 5×/mg, **warm-up 10' & cool-down 10'**, progresi setelah 2–4 minggu; HR target ≈ HRrest + 40–60% (HRpeak−HRrest); pertimbangkan HIIT setelah 4–6 mg bila stabil (ESC 2021).
- Edukasi: DAPT 12 bln jangan dihentikan tanpa konsultasi, statin seumur hidup, target LDL <55 mg/dL, GDMT 4-pilar wajib, timbang BB harian (alarm Δ ≥2 kg/3 hari), garam <5 g/hr, cairan 1.5–2 L/hr bila kongestif, stop latihan bila chest pain/dispnea ekstrem/pusing/palpitasi, sick-day rule (tunda olahraga jika demam/diare), aktivitas seksual aman ≈3–5 METs (setara naik 2 lantai tanpa gejala), kembali kerja ringan 2–4 mg, menyetir komersial sesuai regulasi, vaksin influenza & pneumokokus, berhenti rokok mutlak, manajemen DM/HT/dislipidemia, follow-up 2–4 minggu.

**Rubric (≥18 item, binary, ditandai is_critical):**
Mencakup: skrining kontraindikasi (C), alat & koridor 30 m (C), baseline vital + Borg (C), instruksi ATS verbatim (C), encouragement standar tiap menit, kriteria stop (C), pencatatan 6MWD & post-vital, rumus VO₂ benar (C), METs benar (C), % prediksi Enright, FITT lengkap (C), warm-up/cool-down, target intensitas aman utk HFrEF (C), resistance + flexibility, DAPT tdk dihentikan (C), GDMT 4-pilar, BB harian + Δ2kg (C), restriksi garam/cairan, warning signs (C), sick-day, aktivitas seksual METs, vaksinasi, berhenti rokok, follow-up.

## Media yang perlu Anda siapkan & attach nanti (via Admin → AssetUploader)

| # | File | Kategori | Trigger keyword | Catatan |
|---|---|---|---|---|
| 1 | `6mwt_corridor_diagram.png` | `case_media` | `persiapan`, `koridor`, `prosedur` | Skema koridor 30 m + 2 cone + kursi |
| 2 | `ekg_post_pci_anterior.png` | `case_media` | `ekg` | Sinus 64, Q V1–V3, tanpa ST deviasi |
| 3 | `echo_hfref_ef38.jpg` | `examination` | `echo`, `ef` | Apical 4-chamber, EF 38%, hipokinetik anterior |
| 4 | `borg_scale.png` | `additional_info` | `borg`, `dispnea` | Skala Borg CR10 dyspnea + RPE 6–20 |
| 5 | `enright_sherrill_table.png` | `additional_info` | `prediksi`, `enright` | Tabel rumus pria/wanita |
| 6 | `med_list.pdf` (opsional) | `additional_info` | `obat`, `medikasi` | Daftar obat saat ini |
| 7 | `cr_phase_protocol.png` (opsional) | `additional_info` | `rehabilitasi`, `fase` | Skema Phase I–IV PERKI |

Aset 1–5 **wajib**; 6–7 opsional. Tidak diunggah lewat Excel — diunggah manual setelah import (sesuai alur aplikasi).

## Langkah eksekusi (saat di-approve)

1. Tulis `/mnt/documents/stations_wip/06_6mwt.md` lengkap Bab A–H (Scope, Knowledge Base ESC/ATS/PERKI dengan sitasi, Skenario di atas, MCQ Bank 8 soal, Cheat Sheet 1 halaman, Pitfall, Trial, Lampiran daftar media).
2. Render ke PDF via pipeline HTML→LibreOffice (sama spt station echo).
3. QA tiap halaman PDF; perbaiki bila ada tabel terpotong.
4. Tidak menyentuh kode aplikasi.

Approve untuk saya eksekusi?
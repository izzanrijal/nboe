# Plan: Station 9 — KARKLIN (Konsultasi Kardiologi Klinis)

## Output
File: `/mnt/documents/stations_wip/09_karklin.md` (~8.000–9.000 kata, 0 kredit AI — manual expand persis seperti station 1–8). Format mengikuti `02_ep_aritmia.md`.

## Scope Khusus Station Ini
Station Karklin = **Konsultasi Kardiologi Klinis** untuk berbagai kasus rawat (ranap, prabedah, obstetri, onkologi, geriatri). Penekanan pada:
- **Cara menjawab konsul** (lembar konsul profesional: identitas, asesmen, problem list, plan, edukasi, tanda tangan).
- **Pemeriksaan fisik langsung** (JVP, HJR, hipotensi ortostatik, auskultasi) dengan alat di meja.
- **Interpretasi data** (EKG, ABPM, CMR LGE, ICA, lab) yang diminta dari penguji.
- **Guideline-based decisions** (ESC 2022 NCS Pre-op, ESC 2018 Pregnancy, ESC 2022 Cardio-Onco, ESC 2015 Pericardial, ESC 2023 ACS, ESC 2021 HF, ESC 2024 HT).

## Skenario yang Diminta User (10 sub-kasus, akan dikelompokkan jadi 8 skenario unik karena ada duplikat)

Duplikat dari foto: **HT+Hamil T1** (×2), **OH** (×2), **Cholelithiasis+HT** (×2), **CHF** (×2), **CTRCD** (×2), **CAD Pro Viability** (×2). Unik tambahan: **Angina Typical/STEMI?**, **Acute Pericarditis**, **HT+Hamil T2**, **Hamil + Post MVR Mechanical Valve**.

Saya gabungkan duplikat → **10 skenario unik**:

1. **HT + Hamil Trimester 1** — minta penunjang (UL proteinuria, fungsi ginjal, EKG, echo), DDx (chronic HT vs gestational vs preeklampsia early), obat aman (methyldopa, labetalol, nifedipine; **hindari ACEi/ARB/atenolol**), edukasi, lembar konsul lengkap.
2. **HT + Hamil Trimester 2** — kriteria preeklampsia, threshold terapi (ESC: ≥140/90 utk pasien dgn organ damage, ≥150/95 utk lainnya; ACOG: 140/90 severe ≥160/110), aspirin profilaksis (sudah lewat window), magnesium sulfat bila severe.
3. **Ortostatik Hipotensi (OH)** — SOP pemeriksaan langsung (supine 5 min → tegak 1 & 3 min, drop SBP ≥20/DBP ≥10), interpretasi **ABPM** (dipper, non-dipper, reverse dipper, riser; nocturnal HT), edukasi (hidrasi, garam, naik bertahap, stocking, midodrine/fludrocortisone bila refrakter).
4. **Cholelithiasis + HT (Pre-op Konsul Bedah)** — **NCS ESC 2022**: surgical risk (cholecystectomy = intermediate risk), functional capacity (METs ≥4), RCRI, kapan stop/lanjut antihipertensi (lanjut beta-blocker, hentikan ACEi/ARB pagi op), tulis lembar konsul: clearance + rekomendasi.
5. **Angina Typical / STEMI?** — hand hygiene, EKG 12-lead **plus right-sided (V3R-V6R)** dan **posterior (V7-V9)** terpisah & profesional, interpretasi STE inferior + RV/posterior, diagnosis STEMI inferior + RV infarction, manajemen awal (MONA-BC, DAPT, primary PCI <90 min, hindari nitrat bila RV infarct).
6. **CHF (JVP & HJR)** — pemeriksaan **JVP** dengan 2 penggaris (sudut sternal Louis + penggaris vertikal, kepala 30-45°, internal jugular, top of pulsation), **HJR** (tekan RUQ 10 detik, JVP naik >3 cm = positif), interpretasi **JVP 5+4=9 cm** (≈14 cmH2O, tinggi) dan **HJR 5+9=14 cm** (positif, RV failure / kongesti), KIE diet rendah garam <2 g, restriksi cairan 1.5 L, tatalaksana **Furosemide IV 40-80 mg bolus** (pilih ampul di meja).
7. **CTRCD (Cancer Therapy-Related Cardiac Dysfunction)** — 3 diagnosis klinis (HF stage C, dyspnea NYHA, fatigue), 3 diagnosis anatomi (LV systolic dysfunction, GLS reduction ≥15%, kardiomiopati dilatasi), penunjang utama: **Echo + GLS + Troponin/NT-proBNP** (per ESC 2022 Cardio-Oncology); CMR bila echo equivocal. Tatalaksana: stop/modifikasi kemoterapi (anthracycline, trastuzumab), GDMT lengkap (ACEi/ARNI + BB + MRA + SGLT2i), dexrazoxane bila kumulatif tinggi.
8. **Acute Pericarditis** — auskultasi **pericardial friction rub** (3-fase, sistol-diastol-atrial), penunjang: EKG (diffuse STE concave + PR depresi, PR elevasi aVR), echo (efusi), CRP↑, troponin (myopericarditis bila +). DDx utama: STEMI, myocarditis, PE, aortic dissection. Tatalaksana **NSAID/aspirin dosis tinggi + colchicine 0.5 mg BID 3 bulan** (ICAP/CORP trial), taper, restriksi olahraga.
9. **Ibu Hamil + Post MVR Mechanical Valve** — penunjang: echo katup (gradien, leak), INR, fungsi ginjal/hepar, fetal USG. Antikoagulasi mWHO IV: **warfarin trimester 2-T36 bila dosis ≤5 mg** (lebih aman utk ibu, INR 2.5-3.5), atau **LMWH dosis-adjusted anti-Xa 1.0-1.2 U/mL** trimester 1 bila warfarin >5 mg, transisi UFH IV menjelang persalinan, mode partus C-section terjadwal week 36-37 setelah switch heparin. Konsul tim (kardio-obstetri-anestesi).
10. **CAD Pro Viability Study (Ischemic Cardiomyopathy)** — diagnosis **ICM**, plan **ICA** (hasil: stenosis LM, LAD, RCA), karena ICM → uji viabilitas; **CMR LGE: 75% LAD (transmural, non-viable) & 25% RCA (subendokardial, viable)** → revaskularisasi **hanya RCA**. Diskusi STICH trial, threshold viabilitas <50% transmural LGE = viable, GDMT optimal tetap, ICD bila EF ≤35% post-revas 3 bulan.

## Struktur Dokumen (mengikuti 02_ep_aritmia.md persis)

1. **SCOPE & BLUEPRINT** — posisi karklin di ujian board, format konsul (SOAP, lembar konsul resmi RS), perangkat (penggaris ×2, stetoskop, sphygmomanometer, EKG 12-lead, alat hand hygiene, pena, lembar konsul), skoring 0-2 per item.

2. **HIGH-YIELD KNOWLEDGE**
   - 2.1 Format lembar konsul profesional (Tujuan konsul, S/O/A/P, problem list, plan terapi, edukasi, tanda tangan, kontak balik).
   - 2.2 ESC 2018 Pregnancy & CVD — mWHO classification, obat aman/dilarang, antikoagulasi katup mekanik.
   - 2.3 ESC 2022 NCS Pre-op — RCRI, METs, surgical risk strata, biomarker (BNP), bridging.
   - 2.4 ESC 2024 Hypertension — threshold, target <130/80, kombinasi single-pill.
   - 2.5 OH & ABPM — definisi, dipper pattern, masked HT, white-coat HT, nocturnal HT.
   - 2.6 ESC 2022 Cardio-Oncology — definisi CTRCD (asimtomatik mild/moderate/severe vs simtomatik), surveillance baseline + interim + EOT, dexrazoxane.
   - 2.7 ESC 2015 Pericardial Diseases — Dressler, ICAP/CORP, indikasi steroid (refrakter, autoimun).
   - 2.8 STEMI inferior + RV — V4R, kontraindikasi nitrat, fluid loading.
   - 2.9 JVP & HJR — teknik 2 penggaris, sudut Louis, nilai normal <8 cmH2O.
   - 2.10 ICM & viability — STICH, REVIVED-BCIS2 update, CMR LGE thresholds, FDG-PET, dobutamine stress echo.

3. **SKENARIO OSCE (10 skenario)** — masing-masing: profil pasien, vital, data, alur penguji-kandidat, dialog model, **rubrik 18-22 item × skala 0-2**, **template lembar konsul terisi** untuk skenario yang meminta tulisan konsul.

4. **APPENDIX A–L**:
   - A. Template Lembar Konsul (kosong + 3 contoh terisi).
   - B. mWHO Pregnancy Risk Classification.
   - C. Obat HT aman/dilarang pada hamil & menyusui.
   - D. Antikoagulasi katup mekanik dalam kehamilan (algoritma warfarin/LMWH/UFH).
   - E. RCRI + METs + ESC NCS surgical risk table.
   - F. SOP JVP + HJR (langkah demi langkah dengan 2 penggaris).
   - G. SOP Hipotensi Ortostatik + interpretasi ABPM (dipper patterns).
   - H. Diffuse STE: pericarditis vs early repol vs STEMI table.
   - I. CTRCD definisi & surveillance ESC 2022 (anthracycline, HER2, VEGF, ICI).
   - J. CMR LGE viability threshold + STICH/REVIVED summary.
   - K. EKG kanan & posterior — lokasi lead, indikasi, kriteria STEMI RV/posterior.
   - L. H-1 Cheat Sheet — angka kunci (JVP <8 cmH2O, HJR + bila ↑>3 cm/10s, OH drop ≥20/10, INR mech valve mitral 2.5-3.5, warfarin <5 mg aman, LGE <50% viable, NSAID + colchicine 3 bulan, furosemide 40-80 mg IV).

5. **MCQ/SAQ Bank** 20 soal (HT-hamil, NCS, OH/ABPM, CTRCD, pericarditis, viability, JVP, mech valve pregnancy).

6. **H-1 Cheat Sheet** — 1 halaman padat untuk hari-H.

## Referensi
- ESC 2018 Pregnancy CVD; ESC 2022 NCS Pre-op; ESC 2022 Cardio-Oncology; ESC 2015 Pericardial; ESC 2024 HT; ESC 2023 ACS; ESC 2021 HF; AHA/ACC 2020 VHD.
- ICAP, CORP, CORP-2 (colchicine pericarditis); STICH 10-yr, REVIVED-BCIS2; PROSPECT (CTRCD).
- Indonesian PERKI konsensus konsul kardiologi.

## Setelah Approve
- Tulis langsung ke `/mnt/documents/stations_wip/09_karklin.md`.
- Verifikasi panjang via `wc -w` (target 8.000+ kata).
- Kirim `<lov-artifact>` agar bisa diunduh.
- Tidak menyentuh codebase project.

Balas **Approve** untuk mulai menulis.

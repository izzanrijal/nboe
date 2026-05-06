## Batch 5: Station Vaskular (Manual, ~6500–7500 kata)

Lanjut ke station default berikutnya: **Vaskular** (13 soal historis di rekap).

### Output
File baru: `/mnt/documents/stations_wip/05_vaskular.md` (~7000 kata, **0 kredit AI**, ditulis manual). Tidak rebuild PDF (final setelah 9 station).

### Struktur Konten

**1. Scope & Blueprint** (~350 kata)
- Kompetensi PERKI/ESVS/ESC vaskular: PAD, AAA, diseksi aorta, CVI, DVT/PE, carotid disease, vaskulitis, akut limb ischemia.
- Alat: ABI/TBI, duplex arteri/vena, CTA, Wells score, Rutherford & Fontaine.

**2. High-Yield Knowledge** (~2200 kata)
- **PAD**: Fontaine I–IV, Rutherford 0–6, ABI cut-off (<0.9 PAD, <0.4 CLI, >1.4 non-compressible → TBI), TBI <0.7 abnormal, exercise ABI drop >20%.
- **CLTI** (Chronic Limb-Threatening Ischemia): WIfI staging, GLASS classification, BASIL-2 & BEST-CLI.
- **Akut Limb Ischemia**: Rutherford I/IIa/IIb/III, 6P, heparin bolus, terapi (kateter trombolisis vs trombektomi vs bypass), waktu emas 6 jam.
- **AAA**: skrining USG (laki ≥65 perokok), threshold repair (≥5.5 cm pria, ≥5.0 cm wanita, growth >10 mm/tahun, simptomatik), EVAR vs open (EVAR-1, DREAM, OVER), ruptured AAA (Hardman index).
- **Diseksi Aorta**: Stanford A/B, DeBakey I/II/III, klasifikasi TEM (uncomplicated/complicated/high-risk), target HR <60, SBP 100–120, esmolol/labetalol → vasodilator, IRAD data, TEVAR (INSTEAD-XL).
- **Carotid**: NASCET/ECST, simptomatik ≥50% / asimptomatik ≥70% → CEA/CAS (CREST, ACST-2), tindakan dalam 14 hari pasca-TIA/stroke minor.
- **DVT/PE**: Wells, D-dimer age-adjusted, DOAC vs warfarin, durasi (3 bulan provoked, ekstended unprovoked/cancer), IVC filter (PREPIC), trombolisis iliofemoral (ATTRACT, CAVA), PE risk (PESI/sPESI, ESC 2019/2024 algoritma high-/intermediate-/low-risk).
- **CVI & Varises**: CEAP, Venous Clinical Severity Score, kompresi 20–30/30–40 mmHg, ablasi termal vs skleroterapi.
- **Vaskulitis**: Takayasu (kriteria ACR), GCA (PMR, biopsi temporal, tocilizumab), Buerger (smoking).
- **Renovaskular HTN, FMD, mesenteric ischemia** (akut & kronis).
- **Lymphedema** dan diagnosis banding edema unilateral.
- **Trial highlights**: VOYAGER-PAD (rivaroxaban + ASA), COMPASS, EUCLID, CLEVER, BASIL-2, BEST-CLI, ATTRACT, PEITHO, HI-PEITHO, CAPRIE.

**3. OSCE Skenario × 5** (~3200 kata, dialog 10–14 turn + rubrik 18–22 item)
1. **Klaudikasio Rutherford 3 dengan ABI 0.55** — interpretasi ABI/TBI, supervised exercise vs revaskularisasi, OMT (statin tinggi, antiplatelet, rivaroxaban dosis vaskular 2.5 mg BID), smoking cessation, follow-up.
2. **Akut Limb Ischemia Rutherford IIa** — 6P, heparin loading, pencitraan CTA, pilihan kateter trombolisis vs operasi, kompartemen sindrom, post-revaskularisasi.
3. **AAA infrarenal 5.8 cm asimptomatik** — surveillance vs repair, EVAR vs open, persiapan pre-op (kardiak risk, RCRI), follow-up endoleak (tipe I–V).
4. **Diseksi Aorta Stanford B uncomplicated** — diagnosis (CTA), kontrol HR/BP (esmolol → nikardipin), kriteria komplikasi/high-risk → TEVAR, follow-up imaging.
5. **DVT iliofemoral akut + suspek PE intermediate-high** — Wells, D-dimer, CTPA/echo, stratifikasi risiko PE (sPESI, RV strain, troponin), DOAC vs UFH + reperfusi, indikasi trombolisis sistemik, IVC filter, durasi antikoagulasi.

**4. Bank Soal × 20** (~1200 kata) — MCQ + SAQ dengan kunci & rasional dari 13 soal historis (PAD, AAA, diseksi, DVT/PE, carotid) plus tambahan high-yield.

**5. Cheat Sheet H-1** (~400 kata) — angka padat: ABI/TBI cut-off, AAA threshold, Stanford/DeBakey, Wells, sPESI, NASCET, Rutherford ALI, target HR/BP diseksi, dosis heparin/DOAC, durasi antikoagulasi.

### Quality Check
- Word count 6500–7500.
- Konsisten dengan Station 1–4 (heading, tabel markdown, tanpa Unicode subscript).
- Integrasi 13 soal historis dari `_soal_pool_by_station.json` (kategori vaskular).
- Tidak panggil AI gateway.

### Setelah Approve
Tulis `05_vaskular.md`. Pesan akhir: word count, ringkasan 5 skenario, prompt **"lanjut"** untuk Batch 6 (default berikutnya: **HF/Transplant** — atau sebut station lain: Pediatri/Kongenital, Imaging non-echo, IACC/Klinik, Emergensi/CICU).

## Batch 2: Station Elektrofisiologi & Aritmia (Manual, ~6500-7500 kata)

User mengubah urutan: skip dulu Intervensi, kerjakan **EP & Aritmia** sekarang.

### Output
File baru: `/mnt/documents/stations_wip/02_ep_aritmia.md` (~7000 kata, 0 kredit AI).

### Struktur Konten

**1. Scope & Blueprint** (~350 kata)
- Kompetensi PERKI/Konsil EP, weight ujian, alat (ECG 12-lead, Holter, EPS report, device interrogation printout).

**2. High-Yield Knowledge** (~2000 kata)
- **Bradiaritmia & Pacing**: AV block klasifikasi, indikasi PPM (ESC 2021), CRT (LBBB ≥130 ms, EF ≤35%), HBP/LBBAP, mode pacing (DDD vs VVI, AAI-SafeR).
- **SVT**: AVNRT (slow-fast/atypical), AVRT (WPW, antidromik), AT focal vs makro-reentry, manuver vagal, adenosin algoritma, ablation success rate.
- **AF/AFL**: CHA₂DS₂-VASc, HAS-BLED, EHRA symptom, ABC pathway, rhythm vs rate (EAST-AFNET 4, CASTLE-AF, CABANA), DOAC dosing, LAA closure (Watchman).
- **VT/VF**: ischemic vs non-ischemic, ARVC (Padua criteria), Brugada (tipe 1 spontan vs ajmaline), LQTS (Schwartz score, gen-spesifik), CPVT, idiopathic VT (RVOT, fascicular), storm management.
- **ICD/Wearable**: primary vs secondary prevention, MADIT-II, DANISH, S-ICD vs TV-ICD, WCD (VEST trial).
- **Sudden Cardiac Death**: screening atlet (Seattle/International criteria), genetik.

**3. OSCE Skenario × 5** (~3200 kata, dialog 10-14 turn + rubrik 18-22 item)
1. **AF baru terdiagnosis** pasca-stroke — CHA₂DS₂-VASc, DOAC pilihan, timing antikoagulan post-stroke (1-3-6-12 rule), rate vs rhythm.
2. **Wide complex tachycardia** — Brugada/Vereckei algoritma, VT vs SVT-aberransi, manajemen akut & evaluasi struktural.
3. **Syncope dengan suspect Brugada** — provokasi ajmaline, stratifikasi risiko (Shanghai score), ICD indikasi, family screening.
4. **CRT non-responder** — evaluasi (lead position, AV/VV optimization, PVC burden, LBBAP upgrade), follow-up echo.
5. **Storm VT pada ICD recipient** post-MI — sedasi, beta-blocker IV, amiodaron, sympathectomy, ablasi VT substrat.

**4. Bank Soal × 20** (~1200 kata) — MCQ + SAQ dengan kunci & rasional (mencakup ECG snippets dijelaskan teks).

**5. Cheat Sheet H-1** (~400 kata) — cut-off angka padat (CHA₂DS₂-VASc, QTc, Tpe, Brugada criteria, ablation success).

### Quality Check
- Word count 6500-7500.
- Hindari Unicode subscript (gunakan H<sub>2</sub>O style untuk reportlab nanti).
- Tidak rebuild PDF (PDF final setelah semua 9 station).
- Tidak panggil AI gateway.

### Setelah Approve
Langsung tulis file. Pesan akhir berisi: word count, ringkasan 5 skenario, instruksi balas **"lanjut"** untuk batch berikutnya (default: Intervensi/Cathlab, atau sebut station lain).

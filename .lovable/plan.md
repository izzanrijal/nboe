## Expand Manual — Batch 1: Station Echocardiography

**Mode:** Manual writing (0 kredit AI), output ~6500-7500 kata.

### Eksekusi Batch Ini

1. **Setup workspace persisten**
   - Buat `/mnt/documents/stations_wip/` (persisten lintas sandbox reset)
   - Copy panduan lama sebagai backup

2. **Tulis Station 1: Echocardiography** → `/mnt/documents/stations_wip/01_echo.md`
   
   Struktur:
   - **Scope & Blueprint** (~400 kata) — kompetensi PERKI/Konsil, weight, alat ujian
   - **High-Yield Knowledge** (~1800 kata)
     - Chamber quantification (LV mass, LA volume index, RV TAPSE/S')
     - Sistolik LV: EF Simpson biplane, GLS, 3D
     - Diastolik: algoritma ASE 2016 (E/A, e', E/e', LA vol, TR vel)
     - Valvular: stenosis (PHT, continuity, DSE low-flow), regurgitasi (PISA, vena contracta, ERO)
     - RV function & PH (TRV, PASP, PVR echo)
     - Perikardial: tamponade vs konstriktif (annulus reversus, septal bounce)
     - Stress echo protokol & interpretasi
     - TEE views & indikasi (LAA thrombus, IE, prostetik)
   - **OSCE Skenario × 5** (~3000 kata):
     1. MS rematik untuk PMBV (Wilkins score lengkap, dialog 12 turn, rubrik 20 item)
     2. AS severe low-flow low-gradient (DSE protokol, dialog, rubrik)
     3. Functional MR vs primary MR (mekanisme Carpentier, dialog, rubrik)
     4. HFpEF dengan diastolic dysfunction grade 2 (algoritma ASE, dialog, rubrik)
     5. Suspect IE pada katup prostetik (TTE→TEE, dialog, rubrik)
   - **Bank Soal × 20** (~1200 kata) — MCQ + SAQ dengan kunci & pembahasan
   - **Cheat Sheet H-1** (~400 kata) — bullet padat angka cut-off

3. **Verifikasi & Quality Check**
   - Word count harus 6500-7500
   - Cek tidak ada Unicode subscript (H₂O → H<sub>2</sub>O untuk reportlab nanti)
   - Tampilkan ringkasan ke user

### Yang TIDAK Dilakukan di Batch Ini

- Tidak rebuild PDF (PDF final hanya di-rebuild setelah semua 9 station selesai)
- Tidak menyentuh station lain
- Tidak panggil AI gateway

### Output Batch 1

- File baru: `/mnt/documents/stations_wip/01_echo.md` (~7000 kata)
- Pesan akhir berisi: konfirmasi word count, ringkasan 5 skenario yang ditulis, instruksi balas **"lanjut"** untuk Batch 2 (Intervensi).

### Setelah Approve

Saya langsung mulai menulis Station 1 di pesan berikut. Tidak ada pertanyaan tambahan.
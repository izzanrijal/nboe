
INSERT INTO public.clinical_cases (
  id, title, exam_mode, reading_time_seconds, time_limit_seconds,
  show_results_to_candidate, initial_prompt, questions_text, answer_key_text, checklist_rubric
) VALUES (
  gen_random_uuid(),
  'DUS Carotis — TIA + Bruit Karotis (Tn. R, 68 th)',
  'oral_board',
  180,
  600,
  false,
$PROMPT$Tn. R, 68 tahun, dirujuk ke Poli Vaskular Non-Invasif untuk pemeriksaan Duplex Ultrasound (DUS) Carotis.

RIWAYAT:
- 2 minggu lalu mengalami episode kelemahan mendadak lengan & tungkai kanan disertai bicara pelo, membaik sempurna dalam 30 menit (diagnosis: TIA di IGD, NIHSS 0 saat evaluasi)
- Faktor risiko: hipertensi 15 tahun, DM tipe 2 8 tahun, dislipidemia, perokok aktif 20 pack-years
- Riwayat CAD (-), CABG (-), stroke sebelumnya (-)
- Obat rutin: amlodipin 10 mg, metformin 2×500 mg, atorvastatin 40 mg, aspirin 80 mg (baru dimulai post-TIA)

PEMERIKSAAN FISIK HARI INI:
- TD 148/86 mmHg (lengan kanan) / 146/84 mmHg (lengan kiri), HR 78 x/menit reguler, SpO₂ 98%
- Auskultasi cervical: BRUIT (+) pada regio carotis kiri
- Tidak ada defisit neurologis fokal saat ini
- Tidak ada massa pulsatil abnormal di leher
- Nadi perifer teraba baik seluruh ekstremitas

TUGAS:
Anda adalah dokter kardiovaskular yang akan melakukan pemeriksaan DUS Carotis pada pasien ini. Pasien standar (SP) sudah menunggu di meja pemeriksaan dengan alat USG linear probe 5–12 MHz. Peragakan seluruh prosedur secara profesional dan sistematis di depan penguji tanpa sesi tanya-jawab.$PROMPT$,
$QT$Jawab & peragakan keenam tugas berikut secara berurutan, profesional, dan menyeluruh. Tidak ada sesi tanya-jawab — tunjukkan kompetensi Anda secara mandiri.

1. PERKENALAN & KOMUNIKASI AWAL
   Perkenalkan diri kepada pasien dengan lengkap (nama, peran, konfirmasi identitas pasien).

2. PENJELASAN PROSEDUR & INDIKASI
   Jelaskan rencana, tujuan, dan indikasi pemeriksaan DUS Carotis pada pasien ini. Sebutkan minimal 5 indikasi umum DUS Carotis, kontraindikasi, dan risiko komplikasi.

3. INFORMED CONSENT
   Minta persetujuan tindakan (informed consent) secara verbal sebelum memulai prosedur.

4. PERSIAPAN LENGKAP
   a. Persiapan alat: transducer linear 5–12 MHz, koneksi ke monitor, select probe linear, verifikasi fungsi B-mode/2D (gain, depth), Colour Doppler (colour box size, angle/steer, PRF <10), PW Doppler & angle correction.
   b. Persiapan pasien: bantal di belakang bahu (leher ekstensi), kepala menoleh ke sisi kontralateral.
   c. Persiapan operator: masker, cap, cuci tangan 6 langkah WHO, posisi pemeriksa di belakang kepala pasien.

5. PROSEDUR SCANNING SISTEMATIS
   a. Aplikasi jel pada kulit area yang akan discan.
   b. Letakkan probe transversal dari pangkal leher / medial supraclavicular untuk mencari A. Carotis Communis (CCA), lalu rotasi ke longitudinal dan susuri hingga sudut mandibula.
   c. Lakukan analisa: kalsifikasi/plak, CIMT (Carotid Intima-Media Thickness), spectral Doppler (PW), dan ukur PSV & EDV pada CCA, bifurcatio, ECA, dan ICA — pada kedua sisi.
   d. Sebutkan cara membedakan ICA vs ECA dan interpretasi hasil bila ditemukan stenosis.

6. EDUKASI & PENJELASAN HASIL
   Jelaskan hasil pemeriksaan (asumsikan ditemukan plak hipoekoik di bulbus carotis kiri dengan PSV ICA kiri 250 cm/s, ratio ICA/CCA 3.2 → stenosis ~70%) dan berikan edukasi komprehensif: implikasi klinis, rencana lanjut (rujukan bedah vaskular untuk pertimbangan CEA/CAS), kontrol faktor risiko (BP <130/80, LDL <55 mg/dL post-TIA, HbA1c <7%, berhenti rokok mutlak), kepatuhan antiplatelet & statin, tanda bahaya stroke (FAST), dan jadwal follow-up.$QT$,
$AK$KUNCI JAWABAN — DUS Carotis

1. PERKENALAN
- "Selamat pagi Bapak, saya dr. [Nama], dokter yang akan melakukan pemeriksaan USG pembuluh darah leher Bapak hari ini."
- Konfirmasi: nama pasien, tanggal lahir, keluhan/alasan datang.

2. PENJELASAN PROSEDUR & INDIKASI
- Tujuan: menilai pembuluh darah karotis (arteri leher yang mensuplai otak) untuk mencari penyempitan/plak penyebab TIA.
- Prosedur: non-invasif, memakai gel & probe di leher, ±20–30 menit, tidak ada radiasi, tidak sakit.
- Indikasi DUS Carotis (WAJIB sebutkan ≥5):
  1) Evaluasi defisit neurologis sentral (TIA/stroke) — INI KASUS PASIEN
  2) Evaluasi bruit di cervical — INI KASUS PASIEN
  3) Evaluasi massa pulsatil di cervical
  4) Evaluasi pre-operasi pembedahan kardiovaskular (CABG, bedah vaskular besar)
  5) Curiga subclavian artery steal syndrome
  6) Identifikasi plak arteri oklusif / skrining aterosklerosis
  7) Stratifikasi risiko kardiovaskular
- Kontraindikasi: TIDAK ADA (absolut maupun relatif).
- Risiko komplikasi: TIDAK ADA.

3. INFORMED CONSENT
- "Apakah Bapak bersedia dilakukan pemeriksaan ini? Bila setuju, kita mulai." (verbal consent didokumentasikan).

4. PERSIAPAN
a. ALAT:
  - Transducer LINEAR 5–12 MHz (bukan curvilinear/phased array).
  - Sambungkan ke mesin USG → Select Probe: Linear → Preset: Vascular/Carotid.
  - B-mode/2D: atur GAIN & DEPTH (biasanya 3–4 cm untuk carotis).
  - Colour Doppler: atur COLOUR BOX SIZE cukup, ANGLE/STEER 20°–60°, PRF <10 kHz (biasanya 3–4 kHz untuk aliran karotis).
  - PW Doppler: sample volume 1.5–2 mm, ANGLE CORRECTION ≤60° (idealnya 45°–60°) sejajar dinding pembuluh.
b. PASIEN:
  - Posisi supine, bantal di belakang BAHU (bukan kepala) → leher ekstensi.
  - Kepala menoleh ke sisi KONTRALATERAL dari yang diperiksa.
  - Buka pakaian area leher.
c. OPERATOR:
  - Masker, cap.
  - Cuci tangan 6 langkah WHO.
  - Posisi pemeriksa di BELAKANG kepala pasien (head of bed).

5. PROSEDUR SCANNING
a. Aplikasi jel hangat pada area cervical yang akan discan.
b. Probe TRANSVERSAL di medial supraclavicular → identifikasi CCA (bulat, pulsatil, non-kompresibel) & IJV (oval, kompresibel).
c. Susuri CCA transversal ke arah cephalad hingga bifurcatio → ICA (biasanya postero-lateral, tanpa cabang, lumen lebih besar) & ECA (antero-medial, ada cabang, lumen lebih kecil).
d. Rotasi ke LONGITUDINAL, ulangi scanning dari pangkal leher hingga sudut mandibula.
e. ANALISA WAJIB:
  - Kalsifikasi & morfologi plak (hipoekoik/hiperekoik, permukaan, ulserasi).
  - CIMT: diukur pada dinding FAR wall CCA, 1 cm proksimal bifurcatio, normal <0.9 mm (>1.0 mm = penebalan, >1.5 mm = plak).
  - Spectral Doppler (PW) dengan angle correction ≤60°.
  - Ukur PSV & EDV pada: CCA, BIFURCATIO, ICA, ECA — BILATERAL.
f. Cara membedakan ICA vs ECA:
  - ICA: low-resistance waveform (aliran diastolik tinggi), tanpa cabang, biasanya postero-lateral, lumen lebih besar.
  - ECA: high-resistance waveform (aliran diastolik rendah/nol), ada cabang (a. thyroidea superior), temporal tap sign (+).
g. Kriteria stenosis ICA (NASCET/SRU Consensus 2003):
  - <50%: PSV <125 cm/s, ratio ICA/CCA <2.0
  - 50–69%: PSV 125–230 cm/s, ratio 2.0–4.0, EDV 40–100 cm/s
  - ≥70%: PSV >230 cm/s, ratio >4.0, EDV >100 cm/s
  - Oklusi total: tidak ada aliran.

6. EDUKASI & HASIL (skenario: stenosis ~70% ICA kiri)
- Hasil: "Pak, ditemukan penyempitan sekitar 70% pada pembuluh darah leher kiri Bapak, kemungkinan besar inilah penyebab TIA yang lalu."
- Rencana lanjut: rujuk bedah vaskular / intervensi untuk pertimbangan CEA (Carotid Endarterectomy) atau CAS (Carotid Artery Stenting) — pada pasien SIMPTOMATIK dengan stenosis 70–99%, revaskularisasi dianjurkan dalam 2 minggu onset (Class I, ESC/ESVS 2017).
- Kontrol faktor risiko (SANGAT KETAT karena post-TIA):
  - TD target <130/80 mmHg.
  - LDL target <55 mg/dL (ESC 2019/2021, very-high risk); intensifikasi statin ± ezetimibe/PCSK9i.
  - HbA1c <7%, kontrol DM optimal.
  - BERHENTI ROKOK MUTLAK — konseling + NRT bila perlu.
- Farmakoterapi: lanjutkan antiplatelet (aspirin atau clopidogrel) SEUMUR HIDUP, statin high-intensity, antihipertensi.
- Edukasi tanda bahaya STROKE — FAST:
  - F (Face drooping)
  - A (Arm weakness)
  - S (Speech difficulty)
  - T (Time to call emergency) — segera ke IGD.
- Follow-up: kontrol ke bedah vaskular ≤1 minggu, DUS ulang sesuai indikasi (post-op 1 bulan, 6 bulan, tahunan).$AK$,
$RUBRIC${"items": [
  {"text": "Memperkenalkan diri dengan lengkap (nama, peran) & konfirmasi identitas pasien", "points": 2, "isCritical": true},
  {"text": "Menjelaskan tujuan pemeriksaan DUS Carotis kepada pasien dengan bahasa awam", "points": 3, "isCritical": true},
  {"text": "Menyebutkan minimal 5 indikasi DUS Carotis (defisit neurologis, bruit, massa pulsatil, pre-op kardiovaskular, subclavian steal, plak, risiko KV)", "points": 5, "isCritical": true},
  {"text": "Menyebutkan tidak ada kontraindikasi dan tidak ada risiko komplikasi", "points": 2, "isCritical": false},
  {"text": "Meminta informed consent verbal sebelum memulai", "points": 2, "isCritical": true},
  {"text": "Menyiapkan & memilih transducer LINEAR 5–12 MHz dan select probe di monitor", "points": 3, "isCritical": true},
  {"text": "Verifikasi fungsi B-mode/2D (gain, depth) berfungsi baik", "points": 2, "isCritical": false},
  {"text": "Verifikasi Colour Doppler: colour box size, angle/steer, PRF <10 kHz", "points": 3, "isCritical": true},
  {"text": "Verifikasi PW Doppler & pengukuran angle correction ≤60° berfungsi", "points": 3, "isCritical": true},
  {"text": "Meletakkan bantal di BAHU pasien agar leher ekstensi (bukan di kepala)", "points": 2, "isCritical": true},
  {"text": "Memposisikan kepala pasien menoleh ke sisi KONTRALATERAL", "points": 2, "isCritical": false},
  {"text": "Persiapan operator: memakai masker & cap", "points": 1, "isCritical": false},
  {"text": "Mencuci tangan 6 langkah WHO sebelum prosedur", "points": 2, "isCritical": true},
  {"text": "Pemeriksa berposisi di BELAKANG kepala pasien (head of bed)", "points": 2, "isCritical": false},
  {"text": "Mengaplikasikan jel pada area cervical sebelum scanning", "points": 1, "isCritical": false},
  {"text": "Memulai scanning TRANSVERSAL dari medial supraclavicular untuk identifikasi CCA", "points": 3, "isCritical": true},
  {"text": "Rotasi probe ke LONGITUDINAL dan menyusuri dari pangkal leher hingga sudut mandibula", "points": 3, "isCritical": true},
  {"text": "Melakukan analisa kalsifikasi/plak dan pengukuran CIMT (far wall CCA, 1 cm proksimal bifurcatio)", "points": 4, "isCritical": true},
  {"text": "Mengukur PSV & EDV pada CCA, bifurcatio, ICA, dan ECA bilateral dengan spectral Doppler", "points": 5, "isCritical": true},
  {"text": "Menyebutkan cara membedakan ICA vs ECA (waveform low vs high resistance, cabang, temporal tap)", "points": 3, "isCritical": false},
  {"text": "Menginterpretasi hasil (stenosis ~70% berdasarkan PSV >230 cm/s & ratio ICA/CCA >4) dan menjelaskan ke pasien", "points": 4, "isCritical": true},
  {"text": "Edukasi rencana lanjut (rujuk bedah vaskular untuk CEA/CAS pada stenosis simptomatik 70–99% dalam 2 minggu)", "points": 4, "isCritical": true},
  {"text": "Edukasi kontrol faktor risiko: TD <130/80, LDL <55 mg/dL, HbA1c <7%, BERHENTI ROKOK mutlak", "points": 4, "isCritical": true},
  {"text": "Edukasi kepatuhan antiplatelet & statin seumur hidup + tanda bahaya stroke FAST + follow-up terjadwal", "points": 4, "isCritical": true}
]}$RUBRIC$
);

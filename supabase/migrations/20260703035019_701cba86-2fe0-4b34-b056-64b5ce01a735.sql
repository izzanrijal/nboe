
INSERT INTO public.clinical_cases (
  id, title, exam_mode, reading_time_seconds, time_limit_seconds,
  show_results_to_candidate, initial_prompt, questions_text, answer_key_text, checklist_rubric
) VALUES (
  gen_random_uuid(),
  'ABPM — Suspek White-Coat vs HT Tidak Terkontrol (Ny. M, 55 th)',
  'oral_board',
  180,
  600,
  false,
$PROMPT$Ny. M, 55 tahun, dirujuk ke Poli Hipertensi untuk pemasangan Ambulatory Blood Pressure Monitoring (ABPM).

RIWAYAT:
- Terdiagnosis hipertensi 3 tahun lalu, saat ini rutin amlodipin 10 mg + candesartan 16 mg.
- TD klinik selalu tinggi (rata-rata 158/94 mmHg dalam 3 kunjungan terakhir), namun HBPM (home BP) yang dicatat pasien rata-rata 128/80 mmHg.
- Keluhan: kadang pusing pagi hari, kadang berdebar; tidak ada nyeri dada, tidak ada sesak.
- Riwayat DM (-), stroke (-), CKD (-). Perokok (-). Ibu HT & stroke usia 60.
- Pekerjaan: guru SMP, aktivitas normal, tidur pukul 22.00–05.30.

PEMERIKSAAN FISIK HARI INI:
- TD lengan kanan 156/92 mmHg, lengan kiri 152/90 mmHg (selisih TDS 4 mmHg). Lingkar lengan atas 29 cm. HR 82 x/menit reguler.
- BMI 27, tidak ada edema, tidak ada bruit karotis/abdominal.
- EKG: sinus, LVH ringan (Sokolow-Lyon 36 mm). Fungsi ginjal & elektrolit normal.

TUGAS:
Anda adalah dokter kardiovaskular yang akan memasang ABPM pada pasien ini. Pasien standar (SP) sudah duduk di ruang pemeriksaan dengan perangkat ABPM (monitor + manset dewasa normal + tas + kabel) di meja. Peragakan seluruh prosedur pemasangan, edukasi, dan jelaskan rencana interpretasi/pelepasan secara profesional dan sistematis di depan penguji tanpa sesi tanya-jawab.$PROMPT$,
$QT$Jawab & peragakan keenam tugas berikut secara berurutan, profesional, dan menyeluruh. Tidak ada sesi tanya-jawab — tunjukkan kompetensi Anda secara mandiri.

1. PERKENALAN & KOMUNIKASI AWAL
   Perkenalkan diri kepada pasien dengan lengkap (nama, peran, konfirmasi identitas pasien).

2. PENJELASAN PROSEDUR & INDIKASI
   Jelaskan rencana, tujuan, dan indikasi ABPM pada pasien ini. Sebutkan minimal 5 indikasi ABPM (baik untuk diagnosis maupun pada pasien dalam terapi), serta relevansinya dengan kasus pasien (kecurigaan white-coat vs HT tidak terkontrol).

3. INFORMED CONSENT
   Minta persetujuan tindakan secara verbal sebelum memulai prosedur.

4. PERSIAPAN & PEMASANGAN MONITOR
   Peragakan pemilihan waktu (hari kerja biasa), pemilihan ukuran manset sesuai lingkar lengan, pemilihan lengan (non-dominan; kecuali bila selisih TDS antar lengan >10 mmHg → pasang di TDS tertinggi), posisi pusat manset di atas a. brachialis, ambil pengukuran contoh awal, dan setting interval pengukuran (siang 15–30 menit, malam 30–60 menit).

5. INSTRUKSI UNTUK PASIEN
   Berikan edukasi komprehensif kepada pasien selama 24 jam pemakaian (fungsi alat, aktivitas normal, sikap saat manset mengembang, tidak menyetir sendiri / berhenti bila memungkinkan, tidak mandi selama terpasang, mencatat waktu tidur/obat/keluhan pada diary card, tandai lokasi a. brachialis untuk re-fix manset, cara mematikan monitor bila malfungsi).

6. PELEPASAN, KRITERIA VALIDITAS, & INTERPRETASI
   Jelaskan waktu pelepasan (24 jam), definisi periode siang (09.00–21.00) dan malam (01.00–06.00) atau berdasarkan diary, kriteria pengulangan (<20 pengukuran valid siang atau <7 malam), ambang diagnostik HT berdasarkan ABPM (24h ≥130/80; daytime ≥135/85; nighttime ≥120/70 mmHg), perhitungan dipping [(TDS siang − TDS malam)/TDS siang × 100%] dengan klasifikasi normal dipper 10–20%, non-dipper <10%, extreme dipper >20%, reverse dipper (TDS malam > TDS siang), serta morning surge (TDS 2 jam setelah bangun − rerata 3 TDS terendah saat tidur; abnormal ≥55 mmHg), dan rencana intervensi berdasar hasil.$QT$,
$AK$1. PERKENALAN
"Selamat pagi, Ibu. Perkenalkan saya dr. …, dokter jantung yang bertugas hari ini. Sebelum mulai, izin konfirmasi — dengan Ibu M, usia 55 tahun, betul ya Bu?"

2. PROSEDUR & INDIKASI
Tujuan: mengukur tekanan darah Ibu selama 24 jam agar kami tahu tekanan darah sesungguhnya di luar klinik, saat aktivitas, dan saat tidur.
Indikasi ABPM (minimal 5):
- DIAGNOSIS: (a) penegakan diagnosis HT; (b) deteksi white-coat HT & masked HT; (c) identifikasi HT malam (nighttime HT) & pola non-dipping; (d) penilaian variabilitas/gangguan otonom.
- DALAM TERAPI: (e) konfirmasi HT tidak terkontrol / HT resisten; (f) evaluasi pengendalian TD 24 jam; (g) konfirmasi hipotensi bergejala akibat over-treatment; (h) penilaian HT malam & pola non-dipping; (i) ketidaksesuaian TD klinik vs HBPM.
Relevansi ke pasien: TD klinik 158/94 tapi HBPM 128/80 → curiga WHITE-COAT HT vs HT tidak terkontrol → ABPM adalah gold standard.

3. INFORMED CONSENT
"Apakah Ibu bersedia dipasangkan alat ini selama 24 jam? Selama pemasangan, alat akan otomatis mengembang setiap 15–30 menit di siang hari dan 30–60 menit di malam hari. Boleh saya mulai?"

4. PERSIAPAN & PEMASANGAN
- Pilih hari kerja biasa (bukan hari libur/aktivitas ekstrem).
- Butuh 10–15 menit untuk memasang & menyesuaikan alat.
- Ukur lingkar lengan atas (pasien 29 cm) → pilih manset "normal adult cuff" yang sesuai; kandung manset menutupi ~80% lingkar lengan.
- Pilih lengan NON-DOMINAN (mis. kiri, karena pasien dominan kanan). Selisih TDS antar lengan 4 mmHg (<10) → tetap pasang di non-dominan. BILA selisih >10 mmHg, pasang di lengan dengan TDS TERTINGGI.
- Pusat manset di atas ARTERI BRACHIALIS, ~2–3 cm di atas fossa cubiti. Kabel mengarah ke atas, monitor dikaitkan di sabuk/tas selempang.
- TANDAI lokasi a. brachialis dengan spidol agar pasien dapat mereposisi bila longgar.
- Ambil pengukuran contoh (test measurement) 1–2 kali, bandingkan dengan sphygmomanometer manual (selisih <5 mmHg = valid).
- Set interval: SIANG 15–30 menit, MALAM 30–60 menit. Aktifkan diary card.

5. INSTRUKSI PASIEN (komprehensif)
- Jelaskan fungsi perangkat & cara kerja pengukuran otomatis.
- Boleh beraktivitas seperti biasa (kerja, jalan, dsb).
- Saat alat mulai mengembang: BERHENTI SEJENAK, biarkan LENGAN RILEKS & LURUS, jangan bergerak/bicara.
- SEBAIKNYA TIDAK MENYETIR sendiri; bila terpaksa & alat mengembang saat menyetir → berhenti bila memungkinkan, atau abaikan pengukuran tsb.
- TIDAK MANDI / berendam selama alat terpasang (jaga alat tetap kering).
- Catat pada DIARY CARD: waktu tidur & bangun, obat yang diminum (jam), keluhan (pusing, berdebar, dsb), aktivitas tidak biasa.
- Tandai a. brachialis (sudah dilakukan operator) → bila manset LONGGAR, pasien dapat mengencangkan sendiri sesuai tanda.
- Cara MEMATIKAN monitor bila malfungsi (tombol on/off), dan segera hubungi klinik.
- Jadwal pelepasan 24 jam kemudian di klinik.

6. PELEPASAN, VALIDITAS, INTERPRETASI, INTERVENSI
- Lepas monitor setelah 24 jam.
- Definisi periode: berdasarkan diary card pasien; ATAU default siang 09.00–21.00 & malam 01.00–06.00.
- Validitas: ULANGI ABPM bila <20 pengukuran valid di siang hari ATAU <7 valid di malam hari.
- AMBANG DIAGNOSTIK HT (ABPM):
  • TD rerata 24 jam ≥130/80 mmHg
  • TD rerata siang (daytime/terjaga) ≥135/85 mmHg
  • TD rerata malam (nighttime/tidur) ≥120/70 mmHg
- DIPPING = (TDS siang − TDS malam)/TDS siang × 100%
  • Normal dipper: 10–20%
  • Non-dipper: <10%
  • Extreme dipper: >20%
  • Reverse dipper: TDS malam > TDS siang
- MORNING SURGE = TDS 2 jam setelah bangun − rerata 3 TDS terendah saat tidur; ABNORMAL bila ≥55 mmHg (risiko stroke ↑).
- Intervensi berdasar hasil:
  • Bila rerata 24h <130/80 & daytime <135/85 & HBPM normal → WHITE-COAT HT: lanjut monitor, hindari over-treatment, ulang 6–12 bulan.
  • Bila rerata memenuhi ambang HT → HT TIDAK TERKONTROL / RESISTEN: intensifikasi terapi, evaluasi kepatuhan & sebab sekunder.
  • Non-dipper / reverse dipper / nighttime HT → pertimbangkan chronotherapy (obat malam) & skrining sleep apnea, CKD.
  • Morning surge ≥55 mmHg → pertimbangkan long-acting agent yang mencakup pagi hari.
  • Hipotensi bergejala saat rerata rendah → kurangi dosis obat.$AK$,
$RUBRIC${"items": [
  {"text": "Memperkenalkan diri dengan lengkap (nama, peran) & konfirmasi identitas pasien", "points": 2, "isCritical": true},
  {"text": "Menjelaskan tujuan ABPM kepada pasien dengan bahasa awam (ukur TD 24 jam saat aktivitas & tidur)", "points": 3, "isCritical": true},
  {"text": "Menyebutkan minimal 5 indikasi ABPM (diagnosis HT, white-coat, masked, nighttime/non-dipper, HT resisten/tidak terkontrol, hipotensi over-treatment, ketidaksesuaian klinik vs HBPM)", "points": 5, "isCritical": true},
  {"text": "Mengaitkan indikasi dengan kasus pasien (TD klinik tinggi tapi HBPM normal → curiga white-coat vs HT tidak terkontrol)", "points": 3, "isCritical": true},
  {"text": "Meminta informed consent verbal sebelum memulai", "points": 2, "isCritical": true},
  {"text": "Memilih waktu pemeriksaan pada hari kerja biasa", "points": 1, "isCritical": false},
  {"text": "Mengukur lingkar lengan atas dan memilih ukuran manset yang sesuai", "points": 3, "isCritical": true},
  {"text": "Memasang manset pada lengan NON-DOMINAN (dengan penjelasan aturan >10 mmHg antar lengan → pasang di TDS tertinggi)", "points": 4, "isCritical": true},
  {"text": "Memposisikan pusat manset di atas ARTERI BRACHIALIS (~2–3 cm di atas fossa cubiti)", "points": 3, "isCritical": true},
  {"text": "Menandai lokasi arteri brachialis dengan spidol untuk re-fix manset bila longgar", "points": 2, "isCritical": false},
  {"text": "Melakukan pengukuran contoh (test measurement) & memvalidasi vs sphygmomanometer manual", "points": 3, "isCritical": true},
  {"text": "Menyeting interval siang 15–30 menit dan malam 30–60 menit", "points": 3, "isCritical": true},
  {"text": "Menjelaskan durasi pemasangan alat 10–15 menit & jadwal pelepasan 24 jam", "points": 2, "isCritical": false},
  {"text": "Instruksi: pasien boleh beraktivitas normal namun DIAM & lengan RILEKS saat manset mengembang", "points": 3, "isCritical": true},
  {"text": "Instruksi: sebaiknya tidak menyetir sendiri; berhenti bila memungkinkan saat alat mengembang", "points": 2, "isCritical": false},
  {"text": "Instruksi: TIDAK MANDI selama alat terpasang", "points": 2, "isCritical": true},
  {"text": "Instruksi: mengisi diary card (waktu tidur, obat, keluhan, aktivitas)", "points": 3, "isCritical": true},
  {"text": "Instruksi: cara mematikan monitor bila malfungsi", "points": 2, "isCritical": false},
  {"text": "Menyebutkan definisi periode siang (09.00–21.00) & malam (01.00–06.00) atau berdasarkan diary", "points": 2, "isCritical": false},
  {"text": "Menyebutkan kriteria pengulangan ABPM: <20 pengukuran valid siang ATAU <7 pengukuran valid malam", "points": 3, "isCritical": true},
  {"text": "Menyebutkan ambang diagnostik HT: 24h ≥130/80, daytime ≥135/85, nighttime ≥120/70 mmHg", "points": 5, "isCritical": true},
  {"text": "Menjelaskan rumus dipping [(TDS siang−TDS malam)/TDS siang × 100%] dan klasifikasi (normal 10–20%, non <10%, extreme >20%, reverse)", "points": 4, "isCritical": true},
  {"text": "Menjelaskan morning surge (TDS 2 jam setelah bangun − rerata 3 TDS terendah saat tidur; abnormal ≥55 mmHg)", "points": 3, "isCritical": false},
  {"text": "Menyampaikan rencana intervensi berdasar hasil (white-coat vs HT tidak terkontrol; non-dipper → chronotherapy & skrining OSA; hipotensi → turunkan dosis)", "points": 4, "isCritical": true}
]}$RUBRIC$
);

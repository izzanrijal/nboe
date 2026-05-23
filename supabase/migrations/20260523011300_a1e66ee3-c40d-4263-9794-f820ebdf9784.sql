
INSERT INTO public.clinical_cases (
  id, title, exam_mode, reading_time_seconds, time_limit_seconds,
  show_results_to_candidate, initial_prompt, questions_text, answer_key_text, checklist_rubric
) VALUES (
  gen_random_uuid(),
  '6MWT — CHF Post-PCI (Tn. S, 62 th)',
  'oral_board',
  180,
  600,
  false,
$PROMPT$Tn. S, 62 tahun, dirujuk ke poli rehabilitasi kardiovaskular untuk Phase II Cardiac Rehabilitation.

RIWAYAT:
- STEMI anterior 6 minggu lalu → primary PCI LAD (DES, TIMI 3 flow)
- Echo terbaru: EF 38% (HFrEF), hipokinetik anterior, tanpa LV thrombus
- NYHA II, CCS I, tidak ada angina sejak PCI
- Obat: bisoprolol 2.5 mg, ramipril 5 mg, spironolakton 25 mg, dapagliflozin 10 mg, atorvastatin 40 mg, aspirin 80 mg, tikagrelor 2×90 mg

PEMERIKSAAN HARI INI:
- BB 72 kg, TB 168 cm (BMI 25.5)
- TD 118/72 mmHg, HR 64 x/menit, SpO₂ 98% room air
- Borg dyspnea 0, Borg fatigue 0
- EKG: sinus 64, Q patologis V1–V3, tanpa ST deviasi
- Auskultasi: S1–S2 normal, S3 (−), ronki (−), edema tungkai (−)

TUGAS:
Pasien akan menjalani 6-Minute Walk Test (6MWT) hari ini sebagai baseline untuk exercise prescription Phase II CR. Anda adalah dokter rehabilitasi kardiovaskular yang bertanggung jawab atas tes ini.$PROMPT$,
$QT$Jawab kelima tugas berikut secara berurutan, profesional, dan menyeluruh. Tidak ada sesi tanya-jawab — tunjukkan kompetensi Anda secara mandiri.

1. PERSIAPAN 6MWT
   Jelaskan persiapan 6MWT secara profesional di depan pasien. Sebutkan: indikasi & kontraindikasi yang Anda skrining, lingkungan & alat yang dibutuhkan, persiapan pasien (obat, makan, pakaian), baseline yang diukur, dan kriteria stop tes.

2. PERAGAAN PROSEDUR 6MWT
   Peragakan prosedur 6MWT sesuai standar ATS 2002. Sebutkan instruksi pembuka verbatim kepada pasien, standardized encouragement phrases tiap menit (menit 1–5), dan cara menutup tes pada menit ke-6.

3. PERHITUNGAN VO₂peak & METs
   Bila pasien menempuh 6MWD = 280 meter, hitung dan jelaskan: rumus VO₂peak (Cahalin/Ross), nilai VO₂peak, nilai METs, kecepatan rata-rata, % prediksi (Enright–Sherrill), dan interpretasi klinisnya.

4. EXERCISE PRESCRIPTION (FITT-VP)
   Susun exercise prescription lengkap untuk pasien ini berdasarkan hasil 6MWT, mencakup komponen aerobik, resistance, dan flexibility. Sertakan Frequency, Intensity (target HR/Borg), Time, Type, Volume, Progression, warm-up & cool-down. Acuan: ESC 2021 HF, ESC 2024 CCS, AACVPR 2024, PERKI 2019.

5. EDUKASI KOMPREHENSIF
   Berikan edukasi komprehensif pasien CHF + post-PCI: kepatuhan DAPT & GDMT 4-pilar, monitoring BB harian + restriksi cairan/garam, warning signs untuk berhenti latihan, sick-day rules, aktivitas seksual (METs), kembali kerja & menyetir, vaksinasi, berhenti rokok, dan jadwal follow-up.$QT$,
$AK$JAWABAN MODEL — 6MWT pada CHF Post-PCI

═══════════════════════════════════════════
1. PERSIAPAN 6MWT
═══════════════════════════════════════════
INDIKASI: baseline kapasitas fungsional pra-CR, evaluasi prognosis HFrEF, monitoring respons GDMT, panduan exercise prescription.

KONTRAINDIKASI ABSOLUT (skrining): UA atau MI dalam 1 bulan terakhir (pasien ini 6 minggu post-PCI — AMAN).
KONTRAINDIKASI RELATIF: HR istirahat >120 x/menit, TDS ≥180 / TDD >100 mmHg, AV block derajat tinggi tanpa pacemaker, HOCM, LM disease signifikan, aritmia tidak terkontrol.
→ Pasien ini stabil, NYHA II, TD/HR normal → BOLEH dilakukan.

LINGKUNGAN & ALAT:
- Koridor lurus datar 30 meter, ditandai tiap 3 m, dengan 2 cone di kedua ujung
- Kursi di kedua ujung untuk istirahat bila perlu
- Stopwatch, lap counter, sfigmomanometer, pulse oksimeter
- Skala Borg (dyspnea CR10 + RPE 6–20)
- Emergency: O₂, nitrat sublingual, AED, troli emergency dalam jangkauan

PERSIAPAN PASIEN:
- Pakaian & sepatu yang nyaman (sepatu olahraga datar)
- Makan ringan minimal 2 jam sebelumnya, tidak puasa
- LANJUTKAN obat reguler termasuk β-blocker (jangan dihentikan)
- Hindari latihan berat 2 jam sebelumnya
- TIDAK ada warm-up sebelum tes (mengubah baseline)
- Duduk istirahat 10 menit sebelum tes

BASELINE YANG DIUKUR (sebelum tes):
- TD, HR, SpO₂, RR
- Borg dyspnea, Borg fatigue
- Skala nyeri dada

KRITERIA STOP TES:
- Nyeri dada
- Sesak napas berat (Borg dyspnea ≥7)
- Kram tungkai, mau jatuh, pusing
- Pucat, sianosis
- SpO₂ <85%
- Pasien minta berhenti
(Tes boleh dilanjutkan setelah istirahat bila pasien mampu, namun stopwatch tetap berjalan)

═══════════════════════════════════════════
2. PROSEDUR ATS 2002 (VERBATIM)
═══════════════════════════════════════════
INSTRUKSI PEMBUKA (verbatim, terjemahan ATS 2002):
"Tujuan tes ini adalah berjalan SEJAUH MUNGKIN selama 6 menit. Anda akan berjalan bolak-balik di koridor ini. Enam menit adalah waktu yang lama untuk berjalan, jadi Anda akan berusaha keras. Anda mungkin akan kehabisan napas atau menjadi lelah. Anda boleh memperlambat langkah, berhenti, dan beristirahat bila perlu. Anda boleh bersandar di dinding saat istirahat, tetapi lanjutkan berjalan segera setelah Anda mampu. Anda akan berjalan bolak-balik mengitari cone. Berputarlah dengan cepat di cone dan lanjutkan kembali tanpa ragu. Sekarang saya akan tunjukkan caranya. Perhatikan cara saya berputar tanpa ragu."

(Peragakan 1 putaran)

"Apakah Anda siap? Saya akan menghitung putaran yang Anda selesaikan. Ingat, tujuannya adalah berjalan SEJAUH MUNGKIN selama 6 menit, tetapi jangan berlari atau jogging. Mulai sekarang, atau kapan pun Anda siap."

ENCOURAGEMENT PHRASES (verbatim, hanya frasa baku — tidak berbicara hal lain):
- Menit 1 (setelah 1 menit): "You are doing well. You have 5 minutes to go." → "Bagus, masih 5 menit lagi."
- Menit 2: "Keep up the good work. You have 4 minutes to go." → "Pertahankan, masih 4 menit lagi."
- Menit 3: "You are doing well. You are halfway done." → "Bagus, Anda sudah setengah jalan."
- Menit 4: "Keep up the good work. You have only 2 minutes left." → "Pertahankan, tinggal 2 menit lagi."
- Menit 5: "You are doing well. You have only 1 minute to go." → "Bagus, tinggal 1 menit lagi."
- 15 detik sebelum menit 6: "In a moment I am going to tell you to stop. When I do, just stop right where you are and I will come to you."

PENUTUPAN MENIT 6:
"Stop." → Tandai posisi pasien, hitung total jarak (jumlah putaran × 60 m + sisa jarak).
Catat: TD, HR, SpO₂, Borg dyspnea, Borg fatigue POST-test, alasan berhenti (bila ada).

═══════════════════════════════════════════
3. PERHITUNGAN (6MWD = 280 m)
═══════════════════════════════════════════
RUMUS CAHALIN/ROSS:
VO₂peak (mL/kg/min) = 0.03 × 6MWD (m) + 3.98
                    = 0.03 × 280 + 3.98
                    = 8.40 + 3.98
                    = 12.38 mL/kg/min

METs = VO₂peak / 3.5 = 12.38 / 3.5 ≈ 3.54 METs

KECEPATAN RATA-RATA:
280 m / 6 min = 46.7 m/min ≈ 2.8 km/jam

PREDIKSI ENRIGHT–SHERRILL (Pria):
6MWD prediksi = (7.57 × TB cm) − (5.02 × umur) − (1.76 × BB kg) − 309
             = (7.57 × 168) − (5.02 × 62) − (1.76 × 72) − 309
             = 1271.76 − 311.24 − 126.72 − 309
             = 524.8 m

LLN (Lower Limit of Normal) = prediksi − 153 m ≈ 372 m

% PREDIKSI = 280 / 524.8 × 100% ≈ 53%

INTERPRETASI KLINIS:
- 6MWD 280 m BERADA DI BAWAH LLN → kapasitas fungsional RENDAH
- ~3.5 METs → konsisten dengan HFrEF NYHA II
- Prognosis: 6MWD <300 m pada HFrEF berkaitan dengan mortalitas lebih tinggi → indikasi kuat optimisasi GDMT + supervised CR
- Aman untuk memulai exercise intensitas rendah-sedang di bawah supervisi

═══════════════════════════════════════════
4. EXERCISE PRESCRIPTION (FITT-VP)
═══════════════════════════════════════════
AEROBIK:
- Frequency: 3–5 x/minggu (mulai 3x/mg, naik bertahap)
- Intensity: 40–60% HRR awal (Karvonen), Borg RPE 11–13; naik ke 50–70% HRR / RPE 13–14 setelah 2–4 minggu bila stabil
  HR target awal = HRrest + 0.4 × (HRpeak − HRrest)
  (HRpeak diestimasi dari symptom-limited test atau (220 − umur) × faktor β-blocker)
- Time: mulai 15–20 menit/sesi, progresif → 30–45 menit
- Type: treadmill, sepeda statis, walking; intensitas rendah (sesuai 3.5 METs awal)
- Volume: 150 menit/minggu intensitas sedang (target jangka panjang)
- Progression: setiap 2–4 minggu, naikkan durasi dulu (10%), baru intensitas
- HIIT: dapat dipertimbangkan setelah 4–6 minggu bila stabil dan respons baik (ESC 2021 HF Class IIa)

RESISTANCE TRAINING:
- Mulai ≥3 minggu post-PCI (sudah memenuhi: 6 minggu)
- Frequency: 2 x/minggu (non-konsekutif)
- Intensity: mulai 30–40% 1RM → 40–70% 1RM
- 8–10 grup otot besar, 1–3 set × 10–15 repetisi
- Hindari Valsalva maneuver, hindari isometrik berat

FLEXIBILITY:
- 5 x/minggu, static stretching 10–30 detik per grup otot
- Setelah aerobik (otot hangat)

WARM-UP & COOL-DOWN:
- WAJIB warm-up 10 menit (intensitas sangat rendah, ROM)
- WAJIB cool-down 10 menit (penurunan intensitas bertahap + stretching)
- Mencegah aritmia post-exercise dan hipotensi

KRITERIA STOP LATIHAN: chest pain, dispnea berat, pusing, palpitasi, kelelahan ekstrem, SpO₂ <90%.

═══════════════════════════════════════════
5. EDUKASI KOMPREHENSIF
═══════════════════════════════════════════
A. KEPATUHAN OBAT
- DAPT (aspirin + tikagrelor) WAJIB 12 bulan post-PCI, JANGAN dihentikan tanpa konsultasi kardiolog (risiko stent thrombosis fatal)
- GDMT 4-pilar HFrEF tidak boleh dihentikan: ARNI/ACEi/ARB + β-blocker + MRA + SGLT2i
- Statin seumur hidup, target LDL <55 mg/dL (ESC 2021)
- Bawa kartu obat saat ke dokter manapun (termasuk gigi)

B. MONITORING DI RUMAH
- Timbang BB SETIAP PAGI setelah BAK, sebelum sarapan, pakaian sama
- ALARM: kenaikan BB ≥2 kg dalam 3 hari → hubungi dokter (tanda kongestif)
- Cek tekanan darah & nadi 1–2 x/hari
- Catat dalam buku harian

C. DIET & CAIRAN
- Garam <5 g/hari (1 sendok teh); hindari makanan olahan, mie instan
- Cairan 1.5–2 L/hari bila ada tanda kongestif (jika tidak, normal)
- Diet Mediterranean: sayur, buah, ikan, minyak zaitun; batasi gula & lemak jenuh
- Alkohol: STOP

D. WARNING SIGNS — STOP LATIHAN & KE RS
- Nyeri dada
- Sesak napas saat istirahat / sesak memburuk
- Pingsan / pusing berputar
- Palpitasi tidak teratur
- Edema tungkai baru, ortopnea, PND
- Kenaikan BB cepat

E. SICK-DAY RULES
- Demam, diare, muntah → TUNDA latihan
- Pertimbangkan menyesuaikan dosis diuretik (sesuai instruksi dokter)
- Jangan dehidrasi

F. AKTIVITAS SEKSUAL
- Aman ≈3–5 METs (setara naik 2 lantai tanpa gejala)
- Pasien dapat mencapai 3.5 METs → BOLEH, tetapi mulai bertahap
- Hindari setelah makan besar / alkohol
- PDE5-inhibitor KONTRAINDIKASI dengan nitrat

G. KEMBALI KERJA & MENYETIR
- Kerja ringan: boleh 2–4 minggu post-PCI
- Kerja berat: tunggu hasil CR + stress test
- Menyetir pribadi: setelah 1 minggu (tanpa gejala)
- Menyetir komersial (truk, bus): sesuai regulasi, biasanya 6 minggu + stress test negatif

H. VAKSINASI
- Influenza tahunan
- Pneumokokus (PCV13 + PPSV23)
- COVID-19 sesuai jadwal

I. FAKTOR RISIKO
- BERHENTI ROKOK MUTLAK (juga vape) — rujuk konseling
- Kontrol DM (HbA1c <7%), HT (<130/80), dislipidemia
- BB ideal (BMI 20–25)
- Stres → relaksasi, dukungan keluarga

J. FOLLOW-UP
- Poli kardio: 2–4 minggu, lalu 3 bulan
- Echo ulang 3 bulan
- Lab: profil lipid, fungsi ginjal & elektrolit, HbA1c
- Phase II CR: 8–12 minggu (24–36 sesi supervised)
- Phase III–IV CR: maintenance seumur hidup$AK$,
$RUBRIC$
{
  "enabled": true,
  "items": [
    {"text": "Skrining kontraindikasi absolut & relatif 6MWT (UA/MI 1 bln, HR>120, TDS≥180, AV block, HOCM)", "points": 5, "isCritical": true},
    {"text": "Menyiapkan koridor lurus datar 30 m dengan 2 cone & kursi", "points": 3, "isCritical": true},
    {"text": "Menyiapkan alat lengkap: stopwatch, lap counter, sfigmo, pulse oksimeter, skala Borg", "points": 3, "isCritical": false},
    {"text": "Menyiapkan emergency: O₂, nitrat, AED dalam jangkauan", "points": 3, "isCritical": true},
    {"text": "Instruksi persiapan pasien: pakaian/sepatu, makan ringan ≥2 jam, lanjutkan obat termasuk β-blocker, tanpa warm-up, duduk 10 menit", "points": 4, "isCritical": false},
    {"text": "Mengukur baseline lengkap: TD, HR, SpO₂, Borg dyspnea, Borg fatigue", "points": 4, "isCritical": true},
    {"text": "Menyebutkan kriteria stop tes (nyeri dada, dispnea berat, SpO₂<85%, pucat/pusing)", "points": 4, "isCritical": true},
    {"text": "Memberikan instruksi pembuka ATS 2002 verbatim (jarak sejauh mungkin, boleh istirahat, putar di cone)", "points": 5, "isCritical": true},
    {"text": "Memperagakan 1 putaran sebelum tes dimulai", "points": 2, "isCritical": false},
    {"text": "Menggunakan standardized encouragement phrases setiap menit (1–5) tanpa frasa di luar baku", "points": 5, "isCritical": true},
    {"text": "Menutup tes dengan 'Stop' tepat di menit 6, menandai posisi, menghitung total jarak", "points": 3, "isCritical": false},
    {"text": "Mencatat TD, HR, SpO₂, Borg post-test", "points": 3, "isCritical": false},
    {"text": "Menghitung VO₂peak dengan rumus Cahalin/Ross benar (0.03×280+3.98 = 12.38 mL/kg/min)", "points": 6, "isCritical": true},
    {"text": "Menghitung METs benar (12.38/3.5 ≈ 3.5 METs)", "points": 4, "isCritical": true},
    {"text": "Menghitung % prediksi Enright–Sherrill (~525 m prediksi, 280 m ≈ 53%, di bawah LLN)", "points": 5, "isCritical": false},
    {"text": "Interpretasi klinis: kapasitas rendah, konsisten HFrEF NYHA II, prognosis", "points": 3, "isCritical": false},
    {"text": "FITT-VP aerobik lengkap: F 3–5x/mg, I 40–60% HRR/Borg 11–13, T 20–30 menit, Type", "points": 6, "isCritical": true},
    {"text": "Resistance training 2x/mg, 30–70% 1RM, hindari Valsalva", "points": 3, "isCritical": false},
    {"text": "Warm-up 10' & cool-down 10' WAJIB", "points": 3, "isCritical": true},
    {"text": "Edukasi DAPT 12 bulan TIDAK BOLEH dihentikan tanpa konsultasi", "points": 5, "isCritical": true},
    {"text": "Edukasi GDMT 4-pilar HFrEF (ARNI/ACEi + BB + MRA + SGLT2i) wajib lanjut", "points": 5, "isCritical": true},
    {"text": "Edukasi monitoring BB harian + alarm Δ ≥2 kg/3 hari", "points": 4, "isCritical": true},
    {"text": "Edukasi restriksi garam <5 g/hari & cairan 1.5–2 L bila kongestif", "points": 3, "isCritical": false},
    {"text": "Edukasi warning signs, sick-day rules, aktivitas seksual (3–5 METs), vaksinasi, berhenti rokok, follow-up 2–4 mg", "points": 6, "isCritical": true}
  ]
}
$RUBRIC$::jsonb
);


Rencana fix supaya tidak ada blank screen setelah scan QR:

1) Perbaiki transisi dari scanner ke halaman exam
- Di `src/pages/ExamEntry.tsx`, saya akan tambahkan state transisi (mis. `isNavigatingToExam`).
- Saat QR berhasil scan:
  - langsung set state transisi,
  - `window.scrollTo(0, 0)`,
  - navigate ke `/exam/:sessionId`.
- Selama transisi, tampilkan loading screen penuh “Membuka sesi ujian...” agar user tidak melihat frame kosong.

2) Rapikan layout QRScanner agar tidak memicu offset/scroll aneh
- Di `src/components/exam/QRScanner.tsx`, root container sekarang `min-h-screen` padahal komponen ini ditanam di dalam `ExamEntry` (yang juga punya layout sendiri).
- Saya akan ubah scanner jadi mode embedded (tanpa `min-h-screen`), lalu jika perlu full-screen dipakai hanya untuk state khusus.
- Ini mencegah tinggi halaman berlebih yang bisa bikin user “terlempar” ke area kosong saat route berubah.

3) Hardening cleanup scanner sebelum navigate
- Masih di `QRScanner.tsx`, saya akan buat cleanup kamera lebih deterministik:
  - stop scanner,
  - clear instance scanner,
  - baru trigger `onScan`.
- Hapus ketergantungan `setTimeout(..., 100)` agar tidak ada gap render yang tidak terkontrol.
- Tetap pakai guard `scannedRef` supaya scan tidak dobel.

4) Hardening halaman target exam
- Di `src/pages/ExamMobile.tsx`:
  - paksa `window.scrollTo(0, 0)` saat mount,
  - pastikan fallback selalu render UI yang terlihat (spinner + teks),
  - jika `sessionId` invalid/kosong, tampilkan pesan + tombol kembali (bukan state ambigu).

5) Validasi end-to-end (wajib)
- Uji alur kandidat dari `/exam`:
  - buka kamera → scan QR station → harus langsung ke gatekeeper “Mulai Ujian” tanpa refresh.
- Uji juga deep-link `/exam/:sessionId` dari tab baru.
- Uji di mobile viewport untuk memastikan tidak ada blank frame pada transisi.

Detail teknis (ringkas)
- File yang diubah:
  - `src/pages/ExamEntry.tsx` (state transisi + scroll reset + loading overlay)
  - `src/components/exam/QRScanner.tsx` (embedded layout + cleanup scanner + flow onScan)
  - `src/pages/ExamMobile.tsx` (scroll reset mount + guard fallback/invalid session)
- Tidak perlu perubahan DB/RPC untuk issue ini.
- Fokus utama: hilangkan celah transisi UI dan offset scroll yang membuat layar tampak blank.

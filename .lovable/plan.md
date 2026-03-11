

# Analisis Celah Keamanan — Exam System

Berikut celah-celah yang bisa dieksploitasi peserta, diurutkan dari yang paling berbahaya:

---

## 1. KRITIS: Race Condition pada Session Claim (2 peserta klaim 1 session)

**Celah:** Tidak ada constraint database yang mencegah 2 peserta meng-klaim session yang sama secara bersamaan. RLS policy hanya mengecek `current_candidate_id IS NULL` pada UPDATE, tapi 2 request bisa lolos bersamaan sebelum salah satu terupdate.

**Eksploitasi:** Dua peserta scan QR yang sama secara bersamaan → keduanya bisa masuk ke session yang sama.

**Fix:** Gunakan database-level atomic claim dengan `UPDATE ... WHERE current_candidate_id IS NULL RETURNING *` dalam sebuah function, bukan client-side update.

---

## 2. KRITIS: Timer Client-Side — Bisa Dimanipulasi

**Celah:** `CountdownTimer` menghitung berdasarkan `Date.now()` di browser. `session_start_time` juga di-set dari client (`new Date().toISOString()`). Peserta bisa:
- Mengubah system clock mundur → timer berjalan lebih lama
- Memodifikasi JavaScript di DevTools → menghapus `onComplete` callback timer
- Intercept & ubah `session_start_time` yang dikirim ke Supabase

**Fix:** Server-side timer enforcement — edge function yang menolak submission jika `now() - session_start_time > time_limit + buffer`.

---

## 3. TINGGI: Anti-Cheat Hanya Deteksi `visibilitychange`

**Celah:** Anti-cheat hanya mendeteksi `document.visibilityState === "hidden"`. Peserta bisa:
- **Split screen / Picture-in-Picture**: Buka browser lain di samping tanpa meninggalkan tab
- **Desktop browser**: Resize window kecil, buka referensi di samping
- **Developer Tools**: Buka DevTools (F12) tanpa berpindah tab — visibility tetap "visible"
- **Override handler**: Di console, jalankan `document.removeEventListener('visibilitychange', ...)` atau override `document.visibilityState`

**Fix:** Tambahkan deteksi `window.blur`, `resize`, dan cek apakah DevTools terbuka. Namun tetap tidak 100% foolproof di client.

---

## 4. TINGGI: Peserta Bisa Submit Tanpa Audio

**Celah:** Di `completeExam`, jika `blob` null atau upload gagal, result tetap di-insert dengan `audio_file_url: null`. Peserta bisa:
- Deny microphone permission setelah gatekeeper (revoke di browser settings)
- Mute microphone hardware
- Sengaja corrupt audio stream

Ini berarti peserta bisa mengerjakan ujian tanpa terekam suaranya.

**Fix:** Validasi server-side bahwa `audio_file_url` wajib ada sebelum menerima result.

---

## 5. TINGGI: Duplicate Check Bisa Di-bypass

**Celah:** Duplicate check di `handleAudioReady` mengecek `exam_results` dan `exam_sessions` status. Tapi:
- Check dan claim TIDAK atomic — ada gap antara check dan update
- Peserta bisa membuat 2 akun berbeda dan mengerjakan ujian yang sama
- Jika session di-force_close dan admin regenerate, peserta akun yang sama bisa mencoba lagi karena check hanya melihat `case_id` match, bukan semua sessions

**Fix:** Unique constraint di database: `UNIQUE(candidate_id, case_id)` pada tabel penghubung, atau enforce di RPC.

---

## 6. SEDANG: Answer Key & Rubric Terbaca di Client

**Celah:** `ReadingPhaseView` query `clinical_cases` termasuk semua field. Meskipun `answer_key_text` tidak di-select secara eksplisit di reading view, peserta bisa langsung query Supabase dari console:
```js
supabase.from('clinical_cases').select('answer_key_text, checklist_rubric').eq('id', 'CASE_ID')
```
RLS policy `Public read cases` mengizinkan `SELECT` untuk semua authenticated users.

**Ini adalah celah PALING mudah dieksploitasi** — peserta tinggal buka DevTools, query answer key, dan menjawab sesuai kunci.

**Fix:** Pindahkan `answer_key_text` dan `checklist_rubric` ke tabel terpisah yang hanya bisa diakses admin, atau tambahkan RLS yang membatasi kolom sensitif.

---

## 7. SEDANG: Chat History Tidak Disimpan

**Celah:** Chat messages hanya ada di React state. Jika peserta bertanya hal-hal yang mengarah ke jawaban via chat, tidak ada log permanent. Admin tidak bisa audit apa yang ditanyakan peserta.

**Fix:** Simpan chat messages ke database per session.

---

## Ringkasan Prioritas Fix

| # | Celah | Severity | Effort |
|---|-------|----------|--------|
| 6 | Answer key terbaca via RLS | KRITIS | Medium — perlu tabel baru atau RLS column-level |
| 2 | Timer client-side | KRITIS | Medium — perlu server-side validation |
| 1 | Race condition session claim | KRITIS | Low — buat atomic RPC |
| 3 | Anti-cheat lemah | TINGGI | Low — tambah blur/resize detection |
| 5 | Duplicate bypass | TINGGI | Low — unique constraint |
| 4 | Submit tanpa audio | TINGGI | Low — server validation |
| 7 | Chat tidak tersimpan | SEDANG | Low — insert ke DB |

## Rekomendasi Implementasi

Saya sarankan kita prioritaskan fix **#6 (answer key exposure)** dan **#2 (timer)** karena paling berdampak. Apakah Anda ingin saya implementasikan fix untuk semua celah ini, atau pilih yang mana dulu?


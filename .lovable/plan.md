

# Tambah Logout & Tutup Kamera di Halaman Exam

## Perubahan

### 1. `src/pages/ExamEntry.tsx` — Tambah tombol Logout
- Tambah header bar dengan nama user dan tombol Logout (icon `LogOut`)
- Logout memanggil `signOut()` dari `useAuth()`, lalu redirect ke `/login`

### 2. `src/components/exam/QRScanner.tsx` — Tambah tombol tutup kamera
- Setelah kamera aktif (`started === true`), tampilkan tombol "Tutup Kamera"
- Klik → panggil `scanner.stop()`, set `started = false`
- Tombol "Buka Kamera" muncul kembali agar user bisa buka ulang

### 3. `src/components/exam/AudioGatekeeper.tsx` — Tidak perlu tombol tutup kamera
- Gatekeeper hanya meminta izin mic, bukan kamera. Kamera ada di QRScanner.
- Tapi tambahkan link "Kembali" ke `/exam` agar peserta bisa mundur sebelum mulai ujian.

## File yang Diubah

| File | Perubahan |
|------|-----------|
| `src/pages/ExamEntry.tsx` | Header dengan logout button |
| `src/components/exam/QRScanner.tsx` | Tombol tutup kamera saat aktif |
| `src/components/exam/AudioGatekeeper.tsx` | Link kembali ke /exam |


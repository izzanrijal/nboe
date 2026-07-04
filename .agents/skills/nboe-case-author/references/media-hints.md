# Media Hints — laporan ke user

Agent **tidak** meng-upload media. Setelah soal berhasil masuk, agent harus mengirim list media ke user supaya user upload manual via Admin Dashboard → Case → Asset Uploader.

## Format pelaporan (kirim ke user apa adanya)

```
Case berhasil dibuat: <title> (id: <uuid>)

MEDIA YANG PERLU DIUPLOAD MANUAL:

1. <Nama file / deskripsi singkat>
   Kategori: case_media | examination | additional_info
   Trigger keywords: kata1, kata2, kata3
   Catatan: <kenapa relevan, kapan muncul>

2. ...
```

## Kategori aset (3 kategori resmi NBOE)

- **case_media** — media yang muncul di awal / bersamaan skenario (foto pasien, chest X-ray awal, klip singkat).
- **examination** — hasil pemeriksaan yang diminta kandidat (EKG, echo view, USG, lab). Muncul ketika kandidat menyebut trigger keyword.
- **additional_info** — info tambahan bila kandidat bertanya (riwayat lanjutan, hasil kultur, kolateral).

## Aturan trigger keywords

- Semua lowercase, tanpa tanda baca.
- Berikan 3–6 varian per aset (sinonim klinis Indonesia + Inggris).
- Contoh: `["ekg", "elektrokardiogram", "rekam jantung", "12 lead"]`.
- Hindari kata umum yang bisa trigger tidak sengaja (mis. "pasien", "hasil").

## Contoh laporan

```
Case berhasil dibuat: ABPM — Suspek White-Coat vs HT Tidak Terkontrol (Ny. M, 55 th)
id: 7f3a...-...

MEDIA YANG PERLU DIUPLOAD:

1. Perangkat ABPM lengkap (monitor + manset + tas)
   Kategori: examination
   Trigger keywords: perangkat, abpm, monitor, alat abpm

2. Ilustrasi pemasangan manset di brachialis
   Kategori: examination
   Trigger keywords: pasang manset, brachialis, selempang, posisi manset

3. Tabel ambang diagnostik HT berdasarkan ABPM
   Kategori: additional_info
   Trigger keywords: ambang, threshold, diagnosis, 24 jam
```

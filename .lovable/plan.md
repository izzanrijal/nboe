

# Import Soal Exam via Excel

## Konsep

Admin dapat mengunduh template Excel (.xlsx) yang sudah prefilled dengan contoh, mengisinya, lalu upload untuk membuat banyak case sekaligus. Termasuk daftar tilik (rubric) yang ditangani via sheet terpisah.

## Struktur Template Excel

**Sheet 1: "Cases"**

| Kolom | Contoh | Mapping DB |
|-------|--------|------------|
| title | Kasus Pneumonia | `title` |
| exam_mode | oral_board / panel_exam | `exam_mode` |
| initial_prompt | Pasien datang dengan... | `initial_prompt` |
| questions_text | 1. Apa diagnosis? | `questions_text` |
| answer_key_text | Pneumonia lobaris... | `answer_key_text` |
| reading_time_seconds | 120 | `reading_time_seconds` |
| time_limit_seconds | 360 | `time_limit_seconds` |
| show_results_to_candidate | TRUE/FALSE | `show_results_to_candidate` |

**Sheet 2: "Rubric"**

| Kolom | Contoh |
|-------|--------|
| case_title | Kasus Pneumonia *(harus cocok dengan Sheet 1)* |
| item_text | Menyebutkan diagnosis pneumonia |
| points | 10 |
| is_critical | TRUE/FALSE |

Rubric items di-group berdasarkan `case_title` lalu dijadikan JSON `checklist_rubric`.

## Komponen Baru

**`src/components/admin/ExcelImporter.tsx`**
- Tombol "Download Template" → generate .xlsx prefilled dengan 1 contoh kasus + rubric menggunakan library `xlsx` (SheetJS)
- Tombol "Upload Excel" → parse file, validasi, preview daftar kasus yang akan diimport
- Tabel preview dengan status validasi per baris (title wajib, exam_mode valid, dll)
- Tombol "Import X Cases" → batch insert ke `clinical_cases` + `case_answer_keys`
- Error handling: highlight baris bermasalah

## Integrasi

- Ditambahkan di `CaseManager.tsx` sebagai tombol baru di header, di samping "New Case"
- Menggunakan library `xlsx` (sudah tersedia di npm) untuk read/write Excel di browser
- Setelah import berhasil, invalidate query `clinical_cases`

## Alur

```text
Admin klik "Download Template"
  → Browser download template.xlsx (prefilled contoh)
  → Admin isi data di Excel
  → Admin klik "Upload Excel" → pilih file
  → Preview tabel muncul dengan validasi
  → Admin klik "Import"
  → Batch insert ke DB
  → Daftar case refresh
```

## Dependency

- Install `xlsx` (SheetJS) — client-side Excel parsing/generation, zero backend needed

## File Changes

| File | Perubahan |
|------|-----------|
| `package.json` | Tambah `xlsx` dependency |
| `src/components/admin/ExcelImporter.tsx` | Komponen baru: template download + upload + preview + import |
| `src/components/admin/CaseManager.tsx` | Tambah tombol + dialog untuk ExcelImporter |


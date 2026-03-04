

# Differentiate Asset Categories: Case Media, Examination Assets, Additional Info

## Problem

Currently all uploads go into `case_assets` with no distinction between:
1. **Media pendamping kasus** — images/videos shown alongside the case prompt during reading phase
2. **Pemeriksaan (examination assets)** — media triggered when candidate requests specific exams via keywords
3. **Informasi tambahan** — text-based Q&A that candidates might ask about (e.g. additional anamnesis info, lab results as text)

## Solution

Add a `category` column to `case_assets` to distinguish the three types, and an `answer_text` column for the "additional info" type that stores the pre-defined answer.

### Database Migration

```sql
ALTER TABLE case_assets 
  ADD COLUMN category text NOT NULL DEFAULT 'examination',
  ADD COLUMN answer_text text NOT NULL DEFAULT '';
```

Categories:
- `case_media` — shown during reading phase alongside the case
- `examination` — triggered by keywords during exam (existing behavior)
- `additional_info` — text Q&A, triggered by keywords, answer stored in `answer_text`

### 1. `src/components/admin/AssetUploader.tsx`

Reorganize the upload form into 3 sections/tabs:

- **Media Pendamping Kasus**: Upload image/video, no keywords needed. Saved with `category: 'case_media'`
- **Pemeriksaan**: Upload image/video + trigger keywords. Saved with `category: 'examination'` (current behavior)
- **Informasi Tambahan**: No file upload needed. Input: trigger keywords + answer text. Saved with `category: 'additional_info'`, `asset_url` can be empty or a placeholder

Display existing assets grouped by category.

### 2. `src/components/exam/ReadingPhaseView.tsx`

Fetch `case_assets` where `category = 'case_media'` and display them alongside the case prompt during reading phase using `AssetRenderer`.

### 3. `supabase/functions/exam-chat/index.ts`

Update the system prompt to include `additional_info` assets with their `answer_text` so the AI can answer questions using that data. Also differentiate between `examination` assets (which have media to display) and `additional_info` (text-only answers).

### 4. `src/pages/StationDisplay.tsx`

No changes needed — it already only shows assets when keywords match via broadcast. The `additional_info` type won't have media to display on station, so the AI reply handles it client-side.

## Files Summary

**Migration**: Add `category` and `answer_text` columns to `case_assets`
**Modified (3)**: `AssetUploader.tsx`, `ReadingPhaseView.tsx`, `exam-chat/index.ts`


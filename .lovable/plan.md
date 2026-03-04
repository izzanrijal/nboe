

# Enhanced Rubric System, Weighted Scoring, and Asset Integration

## What to Build

### 1. Enhanced Rubric Builder (`RubricBuilder.tsx`)
- Add toggle switch "Penilaian Berdasarkan Daftar Tilik" (rubric-based grading on/off)
- Each rubric item becomes an object: `{ text: string, points: number, isCritical: boolean }`
- Per item: text input, points input (numeric), "Critical" checkbox (with warning icon)
- Show total points at bottom
- When toggle is OFF, rubric section collapses/hides

### 2. Update `checklist_rubric` JSONB Structure
No DB migration needed — JSONB is flexible. New structure stored in `checklist_rubric`:
```json
{
  "enabled": true,
  "items": [
    { "text": "Anamnesis lengkap", "points": 10, "isCritical": false },
    { "text": "Informed consent", "points": 15, "isCritical": true }
  ]
}
```

### 3. Update CaseForm (`CaseForm.tsx`)
- Pass structured rubric data (enabled + items) to/from RubricBuilder
- Integrate `AssetUploader` directly inside the form (below rubric section) for cases that already have an ID (edit mode)
- For new cases: show asset upload after first save

### 4. Update Scoring in ResultsViewer (`ResultsViewer.tsx`)
- Parse new rubric structure with points
- Score = sum of passed items' points / total possible points (percentage)
- Show critical items with red warning — if any critical item is FAIL, show "TIDAK LULUS" badge
- Display individual points per item in score report

### 5. Update Edge Function (`evaluate-exam/index.ts`)
- Send rubric items with points and critical flags to AI
- AI returns `{ item, passed, comment, points, isCritical }` per item
- Calculate final score in the function and include in response

### 6. Candidate Reactive Chat — "Not Available" Response
- In `StationDisplay.tsx`: when a chat message doesn't match any asset keyword, broadcast back a `{ event: "asset_response", payload: { available: false } }` message
- When it matches, broadcast `{ available: true, asset }` 
- In `ExamActiveView.tsx`: listen for `asset_response` broadcast and show system message "Pemeriksaan tersebut tidak tersedia" or show confirmation

## Files to Change

**Modified (5):**
- `src/components/admin/RubricBuilder.tsx` — complete rewrite with toggle, points, critical checkbox
- `src/components/admin/CaseForm.tsx` — structured rubric state, integrate AssetUploader
- `src/components/admin/ResultsViewer.tsx` — weighted scoring display, critical item logic
- `src/pages/StationDisplay.tsx` — bidirectional broadcast for asset availability
- `supabase/functions/evaluate-exam/index.ts` — handle weighted rubric in AI prompt

**Modified (1):**
- `src/components/exam/ExamActiveView.tsx` — listen for asset_response, show system messages


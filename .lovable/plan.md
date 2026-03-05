

# Show Candidate Results on /exam Page

## Overview

Add a `show_results_to_candidate` boolean toggle to `clinical_cases`. When enabled, candidates see their evaluation details (score, rubric, tips) on `/exam`. When disabled, they only see a list of attempted sessions without scores.

## Changes

### 1. Database Migration
Add column to `clinical_cases`:
```sql
ALTER TABLE public.clinical_cases
ADD COLUMN show_results_to_candidate boolean NOT NULL DEFAULT false;
```

### 2. CaseForm Toggle (src/components/admin/CaseForm.tsx)
- Add state for `showResultsToCandidate` (from `existingCase` or default `false`)
- Add a Switch toggle labeled "Tampilkan Nilai ke Peserta"
- Include in mutation payload

### 3. Revamp ExamEntry Page (src/pages/ExamEntry.tsx)
Currently just shows a QR scanner. Change to a two-section layout:
- **Top**: QR Scanner button/section to start new exam
- **Bottom**: "Riwayat Ujian" (Exam History) section

The history section queries `exam_results` for `candidate_id = auth.uid()`, joined with `exam_sessions → clinical_cases` to get title + `show_results_to_candidate`.

**If `show_results_to_candidate = true`**: Show expandable rows with score badge, rubric items, reasoning, tips (reuse the display logic from ResultsViewer but read-only, no actions).

**If `show_results_to_candidate = false`**: Show only case title, date attempted, and a "Selesai" status badge — no score, no transcript, no rubric.

### 4. New Component: CandidateResultsList (src/components/exam/CandidateResultsList.tsx)
- Fetches `exam_results` with joins to `exam_sessions.clinical_cases`
- Maps over results, renders cards/rows
- Conditionally shows score details based on `clinical_cases.show_results_to_candidate`
- Read-only version of the score report display (no evaluate/delete buttons)

### Files Changed

| File | Action |
|------|--------|
| Migration SQL | Add `show_results_to_candidate` column |
| `src/components/admin/CaseForm.tsx` | Add Switch toggle + state + payload |
| `src/pages/ExamEntry.tsx` | Add history section below QR scanner |
| `src/components/exam/CandidateResultsList.tsx` | New component for candidate exam history |


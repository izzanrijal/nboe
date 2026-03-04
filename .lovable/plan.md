

# Enhanced AI Grading: Answer Key, Scoring, Reasoning & Tips

## What Changes

### 1. Add "Kunci Jawaban" (Answer Key) field to clinical_cases
A new `answer_key_text` column on `clinical_cases` where admin provides the complete correct answers for all questions. This is separate from `questions_text` (the questions shown to candidates).

**Database migration**: `ALTER TABLE clinical_cases ADD COLUMN answer_key_text text NOT NULL DEFAULT '';`

### 2. Update CaseForm to include Answer Key input
Add a new `Textarea` field labeled "Kunci Jawaban (Answer Key)" below the questions field, with a helper text explaining that this is the reference answer the AI will use for grading.

### 3. Revamp evaluate-exam system prompt
The AI prompt changes to:
- Receive the **questions + answer key** as the grading reference
- Compare candidate transcript against the answer key for accuracy
- Output a **numeric score 0-100** (not just points-based)
- Score ≥ 68 = LULUS, < 68 = TIDAK LULUS
- Score 100 only if ALL critical points are correctly explained
- Critical fail still applies (automatic TIDAK LULUS)
- New required output fields: `"score"` (0-100), `"reasoning"` (why the AI gave that score), `"tips"` (actionable advice for the candidate to improve)

**New JSON output format:**
```json
{
  "items": [...],
  "totalScore": number,
  "totalPossible": number,
  "score": number,          // 0-100 percentage
  "passStatus": "LULUS" | "TIDAK LULUS",
  "hasCriticalFail": boolean,
  "reasoning": "string explaining why this score was given",
  "tips": "string with improvement advice"
}
```

### 4. Update ResultsViewer to display new fields
- Show the **score** as a prominent badge (e.g., "78/100 — LULUS")
- Display **reasoning** section below the rubric items
- Display **tips** section with improvement advice
- Keep existing rubric item breakdown

## Files to Modify

- **Database migration**: Add `answer_key_text` column to `clinical_cases`
- **`src/components/admin/CaseForm.tsx`**: Add answer key textarea
- **`supabase/functions/evaluate-exam/index.ts`**: Fetch `answer_key_text`, update system prompt for percentage scoring + reasoning + tips
- **`src/components/admin/ResultsViewer.tsx`**: Render score, reasoning, and tips sections


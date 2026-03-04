

# Bug Fix: Candidate Can Retake Completed Exam

## Root Cause

The duplicate prevention check in `ExamMobile.tsx` relies on finding an `exam_results` row for the candidate. However, in `ExamActiveView.tsx` (line 155), the `exam_results` insert is **skipped** when the audio recording blob is null or empty:

```typescript
if (blob && blob.size > 0) {
  // upload audio...
  // insert exam_result... ← ONLY runs inside this block
}
await supabase.from("exam_sessions").update({ status: "completed" })...
```

If the recording fails (browser issue, stream ended, etc.), no `exam_result` row is created. The session is marked "completed", the station auto-regenerates a new QR, and the candidate can scan again — the duplicate check finds no results and allows re-entry.

Additionally, the station's own `handleTimerComplete` can mark the session as "completed" independently, which also results in no `exam_result` being created.

## Solution

### 1. Always insert `exam_result` in `ExamActiveView.tsx`
Move the `exam_results` insert **outside** the blob size check. The audio URL can be null if recording failed, but the result row must always exist.

```typescript
// Upload audio if available
let fileName: string | null = null;
const blob = await stop();
if (blob && blob.size > 0) {
  fileName = `${sessionId}_${candidateId}_${Date.now()}.webm`;
  await supabase.storage.from("exam-audio").upload(fileName, blob, ...);
}
// Always insert result
await supabase.from("exam_results").insert({
  session_id: sessionId,
  candidate_id: candidateId,
  audio_file_url: fileName,
});
```

### 2. Strengthen duplicate check in `ExamMobile.tsx`
Also check if the candidate is already `current_candidate_id` on any completed/force_closed session with the same `case_id` — as a fallback in case the result insert also failed.

## Files to Modify
- `src/components/exam/ExamActiveView.tsx` — move result insert outside blob guard
- `src/pages/ExamMobile.tsx` — add fallback duplicate check against session status


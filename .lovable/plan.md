

# Fix: Duplicate Block & Blank Screen on QR Scan

## Issue 1: User Cannot Retake Exam After Admin Deletes Results

**Root Cause**: The `claim_exam_session` RPC has TWO duplicate checks:
1. Checks `exam_results` table — admin deleted this ✅
2. Checks `exam_sessions` where `status IN ('completed', 'force_closed')` and `current_candidate_id = user` — these old session rows **still exist** ❌

Database confirms: user `da2290bb-ac63-47e6-938e-e53ef9fde2d5` still has completed sessions in `exam_sessions` for both cases. Even though admin deleted from `exam_results`, the second check in the RPC still blocks them.

**Fix**: Remove the second check from `claim_exam_session`. The `exam_results` table should be the **single source of truth** for whether a candidate has completed a case. If admin deletes results, the candidate should be able to retake.

```sql
-- Remove this block from claim_exam_session:
-- Check completed/force_closed sessions for this case  ← DELETE THIS
SELECT count(*) INTO _existing_count
FROM exam_sessions
WHERE current_candidate_id = _candidate_id 
  AND case_id = _case_id 
  AND status IN ('completed', 'force_closed');
```

## Issue 2: Blank Screen After QR Scan

**Root Cause**: When navigating from `/exam` (QRScanner) to `/exam/:sessionId` (ExamMobile), the `ExamMobile` component has a fallback `return null` at the bottom (line 222). During the brief moment when auth is re-initializing (`loading = true` then quickly resolves), the component shows a spinner. But if any render path falls through all conditions, it returns `null` — a blank screen.

**Fix**: Replace `return null` with a proper loading/error fallback so there's never a blank screen. Also ensure the `loading` state from AuthContext doesn't cause a flash by keeping the spinner visible until fully resolved.

## Changes

| Location | Change |
|----------|--------|
| DB Migration | Update `claim_exam_session` RPC: remove the `exam_sessions` status check, keep only `exam_results` check |
| `src/pages/ExamMobile.tsx` | Replace `return null` (line 222) with a proper fallback UI (spinner + redirect to /exam) |


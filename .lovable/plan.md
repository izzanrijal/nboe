

# Fix: Station Display Not Updating & Chat Missing on Candidate

## Issues Identified

### 1. Station Display (PC) not updating, timer stuck at 6 min
The StationDisplay relies solely on Supabase Realtime `postgres_changes` subscription. If the event is missed, the PC never gets the updated `session_start_time` (which is reset after reading phase). The timer stays at the original 6-minute value calculated from the first `session_start_time`.

### 2. Chat interface not appearing on candidate mobile
The ExamActiveView renders only when `step === "active" && sessionId && audioStream && sessionData` are all truthy (line 158 of ExamMobile.tsx). If `handleReadingComplete` fires but `sessionData` or `audioStream` somehow becomes null (e.g., audio stream track ended during reading phase), the component returns `null` silently at line 191.

Additionally, the `handleReadingComplete` callback updates `session_start_time` via a fire-and-forget Supabase call (line 101-106) which doesn't await the result — this is fine for local state but could mask DB errors.

## Solution

### A. Add polling fallback to StationDisplay
In the session subscription `useEffect`, add a 3-second interval that re-fetches the session row. This ensures:
- `session_start_time` stays current after reading phase ends
- `status` transitions are never missed
- Timer recalculates correctly with the post-reading start time

**File**: `src/pages/StationDisplay.tsx` — add `setInterval` polling alongside the existing realtime subscription.

### B. Fix candidate active view guard
1. In `ExamMobile.tsx`, add a fallback render when `step === "active"` but conditions aren't fully met — show a loading state instead of returning `null`
2. Add `audioStream` state persistence check — if the stream's tracks have ended (user revoked mic permission during reading), re-prompt or show an error
3. Add console logging to help debug which condition fails

**File**: `src/pages/ExamMobile.tsx` — replace the silent `return null` at line 191 with a debug-friendly fallback, and add stream health check before transitioning to active.

### C. Ensure ExamActiveView always shows chat
The chat section in ExamActiveView is already unconditionally rendered. The issue is likely the parent not rendering the component at all (issue B above). No changes needed to ExamActiveView itself.

## Files to Modify
- `src/pages/StationDisplay.tsx` — add polling fallback (3s interval)
- `src/pages/ExamMobile.tsx` — add fallback UI for active step, stream health check


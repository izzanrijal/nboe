

# Fix: Auto-regeneration Gets Overridden by Polling

## Root Cause

Race condition between `autoRegenerateSession` and the 3-second polling fallback:

1. Exam completes → state = "completed_screen", `autoRegenerateSession` scheduled in 5s
2. Polling (every 3s) keeps detecting old session as "completed" → calls `updateFromRow` → sets state back to "completed_screen" and schedules **more** `autoRegenerateSession` calls
3. When `autoRegenerateSession` succeeds and sets state to "waiting", the next poll callback (still referencing old session ID in its closure) fires and overwrites state back to "completed_screen"
4. `regeneratingRef` is never reset on success, so no further regeneration can happen → stuck on "Ujian Selesai" forever

## Fix (1 file: `src/pages/StationDisplay.tsx`)

1. **Guard `updateFromRow` against regeneration in progress**: If `regeneratingRef.current` is true, skip setting state to "completed_screen" — regeneration is already handling the transition.

2. **Reset `regeneratingRef` on success**: After successful regeneration, reset the flag so future completions can also auto-regenerate.

3. **Stop polling when in completed_screen state**: Add early return in poll callback when state is already "completed_screen" to prevent repeated triggers.

```typescript
// In updateFromRow:
if (updated.status === "completed" || updated.status === "force_closed") {
  if (regeneratingRef.current) return; // Don't override if regenerating
  setState("completed_screen");
  // ...
}

// In autoRegenerateSession, after success:
setState("waiting");
window.history.replaceState(null, "", `/station/${newToken}`);
regeneratingRef.current = false; // Reset for next cycle
```


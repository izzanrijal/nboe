

# Fix: Auto-regenerate Session Fails on Station Display

## Root Cause

The Station Display page (`/station/:token`) runs **without authentication** -- it's a public screen. The `autoRegenerateSession` function tries to `INSERT` a new row into `exam_sessions`, but the RLS policies on that table only allow inserts via the "Admins manage sessions" policy (requires admin role). Since the station page has no authenticated user, the insert is silently rejected by RLS, leaving the page stuck on "Ujian Selesai".

Additionally, the polling fallback (every 3s) keeps detecting `status === "completed"` and fires `autoRegenerateSession` multiple times, compounding the issue.

## Solution

### 1. Create a database function with SECURITY DEFINER to regenerate sessions

Create a Postgres function `regenerate_station_session(case_id, new_token)` that:
- Inserts a new `exam_sessions` row with `status = 'waiting'`
- Runs as `SECURITY DEFINER` so it bypasses RLS
- Returns the new session row

### 2. Call the function via `supabase.rpc()` in StationDisplay

Replace the direct `.insert()` in `autoRegenerateSession` with `supabase.rpc('regenerate_station_session', { ... })`.

### 3. Prevent duplicate regeneration calls

Add a `regeneratingRef` guard so `autoRegenerateSession` only runs once, preventing the polling from triggering it repeatedly.

### 4. Add try/catch for error visibility

Wrap the regeneration in try/catch and log errors to console.

## Files to Modify

- **Database migration**: Create `regenerate_station_session` function
- **`src/pages/StationDisplay.tsx`**: Use `rpc()` instead of `.insert()`, add duplicate-call guard and error handling

## Technical Details

```sql
CREATE OR REPLACE FUNCTION public.regenerate_station_session(
  _case_id uuid,
  _new_token text
)
RETURNS TABLE(id uuid, case_id uuid, status text, session_start_time timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.exam_sessions (case_id, station_token, status)
  VALUES (_case_id, _new_token, 'waiting')
  RETURNING exam_sessions.id, exam_sessions.case_id, exam_sessions.status, exam_sessions.session_start_time;
END;
$$;
```

```typescript
// StationDisplay.tsx changes
const regeneratingRef = useRef(false);

const autoRegenerateSession = useCallback(async (caseId: string) => {
  if (regeneratingRef.current) return;
  regeneratingRef.current = true;
  try {
    const newToken = nanoid(10);
    const { data, error } = await supabase.rpc('regenerate_station_session', {
      _case_id: caseId,
      _new_token: newToken,
    });
    if (error || !data?.[0]) { regeneratingRef.current = false; return; }
    setSession(data[0]);
    setCurrentToken(newToken);
    setActiveAsset(null);
    setCaseData(null);
    setState("waiting");
    window.history.replaceState(null, "", `/station/${newToken}`);
  } catch (e) {
    console.error("Failed to regenerate session:", e);
    regeneratingRef.current = false;
  }
}, []);
```


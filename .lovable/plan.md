

# Bug Fixes: Admin Redirect, Station Auto-Reset, Candidate Warnings

## Bugs Identified

### Bug 1: Admin always redirected to /exam
**Root cause**: Race condition in `AuthContext.tsx`. When `onAuthStateChange` fires `SIGNED_IN`, it calls `setLoading(false)` immediately, but `checkAdminRole` is deferred with `setTimeout(..., 0)`. So `ProtectedRoute` renders with `isAdmin = false` → redirects to `/` → `Index.tsx` sees non-admin user → `/exam`.

**Fix**: Make `checkAdminRole` awaited before setting `loading = false`. Remove the `setTimeout` wrapper. In `onAuthStateChange`, call `await checkAdminRole()` before `setLoading(false)`. Same in `getSession`.

### Bug 2: Station should auto-regenerate session after completion
**Current**: Shows static "Deploy a new session from Admin Dashboard" message.
**Fix**: When session completes, StationDisplay auto-creates a new `exam_sessions` row with same `case_id` and a new `nanoid` token, then displays a fresh QR code. No admin intervention needed.

### Bug 3: Duplicate candidate warning missing
**Current**: If same candidate scans QR for a session they already completed, no warning.
**Fix**: In `ExamMobile.handleAudioReady`, before claiming session, query `exam_results` for existing result with same `candidate_id` + `session_id` (by case). If found, show warning screen instead of proceeding.

### Bug 4: Login page hardcodes /admin redirect
`Login.tsx` line 25: `navigate("/admin")` — should navigate to `/` and let Index handle routing based on role.

## Files to Change

### 1. `src/contexts/AuthContext.tsx`
- Remove `setTimeout` around `checkAdminRole`
- Await `checkAdminRole` before setting `loading = false` in both `onAuthStateChange` and `getSession`
- Key change: make the auth state change callback properly sequential

### 2. `src/pages/Login.tsx`
- Change `navigate("/admin")` → `navigate("/", { replace: true })` so Index.tsx handles role-based redirect

### 3. `src/pages/StationDisplay.tsx`
- In `completed` state: auto-create new session with same `case_id`, new `nanoid` token
- Reset state to `waiting` with the new session data
- Import `nanoid`

### 4. `src/pages/ExamMobile.tsx`
- In `handleAudioReady` (before claiming session): check if candidate already has an `exam_results` entry for any session with the same `case_id`
- If duplicate found, show warning screen with message like "Anda sudah mengerjakan ujian ini sebelumnya"
- Add new step `"duplicate_warning"` to ExamStep type


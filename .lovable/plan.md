

# Re-implementation Plan: PRD Alignment Fixes

## Issues Found

1. **Route `/exam` doesn't exist** — user is on `/exam` and hitting NotFound. The route is `/exam/:sessionId` but Index.tsx redirects non-admin users to `/exam` (no sessionId).
2. **One-time session breaks station/exam routes** — `StationDisplay` and `ExamMobile` are public-facing but AuthContext forces sign-out on reload (sessionStorage flag). Station display should work without auth entirely. Candidate mobile has its own registration flow.
3. **CandidateRegistration auth is broken** — generates random password `candidate_${dob}_${Date.now()}`, so returning candidates can never sign in (timestamp changes). This needs a deterministic approach.
4. **ResultsViewer audio URL is raw filename** — `ExamActiveView` saves just the filename to `audio_file_url`, but `ResultsViewer` tries to use it as `<audio src>` directly. Needs signed URL generation.
5. **Edge function uses OpenAI directly** — should use Lovable AI Gateway per project guidelines, since LOVABLE_API_KEY is available. However, Whisper (audio transcription) is not available via the gateway. Keep OpenAI for Whisper, use Lovable AI Gateway for GPT evaluation.
6. **No `/exam` route for candidates** — candidates redirected to `/exam` from Index but no such route exists. Need a candidate dashboard/entry page.
7. **`case_assets.case_id` FK exists in types** but not shown in the DB schema foreign keys section — likely fine, just noting.
8. **Console warnings** — `forwardRef` warnings on Index and NotFound, minor.
9. **StationDisplay Reset doesn't regenerate QR** — after completion, clicking "Ready for Next Candidate" sets state to `waiting` but doesn't create a new session. The same completed session shows again.
10. **`matchesKeywords` from `keywordMatcher.ts` not used** — StationDisplay does its own inline keyword matching instead of using the utility.

## Implementation Plan

### 1. Fix Auth Context — Don't break public routes
- Remove one-time session logic that signs out on page load (it breaks `/station/:token` and `/exam/:sessionId`)
- Instead: implement one-time session by setting Supabase auth `persistSession: false` is too aggressive. Better approach: keep sessionStorage flag but only enforce it on protected routes, not globally.
- Actually simplest fix: keep the sessionStorage logic but make it only apply when there IS a session. The station route doesn't use auth so it's unaffected. The candidate flow creates its own auth session.

### 2. Fix Candidate Registration Auth
- Use deterministic password: `candidate_${email}_${dob}` (no timestamp)
- This allows returning candidates to sign in with the same credentials

### 3. Add `/exam` Candidate Entry Route
- Create `src/pages/ExamEntry.tsx` — a page for authenticated candidates
- Shows: "Scan QR Code to join exam" with a QR scanner directly
- Or if they have a session URL, navigates there
- Add route `/exam` to App.tsx

### 4. Fix Index.tsx Redirect
- Non-admin authenticated users → `/exam` (candidate entry)
- Non-authenticated → `/login`

### 5. Fix Audio URL in ResultsViewer
- Generate signed URL from Supabase Storage for audio playback
- The `audio_file_url` stored is just the filename, need `supabase.storage.from('exam-audio').createSignedUrl()`

### 6. Fix StationDisplay Reset
- After completion, instead of just setting state back to "waiting", the admin should deploy a new session. Show a message "Session completed. Deploy a new session from admin."
- Or: auto-create a new session for the same case. Simpler: just show completion and let admin redeploy.

### 7. Use keywordMatcher utility in StationDisplay
- Replace inline keyword matching with `matchesKeywords()` from `keywordMatcher.ts`

### 8. Use Lovable AI Gateway for GPT evaluation
- Keep OpenAI Whisper for transcription (not available in gateway)
- Replace GPT-4o direct call with Lovable AI Gateway (`google/gemini-3-flash-preview`) for checklist evaluation

### 9. Create Implementation Doc
- Create `.lovable/implementation.md` documenting the full architecture

## Files to Change

**New files (2):**
- `src/pages/ExamEntry.tsx` — candidate entry page with QR scanner
- `.lovable/implementation.md` — full architecture documentation

**Modified files (7):**
- `src/App.tsx` — add `/exam` route
- `src/pages/Index.tsx` — fix redirect logic
- `src/components/exam/CandidateRegistration.tsx` — fix deterministic password
- `src/components/admin/ResultsViewer.tsx` — fix audio signed URL
- `src/pages/StationDisplay.tsx` — use keywordMatcher, fix reset
- `supabase/functions/evaluate-exam/index.ts` — use Lovable AI Gateway for evaluation
- `supabase/config.toml` — already correct


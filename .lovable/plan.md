

# Phase 5-6: Auth Flow, Admin Revamp, Results Viewer, Edge Function

## Understanding

The user wants:
1. **No landing page** — `/` should redirect to `/login` if not logged in, or `/admin` if admin
2. **One-time session** — closing tab = logout (no persistent sessions)
3. **Admin dashboard** with 3 navbar tabs: **Exam Details** (cases CRUD in table rows), **Participant List** (list of candidates), **Sessions** (completed sessions with AI feedback, scores)
4. **Candidate/participant interface** already built in previous phases — needs to stay functional
5. **Phase 6**: AI evaluation edge function

## Changes

### 1. Auth Flow — One-Time Session + Auto-Redirect

**`src/pages/Index.tsx`** — Replace blank page with redirect logic:
- If logged in + admin → redirect to `/admin`
- If logged in + not admin → redirect to `/exam` or show message
- If not logged in → redirect to `/login`

**`src/contexts/AuthContext.tsx`** — Add `sessionStorage`-based one-time session:
- On `onAuthStateChange` with `SIGNED_IN`, set a `sessionStorage` flag
- On page load, if no `sessionStorage` flag but there's a Supabase session, sign out (tab was closed and reopened)
- This ensures closing all tabs effectively logs out

### 2. Admin Dashboard Revamp

**`src/pages/admin/AdminDashboard.tsx`** — Restructure with 3 tabs:
- **Exam Details** — existing CaseManager (CRUD for clinical cases in table rows with rubric, assets)
- **Participants** — new component showing all candidate profiles from `profiles` table joined with `user_roles` where role = 'candidate'
- **Sessions** — enhanced SessionManager showing completed sessions, exam_results with AI score report, transcript, feedback

**New: `src/components/admin/ParticipantList.tsx`**
- Query `profiles` joined with `user_roles` where role = 'candidate'
- Table: Name, Email, DOB, number of exams taken
- Read-only view for admin

**New: `src/components/admin/ResultsViewer.tsx`**
- Query `exam_results` joined with `profiles` (candidate name) and `exam_sessions` (case title, status)
- Table: Candidate, Case, Status, AI Score, Actions
- Expandable row or dialog showing: transcript, AI score report (checklist items with pass/fail), audio playback link
- "Run AI Evaluation" button per result that invokes the edge function

**Update: `src/components/admin/SessionManager.tsx`**
- Keep deploy functionality
- Add results column linking to ResultsViewer
- Show completed sessions with scores

### 3. AI Evaluation Edge Function (Phase 6)

**New: `supabase/functions/evaluate-exam/index.ts`**
- Accepts `{ result_id }` in POST body
- Fetches `exam_results` row → gets `audio_file_url` and `session_id`
- Fetches `exam_sessions` → gets `case_id`
- Fetches `clinical_cases` → gets `checklist_rubric`
- Downloads audio from `exam-audio` bucket
- Sends to OpenAI Whisper API → gets transcript
- Sends transcript + checklist_rubric to GPT-4o with the strict system prompt
- Updates `exam_results` with `transcript` and `ai_score_report`
- Requires `OPENAI_API_KEY` secret (will prompt user to add it)

**Update: `supabase/config.toml`**
- Add `[functions.evaluate-exam]` with `verify_jwt = false`

### 4. Keyword Matcher Utility

**New: `src/lib/keywordMatcher.ts`**
- Normalize text (lowercase, trim, remove punctuation)
- Substring matching against trigger_keywords array
- Used by StationDisplay for asset triggering

## File Summary

**New files (4):**
- `src/components/admin/ParticipantList.tsx`
- `src/components/admin/ResultsViewer.tsx`
- `src/lib/keywordMatcher.ts`
- `supabase/functions/evaluate-exam/index.ts`

**Modified files (5):**
- `src/pages/Index.tsx` — redirect logic (no landing page)
- `src/contexts/AuthContext.tsx` — one-time session (sessionStorage-based)
- `src/pages/admin/AdminDashboard.tsx` — 3-tab layout (Exam Details, Participants, Sessions)
- `src/components/admin/SessionManager.tsx` — add results integration
- `supabase/config.toml` — add edge function config

**Secret required:**
- `OPENAI_API_KEY` — needed for Whisper and GPT-4o. Will prompt user to add it before deploying the edge function.


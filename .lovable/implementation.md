# Implementation Documentation — Dual-Device Medical Board Exam Platform

## Architecture Overview

A real-time dual-device system pairing a **Display PC** (presentation) with a **Candidate Mobile** (controller/recorder), connected via Supabase Realtime.

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **AI**: OpenAI Whisper (transcription), Lovable AI Gateway / Gemini (evaluation)
- **Audio**: Native HTML5 MediaRecorder API

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (id linked to auth.users, full_name, email, dob) |
| `user_roles` | Role assignments (admin \| candidate), references auth.users |
| `clinical_cases` | Exam cases with title, exam_mode, initial_prompt, checklist_rubric (JSONB), time_limit_seconds |
| `case_assets` | Media assets per case with trigger_keywords array and asset_type (image/video) |
| `exam_sessions` | Active sessions with station_token, status (waiting/active/completed/force_closed), linked to case and candidate |
| `exam_results` | Results with audio_file_url (filename in exam-audio bucket), transcript, ai_score_report (JSONB) |

## Security
- **RLS** enabled on all tables
- `has_role()` security definer function for admin checks
- Candidates can only read/insert their own results
- Admins have full access via `has_role(auth.uid(), 'admin')`

## Routes

| Route | Component | Auth | Purpose |
|-------|-----------|------|---------|
| `/` | Index | — | Auto-redirect based on role |
| `/login` | Login | Public | Admin login |
| `/signup` | Signup | Public | Admin signup |
| `/admin` | AdminDashboard | Admin only | Case CRUD, session deploy, results |
| `/station/:token` | StationDisplay | None | Display PC — QR, prompt, assets |
| `/exam` | ExamEntry | None | Candidate registration + QR scan |
| `/exam/:sessionId` | ExamMobile | None | Full exam flow (gatekeeper → active → completed) |

## Authentication Flow

### Admin
- Standard email/password via Supabase Auth
- One-time session: `sessionStorage` flag set on SIGNED_IN; cleared on sign-out
- On page reload without flag (on protected routes only), session is invalidated

### Candidate
- Self-registration with name, DOB, email
- Deterministic password: `candidate_${email}_${dob}` (allows returning candidates)
- Auto-assigned `candidate` role in `user_roles`

## Real-Time Synchronization

### Channels Used
1. **postgres_changes** on `exam_sessions` — session status transitions (waiting → active → completed)
2. **Broadcast** on `session:{sessionId}` — chat messages from candidate to display PC

### Flow
1. Admin deploys session → creates `exam_sessions` row with unique `station_token`, status=`waiting`
2. StationDisplay subscribes to postgres_changes for the session
3. Candidate scans QR → registers → grants mic → claims session (sets status=`active`, current_candidate_id)
4. StationDisplay detects `active` status → shows initial_prompt
5. Candidate sends chat messages → broadcast to display PC
6. Display PC matches keywords using `matchesKeywords()` → renders triggered assets
7. Timer expires → session set to `completed` → audio uploaded → result created

## Keyword Matching
- `src/lib/keywordMatcher.ts` — normalizes text (lowercase, removes punctuation) and checks substring matches
- Used by StationDisplay to trigger case_assets based on chat messages

## Anti-Cheat
- `useAntiCheat` hook listens for `visibilitychange`
- If tab loses focus during active exam, session is set to `force_closed`
- Candidate sees "Session Terminated" screen

## Audio Recording & Upload
- MediaRecorder API records audio in WebM format
- On timer complete, blob is uploaded to `exam-audio` Supabase Storage bucket
- Filename pattern: `{sessionId}_{candidateId}_{timestamp}.webm`
- Only the filename is stored in `exam_results.audio_file_url`
- Playback uses signed URLs generated on demand (1-hour expiry)

## AI Evaluation Pipeline (Edge Function: `evaluate-exam`)

1. **Input**: `{ result_id }` via POST
2. **Transcription**: Downloads audio from `exam-audio` bucket → sends to OpenAI Whisper API
3. **Evaluation**: Sends transcript + checklist_rubric to Lovable AI Gateway (`google/gemini-3-flash-preview`) with strict system prompt for clinical synonym matching
4. **Output**: Updates `exam_results` with transcript and ai_score_report (JSON array of {item, passed, comment})

### Error Handling
- 429 (rate limit) and 402 (payment required) from AI Gateway are surfaced to the client
- Whisper failures return descriptive error messages

## Admin Dashboard Tabs
1. **Exam Details** — CaseManager (CRUD for clinical_cases with rubric builder and asset uploader)
2. **Participants** — ParticipantList (read-only view of all candidates with exam counts)
3. **Sessions** — SessionManager + ResultsViewer (deploy stations, view results with expandable AI reports)

## Storage Buckets
- `case-assets` (public) — clinical case images/videos
- `exam-audio` (private) — candidate audio recordings

## Secrets Required
- `OPENAI_API_KEY` — for Whisper audio transcription
- `LOVABLE_API_KEY` — auto-provisioned, for Lovable AI Gateway evaluation

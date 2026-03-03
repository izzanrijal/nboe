

# Phase 3 & 4: Display PC View + Candidate Mobile View

## Overview

Build the two real-time synchronized views: the Display PC station screen (`/station/:token`) and the Candidate Mobile exam interface (`/exam/:session_id`). These communicate via Supabase Realtime broadcast channels and postgres_changes listeners.

## Dependencies to Add

- `qrcode.react` — QR code generation for Display PC
- `html5-qrcode` — QR scanner for Candidate Mobile

## Database Changes

Add an RLS policy to allow candidates to update `exam_sessions` when `current_candidate_id IS NULL` (for claiming a session). Currently the update policy only allows updates where `current_candidate_id = auth.uid()`, which blocks the initial claim.

```sql
CREATE POLICY "Candidates can claim unclaimed session"
ON public.exam_sessions FOR UPDATE TO authenticated
USING (current_candidate_id IS NULL)
WITH CHECK (current_candidate_id = auth.uid());
```

Also enable Realtime on `exam_sessions` table for postgres_changes subscriptions.

## New Routes

```
/station/:token   — Display PC (no auth required, public display)
/exam/:sessionId  — Candidate Mobile (requires auth)
```

## Phase 3: Display PC View (`/station/:token`)

### File: `src/pages/StationDisplay.tsx`

State machine with 4 states:

1. **Waiting** — Fetch session by `station_token`. Show full-screen QR code encoding `{origin}/exam/{session_id}`. Subscribe to `postgres_changes` on `exam_sessions` filtered by session id.

2. **Active** — When session status changes to `active`, fetch `clinical_cases` by `case_id`, display `initial_prompt`. Start countdown timer from `session_start_time + time_limit_seconds`. Subscribe to Realtime broadcast channel `session:{session_id}` for chat events.

3. **Reactive** — On incoming chat messages, normalize text and check against `case_assets.trigger_keywords`. If match, render the asset (image or video) full-screen alongside the prompt.

4. **Reset** — When timer hits 0, update session status to `completed`, clear all state, return to Waiting with a fresh QR.

### Supporting Components
- `src/components/station/QRDisplay.tsx` — Full-screen QR with session URL
- `src/components/station/CasePromptDisplay.tsx` — Shows initial_prompt text
- `src/components/station/AssetRenderer.tsx` — Renders image/video assets
- `src/components/station/CountdownTimer.tsx` — Timer computing remaining seconds from `session_start_time + time_limit`

### Design
- Dark background, large white typography
- Full-screen layout optimized for monitor/TV display
- No navigation chrome

## Phase 4: Candidate Mobile View (`/exam/:sessionId`)

### File: `src/pages/ExamMobile.tsx`

Multi-step flow managed by state:

1. **Registration** — Form with Name, DOB, Email. On submit, sign up or sign in the candidate via Supabase Auth, upsert profile, assign `candidate` role.

2. **QR Scanner** — Camera view using `html5-qrcode`. On scan, extract session_id from URL, navigate to that session.

3. **Gatekeeper** — Request `navigator.mediaDevices.getUserMedia({ audio: true })`. "Ready to Begin" button disabled until permission granted. On click: update `exam_sessions` — set `status = 'active'`, `current_candidate_id = auth.uid()`, `session_start_time = now()`.

4. **Active Exam** — Countdown timer, chat input (pushes to broadcast channel `session:{session_id}`), hidden MediaRecorder recording audio chunks.

5. **Force Closed** — Triggered by `visibilitychange` anti-cheat. Updates session status to `force_closed`.

6. **Exam Completed** — Static completion screen after timer expires and audio uploads.

### Supporting Components & Hooks
- `src/components/exam/CandidateRegistration.tsx` — Registration form
- `src/components/exam/QRScanner.tsx` — html5-qrcode wrapper
- `src/components/exam/AudioGatekeeper.tsx` — Permission request + ready button
- `src/components/exam/ExamActiveView.tsx` — Timer + chat + recording
- `src/components/exam/ChatInput.tsx` — Text input pushing to realtime
- `src/hooks/useMediaRecorder.ts` — MediaRecorder lifecycle (start, stop, get blob)
- `src/hooks/useAntiCheat.ts` — visibilitychange listener, calls termination callback
- `src/pages/ExamCompleted.tsx` — Static "Exam Completed" page

### Audio Flow
- `useMediaRecorder` starts on exam begin, records in chunks
- On timer end: stop recorder, compile blob, upload to `exam-audio` bucket, create `exam_results` row

### Anti-Cheat
- `useAntiCheat` hook listens for `visibilitychange`
- On hidden: immediately update session status to `force_closed`, stop recording, show termination screen

## Updated `App.tsx` Routes

Add two new routes:
```tsx
<Route path="/station/:token" element={<StationDisplay />} />
<Route path="/exam/:sessionId" element={<ExamMobile />} />
```

## File Summary

New files (14):
- `src/pages/StationDisplay.tsx`
- `src/pages/ExamMobile.tsx`
- `src/pages/ExamCompleted.tsx`
- `src/components/station/QRDisplay.tsx`
- `src/components/station/CasePromptDisplay.tsx`
- `src/components/station/AssetRenderer.tsx`
- `src/components/station/CountdownTimer.tsx`
- `src/components/exam/CandidateRegistration.tsx`
- `src/components/exam/QRScanner.tsx`
- `src/components/exam/AudioGatekeeper.tsx`
- `src/components/exam/ExamActiveView.tsx`
- `src/components/exam/ChatInput.tsx`
- `src/hooks/useMediaRecorder.ts`
- `src/hooks/useAntiCheat.ts`

Modified files (2):
- `src/App.tsx` — add routes
- DB migration — add RLS policy for session claiming


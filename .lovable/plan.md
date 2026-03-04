

# Exam Flow Overhaul: Reading Phase, End Exam Button, AI Chat, Pagination

## Overview

This is a significant overhaul touching the exam flow, case configuration, AI chat integration, and admin session history. There are 7 areas of work.

## Database Changes

Add columns to `clinical_cases`:
- `reading_time_seconds` (integer, default 120) — time to read case before exam starts
- `questions_text` (text, default '') — questions shown after reading time alongside the case

No other schema changes needed. The existing `case_assets` + `trigger_keywords` system handles media. The `initial_prompt` field already holds the case description.

## 1. Case Form: Add Reading Time + Questions Fields

**File:** `src/components/admin/CaseForm.tsx`

- Add `readingTimeSeconds` field (number input, default 120, label "Waktu Baca (detik)")
- Add `questionsText` field (textarea, label "Soal / Pertanyaan") — these are the questions shown after reading time
- Rename existing `time_limit_seconds` label to "Waktu Ujian (detik)" for clarity
- Save both new fields to `clinical_cases`

## 2. Candidate "End Exam" Button

**File:** `src/components/exam/ExamActiveView.tsx`

- Add a "Selesai Ujian" button in the header bar (next to timer)
- On click: show confirmation dialog ("Apakah Anda yakin ingin mengakhiri ujian?")
- On confirm: run the same completion logic as `handleTimerComplete` (stop recording, upload audio, insert result, mark session completed)
- Force close (anti-cheat) remains separate — sets status to `force_closed` and does NOT upload/save results

## 3. Exam Flow: Reading Phase → Active Phase

**File:** `src/pages/ExamMobile.tsx`

Add new step `"reading"` to `ExamStep`:
- After gatekeeper + claiming session, enter `"reading"` step instead of `"active"`
- Reading step shows: case title, initial_prompt (case text), optional media (if case has assets marked for reading), and a countdown timer for `reading_time_seconds`
- When reading timer ends, transition to `"active"` step — now show case + questions + chat + exam timer

**New component:** `src/components/exam/ReadingPhaseView.tsx`
- Displays case title, prompt text, reading countdown
- Fetches case data from supabase using session's `case_id`
- On timer complete, calls `onReadingComplete()`

**File:** `src/components/exam/ExamActiveView.tsx`
- Accept new props: `caseTitle`, `casePrompt`, `questionsText`
- Show case prompt + questions at the top of the exam view (scrollable, above chat)
- Chat area below for requesting pemeriksaan

## 4. AI-Powered Chat Responses

Currently, candidate chat messages go via broadcast to StationDisplay which matches keywords and sends back `asset_response`. This works for media triggers but doesn't answer free-text questions.

**New edge function:** `supabase/functions/exam-chat/index.ts`
- Receives: `{ session_id, message }` 
- Fetches case data (initial_prompt, questions, case_assets with trigger_keywords) from DB using service role
- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`) with a system prompt:
  - "You are a clinical examiner. Answer the candidate's question based ONLY on the case data provided. If they ask for a physical examination or test, check if it exists in the available assets. Keep answers brief and factual. Respond in the same language as the candidate."
  - Include all case context + asset keywords in the system message
- Returns: `{ reply, asset_match?: { available: boolean, asset_type: string, keyword: string } }`
- If AI identifies an asset request matching a keyword, include `asset_match` so the client can also trigger the station display

**Pre-fetch optimization:** On exam start, fetch all case data (prompt, questions, assets) once and cache client-side. Send this context with each AI request to avoid repeated DB lookups in the edge function. Actually — better to keep it server-side for security. The edge function pre-loads once per session.

**File:** `src/components/exam/ExamActiveView.tsx`
- Change `handleSendMessage`: instead of only broadcasting, call `exam-chat` edge function
- Show AI reply as system message
- If `asset_match.available`, also broadcast to station display to show media
- Keep broadcast channel for station display media rendering

**File:** `src/pages/StationDisplay.tsx`
- Keep existing broadcast listener for media triggers — now triggered by the edge function's response via client broadcast

## 5. Session History Pagination + Participant Name

**File:** `src/components/admin/SessionManager.tsx`

- Add pagination (10 sessions per page) using the existing Pagination component
- Query with `.range(from, to)` for pagination
- Join profiles table: `.select("*, clinical_cases(title), profiles!current_candidate_id(full_name, nim)")`
- Display participant name + NIM in a new column when `current_candidate_id` is set

## 6. Update Supabase Config

**File:** `supabase/config.toml`
- Add `[functions.exam-chat]` with `verify_jwt = false` (will validate auth in code)

## Files Summary

**Migration:** Add `reading_time_seconds` and `questions_text` to `clinical_cases`

**New files (2):**
- `supabase/functions/exam-chat/index.ts`
- `src/components/exam/ReadingPhaseView.tsx`

**Modified files (5):**
- `src/components/admin/CaseForm.tsx` — reading time + questions fields
- `src/components/exam/ExamActiveView.tsx` — end exam button, show case+questions, AI chat
- `src/pages/ExamMobile.tsx` — reading phase step, pass case data
- `src/components/admin/SessionManager.tsx` — pagination + participant name
- `supabase/config.toml` — exam-chat function config


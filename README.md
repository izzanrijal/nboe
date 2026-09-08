# NBOE

Act as an expert React/TypeScript developer and strict system architect. > Build a "Dual-Device Medical Board Examination Platform". There is zero room for hallucination. You must strictly follow this exact specification, using Vite, React, TypeScript, Tailwind CSS, shadcn/ui, and Supabase (for Auth, Database, Storage, and Realtime WebSockets).

CORE ARCHITECTURE: This is a real-time synchronized app with two distinct active views linked by a Supabase Web Socket connection:

A "Display PC" acting as a presentation screen.

A "Candidate Mobile" acting as a controller, chat interface, and audio recorder.

DATABASE SCHEMA (Supabase PostgreSQL): Prepare the frontend to interact with the following tables (assume RLS is enabled):

users (id, role, full_name, dob, email)

clinical_cases (id, title, exam_mode: 'oral_board'|'panel_exam', initial_prompt, checklist_rubric JSON, time_limit_seconds)

case_assets (id, case_id, asset_url, trigger_keywords array, asset_type)

exam_sessions (id, case_id, station_token, status, current_candidate_id, session_start_time)

REQUIRED ROUTES & UI COMPONENTS:

1. Admin Dashboard (/admin)

Create a CRUD interface to manage clinical_cases and upload case_assets.

Include a dynamic list input to build a grading rubric (Daftar Tilik).

Include a button to deploy a case, generating a unique station_token.

2. Display PC View (/station/:token)

Waiting State: Subscribes to Supabase Realtime for the specific token. Displays a large, dynamically generated QR Code containing the URL: /exam/[session_id].

Active State: When the candidate scans the QR and starts the exam, clear the QR code and display the initial_prompt.

Reactive State: Listen for text chat events from the candidate's mobile via Supabase Realtime. If a triggered keyword matches an asset, instantly render the image/video on this screen.

Reset State: When the timer reaches 0, clear all media and regenerate a new QR code.

3. Candidate Mobile View (/exam/:session_id)

Login & Scan: Require Name, DOB, and Email. The next view is a QR Code Scanner component.

Gatekeeper Logic: Upon scanning, trigger navigator.mediaDevices.getUserMedia({ audio: true }). The "Ready to Begin" button MUST remain disabled until audio permissions are successfully granted.

Active Exam View: Show a synchronized countdown timer (e.g., 6:00). Render a text-chat input. When text is submitted, push it to the Supabase Realtime channel. Simultaneously, use the native HTML5 MediaRecorder API to record the candidate's audio in the background.

Anti-Cheat Logic: Implement a useEffect listening for visibilitychange. If the browser tab loses focus, instantly terminate the session and show a "Force Closed" screen.

Submission: At 0:00, stop the MediaRecorder, compile the audio blob, and execute a Supabase Storage upload function. Redirect to an "Exam Completed" view.

# PRD 

1. Product Overview

A dual-device, real-time web application for conducting medical specialty board exams (OSCE/Oral Boards and Panel Exams). The system pairs a Display PC (showing case details and media) with a Candidate Smartphone (acting as a controller, chat interface, and audio recording device).

2. Strict Tech Stack Specification

Lovable.dev must scaffold the application using the following exact stack. Do not deviate or substitute frameworks.

Frontend Environment: React, Vite, TypeScript.

Styling & UI Components: Tailwind CSS, shadcn/ui (for buttons, modals, cards, and forms).

Backend, Database, & Auth: Supabase (PostgreSQL, Supabase Auth, Supabase Realtime, Supabase Storage).

Audio Recording: Native HTML5 MediaRecorder API (browser-based).

AI Integrations (via Edge Functions/n8n): OpenAI Whisper API (for audio transcription) and OpenAI GPT-4o (for strict checklist evaluation).

3. Database Schema (Supabase PostgreSQL)

The AI builder must generate the following relational tables with Row Level Security (RLS) enabled.

users

id (UUID, Primary Key, linked to Supabase Auth)

role (String: 'admin' or 'candidate')

full_name (String)

dob (Date)

email (String, Unique)

clinical_cases

id (UUID, Primary Key)

title (String)

exam_mode (String: 'oral_board' or 'panel_exam')

initial_prompt (Text)

checklist_rubric (JSONB: Array of mandatory phrases/keywords for AI grading)

time_limit_seconds (Integer, default 360)

case_assets

id (UUID, Primary Key)

case_id (UUID, Foreign Key to clinical_cases)

asset_url (String, linked to Supabase Storage)

trigger_keywords (Array of Strings, e.g., ["thorax", "x-ray", "ekg"])

asset_type (String: 'image' or 'video')

exam_sessions

id (UUID, Primary Key)

case_id (UUID, Foreign Key to clinical_cases)

station_token (String, Unique)

status (String: 'waiting', 'active', 'completed')

current_candidate_id (UUID, Foreign Key to users, nullable)

session_start_time (Timestamp, nullable)

exam_results

id (UUID, Primary Key)

session_id (UUID, Foreign Key to exam_sessions)

candidate_id (UUID, Foreign Key to users)

audio_file_url (String, linked to Supabase Storage)

transcript (Text, generated by Whisper)

ai_score_report (JSONB, generated by GPT-4o mapping to checklist_rubric)

4. Core Application Interfaces & User Flows

A. Admin Dashboard (Protected Route: /admin)

Case Manager: CRUD interface for clinical_cases and file upload component for case_assets (saving directly to Supabase Storage).

Rubric Builder: A dynamic list input allowing admins to add mandatory highlighted points (Daftar Tilik) that the candidate must say.

Station Controller: A panel to generate and assign a station_token to a specific case.

B. Display PC Interface (Route: /station/:token)

State 1 (Waiting): Subscribes to Supabase Realtime for the specific station_token. Displays a dynamically generated QR Code containing the unique session URL.

State 2 (Active): Upon candidate scan and confirmation, the screen clears the QR code and displays the initial_prompt.

State 3 (Reactive): Listens to a Supabase Realtime channel for chat events from the candidate's phone. If a requested keyword matches an item in case_assets, the UI immediately renders the image/video on screen.

State 4 (Reset): When the timer hits zero, the screen clears all media and returns to State 1 with a regenerated, fresh QR code.

C. Candidate Mobile Interface (Route: /exam/:session_id)

Login & Scanner: A strictly contained view requiring Name, DOB, and Email. The immediate next view is a camera component (using a library like react-qr-reader) to scan the PC screen.

Gatekeeper Modal: Upon scanning, the browser must trigger the native microphone permission request. Logic Rule: The "Ready to Begin" button remains disabled until navigator.mediaDevices.getUserMedia({ audio: true }) returns success.

Countdown: A visual 30-second countdown timer. If ignored, the session resets.

Active Exam View: * Header: Displays a synchronized countdown timer (e.g., 6:00).

Audio Controller: A hidden or non-intrusive component actively recording audio in chunks.

Chat Input (Oral Board Mode Only): A text input field and submit button. When text is submitted, it pushes an event to the Supabase Realtime channel linked to the session.

Submission & Lockout: At 0:00, the MediaRecorder stops, compiles the audio blob, and uploads it to Supabase Storage. The candidate is redirected to a static "Exam Completed" screen.

Anti-Cheat Logic: Wrap the exam view in a useEffect hook that listens for visibilitychange or beforeunload. If the tab loses focus, instantly terminate the exam session and record a "Force Closed" status in the database.

5. AI Evaluation Pipeline (Edge Functions)

When an audio file is uploaded to Supabase Storage, an Edge Function must trigger the following synchronous sequence:

Transcription: Send the audio file URL to the OpenAI Whisper API. Retrieve the raw text transcript.

Evaluation: Send a strictly formatted prompt to OpenAI GPT-4o containing the transcript and the checklist_rubric JSON from the database.

System Prompt for GPT-4o: "You are an objective medical examiner. Compare the provided transcript against the checklist. Return a JSON object with a boolean for each checklist item indicating if the candidate verbally addressed it, using clinical synonym matching."

Save: Update the exam_results table with the final AI output.

GIVE CLARIFICATION CHOICES IF IT NEEDED

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nboe.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2daf44ac-225e-4a65-9fc7-34dc6e4de8c0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

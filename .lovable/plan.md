

# Fix: PC Display Issues & AI Hallucination

## 3 Issues Identified

### 1. PC Station doesn't stop when candidate finishes
The polling fallback (3s) detects `status === "completed"` and calls `autoRegenerateSession` — which creates a **new** session and shows QR. This technically works, but the transition happens so fast the admin might not notice the exam ended. The real issue is that the station **auto-regenerates immediately**, making it seem like the exam never stopped.

**Fix**: Add a brief "Ujian Selesai" screen (5 seconds) before auto-regenerating. This gives clear visual feedback that the exam ended.

### 2. Case media covers examination assets (scroll needed)
`StationDisplay` renders case media AND active examination assets in a vertical stack (lines 206-216). When both exist, the page overflows and requires scrolling, causing the admin to miss the examination asset.

**Fix**: When an `activeAsset` is present, **hide case media and case prompt** — show only the active examination asset in full screen. When no examination is active, show case media as before.

### 3. AI hallucination on thorax photo
The system prompt rule 1 says: "berikan hasil/jawaban singkat dan faktual" for examination assets. The AI interprets this as an invitation to **generate** clinical findings for the image, even though no interpretation text was provided. The AI has no access to the actual image — it's hallucinating.

**Fix**: Change the system prompt to explicitly instruct the AI that for examination assets (which have media), it should ONLY say the media is being displayed on screen and NOT generate any interpretation or findings. Interpretations should only come from `answer_text` in additional_info assets.

## Files to Modify

- **`src/pages/StationDisplay.tsx`**
  - Add `"completed_screen"` state that shows "Ujian Selesai" for 5s before auto-regenerating
  - When `activeAsset` exists, hide `CasePromptDisplay` and `caseMedia`, show only the active asset full-screen

- **`supabase/functions/exam-chat/index.ts`**
  - Update system prompt rule 1: for examination assets, tell AI to ONLY confirm the media is being displayed, do NOT generate interpretations
  - Add explicit rule: "Kamu TIDAK BISA melihat gambar/video. Jangan membuat interpretasi atau deskripsi media."


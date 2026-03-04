

# Add "Delete Audio Only" Button to ResultsViewer

## Changes (1 file: `src/components/admin/ResultsViewer.tsx`)

### 1. Add a "Delete Audio" mutation
- Deletes the audio file from `exam-audio` storage bucket
- Sets `audio_file_url` to `null` on the `exam_results` row (preserving transcript and AI score)
- Invalidates query cache to refresh UI

### 2. Add "Hapus Audio" button in the expanded detail section
- Shown next to the audio player only when `audio_file_url` exists
- Confirm dialog before deletion
- After deletion, the audio section disappears

### 3. Disable "Evaluate" button when audio is deleted
- Condition: `!r.audio_file_url` disables the Evaluate button (since the edge function needs audio to transcribe)
- Add tooltip or title explaining why it's disabled

### 4. Keep existing data intact
- Transcript, AI score report, reasoning, tips all remain visible
- Only the audio file and its reference are removed

No database migration needed -- just updating `audio_file_url` to `null` which is already nullable.


# TASK: Add return-to-main-menu flow after exam completion

Repo: `/home/linuxmint/nboe-app`, current branch based on latest `origin/main`.

User requests, in Indonesian:
On `src/pages/ExamCompleted.tsx` and the `completed` step flow in `src/pages/ExamMobile.tsx`:
1. Add primary button labeled exactly `Kembali ke Menu Utama (/exam)` with Home or ArrowLeft icon.
2. On click, show confirmation dialog/alert with exact message:
   `Apakah Anda yakin ingin kembali ke menu utama? Pastikan seluruh rekaman telah terunggah dan pengawas telah mencatat kehadiran Anda.`
   Buttons: `Batal` and `Ya, Kembali`.
3. Add automatic countdown (e.g. 30 seconds) that redirects to `/exam` if candidate leaves the completed screen idle. Show remaining seconds clearly.
4. Before redirecting to `/exam`, fully reset local exam state: stop/clear audio stream tracks, clear active session, next session, case/session/sequence state, timers, realtime channels/subscriptions, recording refs as applicable. Avoid exam loop or blank screen when scanning a new station.

Inspect current latest code first. Preserve existing completed behavior/results. Use existing shadcn AlertDialog/Dialog and React Router navigation conventions. Avoid memory leaks: countdown and subscriptions must clean up on unmount or manual navigation; do not navigate during render. Ensure both direct `ExamCompleted` rendering and ExamMobile `completed` step have correct behavior without duplicate dialogs/countdowns. Prefer a shared helper/component if appropriate.

Add focused tests for countdown/reset/navigation logic if practical. Do not touch unrelated untracked files.

Acceptance:
- `npx tsc -b --pretty false` passes
- `npm test -- --run` passes, add regression tests if appropriate
- `npm run build` passes
- `git diff --check` passes
- Commit on branch `feat/exam-completed-return-menu`
- Final report: changed files, behavior, verification outputs, commit hash.
Use Codex to implement, not merely plan.
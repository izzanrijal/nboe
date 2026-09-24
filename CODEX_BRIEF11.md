# TASK: Reset PC station after the entire sequence completes

Repo: `/home/linuxmint/nboe-app`, latest main. Implement in a new branch `feat/station-ready-next-candidate`.

User requirement:
On PC display `src/pages/StationDisplay.tsx`, when the whole question sequence is complete (`sequence_complete`, including after the final question has been scored), do not leave the screen permanently on congratulations. Show a transition screen:
- notification exactly/near exactly: `Ujian Selesai — Station Siap untuk Peserta Berikutnya`
- countdown around 10–15 seconds: `Kembali ke layar Scan QR dalam X detik...`
- CTA: `Siapkan QR Peserta Baru Sekarang`
When countdown ends or CTA clicked:
- call existing safe station reset/regenerate RPC if appropriate (inspect `regenerate_station_session`; do not invent unsafe client-only reset)
- create a clean new session/token for the next candidate
- return state to `waiting`, rendering QR and new booking code
- clear active asset, chat broadcast channel, old case data, sequence/completion state, timers, polling, and stale subscriptions so no data leaks and no blank/loop screen.

Inspect current StationDisplay fully and migrations/RPC/types. There is already regenerate_station_session and sequence_complete; preserve existing flow for non-final sequence questions. Ensure final sequence reset does not accidentally regenerate the same case in a way that skips/duplicates sequence items or attaches a new candidate to a completed deployment. Decide and document whether reset creates a fresh standalone station session for the same station/case, or a fresh deployment sequence; use the existing product semantics and DB constraints.

Important concurrency/safety:
- Reset must be idempotent against double click/countdown race (ref/guard).
- Cleanup before or atomically with state transition; detach realtime broadcast channel and clear refs.
- New QR token must be unique and session status waiting.
- The old completed result/session must remain completed and visible in results.
- Keep current active station flow and next-question behavior unchanged.
- Do not modify unrelated untracked files.

Add focused tests for final-completion UI/countdown/CTA/reset guard and cleanup if practical. Run:
`npx tsc -b --pretty false`
`npm test -- --run`
`npm run build`
`git diff --check`
Commit and report changed files, RPC/migration behavior, exact verification, and commit hash. Use Codex to implement, not merely plan.
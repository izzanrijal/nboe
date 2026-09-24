# Fix next-question failure and realtime synchronization

Repo /home/linuxmint/nboe-app. Current branch may contain unrelated uncommitted duration work; do not touch or delete unrelated files. Create branch fix/next-question-realtime from current main/origin main as appropriate, preserving existing station sequence architecture.

User bug: after candidate completes question 1, mobile shows "Coba Soal Berikutnya Lagi" / "Gagal menemukan soal berikutnya" although a next sequence item exists. Ensure Supabase realtime is active during exam so PC station and candidate mobile stay synchronized.

Investigate first, then fix root cause. Trace ExamMobile, ExamActiveView, StationDisplay, RPC advance_station_sequence, claim_exam_session, get_session_by_token, and Realtime subscriptions. Existing session:* channels are broadcast chat/asset only; add postgres_changes subscriptions where needed for exam_sessions/exam_results/sequence state. Do not rely only on realtime: RPC calls must remain authoritative and idempotent, with polling/retry fallback.

Requirements:
1. Reproduce/analyze the exact failure path after q1 completion. Check response shapes, stale session IDs/tokens, RPC parameter names and outcome handling.
2. When next item exists, mobile must resolve it reliably. A transient RPC/network/realtime delay must not show a misleading terminal error; retry with fresh DB state and bounded backoff. Handle reused/advanced outcomes.
3. Candidate completion and station completion must be idempotent; concurrent mobile+PC calls must not duplicate sessions or incorrectly return completed/invalid_order.
4. On mobile, subscribe to relevant exam_sessions UPDATE/INSERT and sequence/session changes for the active deployment/session. Clean up channels on session change/unmount. Realtime status errors must fall back to polling.
5. On StationDisplay, keep postgres_changes status subscription and ensure it tracks the new session/token after advance; do not leave listener attached only to old session. Keep URL/token transition correct.
6. Use clear Indonesian error only after bounded retries and include actionable recovery; no false "soal berikutnya tidak ada" if DB shows one.
7. Add regression tests for: q1->q2 resolution when both callers race; transient RPC empty/error then successful retry; realtime subscription cleanup/rebind; final q completion remains terminal.
8. Run npx tsc -b --pretty false, npm test -- --run, npm run build, git diff --check. Commit on fix/next-question-realtime and report root cause, files, tests, commit hash.

Use Codex to implement, not just plan.
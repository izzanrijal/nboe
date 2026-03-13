

# Remove Anti-Cheat System

The anti-cheat hook causes false session terminations on mobile (screen off, notifications, etc.). User wants it removed entirely.

## Changes

| File | Change |
|------|--------|
| `src/components/exam/ExamActiveView.tsx` | Remove `useAntiCheat` import, remove `handleCheat` function, remove `useAntiCheat(true, handleCheat)` call |
| `src/hooks/useAntiCheat.ts` | Delete file |

The `onForceClose` prop and `force_closed` status in the DB will remain available in case anti-cheat is re-added later, but nothing will trigger them.


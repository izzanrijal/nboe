

# Fix: Blank Screen & Auth Session

## Root Cause

Two issues causing blank screen:

1. **Race condition**: `onAuthStateChange` fires with `INITIAL_SESSION` event, but `await checkAdminRole()` inside it causes a deadlock — Supabase docs warn against awaiting async ops in `onAuthStateChange`. Meanwhile `getSession()` also runs and may call `signOut()` (one-time session logic), causing conflicting state updates.

2. **One-time session enforcement** (lines 70-75): If user has a valid Supabase session in localStorage but no `sessionStorage` flag (e.g. closed tab and reopened), it signs them out. This was intentional but now needs to be removed per user's request to behave like a normal app.

## Fix Plan

### `src/contexts/AuthContext.tsx`
- Remove all `SESSION_FLAG` / `sessionStorage` logic entirely
- Follow the stack-overflow pattern: `getSession()` first to initialize, then `onAuthStateChange` for updates
- Do NOT await async calls inside `onAuthStateChange` — use `setTimeout` to defer `checkAdminRole` outside the callback, or better: set user/session synchronously in the callback, and run `checkAdminRole` via a separate `useEffect` that watches `user`
- Simplified approach:
  1. `getSession()` → set user/session → check admin → set loading false
  2. `onAuthStateChange` → set user/session only (no await)
  3. Separate `useEffect` on `user?.id` → check admin role

### `src/pages/Login.tsx`
- Already fixed (navigates to `/`). No changes needed.

### `src/pages/Index.tsx`
- No changes needed. Already handles role-based redirect.

## Files to Change

**1 file**: `src/contexts/AuthContext.tsx` — rewrite auth initialization to remove one-time session logic and fix race condition.


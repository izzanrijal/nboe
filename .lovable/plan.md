

# Improve Station Display & Chat UX

## Problems Identified

1. **Questions hidden when asset is active** — The station display uses a ternary: when `activeAsset` is shown, `CasePromptDisplay` (including questions) disappears entirely. Questions should always be visible alongside assets.

2. **Timer too small on monitor** — The `CountdownTimer` on StationDisplay uses default sizing. On a large display PC, it should be prominent (large font).

3. **Chat guidance missing** — The empty-state hint in ExamActiveView is vague. Candidates need clear instructions that they can request examinations/media to be displayed on the monitor, and that the monitor is the primary focus.

## Changes

### 1. `src/pages/StationDisplay.tsx` — Restructure active layout

- Split the active view into a **sidebar** (case info + questions, always visible) and a **main area** (asset or case media).
- Make the timer large and prominent in the header.
- When an asset is triggered, show it in the main area while keeping the case title and questions visible in a side panel.

```text
┌──────────────────────────────────────────────┐
│  [Badge]     ██ 05:32 ██     Timer (large)   │
├──────────────────┬───────────────────────────┤
│  Case Title      │                           │
│  ─────────────── │   Active Asset /          │
│  Prompt text     │   Case Media              │
│  ─────────────── │   (main display area)     │
│  Soal:           │                           │
│  1. ...          │                           │
│  2. ...          │                           │
│  3. ...          │                           │
└──────────────────┴───────────────────────────┘
```

- When no asset is active and no case media exists, the prompt + questions fill the full width (current behavior).
- When an asset or case media is present, use a two-column layout: left = case info (narrower), right = asset/media (wider).

### 2. `src/components/station/CountdownTimer.tsx` — No changes needed
The component already accepts `className` for sizing. We'll pass larger classes from StationDisplay.

### 3. `src/components/exam/ExamActiveView.tsx` — Improve chat empty state & guidance

- Replace the generic empty-state text with a more descriptive guidance message:
  - Inform candidates they can request examinations (e.g., "Rontgen thorax", "Lab darah lengkap")
  - Explain that results will appear on the monitor screen
  - Emphasize focusing on the monitor for visual results
- Add a subtle persistent hint banner below the case section (above chat messages) reminding candidates about the monitor interaction.

### 4. `src/components/station/CasePromptDisplay.tsx` — Add compact mode

- Add an optional `compact` prop for the sidebar layout on StationDisplay, using smaller text and tighter spacing so it fits in a side panel.

## Files to Edit
- `src/pages/StationDisplay.tsx`
- `src/components/station/CasePromptDisplay.tsx`
- `src/components/exam/ExamActiveView.tsx`


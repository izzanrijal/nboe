

# Fix: "Objects are not valid as a React child" for Rubric Data

## Root Cause

The rubric data in the database exists in multiple incompatible formats:

1. **Raw array** from ExcelImporter/migration: `[{item_text, points, is_critical}]`
2. **Wrapped format** from CaseForm saves: `{enabled: true, items: [{text, points, isCritical}]}`

The `parseRubricData` function in CaseForm has a bug on line 32-33: when rubric data is in the `{enabled, items}` format, it returns the object **without normalizing** the items inside. If a case was saved with items still using `{item_text, is_critical}` keys (mixed format), those raw objects leak into RubricBuilder and crash React.

Additionally, ExcelImporter stores rubric as raw `[{item_text, points, is_critical}]` arrays directly into the DB, creating format inconsistency.

## Changes

### 1. `src/components/admin/CaseForm.tsx` — Normalize items in ALL branches
- In `parseRubricData`, when the `{enabled, items}` format is detected, also normalize each item inside `items` (convert `item_text` → `text`, `is_critical` → `isCritical`)

### 2. `src/components/admin/ExcelImporter.tsx` — Save normalized format
- Change rubric saved to DB from `[{item_text, points, is_critical}]` to `{enabled: true, items: [{text, points, isCritical}]}` so all new imports use the canonical format

### 3. `src/components/admin/CaseManager.tsx` — Defensive rubric count
- Add a helper function to safely count rubric items regardless of format, preventing any object from being rendered as a React child


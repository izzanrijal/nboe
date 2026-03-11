

# Rangkaian Ujian Berturut-turut (Exam Sequence)

## Konsep

Admin memilih beberapa case sekaligus dan menentukan urutannya saat deploy station. Satu URL station menjalankan semua ujian secara berurutan. Setelah peserta selesai 1 ujian, PC menampilkan QR baru untuk ujian berikutnya (case berbeda). Peserta mulai dari gatekeeper lagi tiap ujian.

## Database Changes

### New table: `exam_sequence_items`
Menyimpan urutan case dalam satu station deployment.

```sql
CREATE TABLE public.exam_sequence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_token text NOT NULL,        -- shared token for the sequence
  case_id uuid NOT NULL,
  sequence_order integer NOT NULL,     -- 1, 2, 3...
  session_id uuid,                     -- filled when session is created
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_sequence_items ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage sequence items" ON public.exam_sequence_items
FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

-- Public read (station display needs it without auth)
CREATE POLICY "Public read sequence items" ON public.exam_sequence_items
FOR SELECT TO anon, authenticated USING (true);
```

### New DB function: `advance_station_sequence`
Called by StationDisplay after exam completes. Finds the next case in the sequence, creates a new session for it, returns the new session data.

```sql
CREATE OR REPLACE FUNCTION public.advance_station_sequence(
  _station_token text,
  _completed_sequence_order integer
)
RETURNS TABLE(id uuid, case_id uuid, status text, session_start_time timestamptz, sequence_order integer, is_last boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _next_item exam_sequence_items%ROWTYPE;
  _new_session_id uuid;
  _total integer;
BEGIN
  -- Find next item in sequence
  SELECT * INTO _next_item FROM exam_sequence_items
  WHERE station_token = _station_token AND sequence_order = _completed_sequence_order + 1;

  -- Count total
  SELECT count(*) INTO _total FROM exam_sequence_items WHERE station_token = _station_token;

  IF _next_item IS NULL THEN
    -- No more exams, sequence complete
    RETURN;
  END IF;

  -- Create new session
  INSERT INTO exam_sessions (case_id, station_token, status)
  VALUES (_next_item.case_id, _station_token, 'waiting')
  RETURNING exam_sessions.id INTO _new_session_id;

  -- Link session to sequence item
  UPDATE exam_sequence_items SET session_id = _new_session_id WHERE id = _next_item.id;

  RETURN QUERY SELECT _new_session_id, _next_item.case_id, 'waiting'::text, NULL::timestamptz, _next_item.sequence_order, (_next_item.sequence_order >= _total);
END;
$$;
```

## Frontend Changes

### 1. SessionManager — Multi-select deploy UI
- Replace single `Select` with a multi-select list (checkboxes + drag-to-reorder or numbered list)
- "Deploy Station" creates:
  - First session (`exam_sessions` row with token)
  - All `exam_sequence_items` rows (one per case, ordered)
  - Links first item's `session_id` to the created session
- Single-case deploy still works (just 1 item in sequence)

### 2. StationDisplay — Sequence awareness
- After `completed_screen`, instead of always calling `regenerate_station_session` (same case), call `advance_station_sequence` to get the next case
- If no next case returned → show "Semua Ujian Selesai" final screen
- If next case exists → load new session, show QR
- Show progress indicator: "Ujian 2/4"

### 3. ExamCompleted — Show "next exam" info
- When session is part of a sequence, show "Scan QR berikutnya di layar PC untuk ujian selanjutnya" instead of "You may close this window"
- Query `exam_sequence_items` to check if there's a next item

## Files Changed

| File | Action |
|------|--------|
| Migration SQL | Create `exam_sequence_items` table + `advance_station_sequence` function |
| `src/components/admin/SessionManager.tsx` | Multi-select cases UI + sequence deploy logic |
| `src/pages/StationDisplay.tsx` | Sequence-aware regeneration + progress indicator + final screen |
| `src/pages/ExamCompleted.tsx` | Conditional message for sequence exams |
| `src/components/station/QRDisplay.tsx` | Add optional progress prop ("Ujian 2/4") |


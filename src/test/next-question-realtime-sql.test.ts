import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260924160000_fix_next_question_realtime.sql"),
  "utf8"
);

describe("next-question realtime SQL invariants", () => {
  it("makes a repeated claim by the same candidate successful", () => {
    expect(migration).toContain("IF _session.current_candidate_id = _candidate_id THEN");
    expect(migration).toContain("'success', true, 'outcome', 'reused'");
    expect(migration).toContain("FOR UPDATE");
  });

  it("selects and locks the next existing order rather than assuming gapless numbering", () => {
    expect(migration).toContain("sequence_order > _current_item.sequence_order");
    expect(migration).toContain("ORDER BY sequence_order\n  LIMIT 1\n  FOR UPDATE");
  });

  it("keeps completion explicit and publishes all synchronization tables", () => {
    expect(migration).toContain("'completed'::text");
    expect(migration).toContain("ARRAY['exam_sessions', 'exam_results', 'exam_sequence_items']");
    expect(migration).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE");
  });
});

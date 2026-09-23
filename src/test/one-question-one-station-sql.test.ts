import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260923170000_one_question_one_station.sql"),
  "utf8"
);
const examActiveSource = readFileSync(
  resolve(process.cwd(), "src/components/exam/ExamActiveView.tsx"),
  "utf8"
);
const resultsViewerSource = readFileSync(
  resolve(process.cwd(), "src/components/admin/ResultsViewer.tsx"),
  "utf8"
);
const evaluateExamSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/evaluate-exam/index.ts"),
  "utf8"
);

describe("one-question-one-station SQL invariant", () => {
  it("enforces one session and one sequence item per station token", () => {
    expect(migration).toContain("exam_sessions_station_token_unique_idx");
    expect(migration).toContain("exam_sequence_items_station_token_unique_idx");
    expect(migration).toContain("exam_sequence_items_session_id_unique_idx");
  });

  it("locks the target row before checking session_id", () => {
    const targetLock = migration.indexOf("sequence_order = _current_item.sequence_order + 1\n  FOR UPDATE");
    const existingMapping = migration.indexOf("IF _next_item.session_id IS NOT NULL");
    const insertSession = migration.indexOf("INSERT INTO public.exam_sessions (case_id, station_token, status)", existingMapping);

    expect(targetLock).toBeGreaterThan(-1);
    expect(existingMapping).toBeGreaterThan(targetLock);
    expect(insertSession).toBeGreaterThan(existingMapping);
  });

  it("reuses every existing target session regardless of status", () => {
    const reuseBranch = migration.slice(
      migration.indexOf("IF _next_item.session_id IS NOT NULL"),
      migration.indexOf("-- Compatibility repair")
    );

    expect(reuseBranch).toContain("'reused'::text");
    expect(reuseBranch).not.toContain("status IN");
  });

  it("returns explicit completed and invalid_order rows instead of zero rows", () => {
    expect(migration).toContain("'completed'::text");
    expect(migration).toContain("'invalid_order'::text");
  });

  it("keeps result attribution on result -> session -> case", () => {
    expect(examActiveSource).toContain("session_id: sessionId");
    expect(resultsViewerSource).toContain("exam_sessions:session_id(status, case_id, clinical_cases:case_id(title, exam_mode))");
    expect(evaluateExamSource).toContain(".eq(\"id\", result.session_id).single()");
    expect(evaluateExamSource).toContain(".eq(\"id\", sessionData.case_id).single()");
  });
});

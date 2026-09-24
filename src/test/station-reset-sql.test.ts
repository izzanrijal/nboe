import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260924170000_reset_completed_station_sequence.sql"),
  "utf8",
);

describe("completed station reset SQL", () => {
  it("is idempotent per completed deployment and keeps the source deployment untouched", () => {
    expect(migration).toContain("completed_deployment_id uuid PRIMARY KEY");
    expect(migration).toContain("Return the same reset on retry");
    expect(migration).not.toMatch(/UPDATE public\.exam_sessions[\s\S]*_current_item\.deployment_id/);
    expect(migration).not.toMatch(/DELETE FROM public\.(exam_sessions|exam_sequence_items)/);
  });

  it("requires every source session to be terminal", () => {
    expect(migration).toContain("session.status NOT IN ('completed', 'force_closed')");
    expect(migration).toContain("station sequence is not complete");
  });

  it("creates a new waiting session and mapping for every ordered item", () => {
    expect(migration).toContain("ORDER BY item.sequence_order, item.id");
    expect(migration).toContain("INSERT INTO public.exam_sessions");
    expect(migration).toContain("'waiting'");
    expect(migration).toContain("INSERT INTO public.exam_sequence_items");
    expect(migration).toContain("_new_deployment_id");
  });
});

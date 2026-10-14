import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ingest = readFileSync(resolve(process.cwd(), "supabase/functions/ingest-case/index.ts"), "utf8");

describe("ingest-case keeps rubrics achievable", () => {
  it("uses mode-aware validation rather than forcing broad Oral Board items", () => {
    expect(ingest).toContain("getRubricQualityError(items, data.exam_mode)");
    expect(ingest).not.toMatch(/items\.length < 15/);
    expect(ingest).not.toMatch(/items\.length >= 15/);
  });

  it("rejects duplicated rubric lines", () => {
    expect(ingest).toContain("butir duplikat");
    expect(ingest).toMatch(/normalizedTexts\.indexOf\(t\) !== idx/);
  });

  it("documents the new rubric contract to callers", () => {
    expect(ingest).toContain("Oral Board 1-100 butir objektif unik, points=2");
    expect(ingest).not.toContain(">=15 items");
  });
  it("permits concise Oral Board scenarios and tasks", () => {
    expect(ingest).toContain('data.exam_mode !== "oral_board"');
    expect(ingest).toContain('data.exam_mode === "oral_board" ? numberedTasks < 1');
  });
});

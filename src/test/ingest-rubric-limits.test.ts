import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ingest = readFileSync(resolve(process.cwd(), "supabase/functions/ingest-case/index.ts"), "utf8");

describe("ingest-case keeps rubrics achievable", () => {
  it("requires 5-7 broad items instead of padding to 15+", () => {
    expect(ingest).toMatch(/items\.length < 5 \|\| items\.length > 7/);
    // The old >=15 gate is what forced the generator to duplicate lines.
    expect(ingest).not.toMatch(/items\.length < 15/);
    expect(ingest).not.toMatch(/items\.length >= 15/);
  });

  it("rejects duplicated rubric lines", () => {
    expect(ingest).toContain("butir duplikat");
    expect(ingest).toMatch(/normalizedTexts\.indexOf\(t\) !== idx/);
  });

  it("documents the new rubric contract to callers", () => {
    expect(ingest).toContain("5-7 butir LUAS");
    expect(ingest).not.toContain(">=15 items");
  });
});

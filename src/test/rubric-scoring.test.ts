import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const evaluateExam = readFileSync(
  resolve(process.cwd(), "supabase/functions/evaluate-exam/index.ts"),
  "utf8",
);
const schema = readFileSync(
  resolve(process.cwd(), "supabase/functions/evaluate-exam/score-schema.ts"),
  "utf8",
);

describe("rubric scoring: 2 full / 1 partial / 0 none", () => {
  it("caps each rubric line at 2 points", () => {
    expect(evaluateExam).toContain("const FULL_POINTS = 2");
  });

  it("awards 2 for full, 1 for partial and 0 for none", () => {
    expect(evaluateExam).toMatch(/coverage === "full" \? FULL_POINTS : coverage === "partial" \? 1 : 0/);
  });

  it("totals earned points against the ceiling", () => {
    expect(evaluateExam).toMatch(/item\.maxPoints \?\? 2/);
    expect(evaluateExam).toMatch(/item\.points \?\? 0/);
  });

  it("asks the model for a coverage level", () => {
    expect(schema).toMatch(/coverage: \{ type: "string", enum: \["full", "partial", "none"\] \}/);
    expect(evaluateExam).toContain('"full"    = butir BENAR-BENAR disebut');
    expect(evaluateExam).toMatch(/"partial" -> disebutkan namun tidak lengkap => dapat 1 poin/);
  });

  it("never awards full points to a partial mention", () => {
    expect(evaluateExam).toContain("Butir yang hanya \"partial\" TIDAK boleh diberi 2 poin");
  });

  it("treats any mention as passed so the footnote is not bold", () => {
    expect(evaluateExam).toMatch(/const passed = coverage !== "none"/);
  });

  it("trusts the model's coverage instead of requiring a verifiable quote", () => {
    // Requiring a verifiable quote made the same answer score differently
    // between runs and zeroed items the candidate had actually answered.
    expect(evaluateExam).toMatch(/rawCoverage === "full"/);
    expect(evaluateExam).toMatch(/rawCoverage === "partial"/);
    expect(evaluateExam).not.toMatch(/quoteOk && claimedFull/);
  });

  it("grades deterministically", () => {
    expect(evaluateExam).toContain("deterministic: true");
  });
});

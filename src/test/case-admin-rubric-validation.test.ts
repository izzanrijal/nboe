import { describe, expect, it } from "vitest";
import { getRubricQualityError } from "../../supabase/functions/case-admin/rubric-validation";

const item = (points = 2, isCritical = true) => ({ points, isCritical });

describe("case-admin focused rubric validation", () => {
  it("accepts objective Oral Board checklists without arbitrary count or critical minimums", () => {
    for (const count of [1, 4, 14, 30, 100]) {
      expect(getRubricQualityError(Array.from({ length: count }, () => item(2, false)), "oral_board")).toBeNull();
    }
  });

  it("enforces a 2-point ceiling per Oral Board item", () => {
    expect(getRubricQualityError([item(3)], "oral_board")).toContain("maximum of 2");
    expect(getRubricQualityError([item(1)], "oral_board")).toContain("maximum of 2");
    expect(getRubricQualityError(Array.from({ length: 101 }, () => item()), "oral_board")).toContain("100");
  });

  it("treats an empty rubric as disabling checklist grading", () => {
    expect(getRubricQualityError([])).toBeNull();
  });

  it("accepts a focused 5-item rubric", () => {
    expect(getRubricQualityError(Array.from({ length: 5 }, () => item()))).toBeNull();
  });

  it("accepts a focused 7-item rubric", () => {
    expect(getRubricQualityError(Array.from({ length: 7 }, () => item()))).toBeNull();
  });

  it("rejects a rubric that is too granular", () => {
    const error = getRubricQualityError(Array.from({ length: 15 }, () => item(3, false)));
    expect(error).toContain("5-7 broad items");
  });

  it("rejects a 4-item rubric", () => {
    const error = getRubricQualityError(Array.from({ length: 4 }, () => item()));
    expect(error).toContain("5-7 broad items");
  });

  it("requires at least 2 critical items and 10 total points", () => {
    expect(getRubricQualityError(Array.from({ length: 5 }, () => item(2, false)))).toBe(
      "At least 2 rubric items must be isCritical:true",
    );
    expect(getRubricQualityError([item(1, true), item(1, true), item(1, false), item(1, false), item(1, false)]))
      .toContain(">= 10");
  });

  it("rejects a rubric that repeats the same line", () => {
    const withText = (text: string, points = 2, isCritical = true) => ({ text, points, isCritical });
    const error = getRubricQualityError([
      withText("Atropin 0.5 mg IV"),
      withText("Kalsium glukonat 10%"),
      withText("Atropin 0.5 mg IV"),
      withText("Insulin + dextrose"),
      withText("Sodium bikarbonat"),
    ]);
    expect(error).toContain("duplicate");
  });
});

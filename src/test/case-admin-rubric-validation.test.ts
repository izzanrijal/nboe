import { describe, expect, it } from "vitest";
import { getRubricQualityError } from "../../supabase/functions/case-admin/rubric-validation";

describe("case-admin focused rubric validation", () => {
  it("accepts a focused 3-item active rubric", () => {
    expect(getRubricQualityError([
      { points: 2, isCritical: true },
      { points: 2, isCritical: false },
      { points: 2, isCritical: false },
    ])).toBeNull();
  });

  it("rejects a 2-item active rubric", () => {
    expect(getRubricQualityError([
      { points: 5, isCritical: true },
      { points: 5, isCritical: false },
    ])).toBe("Active rubric must contain at least 3 items (got 2)");
  });

  it("allows an empty item list to disable the rubric", () => {
    expect(getRubricQualityError([])).toBeNull();
  });

  it("requires one critical item and at least 6 total points when active", () => {
    expect(getRubricQualityError([
      { points: 2, isCritical: false },
      { points: 2, isCritical: false },
      { points: 2, isCritical: false },
    ])).toBe("At least 1 rubric item must be isCritical:true");

    expect(getRubricQualityError([
      { points: 1, isCritical: true },
      { points: 1, isCritical: false },
      { points: 1, isCritical: false },
    ])).toBe("Rubric total points must be >= 6 (got 3)");
  });
});

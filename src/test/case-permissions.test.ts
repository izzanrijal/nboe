import { describe, expect, it } from "vitest";
import { canEditCase, isRubricEditable } from "@/lib/casePermissions";

describe("case detail permissions", () => {
  it("allows the owner admin to edit", () => {
    expect(
      canEditCase({ isMasterAdmin: false, createdBy: "owner-id", userId: "owner-id" })
    ).toBe(true);
  });

  it("allows the master admin to edit a case owned by another admin", () => {
    expect(
      canEditCase({ isMasterAdmin: true, createdBy: "owner-id", userId: "master-id" })
    ).toBe(true);
  });

  it("keeps a non-owner admin and the rubric read-only", () => {
    const canEdit = canEditCase({
      isMasterAdmin: false,
      createdBy: "owner-id",
      userId: "other-admin-id",
    });

    expect(canEdit).toBe(false);
    expect(isRubricEditable({ canEdit, isEditing: false })).toBe(false);
  });

  it("keeps the rubric read-only if editing state is somehow true for a non-owner", () => {
    const canEdit = canEditCase({
      isMasterAdmin: false,
      createdBy: "owner-id",
      userId: "other-admin-id",
    });

    expect(isRubricEditable({ canEdit, isEditing: true })).toBe(false);
  });
});

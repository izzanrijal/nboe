import { describe, expect, it } from "vitest";
import {
  getDeploymentValidationError,
  getExcludedCaseIds,
  type CompletedCaseHistory,
} from "@/lib/deploymentEligibility";

const history: CompletedCaseHistory[] = [
  { candidateId: "candidate-a", caseId: "panel-a", examMode: "panel_exam" },
  { candidateId: "candidate-a", caseId: "oral-a", examMode: "oral_board" },
  { candidateId: "candidate-b", caseId: "panel-b", examMode: "panel_exam" },
];

describe("deployment participant eligibility", () => {
  it("keeps all cases available but fails deploy validation when no participant is selected", () => {
    expect(getExcludedCaseIds(history, [], "panel_exam")).toEqual(new Set());
    expect(getDeploymentValidationError({
      participantIds: [],
      caseIds: ["panel-a"],
      pcCount: 1,
    })).toBe("Pilih minimal satu peserta sebelum deploy");
  });

  it("hides a prior Panel case completed by the selected participant", () => {
    expect(getExcludedCaseIds(history, ["candidate-a"], "panel_exam"))
      .toEqual(new Set(["panel-a"]));
  });

  it("does not let Oral Board history hide a Panel case", () => {
    const oralOnlyHistory: CompletedCaseHistory[] = [
      { candidateId: "candidate-a", caseId: "shared-case", examMode: "oral_board" },
    ];

    expect(getExcludedCaseIds(oralOnlyHistory, ["candidate-a"], "panel_exam"))
      .toEqual(new Set());
  });

  it("uses ANY-selected semantics for multiple participants", () => {
    expect(getExcludedCaseIds(
      history,
      ["candidate-a", "candidate-b"],
      "panel_exam",
    )).toEqual(new Set(["panel-a", "panel-b"]));
  });

  it("leaves every case available when selected participants have no history", () => {
    expect(getExcludedCaseIds(history, ["candidate-without-results"], "panel_exam"))
      .toEqual(new Set());
  });
});

import { describe, it, expect } from "vitest";
import {
  candidateStepAfterResolution,
  resolveCandidateSequenceRow,
  type NextSessionResolution,
} from "@/lib/examSequence";

describe("exam sequence navigation", () => {
  it("advances to the next question when the RPC reuses its pre-created session", () => {
    const resolution = resolveCandidateSequenceRow({
      next_id: "s2",
      next_sequence_order: 2,
      outcome: "reused",
    });

    expect(candidateStepAfterResolution(resolution)).toBe("next_case");
  });

  it("completes only on the explicit completed outcome", () => {
    expect(candidateStepAfterResolution({ outcome: "completed" })).toBe("completed");
  });

  it.each<NextSessionResolution>([
    { outcome: "unresolved" },
    { outcome: "invalid_order" },
  ])("keeps a non-terminal outcome recoverable: $outcome", (resolution) => {
    expect(candidateStepAfterResolution(resolution)).toBe("timeout_unresolved");
  });

  it("does not interpret an empty RPC response as exam completion", () => {
    const resolution = resolveCandidateSequenceRow(null);

    expect(resolution).toEqual({ outcome: "unresolved" });
    expect(candidateStepAfterResolution(resolution)).not.toBe("completed");
  });

  it("walks a full 5-question sequence without landing on a blank/unreachable step", () => {
    const total = 5;
    const visited: string[] = ["gatekeeper"];

    for (let question = 1; question <= total; question += 1) {
      visited.push("reading", "active");
      const resolution: NextSessionResolution = question === total
        ? { outcome: "completed" }
        : {
            outcome: "reused",
            next: { sessionId: `s${question + 1}`, sequenceOrder: question + 1 },
          };
      const nextStep = candidateStepAfterResolution(resolution);
      visited.push(nextStep);
      if (nextStep === "completed") break;
    }

    expect(visited.filter((step) => step === "active")).toHaveLength(total);
    expect(visited.filter((step) => step === "next_case")).toHaveLength(total - 1);
    expect(visited.at(-1)).toBe("completed");
    expect(visited).not.toContain("force_closed");
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  candidateStepAfterResolution,
  resolveCandidateSequenceRow,
  resolveCandidateSequenceWithRetry,
  type CandidateSequenceContext,
  type NextSessionResolution,
} from "@/lib/examSequence";

const context: CandidateSequenceContext = {
  deploymentId: "deployment-1",
  token: "token-1",
  order: 1,
};
const noWait = async () => undefined;

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

  it("resolves q1 -> q2 to the same session when mobile and station race", async () => {
    let createdSessionId: string | null = null;
    const advance = async () => {
      // Yield so both callers enter the simulated RPC concurrently. The first
      // creates q2; the second observes and reuses the same mapping.
      await Promise.resolve();
      const outcome = createdSessionId ? "reused" as const : "advanced" as const;
      createdSessionId ??= "session-2";
      return [{ next_id: createdSessionId, next_sequence_order: 2, outcome }];
    };

    const [mobile, station] = await Promise.all([
      resolveCandidateSequenceWithRetry(async () => context, advance, { sleep: noWait }),
      resolveCandidateSequenceWithRetry(async () => context, advance, { sleep: noWait }),
    ]);

    expect(mobile).toMatchObject({ next: { sessionId: "session-2", sequenceOrder: 2 } });
    expect(station).toMatchObject({ next: { sessionId: "session-2", sequenceOrder: 2 } });
    expect(new Set([mobile.outcome, station.outcome])).toEqual(new Set(["advanced", "reused"]));
  });

  it("retries a transient RPC error and empty response using fresh state", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let contextLoads = 0;
    let rpcAttempts = 0;
    const resolution = await resolveCandidateSequenceWithRetry(
      async () => {
        contextLoads += 1;
        return context;
      },
      async () => {
        rpcAttempts += 1;
        if (rpcAttempts === 1) throw new Error("temporary network failure");
        if (rpcAttempts === 2) return [];
        return [{ next_id: "session-2", next_sequence_order: 2, outcome: "reused" }];
      },
      { maxAttempts: 3, sleep: noWait }
    );

    expect(resolution).toEqual({
      outcome: "reused",
      next: { sessionId: "session-2", sequenceOrder: 2 },
    });
    expect(contextLoads).toBe(3);
    expect(rpcAttempts).toBe(3);
    warning.mockRestore();
  });

  it("keeps final-question completion terminal without retrying", async () => {
    let rpcAttempts = 0;
    const resolution = await resolveCandidateSequenceWithRetry(
      async () => ({ ...context, token: "token-final", order: 5 }),
      async () => {
        rpcAttempts += 1;
        return [{ next_id: null, next_sequence_order: null, outcome: "completed" }];
      },
      { sleep: noWait }
    );

    expect(resolution).toEqual({ outcome: "completed" });
    expect(rpcAttempts).toBe(1);
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

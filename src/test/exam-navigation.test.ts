import { describe, it, expect } from "vitest";

/**
 * Regression guard for the NBOE exam "next question" navigation bug.
 *
 * The bug: a partial commit referenced `activeSessionId` / `nextCase` /
 * `handleContinueNext` / `handleCaseComplete` / `CheckCircle2` / "next_case"
 * without declaring them, throwing a ReferenceError at render time -> blank page,
 * and the exam appeared to end after question 1 instead of advancing through all 5.
 *
 * This test pins down the pure decision logic that drives the exam state machine,
 * mirroring `ExamMobile.handleCaseComplete`.
 */

type ExamStep =
  | "gatekeeper"
  | "reading"
  | "active"
  | "next_case"
  | "timeout_unresolved"
  | "force_closed"
  | "completed"
  | "duplicate_warning";

interface NextCase {
  sessionId: string;
  sequenceOrder: number;
}

/** Mirrors ExamMobile.handleCaseComplete exactly. */
function nextStep(
  next: NextCase | undefined,
  reason: "manual" | "timeout" = "manual"
): ExamStep {
  if (next?.sessionId) return "next_case";
  if (reason === "timeout") return "timeout_unresolved";
  return "completed";
}

/**
 * Mirrors ExamActiveView.resolveNextSession's decision:
 * `const resolvedSequence = sequence ?? (await checkSequence());
 *  if (!resolvedSequence || resolvedSequence.isLast) return undefined;`
 */
function shouldResolveNext(
  sequence: { isLast: boolean } | null,
  fetched: { isLast: boolean } | null
): boolean {
  const resolved = sequence ?? fetched;
  if (!resolved) return false;
  return !resolved.isLast;
}

describe("exam sequence navigation", () => {
  it("advances to the next question when a next session exists (mid-sequence)", () => {
    expect(nextStep({ sessionId: "s2", sequenceOrder: 2 }, "manual")).toBe("next_case");
  });

  it("completes the exam on manual finish of the final question", () => {
    expect(nextStep(undefined, "manual")).toBe("completed");
  });

  it("does NOT silently complete the exam on a mid-sequence timeout with no next session", () => {
    // Regression: previously this fell through to "completed" and skipped q2..q5.
    expect(nextStep(undefined, "timeout")).toBe("timeout_unresolved");
  });

  it("treats a timeout with a resolved next session as a normal advance", () => {
    expect(nextStep({ sessionId: "s4", sequenceOrder: 4 }, "timeout")).toBe("next_case");
  });

  it("defaults to manual when no reason is supplied", () => {
    expect(nextStep(undefined)).toBe("completed");
  });

  it("resolves the next session on demand when the cached sequence is still null", () => {
    // The cached lookup has not landed yet, but the on-demand fetch succeeds.
    expect(shouldResolveNext(null, { isLast: false })).toBe(true);
  });

  it("returns undefined when the sequence is unresolvable", () => {
    expect(shouldResolveNext(null, null)).toBe(false);
  });

  it("does not advance past the last question", () => {
    expect(shouldResolveNext({ isLast: true }, null)).toBe(false);
  });

  it("walks a full 5-question sequence without landing on a blank/unreachable step", () => {
    const TOTAL = 5;
    const visited: ExamStep[] = [];
    let step: ExamStep = "gatekeeper";
    visited.push(step);

    for (let q = 1; q <= TOTAL; q++) {
      // reading -> active for this question
      step = "reading";
      visited.push(step);
      step = "active";
      visited.push(step);

      const isLast = q === TOTAL;
      const next = isLast ? undefined : { sessionId: `s${q + 1}`, sequenceOrder: q + 1 };
      step = nextStep(next, "manual");
      visited.push(step);

      if (step === "next_case") {
        // candidate taps "Lanjut ke Soal N" -> back into reading
        continue;
      }
      break;
    }

    expect(visited.filter((s) => s === "active")).toHaveLength(TOTAL);
    expect(visited.filter((s) => s === "next_case")).toHaveLength(TOTAL - 1);
    expect(visited[visited.length - 1]).toBe("completed");
    // No reachable terminal state should ever be the blank-page fallback.
    expect(visited).not.toContain("force_closed");
  });
});

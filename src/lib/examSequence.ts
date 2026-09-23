export type SequenceRpcOutcome = "advanced" | "reused" | "completed" | "invalid_order";

export type NextSessionResolution =
  | {
      outcome: "advanced" | "reused";
      next: { sessionId: string; sequenceOrder: number };
    }
  | { outcome: "completed" }
  | { outcome: "invalid_order" | "unresolved" };

export interface SequenceRpcRow {
  next_id: string | null;
  next_sequence_order: number | null;
  outcome: SequenceRpcOutcome;
}

export function resolveCandidateSequenceRow(row: SequenceRpcRow | null): NextSessionResolution {
  if (!row) return { outcome: "unresolved" };
  if (row.outcome === "completed") return { outcome: "completed" };
  if (row.outcome === "invalid_order") return { outcome: "invalid_order" };
  if (row.next_id && row.next_sequence_order !== null) {
    return {
      outcome: row.outcome,
      next: { sessionId: row.next_id, sequenceOrder: row.next_sequence_order },
    };
  }
  return { outcome: "unresolved" };
}

export function candidateStepAfterResolution(
  resolution: NextSessionResolution
): "next_case" | "completed" | "timeout_unresolved" {
  if (resolution.outcome === "advanced" || resolution.outcome === "reused") {
    return "next_case";
  }
  if (resolution.outcome === "completed") return "completed";
  return "timeout_unresolved";
}

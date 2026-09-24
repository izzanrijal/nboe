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

export interface CandidateSequenceContext {
  deploymentId: string;
  token: string;
  order: number;
}

export interface SequenceRetryOptions {
  maxAttempts?: number;
  backoffMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
}

export function firstRpcRow<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
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

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Resolve the next question from fresh database state on every attempt.
 *
 * Both the mobile and station may call `advance_station_sequence`. The RPC is
 * authoritative; an empty response, transport error, or stale invalid_order is
 * recoverable and must never be interpreted as the end of the exam.
 */
export async function resolveCandidateSequenceWithRetry(
  loadContext: () => Promise<CandidateSequenceContext | null>,
  advance: (context: CandidateSequenceContext) => Promise<SequenceRpcRow | SequenceRpcRow[] | null>,
  options: SequenceRetryOptions = {}
): Promise<NextSessionResolution> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 4);
  const backoffMs = options.backoffMs ?? [0, 250, 750, 1500];
  const sleep = options.sleep ?? defaultSleep;
  let lastResolution: NextSessionResolution = { outcome: "unresolved" };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 0);
    }

    try {
      const context = await loadContext();
      if (!context) {
        lastResolution = { outcome: "unresolved" };
        continue;
      }

      const row = firstRpcRow(await advance(context));
      const resolution = resolveCandidateSequenceRow(row);
      if (
        resolution.outcome === "advanced" ||
        resolution.outcome === "reused" ||
        resolution.outcome === "completed"
      ) {
        return resolution;
      }
      lastResolution = resolution;
    } catch (error) {
      console.warn("Sequence resolution attempt failed:", { attempt: attempt + 1, error });
      lastResolution = { outcome: "unresolved" };
    }
  }

  return lastResolution;
}

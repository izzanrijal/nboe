import { supabase } from "@/integrations/supabase/client";
import {
  resolveCandidateSequenceWithRetry,
  type CandidateSequenceContext,
  type NextSessionResolution,
  type SequenceRetryOptions,
  type SequenceRpcRow,
} from "@/lib/examSequence";

export interface ClaimSessionResult {
  success: boolean;
  reason?: string;
  outcome?: "claimed" | "reused";
}

export async function loadCandidateSequenceContext(
  sessionId: string
): Promise<CandidateSequenceContext | null> {
  const { data: session, error: sessionError } = await supabase
    .from("exam_sessions")
    .select("id, station_token")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session?.station_token) return null;

  // session_id is the authoritative mapping. The token check prevents a stale
  // URL/token from accidentally resolving a different sequence item.
  const { data: mappedItem, error: mappedError } = await supabase
    .from("exam_sequence_items")
    .select("deployment_id, station_token, sequence_order, session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (mappedError) throw mappedError;

  if (mappedItem && mappedItem.station_token === session.station_token) {
    return {
      deploymentId: mappedItem.deployment_id,
      token: mappedItem.station_token,
      order: mappedItem.sequence_order,
    };
  }

  // Compatibility fallback for a sequence row whose session_id is being
  // repaired concurrently by advance_station_sequence.
  const { data: tokenItem, error: tokenError } = await supabase
    .from("exam_sequence_items")
    .select("deployment_id, station_token, sequence_order, session_id")
    .eq("station_token", session.station_token)
    .maybeSingle();
  if (tokenError) throw tokenError;
  if (!tokenItem || (tokenItem.session_id && tokenItem.session_id !== sessionId)) return null;

  return {
    deploymentId: tokenItem.deployment_id,
    token: tokenItem.station_token,
    order: tokenItem.sequence_order,
  };
}

export function resolveNextCandidateSession(
  sessionId: string,
  options?: SequenceRetryOptions
): Promise<NextSessionResolution> {
  return resolveCandidateSequenceWithRetry(
    () => loadCandidateSequenceContext(sessionId),
    async (context) => {
      const { data, error } = await supabase.rpc("advance_station_sequence", {
        _station_token: context.token,
        _completed_sequence_order: context.order,
      });
      if (error) throw error;
      return data as SequenceRpcRow[] | null;
    },
    options
  );
}

export async function claimCandidateSession(
  sessionId: string,
  candidateId: string,
  options: SequenceRetryOptions = {}
): Promise<ClaimSessionResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const backoffMs = options.backoffMs ?? [0, 300, 900];
  const sleep = options.sleep ?? ((milliseconds) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds)));
  let lastReason = "network_error";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 0);
    }

    try {
      const { data, error } = await supabase.rpc("claim_exam_session", {
        _session_id: sessionId,
        _candidate_id: candidateId,
      });
      if (error) throw error;

      const result = data as unknown as ClaimSessionResult;
      if (result?.success) return result;
      lastReason = result?.reason ?? "unknown";

      // Compatibility with a server that has not applied the idempotent claim
      // migration yet: a lost first response can surface as already_claimed.
      if (lastReason === "already_claimed") {
        const { data: current, error: currentError } = await supabase
          .from("exam_sessions")
          .select("current_candidate_id, status")
          .eq("id", sessionId)
          .maybeSingle();
        if (!currentError && current?.current_candidate_id === candidateId) {
          return { success: true, outcome: "reused" };
        }
      }

      if (["duplicate", "already_claimed", "session_not_found", "forbidden", "session_unavailable"].includes(lastReason)) {
        return result;
      }
    } catch (error) {
      console.warn("Session claim attempt failed:", { attempt: attempt + 1, error });
      lastReason = "network_error";
    }
  }

  return { success: false, reason: lastReason };
}

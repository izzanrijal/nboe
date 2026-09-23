export const STATION_ADVANCE_COUNTDOWN_SECONDS = 10;
export const STATION_MAX_TRANSIENT_RETRIES = 2;

export interface StationSequenceItem {
  deployment_id: string;
  station_token: string;
  sequence_order: number;
  session_id: string | null;
}

export interface StationSequenceInfo {
  token: string;
  currentOrder: number;
  total: number;
  currentSessionId: string | null;
}

export type StationCompletionDecision =
  | { kind: "advance"; countdownSeconds: number }
  | { kind: "legacy"; countdownSeconds: number };

export type StationAdvanceOutcome = "advanced" | "reused" | "completed" | "invalid_order";

export interface StationAdvanceRow {
  next_id: string | null;
  next_station_token: string | null;
  outcome: StationAdvanceOutcome;
}

export type StationAdvanceDecision =
  | { kind: "advance"; nextId: string; nextToken: string }
  | { kind: "sequence_complete" }
  | { kind: "invalid_order" }
  | { kind: "transient_error" };

export function resolveStationSequenceInfo(
  items: StationSequenceItem[],
  displayedSessionId: string | null,
  token: string
): StationSequenceInfo | null {
  if (items.length === 0) return null;

  const orderedItems = [...items].sort((a, b) => a.sequence_order - b.sequence_order);
  const tokenItems = orderedItems.filter((item) => item.station_token === token);
  if (tokenItems.length !== 1) return null;

  const currentItem = tokenItems[0];
  if (displayedSessionId && currentItem.session_id !== displayedSessionId) return null;

  return {
    token,
    currentOrder: currentItem.sequence_order,
    total: orderedItems.length,
    currentSessionId: currentItem.session_id,
  };
}

export function decideStationCompletion(
  sequence: StationSequenceInfo | null
): StationCompletionDecision {
  if (!sequence) {
    return { kind: "legacy", countdownSeconds: STATION_ADVANCE_COUNTDOWN_SECONDS };
  }

  return { kind: "advance", countdownSeconds: STATION_ADVANCE_COUNTDOWN_SECONDS };
}

export function decideStationAdvance(row: StationAdvanceRow | null): StationAdvanceDecision {
  if (!row) return { kind: "transient_error" };
  if (row.outcome === "completed") return { kind: "sequence_complete" };
  if (row.outcome === "invalid_order") return { kind: "invalid_order" };
  if (
    (row.outcome === "advanced" || row.outcome === "reused") &&
    row.next_id &&
    row.next_station_token
  ) {
    return { kind: "advance", nextId: row.next_id, nextToken: row.next_station_token };
  }
  return { kind: "transient_error" };
}

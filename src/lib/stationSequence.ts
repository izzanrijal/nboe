export const STATION_ADVANCE_COUNTDOWN_SECONDS = 10;

export interface StationSequenceItem {
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
  | { kind: "sequence_complete" }
  | { kind: "legacy"; countdownSeconds: number };

export function resolveStationSequenceInfo(
  items: StationSequenceItem[],
  displayedSessionId: string | null,
  token: string
): StationSequenceInfo | null {
  if (items.length === 0) return null;

  const orderedItems = [...items].sort((a, b) => a.sequence_order - b.sequence_order);
  const exactMatch = displayedSessionId
    ? orderedItems.find((item) => item.session_id === displayedSessionId)
    : undefined;
  const latestAssignedItem = [...orderedItems].reverse().find((item) => item.session_id);
  const currentItem = exactMatch ?? latestAssignedItem ?? orderedItems[0];

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

  if (sequence.currentOrder >= sequence.total) {
    return { kind: "sequence_complete" };
  }

  return { kind: "advance", countdownSeconds: STATION_ADVANCE_COUNTDOWN_SECONDS };
}

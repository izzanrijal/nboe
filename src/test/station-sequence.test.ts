import { describe, expect, it } from "vitest";
import {
  decideStationCompletion,
  resolveStationSequenceInfo,
  STATION_ADVANCE_COUNTDOWN_SECONDS,
  type StationSequenceItem,
} from "@/lib/stationSequence";

const sequenceItems: StationSequenceItem[] = [
  { sequence_order: 1, session_id: "session-1" },
  { sequence_order: 2, session_id: "session-2" },
  { sequence_order: 3, session_id: "session-3" },
];

describe("station sequence completion", () => {
  it("starts a visible 10-second countdown when question 1 of 3 has a next question", () => {
    const resolved = resolveStationSequenceInfo(sequenceItems, "session-1", "station-token");

    expect(resolved?.currentOrder).toBe(1);
    expect(decideStationCompletion(resolved)).toEqual({
      kind: "advance",
      countdownSeconds: STATION_ADVANCE_COUNTDOWN_SECONDS,
    });
    expect(STATION_ADVANCE_COUNTDOWN_SECONDS).toBe(10);
  });

  it("goes terminal without a countdown at question 3 of 3", () => {
    const resolved = resolveStationSequenceInfo(sequenceItems, "session-3", "station-token");

    expect(resolved?.currentOrder).toBe(3);
    expect(decideStationCompletion(resolved)).toEqual({ kind: "sequence_complete" });
  });

  it("uses freshly resolved order when the cached sequence is null instead of falling back to legacy", () => {
    const cached = null;
    const fresh = resolveStationSequenceInfo(sequenceItems, "session-1", "station-token");
    const decision = decideStationCompletion(fresh ?? cached);

    expect(fresh?.currentSessionId).toBe("session-1");
    expect(fresh?.currentOrder).toBe(1);
    expect(decision.kind).toBe("advance");
    expect(decision.kind).not.toBe("legacy");
  });
});

import { describe, expect, it } from "vitest";
import {
  decideStationAdvance,
  decideStationCompletion,
  resolveStationSequenceInfo,
  STATION_ADVANCE_COUNTDOWN_SECONDS,
  type StationSequenceItem,
} from "@/lib/stationSequence";

const sequenceItems: StationSequenceItem[] = [
  { deployment_id: "deployment-1", station_token: "token-1", sequence_order: 1, session_id: "session-1" },
  { deployment_id: "deployment-1", station_token: "token-2", sequence_order: 2, session_id: "session-2" },
  { deployment_id: "deployment-1", station_token: "token-3", sequence_order: 3, session_id: "session-3" },
];

describe("station sequence completion", () => {
  it("starts a visible 10-second countdown when question 1 of 3 has a next question", () => {
    const resolved = resolveStationSequenceInfo(sequenceItems, "session-1", "token-1");

    expect(resolved?.currentOrder).toBe(1);
    expect(decideStationCompletion(resolved)).toEqual({
      kind: "advance",
      countdownSeconds: STATION_ADVANCE_COUNTDOWN_SECONDS,
    });
    expect(decideStationAdvance({
      next_id: "session-2",
      next_station_token: "token-2",
      outcome: "reused",
    })).toEqual({ kind: "advance", nextId: "session-2", nextToken: "token-2" });
    expect(STATION_ADVANCE_COUNTDOWN_SECONDS).toBe(10);
  });

  it("q3 of 3 goes terminal on an explicit completed outcome without retry", () => {
    const resolved = resolveStationSequenceInfo(sequenceItems, "session-3", "token-3");

    expect(resolved?.currentOrder).toBe(3);
    expect(decideStationAdvance({
      next_id: null,
      next_station_token: null,
      outcome: "completed",
    })).toEqual({ kind: "sequence_complete" });
  });

  it("uses freshly resolved order when the cached sequence is null instead of falling back to legacy", () => {
    const cached = null;
    const fresh = resolveStationSequenceInfo(sequenceItems, "session-1", "token-1");
    const decision = decideStationCompletion(fresh ?? cached);

    expect(fresh?.currentSessionId).toBe("session-1");
    expect(fresh?.currentOrder).toBe(1);
    expect(decision.kind).toBe("advance");
    expect(decision.kind).not.toBe("legacy");
  });

  it("maps one token to exactly one sequence session", () => {
    const resolved = resolveStationSequenceInfo(sequenceItems, "session-2", "token-2");

    expect(resolved).toMatchObject({
      token: "token-2",
      currentOrder: 2,
      currentSessionId: "session-2",
      total: 3,
    });

    const ambiguous = [...sequenceItems, {
      deployment_id: "deployment-1",
      station_token: "token-2",
      sequence_order: 4,
      session_id: "session-4",
    }];
    expect(resolveStationSequenceInfo(ambiguous, "session-2", "token-2")).toBeNull();
  });

  it("treats non-matching order as non-retryable", () => {
    expect(decideStationAdvance({
      next_id: null,
      next_station_token: null,
      outcome: "invalid_order",
    })).toEqual({ kind: "invalid_order" });
  });

  it("reuses an already-completed next session instead of requiring a new id", () => {
    expect(decideStationAdvance({
      next_id: "session-2",
      next_station_token: "token-2",
      outcome: "reused",
    })).toEqual({ kind: "advance", nextId: "session-2", nextToken: "token-2" });
  });
});

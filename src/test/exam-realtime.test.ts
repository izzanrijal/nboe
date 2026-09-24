import { describe, expect, it, vi } from "vitest";
import {
  bindExamRealtime,
  type ExamRealtimeClient,
} from "@/lib/examRealtime";

function createRealtimeHarness() {
  const registrations: Array<{ filter: Record<string, string>; callback: (payload: { new: Record<string, unknown> }) => void }> = [];
  const channels: Array<{ name: string }> = [];
  const removed: Array<{ name: string }> = [];
  const channel = (name: string) => {
    const instance = {
      name,
      on: (_type: "postgres_changes", filter: Record<string, string>, callback: (payload: { new: Record<string, unknown> }) => void) => {
        registrations.push({ filter, callback });
        return instance;
      },
      subscribe: (callback?: (status: string) => void) => {
        callback?.("SUBSCRIBED");
        return instance;
      },
    };
    channels.push(instance);
    return instance;
  };
  const client = {
    channel,
    removeChannel: (target: { name: string }) => {
      removed.push(target);
      return "ok";
    },
  } as unknown as ExamRealtimeClient;

  return { client, registrations, channels, removed };
}

describe("exam realtime binding", () => {
  it("subscribes to session, result, and deployment sequence changes", () => {
    const harness = createRealtimeHarness();
    const onChange = vi.fn();
    const onStatus = vi.fn();

    bindExamRealtime(harness.client, {
      sessionId: "session-1",
      deploymentId: "deployment-1",
    }, { onChange, onStatus });

    expect(harness.registrations.map(({ filter }) => [filter.table, filter.event, filter.filter])).toEqual([
      ["exam_sessions", "UPDATE", "id=eq.session-1"],
      ["exam_sessions", "INSERT", undefined],
      ["exam_results", "*", "session_id=eq.session-1"],
      ["exam_sequence_items", "*", "deployment_id=eq.deployment-1"],
    ]);
    expect(onStatus).toHaveBeenCalledWith("SUBSCRIBED");
  });

  it("cleans up the old channel exactly once and rebinds to the new session/token scope", () => {
    const harness = createRealtimeHarness();
    const cleanupOld = bindExamRealtime(harness.client, {
      sessionId: "session-1",
      deploymentId: "deployment-1",
    }, { onChange: vi.fn() });

    cleanupOld();
    cleanupOld();
    bindExamRealtime(harness.client, {
      sessionId: "session-2",
      deploymentId: "deployment-1",
    }, { onChange: vi.fn() });

    expect(harness.removed).toHaveLength(1);
    expect(harness.removed[0].name).toContain("session-1");
    expect(harness.channels.map(({ name }) => name)).toEqual([
      "exam-sync:session-1:deployment-1",
      "exam-sync:session-2:deployment-1",
    ]);
    const newSessionFilter = harness.registrations.find(
      ({ filter }) => filter.filter === "id=eq.session-2"
    );
    expect(newSessionFilter).toBeDefined();
  });
});

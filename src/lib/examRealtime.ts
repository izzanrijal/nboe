export type ExamRealtimeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | string;

export interface ExamRealtimeScope {
  sessionId: string;
  deploymentId?: string | null;
}

export interface ExamDatabaseChange {
  table: "exam_sessions" | "exam_results" | "exam_sequence_items";
  event: "INSERT" | "UPDATE" | "*";
  row: Record<string, unknown>;
}

interface RealtimeChannelLike {
  on(
    type: "postgres_changes",
    filter: Record<string, string>,
    callback: (payload: { new: Record<string, unknown> }) => void
  ): RealtimeChannelLike;
  subscribe(callback?: (status: ExamRealtimeStatus, error?: Error) => void): RealtimeChannelLike;
}

export interface ExamRealtimeClient {
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): unknown;
}

export interface ExamRealtimeHandlers {
  onChange: (change: ExamDatabaseChange) => void;
  onStatus?: (status: ExamRealtimeStatus, error?: Error) => void;
}

/** Bind all database signals used by an exam screen and return an idempotent cleanup. */
export function bindExamRealtime(
  client: ExamRealtimeClient,
  scope: ExamRealtimeScope,
  handlers: ExamRealtimeHandlers
): () => void {
  let channel = client.channel(
    `exam-sync:${scope.sessionId}:${scope.deploymentId ?? "standalone"}`
  );
  const notify = (
    table: ExamDatabaseChange["table"],
    event: ExamDatabaseChange["event"]
  ) => (payload: { new: Record<string, unknown> }) => {
    handlers.onChange({ table, event, row: payload.new });
  };

  channel = channel
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "exam_sessions",
      filter: `id=eq.${scope.sessionId}`,
    }, notify("exam_sessions", "UPDATE"))
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "exam_sessions",
    }, notify("exam_sessions", "INSERT"))
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "exam_results",
      filter: `session_id=eq.${scope.sessionId}`,
    }, notify("exam_results", "*"));

  if (scope.deploymentId) {
    channel = channel.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "exam_sequence_items",
      filter: `deployment_id=eq.${scope.deploymentId}`,
    }, notify("exam_sequence_items", "*"));
  }

  channel.subscribe(handlers.onStatus);
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    void client.removeChannel(channel);
  };
}

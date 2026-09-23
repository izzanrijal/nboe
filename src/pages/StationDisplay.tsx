import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { matchesKeywords } from "@/lib/keywordMatcher";
import { generateBookingCode } from "@/lib/bookingCode";
import {
  decideStationCompletion,
  resolveStationSequenceInfo,
  STATION_ADVANCE_COUNTDOWN_SECONDS,
  type StationSequenceInfo,
} from "@/lib/stationSequence";
import QRDisplay from "@/components/station/QRDisplay";
import CasePromptDisplay from "@/components/station/CasePromptDisplay";
import AssetRenderer from "@/components/station/AssetRenderer";
import CountdownTimer from "@/components/station/CountdownTimer";
import { Badge } from "@/components/ui/badge";

type StationState = "loading" | "waiting" | "active" | "completed_screen" | "sequence_complete";

interface SessionData {
  id: string;
  case_id: string;
  status: string;
  session_start_time: string | null;
}

interface CaseData {
  title: string;
  initial_prompt: string;
  time_limit_seconds: number;
  questions_text: string;
}

interface AssetData {
  id: string;
  asset_url: string;
  asset_type: string;
  trigger_keywords: string[];
}

type SequenceLookup = {
  sessionId: string | null;
  status: "idle" | "loading" | "resolved" | "error";
  info: StationSequenceInfo | null;
};

const StationDisplay = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<StationState>("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [caseMedia, setCaseMedia] = useState<{ asset_url: string; asset_type: string }[]>([]);
  const [activeAsset, setActiveAsset] = useState<AssetData | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [currentToken, setCurrentToken] = useState(token);
  const regeneratingRef = useRef(false);
  const pendingAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedHandledRef = useRef<string | null>(null);
  const [countdown, setCountdown] = useState(STATION_ADVANCE_COUNTDOWN_SECONDS);
  const [completionAttempt, setCompletionAttempt] = useState(0);
  const [sequenceLookup, setSequenceLookup] = useState<SequenceLookup>({
    sessionId: null,
    status: "idle",
    info: null,
  });

  const sequenceInfo =
    sequenceLookup.status === "resolved" && sequenceLookup.sessionId === (session?.id ?? null)
      ? sequenceLookup.info
      : null;

  const resolveSequenceState = useCallback(async (
    stationToken: string,
    displayedSessionId: string | null
  ): Promise<StationSequenceInfo | null> => {
    const { data: currentItem, error: currentItemError } = await supabase
      .from("exam_sequence_items")
      .select("deployment_id")
      .eq("station_token", stationToken)
      .maybeSingle();

    if (currentItemError) throw currentItemError;
    if (!currentItem?.deployment_id) return null;

    const { data, error } = await supabase
      .from("exam_sequence_items")
      .select("sequence_order, session_id")
      .eq("deployment_id", currentItem.deployment_id)
      .order("sequence_order", { ascending: true });

    if (error) throw error;
    return resolveStationSequenceInfo(data ?? [], displayedSessionId, stationToken);
  }, []);

  // Resolve sequence order against the session actually displayed, not cached UI order.
  useEffect(() => {
    if (!currentToken || state === "sequence_complete") return;

    let cancelled = false;
    const displayedSessionId = session?.id ?? null;
    setSequenceLookup({ sessionId: displayedSessionId, status: "loading", info: null });

    const fetchSequence = async () => {
      try {
        const info = await resolveSequenceState(currentToken, displayedSessionId);
        if (!cancelled) {
          setSequenceLookup({ sessionId: displayedSessionId, status: "resolved", info });
        }
      } catch (error) {
        console.error("Sequence lookup failed:", error);
        if (!cancelled) {
          setSequenceLookup({ sessionId: displayedSessionId, status: "error", info: null });
        }
      }
    };

    void fetchSequence();
    return () => {
      cancelled = true;
    };
  }, [currentToken, session?.id, state, resolveSequenceState]);

  // Fetch session by token
  useEffect(() => {
    if (!currentToken) return;
    const fetchSession = async () => {
      const { data, error } = await supabase.rpc("get_session_by_token", { _token: currentToken });

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setState("loading"); return; }
      const sessionRow = row as { id: string; case_id: string; status: string; session_start_time: string | null };
      setSession(sessionRow);
      if (sessionRow.status === "active") setState("active");
      else if (sessionRow.status === "completed" || sessionRow.status === "force_closed") {
        setState("completed_screen");
      }
      else setState("waiting");
    };
    void fetchSession();
  }, [currentToken]);

  // After exam completes, advance sequence or regenerate same case
  const handleSessionCompleted = useCallback(async (
    caseId: string,
    completedSessionId: string,
    stationToken: string
  ): Promise<boolean> => {
    if (regeneratingRef.current) return false;
    regeneratingRef.current = true;

    try {
      // Resolve again at completion time so a stale/null render can never choose legacy mode.
      const freshSequence = await resolveSequenceState(stationToken, completedSessionId);
      setSequenceLookup({
        sessionId: completedSessionId,
        status: "resolved",
        info: freshSequence,
      });

      if (freshSequence) {
        const decision = decideStationCompletion(freshSequence);

        if (decision.kind === "advance") {
          // Advance to next in sequence
          const { data, error } = await supabase.rpc("advance_station_sequence", {
            _station_token: freshSequence.token,
            _completed_sequence_order: freshSequence.currentOrder,
          });

          if (error) {
            console.error("Advance sequence failed:", error);
            return false;
          }

          const next = data?.[0];
          if (next?.next_id) {
            const nextToken = next.next_station_token ?? stationToken;
            setSession({
              id: next.next_id,
              case_id: next.next_case_id,
              status: next.next_status,
              session_start_time: next.next_session_start_time,
            });
            setSequenceLookup({
              sessionId: next.next_id,
              status: "resolved",
              info: {
                token: nextToken,
                currentOrder: next.next_sequence_order,
                total: freshSequence.total,
                currentSessionId: next.next_id,
              },
            });
            setCurrentToken(nextToken);
            window.history.replaceState(null, "", `/station/${nextToken}`);
            setActiveAsset(null);
            setCaseData(null);
            setState(next.next_status === "active" ? "active" : "waiting");
            return true;
          }

          console.error("Advance sequence returned no next session");
          return false;
        }

        // No more exams in sequence
        setState("sequence_complete");
        return true;
      }

      // A successful fresh lookup proved this is not a sequence: keep legacy behavior.
      const newToken = generateBookingCode();
      const { data, error } = await supabase.rpc("regenerate_station_session", {
        _case_id: caseId,
        _new_token: newToken,
      });
      if (error || !data?.[0]) {
        console.error("Regenerate session failed:", error);
        return false;
      }
      setSession(data[0]);
      setCurrentToken(newToken);
      setActiveAsset(null);
      setCaseData(null);
      setState("waiting");
      window.history.replaceState(null, "", `/station/${newToken}`);
      return true;
    } catch (e) {
      console.error("Failed to handle session completion:", e);
      return false;
    } finally {
      regeneratingRef.current = false;
    }
  }, [resolveSequenceState]);

  // Subscribe to session changes + polling fallback
  useEffect(() => {
    if (!session?.id) return;
    const displayedSessionId = session.id;

    const updateFromRow = (updated: Pick<SessionData, "status" | "session_start_time">) => {
      if (regeneratingRef.current) return;
      setSession((prev) => prev ? { ...prev, status: updated.status, session_start_time: updated.session_start_time } : prev);
      if (updated.status === "active") setState("active");
      else if (updated.status === "completed" || updated.status === "force_closed") {
        setState("completed_screen");
      }
    };

    const channel = supabase
      .channel(`session-status-${displayedSessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "exam_sessions", filter: `id=eq.${displayedSessionId}` }, (payload) => {
        updateFromRow(payload.new as Pick<SessionData, "status" | "session_start_time">);
      })
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data } = await supabase.rpc("get_session_by_token", { _token: currentToken });
      const row = Array.isArray(data) ? data?.[0] : data;
      // Ignore a different session until this display explicitly advances its token.
      if (row?.id === displayedSessionId) updateFromRow(row);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [session?.id, currentToken]);

  const resolvedCompletionDecision = sequenceLookup.status === "resolved"
    ? decideStationCompletion(sequenceLookup.info)
    : null;
  const completionKind = sequenceLookup.status === "error"
    ? "retry"
    : resolvedCompletionDecision?.kind ?? null;
  const completionCountdownSeconds = completionKind && completionKind !== "sequence_complete"
    ? STATION_ADVANCE_COUNTDOWN_SECONDS
    : null;
  const completionSessionId = session?.id;
  const completionCaseId = session?.case_id;

  // The visible countdown is the single owner of completion timing and advancement.
  useEffect(() => {
    if (state !== "completed_screen" || !completionSessionId || !completionCaseId || !currentToken) return;
    if (sequenceLookup.sessionId !== completionSessionId || !completionKind) return;

    if (completionKind === "sequence_complete") {
      setState("sequence_complete");
      return;
    }

    if (!completionCountdownSeconds || completedHandledRef.current === completionSessionId) return;
    if (pendingAdvanceRef.current) clearTimeout(pendingAdvanceRef.current);

    const completedSessionId = completionSessionId;
    const completedCaseId = completionCaseId;
    const stationToken = currentToken;
    let remaining = completionCountdownSeconds;
    setCountdown(remaining);

    const countdownInterval = setInterval(() => {
      remaining = Math.max(remaining - 1, 0);
      setCountdown(remaining);
    }, 1000);

    const advanceTimeout = setTimeout(async () => {
      clearInterval(countdownInterval);
      pendingAdvanceRef.current = null;
      setCountdown(0);

      if (completedHandledRef.current === completedSessionId) return;
      completedHandledRef.current = completedSessionId;

      const completed = await handleSessionCompleted(
        completedCaseId,
        completedSessionId,
        stationToken
      );
      if (!completed) {
        completedHandledRef.current = null;
        setSequenceLookup((previous) => previous.sessionId === completedSessionId
          ? { ...previous, status: "error" }
          : previous
        );
        setCompletionAttempt((attempt) => attempt + 1);
      }
    }, completionCountdownSeconds * 1000);
    pendingAdvanceRef.current = advanceTimeout;

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(advanceTimeout);
      if (pendingAdvanceRef.current === advanceTimeout) {
        pendingAdvanceRef.current = null;
      }
    };
  }, [
    completionAttempt,
    completionCaseId,
    completionCountdownSeconds,
    completionKind,
    completionSessionId,
    currentToken,
    handleSessionCompleted,
    sequenceLookup.sessionId,
    state,
  ]);

  useEffect(() => () => {
    if (pendingAdvanceRef.current) clearTimeout(pendingAdvanceRef.current);
  }, []);

  // Fetch case data and assets when active
  useEffect(() => {
    if (state !== "active" || !session?.case_id) return;
    const fetchCase = async () => {
      const { data } = await supabase.rpc("get_case_display", { _case_id: session.case_id });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setCaseData(row as any);
      const { data: assetData } = await supabase.rpc("get_case_assets_for_display", { _case_id: session.case_id });
      const assetRows = Array.isArray(assetData) ? assetData : [];
      if (assetRows.length) {
        setAssets(assetRows.filter((a: any) => a.category === "examination"));
        setCaseMedia(assetRows.filter((a: any) => a.category === "case_media"));
      }
    };
    fetchCase();
  }, [state, session?.case_id]);

  // Subscribe to broadcast channel
  useEffect(() => {
    if (state !== "active" || !session?.id) return;

    const channel = supabase.channel(`session:${session.id}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "chat" }, (payload) => {
        const message = payload.payload?.message as string || "";
        if (!message) return;

        let matched: AssetData | null = null;
        for (const asset of assets) {
          if (matchesKeywords(message, asset.trigger_keywords)) {
            matched = asset;
            break;
          }
        }

        if (matched) {
          setActiveAsset(matched);
          channel.send({
            type: "broadcast",
            event: "asset_response",
            payload: { available: true, assetType: matched.asset_type, message: `Menampilkan ${matched.asset_type}: ${matched.trigger_keywords[0] || "asset"}` },
          });
        } else {
          channel.send({
            type: "broadcast",
            event: "asset_response",
            payload: { available: false, message: "Pemeriksaan tersebut tidak tersedia" },
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [state, session?.id, assets]);

  const handleTimerComplete = useCallback(async () => {
    if (!session?.id) return;
    await supabase.from("exam_sessions").update({ status: "completed" }).eq("id", session.id);
  }, [session?.id]);

  const completionDecision =
    state === "completed_screen" &&
    session &&
    sequenceLookup.sessionId === session.id &&
    resolvedCompletionDecision
      ? resolvedCompletionDecision
      : null;

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (state === "sequence_complete" || completionDecision?.kind === "sequence_complete") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h1 className="text-4xl font-bold text-foreground">Semua Ujian Selesai</h1>
          <p className="text-xl text-muted-foreground">
            Seluruh rangkaian {sequenceInfo?.total || ""} ujian telah selesai dilaksanakan.
          </p>
        </div>
      </div>
    );
  }

  if (state === "waiting" && session) {
    return (
      <QRDisplay
        sessionId={session.id}
        stationToken={currentToken}
        sequenceLabel={sequenceInfo && sequenceInfo.total > 1 ? `Ujian ${sequenceInfo.currentOrder} / ${sequenceInfo.total}` : undefined}
      />
    );
  }

  if (state === "completed_screen") {
    const countdownIsReady =
      sequenceLookup.sessionId === session?.id &&
      (sequenceLookup.status === "resolved" || sequenceLookup.status === "error");

    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h1 className="text-4xl font-bold text-foreground">Ujian Selesai</h1>
          {completionDecision?.kind === "advance" ? (
            <>
              <p className="text-xl text-muted-foreground">
                Ujian {sequenceInfo?.currentOrder} / {sequenceInfo?.total} selesai.
              </p>
              <div className="text-7xl font-bold text-foreground tabular-nums">{countdown}</div>
              <p className="text-xl text-muted-foreground">
                Soal berikutnya dimulai dalam {countdown} detik
              </p>
            </>
          ) : countdownIsReady ? (
            <>
              <div className="text-7xl font-bold text-foreground tabular-nums">{countdown}</div>
              <p className="text-xl text-muted-foreground">
                {sequenceLookup.status === "error"
                  ? `Mencoba menyiapkan sesi berikutnya dalam ${countdown} detik`
                  : `Sesi baru akan dimulai dalam ${countdown} detik`}
              </p>
            </>
          ) : (
            <p className="text-xl text-muted-foreground">Menyiapkan sesi berikutnya...</p>
          )}
        </div>
      </div>
    );
  }

  const hasMediaContent = activeAsset || caseMedia.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header: Badge + large timer */}
      {session?.session_start_time && caseData && (
        <div className="flex items-center justify-center py-4 border-b border-border bg-card">
          <div className="flex items-center gap-6">
            {sequenceInfo && sequenceInfo.total > 1 && (
              <Badge className="text-lg px-4 py-1" variant="secondary">
                Ujian {sequenceInfo.currentOrder} / {sequenceInfo.total}
              </Badge>
            )}
            <CountdownTimer
              sessionStartTime={session.session_start_time}
              timeLimitSeconds={caseData.time_limit_seconds}
              onComplete={handleTimerComplete}
              className="text-foreground"
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {hasMediaContent ? (
          <>
            {/* Sidebar: case info + questions (always visible) */}
            <div className="w-[340px] shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
              {caseData && (
                <CasePromptDisplay
                  title={caseData.title}
                  prompt={caseData.initial_prompt}
                  questionsText={caseData.questions_text}
                  compact
                />
              )}
            </div>
            {/* Main display area: active asset or case media */}
            <div className="flex-1 flex items-center justify-center p-8">
              {activeAsset ? (
                <AssetRenderer url={activeAsset.asset_url} type={activeAsset.asset_type} />
              ) : (
                <div className="flex flex-wrap gap-4 justify-center max-w-4xl mx-auto">
                  {caseMedia.map((media, idx) => (
                    <AssetRenderer key={idx} url={media.asset_url} type={media.asset_type} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Full width: no media, show case prompt centered */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {caseData && (
              <CasePromptDisplay
                title={caseData.title}
                prompt={caseData.initial_prompt}
                questionsText={caseData.questions_text}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StationDisplay;

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { matchesKeywords } from "@/lib/keywordMatcher";
import { generateBookingCode } from "@/lib/bookingCode";
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

interface SequenceInfo {
  currentOrder: number;
  total: number;
}

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
  const [sequenceInfo, setSequenceInfo] = useState<SequenceInfo | null>(null);

  // Load sequence info for current token
  useEffect(() => {
    if (!currentToken) return;
    const fetchSequence = async () => {
      const { data } = await supabase
        .from("exam_sequence_items")
        .select("id, sequence_order, session_id")
        .eq("station_token", currentToken)
        .order("sequence_order", { ascending: true });

      if (data && data.length > 0) {
        // Find current order based on which item has the active/latest session
        const total = data.length;
        // Find the item whose session matches our current session, or default to first
        setSequenceInfo((prev) => ({ currentOrder: prev?.currentOrder || 1, total }));
      } else {
        setSequenceInfo(null);
      }
    };
    fetchSequence();
  }, [currentToken]);

  // Fetch session by token
  useEffect(() => {
    if (!currentToken) return;
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("id, case_id, status, session_start_time")
        .eq("station_token", currentToken)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) { setState("loading"); return; }
      setSession(data);
      if (data.status === "active") setState("active");
      else if (data.status === "completed" || data.status === "force_closed") {
        setState("completed_screen");
        setTimeout(() => handleSessionCompleted(data.case_id), 5000);
      }
      else setState("waiting");
    };
    fetchSession();
  }, [currentToken]);

  // After exam completes, advance sequence or regenerate same case
  const handleSessionCompleted = useCallback(async (caseId: string) => {
    if (regeneratingRef.current) return;
    regeneratingRef.current = true;

    try {
      // Check if this is part of a sequence
      if (sequenceInfo && sequenceInfo.total > 0) {
        const currentOrder = sequenceInfo.currentOrder;

        if (currentOrder < sequenceInfo.total) {
          // Advance to next in sequence
          const { data, error } = await (supabase.rpc as any)('advance_station_sequence', {
            _station_token: currentToken,
            _completed_sequence_order: currentOrder,
          });

          if (error) {
            console.error("Advance sequence failed:", error);
            regeneratingRef.current = false;
            return;
          }

          if (data && data.length > 0) {
            const next = data[0];
            setSession({ id: next.next_id, case_id: next.next_case_id, status: 'waiting', session_start_time: null });
            setSequenceInfo({ currentOrder: next.next_sequence_order, total: sequenceInfo.total });
            setActiveAsset(null);
            setCaseData(null);
            setState("waiting");
            regeneratingRef.current = false;
            return;
          }
        }

        // No more exams in sequence
        setState("sequence_complete");
        regeneratingRef.current = false;
        return;
      }

      // Not a sequence — regenerate same case (legacy behavior)
      const newToken = generateBookingCode();
      const { data, error } = await (supabase.rpc as any)('regenerate_station_session', {
        _case_id: caseId,
        _new_token: newToken,
      });
      if (error || !data?.[0]) {
        console.error("Regenerate session failed:", error);
        regeneratingRef.current = false;
        return;
      }
      setSession(data[0]);
      setCurrentToken(newToken);
      setActiveAsset(null);
      setCaseData(null);
      setState("waiting");
      window.history.replaceState(null, "", `/station/${newToken}`);
      regeneratingRef.current = false;
    } catch (e) {
      console.error("Failed to handle session completion:", e);
      regeneratingRef.current = false;
    }
  }, [currentToken, sequenceInfo]);

  // Subscribe to session changes + polling fallback
  useEffect(() => {
    if (!session?.id) return;

    const updateFromRow = (updated: any) => {
      if (regeneratingRef.current) return;
      setSession((prev) => prev ? { ...prev, status: updated.status, session_start_time: updated.session_start_time } : prev);
      if (updated.status === "active") setState("active");
      else if (updated.status === "completed" || updated.status === "force_closed") {
        setState("completed_screen");
        if (session?.case_id) {
          setTimeout(() => handleSessionCompleted(session.case_id), 5000);
        }
      }
    };

    const channel = supabase
      .channel(`session-status-${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "exam_sessions", filter: `id=eq.${session.id}` }, (payload) => {
        updateFromRow(payload.new);
      })
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("exam_sessions")
        .select("id, case_id, status, session_start_time")
        .eq("id", session.id)
        .single();
      if (data) updateFromRow(data);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [session?.id, session?.case_id, handleSessionCompleted]);

  // Fetch case data and assets when active
  useEffect(() => {
    if (state !== "active" || !session?.case_id) return;
    const fetchCase = async () => {
      const { data } = await supabase.from("clinical_cases").select("title, initial_prompt, time_limit_seconds").eq("id", session.case_id).single();
      if (data) setCaseData(data);
      const { data: assetData } = await supabase.from("case_assets").select("id, asset_url, asset_type, trigger_keywords, category").eq("case_id", session.case_id);
      if (assetData) {
        setAssets(assetData.filter((a: any) => a.category === "examination"));
        setCaseMedia(assetData.filter((a: any) => a.category === "case_media"));
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

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (state === "sequence_complete") {
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
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h1 className="text-4xl font-bold text-foreground">Ujian Selesai</h1>
          {sequenceInfo && sequenceInfo.currentOrder < sequenceInfo.total ? (
            <p className="text-xl text-muted-foreground">
              Ujian {sequenceInfo.currentOrder} / {sequenceInfo.total} selesai. Ujian berikutnya akan dimulai...
            </p>
          ) : (
            <p className="text-xl text-muted-foreground">Sesi baru akan dimulai dalam beberapa detik...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {session?.session_start_time && caseData && (
        <div className="flex items-center justify-center py-6 border-b border-border">
          <div className="flex items-center gap-4">
            {sequenceInfo && sequenceInfo.total > 1 && (
              <Badge className="text-sm" variant="secondary">
                Ujian {sequenceInfo.currentOrder} / {sequenceInfo.total}
              </Badge>
            )}
            <CountdownTimer sessionStartTime={session.session_start_time} timeLimitSeconds={caseData.time_limit_seconds} onComplete={handleTimerComplete} />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {activeAsset ? (
          <AssetRenderer url={activeAsset.asset_url} type={activeAsset.asset_type} />
        ) : (
          <>
            {caseData && <CasePromptDisplay title={caseData.title} prompt={caseData.initial_prompt} />}
            {caseMedia.length > 0 && (
              <div className="flex flex-wrap gap-4 justify-center max-w-4xl mx-auto">
                {caseMedia.map((media, idx) => (
                  <AssetRenderer key={idx} url={media.asset_url} type={media.asset_type} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StationDisplay;

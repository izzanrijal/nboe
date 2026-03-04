import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { matchesKeywords } from "@/lib/keywordMatcher";
import QRDisplay from "@/components/station/QRDisplay";
import CasePromptDisplay from "@/components/station/CasePromptDisplay";
import AssetRenderer from "@/components/station/AssetRenderer";
import CountdownTimer from "@/components/station/CountdownTimer";
import { nanoid } from "nanoid";

type StationState = "loading" | "waiting" | "active" | "completed";

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
}

interface AssetData {
  id: string;
  asset_url: string;
  asset_type: string;
  trigger_keywords: string[];
}

const StationDisplay = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<StationState>("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [activeAsset, setActiveAsset] = useState<AssetData | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [currentToken, setCurrentToken] = useState(token);

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
      if (data.status === "active" && data.session_start_time) setState("active");
      else if (data.status === "completed" || data.status === "force_closed") {
        // Auto-regenerate
        autoRegenerateSession(data.case_id);
      }
      else setState("waiting");
    };
    fetchSession();
  }, [currentToken]);

  const autoRegenerateSession = useCallback(async (caseId: string) => {
    const newToken = nanoid(10);
    const { data, error } = await supabase
      .from("exam_sessions")
      .insert({ case_id: caseId, station_token: newToken, status: "waiting" })
      .select("id, case_id, status, session_start_time")
      .single();

    if (data && !error) {
      setSession(data);
      setCurrentToken(newToken);
      setActiveAsset(null);
      setCaseData(null);
      setState("waiting");
      // Update URL without reload
      window.history.replaceState(null, "", `/station/${newToken}`);
    }
  }, []);

  // Subscribe to session changes
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`session-status-${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "exam_sessions", filter: `id=eq.${session.id}` }, (payload) => {
        const updated = payload.new as any;
        setSession((prev) => prev ? { ...prev, status: updated.status, session_start_time: updated.session_start_time } : prev);
        if (updated.status === "active" && updated.session_start_time) setState("active");
        else if (updated.status === "completed" || updated.status === "force_closed") {
          // Auto-regenerate on completion
          if (session?.case_id) {
            autoRegenerateSession(session.case_id);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id, session?.case_id, autoRegenerateSession]);

  // Fetch case data and assets when active
  useEffect(() => {
    if (state !== "active" || !session?.case_id) return;
    const fetchCase = async () => {
      const { data } = await supabase.from("clinical_cases").select("title, initial_prompt, time_limit_seconds").eq("id", session.case_id).single();
      if (data) setCaseData(data);
      const { data: assetData } = await supabase.from("case_assets").select("id, asset_url, asset_type, trigger_keywords").eq("case_id", session.case_id);
      if (assetData) setAssets(assetData);
    };
    fetchCase();
  }, [state, session?.case_id]);

  // Subscribe to broadcast channel — bidirectional asset response
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

  if (state === "waiting" && session) {
    return <QRDisplay sessionId={session.id} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {session?.session_start_time && caseData && (
        <div className="flex items-center justify-center py-6 border-b border-border">
          <CountdownTimer sessionStartTime={session.session_start_time} timeLimitSeconds={caseData.time_limit_seconds} onComplete={handleTimerComplete} />
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {caseData && <CasePromptDisplay title={caseData.title} prompt={caseData.initial_prompt} />}
        {activeAsset && <AssetRenderer url={activeAsset.asset_url} type={activeAsset.asset_type} />}
      </div>
    </div>
  );
};

export default StationDisplay;

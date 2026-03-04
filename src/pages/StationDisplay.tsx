import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { matchesKeywords } from "@/lib/keywordMatcher";
import QRDisplay from "@/components/station/QRDisplay";
import CasePromptDisplay from "@/components/station/CasePromptDisplay";
import AssetRenderer from "@/components/station/AssetRenderer";
import CountdownTimer from "@/components/station/CountdownTimer";

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

  // Fetch session by token
  useEffect(() => {
    if (!token) return;

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("id, case_id, status, session_start_time")
        .eq("station_token", token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setState("loading");
        return;
      }

      setSession(data);
      if (data.status === "active" && data.session_start_time) {
        setState("active");
      } else if (data.status === "completed" || data.status === "force_closed") {
        setState("completed");
      } else {
        setState("waiting");
      }
    };

    fetchSession();
  }, [token]);

  // Subscribe to session changes via postgres_changes
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`session-status-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setSession((prev) =>
            prev ? { ...prev, status: updated.status, session_start_time: updated.session_start_time } : prev
          );
          if (updated.status === "active" && updated.session_start_time) {
            setState("active");
          } else if (updated.status === "completed" || updated.status === "force_closed") {
            setState("completed");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Fetch case data and assets when active
  useEffect(() => {
    if (state !== "active" || !session?.case_id) return;

    const fetchCase = async () => {
      const { data } = await supabase
        .from("clinical_cases")
        .select("title, initial_prompt, time_limit_seconds")
        .eq("id", session.case_id)
        .single();

      if (data) setCaseData(data);

      const { data: assetData } = await supabase
        .from("case_assets")
        .select("id, asset_url, asset_type, trigger_keywords")
        .eq("case_id", session.case_id);

      if (assetData) setAssets(assetData);
    };

    fetchCase();
  }, [state, session?.case_id]);

  // Subscribe to broadcast channel for chat messages (keyword matching)
  useEffect(() => {
    if (state !== "active" || !session?.id || assets.length === 0) return;

    const channel = supabase.channel(`session:${session.id}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "chat" }, (payload) => {
        const message = payload.payload?.message as string || "";
        if (!message) return;

        // Use keywordMatcher utility for normalized matching
        for (const asset of assets) {
          if (matchesKeywords(message, asset.trigger_keywords)) {
            setActiveAsset(asset);
            break;
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [state, session?.id, assets]);

  // Handle timer complete
  const handleTimerComplete = useCallback(async () => {
    if (!session?.id) return;
    await supabase
      .from("exam_sessions")
      .update({ status: "completed" })
      .eq("id", session.id);
    setState("completed");
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

  if (state === "completed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-4xl font-bold text-foreground">Session Completed</h1>
        <p className="text-muted-foreground text-lg">The examination has ended.</p>
        <p className="text-muted-foreground text-sm">
          Deploy a new session from the Admin Dashboard to begin the next exam.
        </p>
      </div>
    );
  }

  // Active state
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Timer header */}
      {session?.session_start_time && caseData && (
        <div className="flex items-center justify-center py-6 border-b border-border">
          <CountdownTimer
            sessionStartTime={session.session_start_time}
            timeLimitSeconds={caseData.time_limit_seconds}
            onComplete={handleTimerComplete}
          />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {caseData && (
          <CasePromptDisplay title={caseData.title} prompt={caseData.initial_prompt} />
        )}
        {activeAsset && (
          <AssetRenderer url={activeAsset.asset_url} type={activeAsset.asset_type} />
        )}
      </div>
    </div>
  );
};

export default StationDisplay;

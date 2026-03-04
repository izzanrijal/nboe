import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AudioGatekeeper from "@/components/exam/AudioGatekeeper";
import ExamActiveView from "@/components/exam/ExamActiveView";
import ExamCompleted from "@/pages/ExamCompleted";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExamStep = "gatekeeper" | "active" | "force_closed" | "completed" | "duplicate_warning";

const ExamMobile = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<ExamStep>("gatekeeper");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [sessionData, setSessionData] = useState<{
    session_start_time: string;
    time_limit_seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  const handleAudioReady = useCallback(
    async (stream: MediaStream) => {
      if (!sessionId || !user) return;

      setAudioStream(stream);

      // Check for duplicate
      const { data: currentSession } = await supabase
        .from("exam_sessions")
        .select("case_id")
        .eq("id", sessionId)
        .single();

      if (currentSession) {
        const { data: sameCaseSessions } = await supabase
          .from("exam_sessions")
          .select("id")
          .eq("case_id", currentSession.case_id);

        if (sameCaseSessions && sameCaseSessions.length > 0) {
          const sessionIds = sameCaseSessions.map((s) => s.id);
          const { data: existingResults } = await supabase
            .from("exam_results")
            .select("id")
            .eq("candidate_id", user.id)
            .in("session_id", sessionIds)
            .limit(1);

          if (existingResults && existingResults.length > 0) {
            setStep("duplicate_warning");
            return;
          }
        }
      }

      // Claim session and start exam
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("exam_sessions")
        .update({
          status: "active",
          current_candidate_id: user.id,
          session_start_time: now,
        })
        .eq("id", sessionId);

      if (error) {
        toast.error("Failed to start session. It may already be in use.");
        return;
      }

      // Fetch case time limit
      const { data: session } = await supabase
        .from("exam_sessions")
        .select("case_id")
        .eq("id", sessionId)
        .single();

      if (!session) return;

      const { data: caseData } = await supabase
        .from("clinical_cases")
        .select("time_limit_seconds")
        .eq("id", session.case_id)
        .single();

      setSessionData({
        session_start_time: now,
        time_limit_seconds: caseData?.time_limit_seconds || 360,
      });

      setStep("active");
    },
    [sessionId, user]
  );

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (step === "gatekeeper") {
    return <AudioGatekeeper onReady={handleAudioReady} />;
  }

  if (step === "duplicate_warning") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
        <AlertTriangle className="h-20 w-20 text-destructive" />
        <h1 className="text-3xl font-bold text-foreground">Peringatan</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Anda sudah mengerjakan ujian ini sebelumnya. Anda tidak dapat mengerjakan ujian yang sama dua kali.
        </p>
        <Button variant="outline" onClick={() => navigate("/exam")}>
          Kembali
        </Button>
      </div>
    );
  }

  if (step === "active" && sessionId && audioStream && sessionData) {
    return (
      <ExamActiveView
        sessionId={sessionId}
        sessionStartTime={sessionData.session_start_time}
        timeLimitSeconds={sessionData.time_limit_seconds}
        candidateId={user.id}
        audioStream={audioStream}
        onForceClose={() => setStep("force_closed")}
        onComplete={() => setStep("completed")}
      />
    );
  }

  if (step === "force_closed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
        <ShieldAlert className="h-20 w-20 text-destructive" />
        <h1 className="text-3xl font-bold text-foreground">Session Terminated</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Your exam session was terminated because you left the exam window. This has been recorded.
        </p>
      </div>
    );
  }

  if (step === "completed") {
    return <ExamCompleted />;
  }

  return null;
};

export default ExamMobile;

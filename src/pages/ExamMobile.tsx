import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CandidateRegistration from "@/components/exam/CandidateRegistration";
import QRScanner from "@/components/exam/QRScanner";
import AudioGatekeeper from "@/components/exam/AudioGatekeeper";
import ExamActiveView from "@/components/exam/ExamActiveView";
import ExamCompleted from "@/pages/ExamCompleted";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

type ExamStep = "register" | "scan" | "gatekeeper" | "active" | "force_closed" | "completed";

const ExamMobile = () => {
  const { sessionId: paramSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<ExamStep>(paramSessionId ? "register" : "register");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(paramSessionId || null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [sessionData, setSessionData] = useState<{
    session_start_time: string;
    time_limit_seconds: number;
  } | null>(null);

  const handleRegistrationComplete = (userId: string) => {
    setCandidateId(userId);
    // If we already have a sessionId from URL, skip scanning
    if (sessionId) {
      setStep("gatekeeper");
    } else {
      setStep("scan");
    }
  };

  const handleScan = (scannedSessionId: string) => {
    setSessionId(scannedSessionId);
    navigate(`/exam/${scannedSessionId}`, { replace: true });
    setStep("gatekeeper");
  };

  const handleAudioReady = useCallback(
    async (stream: MediaStream) => {
      if (!sessionId || !candidateId) return;

      setAudioStream(stream);

      // Claim session and start exam
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("exam_sessions")
        .update({
          status: "active",
          current_candidate_id: candidateId,
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
    [sessionId, candidateId]
  );

  if (step === "register") {
    return <CandidateRegistration onComplete={handleRegistrationComplete} />;
  }

  if (step === "scan") {
    return <QRScanner onScan={handleScan} />;
  }

  if (step === "gatekeeper") {
    return <AudioGatekeeper onReady={handleAudioReady} />;
  }

  if (step === "active" && sessionId && candidateId && audioStream && sessionData) {
    return (
      <ExamActiveView
        sessionId={sessionId}
        sessionStartTime={sessionData.session_start_time}
        timeLimitSeconds={sessionData.time_limit_seconds}
        candidateId={candidateId}
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

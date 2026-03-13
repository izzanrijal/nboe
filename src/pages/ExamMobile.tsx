import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AudioGatekeeper from "@/components/exam/AudioGatekeeper";
import ReadingPhaseView from "@/components/exam/ReadingPhaseView";
import ExamActiveView from "@/components/exam/ExamActiveView";
import ExamCompleted from "@/pages/ExamCompleted";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExamStep = "gatekeeper" | "reading" | "active" | "force_closed" | "completed" | "duplicate_warning";

const ExamMobile = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<ExamStep>("gatekeeper");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [validating, setValidating] = useState(false);
  const [sessionData, setSessionData] = useState<{
    session_start_time: string;
    time_limit_seconds: number;
  } | null>(null);
  const [caseInfo, setCaseInfo] = useState<{
    caseTitle: string;
    casePrompt: string;
    questionsText: string;
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
      setValidating(true);

      try {
        // Use atomic claim RPC — handles race condition + duplicate check
        const { data, error } = await supabase.rpc('claim_exam_session', {
          _session_id: sessionId,
          _candidate_id: user.id,
        });

        if (error) {
          console.error("Claim RPC error:", error);
          toast.error("Gagal memulai sesi. Silakan coba lagi.");
          setValidating(false);
          return;
        }

        const result = data as { success: boolean; reason?: string };

        if (!result.success) {
          if (result.reason === 'duplicate') {
            setStep("duplicate_warning");
            return;
          }
          if (result.reason === 'already_claimed') {
            toast.error("Sesi sudah digunakan oleh peserta lain.");
            setValidating(false);
            return;
          }
          toast.error("Gagal memulai sesi.");
          setValidating(false);
          return;
        }

        // Go to reading phase
        setStep("reading");
      } catch (err) {
        console.error("Error during session setup:", err);
        toast.error("Terjadi kesalahan. Silakan coba lagi.");
        setValidating(false);
      }
    },
    [sessionId, user]
  );

  const handleReadingComplete = useCallback(
    async (info: { caseTitle: string; casePrompt: string; questionsText: string; timeLimitSeconds: number }) => {
      let now = new Date().toISOString();

      // Fix #2: Use server-side timer start to prevent clock manipulation
      if (sessionId) {
        const { data, error } = await supabase.rpc('start_exam_timer', {
          _session_id: sessionId,
        });
        if (error) {
          console.error("Failed to start exam timer:", error);
        } else if (data) {
          now = data as string;
        }
      }

      // Check audio stream health
      if (audioStream) {
        const tracks = audioStream.getAudioTracks();
        if (tracks.length === 0 || tracks.every(t => t.readyState === "ended")) {
          console.warn("Audio stream tracks ended during reading phase, re-requesting...");
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioStream(newStream);
          } catch (err) {
            console.error("Failed to re-acquire audio:", err);
            toast.error("Mikrofon tidak tersedia. Silakan izinkan akses mikrofon.");
            return;
          }
        }
      }

      setCaseInfo({
        caseTitle: info.caseTitle,
        casePrompt: info.casePrompt,
        questionsText: info.questionsText,
      });
      setSessionData({
        session_start_time: now,
        time_limit_seconds: info.timeLimitSeconds,
      });
      setStep("active");
    },
    [sessionId, audioStream]
  );

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (step === "gatekeeper") {
    if (validating) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground">Memvalidasi sesi ujian...</p>
        </div>
      );
    }
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

  if (step === "reading" && sessionId) {
    return (
      <ReadingPhaseView
        sessionId={sessionId}
        onReadingComplete={handleReadingComplete}
      />
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
        caseTitle={caseInfo?.caseTitle}
        casePrompt={caseInfo?.casePrompt}
        questionsText={caseInfo?.questionsText}
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

  // Fallback: step is "active" but conditions not fully met
  if (step === "active") {
    console.warn("Active step but missing conditions:", { sessionId, audioStream: !!audioStream, sessionData: !!sessionData });
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-4">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground text-center">Mempersiapkan ujian...</p>
      </div>
    );
  }

  // Fallback: should never reach here, redirect to exam entry
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-4">
      <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      <p className="text-muted-foreground">Memuat...</p>
    </div>
  );
};

export default ExamMobile;

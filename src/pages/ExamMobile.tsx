import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AudioGatekeeper from "@/components/exam/AudioGatekeeper";
import ReadingPhaseView from "@/components/exam/ReadingPhaseView";
import ExamActiveView from "@/components/exam/ExamActiveView";
import ExamErrorBoundary from "@/components/exam/ExamErrorBoundary";

import ExamCompleted from "@/pages/ExamCompleted";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExamStep = "gatekeeper" | "reading" | "active" | "next_case" | "timeout_unresolved" | "force_closed" | "completed" | "duplicate_warning";

const ExamMobile = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<ExamStep>("gatekeeper");
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(sessionId);
  const [nextCase, setNextCase] = useState<{ sessionId: string; sequenceOrder: number } | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    setActiveSessionId(sessionId);
  }, [sessionId]);

  // Force scroll to top on mount to prevent blank screen from scroll offset
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);
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
        setValidating(false);
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
      const rawTimeLimit = Number(info.timeLimitSeconds);
      const timeLimitSeconds = Number.isFinite(rawTimeLimit)
        ? Math.max(1, Math.floor(rawTimeLimit))
        : 360;
      if (!Number.isFinite(rawTimeLimit) || rawTimeLimit < 1) {
        console.warn("Invalid exam time limit; using a safe value:", {
          sessionId: activeSessionId,
          received: info.timeLimitSeconds,
          applied: timeLimitSeconds,
        });
      }

      // Fix #2: Use server-side timer start to prevent clock manipulation
      if (activeSessionId) {
        const { data, error } = await supabase.rpc('start_exam_timer', {
          _session_id: activeSessionId,
        });
        if (error) {
          console.error("Failed to start exam timer:", error);
        } else if (data) {
          const serverStart = new Date(data as string).getTime();
          const elapsed = (Date.now() - serverStart) / 1000;
          // Guard against a stale start time (e.g. sequential stations) that would
          // make the timer expire instantly.
          if (Number.isFinite(serverStart) && elapsed >= 0 && elapsed < timeLimitSeconds) {
            now = data as string;
          } else {
            await supabase
              .from("exam_sessions")
              .update({ session_start_time: now })
              .eq("id", activeSessionId);
          }
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
        time_limit_seconds: timeLimitSeconds,
      });
      setStep("active");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    },
    [activeSessionId, audioStream]
  );

  const handleCaseComplete = useCallback(
    (
      next?: { sessionId: string; sequenceOrder: number },
      reason: "manual" | "timeout" = "manual"
    ) => {
      if (next?.sessionId) {
        setNextCase(next);
        setStep("next_case");
        return;
      }
      if (reason === "timeout") {
        setStep("timeout_unresolved");
        return;
      }
      setStep("completed");
    },
    []
  );

  const retryTimedOutSequence = useCallback(async () => {
    if (!activeSessionId || validating) return;

    setValidating(true);
    try {
      const { data: current, error: currentError } = await supabase
        .from("exam_sequence_items")
        .select("deployment_id, sequence_order, station_token")
        .eq("session_id", activeSessionId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current?.deployment_id) {
        toast.error("Urutan soal belum tersedia. Silakan coba lagi atau akhiri ujian.");
        return;
      }

      const { data: items, error: itemsError } = await supabase
        .from("exam_sequence_items")
        .select("sequence_order, session_id")
        .eq("deployment_id", current.deployment_id)
        .order("sequence_order", { ascending: true });
      if (itemsError) throw itemsError;

      const nextItem = items?.find(
        (item) => item.sequence_order > current.sequence_order
      );
      if (!nextItem) {
        toast.info("Tidak ada soal berikutnya. Anda dapat mengakhiri ujian.");
        return;
      }

      const { data, error } = await supabase.rpc("advance_station_sequence", {
        _station_token: current.station_token,
        _completed_sequence_order: current.sequence_order,
      });
      if (error) throw error;

      const next = Array.isArray(data) ? data[0] : null;
      if (!next?.next_id) {
        toast.error("Soal berikutnya belum dapat disiapkan. Silakan coba lagi.");
        return;
      }

      setNextCase({
        sessionId: next.next_id as string,
        sequenceOrder: next.next_sequence_order as number,
      });
      setStep("next_case");
    } catch (err) {
      console.error("Retry sequence resolution failed:", err);
      toast.error("Gagal menemukan soal berikutnya. Silakan coba lagi.");
    } finally {
      setValidating(false);
    }
  }, [activeSessionId, validating]);

  const handleContinueNext = useCallback(async () => {
    if (!nextCase || !user || validating) return;

    setValidating(true);
    try {
      const { data, error } = await supabase.rpc('claim_exam_session', {
        _session_id: nextCase.sessionId,
        _candidate_id: user.id,
      });

      if (error) {
        console.error("Next session claim RPC error:", error);
        toast.error("Gagal menyiapkan soal berikutnya. Silakan coba lagi.");
        return;
      }

      const result = data as { success: boolean; reason?: string };
      if (!result.success) {
        console.error("Next session claim rejected:", result.reason);
        toast.error("Gagal menyiapkan soal berikutnya. Silakan coba lagi.");
        return;
      }

      setActiveSessionId(nextCase.sessionId);
      setNextCase(null);
      setCaseInfo(null);
      setSessionData(null);
      setStep("reading");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    } catch (err) {
      console.error("Error preparing next session:", err);
      toast.error("Gagal menyiapkan soal berikutnya. Silakan coba lagi.");
    } finally {
      setValidating(false);
    }
  }, [nextCase, user, validating]);


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

  if (step === "next_case") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
        <CheckCircle2 className="h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold text-foreground text-center">Soal ini selesai</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Jawaban dan rekaman Anda sudah tersimpan. Lanjutkan ke soal berikutnya bila Anda sudah siap.
        </p>
        <Button size="lg" onClick={handleContinueNext} disabled={validating}>
          {validating ? "Menyiapkan soal..." : `Lanjut ke Soal ${nextCase?.sequenceOrder ?? ""}`}
        </Button>
      </div>
    );
  }

  if (step === "timeout_unresolved") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground text-center">Waktu soal ini habis</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Jawaban Anda sudah disimpan, tetapi soal berikutnya belum dapat ditemukan. Coba lagi agar sisa soal tidak terlewat.
        </p>
        <div className="flex flex-col w-full max-w-sm gap-3">
          <Button size="lg" onClick={retryTimedOutSequence} disabled={validating}>
            {validating ? "Mencari soal berikutnya..." : "Coba Soal Berikutnya Lagi"}
          </Button>
          <Button variant="outline" onClick={() => setStep("completed")} disabled={validating}>
            Akhiri Ujian
          </Button>
        </div>
      </div>
    );
  }

  if (step === "reading" && activeSessionId) {
    return (
      <ReadingPhaseView
        key={activeSessionId}
        sessionId={activeSessionId}
        onReadingComplete={handleReadingComplete}
      />
    );
  }

  if (step === "active" && activeSessionId && audioStream && sessionData) {
    return (
      <ExamErrorBoundary key={activeSessionId}>
        <ExamActiveView
          sessionId={activeSessionId}
          sessionStartTime={sessionData.session_start_time}
          timeLimitSeconds={sessionData.time_limit_seconds}
          candidateId={user.id}
          audioStream={audioStream}
          caseTitle={caseInfo?.caseTitle}
          casePrompt={caseInfo?.casePrompt}
          questionsText={caseInfo?.questionsText}
          onForceClose={() => setStep("force_closed")}
          onComplete={handleCaseComplete}
        />
      </ExamErrorBoundary>
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
    console.warn("Active step but missing conditions:", { activeSessionId, audioStream: !!audioStream, sessionData: !!sessionData });
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

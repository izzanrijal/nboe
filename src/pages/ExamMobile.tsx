import { useState, useCallback, useEffect, useRef } from "react";
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
import {
  candidateStepAfterResolution,
  type NextSessionResolution,
} from "@/lib/examSequence";
import {
  claimCandidateSession,
  loadCandidateSequenceContext,
  resolveNextCandidateSession,
} from "@/lib/examSequenceApi";
import {
  bindExamRealtime,
  type ExamRealtimeClient,
} from "@/lib/examRealtime";

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
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");
  const [syncRevision, setSyncRevision] = useState(0);
  const recoveryInFlightRef = useRef(false);
  const backgroundRecoveryAttemptsRef = useRef(0);
  const activeSessionRef = useRef<string | undefined>(activeSessionId);
  activeSessionRef.current = activeSessionId;

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
        const result = await claimCandidateSession(sessionId, user.id);

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
      resolution: NextSessionResolution,
      _reason: "manual" | "timeout" = "manual"
    ) => {
      const nextStep = candidateStepAfterResolution(resolution);
      if (nextStep === "next_case" && "next" in resolution) {
        setNextCase(resolution.next);
        setStep("next_case");
        return;
      }
      if (nextStep === "timeout_unresolved") {
        setStep("timeout_unresolved");
        return;
      }
      setStep("completed");
    },
    []
  );

  const resolvePendingSequence = useCallback(async (showError: boolean) => {
    if (!activeSessionId || recoveryInFlightRef.current) return false;

    recoveryInFlightRef.current = true;
    setValidating(true);
    try {
      const resolution = await resolveNextCandidateSession(activeSessionId);
      const nextStep = candidateStepAfterResolution(resolution);

      if (nextStep === "completed") {
        setStep("completed");
        return true;
      }
      if (nextStep === "next_case" && "next" in resolution) {
        setNextCase(resolution.next);
        setStep("next_case");
        return true;
      }

      if (showError) {
        toast.error("Sinkronisasi soal berikutnya belum berhasil. Periksa koneksi, coba lagi, atau hubungi pengawas.");
      }
      return false;
    } catch (err) {
      console.error("Retry sequence resolution failed:", err);
      if (showError) {
        toast.error("Sinkronisasi soal berikutnya gagal. Periksa koneksi lalu coba lagi atau hubungi pengawas.");
      }
      return false;
    } finally {
      recoveryInFlightRef.current = false;
      setValidating(false);
    }
  }, [activeSessionId]);

  const retryTimedOutSequence = useCallback(() => {
    void resolvePendingSequence(true);
  }, [resolvePendingSequence]);

  const handleContinueNext = useCallback(async () => {
    if (!nextCase || !user || validating) return;

    setValidating(true);
    try {
      const result = await claimCandidateSession(nextCase.sessionId, user.id);
      if (!result.success) {
        console.error("Next session claim rejected:", result.reason);
        toast.error(
          result.reason === "already_claimed"
            ? "Sesi berikutnya sedang digunakan peserta lain. Hubungi pengawas."
            : "Soal berikutnya belum dapat dibuka. Periksa koneksi lalu coba lagi."
        );
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

  // Discover the active deployment from the authoritative session mapping.
  // Re-running on session change also drives realtime cleanup/rebind below.
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    setDeploymentId(null);

    void loadCandidateSequenceContext(activeSessionId)
      .then((context) => {
        if (!cancelled) setDeploymentId(context?.deploymentId ?? null);
      })
      .catch((error) => {
        console.warn("Unable to load realtime sequence scope:", error);
        if (!cancelled) setRealtimeStatus("FALLBACK");
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  // Database realtime complements (but never replaces) the idempotent RPC.
  useEffect(() => {
    if (!activeSessionId) return;

    const cleanup = bindExamRealtime(
      supabase as unknown as ExamRealtimeClient,
      { sessionId: activeSessionId, deploymentId },
      {
        onChange: ({ table, row }) => {
          if (
            table === "exam_sessions" &&
            row.id === activeSessionId &&
            activeSessionRef.current === activeSessionId &&
            row.status === "force_closed"
          ) {
            setStep("force_closed");
            return;
          }
          setSyncRevision((revision) => revision + 1);
        },
        onStatus: (status, error) => {
          if (status === "SUBSCRIBED") {
            setRealtimeStatus("SUBSCRIBED");
          } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            console.warn("Exam realtime unavailable; polling remains active:", { status, error });
            setRealtimeStatus("FALLBACK");
          }
        },
      }
    );

    return cleanup;
  }, [activeSessionId, deploymentId]);

  // Poll even when realtime is healthy (at a slower cadence). This refreshes
  // the deployment scope and wakes bounded recovery if a websocket event was
  // delayed or unavailable.
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const context = await loadCandidateSequenceContext(activeSessionId);
        if (cancelled) return;
        setDeploymentId((current) => context?.deploymentId ?? current);
        if (step === "timeout_unresolved") {
          setSyncRevision((revision) => revision + 1);
        }
      } catch (error) {
        if (!cancelled) console.warn("Exam synchronization poll failed:", error);
      }
    };
    const pollInterval = window.setInterval(
      () => void poll(),
      realtimeStatus === "SUBSCRIBED" ? 10000 : 3000
    );

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
    };
  }, [activeSessionId, realtimeStatus, step]);

  useEffect(() => {
    backgroundRecoveryAttemptsRef.current = 0;
  }, [activeSessionId]);

  useEffect(() => {
    if (step !== "timeout_unresolved" || syncRevision === 0) return;
    if (backgroundRecoveryAttemptsRef.current >= 3) return;
    backgroundRecoveryAttemptsRef.current += 1;
    void resolvePendingSequence(false);
  }, [resolvePendingSequence, step, syncRevision]);


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
        <h1 className="text-2xl font-bold text-foreground text-center">Soal Ini Sudah Disimpan</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Sinkronisasi belum berhasil setelah beberapa percobaan. Periksa koneksi, coba lagi, dan hubungi pengawas bila tombol tetap tidak berhasil.
        </p>
        <div className="flex flex-col w-full max-w-sm gap-3">
          <Button size="lg" onClick={retryTimedOutSequence} disabled={validating}>
            {validating ? "Mencari soal berikutnya..." : "Coba Soal Berikutnya Lagi"}
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
    return <ExamCompleted sessionIdOverride={activeSessionId} />;
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

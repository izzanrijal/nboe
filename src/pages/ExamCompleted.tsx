import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const EXAM_RETURN_COUNTDOWN_SECONDS = 30;
export const EXAM_RETURN_CONFIRMATION =
  "Apakah Anda yakin ingin kembali ke menu utama? Pastikan seluruh rekaman telah terunggah dan pengawas telah mencatat kehadiran Anda.";

interface ExamCompletedProps {
  sessionIdOverride?: string;
  onBeforeReturnToMenu?: () => void | Promise<void>;
  returnCountdownSeconds?: number;
}

const ExamCompleted = ({
  sessionIdOverride,
  onBeforeReturnToMenu,
  returnCountdownSeconds = EXAM_RETURN_COUNTDOWN_SECONDS,
}: ExamCompletedProps) => {
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = sessionIdOverride ?? routeSessionId;
  const [hasNextExam, setHasNextExam] = useState<boolean | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(returnCountdownSeconds);
  const returningRef = useRef(false);

  const returnToMenu = useCallback(async () => {
    if (returningRef.current) return;
    returningRef.current = true;

    try {
      await onBeforeReturnToMenu?.();
    } catch (error) {
      console.error("Failed to reset completed exam state:", error);
    }

    navigate("/exam", { replace: true });
  }, [navigate, onBeforeReturnToMenu]);

  useEffect(() => {
    if (confirmationOpen) return;

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [confirmationOpen]);

  useEffect(() => {
    if (secondsRemaining === 0) {
      void returnToMenu();
    }
  }, [returnToMenu, secondsRemaining]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const checkSequence = async () => {
      // Get the session's station_token
      const { data: session } = await supabase
        .from("exam_sessions")
        .select("station_token")
        .eq("id", sessionId)
        .single();

      if (cancelled) return;
      if (!session) { setHasNextExam(false); return; }

      const { data: tokenItem } = await supabase
        .from("exam_sequence_items")
        .select("deployment_id, sequence_order, session_id")
        .eq("station_token", session.station_token)
        .maybeSingle();

      if (cancelled) return;
      if (!tokenItem) { setHasNextExam(false); return; }

      const { data: items } = await supabase
        .from("exam_sequence_items")
        .select("sequence_order, session_id")
        .eq("deployment_id", tokenItem.deployment_id)
        .order("sequence_order", { ascending: true });

      if (cancelled) return;
      if (!items || items.length === 0) { setHasNextExam(false); return; }

      // Find current item and check if there's a next one
      const currentItem = items.find((item) => item.session_id === sessionId);
      if (currentItem) {
        const hasNext = items.some((item) => item.sequence_order > currentItem.sequence_order);
        setHasNextExam(hasNext);
      } else {
        setHasNextExam(false);
      }
    };
    void checkSequence();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
      <CheckCircle className="h-20 w-20 text-primary" />
      <h1 className="text-3xl font-bold text-foreground">Exam Completed</h1>
      {hasNextExam === true ? (
        <p className="text-muted-foreground text-center max-w-sm">
          Ujian ini telah selesai. Silakan scan QR code berikutnya di layar PC untuk memulai ujian selanjutnya.
        </p>
      ) : (
        <p className="text-muted-foreground text-center max-w-sm">
          Your examination has been submitted successfully. Your audio recording has been uploaded for
          evaluation. You may now close this window.
        </p>
      )}
      <p className="text-base font-semibold text-foreground text-center" aria-live="polite">
        Kembali otomatis ke menu utama dalam {secondsRemaining} detik.
      </p>
      <AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <AlertDialogTrigger asChild>
          <Button size="lg">
            <Home className="h-5 w-5 mr-2" />
            Kembali ke Menu Utama (/exam)
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kembali ke Menu Utama?</AlertDialogTitle>
            <AlertDialogDescription>{EXAM_RETURN_CONFIRMATION}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void returnToMenu()}>
              Ya, Kembali
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamCompleted;

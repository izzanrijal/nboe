import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ExamCompleted = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [hasNextExam, setHasNextExam] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const checkSequence = async () => {
      // Get the session's station_token
      const { data: session } = await supabase
        .from("exam_sessions")
        .select("station_token")
        .eq("id", sessionId)
        .single();

      if (!session) { setHasNextExam(false); return; }

      // Check if this token has sequence items
      const { data: items } = await supabase
        .from("exam_sequence_items")
        .select("sequence_order, session_id")
        .eq("station_token", session.station_token)
        .order("sequence_order", { ascending: true });

      if (!items || items.length <= 1) { setHasNextExam(false); return; }

      // Find current item and check if there's a next one
      const currentItem = items.find((i: any) => i.session_id === sessionId);
      if (currentItem) {
        const hasNext = items.some((i: any) => i.sequence_order > (currentItem as any).sequence_order);
        setHasNextExam(hasNext);
      } else {
        setHasNextExam(false);
      }
    };
    checkSequence();
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
    </div>
  );
};

export default ExamCompleted;

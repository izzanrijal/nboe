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
      const { data: currentItem } = await supabase
        .from("exam_sequence_items")
        .select("deployment_id, sequence_order")
        .eq("session_id", sessionId)
        .single();

      if (!currentItem?.deployment_id) { setHasNextExam(false); return; }

      const { data: items } = await supabase
        .from("exam_sequence_items")
        .select("sequence_order")
        .eq("deployment_id", currentItem.deployment_id)
        .order("sequence_order", { ascending: true });

      if (!items || items.length <= 1) { setHasNextExam(false); return; }

      setHasNextExam(items.some((item) => item.sequence_order > currentItem.sequence_order));
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

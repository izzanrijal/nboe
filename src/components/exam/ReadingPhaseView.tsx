import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";

interface ReadingPhaseViewProps {
  sessionId: string;
  onReadingComplete: (caseInfo: {
    caseTitle: string;
    casePrompt: string;
    questionsText: string;
    timeLimitSeconds: number;
  }) => void;
}

const ReadingPhaseView = ({ sessionId, onReadingComplete }: ReadingPhaseViewProps) => {
  const [caseData, setCaseData] = useState<{
    title: string;
    initial_prompt: string;
    reading_time_seconds: number;
    questions_text: string;
    time_limit_seconds: number;
  } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

  // Fetch case data
  useEffect(() => {
    const fetch = async () => {
      const { data: session } = await supabase
        .from("exam_sessions")
        .select("case_id")
        .eq("id", sessionId)
        .single();
      if (!session) return;

      const { data } = await supabase
        .from("clinical_cases")
        .select("title, initial_prompt, reading_time_seconds, questions_text, time_limit_seconds")
        .eq("id", session.case_id)
        .single();
      if (data) {
        setCaseData(data as any);
        setRemaining((data as any).reading_time_seconds || 120);
      }
    };
    fetch();
  }, [sessionId]);

  // Countdown
  useEffect(() => {
    if (!caseData) return;
    const readingSeconds = caseData.reading_time_seconds || 120;
    const endTime = startTime + readingSeconds * 1000;

    const tick = () => {
      const left = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        onReadingComplete({
          caseTitle: caseData.title,
          casePrompt: caseData.initial_prompt,
          questionsText: caseData.questions_text,
          timeLimitSeconds: caseData.time_limit_seconds,
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [caseData, startTime, onReadingComplete]);

  if (!caseData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const minutes = Math.floor((remaining ?? 0) / 60);
  const seconds = (remaining ?? 0) % 60;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Waktu Membaca</span>
        </div>
        <div className={`font-mono text-2xl font-bold tabular-nums ${remaining !== null && remaining <= 10 ? "text-destructive animate-pulse" : "text-foreground"}`}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      {/* Case content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">{caseData.title}</h1>
        <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
          {caseData.initial_prompt}
        </div>
      </div>

      <div className="p-4 border-t border-border bg-muted/50">
        <p className="text-sm text-muted-foreground text-center">
          Baca kasus di atas dengan seksama. Ujian akan dimulai otomatis setelah waktu baca habis.
        </p>
      </div>
    </div>
  );
};

export default ReadingPhaseView;

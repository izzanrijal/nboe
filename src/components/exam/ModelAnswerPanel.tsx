import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { invokeExamAi } from "@/lib/examAi";

interface ModelAnswer {
  text: string;
  wordCount?: number;
  timeLimitSeconds?: number;
  wpm?: number;
}

const ModelAnswerPanel = ({ resultId, cached }: { resultId: string; cached?: ModelAnswer }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["model_answer", resultId],
    enabled: !cached,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const data = await invokeExamAi("generate-model-answer", resultId);
      return data.modelAnswer as ModelAnswer;
    },
  });
  const answer = cached ?? data;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <h4 className="text-sm font-normal flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> Jawaban AI (contoh lulus semua rubrik)
      </h4>
      {answer ? (
        <>
          {answer.timeLimitSeconds != null && (
            <p className="text-xs text-muted-foreground">
              Disimulasikan untuk {Math.round(answer.timeLimitSeconds / 60)} menit · ±{answer.wordCount} kata · {answer.wpm} kata/menit
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer.text.replace(/^#{1,6}\s+/gm, "").replace(/\*\*|__|\*/g, "")}</p>
        </>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> AI sedang menyusun jawaban contoh...
        </p>
      ) : (
        <p className="text-sm text-destructive">{(error as Error)?.message || "Jawaban AI belum tersedia."}</p>
      )}
    </div>
  );
};

export default ModelAnswerPanel;

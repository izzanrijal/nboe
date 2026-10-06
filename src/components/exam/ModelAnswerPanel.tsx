import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { invokeExamAi } from "@/lib/examAi";
import {
  findRubricMatches,
  buildHighlightSegments,
  findUnmentionedItems,
  type RubricHighlightItem,
} from "@/lib/rubricHighlight";

interface ModelAnswer {
  text: string;
  wordCount?: number;
  timeLimitSeconds?: number;
  wpm?: number;
}

/**
 * The AI model answer is the teaching artefact: it is generated to pass every
 * rubric line. What the PARTICIPANT said is a separate fact that comes from the
 * grading report, so this panel highlights only the lines the participant
 * missed and lists the same lines in bold+italic. Highlighting every phrase the
 * answer contains would falsely imply the participant had said it.
 */
const ModelAnswerPanel = ({
  resultId,
  cached,
  rubricItems = [],
}: {
  resultId: string;
  cached?: ModelAnswer;
  rubricItems?: RubricHighlightItem[];
}) => {
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

  const { segments, unmentioned } = useMemo(() => {
    if (!answer?.text) return { segments: [], unmentioned: [] };
    const plain = answer.text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*|__|(?<!\w)\*(?!\w)/g, "");
    const matches = findRubricMatches(plain, rubricItems);
    return {
      segments: buildHighlightSegments(plain, matches),
      unmentioned: findUnmentionedItems(matches),
    };
  }, [answer?.text, rubricItems]);

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <h4 className="text-sm font-normal flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> Jawaban Ideal AI (lulus semua rubrik)
      </h4>

      {answer ? (
        <>
          {answer.timeLimitSeconds != null && (
            <p className="text-xs text-muted-foreground">
              Disimulasikan untuk {Math.round(answer.timeLimitSeconds / 60)} menit · ±{answer.wordCount} kata · {answer.wpm} kata/menit
            </p>
          )}

          {segments.some((s) => s.highlighted) && (
            <p className="text-xs text-muted-foreground">
              Bagian yang <mark className="rubric-highlight rounded-sm px-0.5">disorot</mark> adalah
              yang <span className="font-semibold">belum Anda sebutkan</span> — bukan yang sudah Anda ucapkan.
            </p>
          )}

          {segments.length > 0 ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {segments.map((segment, idx) => segment.highlighted ? (
                <mark
                  key={idx}
                  className="rubric-highlight rounded-sm px-0.5"
                  title={`Belum Anda sebutkan — butir rubrik ${segment.matchedItems.map((i) => i + 1).join(", ")}`}
                >
                  {segment.text}
                </mark>
              ) : <span key={idx}>{segment.text}</span>)}
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer.text}</p>
          )}

          {unmentioned.length > 0 && (
            <div className="rounded-md border border-border bg-background p-2 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Belum Anda sebutkan — seharusnya Anda ucapkan:
              </p>
              <ul className="space-y-0.5">
                {unmentioned.map((match) => (
                  <li key={match.itemIndex} className="text-sm font-bold italic">
                    {match.item.item}
                  </li>
                ))}
              </ul>
            </div>
          )}
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

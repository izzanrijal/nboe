import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
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
 * grading report, so the panel marks the lines the participant actually said and
 * emphasises (bold+italic) the lines they missed — inline in the answer text.
 * There is deliberately no separate list below the answer.
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
      unmentioned: findUnmentionedItems(plain, matches),
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

          <p className="text-xs text-muted-foreground">
            Bagian yang <mark className="rubric-highlight rounded-sm px-0.5">disorot</mark> adalah
            yang <span className="font-semibold">sudah Anda sebutkan</span>; bagian yang{" "}
            <span className="font-bold italic">tebal dan miring</span> adalah yang{" "}
            <span className="font-semibold">belum Anda sebutkan</span>.
          </p>

          {segments.length > 0 ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {segments.map((segment, idx) => {
                if (segment.highlighted) {
                  return (
                    <mark
                      key={idx}
                      className="rubric-highlight rounded-sm px-0.5"
                      title={`Sudah Anda sebutkan — butir rubrik ${segment.matchedItems.map((i) => i + 1).join(", ")}`}
                    >
                      {segment.text}
                    </mark>
                  );
                }
                if (segment.emphasised) {
                  return (
                    <span
                      key={idx}
                      className="font-bold italic"
                      title={`Belum Anda sebutkan — butir rubrik ${segment.matchedItems.map((i) => i + 1).join(", ")}`}
                    >
                      {segment.text}
                    </span>
                  );
                }
                return <span key={idx}>{segment.text}</span>;
              })}
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer.text}</p>
          )}

          {unmentioned.length > 0 && (
            <p className="text-sm leading-relaxed">
              <span className="font-bold italic">
                {unmentioned.map((match) => match.item.item).join(" · ")}
              </span>
            </p>
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

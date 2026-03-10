import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, TrendingDown, Target, CheckCircle2, XCircle } from "lucide-react";

interface DetailedFeedbackItem {
  topic: string;
  questionRef?: string;
  candidateAnswer?: string;
  expectedAnswer?: string;
  gaps?: string[];
  misconceptions?: string[];
  score?: number;
  feedbackText?: string;
}

interface DetailedFeedbackProps {
  detailedFeedback?: DetailedFeedbackItem[];
  overallStrengths?: string[];
  overallWeaknesses?: string[];
  prioritizedImprovements?: string[];
  reasoning?: string;
  tips?: string;
}

const ScoreBar = ({ score }: { score: number }) => {
  const color = score >= 80 ? "bg-green-500" : score >= 68 ? "bg-yellow-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <Progress value={score} className="h-2 flex-1 [&>div]:transition-all" style={{ "--progress-color": undefined } as any} />
      <span className="text-xs font-mono font-semibold min-w-[3ch] text-right">{score}</span>
    </div>
  );
};

const TopicCard = ({ item, index }: { item: DetailedFeedbackItem; index: number }) => (
  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
        <h5 className="font-semibold text-sm">{item.topic}</h5>
        {item.questionRef && (
          <span className="text-xs text-muted-foreground">({item.questionRef})</span>
        )}
      </div>
      {item.score != null && (
        <Badge variant={item.score >= 68 ? "default" : "destructive"} className="text-xs">
          {item.score}/100
        </Badge>
      )}
    </div>

    {item.score != null && <ScoreBar score={item.score} />}

    {item.candidateAnswer && (
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Jawaban Peserta:</p>
        <p className="text-sm bg-muted rounded-md p-2">{item.candidateAnswer}</p>
      </div>
    )}

    {item.expectedAnswer && (
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Jawaban yang Diharapkan:</p>
        <p className="text-sm bg-muted rounded-md p-2">{item.expectedAnswer}</p>
      </div>
    )}

    {item.gaps && item.gaps.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1">
          <XCircle className="h-3.5 w-3.5" /> Gap / Poin yang Terlewat:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 pl-1">
          {item.gaps.map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      </div>
    )}

    {item.misconceptions && item.misconceptions.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1 mb-1">
          <AlertTriangle className="h-3.5 w-3.5" /> Miskonsepsi:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 pl-1">
          {item.misconceptions.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </div>
    )}

    {item.feedbackText && (
      <p className="text-sm text-muted-foreground border-t border-border pt-2">{item.feedbackText}</p>
    )}
  </div>
);

const DetailedFeedbackDisplay = ({
  detailedFeedback,
  overallStrengths,
  overallWeaknesses,
  prioritizedImprovements,
  reasoning,
  tips,
}: DetailedFeedbackProps) => {
  const hasDetailed = detailedFeedback && detailedFeedback.length > 0;

  return (
    <div className="space-y-4">
      {/* Legacy or summary reasoning */}
      {reasoning && (
        <div>
          <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">💡 Alasan Penilaian</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">{reasoning}</p>
        </div>
      )}

      {/* Per-topic detailed feedback */}
      {hasDetailed && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Target className="h-4 w-4" /> Analisis Per Topik
          </h4>
          <div className="space-y-3">
            {detailedFeedback.map((item, idx) => (
              <TopicCard key={idx} item={item} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {overallStrengths && overallStrengths.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1 flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4" /> Kekuatan
          </h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 rounded-md bg-muted p-3">
            {overallStrengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {overallWeaknesses && overallWeaknesses.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1 flex items-center gap-1 text-destructive">
            <TrendingDown className="h-4 w-4" /> Kelemahan
          </h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 rounded-md bg-muted p-3">
            {overallWeaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Prioritized improvements */}
      {prioritizedImprovements && prioritizedImprovements.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Prioritas Perbaikan
          </h4>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 rounded-md bg-muted p-3">
            {prioritizedImprovements.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
      )}

      {/* Legacy tips fallback */}
      {tips && !hasDetailed && (
        <div>
          <h4 className="text-sm font-semibold mb-1">📝 Tips Perbaikan</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">{tips}</p>
        </div>
      )}
    </div>
  );
};

export default DetailedFeedbackDisplay;

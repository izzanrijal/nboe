import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle, History } from "lucide-react";
import DetailedFeedbackDisplay from "@/components/exam/DetailedFeedbackDisplay";
import type { Json } from "@/integrations/supabase/types";

interface ScoreItem {
  item: string;
  passed: boolean;
  comment?: string;
  points?: number;
  isCritical?: boolean;
}

interface ScoreReport {
  items: ScoreItem[];
  totalScore?: number;
  totalPossible?: number;
  score?: number;
  passStatus?: string;
  hasCriticalFail?: boolean;
  reasoning?: string;
  tips?: string;
  detailedFeedback?: any[];
  overallStrengths?: string[];
  overallWeaknesses?: string[];
  prioritizedImprovements?: string[];
}

const parseScoreReport = (report: Json | null): ScoreReport => {
  if (!report) return { items: [] };
  if (typeof report === "object" && !Array.isArray(report) && report !== null && "items" in report) {
    return report as unknown as ScoreReport;
  }
  if (Array.isArray(report)) {
    return { items: report as unknown as ScoreItem[] };
  }
  return { items: [] };
};

const getScoreDisplay = (report: Json | null): { label: string; variant: "default" | "destructive" | "outline" } => {
  const parsed = parseScoreReport(report);
  if (parsed.items.length === 0 && parsed.score == null) return { label: "Belum dinilai", variant: "outline" };

  if (parsed.score != null) {
    const status = parsed.passStatus || (parsed.score >= 68 ? "LULUS" : "TIDAK LULUS");
    if (parsed.hasCriticalFail || status === "TIDAK LULUS") {
      return { label: `${parsed.score}/100 — TIDAK LULUS`, variant: "destructive" };
    }
    return { label: `${parsed.score}/100 — LULUS`, variant: "default" };
  }

  if (parsed.hasCriticalFail) return { label: "TIDAK LULUS", variant: "destructive" };

  if (parsed.totalPossible && parsed.totalPossible > 0) {
    const pct = Math.round((parsed.totalScore! / parsed.totalPossible) * 100);
    return { label: `${pct}% (${parsed.totalScore}/${parsed.totalPossible})`, variant: "default" };
  }

  const passed = parsed.items.filter((i) => i.passed).length;
  return { label: `${passed}/${parsed.items.length}`, variant: "default" };
};

const CandidateResultsList = () => {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["candidate_results", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_results")
        .select("id, created_at, ai_score_report, transcript, exam_sessions:session_id(status, clinical_cases:case_id(title, show_results_to_candidate))")
        .eq("candidate_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Memuat riwayat...</CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" /> Riwayat Ujian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Belum ada riwayat ujian.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" /> Riwayat Ujian
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((r: any) => {
          const caseData = r.exam_sessions?.clinical_cases;
          const showResults = caseData?.show_results_to_candidate === true;
          const caseTitle = caseData?.title ?? "—";
          const date = new Date(r.created_at).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
          });
          const isExpanded = expandedId === r.id;
          const parsed = parseScoreReport(r.ai_score_report);
          const scoreDisplay = getScoreDisplay(r.ai_score_report);

          return (
            <div key={r.id} className="rounded-lg border border-border overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => showResults && setExpandedId(isExpanded ? null : r.id)}
                disabled={!showResults}
              >
                <div className="space-y-1">
                  <p className="font-medium">{caseTitle}</p>
                  <p className="text-xs text-muted-foreground">{date}</p>
                </div>
                <div className="flex items-center gap-2">
                  {showResults ? (
                    <>
                      <Badge variant={scoreDisplay.variant}>{scoreDisplay.label}</Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </>
                  ) : (
                    <Badge variant="secondary">Selesai</Badge>
                  )}
                </div>
              </button>

              {showResults && isExpanded && (
                <div className="border-t border-border p-4 bg-muted/30 space-y-4">
                  {parsed.hasCriticalFail && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-semibold">TIDAK LULUS — Item critical tidak dilakukan</span>
                    </div>
                  )}

                  {parsed.items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Rubrik Penilaian</h4>
                      <div className="space-y-1">
                        {parsed.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Badge variant={item.passed ? "default" : "destructive"} className="text-xs">
                              {item.passed ? "PASS" : "FAIL"}
                            </Badge>
                            {item.isCritical && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            <span className="flex-1">{item.item}</span>
                            {item.points != null && (
                              <span className="text-xs font-mono text-muted-foreground">
                                {item.passed ? item.points : 0}/{item.points} pts
                              </span>
                            )}
                            {item.comment && <span className="text-muted-foreground text-xs">— {item.comment}</span>}
                          </div>
                        ))}
                        {parsed.totalPossible != null && (
                          <div className="flex items-center justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                            <span>Total</span>
                            <span>{parsed.totalScore}/{parsed.totalPossible} pts ({Math.round((parsed.totalScore! / parsed.totalPossible) * 100)}%)</span>
                          </div>
                        )}
                        {parsed.score != null && (
                          <div className="flex items-center justify-between text-base font-bold border-t border-border pt-3 mt-3">
                            <span>Nilai Akhir</span>
                            <Badge variant={parsed.score >= 68 && !parsed.hasCriticalFail ? "default" : "destructive"} className="text-base px-3 py-1">
                              {parsed.score}/100 — {parsed.passStatus || (parsed.score >= 68 ? "LULUS" : "TIDAK LULUS")}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {parsed.reasoning && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">💡 Alasan Penilaian</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">{parsed.reasoning}</p>
                    </div>
                  )}

                  {parsed.tips && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">📝 Tips Perbaikan</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">{parsed.tips}</p>
                    </div>
                  )}

                  {!parsed.items.length && parsed.score == null && (
                    <p className="text-sm text-muted-foreground">Belum ada hasil evaluasi AI.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CandidateResultsList;

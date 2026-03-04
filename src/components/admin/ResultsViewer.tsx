import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Play, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
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
  hasCriticalFail?: boolean;
}

const ResultsViewer = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["exam_results_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_results")
        .select("*, profiles:candidate_id(full_name, email), exam_sessions:session_id(status, case_id, clinical_cases:case_id(title))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!expandedId) return;
    const result = results.find((r: any) => r.id === expandedId);
    if (!result?.audio_file_url || audioUrls[expandedId]) return;

    const generateSignedUrl = async () => {
      const filePath = result.audio_file_url as string;
      const { data } = await supabase.storage
        .from("exam-audio")
        .createSignedUrl(filePath, 3600);
      if (data?.signedUrl) {
        setAudioUrls((prev) => ({ ...prev, [expandedId]: data.signedUrl }));
      }
    };
    generateSignedUrl();
  }, [expandedId, results, audioUrls]);

  const evaluateMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const { data, error } = await supabase.functions.invoke("evaluate-exam", {
        body: { result_id: resultId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam_results_admin"] });
      toast({ title: "AI Evaluation Complete" });
    },
    onError: (e: Error) => {
      toast({ title: "Evaluation Failed", description: e.message, variant: "destructive" });
    },
  });

  const parseScoreReport = (report: Json | null): ScoreReport => {
    if (!report) return { items: [] };
    // New format: { items, totalScore, totalPossible, hasCriticalFail }
    if (typeof report === "object" && !Array.isArray(report) && report !== null && "items" in report) {
      return report as unknown as ScoreReport;
    }
    // Legacy format: ScoreItem[]
    if (Array.isArray(report)) {
      const items = report as unknown as ScoreItem[];
      return { items };
    }
    return { items: [] };
  };

  const getOverallDisplay = (report: Json | null): { label: string; variant: "default" | "destructive" | "outline" } => {
    const parsed = parseScoreReport(report);
    if (parsed.items.length === 0) return { label: "—", variant: "outline" };

    if (parsed.hasCriticalFail) {
      return { label: "TIDAK LULUS", variant: "destructive" };
    }

    if (parsed.totalPossible && parsed.totalPossible > 0) {
      const pct = Math.round((parsed.totalScore! / parsed.totalPossible) * 100);
      return { label: `${pct}% (${parsed.totalScore}/${parsed.totalPossible})`, variant: "default" };
    }

    // Legacy fallback
    const passed = parsed.items.filter((i) => i.passed).length;
    return { label: `${passed}/${parsed.items.length}`, variant: "default" };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Exam Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No exam results yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r: any) => {
                const scoreDisplay = getOverallDisplay(r.ai_score_report);
                const parsed = parseScoreReport(r.ai_score_report);
                return (
                  <>
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      <TableCell className="font-medium">{r.profiles?.full_name ?? "—"}</TableCell>
                      <TableCell>{r.exam_sessions?.clinical_cases?.title ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.exam_sessions?.status === "completed" ? "default" : "secondary"}>
                          {r.exam_sessions?.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={scoreDisplay.variant}>{scoreDisplay.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={evaluateMutation.isPending}
                          onClick={(e) => { e.stopPropagation(); evaluateMutation.mutate(r.id); }}
                        >
                          {evaluateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                          Evaluate
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === r.id ? null : r.id); }}>
                          {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === r.id && (
                      <TableRow key={`${r.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            {r.audio_file_url && (
                              <div>
                                <h4 className="text-sm font-semibold mb-1">Audio Recording</h4>
                                {audioUrls[r.id] ? (
                                  <audio controls src={audioUrls[r.id]} className="w-full max-w-md" />
                                ) : (
                                  <p className="text-sm text-muted-foreground">Loading audio...</p>
                                )}
                              </div>
                            )}

                            <div>
                              <h4 className="text-sm font-semibold mb-1">Transcript</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">
                                {r.transcript || "No transcript available. Run AI Evaluation to generate."}
                              </p>
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold mb-1">AI Score Report</h4>
                              {parsed.hasCriticalFail && (
                                <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="font-semibold">TIDAK LULUS — Item critical tidak dilakukan</span>
                                </div>
                              )}
                              {parsed.items.length > 0 ? (
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
                                      {item.comment && (
                                        <span className="text-muted-foreground text-xs">— {item.comment}</span>
                                      )}
                                    </div>
                                  ))}
                                  {parsed.totalPossible != null && (
                                    <div className="flex items-center justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                                      <span>Total</span>
                                      <span>{parsed.totalScore}/{parsed.totalPossible} pts ({Math.round((parsed.totalScore! / parsed.totalPossible) * 100)}%)</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No score report. Run AI Evaluation to generate.</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultsViewer;

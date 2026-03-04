import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Play, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ScoreItem {
  item: string;
  passed: boolean;
  comment?: string;
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

  // Generate signed URLs for audio files when results expand
  useEffect(() => {
    if (!expandedId) return;
    const result = results.find((r: any) => r.id === expandedId);
    if (!result?.audio_file_url || audioUrls[expandedId]) return;

    const generateSignedUrl = async () => {
      const filePath = result.audio_file_url as string;
      const { data } = await supabase.storage
        .from("exam-audio")
        .createSignedUrl(filePath, 3600); // 1 hour expiry

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
      toast({ title: "AI Evaluation Complete", description: "Transcript and scores have been generated." });
    },
    onError: (e: Error) => {
      toast({ title: "Evaluation Failed", description: e.message, variant: "destructive" });
    },
  });

  const parseScoreReport = (report: Json | null): ScoreItem[] => {
    if (!report) return [];
    if (Array.isArray(report)) return report as unknown as ScoreItem[];
    if (typeof report === "object" && report !== null && "items" in report) {
      return (report as any).items as ScoreItem[];
    }
    return [];
  };

  const getOverallScore = (report: Json | null): string => {
    const items = parseScoreReport(report);
    if (items.length === 0) return "—";
    const passed = items.filter((i) => i.passed).length;
    return `${passed}/${items.length}`;
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
              {results.map((r: any) => (
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
                      <Badge variant={r.ai_score_report ? "default" : "outline"}>
                        {getOverallScore(r.ai_score_report)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={evaluateMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          evaluateMutation.mutate(r.id);
                        }}
                      >
                        {evaluateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Evaluate
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === r.id ? null : r.id);
                        }}
                      >
                        {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && (
                    <TableRow key={`${r.id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-4">
                        <div className="space-y-4">
                          {/* Audio with signed URL */}
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

                          {/* Transcript */}
                          <div>
                            <h4 className="text-sm font-semibold mb-1">Transcript</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted p-3">
                              {r.transcript || "No transcript available. Run AI Evaluation to generate."}
                            </p>
                          </div>

                          {/* Score Report */}
                          <div>
                            <h4 className="text-sm font-semibold mb-1">AI Score Report</h4>
                            {parseScoreReport(r.ai_score_report).length > 0 ? (
                              <div className="space-y-1">
                                {parseScoreReport(r.ai_score_report).map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <Badge variant={item.passed ? "default" : "destructive"} className="text-xs">
                                      {item.passed ? "PASS" : "FAIL"}
                                    </Badge>
                                    <span>{item.item}</span>
                                    {item.comment && (
                                      <span className="text-muted-foreground">— {item.comment}</span>
                                    )}
                                  </div>
                                ))}
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
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ResultsViewer;

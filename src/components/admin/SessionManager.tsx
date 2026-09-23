import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateBookingCode } from "@/lib/bookingCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Rocket, Copy, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Search, Plus, Monitor } from "lucide-react";
import StationDeployResults, { type DeployedStationToken } from "@/components/admin/StationDeployResults";
import CaseTransferList from "@/components/admin/CaseTransferList";
import DeployedStationsTable from "@/components/admin/DeployedStationsTable";

interface SessionManagerProps {
  examMode: string;
}

const SessionManager = ({ examMode }: SessionManagerProps) => {
  const [selectedCasesByMode, setSelectedCasesByMode] = useState<Record<string, { id: string; title: string }[]>>({
    oral_board: [],
    panel_exam: [],
  });
  const [pcCount, setPcCount] = useState(1);
  const [showResultsToCandidateOverride, setShowResultsToCandidateOverride] = useState(false);
  const [deployedStations, setDeployedStations] = useState<DeployedStationToken[]>([]);
  const [showResults, setShowResults] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const selectedCases = selectedCasesByMode[examMode] ?? [];
  const modeLabel = examMode === "oral_board" ? "Oral Board" : "Panel";
  const setSelectedCases = (nextCases: { id: string; title: string }[]) => {
    setSelectedCasesByMode((current) => ({ ...current, [examMode]: nextCases }));
  };

  const { data: cases = [] } = useQuery({
    queryKey: ["clinical_cases"],
    queryFn: async () => {
      // Fetch all fields with source and status for filtering/preview
      const { data, error } = await supabase
        .from("clinical_cases")
        .select("*")
        .eq("status", "published") // ONLY publishable cases
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Merge with case_answer_keys for complete data
      const { data: answerKeys } = await supabase
        .from("case_answer_keys")
        .select("case_id, answer_key_text, checklist_rubric");
      
      const akMap = new Map(
        (answerKeys || []).map((ak: any) => [ak.case_id, ak])
      );
      
      return (data || []).map((c: any) => ({
        ...c,
        answer_key_text: c.answer_key_text || akMap.get(c.id)?.answer_key_text,
        checklist_rubric: c.checklist_rubric || akMap.get(c.id)?.checklist_rubric,
      }));
    },
  });

  const casesForMode = cases.filter((clinicalCase: any) => clinicalCase.exam_mode === examMode);

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (selectedCases.length === 0) throw new Error("Pilih minimal satu case");
      if (pcCount < 1 || pcCount > 50) throw new Error("Jumlah PC harus 1-50");

      const deployed: DeployedStationToken[] = [];
      const batchTokens = new Set<string>();

      for (let pc = 0; pc < pcCount; pc++) {
        const deploymentId = crypto.randomUUID();
        const questions = selectedCases.map((clinicalCase, questionIndex) => {
          let token = generateBookingCode();
          while (batchTokens.has(token)) token = generateBookingCode();
          batchTokens.add(token);
          return {
            token,
            clinicalCase,
            questionNumber: questionIndex + 1,
          };
        });

        // pcCount means physical PCs. Each PC receives one token/session per
        // selected question, so total tokens = pcCount × selectedCases.length.
        const { data: sessions, error: sessionError } = await supabase
          .from("exam_sessions")
          .insert(questions.map(({ token, clinicalCase }) => ({
            case_id: clinicalCase.id,
            station_token: token,
            status: "waiting",
            show_results_to_candidate_override: showResultsToCandidateOverride,
          })))
          .select("id, station_token");
        if (sessionError) throw sessionError;

        const sessionByToken = new Map(
          (sessions ?? []).map((session) => [session.station_token, session.id])
        );
        if (sessionByToken.size !== questions.length) {
          throw new Error("Tidak semua sesi soal berhasil dibuat");
        }

        const sequenceItems = questions.map(({ token, clinicalCase, questionNumber }) => ({
          deployment_id: deploymentId,
          station_token: token,
          case_id: clinicalCase.id,
          sequence_order: questionNumber,
          session_id: sessionByToken.get(token),
        }));

        const { error: seqError } = await supabase.from("exam_sequence_items").insert(sequenceItems);
        if (seqError) throw seqError;

        deployed.push(...questions.map(({ token, clinicalCase, questionNumber }) => ({
          token,
          pcNumber: pc + 1,
          questionNumber,
          questionTotal: selectedCases.length,
          caseTitle: clinicalCase.title,
        })));
      }

      return deployed;
    },
    onSuccess: (stations) => {
      queryClient.invalidateQueries({ queryKey: ["exam_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["deployed_stations"] });
      setDeployedStations(stations);
      setShowResults(true);
      setSelectedCases([]);
      setPcCount(1);
      setShowResultsToCandidateOverride(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deploy Session {modeLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseTransferList
            cases={casesForMode}
            selectedCases={selectedCases}
            onSelectedCasesChange={setSelectedCases}
          />

          {selectedCases.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Akan dibuat {pcCount * selectedCases.length} kode station ({pcCount} PC × {selectedCases.length} soal).
                Setiap soal memiliki kode dan URL sendiri.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Jumlah PC/Monitor:</label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPcCount((v) => Math.max(1, v - 1))}
                      disabled={pcCount <= 1}
                    >
                      <span className="text-lg leading-none">−</span>
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={pcCount || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") { setPcCount(0); return; }
                        const num = parseInt(val);
                        if (!isNaN(num)) setPcCount(Math.min(50, num));
                      }}
                      className="w-16 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPcCount((v) => Math.min(50, v + 1))}
                      disabled={pcCount >= 50}
                    >
                      <span className="text-lg leading-none">+</span>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                <Checkbox
                  id={`show-results-override-${examMode}`}
                  checked={showResultsToCandidateOverride}
                  onCheckedChange={(checked) => setShowResultsToCandidateOverride(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor={`show-results-override-${examMode}`}
                    className="cursor-pointer text-sm font-medium"
                  >
                    Tampilkan Nilai ke Peserta
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Jika dicentang, seluruh soal dan PC pada deployment ini menampilkan nilai meski pengaturan per case nonaktif.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={() => deployMutation.mutate()}
            disabled={selectedCases.length === 0 || deployMutation.isPending || pcCount < 1}
            className="w-full sm:w-auto"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Deploy {pcCount * selectedCases.length} Station {modeLabel}
            {selectedCases.length > 1 ? ` (${selectedCases.length} soal/PC)` : ""}
          </Button>
        </CardContent>
      </Card>

      <DeployedStationsTable examMode={examMode} />

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Station Berhasil Di-deploy! 🚀</DialogTitle>
            <DialogDescription>
              {deployedStations.length} station berhasil di-deploy. Buka URL soal pertama untuk setiap PC;
              layar akan berpindah otomatis ke token soal berikutnya.
            </DialogDescription>
          </DialogHeader>
          <StationDeployResults stations={deployedStations} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessionManager;

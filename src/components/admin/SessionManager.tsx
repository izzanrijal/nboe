import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateBookingCode } from "@/lib/bookingCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Rocket, Copy, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Search, Plus, Monitor } from "lucide-react";
import StationDeployResults from "@/components/admin/StationDeployResults";
import CaseTransferList from "@/components/admin/CaseTransferList";
import DeployedStationsTable from "@/components/admin/DeployedStationsTable";

const SessionManager = () => {
  const [selectedCases, setSelectedCases] = useState<{ id: string; title: string }[]>([]);
  const [pcCount, setPcCount] = useState(1);
  const [deployedTokens, setDeployedTokens] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cases = [] } = useQuery({
    queryKey: ["clinical_cases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinical_cases").select("id, title").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (selectedCases.length === 0) throw new Error("Pilih minimal satu case");
      if (pcCount < 1 || pcCount > 50) throw new Error("Jumlah PC harus 1-50");

      const tokens: string[] = [];

      for (let pc = 0; pc < pcCount; pc++) {
        const token = generateBookingCode();

        // Create first session
        const { data: sessionData, error: sessionError } = await supabase
          .from("exam_sessions")
          .insert({ case_id: selectedCases[0].id, station_token: token, status: "waiting" })
          .select("id")
          .single();
        if (sessionError) throw sessionError;

        // Create sequence items
        const sequenceItems = selectedCases.map((c, i) => ({
          station_token: token,
          case_id: c.id,
          sequence_order: i + 1,
          session_id: i === 0 ? sessionData.id : null,
        }));

        const { error: seqError } = await supabase.from("exam_sequence_items").insert(sequenceItems);
        if (seqError) throw seqError;

        tokens.push(token);
      }

      return tokens;
    },
    onSuccess: (tokens) => {
      queryClient.invalidateQueries({ queryKey: ["exam_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["deployed_stations"] });
      setDeployedTokens(tokens);
      setShowResults(true);
      setSelectedCases([]);
      setPcCount(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deploy Station
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseTransferList
            cases={cases}
            selectedCases={selectedCases}
            onSelectedCasesChange={setSelectedCases}
          />

          {selectedCases.length > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Jumlah PC/Monitor:</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={pcCount}
                  onChange={(e) => setPcCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  className="w-20"
                />
              </div>
            </div>
          )}

          <Button
            onClick={() => deployMutation.mutate()}
            disabled={selectedCases.length === 0 || deployMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Deploy {pcCount > 1 ? `${pcCount} Station` : "Station"}
            {selectedCases.length > 1 ? ` (${selectedCases.length} ujian)` : ""}
          </Button>
        </CardContent>
      </Card>

      <DeployedStationsTable />

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Station Deployed! 🚀</DialogTitle>
            <DialogDescription>
              {deployedTokens.length} station berhasil di-deploy. Ketik kode di browser PC station.
            </DialogDescription>
          </DialogHeader>
          <StationDeployResults tokens={deployedTokens} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessionManager;

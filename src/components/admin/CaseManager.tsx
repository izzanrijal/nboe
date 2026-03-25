import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import CaseForm from "./CaseForm";
import AssetUploader from "./AssetUploader";
import ExcelImporter from "./ExcelImporter";

interface ClinicalCase {
  id: string;
  title: string;
  exam_mode: string;
  initial_prompt: string;
  checklist_rubric: any;
  time_limit_seconds: number;
  reading_time_seconds: number;
  questions_text: string;
  answer_key_text: string;
  show_results_to_candidate: boolean;
}

const CaseManager = () => {
  const [editingCase, setEditingCase] = useState<ClinicalCase | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [assetCaseId, setAssetCaseId] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["clinical_cases"],
    queryFn: async () => {
      // Fetch cases + their answer keys from the secure table
      const { data: casesData, error } = await supabase
        .from("clinical_cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch answer keys (admin-only table)
      const { data: answerKeys } = await supabase
        .from("case_answer_keys")
        .select("case_id, answer_key_text, checklist_rubric");

      const akMap = new Map(
        (answerKeys || []).map((ak: any) => [ak.case_id, ak])
      );

      // Merge: prefer case_answer_keys data over clinical_cases columns
      return (casesData || []).map((c: any) => {
        const ak = akMap.get(c.id);
        return {
          ...c,
          answer_key_text: ak?.answer_key_text ?? c.answer_key_text,
          checklist_rubric: ak?.checklist_rubric ?? c.checklist_rubric,
        } as ClinicalCase;
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinical_cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinical_cases"] });
      toast({ title: "Case deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (c: ClinicalCase) => {
    setEditingCase(c);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingCase(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCase(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Clinical Cases</CardTitle>
        <div className="flex gap-2">
          <Button onClick={() => setShowImporter(true)} variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" /> New Case
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : cases.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No clinical cases yet. Create your first one.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Time (s)</TableHead>
                <TableHead>Rubric Items</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>{c.exam_mode === "oral_board" ? "Oral Board" : "Panel Exam"}</TableCell>
                  <TableCell>{c.time_limit_seconds}</TableCell>
                  <TableCell>{Array.isArray(c.checklist_rubric) ? c.checklist_rubric.length : (c.checklist_rubric?.items?.length ?? 0)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => setAssetCaseId(c.id)}>
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={(o) => !o && handleFormClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCase ? "Edit Case" : "Create New Case"}</DialogTitle>
          </DialogHeader>
          <CaseForm existingCase={editingCase} onClose={handleFormClose} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!assetCaseId} onOpenChange={(o) => !o && setAssetCaseId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Assets</DialogTitle>
          </DialogHeader>
          {assetCaseId && <AssetUploader caseId={assetCaseId} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CaseManager;

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import RubricBuilder from "./RubricBuilder";

interface CaseFormProps {
  existingCase?: {
    id: string;
    title: string;
    exam_mode: string;
    initial_prompt: string;
    checklist_rubric: any;
    time_limit_seconds: number;
  } | null;
  onClose: () => void;
}

const CaseForm = ({ existingCase, onClose }: CaseFormProps) => {
  const [title, setTitle] = useState(existingCase?.title ?? "");
  const [examMode, setExamMode] = useState(existingCase?.exam_mode ?? "oral_board");
  const [initialPrompt, setInitialPrompt] = useState(existingCase?.initial_prompt ?? "");
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(existingCase?.time_limit_seconds ?? 360);
  const [rubricItems, setRubricItems] = useState<string[]>(
    Array.isArray(existingCase?.checklist_rubric) ? existingCase.checklist_rubric : []
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        exam_mode: examMode,
        initial_prompt: initialPrompt,
        time_limit_seconds: timeLimitSeconds,
        checklist_rubric: rubricItems,
      };

      if (existingCase) {
        const { error } = await supabase.from("clinical_cases").update(payload).eq("id", existingCase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinical_cases").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinical_cases"] });
      toast({ title: existingCase ? "Case updated" : "Case created" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Exam Mode</Label>
        <Select value={examMode} onValueChange={setExamMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="oral_board">Oral Board</SelectItem>
            <SelectItem value="panel_exam">Panel Exam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">Initial Prompt</Label>
        <Textarea
          id="prompt"
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          rows={5}
          placeholder="The clinical scenario text shown on the display screen..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="time">Time Limit (seconds)</Label>
        <Input
          id="time"
          type="number"
          min={60}
          value={timeLimitSeconds}
          onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
        />
      </div>

      <RubricBuilder items={rubricItems} onChange={setRubricItems} />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : existingCase ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
};

export default CaseForm;

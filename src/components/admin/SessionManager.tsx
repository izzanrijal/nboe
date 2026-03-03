import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Rocket, Copy, Trash2 } from "lucide-react";

const SessionManager = () => {
  const [selectedCaseId, setSelectedCaseId] = useState("");
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

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["exam_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("*, clinical_cases(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCaseId) throw new Error("Select a case first");
      const token = nanoid(12);
      const { error } = await supabase.from("exam_sessions").insert({
        case_id: selectedCaseId,
        station_token: token,
        status: "waiting",
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ["exam_sessions"] });
      const url = `${window.location.origin}/station/${token}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Station deployed!", description: `URL copied: ${url}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam_sessions"] }),
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "waiting": return "secondary";
      case "active": return "default";
      case "completed": return "outline";
      default: return "destructive";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exam Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select a case to deploy..." /></SelectTrigger>
            <SelectContent>
              {cases.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => deployMutation.mutate()} disabled={!selectedCaseId || deployMutation.isPending}>
            <Rocket className="h-4 w-4 mr-2" /> Deploy Station
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No sessions yet. Deploy a case above.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.clinical_cases?.title ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.station_token}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(s.status)}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/station/${s.station_token}`);
                        toast({ title: "URL copied" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionManager;

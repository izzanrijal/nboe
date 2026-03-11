import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Rocket, Copy, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X } from "lucide-react";

const PAGE_SIZE = 10;

const SessionManager = () => {
  const [selectedCases, setSelectedCases] = useState<{ id: string; title: string }[]>([]);
  const [page, setPage] = useState(0);
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

  const { data: sessionsResult, isLoading } = useQuery({
    queryKey: ["exam_sessions", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("exam_sessions")
        .select("*, clinical_cases(title), profiles!exam_sessions_current_candidate_id_fkey(full_name, nim)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { sessions: data || [], total: count || 0 };
    },
  });

  const sessions = sessionsResult?.sessions || [];
  const totalPages = Math.ceil((sessionsResult?.total || 0) / PAGE_SIZE);

  const toggleCase = (c: { id: string; title: string }) => {
    setSelectedCases((prev) => {
      const exists = prev.find((x) => x.id === c.id);
      if (exists) return prev.filter((x) => x.id !== c.id);
      return [...prev, c];
    });
  };

  const moveCase = (index: number, direction: -1 | 1) => {
    setSelectedCases((prev) => {
      const newArr = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newArr.length) return prev;
      [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
      return newArr;
    });
  };

  const removeCase = (index: number) => {
    setSelectedCases((prev) => prev.filter((_, i) => i !== index));
  };

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (selectedCases.length === 0) throw new Error("Select at least one case");
      const token = nanoid(12);

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

      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ["exam_sessions"] });
      const url = `${window.location.origin}/station/${token}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Station deployed!", description: `URL copied: ${url} (${selectedCases.length} ujian)` });
      setSelectedCases([]);
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
        {/* Case selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Pilih case untuk deploy (bisa lebih dari satu untuk ujian berurutan):</p>
          <div className="grid gap-2 max-h-48 overflow-y-auto border border-border rounded-md p-3">
            {cases.map((c: any) => {
              const isSelected = selectedCases.some((x) => x.id === c.id);
              return (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleCase(c)}
                  />
                  <span className="text-sm">{c.title}</span>
                </label>
              );
            })}
            {cases.length === 0 && <p className="text-muted-foreground text-sm">Belum ada case.</p>}
          </div>

          {/* Selected order */}
          {selectedCases.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Urutan ujian (drag atau gunakan panah):</p>
              <div className="space-y-1">
                {selectedCases.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 bg-muted/50 rounded px-3 py-1.5 text-sm">
                    <span className="font-mono text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <span className="flex-1">{c.title}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveCase(i, -1)} disabled={i === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveCase(i, 1)} disabled={i === selectedCases.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCase(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={() => deployMutation.mutate()} disabled={selectedCases.length === 0 || deployMutation.isPending}>
            <Rocket className="h-4 w-4 mr-2" />
            Deploy Station {selectedCases.length > 1 ? `(${selectedCases.length} ujian)` : ""}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No sessions yet. Deploy a case above.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.clinical_cases?.title ?? "—"}</TableCell>
                    <TableCell>
                      {s.profiles ? (
                        <div>
                          <span className="font-medium">{s.profiles.full_name}</span>
                          {s.profiles.nim && (
                            <span className="text-xs text-muted-foreground ml-1">({s.profiles.nim})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionManager;

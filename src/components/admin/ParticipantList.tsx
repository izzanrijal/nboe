import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const ParticipantList = () => {
  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants"],
    queryFn: async () => {
      // Get all candidate user_ids
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "candidate");
      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const candidateIds = roles.map((r) => r.user_id);

      // Fetch profiles for those candidates
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", candidateIds);
      if (profilesError) throw profilesError;

      // Count exams per candidate
      const { data: results, error: resultsError } = await supabase
        .from("exam_results")
        .select("candidate_id");
      if (resultsError) throw resultsError;

      const examCounts: Record<string, number> = {};
      results?.forEach((r) => {
        examCounts[r.candidate_id] = (examCounts[r.candidate_id] || 0) + 1;
      });

      return (profiles || []).map((p) => ({
        ...p,
        examCount: examCounts[p.id] || 0,
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Participants
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : participants.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No candidates registered yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead className="text-right">Exams Taken</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{p.dob || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{p.examCount}</Badge>
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

export default ParticipantList;

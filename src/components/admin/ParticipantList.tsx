import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

const ParticipantList = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", nim: "", password: "" });

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "candidate");
      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const candidateIds = roles.map((r) => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", candidateIds);
      if (profilesError) throw profilesError;

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-candidate", {
        body: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          nim: form.nim,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Participant registered successfully");
      setForm({ fullName: "", email: "", nim: "", password: "" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["participants"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to register participant");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Participants
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register Participant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Participant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input id="reg-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-nim">Registration Number (NIM)</Label>
                  <Input id="reg-nim" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? "Registering..." : "Register"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
                <TableHead>NIM</TableHead>
                <TableHead className="text-right">Exams Taken</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{(p as any).nim || "—"}</TableCell>
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

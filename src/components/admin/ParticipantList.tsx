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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";

const ParticipantList = () => {
  const queryClient = useQueryClient();
  const { isMasterAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", nim: "", password: "" });

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants", isMasterAdmin],
    queryFn: async () => {
      // Master admin also sees other admins (they need exam access too)
      let rolesQuery = supabase.from("user_roles").select("user_id, role");
      if (!isMasterAdmin) rolesQuery = rolesQuery.eq("role", "candidate");
      const { data: roles, error: rolesError } = await rolesQuery;
      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const roleMap: Record<string, string[]> = {};
      roles.forEach((r) => {
        (roleMap[r.user_id] ||= []).push(r.role);
      });
      const candidateIds = Object.keys(roleMap);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", candidateIds);
      if (profilesError) throw profilesError;

      const { data: results, error: resultsError } = await supabase
        .from("exam_results")
        .select("candidate_id");
      if (resultsError) throw resultsError;

      let accessMap: Record<string, boolean> = {};
      if (isMasterAdmin) {
        const { data: access } = await (supabase as any)
          .from("exam_access")
          .select("user_id, allowed");
        (access || []).forEach((a: any) => (accessMap[a.user_id] = a.allowed));
      }

      const examCounts: Record<string, number> = {};
      results?.forEach((r) => {
        examCounts[r.candidate_id] = (examCounts[r.candidate_id] || 0) + 1;
      });

      return (profiles || []).map((p) => ({
        ...p,
        examCount: examCounts[p.id] || 0,
        isAdminRole: roleMap[p.id]?.includes("admin") ?? false,
        allowed: accessMap[p.id] ?? false,
      }));
    },
  });

  const toggleAllowed = async (userId: string, allowed: boolean) => {
    const { error } = await (supabase as any)
      .from("exam_access")
      .upsert({ user_id: userId, allowed, updated_at: new Date().toISOString(), updated_by: user?.id });
    if (error) return toast.error("Gagal menyimpan izin ujian");
    toast.success(allowed ? "Diizinkan ujian" : "Izin ujian dicabut");
    queryClient.invalidateQueries({ queryKey: ["participants"] });
  };

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
                {isMasterAdmin && <TableHead className="text-right">Izin Ujian</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.full_name}
                    {isMasterAdmin && p.isAdminRole && (
                      <Badge variant="outline" className="ml-2">Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{(p as any).nim || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{p.examCount}</Badge>
                  </TableCell>
                  {isMasterAdmin && (
                    <TableCell className="text-right">
                      <Switch
                        checked={p.allowed}
                        onCheckedChange={(v) => toggleAllowed(p.id, v)}
                        aria-label="Izinkan ujian"
                      />
                    </TableCell>
                  )}
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

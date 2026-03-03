import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CaseManager from "@/components/admin/CaseManager";
import SessionManager from "@/components/admin/SessionManager";
import { LogOut, BookOpen, Radio } from "lucide-react";

const AdminDashboard = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </header>

      <main className="container mx-auto p-6">
        <Tabs defaultValue="cases">
          <TabsList className="mb-6">
            <TabsTrigger value="cases" className="gap-2">
              <BookOpen className="h-4 w-4" /> Clinical Cases
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <Radio className="h-4 w-4" /> Exam Sessions
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cases">
            <CaseManager />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;

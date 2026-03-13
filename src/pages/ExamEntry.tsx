import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import QRScanner from "@/components/exam/QRScanner";
import CandidateResultsList from "@/components/exam/CandidateResultsList";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

const ExamEntry = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isNavigating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Membuka sesi ujian...</p>
      </div>
    );
  }

  const handleScan = (sessionId: string) => {
    setIsNavigating(true);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    navigate(`/exam/${sessionId}`, { replace: true });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </div>
      <QRScanner onScan={handleScan} />
      <Separator />
      <CandidateResultsList />
    </div>
  );
};

export default ExamEntry;

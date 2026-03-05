import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import QRScanner from "@/components/exam/QRScanner";
import CandidateResultsList from "@/components/exam/CandidateResultsList";
import { Separator } from "@/components/ui/separator";

const ExamEntry = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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

  const handleScan = (sessionId: string) => {
    navigate(`/exam/${sessionId}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-6">
      <QRScanner onScan={handleScan} />
      <Separator />
      <CandidateResultsList />
    </div>
  );
};

export default ExamEntry;

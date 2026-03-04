import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CandidateRegistration from "@/components/exam/CandidateRegistration";
import QRScanner from "@/components/exam/QRScanner";

type EntryStep = "register" | "scan";

const ExamEntry = () => {
  const [step, setStep] = useState<EntryStep>("register");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegistrationComplete = (userId: string) => {
    setCandidateId(userId);
    setStep("scan");
  };

  const handleScan = (sessionId: string) => {
    navigate(`/exam/${sessionId}`, { replace: true });
  };

  if (step === "register") {
    return <CandidateRegistration onComplete={handleRegistrationComplete} />;
  }

  return <QRScanner onScan={handleScan} />;
};

export default ExamEntry;

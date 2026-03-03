import { CheckCircle } from "lucide-react";

const ExamCompleted = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
      <CheckCircle className="h-20 w-20 text-primary" />
      <h1 className="text-3xl font-bold text-foreground">Exam Completed</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Your examination has been submitted successfully. Your audio recording has been uploaded for
        evaluation. You may now close this window.
      </p>
    </div>
  );
};

export default ExamCompleted;

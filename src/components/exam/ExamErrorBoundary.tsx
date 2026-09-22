import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Prevents a blank white screen if anything inside the exam view crashes. */
class ExamErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Exam view crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-4">
          <AlertTriangle className="h-16 w-16 text-destructive" />
          <h1 className="text-xl font-bold text-foreground text-center">
            Terjadi gangguan pada tampilan ujian
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Rekaman dan waktu ujian tidak hilang. Muat ulang halaman ini untuk melanjutkan.
          </p>
          <Button onClick={() => window.location.reload()}>Muat Ulang</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ExamErrorBoundary;

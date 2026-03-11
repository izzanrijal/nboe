import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, ArrowLeft } from "lucide-react";

interface AudioGatekeeperProps {
  onReady: (stream: MediaStream) => void;
}

const AudioGatekeeper = ({ onReady }: AudioGatekeeperProps) => {
  const navigate = useNavigate();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      onReady(stream);
    } catch (err: any) {
      setError("Izin mikrofon diperlukan. Silakan izinkan akses dan coba lagi.");
      setRequesting(false);
    }
  }, [onReady]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-8">
      <div className="text-center space-y-4">
        <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Mic className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Mulai Ujian</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Audio Anda akan direkam selama ujian. Tekan tombol di bawah untuk mengizinkan mikrofon dan langsung memulai.
        </p>
      </div>

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      <Button onClick={handleStart} size="lg" disabled={requesting} className="text-lg px-8 py-6">
        {requesting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Mempersiapkan...
          </>
        ) : (
          "Mulai Ujian"
        )}
      </Button>
    </div>
  );
};

export default AudioGatekeeper;

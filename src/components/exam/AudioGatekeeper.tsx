import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

interface AudioGatekeeperProps {
  onReady: (stream: MediaStream) => void;
}

const AudioGatekeeper = ({ onReady }: AudioGatekeeperProps) => {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStreamRef(stream);
      setPermissionGranted(true);
    } catch (err: any) {
      setError("Microphone permission is required. Please allow access and try again.");
    } finally {
      setRequesting(false);
    }
  }, []);

  const handleBegin = () => {
    if (streamRef) {
      onReady(streamRef);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-8">
      <div className="text-center space-y-4">
        <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          {permissionGranted ? (
            <Mic className="w-10 h-10 text-primary" />
          ) : (
            <MicOff className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">Audio Permission Required</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Your audio will be recorded during the exam. Please grant microphone access to continue.
        </p>
      </div>

      {!permissionGranted && (
        <Button onClick={requestPermission} size="lg" disabled={requesting}>
          {requesting ? "Requesting..." : "Grant Microphone Access"}
        </Button>
      )}

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      {permissionGranted && (
        <Button onClick={handleBegin} size="lg" className="text-lg px-8 py-6">
          Ready to Begin
        </Button>
      )}
    </div>
  );
};

export default AudioGatekeeper;

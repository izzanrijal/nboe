import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onScan: (sessionId: string) => void;
}

const QRScanner = ({ onScan }: QRScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const startScanner = async () => {
    try {
      setError(null);
      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract session ID from URL like /exam/{sessionId}
          const match = decodedText.match(/\/exam\/([a-zA-Z0-9-]+)/);
          if (match) {
            scanner.stop().catch(() => {});
            onScan(match[1]);
          }
        },
        () => {} // ignore scan failures
      );

      setStarted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to start camera");
    }
  };

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
      <h1 className="text-2xl font-bold text-foreground">Scan Station QR Code</h1>
      <p className="text-muted-foreground text-sm text-center">
        Point your camera at the QR code on the display screen
      </p>

      <div
        id={containerRef.current}
        className="w-full max-w-sm rounded-xl overflow-hidden border border-border"
        style={{ minHeight: started ? 300 : 0 }}
      />

      {!started && (
        <Button onClick={startScanner} size="lg">
          Open Camera
        </Button>
      )}

      {error && (
        <p className="text-destructive text-sm text-center">{error}</p>
      )}
    </div>
  );
};

export default QRScanner;

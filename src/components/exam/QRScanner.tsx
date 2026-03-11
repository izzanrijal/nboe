import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QRScannerProps {
  onScan: (sessionId: string) => void;
}

const QRScanner = ({ onScan }: QRScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const scannedRef = useRef(false);

  const stopScanner = async () => {
    try {
      await scannerRef.current?.stop();
    } catch {}
    scannerRef.current = null;
    setStarted(false);
  };

  const startScanner = async () => {
    try {
      setError(null);
      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (scannedRef.current) return;
          const match = decodedText.match(/\/exam\/([a-zA-Z0-9-]+)/);
          if (match) {
            scannedRef.current = true;
            setNavigating(true);
            try {
              await scanner.stop();
            } catch {}
            setTimeout(() => onScan(match[1]), 100);
          }
        },
        () => {}
      );

      setStarted(true);
    } catch (err: any) {
      setError(err?.message || "Gagal membuka kamera");
    }
  };

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  if (navigating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Memuat sesi ujian...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 gap-6">
      <h1 className="text-2xl font-bold text-foreground">Scan Station QR Code</h1>
      <p className="text-muted-foreground text-sm text-center">
        Arahkan kamera ke QR code pada layar display
      </p>

      <div
        id={containerRef.current}
        className="w-full max-w-sm rounded-xl overflow-hidden border border-border"
        style={{ minHeight: started ? 300 : 0 }}
      />

      {!started ? (
        <Button onClick={startScanner} size="lg">
          Buka Kamera
        </Button>
      ) : (
        <Button variant="outline" onClick={stopScanner}>
          Tutup Kamera
        </Button>
      )}

      {error && (
        <p className="text-destructive text-sm text-center">{error}</p>
      )}
    </div>
  );
};

export default QRScanner;

import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";

interface QRDisplayProps {
  sessionId: string;
  sequenceLabel?: string;
  stationToken?: string;
}

const QRDisplay = ({ sessionId, sequenceLabel, stationToken }: QRDisplayProps) => {
  const url = `${window.location.origin}/exam/${sessionId}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-8 p-8">
      {stationToken && (
        <div className="font-mono text-5xl font-bold tracking-[0.3em] text-foreground">
          {stationToken}
        </div>
      )}
      {sequenceLabel && (
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {sequenceLabel}
        </Badge>
      )}
      <h1 className="text-4xl font-bold text-foreground tracking-tight">
        Scan to Begin Exam
      </h1>
      <div className="bg-white p-8 rounded-2xl shadow-lg">
        <QRCodeSVG value={url} size={320} level="H" />
      </div>
      <p className="text-muted-foreground text-lg max-w-md text-center">
        Open the camera on your phone and scan this QR code to start your examination session.
      </p>
      <p className="text-xs text-muted-foreground font-mono break-all max-w-sm text-center">
        {url}
      </p>
    </div>
  );
};

export default QRDisplay;

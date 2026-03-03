import { QRCodeSVG } from "qrcode.react";

interface QRDisplayProps {
  sessionId: string;
}

const QRDisplay = ({ sessionId }: QRDisplayProps) => {
  const url = `${window.location.origin}/exam/${sessionId}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-8 p-8">
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

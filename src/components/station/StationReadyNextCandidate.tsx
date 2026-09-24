import { Button } from "@/components/ui/button";

interface StationReadyNextCandidateProps {
  countdown: number;
  isResetting: boolean;
  error: string | null;
  onReset: () => void;
}

const StationReadyNextCandidate = ({
  countdown,
  isResetting,
  error,
  onReset,
}: StationReadyNextCandidateProps) => (
  <div className="flex items-center justify-center min-h-screen bg-background p-6">
    <div className="text-center space-y-5 max-w-2xl">
      <div className="text-6xl">✅</div>
      <h1 className="text-4xl font-bold text-foreground">
        Ujian Selesai — Station Siap untuk Peserta Berikutnya
      </h1>
      <div className="text-7xl font-bold text-foreground tabular-nums">{countdown}</div>
      <p className="text-xl text-muted-foreground">
        Kembali ke layar Scan QR dalam {countdown} detik...
      </p>
      {error && <p className="text-base text-destructive" role="alert">{error}</p>}
      <Button size="lg" onClick={onReset} disabled={isResetting}>
        {isResetting ? "Menyiapkan QR Baru..." : "Siapkan QR Peserta Baru Sekarang"}
      </Button>
    </div>
  </div>
);

export default StationReadyNextCandidate;

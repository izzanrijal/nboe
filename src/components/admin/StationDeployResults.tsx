import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface DeployedStationToken {
  token: string;
  pcNumber: number;
  questionNumber: number;
  questionTotal: number;
  caseTitle: string;
}

interface StationDeployResultsProps {
  stations: DeployedStationToken[];
}

const StationDeployResults = ({ stations }: StationDeployResultsProps) => {
  const { toast } = useToast();

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/station/${token}`);
    toast({ title: "URL disalin!" });
  };

  const copyCode = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Kode disalin!" });
  };

  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
      {stations.map((station) => (
        <div key={station.token} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                PC {station.pcNumber} · Soal {station.questionNumber}/{station.questionTotal}
              </p>
              <p className="truncate text-xs text-muted-foreground">{station.caseTitle}</p>
            </div>
            <span className="font-mono text-xl font-bold tracking-widest text-foreground">
              {station.token}
            </span>
          </div>
          <p className="break-all text-xs text-muted-foreground">
            {`${window.location.origin}/station/${station.token}`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => copyCode(station.token)}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Kode
            </Button>
            <Button variant="outline" size="sm" onClick={() => copyUrl(station.token)}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              URL
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StationDeployResults;

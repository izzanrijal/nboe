import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StationDeployResultsProps {
  tokens: string[];
}

const StationDeployResults = ({ tokens }: StationDeployResultsProps) => {
  const { toast } = useToast();

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/station/${token}`);
    toast({ title: "URL copied!" });
  };

  const copyCode = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: "Kode disalin!" });
  };

  return (
    <div className="space-y-3">
      {tokens.map((token, i) => (
        <div key={token} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          {tokens.length > 1 && (
            <span className="text-xs text-muted-foreground font-medium">PC {i + 1}</span>
          )}
          <span className="font-mono text-xl font-bold tracking-widest text-foreground flex-1">
            {token}
          </span>
          <Button variant="outline" size="sm" onClick={() => copyCode(token)}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            Kode
          </Button>
          <Button variant="outline" size="sm" onClick={() => copyUrl(token)}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            URL
          </Button>
        </div>
      ))}
    </div>
  );
};

export default StationDeployResults;

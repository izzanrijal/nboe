import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload } from "lucide-react";

interface AssetUploaderProps {
  caseId: string;
}

const AssetUploader = ({ caseId }: AssetUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState("");
  const [assetType, setAssetType] = useState("image");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assets = [] } = useQuery({
    queryKey: ["case_assets", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_assets")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${caseId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("case-assets").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("case-assets").getPublicUrl(path);

      const keywordArr = keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);

      const { error: insertError } = await supabase.from("case_assets").insert({
        case_id: caseId,
        asset_url: urlData.publicUrl,
        trigger_keywords: keywordArr,
        asset_type: assetType,
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["case_assets", caseId] });
      toast({ title: "Asset uploaded" });
      setFile(null);
      setKeywords("");
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("case_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["case_assets", caseId] }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>File</Label>
          <Input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-2">
          <Label>Trigger Keywords (comma-separated)</Label>
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. thorax, x-ray, ekg" />
        </div>
        <div className="space-y-2">
          <Label>Asset Type</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
          <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Upload Asset"}
        </Button>
      </div>

      {assets.length > 0 && (
        <div className="space-y-2">
          <Label>Existing Assets</Label>
          {assets.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
              <span className="flex-1 truncate">{a.trigger_keywords?.join(", ")}</span>
              <span className="text-xs text-muted-foreground">{a.asset_type}</span>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssetUploader;

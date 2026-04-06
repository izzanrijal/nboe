import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Image, Stethoscope, MessageSquare, FileUp } from "lucide-react";

interface DropZoneProps {
  accept: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

const DropZone = ({ accept, file, onFileSelect }: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onFileSelect(droppedFile);
  }, [onFileSelect]);

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : file
          ? "border-primary/50 bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      />
      <FileUp className={`h-8 w-8 ${file ? "text-primary" : "text-muted-foreground"}`} />
      {file ? (
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB — klik atau drop untuk ganti</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Drag & drop file di sini</p>
          <p className="text-xs text-muted-foreground">atau klik untuk memilih file</p>
        </div>
      )}
    </div>
  );
};

interface AssetUploaderProps {
  caseId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  case_media: "Media Pendamping Kasus",
  examination: "Pemeriksaan",
  additional_info: "Informasi Tambahan",
};

const AssetUploader = ({ caseId }: AssetUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState("");
  const [assetType, setAssetType] = useState("image");
  const [answerText, setAnswerText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("case_media");
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

  const resetForm = () => {
    setFile(null);
    setKeywords("");
    setAssetType("image");
    setAnswerText("");
  };

  const handleUploadMedia = async (category: string) => {
    if (category === "additional_info") {
      if (!keywords.trim() || !answerText.trim()) return;
      setUploading(true);
      try {
        const keywordArr = keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
        const { error } = await supabase.from("case_assets").insert({
          case_id: caseId,
          asset_url: "",
          trigger_keywords: keywordArr,
          asset_type: "text",
          category: "additional_info",
          answer_text: answerText,
        } as any);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["case_assets", caseId] });
        toast({ title: "Informasi tambahan disimpan" });
        resetForm();
      } catch (e: any) {
        toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
      return;
    }

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
        trigger_keywords: category === "case_media" ? [] : keywordArr,
        asset_type: assetType,
        category,
      } as any);
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["case_assets", caseId] });
      toast({ title: "Asset diupload" });
      resetForm();
    } catch (e: any) {
      toast({ title: "Upload gagal", description: e.message, variant: "destructive" });
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

  const groupedAssets = {
    case_media: assets.filter((a: any) => a.category === "case_media"),
    examination: assets.filter((a: any) => !a.category || a.category === "examination"),
    additional_info: assets.filter((a: any) => a.category === "additional_info"),
  };

  const renderAssetList = (items: any[], category: string) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Belum ada asset.</p>;
    return items.map((a: any) => (
      <div key={a.id} className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
        <span className="flex-1 truncate">
          {category === "case_media"
            ? a.asset_url?.split("/").pop() || "media"
            : a.trigger_keywords?.join(", ")}
        </span>
        <span className="text-xs text-muted-foreground">{a.asset_type}</span>
        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    ));
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="case_media" className="text-xs">
          <Image className="h-3 w-3 mr-1" /> Media Kasus
        </TabsTrigger>
        <TabsTrigger value="examination" className="text-xs">
          <Stethoscope className="h-3 w-3 mr-1" /> Pemeriksaan
        </TabsTrigger>
        <TabsTrigger value="additional_info" className="text-xs">
          <MessageSquare className="h-3 w-3 mr-1" /> Info Tambahan
        </TabsTrigger>
      </TabsList>

      {/* Case Media */}
      <TabsContent value="case_media" className="space-y-3">
        <p className="text-xs text-muted-foreground">Gambar/video yang ditampilkan bersama kasus saat waktu membaca.</p>
        <div className="space-y-2">
          <Label>File</Label>
          <Input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-2">
          <Label>Tipe</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => handleUploadMedia("case_media")} disabled={!file || uploading} className="w-full">
          <Upload className="h-4 w-4 mr-2" /> {uploading ? "Mengupload..." : "Upload Media Kasus"}
        </Button>
        <div className="space-y-2">
          <Label>Media Kasus Tersimpan</Label>
          {renderAssetList(groupedAssets.case_media, "case_media")}
        </div>
      </TabsContent>

      {/* Examination */}
      <TabsContent value="examination" className="space-y-3">
        <p className="text-xs text-muted-foreground">Media yang ditampilkan saat peserta meminta pemeriksaan tertentu via keyword.</p>
        <div className="space-y-2">
          <Label>File</Label>
          <Input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-2">
          <Label>Trigger Keywords (pisah koma)</Label>
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. thorax, x-ray, ekg" />
        </div>
        <div className="space-y-2">
          <Label>Tipe</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => handleUploadMedia("examination")} disabled={!file || !keywords.trim() || uploading} className="w-full">
          <Upload className="h-4 w-4 mr-2" /> {uploading ? "Mengupload..." : "Upload Pemeriksaan"}
        </Button>
        <div className="space-y-2">
          <Label>Pemeriksaan Tersimpan</Label>
          {renderAssetList(groupedAssets.examination, "examination")}
        </div>
      </TabsContent>

      {/* Additional Info */}
      <TabsContent value="additional_info" className="space-y-3">
        <p className="text-xs text-muted-foreground">Informasi teks (anamnesis, lab, dll) yang bisa ditanyakan peserta. Tidak perlu upload file.</p>
        <div className="space-y-2">
          <Label>Trigger Keywords (pisah koma)</Label>
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. riwayat keluarga, alergi" />
        </div>
        <div className="space-y-2">
          <Label>Jawaban</Label>
          <Textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Jawaban yang akan diberikan saat peserta bertanya..." rows={4} />
        </div>
        <Button onClick={() => handleUploadMedia("additional_info")} disabled={!keywords.trim() || !answerText.trim() || uploading} className="w-full">
          <Upload className="h-4 w-4 mr-2" /> {uploading ? "Menyimpan..." : "Simpan Info Tambahan"}
        </Button>
        <div className="space-y-2">
          <Label>Info Tambahan Tersimpan</Label>
          {renderAssetList(groupedAssets.additional_info, "additional_info")}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default AssetUploader;

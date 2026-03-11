import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ChevronUp, ChevronDown, X } from "lucide-react";

interface CaseItem {
  id: string;
  title: string;
}

interface CaseTransferListProps {
  cases: CaseItem[];
  selectedCases: CaseItem[];
  onSelectedCasesChange: (cases: CaseItem[]) => void;
}

const CaseTransferList = ({ cases, selectedCases, onSelectedCasesChange }: CaseTransferListProps) => {
  const [search, setSearch] = useState("");

  const availableCases = cases.filter(
    (c) =>
      !selectedCases.some((s) => s.id === c.id) &&
      c.title.toLowerCase().includes(search.toLowerCase())
  );

  const addCase = (c: CaseItem) => {
    onSelectedCasesChange([...selectedCases, c]);
  };

  const removeCase = (index: number) => {
    onSelectedCasesChange(selectedCases.filter((_, i) => i !== index));
  };

  const moveCase = (index: number, direction: -1 | 1) => {
    const newArr = [...selectedCases];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newArr.length) return;
    [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
    onSelectedCasesChange(newArr);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Available cases */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Pilih Case</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari case..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="border border-border rounded-md max-h-56 overflow-y-auto">
          {availableCases.length === 0 ? (
            <p className="text-muted-foreground text-sm p-3 text-center">
              {cases.length === 0 ? "Belum ada case." : "Tidak ditemukan."}
            </p>
          ) : (
            availableCases.map((c) => (
              <button
                key={c.id}
                onClick={() => addCase(c)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{c.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Selected cases */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Urutan Ujian
          {selectedCases.length > 0 && (
            <Badge variant="secondary" className="ml-2">{selectedCases.length}</Badge>
          )}
        </p>
        <div className="border border-border rounded-md min-h-[6rem] max-h-56 overflow-y-auto">
          {selectedCases.length === 0 ? (
            <p className="text-muted-foreground text-sm p-3 text-center">
              Klik case di sebelah kiri untuk menambahkan.
            </p>
          ) : (
            selectedCases.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border-b border-border last:border-0 bg-muted/30"
              >
                <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <span className="flex-1 truncate">{c.title}</span>
                {selectedCases.length > 1 && (
                  <>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveCase(i, -1)} disabled={i === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveCase(i, 1)} disabled={i === selectedCases.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCase(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseTransferList;

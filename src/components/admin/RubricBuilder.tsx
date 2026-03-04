import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, AlertTriangle } from "lucide-react";

export interface RubricItem {
  text: string;
  points: number;
  isCritical: boolean;
}

export interface RubricData {
  enabled: boolean;
  items: RubricItem[];
}

interface RubricBuilderProps {
  data: RubricData;
  onChange: (data: RubricData) => void;
}

const RubricBuilder = ({ data, onChange }: RubricBuilderProps) => {
  const [newText, setNewText] = useState("");
  const [newPoints, setNewPoints] = useState(10);

  const totalPoints = data.items.reduce((sum, item) => sum + item.points, 0);

  const addItem = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onChange({
      ...data,
      items: [...data.items, { text: trimmed, points: newPoints, isCritical: false }],
    });
    setNewText("");
    setNewPoints(10);
  };

  const removeItem = (index: number) => {
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, updates: Partial<RubricItem>) => {
    onChange({
      ...data,
      items: data.items.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Penilaian Berdasarkan Daftar Tilik</Label>
        <Switch
          checked={data.enabled}
          onCheckedChange={(enabled) => onChange({ ...data, enabled })}
        />
      </div>

      {data.enabled && (
        <div className="space-y-3 rounded-md border border-border p-3">
          {/* Add new item */}
          <div className="flex gap-2">
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Tambah item daftar tilik..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
            />
            <Input
              type="number"
              min={1}
              value={newPoints}
              onChange={(e) => setNewPoints(Number(e.target.value))}
              className="w-20"
              placeholder="Poin"
            />
            <Button type="button" variant="secondary" size="icon" onClick={addItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Items list */}
          {data.items.length > 0 ? (
            <ul className="space-y-2">
              {data.items.map((item, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs w-6">{i + 1}.</span>
                  <span className="flex-1">{item.text}</span>
                  <span className="text-xs font-semibold text-foreground bg-background px-2 py-0.5 rounded">
                    {item.points} pts
                  </span>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={item.isCritical}
                      onCheckedChange={(checked) => updateItem(i, { isCritical: !!checked })}
                    />
                    <AlertTriangle className={`h-3.5 w-3.5 ${item.isCritical ? "text-destructive" : "text-muted-foreground/40"}`} />
                  </div>
                  <button type="button" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Belum ada item. Tambahkan item wajib yang harus disebutkan kandidat.
            </p>
          )}

          {/* Total */}
          {data.items.length > 0 && (
            <div className="flex items-center justify-between text-sm border-t border-border pt-2">
              <span className="text-muted-foreground">Total Poin</span>
              <span className="font-bold text-foreground">{totalPoints} pts</span>
            </div>
          )}

          {/* Legend */}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Item critical — jika tidak dilakukan, kandidat terancam tidak lulus.
          </p>
        </div>
      )}
    </div>
  );
};

export default RubricBuilder;

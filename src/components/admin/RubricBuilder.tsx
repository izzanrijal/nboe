import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

interface RubricBuilderProps {
  items: string[];
  onChange: (items: string[]) => void;
}

const RubricBuilder = ({ items, onChange }: RubricBuilderProps) => {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    const trimmed = newItem.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label>Checklist Rubric (Daftar Tilik)</Label>
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a mandatory checklist item..."
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
        />
        <Button type="button" variant="secondary" size="icon" onClick={addItem}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground font-mono text-xs">{i + 1}.</span>
              <span className="flex-1">{item}</span>
              <button type="button" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">No rubric items yet. Add mandatory phrases the candidate must mention.</p>
      )}
    </div>
  );
};

export default RubricBuilder;

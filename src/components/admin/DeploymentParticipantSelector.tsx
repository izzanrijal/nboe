import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeploymentCandidate {
  id: string;
  full_name: string;
  email: string;
  nim: string | null;
}

interface DeploymentParticipantSelectorProps {
  candidates: DeploymentCandidate[];
  selectedParticipantIds: string[];
  onSelectedParticipantIdsChange: (ids: string[]) => void;
  isLoading?: boolean;
  errorMessage?: string;
}

const DeploymentParticipantSelector = ({
  candidates,
  selectedParticipantIds,
  onSelectedParticipantIdsChange,
  isLoading = false,
  errorMessage,
}: DeploymentParticipantSelectorProps) => {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(selectedParticipantIds);
  const selectedCandidates = selectedParticipantIds
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is DeploymentCandidate => Boolean(candidate));

  const toggleParticipant = (participantId: string) => {
    onSelectedParticipantIdsChange(
      selectedIds.has(participantId)
        ? selectedParticipantIds.filter((id) => id !== participantId)
        : [...selectedParticipantIds, participantId],
    );
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">Peserta deployment (opsional)</p>
        <p className="text-xs text-muted-foreground">
          Pilih peserta untuk menyembunyikan case yang pernah diselesaikan oleh salah satunya.
        </p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={isLoading || Boolean(errorMessage)}
          >
            <span className="truncate">
              {isLoading
                ? "Memuat peserta..."
                : selectedParticipantIds.length > 0
                  ? `${selectedParticipantIds.length} peserta dipilih`
                  : "Cari dan pilih peserta..."}
            </span>
            {isLoading ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Cari nama, email, atau NIM..." />
            <CommandList>
              <CommandEmpty>Tidak ada peserta yang cocok.</CommandEmpty>
              <CommandGroup>
                {candidates.map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={`${candidate.full_name} ${candidate.email} ${candidate.nim ?? ""}`}
                    onSelect={() => toggleParticipant(candidate.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.has(candidate.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate">{candidate.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {candidate.email}{candidate.nim ? ` · ${candidate.nim}` : ""}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {selectedCandidates.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Peserta terpilih">
          {selectedCandidates.map((candidate) => (
            <Badge key={candidate.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
              <span className="max-w-52 truncate">
                {candidate.full_name}{candidate.nim ? ` (${candidate.nim})` : ""}
              </span>
              <button
                type="button"
                onClick={() => toggleParticipant(candidate.id)}
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Hapus ${candidate.full_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tanpa peserta terpilih, semua case pada mode ujian ini tetap tersedia dan dapat di-deploy.
        </p>
      )}
    </div>
  );
};

export default DeploymentParticipantSelector;

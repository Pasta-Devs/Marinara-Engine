// ──────────────────────────────────────────────
// Modal: Create Persona (name only)
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../../../../../shared/components/ui/Modal";
import { useCreatePersona } from "../../hooks/use-personas";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreatePersonaModal({ open, onClose }: Props) {
  const createPersona = useCreatePersona();
  const openPersonaDetail = useUIStore((s) => s.openPersonaDetail);
  const [name, setName] = useState("");

  const reset = () => {
    setName("");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const result = await createPersona.mutateAsync({
        name: name.trim(),
        description: "",
      });
      const personaId = (result as { id: string })?.id;
      onClose();
      reset();
      if (personaId) openPersonaDetail(personaId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create persona");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Persona" width="max-w-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-400/20">
            <User size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Personas define your identity and description that get injected into conversations.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="My Persona..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createPersona.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {createPersona.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <User size="0.75rem" />}
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// Modal: Create Preset (name + description only)
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useUIStore } from "../../stores/ui.store";
import { Loader2, FileText } from "lucide-react";

const DEFAULT_PARAMS = {
  temperature: 0.9,
  maxTokens: 8192,
  topP: 0.95,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreatePresetModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createPreset = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/prompts", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });

  const reset = () => {
    setName("");
    setDescription("");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const result = await createPreset.mutateAsync({
        name,
        description,
        parameters: { ...DEFAULT_PARAMS },
      });
      const presetId = (result as { id: string })?.id;
      onClose();
      reset();
      if (presetId) openPresetDetail(presetId);
    } catch {
      // stay in modal on failure
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Preset" width="max-w-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-violet-500 shadow-lg shadow-purple-400/20">
            <FileText size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Presets define the system prompt structure and generation parameters used during conversations.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="My Preset..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this preset is for..."
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
            disabled={!name.trim() || createPreset.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {createPreset.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <FileText size="0.75rem" />}
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// Modal: Create Preset (name + description only)
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useUIStore } from "../../stores/ui.store";
import { Loader2, FileText } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

const DEFAULT_PARAMS = {
  temperature: 0.9,
  maxTokens: 8192,
  topP: 0.95,
  frequencyPenalty: 0,
  presencePenalty: 0,
  serviceTier: null,
  assistantPrefill: "",
  customParameters: {},
};

interface Props {
  open: boolean;
  onClose: () => void;
  defaultName?: string;
}

export function CreatePresetModal({ open, onClose, defaultName = "" }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(defaultName);
  }

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
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.modals.createpresetmodal.createPreset")}
      width="max-w-sm"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="mari-panel-gradient-surface mari-panel-gradient--presets flex h-12 w-12 items-center justify-center rounded-xl">
            <FileText size="1.375rem" className="text-current" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.modals.createpresetmodal.presetsDefineTheSystemPromptStructureAndGenerationParameters")}
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.createcharactermodal.name")}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder={localizeUi("ui.modals.createpresetmodal.myPreset")}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("chat.settings.inlineEditor.fields.description")}
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={localizeUi("ui.modals.createpresetmodal.whatThisPresetIsFor")}
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
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createPreset.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {createPreset.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <FileText size="0.75rem" />}
            {localizeUi("ui.modals.createcharactermodal.create")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

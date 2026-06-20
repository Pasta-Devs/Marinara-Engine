// ──────────────────────────────────────────────
// Modal: Create Lorebook
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import type { LorebookCategory, LorebookScope } from "@marinara-engine/shared";

const LOREBOOK_CATEGORIES: Array<{ id: LorebookCategory; label: string }> = [
  { id: "world", label: "World" },
  { id: "character", label: "Character" },
  { id: "npc", label: "NPC" },
  { id: "spellbook", label: "Spellbook" },
  { id: "uncategorized", label: "Other" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultCategory?: LorebookCategory;
  characterId?: string | null;
  personaId?: string | null;
  defaultScope?: LorebookScope | null;
}

export function CreateLorebookModal({
  open,
  onClose,
  defaultCategory = "uncategorized",
  characterId = null,
  personaId = null,
  defaultScope = null,
}: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "", category: defaultCategory });

  const createLorebook = useMutation({
    mutationFn: (data: { name: string; description: string; category: LorebookCategory }) =>
      api.post("/lorebooks", {
        ...data,
        ...(characterId ? { characterIds: [characterId] } : {}),
        ...(personaId ? { personaIds: [personaId] } : {}),
        ...(defaultScope ? { scope: defaultScope } : {}),
        entries: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lorebooks"] });
      onClose();
      setForm({ name: "", description: "", category: defaultCategory });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Create Lorebook">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-400/20">
            <BookOpen size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Lorebooks inject contextual world-building information into prompts based on keyword triggers.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Name *</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            placeholder="My World Lore..."
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of this lorebook..."
            rows={3}
            className="resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Category</span>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as LorebookCategory }))}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
          >
            {LOREBOOK_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        {createLorebook.isError && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 p-2.5 text-xs text-[var(--destructive)]">
            <AlertCircle size="0.75rem" className="shrink-0" />
            {createLorebook.error instanceof Error ? createLorebook.error.message : "Failed to create lorebook"}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => createLorebook.mutate(form)}
            disabled={!form.name.trim() || createLorebook.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {createLorebook.isPending ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <BookOpen size="0.75rem" />
            )}
            Create Lorebook
          </button>
        </div>
      </div>
    </Modal>
  );
}

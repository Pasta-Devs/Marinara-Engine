// ──────────────────────────────────────────────
// Modal: Create Lorebook
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "../ui/neutral-surface-styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import type { LorebookCategory, LorebookScope } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";

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
  defaultName?: string;
}

export function CreateLorebookModal({
  open,
  onClose,
  defaultCategory = "uncategorized",
  characterId = null,
  personaId = null,
  defaultScope = null,
  defaultName = "",
}: Props) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: defaultName, description: "", category: defaultCategory });
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm((current) => ({ ...current, name: defaultName, category: defaultCategory }));
  }

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
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.modals.createlorebookmodal.createLorebook")}
      closeButtonClassName="max-sm:hidden"
      footer={
        <>
          <button
            type="button"
            onClick={() => createLorebook.mutate(form)}
            disabled={!form.name.trim() || createLorebook.isPending}
            className={SHEET_BUTTON_PRIMARY}
          >
            {createLorebook.isPending ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <BookOpen size="0.75rem" />
            )}
            {localizeUi("ui.modals.createlorebookmodal.createLorebook")}
          </button>
          <button type="button" onClick={onClose} className={SHEET_BUTTON_QUIET}>
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-400/20">
            <BookOpen size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.modals.createlorebookmodal.lorebooksInjectContextualWorldBuildingInformationIntoPromptsBased",
              )}
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.createcharactermodal.name")}
          </span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            placeholder={localizeUi("ui.modals.createlorebookmodal.myWorldLore")}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)] max-sm:text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("chat.settings.inlineEditor.fields.description")}
          </span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={localizeUi("ui.modals.createlorebookmodal.briefDescriptionOfThisLorebook")}
            rows={3}
            className="resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)] max-sm:text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.lorebooks.lorebookeditor.category")}
          </span>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as LorebookCategory }))}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)] max-sm:text-base"
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
            {createLorebook.error instanceof Error
              ? createLorebook.error.message
              : localizeUi("ui.modals.createlorebookmodal.failedToCreateLorebook")}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// Modal: Create Lorebook
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "../ui/neutral-surface-styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { BookOpen, AlertCircle } from "lucide-react";
import type { LorebookCategory, LorebookScope } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { useFeatureEnabled, useFeatureSettings } from "../../hooks/use-feature-settings";
import { useOverhaulLook } from "../../stores/overhaul.store";

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
  const overhaulLook = useOverhaulLook();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: defaultName, description: "", category: defaultCategory });
  // null follows Settings > Advanced > Lorebooks > "Vectors on for new lorebooks" until the user flips it here.
  const [vectorsChoice, setVectorsChoice] = useState<boolean | null>(null);
  const newLorebookVectors = useFeatureEnabled("newLorebookVectors");
  const featureSettingsLoaded = useFeatureSettings().data !== undefined;
  const vectors = vectorsChoice ?? newLorebookVectors;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm((current) => ({ ...current, name: defaultName, category: defaultCategory }));
      setVectorsChoice(null);
    }
  }

  const createLorebook = useMutation({
    mutationFn: (data: { name: string; description: string; category: LorebookCategory }) =>
      api.post("/lorebooks", {
        ...data,
        // Send what the switch shows; only while the default has not loaded yet does the server pick it.
        ...(vectorsChoice === null && !featureSettingsLoaded ? {} : { excludeFromVectorization: !vectors }),
        ...(characterId ? { characterIds: [characterId] } : {}),
        ...(personaId ? { personaIds: [personaId] } : {}),
        ...(defaultScope ? { scope: defaultScope } : {}),
        entries: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
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
            {createLorebook.isPending ? <Spinner size="sm" /> : <BookOpen size="0.75rem" />}
            {localizeUi("ui.modals.createlorebookmodal.createLorebook")}
          </button>
          <button type="button" onClick={onClose} className={SHEET_BUTTON_QUIET}>
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* New layout: the window's title is its header, like Create character; no coloured tile (QC panel 2). */}
        {overhaulLook ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi(
              "ui.modals.createlorebookmodal.lorebooksInjectContextualWorldBuildingInformationIntoPromptsBased",
            )}
          </p>
        ) : (
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
        )}

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

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.lorebooks.lorebookeditor.category")}
          </span>
          <Select
            value={form.category}
            onChange={(next) => setForm((f) => ({ ...f, category: next as LorebookCategory }))}
            label={localizeUi("ui.lorebooks.lorebookeditor.category")}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)] max-sm:text-base"
            options={LOREBOOK_CATEGORIES.map((category) => ({ value: category.id, label: category.label }))}
          />
        </div>

        <SettingsSwitch
          label={localizeUi("ui.lorebooks.lorebookeditor.vectors")}
          help={localizeUi("ui.modals.createlorebookmodal.vectorsHelp")}
          helpPosition="label"
          labelPosition="start"
          checked={vectors}
          onChange={setVectorsChoice}
          className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2 hover:bg-[var(--secondary)]"
        />

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

// ──────────────────────────────────────────────
// Modal: Create Persona (name only)
// ──────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "../ui/neutral-surface-styles";
import { useCreatePersona } from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { Loader2, User } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultName?: string;
}

export function CreatePersonaModal({ open, onClose, defaultName = "" }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const createPersona = useCreatePersona();
  const openPersonaDetail = useUIStore((s) => s.openPersonaDetail);
  const [name, setName] = useState(defaultName);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(defaultName);
  }

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
    } catch {
      // stay in modal on failure
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.modals.createpersonamodal.createPersona")}
      width="max-w-sm"
      closeButtonClassName="max-sm:hidden"
      footer={
        <>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createPersona.isPending}
            className={SHEET_BUTTON_PRIMARY}
          >
            {createPersona.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <User size="0.75rem" />}
            {localizeUi("ui.modals.createpersonamodal.createPersona")}
          </button>
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            className={SHEET_BUTTON_QUIET}
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-400/20">
            <User size="1.375rem" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.modals.createpersonamodal.personasDefineYourIdentityAndDescriptionThatGetInjected")}
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
            placeholder={localizeUi("ui.modals.createpersonamodal.myPersona")}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)] max-sm:text-base"
          />
        </label>
      </div>
    </Modal>
  );
}

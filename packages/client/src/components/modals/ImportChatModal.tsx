// ──────────────────────────────────────────────
// Modal: Import Chat (new layout)
//
// The Chats list's Import button used to open the file picker straight away,
// which left no room for the "Tag imported" / "Tag source" choice. In the new
// layout it opens this small window instead: one drop row and the two tag
// checkboxes, the same as the Library's import windows.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { ImportTagChecks, OvImportDrop, useImportTagChoice, type ImportTagChoice } from "./ImportTagChecks";

export function ImportChatModal({
  open,
  onClose,
  busy,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  /** Imports one chat file; the window closes once it is done. */
  onImport: (file: File, importTags: ImportTagChoice) => Promise<void>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const importTags = useImportTagChoice();

  const close = () => {
    importTags.reset();
    onClose();
  };

  const run = async (files: File[]) => {
    const file = files[0];
    if (!file || busy) return;
    await onImport(file, importTags.choice);
    close();
  };

  return (
    <Modal open={open} onClose={close} title={localizeUi("ui.modals.importtags.importChat")}>
      <div className="flex flex-col gap-4">
        <OvImportDrop
          types={localizeUi("ui.modals.importtags.typesJsonl")}
          single
          dragOver={dragOver}
          setDragOver={setDragOver}
          onFiles={(files) => void run(files)}
          onBrowse={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".jsonl"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void run(files);
          }}
        />
        <ImportTagChecks value={importTags.choice} onChange={importTags.setChoice} sources={["ST", "Marinara"]} />
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />
            {localizeUi("ui.modals.importconnectionmodal.importing")}
          </div>
        ) : null}
        <div className="flex justify-end border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            {localizeUi("capabilities.actions.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

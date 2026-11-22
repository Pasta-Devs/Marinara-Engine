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

export type ImportChatMode = "roleplay" | "conversation";

export function ImportChatModal({
  open,
  onClose,
  busy,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  /**
   * Imports one chat file; the window closes once it is done. mode is the "Open as" pick for a file that doesn't
   * say its own type (a SillyTavern log); Marinara exports keep theirs.
   */
  onImport: (file: File, importTags: ImportTagChoice, mode: ImportChatMode) => Promise<void>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const importTags = useImportTagChoice();
  // Never taken from the open Chats tab: importing from the Game tab used to make a game of a plain log.
  const [mode, setMode] = useState<ImportChatMode>("roleplay");

  const close = () => {
    importTags.reset();
    setMode("roleplay");
    onClose();
  };

  const run = async (files: File[]) => {
    const file = files[0];
    if (!file || busy) return;
    await onImport(file, importTags.choice, mode);
    close();
  };

  return (
    <Modal open={open} onClose={close} title={localizeUi("ui.modals.importtags.importChat")}>
      <div className="flex flex-col gap-4" data-import-chat-modal="">
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
        <div className="ov-imp__pick" data-mari-part="import-chat-mode">
          <label className="ov-imp__label" htmlFor="import-chat-mode">
            {localizeUi("ui.modals.importchat.openAs")}
          </label>
          <span className="ov-imp__choice">
            <select
              id="import-chat-mode"
              className="ov-select"
              value={mode}
              onChange={(event) => setMode(event.target.value === "conversation" ? "conversation" : "roleplay")}
            >
              <option value="roleplay">{localizeUi("ui.modals.importchat.roleplay")}</option>
              <option value="conversation">{localizeUi("ui.modals.importchat.conversation")}</option>
            </select>
            <p className="ov-imp__desc">{localizeUi("ui.modals.importchat.openAsHint")}</p>
          </span>
        </div>
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

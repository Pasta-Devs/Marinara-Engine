import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { dismissActiveDialog, resolveActiveDialog } from "../../lib/app-dialogs";
import { useDialogStore } from "../../stores/dialog.store";
import { useTranslation as useUiTranslation } from "react-i18next";

function getDialogTitle(kind: "alert" | "confirm" | "prompt" | "choice", title?: string) {
  if (title) return title;
  if (kind === "alert") return "Notice";
  if (kind === "prompt") return "Input Required";
  return "Confirm Action";
}

export function AppDialogRenderer() {
  const { t: localizeUi } = useUiTranslation();
  const dialog = useDialogStore((state) => state.dialog);
  const [promptValue, setPromptValue] = useState("");
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog?.kind !== "prompt") {
      setPromptValue("");
      return;
    }

    setPromptValue(dialog.defaultValue ?? "");
  }, [dialog]);

  useEffect(() => {
    if (dialog?.kind !== "prompt") return;

    const timer = window.setTimeout(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [dialog]);

  if (!dialog) return null;

  const confirmToneClass =
    dialog.tone === "destructive" || dialog.tone === "accent"
      ? "mari-chrome-control mari-chrome-control--primary"
      : "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/85";
  const chatControlClass = dialog.chatStyle ? "mari-chat-style-control" : "";

  return (
    // chatFloatingPanel: app dialogs are topmost confirmations — clicking them
    // must never register as an outside click that closes a chat drawer (and
    // unmounts the very modal whose dirty-draft guard opened the dialog).
    <Modal
      open
      onClose={dismissActiveDialog}
      title={getDialogTitle(dialog.kind, dialog.title)}
      width="max-w-sm"
      chatFloatingPanel
      panelClassName={dialog.chatStyle ? "mari-chat-style-surface mari-chat-action-panel" : undefined}
    >
      <div className="space-y-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">
          {dialog.message}
        </p>

        {dialog.kind === "prompt" && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              resolveActiveDialog(promptValue);
            }}
          >
            {dialog.previewImageUrl && (
              <div className="flex justify-center">
                <img
                  src={dialog.previewImageUrl}
                  alt={localizeUi("settings.notifications.customSound.actions.preview")}
                  className="max-h-24 max-w-[8rem] rounded-md object-contain ring-1 ring-[var(--border)]"
                />
              </div>
            )}
            <input
              ref={promptInputRef}
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              placeholder={dialog.placeholder}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={dismissActiveDialog}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {dialog.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmToneClass}`}
              >
                {dialog.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </form>
        )}

        {dialog.kind === "confirm" && (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={dismissActiveDialog}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] ${chatControlClass}`}
              >
                {dialog.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => resolveActiveDialog(true)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmToneClass} ${chatControlClass}`}
              >
                {dialog.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}

        {dialog.kind === "alert" && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => resolveActiveDialog(undefined)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmToneClass}`}
            >
              {dialog.confirmLabel ?? "OK"}
            </button>
          </div>
        )}

        {dialog.kind === "choice" && (
          <div className="space-y-2">
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {dialog.choices.map((choice, i) => (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => resolveActiveDialog(choice.key)}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    choice.tone === "destructive" || choice.tone === "accent"
                      ? "mari-chrome-control mari-chrome-control--primary"
                      : i === 0
                        ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/85"
                        : "ring-1 ring-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={dismissActiveDialog}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              {dialog.cancelLabel ?? "Cancel"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

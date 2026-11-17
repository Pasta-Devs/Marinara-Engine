import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { dismissActiveDialog, resolveActiveDialog } from "../../lib/app-dialogs";
import { useDialogStore } from "../../stores/dialog.store";
import { getAvatarCropStyle } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

function getDialogTitle(
  kind: "alert" | "confirm" | "prompt" | "choice",
  localizeUi: (key: string) => string,
  title?: string,
) {
  if (title) return title;
  if (kind === "alert") return localizeUi("ui.dialogs.noticeTitle");
  if (kind === "prompt") return localizeUi("ui.dialogs.inputRequiredTitle");
  return localizeUi("ui.dialogs.confirmActionTitle");
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

  // Keep the last dialog on screen while Modal plays its exit animation, then Modal unmounts itself.
  const [shown, setShown] = useState(dialog);
  if (dialog && dialog !== shown) setShown(dialog);
  if (!shown) return null;

  const confirmToneClass =
    shown.tone === "destructive"
      ? "mari-chrome-control--danger border font-semibold"
      : shown.tone === "accent"
        ? "mari-chrome-control mari-chrome-control--primary"
        : "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/85";
  const chatControlClass = shown.chatStyle ? "mari-chat-style-control" : "";

  return (
    // chatFloatingPanel: app dialogs are topmost confirmations — clicking them
    // must never register as an outside click that closes a chat drawer (and
    // unmounts the very modal whose dirty-draft guard opened the dialog).
    // topLayer: they also open above every overlay, including package screens.
    <Modal
      open={dialog !== null}
      onClose={dismissActiveDialog}
      title={getDialogTitle(shown.kind, localizeUi, shown.title)}
      width="max-w-sm"
      chatFloatingPanel
      topLayer
      pullToClose={false}
      closeButtonClassName="max-sm:hidden"
      panelClassName={shown.chatStyle ? "mari-chat-style-surface mari-chat-action-panel" : undefined}
    >
      <div className="space-y-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">
          {shown.message}
        </p>

        {shown.kind === "prompt" && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              resolveActiveDialog(promptValue);
            }}
          >
            {shown.previewImageUrl && (
              <div className="flex justify-center">
                <img
                  src={shown.previewImageUrl}
                  alt={localizeUi("settings.notifications.customSound.actions.preview")}
                  className="max-h-24 max-w-[8rem] rounded-md object-contain ring-1 ring-[var(--border)]"
                />
              </div>
            )}
            <input
              ref={promptInputRef}
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              placeholder={shown.placeholder}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none max-sm:text-base transition-colors focus:border-[var(--primary)]"
            />
            <div className="flex flex-row-reverse items-center justify-start gap-2 max-sm:flex-col max-sm:items-stretch">
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 max-sm:py-3 text-sm font-medium transition-colors ${confirmToneClass}`}
              >
                {shown.confirmLabel ?? "Confirm"}
              </button>
              <button
                type="button"
                onClick={dismissActiveDialog}
                className="rounded-lg px-3 py-2 max-sm:py-3 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {shown.cancelLabel ?? "Cancel"}
              </button>
            </div>
          </form>
        )}

        {shown.kind === "confirm" && (
          <div className="space-y-4">
            <div className="flex flex-row-reverse items-center justify-start gap-2 max-sm:flex-col max-sm:items-stretch">
              <button
                type="button"
                onClick={() => resolveActiveDialog(true)}
                className={`rounded-lg px-3 py-2 max-sm:py-3 text-sm font-medium transition-colors ${confirmToneClass} ${chatControlClass}`}
              >
                {shown.confirmLabel ?? "Confirm"}
              </button>
              <button
                type="button"
                onClick={dismissActiveDialog}
                className={`rounded-lg px-3 py-2 max-sm:py-3 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] ${chatControlClass}`}
              >
                {shown.cancelLabel ?? "Cancel"}
              </button>
            </div>
          </div>
        )}

        {shown.kind === "alert" && (
          <div className="flex items-center justify-end max-sm:flex-col max-sm:items-stretch">
            <button
              type="button"
              onClick={() => resolveActiveDialog(undefined)}
              className={`rounded-lg px-3 py-2 max-sm:py-3 text-sm font-medium transition-colors ${confirmToneClass}`}
            >
              {shown.confirmLabel ?? "OK"}
            </button>
          </div>
        )}

        {shown.kind === "choice" && (
          <div className="space-y-2">
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {shown.choices.map((choice, i) =>
                choice.avatar ? (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => resolveActiveDialog(choice.key)}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
                  >
                    {choice.avatar.url ? (
                      <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full">
                        <img
                          src={choice.avatar.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(choice.avatar.crop)}
                        />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold"
                      >
                        {choice.label[0]}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{choice.label}</span>
                      {choice.description && (
                        <span className="block truncate text-xs italic text-[var(--muted-foreground)]">
                          {choice.description}
                        </span>
                      )}
                    </span>
                  </button>
                ) : (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => resolveActiveDialog(choice.key)}
                    className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      choice.tone === "destructive"
                        ? "mari-chrome-control--danger border font-semibold"
                        : choice.tone === "accent"
                          ? "mari-chrome-control mari-chrome-control--primary"
                          : i === 0 && !shown.choices.some((c) => c.tone)
                            ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/85"
                            : "ring-1 ring-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {choice.label}
                  </button>
                ),
              )}
            </div>
            <button
              type="button"
              onClick={dismissActiveDialog}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              {shown.cancelLabel ?? "Cancel"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

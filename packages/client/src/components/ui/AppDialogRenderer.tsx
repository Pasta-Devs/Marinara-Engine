import { useEffect, useRef, useState } from "react";
import { avatarInitial } from "../../lib/avatar-initial";
import { createPortal } from "react-dom";
import { Modal } from "./Modal";
import { useOverhaulMobile } from "../../stores/overhaul.store";
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
  const sheetCancelRef = useRef<HTMLButtonElement>(null);
  // New layout on phones: every confirm is the same action sheet as Delete message (panel 3, PP10).
  const phoneSheet = useOverhaulMobile();

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

  useEffect(() => {
    if (!phoneSheet || !dialog || dialog.kind === "prompt") return;
    const timer = window.setTimeout(() => sheetCancelRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [dialog, phoneSheet]);

  useEffect(() => {
    if (!phoneSheet || !dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissActiveDialog();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, phoneSheet]);

  // Keep the last dialog on screen while Modal plays its exit animation, then Modal unmounts itself.
  const [shown, setShown] = useState(dialog);
  if (dialog && dialog !== shown) setShown(dialog);
  if (!shown) return null;
  // The phone action sheet has no exit animation: it goes as soon as the dialog does.
  if (phoneSheet && !dialog) return null;

  const sheetKind =
    shown.kind === "confirm" ||
    shown.kind === "alert" ||
    shown.kind === "prompt" ||
    (shown.kind === "choice" && !shown.choices.some((choice) => choice.avatar));
  if (phoneSheet && sheetKind) {
    const toneClass = (tone?: string) => (tone === "destructive" ? "is-danger" : "is-primary");
    const title = getDialogTitle(shown.kind, localizeUi, shown.title);
    return createPortal(
      <>
        <div
          className="ovm-action-sheet-scrim"
          aria-hidden="true"
          data-chat-floating-panel
          onClick={dismissActiveDialog}
        />
        <form
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="ovm-action-sheet"
          data-chat-floating-panel
          data-app-dialog-sheet={shown.kind}
          onSubmit={(event) => {
            event.preventDefault();
            if (shown.kind === "prompt") resolveActiveDialog(promptValue);
            else if (shown.kind === "alert") resolveActiveDialog(undefined);
            else if (shown.kind === "confirm") resolveActiveDialog(true);
          }}
        >
          <div className="ovm-action-sheet__group">
            <div className="ovm-action-sheet__head">
              <strong>{title}</strong>
              {shown.message ? <span>{shown.message}</span> : null}
              {shown.kind === "prompt" ? (
                <input
                  ref={promptInputRef}
                  className="ovm-action-sheet__field"
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  placeholder={shown.placeholder}
                  enterKeyHint="done"
                />
              ) : null}
            </div>
            {shown.kind === "choice" ? (
              shown.choices.map((choice, index) => (
                <button
                  key={choice.key}
                  type="button"
                  data-dialog-action={index === 0 ? "confirm" : "choice"}
                  data-tone={choice.tone}
                  className={choice.tone === "destructive" ? "is-danger" : index === 0 ? "is-primary" : undefined}
                  onClick={() => resolveActiveDialog(choice.key)}
                >
                  {choice.label}
                </button>
              ))
            ) : (
              <button
                type="submit"
                data-dialog-action="confirm"
                data-tone={shown.tone}
                className={toneClass(shown.tone)}
              >
                {shown.confirmLabel ?? (shown.kind === "alert" ? "OK" : "Confirm")}
              </button>
            )}
          </div>
          {shown.kind !== "alert" ? (
            <div className="ovm-action-sheet__group">
              <button
                ref={sheetCancelRef}
                type="button"
                className="is-cancel"
                data-dialog-action="cancel"
                onClick={dismissActiveDialog}
              >
                {shown.cancelLabel ?? "Cancel"}
              </button>
            </div>
          ) : null}
        </form>
      </>,
      document.body,
    );
  }

  // Destructive confirms carry the danger class: the gradient-accent skins restyle every other chrome
  // control with a selector that outranks the overhaul's red (panel 3, PV5).
  const confirmToneClass =
    shown.tone === "destructive"
      ? "mari-chrome-control mari-chrome-control--danger"
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
      width={shown.kind === "choice" && shown.layout === "row" ? "max-w-md" : "max-w-sm"}
      chatFloatingPanel
      topLayer
      confirm
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
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={dismissActiveDialog}
                data-dialog-action="cancel"
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {shown.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="submit"
                data-dialog-action="confirm"
                data-tone={shown.tone}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmToneClass}`}
              >
                {shown.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </form>
        )}

        {shown.kind === "confirm" && (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={dismissActiveDialog}
                data-dialog-action="cancel"
                // The safe choice has focus, not the window's ×: Enter or a stray tap never confirms.
                data-autofocus
                className={`rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] ${chatControlClass}`}
              >
                {shown.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => resolveActiveDialog(true)}
                data-dialog-action="confirm"
                data-tone={shown.tone}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmToneClass} ${chatControlClass}`}
              >
                {shown.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}

        {shown.kind === "alert" && (
          <div className="flex items-center justify-end max-sm:flex-col max-sm:items-stretch">
            <button
              type="button"
              onClick={() => resolveActiveDialog(undefined)}
              data-dialog-action="confirm"
              data-tone={shown.tone}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${confirmToneClass}`}
            >
              {shown.confirmLabel ?? "OK"}
            </button>
          </div>
        )}

        {shown.kind === "choice" && shown.layout === "row" && (
          // Phones stack them full width, primary on top; wider screens get one row like a confirm shown.
          <div
            className="flex flex-col-reverse gap-2 whitespace-nowrap sm:flex-row sm:items-center sm:justify-end"
            data-dialog-layout="row"
          >
            {!shown.hideCancel && (
              <button
                type="button"
                onClick={dismissActiveDialog}
                data-dialog-action="cancel"
                className="w-full rounded-lg px-3 py-2 sm:mr-auto sm:w-auto text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {shown.cancelLabel ?? "Cancel"}
              </button>
            )}
            {[...shown.choices].reverse().map((choice, index) => {
              const primary = choice.key === shown.choices[0]?.key;
              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => resolveActiveDialog(choice.key)}
                  data-dialog-action={primary ? "confirm" : "choice"}
                  data-tone={choice.tone}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:w-auto ${
                    shown.hideCancel && index === 0 ? "sm:mr-auto " : ""
                  }${
                    primary
                      ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/85"
                      : choice.tone === "destructive"
                        ? "text-[var(--destructive)] ring-1 ring-[var(--border)] hover:bg-[var(--destructive)]/10"
                        : "text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )}

        {shown.kind === "choice" && shown.layout !== "row" && (
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
                        {avatarInitial(choice.label)}
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

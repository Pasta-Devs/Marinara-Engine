import { MessageCircle } from "lucide-react";

export type CharacterFirstMessageConfirmation = {
  chatId: string;
  charId: string;
  charName: string;
  message: string;
  alternateGreetings: string[];
};

export function CharacterFirstMessageDialog({
  confirmation,
  onClose,
  onAddMessage,
}: {
  confirmation: CharacterFirstMessageConfirmation;
  onClose: () => void;
  onAddMessage: (confirmation: CharacterFirstMessageConfirmation) => void | Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 max-md:pt-[env(safe-area-inset-top)]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex w-full max-w-sm flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <MessageCircle size="0.875rem" className="text-[var(--muted-foreground)]" />
          <span className="text-sm font-semibold text-[var(--foreground)]">First Message</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-[var(--foreground)]">
            Add <strong>{confirmation.charName}</strong>'s first message to the chat?
          </p>
          <p className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-[var(--accent)]/50 px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
            {confirmation.message.length > 300 ? confirmation.message.slice(0, 300) + "\u2026" : confirmation.message}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Skip
          </button>
          <button
            onClick={() => void onAddMessage(confirmation)}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90"
          >
            Add Message
          </button>
        </div>
      </div>
    </div>
  );
}

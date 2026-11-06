import { Reply, X } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { messageReplySchema, type Message } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useOverhaulLook } from "../../stores/overhaul.store";
import { MessageActionButton, MESSAGE_ACTION_ICON_SIZE } from "./MessageActionButton";

export function MessageReplyPreview({ reply: value, onCancel }: { reply: unknown; onCancel?: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const overhaulActive = useOverhaulLook();
  const parsed = messageReplySchema.safeParse(value);
  if (!parsed.success) return null;
  const reply = parsed.data;
  // UI overhaul: one thin line. Above the input it reads "Replying to Name" with a cancel; on a sent
  // message it is a quiet quote line over the text.
  if (overhaulActive) {
    const quote = reply.content.replace(/\s+/g, " ");
    return (
      <div data-message-reply className={onCancel ? "ov-replybar" : "ov-replyquote"}>
        <Reply size={14} aria-hidden="true" />
        <span className="ov-replybar__who">
          {onCancel ? (
            <>
              {localizeUi("ui.noodle.noodlepostcard.replyingTo")} <b>{reply.name}</b>
            </>
          ) : (
            <b>{reply.name}</b>
          )}
        </span>
        <span className="ov-replybar__q">{quote}</span>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label={t("chat.reply.cancel")}>
            <X size={14} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      data-message-reply
      className="mb-2 flex min-w-0 items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-xs text-[var(--foreground)]"
    >
      <Reply size="1rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t("chat.reply.to", { name: reply.name })}</div>
        <div className="line-clamp-2 whitespace-pre-wrap break-words text-[var(--muted-foreground)]">
          {reply.content}
        </div>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("chat.reply.cancel")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--muted)] focus-visible:outline focus-visible:outline-[var(--primary)]"
        >
          <X size="1rem" />
        </button>
      )}
    </div>
  );
}

export function ReplyToMessageButton({
  message,
  name,
  tabIndex,
}: {
  message: Pick<Message, "id" | "chatId" | "content">;
  name: string;
  tabIndex?: number;
}) {
  const { t } = useTranslation();
  return (
    <MessageActionButton
      icon={<Reply size={MESSAGE_ACTION_ICON_SIZE} />}
      title={t("chat.reply.action")}
      tabIndex={tabIndex}
      disabled={!message.content.trim() || message.id.startsWith("__")}
      onClick={() => {
        const selection = window.getSelection();
        const insideMessage = (node: Node | null | undefined) => {
          const element = node instanceof Element ? node : node?.parentElement;
          return element?.closest("[data-message-id]")?.getAttribute("data-message-id") === message.id;
        };
        const selected =
          selection &&
          !selection.isCollapsed &&
          insideMessage(selection.anchorNode) &&
          insideMessage(selection.focusNode)
            ? selection?.toString().trim()
            : "";
        useChatStore.getState().setReplyDraft(message.chatId, {
          messageId: message.id,
          name: name.slice(0, 200),
          // ponytail: quote snapshots are capped at 16k characters; longer passages can be selected separately.
          content: (selected || message.content).slice(0, 16000),
        });
        document.querySelector<HTMLTextAreaElement>("textarea[data-chat-composer]")?.focus();
      }}
    />
  );
}

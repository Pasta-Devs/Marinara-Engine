import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Brain, Check, CircleAlert, Copy } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { copyToClipboard } from "../../lib/utils";

export function MessageThinkingModal({
  thinking,
  summaryUnavailable = false,
  onClose,
  restoreFocusRef,
}: {
  thinking: string | null;
  summaryUnavailable?: boolean;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const title = t("chat.message.thoughts.title");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyToClipboard(thinking!))) {
      toast.error(t("chat.message.thoughts.copyFailed"));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width="max-w-xl"
      panelClassName="mari-chat-style-surface mari-chat-action-panel max-h-[70vh]"
      chatFloatingPanel
      restoreFocusRef={restoreFocusRef}
    >
      {!summaryUnavailable && thinking && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t(copied ? "chat.message.thoughts.copied" : "chat.message.thoughts.copy")}
            title={t(copied ? "chat.message.thoughts.copied" : "chat.message.thoughts.copy")}
            className="mari-chat-style-control inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
          >
            {copied ? <Check size="0.875rem" aria-hidden="true" /> : <Copy size="0.875rem" aria-hidden="true" />}
          </button>
        </div>
      )}
      {summaryUnavailable ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] p-3">
          <CircleAlert
            size="0.875rem"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]"
          />
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium text-[var(--marinara-chat-chrome-panel-title)]">
              {t("chat.message.thoughts.unavailable.title")}
            </p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
              {t("chat.message.thoughts.unavailable.description")}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <Brain
            size="0.875rem"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text-active)]"
          />
          <pre className="mari-chat-style-text min-w-0 flex-1 whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
            {thinking}
          </pre>
        </div>
      )}
    </Modal>
  );
}

// ──────────────────────────────────────────────
// ErrorDetailsDialog — the whole reason a Connections try failed. A row only has room for a short pill
// ("Error 404"); a tap or click on it opens this window with the full message, selectable, and a Copy button.
// ──────────────────────────────────────────────
import { useRef, useState, type RefObject } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { copyToClipboard } from "../../lib/utils";
import { Modal } from "../ui/Modal";

export function ErrorDetailsDialog({
  open,
  onClose,
  title,
  message,
  restoreFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** What was tried, such as the model's name; shown above the message. */
  title?: string;
  message: string;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const messageRef = useRef<HTMLPreElement>(null);
  // The clipboard API can hang or refuse (some WebViews); then the text is selected inside this window, which
  // the focus trap allows, and copied from there. If even that fails, the selection stays for a manual copy.
  const copy = async () => {
    const viaApi = await Promise.race([
      copyToClipboard(message),
      new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 1500)),
    ]);
    let ok = viaApi;
    const node = messageRef.current;
    if (!ok && node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      if (ok) selection?.removeAllRanges();
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else toast.error(t("connections.error.copyFailed"));
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("connections.error.title")}
      width="max-w-lg"
      opaque
      panelClassName="mari-connection-scope"
      restoreFocusRef={restoreFocusRef}
      footer={
        <>
          <button
            type="button"
            data-error-copy
            onClick={() => void copy()}
            className="mari-chrome-control mari-chrome-control--primary justify-center px-3"
          >
            {copied ? <Check size="0.75rem" aria-hidden /> : <Copy size="0.75rem" aria-hidden />}
            {copied ? t("connections.error.copied") : t("connections.error.copy")}
          </button>
          <button type="button" onClick={onClose} className="mari-chrome-control justify-center px-3">
            {t("common.close")}
          </button>
        </>
      }
    >
      {title && <p className="mb-2 text-xs text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{title}</p>}
      <pre
        ref={messageRef}
        data-error-message
        className="max-h-[50dvh] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-foreground/[0.04] p-3 font-mono text-xs leading-5 text-[var(--foreground)] select-text [overflow-wrap:anywhere]"
      >
        {message}
      </pre>
    </Modal>
  );
}

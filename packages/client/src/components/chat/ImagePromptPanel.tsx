import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn, copyToClipboard } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ImagePromptPanelProps {
  prompt?: string | null;
  meta?: string | null;
  className?: string;
}

export function ImagePromptPanel({ prompt, meta, className }: ImagePromptPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const promptText = prompt?.trim() ?? "";
  const metaText = meta?.trim() ?? "";
  const [copied, setCopied] = useState(false);

  if (!promptText && !metaText) return null;

  const handleCopyPrompt = async () => {
    if (!promptText) return;
    const ok = await copyToClipboard(promptText);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      toast.success(localizeUi("ui.chat.chatgallery.promptCopied"));
    } else {
      toast.error(localizeUi("ui.chat.chatgallery.couldNotCopyPrompt"));
    }
  };

  return (
    <div
      className={cn("rounded-lg border border-white/10 bg-neutral-950/95 px-3 py-2 text-left shadow-2xl", className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {promptText && (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[0.6875rem] font-semibold text-white/55">
              {localizeUi("ui.agents.customagentrepositoriesmodal.prompt")}
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleCopyPrompt();
              }}
              className="flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[0.6875rem] font-medium text-white/75 transition-colors hover:bg-white/20 hover:text-white"
            >
              {copied ? <Check size="0.75rem" /> : <Copy size="0.75rem" />}
              {copied
                ? localizeUi("ui.panels.manualupdatecommand.copied")
                : localizeUi("ui.chat.chatgallery.copyPrompt")}
            </button>
          </div>
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-[0.75rem] leading-relaxed text-white/85">
            {promptText}
          </p>
        </>
      )}
      {metaText && (
        <p className={cn("text-[0.6875rem] text-white/45", promptText && "mt-1.5 border-t border-white/10 pt-1.5")}>
          {metaText}
        </p>
      )}
    </div>
  );
}

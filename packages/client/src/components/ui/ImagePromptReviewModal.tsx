import { Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { cn } from "../../lib/utils";

export type ImagePromptReviewKind = "background" | "illustration" | "portrait" | "sprite" | "avatar" | "video";

export type ImagePromptReviewItem = {
  id: string;
  kind: ImagePromptReviewKind;
  title: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  details?: string;
  maxLength?: number;
};

export type ImagePromptOverride = {
  id: string;
  prompt: string;
  negativePrompt?: string;
};

type ImagePromptReviewModalProps = {
  open: boolean;
  items: ImagePromptReviewItem[];
  isSubmitting?: boolean;
  mediaType?: "image" | "video";
  onCancel: () => void;
  onConfirm: (overrides: ImagePromptOverride[]) => void;
};

export function ImagePromptReviewModal({
  open,
  items,
  isSubmitting = false,
  mediaType = "image",
  onCancel,
  onConfirm,
}: ImagePromptReviewModalProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [negativeDrafts, setNegativeDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(items.map((item) => [item.id, item.prompt])));
    setNegativeDrafts(Object.fromEntries(items.map((item) => [item.id, item.negativePrompt ?? ""])));
  }, [items]);

  const hasEmptyPrompt = useMemo(() => items.some((item) => !(drafts[item.id] ?? item.prompt).trim()), [drafts, items]);
  const mediaLabel = mediaType === "video" ? "video" : "image";
  const mediaTitle = mediaType === "video" ? "Video" : "Image";

  const handleConfirm = () => {
    if (hasEmptyPrompt || isSubmitting) return;
    onConfirm(
      items.map((item) => {
        const negativePrompt = (negativeDrafts[item.id] ?? item.negativePrompt ?? "").trim();
        return {
          id: item.id,
          prompt: (drafts[item.id] ?? item.prompt).trim(),
          ...(item.negativePrompt !== undefined || negativePrompt ? { negativePrompt } : {}),
        };
      }),
    );
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => {} : onCancel}
      title={items.length === 1 ? `Review ${mediaTitle} Prompt` : `Review ${mediaTitle} Prompts`}
      width="max-w-4xl"
    >
      <div className="flex max-h-[72vh] flex-col gap-4">
        <div className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          Edit the prompt{items.length === 1 ? "" : "s"} below before Guksu sends the {mediaLabel} request
          {items.length === 1 ? "" : "s"} to your provider.
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const value = drafts[item.id] ?? item.prompt;
            const negativeValue = negativeDrafts[item.id] ?? item.negativePrompt ?? "";
            const itemDetails =
              item.details ??
              (typeof item.width === "number" && typeof item.height === "number" ? `${item.width}x${item.height}` : "");
            return (
              <label
                key={item.id}
                className="flex flex-col gap-2 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[var(--foreground)]">{item.title}</div>
                    <div className="mt-0.5 text-[0.625rem] capitalize text-[var(--muted-foreground)]">
                      {item.kind}
                      {itemDetails ? ` | ${itemDetails}` : ""}
                    </div>
                  </div>
                  <span className="rounded-md bg-[var(--background)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                    {value.trim().length}
                    {item.maxLength ? ` / ${item.maxLength}` : ""} chars
                  </span>
                </div>
                <textarea
                  value={value}
                  onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  maxLength={item.maxLength}
                  rows={8}
                  spellCheck={false}
                  className="min-h-40 resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]"
                />
                {(item.negativePrompt !== undefined || negativeValue) && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Negative prompt</span>
                    <textarea
                      value={negativeValue}
                      onChange={(event) =>
                        setNegativeDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      rows={4}
                      spellCheck={false}
                      className="min-h-24 resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]"
                    />
                  </div>
                )}
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)]/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {hasEmptyPrompt ? (
            <span className="text-[0.625rem] text-[var(--destructive)]">
              Every {mediaLabel} request needs a prompt.
            </span>
          ) : (
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {items.length} request{items.length === 1 ? "" : "s"} ready.
            </span>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size="0.875rem" />
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || hasEmptyPrompt}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition-colors",
                isSubmitting || hasEmptyPrompt
                  ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)] ring-[var(--border)]"
                  : "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/30 hover:bg-[var(--primary)]/20",
              )}
            >
              {isSubmitting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Send size="0.875rem" />}
              Generate
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

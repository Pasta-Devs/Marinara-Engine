// ──────────────────────────────────────────────
// Lorebook Editor: full scanner test
// Sends pasted text (or the current chat) to the server, which runs the same
// scanner generation uses, recursion included, and reports why each entry
// fired or which gate held it back.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { runLorebookTestScan, type LorebookTestScanResult } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";
import { Spinner } from "../ui/Spinner";

export type LorebookScanPreviewMatch = "matched" | "constant";

interface Props {
  lorebookId: string;
  text: string;
  activeChat: { id: string; name: string } | null;
  entryNameById: Map<string, string>;
  onJumpToEntry: (entryId: string) => void;
  /** Row highlights follow the scanner result while one is shown. */
  onResult: (matches: Map<string, LorebookScanPreviewMatch> | null) => void;
}

function toPreviewMatch(sources: string[]): LorebookScanPreviewMatch {
  if (sources.includes("constant")) return "constant";
  return "matched";
}

export function LorebookScanTest({ lorebookId, text, activeChat, entryNameById, onJumpToEntry, onResult }: Props) {
  const { t } = useTranslation();
  const [source, setSource] = useState<"text" | "chat">("text");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LorebookTestScanResult | null>(null);
  const effectiveSource = source === "chat" && activeChat ? "chat" : "text";
  // Bumped whenever the input changes, so a reply for older text is dropped instead of shown as current.
  const requestSeq = useRef(0);

  // A result describes one input; editing the text or switching source makes it stale.
  useEffect(() => {
    requestSeq.current++;
    setRunning(false);
    setResult(null);
    setError(null);
    onResult(null);
  }, [text, effectiveSource, lorebookId, onResult]);

  const run = async () => {
    const seq = ++requestSeq.current;
    setRunning(true);
    setError(null);
    try {
      const next = await runLorebookTestScan(
        lorebookId,
        effectiveSource === "chat" && activeChat ? { chatId: activeChat.id } : { text },
      );
      if (seq !== requestSeq.current) return;
      setResult(next);
      onResult(new Map(next.activated.map((item) => [item.entryId, toPreviewMatch(item.activationSources)])));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : t("lorebook.editor.scanTest.failed"));
    } finally {
      if (seq === requestSeq.current) setRunning(false);
    }
  };

  const nameOf = (id: string, fallback?: string) =>
    entryNameById.get(id) || fallback || t("lorebook.editor.lint.untitledEntry");

  const reasonFor = (item: LorebookTestScanResult["activated"][number]) => {
    const parts: string[] = [];
    if (item.activationSources.includes("constant")) parts.push(t("lorebook.editor.scanTest.why.constant"));
    else if (item.activationSources.includes("recursive")) {
      parts.push(
        item.triggeredBy.length > 0
          ? t("lorebook.editor.scanTest.why.recursiveFrom", {
              names: item.triggeredBy.map((id) => nameOf(id)).join(", "),
              keys: item.matchedKeys.join(", "),
            })
          : t("lorebook.editor.scanTest.why.recursive", { keys: item.matchedKeys.join(", ") }),
      );
    } else parts.push(t("lorebook.editor.scanTest.why.keys", { keys: item.matchedKeys.join(", ") }));
    if (item.probability !== null) parts.push(t("lorebook.editor.scanTest.why.chance", { percent: item.probability }));
    return parts.join(" · ");
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--marinara-editor-divider)] p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex rounded-lg bg-[var(--marinara-editor-control-bg-hover)] p-0.5" role="group">
          {(["text", "chat"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={option === "chat" && !activeChat}
              onClick={() => setSource(option)}
              aria-pressed={effectiveSource === option}
              title={option === "chat" && !activeChat ? t("lorebook.editor.scanTest.noChat") : undefined}
              className={cn(
                "max-w-[11rem] truncate rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors disabled:opacity-40",
                effectiveSource === option
                  ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {option === "text"
                ? t("lorebook.editor.scanTest.sourceText")
                : activeChat
                  ? t("lorebook.editor.scanTest.sourceChatNamed", { name: activeChat.name })
                  : t("lorebook.editor.scanTest.sourceChat")}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || (effectiveSource === "text" && !text.trim())}
          className="mari-editor-action mari-editor-action--compact ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[0.625rem] disabled:opacity-40"
        >
          {running ? <Spinner size="sm" /> : <Play size="0.6875rem" />}
          {t("lorebook.editor.scanTest.run")}
        </button>
      </div>
      <p className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {t("lorebook.editor.scanTest.hint")}
      </p>
      {error && <p className="text-[0.625rem] text-[var(--destructive)]">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-[0.6875rem] font-medium text-[var(--foreground)]">
            {t("lorebook.editor.scanTest.firedCount", { count: result.activated.length })}
            {effectiveSource === "chat" && (
              <span className="font-normal text-[var(--muted-foreground)]">
                {" "}
                {t("lorebook.editor.scanTest.scannedMessages", { count: result.scannedMessages })}
              </span>
            )}
          </p>
          {result.activated.length > 0 && (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
              {result.activated.map((item) => (
                <li key={item.entryId}>
                  <button
                    type="button"
                    onClick={() => onJumpToEntry(item.entryId)}
                    className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--accent)]/40"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.6875rem] font-medium">
                        {nameOf(item.entryId, item.name)}
                      </span>
                      <span className="block break-words text-[0.625rem] text-[var(--muted-foreground)]">
                        {reasonFor(item)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result.blocked.length > 0 && (
            <>
              <p className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                {t("lorebook.editor.scanTest.blockedCount", { count: result.blocked.length })}
              </p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                {result.blocked.map((item) => (
                  <li key={item.entryId}>
                    <button
                      type="button"
                      onClick={() => onJumpToEntry(item.entryId)}
                      className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--accent)]/40"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.6875rem] font-medium">
                          {nameOf(item.entryId, item.name)}
                        </span>
                        <span className="block break-words text-[0.625rem] text-[var(--muted-foreground)]">
                          {t(`lorebook.editor.scanTest.blocked.${item.reason}`, { keys: item.matchedKeys.join(", ") })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

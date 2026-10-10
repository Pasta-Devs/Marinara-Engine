import { useMemo } from "react";

import { cn } from "../../lib/utils";
import { diffLines, type DiffSegment } from "../../lib/word-diff";
import { useTranslation as useUiTranslation } from "react-i18next";

// GitHub-style unified diff: unchanged lines stay as context (once, not twice), changed lines are
// marked +/- and highlight only the words that actually moved, and long unchanged runs collapse.
function DiffSegments({ segments, text }: { segments: DiffSegment[] | undefined; text: string }) {
  if (!segments) return <>{text}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "equal" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            className={cn("rounded", seg.type === "added" ? "bg-emerald-500/35" : "bg-[var(--destructive)]/35")}
          >
            {seg.value}
          </span>
        ),
      )}
    </>
  );
}

export function UnifiedLineDiff({ before, after, className }: { before: string; after: string; className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  // The line LCS is O(m*n); a whole assembled prompt must not re-run it on an
  // unrelated re-render (a collapse toggle, a sibling card streaming).
  const hunks = useMemo(() => diffLines(before, after), [before, after]);
  return (
    <div
      className={cn(
        "max-h-56 overflow-auto rounded-md bg-[var(--background)]/70 font-mono text-[0.6875rem] leading-relaxed",
        className,
      )}
    >
      {hunks.map((hunk, h) => (
        <div key={h}>
          {hunk.skipped > 0 && (
            <div className="bg-[var(--secondary)]/40 px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              @@ {hunk.skipped} {localizeUi("ui.chat.unifiedlinediff.unchangedLine")}
              {hunk.skipped === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
            </div>
          )}
          {hunk.lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-1.5 whitespace-pre-wrap break-words px-1.5",
                line.type === "added" && "bg-emerald-500/15",
                line.type === "removed" && "bg-[var(--destructive)]/15",
              )}
            >
              {line.type === "equal" ? null : (
                <span className="sr-only">
                  {localizeUi(line.type === "added" ? "mari.diff.addedLine" : "mari.diff.removedLine")}
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "select-none",
                  line.type === "added"
                    ? "text-emerald-500"
                    : line.type === "removed"
                      ? "text-[var(--destructive)]"
                      : "text-[var(--muted-foreground)]/50",
                )}
              >
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>
              <span className="min-w-0 flex-1 text-[var(--foreground)]">
                <DiffSegments segments={line.segments} text={line.text} />
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

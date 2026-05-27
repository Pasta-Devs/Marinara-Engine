import { useEffect, useMemo } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useMagicRewrite } from "../../hooks/use-magic-rewrite";
import { HelpTooltip } from "./HelpTooltip";

type DiffPart = { text: string; changed: boolean };
type DiffResult =
  | { skipped: true; before: string; after: string }
  | { skipped: false; before: DiffPart[]; after: DiffPart[] };

function diffWords(before: string, after: string): DiffResult {
  const beforeWords = before.match(/\S+|\s+/g) ?? [];
  const afterWords = after.match(/\S+|\s+/g) ?? [];
  if (beforeWords.length + afterWords.length > 3000) {
    return { before, after, skipped: true };
  }

  const dp = Array.from(
    { length: beforeWords.length + 1 },
    () => new Uint16Array(afterWords.length + 1),
  );
  for (let i = 1; i <= beforeWords.length; i++) {
    for (let j = 1; j <= afterWords.length; j++) {
      dp[i][j] =
        beforeWords[i - 1] === afterWords[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const deleted = new Uint8Array(beforeWords.length);
  const added = new Uint8Array(afterWords.length);
  let i = beforeWords.length;
  let j = afterWords.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeWords[i - 1] === afterWords[j - 1]) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      added[--j] = 1;
    } else {
      deleted[--i] = 1;
    }
  }

  return {
    skipped: false,
    before: beforeWords.map((word, index) => ({
      text: word,
      changed: deleted[index] === 1,
    })),
    after: afterWords.map((word, index) => ({
      text: word,
      changed: added[index] === 1,
    })),
  };
}

export function MagicRewritePanel({
  value,
  onResultChange,
}: {
  value: string;
  onResultChange: (value: string) => void;
}) {
  const { instruction, setInstruction, result, loading, error, generate } =
    useMagicRewrite(value);
  const diff = useMemo(
    () => (result ? diffWords(value, result) : null),
    [value, result],
  );

  useEffect(() => {
    onResultChange(result);
  }, [onResultChange, result]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(12rem,1fr)]">
        <div className="flex min-w-0 flex-col">
          <div className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Rewrite instructions{" "}
            <HelpTooltip text="Uses your default agent connection." />
          </div>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder='e.g. "Make this more vivid and dramatic..."'
            className="min-h-0 flex-1 resize-none rounded-xl bg-[var(--secondary)] p-3 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>

        <div className="flex min-h-0 flex-col">
          {error && <p className="mb-3 text-xs text-red-300">{error}</p>}
          <div className="mt-auto">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size="1rem" className="animate-spin" />
              ) : (
                <Sparkles size="1rem" />
              )}
              {loading ? "Rewriting..." : "Generate Rewrite"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="min-h-0 overflow-auto rounded-xl bg-[var(--secondary)] p-3 text-sm ring-1 ring-[var(--border)]">
          <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Before
          </div>
          <div className="whitespace-pre-wrap break-words font-sans">
            {diff && !diff.skipped && Array.isArray(diff.before)
              ? diff.before.map((part, index) => (
                  <span
                    key={index}
                    className={
                      part.changed
                        ? "bg-red-500/20 text-red-200 line-through"
                        : undefined
                    }
                  >
                    {part.text}
                  </span>
                ))
              : value}
          </div>
        </div>
        <div className="min-h-0 overflow-auto rounded-xl bg-[var(--secondary)] p-3 text-sm ring-1 ring-[var(--border)]">
          <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            After
          </div>
          <div className="whitespace-pre-wrap break-words font-sans">
            {diff && !diff.skipped && Array.isArray(diff.after)
              ? diff.after.map((part, index) => (
                  <span
                    key={index}
                    className={
                      part.changed
                        ? "bg-emerald-500/20 text-emerald-200"
                        : undefined
                    }
                  >
                    {part.text}
                  </span>
                ))
              : result || "Generated rewrite will appear here."}
          </div>
        </div>
      </div>
    </div>
  );
}

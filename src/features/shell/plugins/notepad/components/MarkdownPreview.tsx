import { CheckSquare } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../../../shared/lib/utils";

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    const key = `${keyPrefix}-${tokenIndex++}`;
    if (raw.startsWith("**") && raw.endsWith("**")) {
      nodes.push(<strong key={key}>{renderInlineMarkdown(raw.slice(2, -2), key)}</strong>);
    } else if (raw.startsWith("__") && raw.endsWith("__")) {
      nodes.push(<u key={key}>{renderInlineMarkdown(raw.slice(2, -2), key)}</u>);
    } else if (raw.startsWith("~~") && raw.endsWith("~~")) {
      nodes.push(<s key={key}>{renderInlineMarkdown(raw.slice(2, -2), key)}</s>);
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono text-[0.82em]">
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      nodes.push(<em key={key}>{renderInlineMarkdown(raw.slice(1, -1), key)}</em>);
    } else {
      const link = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      nodes.push(
        link ? (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--primary)] underline underline-offset-2"
          >
            {link[1]}
          </a>
        ) : (
          raw
        ),
      );
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function MarkdownPreview({
  value,
  onToggleChecklist,
}: {
  value: string;
  onToggleChecklist: (lineIndex: number) => void;
}) {
  const lines = value.split(/\r?\n/);
  if (!value.trim()) return <p className="text-[var(--muted-foreground)]">Nothing here yet.</p>;

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const content = renderInlineMarkdown(heading[2], `heading-${index}`);
          if (heading[1].length === 1) {
            return (
              <h3 key={index} className="text-sm font-semibold text-[var(--foreground)]">
                {content}
              </h3>
            );
          }
          if (heading[1].length === 2) {
            return (
              <h4 key={index} className="text-sm font-semibold text-[var(--foreground)]">
                {content}
              </h4>
            );
          }
          return (
            <h5 key={index} className="text-sm font-semibold text-[var(--foreground)]">
              {content}
            </h5>
          );
        }
        const checklist = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
        if (checklist) {
          const checked = checklist[1].toLowerCase() === "x";
          return (
            <div key={index} className="flex items-start gap-2">
              <button
                type="button"
                aria-label={checked ? "Mark unchecked" : "Mark checked"}
                title={checked ? "Mark unchecked" : "Mark checked"}
                onClick={() => onToggleChecklist(index)}
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                  checked
                    ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--background)] text-transparent",
                )}
              >
                <CheckSquare size="0.75rem" />
              </button>
              <span className={cn("min-w-0", checked && "text-[var(--muted-foreground)] line-through")}>
                {renderInlineMarkdown(checklist[2], `check-${index}`)}
              </span>
            </div>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="grid grid-cols-[0.9rem_minmax(0,1fr)] gap-1">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--primary)]/80" />
              <span>{renderInlineMarkdown(bullet[1], `bullet-${index}`)}</span>
            </div>
          );
        }
        const quote = line.match(/^\s*>\s+(.+)$/);
        if (quote) {
          return (
            <blockquote key={index} className="border-l border-[var(--primary)]/45 pl-2 text-[var(--muted-foreground)]">
              {renderInlineMarkdown(quote[1], `quote-${index}`)}
            </blockquote>
          );
        }
        return <p key={index}>{renderInlineMarkdown(line, `line-${index}`)}</p>;
      })}
    </div>
  );
}

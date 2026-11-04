// ──────────────────────────────────────────────
// Lorebook Editor: "Check lorebook" panel
// Runs the shared lint analyzer over the entries already loaded in the
// editor. Collapsed by default; the analysis only runs while it is open.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ListChecks } from "lucide-react";
import {
  LOREBOOK_LINT_DEFAULT_MAX_ENTRY_TOKENS,
  lintLorebookEntries,
  type LorebookEntry,
  type LorebookLintIssue,
  type LorebookLintSeverity,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

const PAGE_SIZE = 150;
const SEVERITIES: LorebookLintSeverity[] = ["error", "warning", "info"];

const SEVERITY_DOT: Record<LorebookLintSeverity, string> = {
  error: "bg-[var(--destructive)]",
  warning: "bg-amber-400",
  info: "bg-[var(--muted-foreground)]",
};

interface Props {
  entries: LorebookEntry[];
  onJumpToEntry: (entryId: string) => void;
  /** UI overhaul: opened from the Check lorebook tool, so it starts open. */
  defaultOpen?: boolean;
}

export function LorebookLintPanel({ entries, onJumpToEntry, defaultOpen = false }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [severityFilter, setSeverityFilter] = useState<LorebookLintSeverity | "all">("all");
  const [maxTokens, setMaxTokens] = useState(LOREBOOK_LINT_DEFAULT_MAX_ENTRY_TOKENS);
  const [maxTokensDraft, setMaxTokensDraft] = useState(String(LOREBOOK_LINT_DEFAULT_MAX_ENTRY_TOKENS));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const issues = useMemo(
    () => (open ? lintLorebookEntries(entries, { maxEntryTokens: maxTokens }) : []),
    [entries, maxTokens, open],
  );
  const counts = useMemo(() => {
    const result: Record<LorebookLintSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) result[issue.severity]++;
    return result;
  }, [issues]);
  const filtered = useMemo(
    () => (severityFilter === "all" ? issues : issues.filter((issue) => issue.severity === severityFilter)),
    [issues, severityFilter],
  );
  const nameById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry.name])), [entries]);

  const describe = (issue: LorebookLintIssue) => {
    const related = (issue.relatedEntryIds ?? []).map(
      (id) => nameById.get(id) || t("lorebook.editor.lint.untitledEntry"),
    );
    const names =
      related.length > 3
        ? t("lorebook.editor.lint.namesAndMore", { names: related.slice(0, 3).join(", "), count: related.length - 3 })
        : related.join(", ");
    return t(`lorebook.editor.lint.code.${issue.code}`, {
      key: issue.key ?? "",
      names,
      tokens: issue.tokens?.toLocaleString() ?? "",
      limit: maxTokens.toLocaleString(),
    });
  };

  return (
    <div className="mari-editor-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--accent)]/30"
        aria-expanded={open}
      >
        <ListChecks size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated shrink-0" />
        <span className="flex-1">{t("lorebook.editor.lint.title")}</span>
        {open && issues.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
            {SEVERITIES.filter((severity) => counts[severity] > 0).map((severity) => (
              <span key={severity} className="inline-flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[severity])} />
                {counts[severity]}
              </span>
            ))}
          </span>
        )}
        <ChevronDown
          size="0.8125rem"
          className={cn(
            "shrink-0 text-[var(--muted-foreground)] transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-[var(--marinara-editor-divider)] px-3 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", ...SEVERITIES] as const).map((severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => {
                  setSeverityFilter(severity);
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-pressed={severityFilter === severity}
                className={cn(
                  "mari-editor-action mari-editor-action--compact inline-flex items-center gap-1 px-2 py-1 text-[0.625rem]",
                  severityFilter === severity &&
                    "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]",
                )}
              >
                {severity !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[severity])} />}
                {t(`lorebook.editor.lint.severity.${severity}`)}
                <span className="opacity-60">{severity === "all" ? issues.length : counts[severity]}</span>
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {t("lorebook.editor.lint.tokenLimit")}
              <input
                type="number"
                min={50}
                step={50}
                value={maxTokensDraft}
                onChange={(event) => {
                  // Keep what is typed (clamping each keystroke made "2000" impossible to type);
                  // the check uses the last valid value of at least 50.
                  setMaxTokensDraft(event.target.value);
                  const parsed = parseInt(event.target.value, 10);
                  if (Number.isFinite(parsed) && parsed >= 50) setMaxTokens(parsed);
                }}
                onBlur={() => setMaxTokensDraft(String(maxTokens))}
                className="mari-editor-field w-20 px-2 py-1 text-[0.6875rem]"
              />
            </label>
          </div>

          {issues.length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("lorebook.editor.lint.clean", { count: entries.length })}
            </p>
          ) : (
            <ul className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
              {filtered.slice(0, visibleCount).map((issue, index) => (
                <li key={`${issue.entryId}:${issue.code}:${issue.key ?? ""}:${index}`}>
                  <button
                    type="button"
                    onClick={() => onJumpToEntry(issue.entryId)}
                    title={t("lorebook.editor.lint.jump")}
                    className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--accent)]/40"
                  >
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[issue.severity])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground)]">
                        {issue.entryName || t("lorebook.editor.lint.untitledEntry")}
                      </span>
                      <span className="block break-words text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                        {describe(issue)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length > visibleCount && (
                <li>
                  <button
                    type="button"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    className="w-full rounded-lg px-2 py-1.5 text-center text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/40 hover:text-[var(--foreground)]"
                  >
                    {t("lorebook.editor.lint.showMore", { count: filtered.length - visibleCount })}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Theme editor checks (theming round 2, batch 3)
//
// Under the CSS box: what the browser won't read (with line numbers, as you type), and what the
// chrome guard found in the preview or when you pressed Save.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { lintThemeCss, type CssLintIssue } from "../../../lib/theme-css-lint";
import type { ThemeGuardProblem } from "../../../lib/theme-safety";
import { problemText } from "../../layout/ThemeSafetyHost";
import { SETTINGS_BUTTON_CLASS } from "./SettingControls";

const LINT_DELAY_MS = 350;
const SHOWN_ISSUES = 8;

function useCssLint(css: string) {
  const [issues, setIssues] = useState<CssLintIssue[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setIssues(lintThemeCss(css)), LINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [css]);
  return issues;
}

export function ThemeEditorChecks({
  css,
  previewProblems,
  saveProblems,
  onSaveAnyway,
  onJumpToLine,
}: {
  css: string;
  previewProblems: ThemeGuardProblem[];
  saveProblems: ThemeGuardProblem[];
  onSaveAnyway: () => void;
  onJumpToLine: (line: number) => void;
}) {
  const { t } = useTranslation();
  const issues = useCssLint(css);

  const lintText = (issue: CssLintIssue) => {
    const subject = issue.subject ?? "";
    switch (issue.code) {
      case "unclosed-block":
        return t("theming.lint.unclosedBlock", "This { is never closed with }.");
      case "extra-brace":
        return t("theming.lint.extraBrace", "This } has no { to close.");
      case "unclosed-comment":
        return t(
          "theming.lint.unclosedComment",
          "This comment is never closed with */. Everything after it is ignored.",
        );
      case "unclosed-string":
        return t("theming.lint.unclosedString", "A quote opened on this line is never closed.");
      case "bad-selector":
        return t(
          "theming.lint.badSelector",
          "The browser can't read the selector {{subject}}, so this rule is skipped.",
          {
            subject,
          },
        );
      case "missing-colon":
        return t("theming.lint.missingColon", "Expected property: value, found {{subject}}.", { subject });
      case "unknown-property":
        return t("theming.lint.unknownProperty", "{{subject}} isn't a CSS property this browser knows.", { subject });
      case "bad-value":
        return t("theming.lint.badValue", "The value for {{subject}} isn't valid, so it's skipped.", { subject });
      case "missing-semicolon":
        return t("theming.lint.missingSemicolon", "The {{subject}} line is missing a ; at its end.", { subject });
      case "hsl-triplet":
        return t(
          "theming.lint.hslTriplet",
          "{{subject}} needs a full colour such as hsl(270 25% 8%) or #1b1530, not a bare triplet.",
          { subject },
        );
    }
  };

  const guard = saveProblems.length > 0 ? saveProblems : previewProblems;

  return (
    <div className="flex flex-col gap-2" data-theme-editor-checks="true">
      {guard.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)] ring-1 ring-[var(--destructive)]/30"
        >
          <p className="font-medium">
            {saveProblems.length > 0
              ? t(
                  "theming.editor.saveBlocked",
                  "Not saved: this CSS breaks a part every theme must leave in place. Themes can restyle these parts, but not hide, move or cover them.",
                )
              : t(
                  "theming.editor.previewPaused",
                  "Preview paused: this CSS hides, moves or covers the top bar or a sidebar. Themes can restyle them, but not remove them.",
                )}
          </p>
          <ul className="list-disc pl-4">
            {guard.map((problem, index) => (
              <li key={`${problem.area}-${problem.kind}-${index}`}>{problemText(t, problem)}</li>
            ))}
          </ul>
          {saveProblems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onSaveAnyway} className={SETTINGS_BUTTON_CLASS}>
                {t("theming.editor.saveAnyway", "Save anyway")}
              </button>
              <span className="text-[var(--muted-foreground)]">
                {t(
                  "theming.editor.saveAnywayHint",
                  "It is saved, but switched off whenever it breaks one of these parts.",
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div
        className="rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.6875rem] ring-1 ring-[var(--border)]"
        aria-live="polite"
      >
        {issues.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <CheckCircle2 size="0.75rem" aria-hidden="true" />
            {t("theming.lint.clean", "No CSS problems found.")}
          </p>
        ) : (
          <>
            <p className="mb-1 flex items-center gap-1.5 font-medium text-[var(--foreground)]">
              <AlertTriangle size="0.75rem" className="text-[var(--mari-gauge-warn,#eab308)]" aria-hidden="true" />
              {t("theming.lint.count", "{{count}} CSS problems the browser will skip", { count: issues.length })}
            </p>
            <ul className="flex flex-col gap-0.5">
              {issues.slice(0, SHOWN_ISSUES).map((issue, index) => (
                <li key={`${issue.line}-${issue.code}-${index}`} className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onJumpToLine(issue.line)}
                    className="shrink-0 font-mono text-[var(--primary)] underline-offset-2 hover:underline"
                  >
                    {t("theming.lint.line", "Line {{line}}", { line: issue.line })}
                  </button>
                  <span className="text-[var(--muted-foreground)]">{lintText(issue)}</span>
                </li>
              ))}
            </ul>
            {issues.length > SHOWN_ISSUES && (
              <p className="mt-1 text-[var(--muted-foreground)]">
                {t("theming.lint.more", "+{{count}} more", { count: issues.length - SHOWN_ISSUES })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Theme import preview (theming panel, batch 4)
//
// Shown before a theme file is installed: what it is, who made it, what's wrong with it, and
// which of its suggested Appearance settings to apply. A theme with the same name as an installed
// one is offered as an update instead of a second copy.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ImageIcon, Type, Wand2 } from "lucide-react";
import type { Theme } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { extractImportantThemeCss, sanitizeAppCss } from "../../../lib/theme-css";
import { checkProtectedChrome } from "../../../lib/theme-guard";
import type { ThemeGuardProblem } from "../../../lib/theme-safety";
import {
  convertHslTriplets,
  formatKiB,
  themeSettingKeys,
  validateThemePackage,
  type ThemePackage,
  type ThemeSettingKey,
} from "../../../lib/theme-package";
import { SETTINGS_BUTTON_CLASS, SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS } from "./SettingControls";

/** Variable names wrap at the comma, not at their own hyphens. */
const keepTogether = (text: string) => text.replace(/-/g, "\u2011");

export interface ThemeInstallChoice {
  pkg: ThemePackage;
  /** Update this installed theme instead of adding a new one. */
  replaceId: string | null;
  settingsKeys: ThemeSettingKey[];
  addBackgrounds: boolean;
  activate: boolean;
}

/** Hidden, moved or covered chrome, measured with the theme switched on for one frame-less task. */
function useChromeCheck(css: string) {
  const [problems, setProblems] = useState<ThemeGuardProblem[]>([]);
  useEffect(() => {
    const sanitized = sanitizeAppCss(css);
    const sheets: HTMLStyleElement[] = [];
    for (const text of [sanitized, extractImportantThemeCss(sanitized)]) {
      if (!text) continue;
      const style = document.createElement("style");
      style.media = "not all";
      style.dataset.mariCustomCss = "import-check";
      style.textContent = text;
      document.head.appendChild(style);
      sheets.push(style);
    }
    setProblems(checkProtectedChrome(sheets));
    sheets.forEach((sheet) => sheet.remove());
  }, [css]);
  return problems;
}

export function ThemeImportPreview({
  pkg: initialPkg,
  metaProblems,
  installed,
  remaining,
  busy,
  onInstall,
  onSkip,
}: {
  pkg: ThemePackage;
  metaProblems: string[];
  installed: Theme[];
  /** Themes still waiting after this one, from the same file. */
  remaining: number;
  busy: boolean;
  onInstall: (choice: ThemeInstallChoice) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const [pkg, setPkg] = useState(initialPkg);
  useEffect(() => setPkg(initialPkg), [initialPkg]);
  const issues = useMemo(() => validateThemePackage({ ...pkg, metaProblems }), [pkg, metaProblems]);
  const chromeProblems = useChromeCheck(pkg.css);
  const sameName = installed.find((theme) => theme.name === pkg.name) ?? null;
  const settingKeys = themeSettingKeys(pkg.meta.settings);
  const [chosenSettings, setChosenSettings] = useState<ThemeSettingKey[]>([]);
  const [addBackgrounds, setAddBackgrounds] = useState(false);
  const blocking = issues.some((issue) => issue.kind === "css-too-big" || issue.kind === "meta-too-big");
  const meta = pkg.meta;
  const scheme = meta.colorScheme;

  const settingLabel = (key: ThemeSettingKey) => {
    const value = meta.settings?.[key];
    const shown = typeof value === "boolean" ? "" : `: ${String(value)}`;
    const label = {
      colorScheme: t("theming.import.setting.colorScheme", "Color scheme"),
      visualStyle: t("theming.import.setting.visualStyle", "Visual style"),
      accent: t("theming.import.setting.accent", "Accent (Dark)"),
      accentLight: t("theming.import.setting.accentLight", "Accent (Light)"),
      background: t("theming.import.setting.background", "Background (Dark)"),
      backgroundLight: t("theming.import.setting.backgroundLight", "Background (Light)"),
      fontFamily: t("theming.import.setting.fontFamily", "Font"),
      accentPulse: t("theming.import.setting.accentPulse", "Accent Pulse on"),
    }[key];
    return `${label}${shown}`;
  };

  const issueText = (issue: (typeof issues)[number]) => {
    switch (issue.kind) {
      case "css-too-big":
        return t(
          "theming.import.issue.cssTooBig",
          "The CSS is {{size}}; the limit is {{limit}}. Compress images or subset fonts.",
          {
            size: formatKiB(issue.bytes),
            limit: formatKiB(issue.limit),
          },
        );
      case "meta-too-big":
        return t(
          "theming.import.issue.metaTooBig",
          "Its thumbnail, fonts and backgrounds come to {{size}}; the limit is {{limit}}.",
          { size: formatKiB(issue.bytes), limit: formatKiB(issue.limit) },
        );
      case "hsl-triplets":
        return t(
          "theming.import.issue.hslTriplets",
          "{{names}} use bare HSL numbers (like 270 25% 8%), which aren't colours here, so they'd be ignored.",
          { names: keepTogether(issue.names.slice(0, 4).join(", ") + (issue.names.length > 4 ? "…" : "")) },
        );
      case "bad-colors":
        return t("theming.import.issue.badColors", "{{names}} aren't valid colours, so they'd be ignored.", {
          names: keepTogether(issue.names.slice(0, 4).join(", ")),
        });
      case "unknown-hook":
        return t("theming.import.issue.unknownHook", "{{selector}} doesn't exist in Marinara; use {{suggestion}}.", {
          selector: issue.selector,
          suggestion: issue.suggestion,
        });
      case "hides-protected":
        return t(
          "theming.import.issue.hidesProtected",
          "{{selector}} tries to hide or move the top bar, a sidebar or Ctrl+K. Marinara keeps those in place, so that part won't work.",
          { selector: issue.selector },
        );
      case "bad-meta":
        return t("theming.import.issue.badMeta", "Part of the file was left out: {{message}}", {
          message: issue.message,
        });
    }
  };

  const install = (replaceId: string | null, activate: boolean) =>
    onInstall({ pkg, replaceId, settingsKeys: chosenSettings, addBackgrounds, activate });

  return (
    <div
      className="flex flex-col gap-2.5 rounded-lg p-3 text-xs ring-1 ring-[var(--border)] bg-[var(--secondary)]/50"
      data-theme-import-preview="true"
    >
      <div className="flex gap-3">
        <div
          className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--muted)] ring-1 ring-[var(--border)]"
          aria-hidden="true"
        >
          {meta.thumbnail ? (
            <img src={meta.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size="1.25rem" className="text-[var(--muted-foreground)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--foreground)]">{pkg.name}</div>
          <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {[
              meta.author ? t("theming.import.by", "by {{author}}", { author: meta.author }) : null,
              meta.version ? `v${meta.version}` : null,
              scheme === "dark"
                ? t("theming.import.forDark", "for Dark")
                : scheme === "light"
                  ? t("theming.import.forLight", "for Light")
                  : scheme === "both"
                    ? t("theming.import.forBoth", "for Dark and Light")
                    : null,
              formatKiB(new Blob([pkg.css]).size),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {meta.description ? (
            <p className="mt-1 line-clamp-3 text-[0.6875rem] text-[var(--muted-foreground)]">{meta.description}</p>
          ) : null}
          {meta.fonts?.length ? (
            <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              <Type size="0.75rem" />
              {t("theming.import.fonts", "Brings its fonts: {{fonts}}", {
                fonts: meta.fonts.map((font) => font.family).join(", "),
              })}
            </p>
          ) : null}
        </div>
      </div>

      {issues.length > 0 || chromeProblems.length > 0 ? (
        <ul className="flex flex-col gap-1" role="list">
          {chromeProblems.length > 0 ? (
            <li className="flex items-start gap-1.5 text-[var(--destructive)]">
              <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0" />
              {t(
                "theming.import.issue.hidesChrome",
                "It hides, moves or covers the top bar or a sidebar. It will be switched off as soon as it does.",
              )}
            </li>
          ) : null}
          {issues.map((issue, index) => (
            <li
              key={`${issue.kind}-${index}`}
              className={cn(
                "flex flex-wrap items-start gap-1.5",
                issue.kind === "css-too-big" || issue.kind === "meta-too-big"
                  ? "text-[var(--destructive)]"
                  : "text-[var(--foreground)]",
              )}
            >
              <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">{issueText(issue)}</span>
              {issue.kind === "hsl-triplets" ? (
                <button
                  type="button"
                  className={SETTINGS_BUTTON_CLASS}
                  onClick={() => setPkg((current) => ({ ...current, css: convertHslTriplets(current.css) }))}
                >
                  <Wand2 size="0.75rem" />
                  {t("theming.import.convertHsl", "Convert to hsl()")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
          <Check size="0.75rem" />
          {t("theming.import.noIssues", "No problems found.")}
        </p>
      )}

      {settingKeys.length > 0 || meta.backgrounds?.length ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-[0.6875rem] font-medium text-[var(--foreground)]">
            {t("theming.import.applyTooTitle", "Apply its settings too?")}
          </legend>
          {settingKeys.map((key) => (
            <label key={key} className="flex items-center gap-2 text-[0.6875rem]">
              <input
                type="checkbox"
                checked={chosenSettings.includes(key)}
                onChange={(event) =>
                  setChosenSettings((current) =>
                    event.target.checked ? [...current, key] : current.filter((item) => item !== key),
                  )
                }
              />
              <span className="truncate">{settingLabel(key)}</span>
            </label>
          ))}
          {meta.backgrounds?.length ? (
            <label className="flex items-center gap-2 text-[0.6875rem]">
              <input
                type="checkbox"
                checked={addBackgrounds}
                onChange={(event) => setAddBackgrounds(event.target.checked)}
              />
              {t("theming.import.addBackgrounds", "Add its backgrounds to the gallery ({{count}})", {
                count: meta.backgrounds.length,
              })}
            </label>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {remaining > 0 ? (
          <span className="mr-auto text-[0.625rem] text-[var(--muted-foreground)]">
            {t("theming.import.more", "{{count}} more in this file", { count: remaining })}
          </span>
        ) : null}
        <button type="button" className={SETTINGS_BUTTON_CLASS} onClick={onSkip} disabled={busy}>
          {remaining > 0 ? t("theming.import.skip", "Skip") : t("theming.import.cancel", "Cancel")}
        </button>
        {sameName ? (
          <>
            <button
              type="button"
              className={SETTINGS_BUTTON_CLASS}
              disabled={busy || blocking}
              onClick={() => install(null, false)}
            >
              {t("theming.import.keepBoth", "Keep both")}
            </button>
            <button
              type="button"
              className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}
              disabled={busy || blocking}
              onClick={() => install(sameName.id, sameName.isActive)}
            >
              {t("theming.import.update", "Update “{{name}}”", { name: sameName.name })}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={SETTINGS_BUTTON_CLASS}
              disabled={busy || blocking}
              onClick={() => install(null, false)}
            >
              {t("theming.import.install", "Install")}
            </button>
            <button
              type="button"
              className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}
              disabled={busy || blocking}
              onClick={() => install(null, true)}
            >
              {t("theming.import.installAndTry", "Install and try it")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

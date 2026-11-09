// ──────────────────────────────────────────────
// Theme import preview (theming panel, batch 4)
//
// Shown before a theme file is installed: what it is, who made it, what's wrong with it, and
// which of its suggested Appearance settings to apply. A theme with the same name as an installed
// one is offered as an update instead of a second copy.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Film, ImageIcon, Images, Loader2, Type, Wand2 } from "lucide-react";
import type { Theme } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { checkThemeCssReady } from "../../../lib/theme-guard";
import { SMALL_INLINE_IMAGE_BYTES, summarizeThemeImages, type ThemeImage } from "../../../lib/theme-images";
import type { ThemeGuardProblem } from "../../../lib/theme-safety";
import { problemText } from "../../layout/ThemeSafetyHost";
import {
  convertHslTriplets,
  formatKiB,
  formatSize,
  optimizeThemePackage,
  themePackageBytes,
  themeSettingKeys,
  type OptimizedThemePackage,
  validateThemePackage,
  type ThemePackage,
  type ThemeSettingKey,
} from "../../../lib/theme-package";
import { SETTINGS_BUTTON_CLASS, SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS } from "./SettingControls";
import { useUIStore } from "../../../stores/ui.store";
import { ThemeCreditsSummary, ThemeLabels } from "./ThemeCredits";

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

/** Hidden, moved or covered chrome, measured with the theme switched on for one task (its pictures sampled first). */
function useChromeCheck(css: string, images: ThemeImage[] | undefined) {
  const [problems, setProblems] = useState<ThemeGuardProblem[]>([]);
  useEffect(() => {
    let alive = true;
    void checkThemeCssReady(css, images).then((found) => alive && setProblems(found));
    return () => {
      alive = false;
    };
  }, [css, images]);
  return problems;
}

const UNTICKED_SETTINGS = new Set<ThemeSettingKey>(["visualStyle", "accentPulse", "fontSize", "reduceMotion"]);

function preTickedSettings(keys: ThemeSettingKey[]) {
  return keys.filter((key) => !UNTICKED_SETTINGS.has(key));
}

/** "1.2" vs "1.10": true when `incoming` is a lower version than `installed`. */
function olderThanInstalled(incoming: string | undefined, installed: string | undefined) {
  if (!incoming || !installed) return false;
  const a = incoming.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = installed.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
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
  const [original, setPkg] = useState(initialPkg);
  useEffect(() => setPkg(initialPkg), [initialPkg]);
  // Pictures are moved out of the CSS and re-saved as WebP before anything is installed; the
  // original file can still be kept as it is.
  const [optimized, setOptimized] = useState<OptimizedThemePackage | null>(null);
  const [keepOriginals, setKeepOriginals] = useState(false);
  useEffect(() => {
    let alive = true;
    setOptimized(null);
    void optimizeThemePackage(original)
      .then((result) => alive && setOptimized(result))
      .catch(() => alive && setOptimized({ pkg: original, moved: 0, shrunk: 0, before: 0, after: 0 }));
    return () => {
      alive = false;
    };
  }, [original]);
  const optimizing = optimized === null;
  const pkg = keepOriginals || !optimized ? original : optimized.pkg;
  const issues = useMemo(() => validateThemePackage({ ...pkg, metaProblems }), [pkg, metaProblems]);
  const chromeProblems = useChromeCheck(pkg.css, pkg.meta.images);
  const allPictures = useMemo(() => summarizeThemeImages(pkg.css, pkg.meta.images), [pkg]);
  // Tiny pictures (masks, icons), inline or in the theme's images, are listed as one "small icons"
  // chip (round 6: a theme's own images[] SVGs folded in too); hovering it names them all.
  const smallIcons = allPictures.filter((picture) => !picture.animated && picture.bytes < SMALL_INLINE_IMAGE_BYTES);
  const pictures = allPictures.filter((picture) => !smallIcons.includes(picture));
  const optimizedSomething =
    !!optimized && (optimized.moved > 0 || optimized.shrunk > 0) && optimized.after < optimized.before;
  const sameName = installed.find((theme) => theme.name === pkg.name) ?? null;
  const settingKeys = themeSettingKeys(pkg.meta.settings);
  // The theme's own look (its day/night switch, colours and font) starts ticked so a stranger gets
  // what the author made; matters of taste and need (visual style, Display Size, Reduce motion,
  // Accent Pulse) start unticked.
  const [chosenSettings, setChosenSettings] = useState<ThemeSettingKey[]>(() => preTickedSettings(settingKeys));
  const settingsSignature = settingKeys.join(",");
  useEffect(() => {
    setChosenSettings(preTickedSettings(settingsSignature ? (settingsSignature.split(",") as ThemeSettingKey[]) : []));
  }, [settingsSignature]);
  const [addBackgrounds, setAddBackgrounds] = useState(false);
  const allowThemeHtml = useUIStore((s) => s.allowThemeHtml);
  // A theme with HTML installs only after the user turned on "Allow themes with HTML".
  const htmlBlocked = !allowThemeHtml && issues.some((issue) => issue.kind === "has-html");
  const blocking =
    optimizing || htmlBlocked || issues.some((issue) => issue.kind === "css-too-big" || issue.kind === "meta-too-big");
  const meta = pkg.meta;
  const scheme = meta.colorScheme;

  const settingLabel = (key: ThemeSettingKey) => {
    const value = meta.settings?.[key];
    const shown =
      typeof value === "boolean"
        ? `: ${value ? t("theming.import.on", "on") : t("theming.import.off", "off")}`
        : key === "fontSize"
          ? `: ${String(value)} px`
          : key === "colorScheme" && value === "time"
            ? `: ${t("theming.import.followTime", "Follow time of day ({{day}} light, {{night}} dark)", {
                day: meta.settings?.dayStart ?? "07:00",
                night: meta.settings?.nightStart ?? "19:00",
              })}`
            : key === "colorScheme" && value === "system"
              ? `: ${t("theming.import.followSystem", "Follow system")}`
              : `: ${String(value)}`;
    const label = {
      colorScheme: t("theming.import.setting.colorScheme", "Color scheme"),
      visualStyle: t("theming.import.setting.visualStyle", "Visual style"),
      accent: t("theming.import.setting.accent", "Accent (Dark)"),
      accentLight: t("theming.import.setting.accentLight", "Accent (Light)"),
      background: t("theming.import.setting.background", "Background (Dark)"),
      backgroundLight: t("theming.import.setting.backgroundLight", "Background (Light)"),
      fontFamily: t("theming.import.setting.fontFamily", "Font"),
      accentPulse: t("theming.import.setting.accentPulseName", "Accent Pulse"),
      dayStart: t("theming.import.setting.dayStart", "Light from"),
      nightStart: t("theming.import.setting.nightStart", "Dark from"),
      fontSize: t("theming.import.setting.fontSize", "Display Size"),
      reduceMotion: t("theming.import.setting.reduceMotion", "Reduce motion"),
    }[key];
    return `${label}${shown}`;
  };

  const issueText = (issue: (typeof issues)[number]) => {
    switch (issue.kind) {
      case "css-too-big":
        return t(
          "theming.import.issue.cssTooBig",
          "The CSS is {{size}}; the limit is {{limit}}. Pictures don't count once they're in the theme's images, so this is the CSS itself: subset fonts or trim rules.",
          {
            size: formatKiB(issue.bytes),
            limit: formatKiB(issue.limit),
          },
        );
      case "meta-too-big":
        return t(
          "theming.import.issue.metaTooBig",
          "Its pictures, thumbnail, fonts and backgrounds come to {{size}}; the limit is {{limit}}.",
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
      case "adds-text":
        return t("theming.import.issue.addsText", "It adds this text to the page: {{texts}}", {
          texts: issue.texts.map((text) => `“${text}”`).join(", "),
        });
      case "asks-secrets":
        return t(
          "theming.import.issue.asksSecrets",
          "It writes text that asks for private details: “{{text}}”. Marinara switches it off when that text shows in a chat. Never paste keys or passwords because a theme asks.",
          { text: issue.text },
        );
      case "a11y":
        return t(
          "theming.import.issue.a11y",
          "It tries to change your accessibility settings ({{what}}). Your choices in Appearance > Accessibility still win.",
          { what: issue.what.join(", ") },
        );
      case "has-html":
        return allowThemeHtml
          ? t(
              "theming.import.issue.hasHtml",
              "This theme adds HTML to every message (a message template). Marinara strips scripts, links, images and forms, but HTML from someone else is still a risk you accepted in CSS Themes.",
            )
          : t(
              "theming.import.issue.hasHtmlBlocked",
              "This theme adds HTML to every message, so it can't be installed. To accept the risk, turn on Allow themes with HTML in CSS Themes, then import it again.",
            );
      case "bad-meta":
        return t("theming.import.issue.badMeta", "Part of the file was left out: {{message}}", {
          message: issue.message,
        });
      case "animated":
        return t(
          "theming.import.issue.animated",
          "This theme has moving pictures ({{count}}). With Reduce motion on, they show as still frames.",
          { count: issue.count },
        );
      case "missing-images":
        return t(
          "theming.import.issue.missingImages",
          "Its CSS uses pictures the file doesn't carry, so they won't show: {{names}}",
          { names: issue.names.slice(0, 4).join(", ") },
        );
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
              allPictures.length
                ? t("theming.import.sizeWithPictures", "{{total}} ({{css}} CSS + {{count}} pictures)", {
                    total: formatSize(themePackageBytes(pkg)),
                    css: formatKiB(new Blob([pkg.css]).size),
                    count: allPictures.length,
                  })
                : formatSize(themePackageBytes(pkg)),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <ThemeLabels meta={meta} className="mt-1 flex flex-wrap gap-1" />
          {meta.description ? (
            <p className="mt-1 line-clamp-3 text-[0.6875rem] text-[var(--muted-foreground)]">{meta.description}</p>
          ) : null}
          {meta.fonts?.length ? (
            <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              <Type size="0.75rem" />
              {t("theming.import.fonts", "Brings its fonts: {{fonts}}", {
                fonts: [...new Set(meta.fonts.map((font) => font.family))].join(", "),
              })}
            </p>
          ) : null}
          <div className="mt-1">
            <ThemeCreditsSummary name={pkg.name} meta={meta} />
          </div>
        </div>
      </div>

      {allPictures.length > 0 || optimizing ? (
        <div className="flex flex-col gap-1" data-theme-import-pictures="true">
          <div className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-[var(--foreground)]">
            <Images size="0.75rem" />
            {t("theming.import.pictures", "Pictures")}
            {optimizing ? (
              <span className="flex items-center gap-1 font-normal text-[var(--muted-foreground)]">
                <Loader2 size="0.6875rem" className="animate-spin" />
                {t("theming.import.optimizing", "Making them lighter…")}
              </span>
            ) : optimizedSomething && !keepOriginals ? (
              <span className="font-normal text-[var(--muted-foreground)]">
                {t("theming.import.optimized", "Saved as WebP: {{before}} → {{after}}", {
                  before: formatSize(optimized!.before),
                  after: formatSize(optimized!.after),
                })}
              </span>
            ) : null}
          </div>
          {allPictures.length ? (
            <ul className="flex flex-wrap gap-1" role="list">
              {pictures.map((picture) => (
                <li
                  key={picture.name}
                  className="flex items-center gap-1 rounded bg-[var(--muted)]/60 px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]"
                >
                  {picture.animated ? <Film size="0.625rem" aria-label={t("theming.import.moving", "moving")} /> : null}
                  <span className="font-mono text-[var(--foreground)]">{picture.name}</span>
                  {formatKiB(picture.bytes)}
                </li>
              ))}
              {smallIcons.length ? (
                <li
                  className="flex items-center gap-1 rounded bg-[var(--muted)]/60 px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]"
                  title={smallIcons.map((picture) => picture.name).join(", ")}
                  data-theme-small-icons=""
                >
                  <span className="text-[var(--foreground)]">
                    {t("theming.import.smallIcons", "{{count}} small icons", { count: smallIcons.length })}
                  </span>
                  {formatKiB(smallIcons.reduce((sum, picture) => sum + picture.bytes, 0))}
                </li>
              ) : null}
            </ul>
          ) : null}
          {optimizedSomething ? (
            <label className="flex items-center gap-2 text-[0.6875rem]">
              <input
                type="checkbox"
                checked={keepOriginals}
                onChange={(event) => setKeepOriginals(event.target.checked)}
              />
              {t("theming.import.keepOriginals", "Keep the original files instead (bigger)")}
            </label>
          ) : null}
        </div>
      ) : null}

      {issues.length > 0 || chromeProblems.length > 0 ? (
        <ul className="flex flex-col gap-1" role="list">
          {chromeProblems.length > 0 ? (
            <li className="flex items-start gap-1.5 text-[var(--destructive)]">
              <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {chromeProblems.map((problem) => problemText(t, problem)).join(" ")}{" "}
                {t("theming.import.issue.switchedOff", "It will be switched off as soon as it does.")}
              </span>
            </li>
          ) : null}
          {issues.map((issue, index) => (
            <li
              key={`${issue.kind}-${index}`}
              className={cn(
                "flex flex-wrap items-start gap-1.5",
                issue.kind === "css-too-big" ||
                  issue.kind === "meta-too-big" ||
                  issue.kind === "asks-secrets" ||
                  issue.kind === "has-html"
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
            <label key={key} className="flex min-w-0 items-start gap-2 text-[0.6875rem]">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={chosenSettings.includes(key)}
                onChange={(event) =>
                  setChosenSettings((current) =>
                    event.target.checked ? [...current, key] : current.filter((item) => item !== key),
                  )
                }
              />
              <span className="min-w-0 break-words">{settingLabel(key)}</span>
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

      {sameName && olderThanInstalled(meta.version, sameName.meta?.version) ? (
        <p className="flex items-center gap-1.5 text-[var(--foreground)]">
          <AlertTriangle size="0.75rem" className="shrink-0" />
          {t("theming.import.older", "This file is older than the installed one ({{installed}}).", {
            installed: sameName.meta?.version ?? "",
          })}
        </p>
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
              {sameName.meta?.version && meta.version && sameName.meta.version !== meta.version
                ? t("theming.import.updateVersions", "Update “{{name}}” ({{from}} → {{to}})", {
                    name: sameName.name,
                    from: sameName.meta.version,
                    to: meta.version,
                  })
                : t("theming.import.update", "Update “{{name}}”", { name: sameName.name })}
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

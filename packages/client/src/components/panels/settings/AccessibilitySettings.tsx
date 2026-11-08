// ──────────────────────────────────────────────
// Settings > Appearance > Accessibility (theming panel, batch 6)
//
// Reading comfort and visibility in one place: line and letter spacing, strong focus rings, a
// high-contrast scheme that follows the OS by default, and a colour-blind-safe palette. Text size
// stays in "Fonts & text size", right above. The effects live in styles/accessibility.css.
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import { Accessibility } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../../stores/ui.store";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { SettingsSection, ToggleSetting } from "./SettingControls";

const LINE_HEIGHTS = [1, 1.6, 1.8, 2] as const;
const LETTER_SPACINGS = [0, 0.03, 0.06, 0.1] as const;
const SELECT_CLASS =
  "rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]";

export function AccessibilitySettings({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation();
  const lineHeight = useUIStore((s) => s.a11yLineHeight);
  const setLineHeight = useUIStore((s) => s.setA11yLineHeight);
  const letterSpacing = useUIStore((s) => s.a11yLetterSpacing);
  const setLetterSpacing = useUIStore((s) => s.setA11yLetterSpacing);
  const strongFocus = useUIStore((s) => s.a11yStrongFocus);
  const setStrongFocus = useUIStore((s) => s.setA11yStrongFocus);
  const contrast = useUIStore((s) => s.a11yContrast);
  const setContrast = useUIStore((s) => s.setA11yContrast);
  const colorBlindSafe = useUIStore((s) => s.a11yColorBlindSafe);
  const setColorBlindSafe = useUIStore((s) => s.setA11yColorBlindSafe);
  const reduceMotion = useUIStore((s) => s.reduceAmbientEffects);
  const setReduceMotion = useUIStore((s) => s.setReduceAmbientEffects);
  const backdropStrength = useUIStore((s) => s.a11yBackdropStrength);
  const setBackdropStrength = useUIStore((s) => s.setA11yBackdropStrength);

  const lineLabel = (value: number) =>
    value === 1
      ? t("theming.a11y.spacingDefault", "Default")
      : value === 1.6
        ? t("theming.a11y.lineRelaxed", "Relaxed (1.6)")
        : value === 1.8
          ? t("theming.a11y.lineLoose", "Loose (1.8)")
          : t("theming.a11y.lineDouble", "Double (2.0)");
  const letterLabel = (value: number) =>
    value === 0
      ? t("theming.a11y.spacingDefault", "Default")
      : value === 0.03
        ? t("theming.a11y.letterSlight", "A little wider")
        : value === 0.06
          ? t("theming.a11y.letterWide", "Wider")
          : t("theming.a11y.letterWidest", "Widest");

  return (
    <SettingsSection
      title={t("theming.a11y.title", "Accessibility")}
      description={t(
        "theming.a11y.description",
        "Spacing, focus rings, contrast and colour-blind-safe colours. Text size is in Fonts & text size, just above.",
      )}
      icon={<Accessibility size="0.875rem" />}
      anchorId={anchorId}
    >
      <div className="flex flex-col gap-3">
        <label className="flex scroll-mt-3 flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            {t("theming.a11y.lineSpacing", "Line spacing")}
            <HelpTooltip
              text={t(
                "theming.a11y.lineSpacingHelp",
                "Space between lines in messages and longer text. Menus and buttons keep their size.",
              )}
            />
          </span>
          <select
            id="settings-control-a11y-line-spacing"
            value={String(lineHeight)}
            onChange={(event) => setLineHeight(Number(event.target.value))}
            className={SELECT_CLASS}
          >
            {LINE_HEIGHTS.map((value) => (
              <option key={value} value={String(value)}>
                {lineLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex scroll-mt-3 flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            {t("theming.a11y.letterSpacing", "Letter spacing")}
            <HelpTooltip text={t("theming.a11y.letterSpacingHelp", "Space between letters, everywhere in the app.")} />
          </span>
          <select
            id="settings-control-a11y-letter-spacing"
            value={String(letterSpacing)}
            onChange={(event) => setLetterSpacing(Number(event.target.value))}
            className={SELECT_CLASS}
          >
            {LETTER_SPACINGS.map((value) => (
              <option key={value} value={String(value)}>
                {letterLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex scroll-mt-3 flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            {t("theming.a11y.contrast", "High contrast")}
            <HelpTooltip
              text={t(
                "theming.a11y.contrastHelp",
                "Stronger text, borders and focus colours. Follow system turns it on when your device asks for more contrast.",
              )}
            />
          </span>
          <select
            id="settings-control-a11y-contrast"
            value={contrast}
            onChange={(event) => setContrast(event.target.value as typeof contrast)}
            className={SELECT_CLASS}
          >
            <option value="system">{t("theming.a11y.contrastSystem", "Follow system")}</option>
            <option value="on">{t("theming.a11y.contrastOn", "On")}</option>
            <option value="off">{t("theming.a11y.contrastOff", "Off")}</option>
          </select>
        </label>
        <ToggleSetting
          anchorId="settings-control-a11y-focus"
          label={t("theming.a11y.focus", "Strong focus rings")}
          checked={strongFocus}
          onChange={setStrongFocus}
          help={t(
            "theming.a11y.focusHelp",
            "A thick, high-contrast outline on whatever the keyboard is on. Tab also offers Skip to content links.",
          )}
        />
        <ToggleSetting
          anchorId="settings-control-a11y-reduce-motion"
          label={t("theming.a11y.reduceMotion", "Reduce motion")}
          checked={reduceMotion}
          onChange={setReduceMotion}
          help={t(
            "theming.a11y.reduceMotionHelp",
            "Stops animations, transitions, Accent Pulse and theme effects. Turns on by itself when your system asks for less motion.",
          )}
        />
        <label className="flex scroll-mt-3 flex-col gap-1">
          <span className="flex items-center gap-1 text-xs font-medium">
            {t("theming.a11y.backdropStrength", "Theme art strength")}
            <HelpTooltip
              text={t(
                "theming.a11y.backdropStrengthHelp",
                "How strongly a theme's background picture and ambient overlay (rain, leaves, scanlines) show. Lower it when you like a theme but its art makes text hard to read. High contrast keeps it at 25% or less.",
              )}
            />
            <span className="ml-auto font-normal tabular-nums text-[var(--muted-foreground)]">{backdropStrength}%</span>
          </span>
          <input
            id="settings-control-a11y-backdrop-strength"
            type="range"
            min={0}
            max={100}
            step={5}
            value={backdropStrength}
            onChange={(event) => setBackdropStrength(Number(event.target.value))}
            style={{ "--range-progress": `${backdropStrength}%` } as CSSProperties}
          />
        </label>
        <ToggleSetting
          anchorId="settings-control-a11y-color-blind"
          label={t("theming.a11y.colorBlind", "Colour-blind-safe colours")}
          checked={colorBlindSafe}
          onChange={setColorBlindSafe}
          help={t(
            "theming.a11y.colorBlindHelp",
            "Blue and orange instead of green and red for status dots, gauges and Delete buttons.",
          )}
        />
      </div>
    </SettingsSection>
  );
}

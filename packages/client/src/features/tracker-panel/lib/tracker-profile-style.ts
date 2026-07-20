import type { CSSProperties } from "react";
import type { Persona, PresentCharacter, TrackerCardColorConfig } from "@marinara-engine/shared";
import {
  DEFAULT_TRACKER_CARD_ACCENT,
  getTrackerCardCssPaintValue,
  getTrackerCardFinish,
  getTrackerCardPaintEnabled,
  getTrackerCardPaintOpacity,
  getTrackerCardPortraitStageBackground,
  getTrackerCardSkinFinish,
  getTrackerCardSolidColor,
  getTrackerCardStylePalette,
  getTrackerCardStyleVars,
  normalizeTrackerCardColorMode,
  parseTrackerCardColorConfig,
  type TrackerCardStylePalette,
} from "../../../lib/tracker-card-colors";
import { visibleText } from "./tracker-display";

const TRACKER_CARD_NEUTRAL_SURFACE_TOP =
  "var(--tracker-card-neutral-surface-top, color-mix(in srgb, var(--secondary) 90%, var(--foreground) 10%))";
const TRACKER_CARD_NEUTRAL_SURFACE_BOTTOM =
  "var(--tracker-card-neutral-surface-bottom, color-mix(in srgb, var(--background) 88%, var(--foreground) 12%))";
const TRACKER_CARD_NEUTRAL_MATERIAL =
  "var(--tracker-card-neutral-material, color-mix(in srgb, var(--secondary) 86%, var(--foreground) 14%))";
const TRACKER_CARD_NEUTRAL_LIFT =
  "var(--tracker-card-neutral-lift, color-mix(in srgb, var(--muted-foreground) 78%, var(--foreground) 22%))";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function opacityWeight(value: number) {
  return clampPercent(value) / 100;
}

function scalePercent(value: number, opacity: number) {
  return Math.round(value * opacityWeight(opacity));
}

function getStrengthAdjustedProfileColor(color: string, opacity: number, neutral: string) {
  const clampedOpacity = clampPercent(opacity);
  if (clampedOpacity >= 100) return color;
  if (clampedOpacity <= 0) return neutral;
  return `color-mix(in srgb, ${neutral} ${100 - clampedOpacity}%, ${color} ${clampedOpacity}%)`;
}

export interface TrackerProfileColors {
  dialogueColor?: string | null;
  nameColor?: string | null;
  boxColor?: string | null;
  trackerCardColors?: TrackerCardColorConfig | null;
}

type TrackerProfilePalette = TrackerCardStylePalette;

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getTrackerProfilePalette(
  profileColors: TrackerProfileColors | null | undefined,
  fallbackAccent = DEFAULT_TRACKER_CARD_ACCENT,
): TrackerProfilePalette {
  const trackerCardColors = profileColors?.trackerCardColors ?? null;
  const mode = normalizeTrackerCardColorMode(trackerCardColors?.mode);
  const finish = getTrackerCardFinish(trackerCardColors, mode);
  const enabled = getTrackerCardPaintEnabled(trackerCardColors);
  const opacity = getTrackerCardPaintOpacity(trackerCardColors);
  const effectiveColors = mode === "default" ? null : mode === "custom" ? trackerCardColors : profileColors;
  const effectiveFallback = mode === "chat" ? fallbackAccent : DEFAULT_TRACKER_CARD_ACCENT;

  return getTrackerCardStylePalette({
    colors: effectiveColors,
    enabled,
    finish,
    opacity,
    portraitStageBackground: getTrackerCardPortraitStageBackground(trackerCardColors),
    fallbackAccent: effectiveFallback,
  });
}

function withTrackerProfileStyle(palette: TrackerProfilePalette, background?: string): CSSProperties {
  const vars = getTrackerCardStyleVars({ palette, background });
  const style: CSSProperties & {
    "--tracker-profile-accent-highlight-opacity": string;
    "--tracker-profile-accent-layer": string;
    "--tracker-profile-accent-solid": string;
    "--tracker-profile-accent-wash-opacity": string;
    "--tracker-profile-body-wash-opacity": string;
    "--tracker-profile-dialogue-border": string;
    "--tracker-profile-dialogue-glow": string;
    "--tracker-profile-display-layer": string;
    "--tracker-profile-display-solid": string;
    "--tracker-profile-field-material": string;
    "--tracker-profile-field-material-blend": string;
    "--tracker-profile-icon": string;
    "--tracker-profile-label-icon": string;
    "--tracker-profile-label-muted-text": string;
    "--tracker-profile-label-text": string;
    "--tracker-profile-material": string;
    "--tracker-profile-material-blend": string;
    "--tracker-profile-panel-material": string;
    "--tracker-profile-panel-material-blend": string;
    "--tracker-profile-portrait-base": string;
    "--tracker-profile-portrait-bottom-glow-opacity": string;
    "--tracker-profile-portrait-bottom-rule-opacity": string;
    "--tracker-profile-portrait-media-blur": string;
    "--tracker-profile-portrait-media-opacity": string;
    "--tracker-profile-portrait-media-saturate": string;
    "--tracker-profile-portrait-light": string;
    "--tracker-profile-portrait-light-opacity": string;
    "--tracker-profile-portrait-rim": string;
    "--tracker-profile-portrait-rim-opacity": string;
    "--tracker-profile-portrait-side-mask-opacity": string;
    "--tracker-profile-portrait-veil": string;
    "--tracker-profile-nameplate": string;
    "--tracker-profile-nameplate-glow": string;
    "--tracker-profile-nameplate-rule": string;
    "--tracker-profile-nameplate-text": string;
    "--tracker-profile-rule": string;
    "--tracker-profile-surface": string;
    "--tracker-profile-surface-blend": string;
    "--tracker-profile-surface-layer": string;
    "--tracker-profile-surface-solid": string;
    "--tracker-profile-slot-rule": string;
    "--tracker-profile-slot-shadow": string;
    "--tracker-profile-slot-surface": string;
    "--tracker-profile-slot-surface-blend": string;
    "--tracker-profile-tint-opacity": string;
    "--tracker-profile-contrast-soft-top": string;
    "--tracker-profile-contrast-soft-mid": string;
    "--tracker-profile-contrast-soft-bottom": string;
    "--tracker-profile-contrast-strong-top": string;
    "--tracker-profile-contrast-strong-mid": string;
    "--tracker-profile-contrast-strong-bottom": string;
    "--tracker-profile-muted-text": string;
    "--tracker-profile-number-text": string;
    "--tracker-profile-row-rule": string;
    "--tracker-profile-stat-fill-glow": string;
    "--tracker-profile-stat-fill-highlight": string;
    "--tracker-profile-stat-track": string;
    "--tracker-profile-stat-track-blend": string;
    "--tracker-profile-stat-track-ring": string;
    "--tracker-profile-stat-track-shadow": string;
    "--tracker-profile-text": string;
    "--tracker-inline-foreground": string;
    "--tracker-inline-muted": string;
    "--tracker-inline-number": string;
    "--tracker-inline-rule": string;
    "--primary"?: string;
  } = {
    "--tracker-profile-accent-highlight-opacity": vars.accentHighlightOpacity,
    "--tracker-profile-accent-layer": vars.accentLayer,
    "--tracker-profile-accent-solid": vars.accentSolid,
    "--tracker-profile-accent-wash-opacity": vars.accentWashOpacity,
    "--tracker-profile-body-wash-opacity": vars.bodyWashOpacity,
    "--tracker-profile-dialogue-border": vars.dialogueBorder,
    "--tracker-profile-dialogue-glow": vars.dialogueGlow,
    "--tracker-profile-display-layer": vars.displayLayer,
    "--tracker-profile-display-solid": vars.displaySolid,
    "--tracker-profile-field-material": vars.fieldMaterial,
    "--tracker-profile-field-material-blend": vars.fieldMaterialBlend,
    "--tracker-profile-icon": vars.icon,
    "--tracker-profile-label-icon": vars.labelIcon,
    "--tracker-profile-label-muted-text": vars.labelMutedText,
    "--tracker-profile-label-text": vars.labelText,
    "--tracker-profile-material": vars.material,
    "--tracker-profile-material-blend": vars.materialBlend,
    "--tracker-profile-panel-material": vars.panelMaterial,
    "--tracker-profile-panel-material-blend": vars.panelMaterialBlend,
    "--tracker-profile-portrait-base": vars.portraitBase,
    "--tracker-profile-portrait-bottom-glow-opacity": vars.portraitBottomGlowOpacity,
    "--tracker-profile-portrait-bottom-rule-opacity": vars.portraitBottomRuleOpacity,
    "--tracker-profile-portrait-media-blur": vars.portraitMediaBlur,
    "--tracker-profile-portrait-media-opacity": vars.portraitMediaOpacity,
    "--tracker-profile-portrait-media-saturate": vars.portraitMediaSaturate,
    "--tracker-profile-portrait-light": vars.portraitLight,
    "--tracker-profile-portrait-light-opacity": vars.portraitLightOpacity,
    "--tracker-profile-portrait-rim": vars.portraitRim,
    "--tracker-profile-portrait-rim-opacity": vars.portraitRimOpacity,
    "--tracker-profile-portrait-side-mask-opacity": vars.portraitSideMaskOpacity,
    "--tracker-profile-portrait-veil": vars.portraitVeil,
    "--tracker-profile-nameplate": vars.nameplate,
    "--tracker-profile-nameplate-glow": vars.nameplateGlow,
    "--tracker-profile-nameplate-rule": vars.nameplateRule,
    "--tracker-profile-nameplate-text": vars.nameplateText,
    "--tracker-profile-rule": vars.rule,
    "--tracker-profile-surface": vars.surface,
    "--tracker-profile-surface-blend": vars.surfaceBlend,
    "--tracker-profile-surface-layer": vars.surfaceLayer,
    "--tracker-profile-surface-solid": vars.surfaceSolid,
    "--tracker-profile-slot-rule": vars.slotRule,
    "--tracker-profile-slot-shadow": vars.slotShadow,
    "--tracker-profile-slot-surface": vars.slotSurface,
    "--tracker-profile-slot-surface-blend": vars.slotSurfaceBlend,
    "--tracker-profile-tint-opacity": vars.tintOpacity,
    "--tracker-profile-contrast-soft-top": vars.contrastSoftTop,
    "--tracker-profile-contrast-soft-mid": vars.contrastSoftMid,
    "--tracker-profile-contrast-soft-bottom": vars.contrastSoftBottom,
    "--tracker-profile-contrast-strong-top": vars.contrastStrongTop,
    "--tracker-profile-contrast-strong-mid": vars.contrastStrongMid,
    "--tracker-profile-contrast-strong-bottom": vars.contrastStrongBottom,
    "--tracker-profile-muted-text": vars.mutedText,
    "--tracker-profile-number-text": vars.numberText,
    "--tracker-profile-row-rule": vars.rowRule,
    "--tracker-profile-stat-fill-glow": vars.statFillGlow,
    "--tracker-profile-stat-fill-highlight": vars.statFillHighlight,
    "--tracker-profile-stat-track": vars.statTrack,
    "--tracker-profile-stat-track-blend": vars.statTrackBlend,
    "--tracker-profile-stat-track-ring": vars.statTrackRing,
    "--tracker-profile-stat-track-shadow": vars.statTrackShadow,
    "--tracker-profile-text": vars.text,
    "--tracker-inline-foreground": "var(--tracker-profile-text)",
    "--tracker-inline-muted": "var(--tracker-profile-muted-text)",
    "--tracker-inline-number": "var(--tracker-profile-number-text)",
    "--tracker-inline-rule": "var(--tracker-profile-row-rule)",
    background: vars.background,
    backgroundBlendMode: vars.backgroundBlendMode,
  };

  if (palette.accent !== DEFAULT_TRACKER_CARD_ACCENT) {
    style["--primary"] = vars.accent;
  }

  return style;
}

export function getPersonaAmbienceStyle(
  persona: Persona | null,
  options: { paintBackground?: boolean } = {},
): CSSProperties {
  const palette = getTrackerProfilePalette({
    dialogueColor: persona?.dialogueColor,
    nameColor: persona?.nameColor,
    boxColor: persona?.boxColor,
    trackerCardColors: parseTrackerCardColorConfig(persona?.trackerCardColors),
  });
  const style = withTrackerProfileStyle(palette);

  if (options.paintBackground === false) {
    delete style.background;
    delete style.backgroundBlendMode;
  }

  return style;
}

export function getPersonaInitial(persona: Persona | null) {
  return visibleText(persona?.name, "P").slice(0, 1).toUpperCase();
}

export function getCharacterProfileColors(rawData: unknown): TrackerProfileColors | null {
  try {
    const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const data = record?.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : record;
    const extensions =
      data?.extensions && typeof data.extensions === "object" && !Array.isArray(data.extensions)
        ? (data.extensions as Record<string, unknown>)
        : null;

    const trackerCardColorsRaw = extensions?.trackerCardColors;
    const profileColors: TrackerProfileColors = {
      dialogueColor: getTrackerCardCssPaintValue(getStringValue(extensions?.dialogueColor)),
      nameColor: getTrackerCardCssPaintValue(getStringValue(extensions?.nameColor)),
      boxColor: getTrackerCardCssPaintValue(getStringValue(extensions?.boxColor)),
      ...(trackerCardColorsRaw !== undefined && {
        trackerCardColors: parseTrackerCardColorConfig(trackerCardColorsRaw),
      }),
    };

    return profileColors.dialogueColor ||
      profileColors.nameColor ||
      profileColors.boxColor ||
      profileColors.trackerCardColors
      ? profileColors
      : null;
  } catch {
    return null;
  }
}

export function getCharacterAmbienceStyle(
  character: PresentCharacter,
  profileColors?: TrackerProfileColors | null,
): CSSProperties {
  const stats = Array.isArray(character.stats) ? character.stats : [];
  const palette = getTrackerProfilePalette(
    profileColors,
    getTrackerCardSolidColor(stats.find((stat) => stat.color)?.color) ?? DEFAULT_TRACKER_CARD_ACCENT,
  );
  const finish = getTrackerCardSkinFinish(palette.finish);
  const surfaceOpacity = palette.hasSurfacePaint ? palette.opacity.boxColorOpacity : 0;
  const hasActiveSurface = surfaceOpacity > 0;
  const boxMix = scalePercent(Math.min(32, Math.round(finish.surfaceBoxMix * 0.9)), surfaceOpacity);
  const backMix = Math.round(boxMix * 0.68);
  const effectiveBox = getStrengthAdjustedProfileColor(palette.box, surfaceOpacity, TRACKER_CARD_NEUTRAL_MATERIAL);
  const surfaceMaterialPaint = hasActiveSurface
    ? `color-mix(in srgb, ${effectiveBox} 88%, ${TRACKER_CARD_NEUTRAL_LIFT} 12%)`
    : effectiveBox;
  const materialTopBase = TRACKER_CARD_NEUTRAL_SURFACE_TOP;
  const materialDepthBase = TRACKER_CARD_NEUTRAL_SURFACE_BOTTOM;
  return withTrackerProfileStyle(
    palette,
    `linear-gradient(135deg, color-mix(in srgb, ${materialTopBase} ${100 - boxMix}%, ${surfaceMaterialPaint} ${boxMix}%), ` +
      `color-mix(in srgb, ${materialDepthBase} ${100 - backMix}%, ${surfaceMaterialPaint} ${backMix}%))`,
  );
}

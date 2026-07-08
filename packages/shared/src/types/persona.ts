// ──────────────────────────────────────────────
// User Persona Types
// ──────────────────────────────────────────────
import type { ConvoBehaviorConfig } from "./character.js";

/** A user persona (the player's character/identity). */
export interface Persona {
  id: string;
  name: string;
  /** Short comment shown under the name (for disambiguation) */
  comment: string;
  /** Optional pronunciation override used when this persona name is sent to TTS. */
  phoneticName?: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  /** Avatar image path */
  avatarPath: string | null;
  /** Avatar crop settings for the circle avatar. Accepts both the current
   *  source-rectangle shape and the legacy zoom+offset shape (kept readable so
   *  previously saved crops display unchanged until the user re-edits). */
  avatarCrop?: PersonaAvatarCrop | LegacyPersonaAvatarCrop | null;
  /** Whether this is the currently active persona */
  isActive: boolean;
  /** Name display color/gradient (CSS value) */
  nameColor: string;
  /** Dialogue highlight color — quoted text bold + colored */
  dialogueColor: string;
  /** Chat bubble / dialogue box background color */
  boxColor: string;
  /** Tracker card color source + optional custom palette. */
  trackerCardColors?: TrackerCardColorConfig | string;
  /** Persona status bars configuration (Satiety, Energy, etc.) */
  personaStats?: PersonaStatsConfig;
  /** Tags for organizing personas */
  tags?: string[];
  /** Saved Conversation mode activity/status text options for this persona */
  savedStatusOptions?: string[];
  /** Conversation mode ONLY: display name shown as the user's sender label in Convo. */
  convoDisplayName?: string;
  /** Conversation mode ONLY: public "about me" profile (cross-chat default). */
  aboutMe?: string;
  /** Conversation mode ONLY: behavior directive + insertion strategy for the persona. */
  convoBehavior?: ConvoBehaviorConfig;
  createdAt: string;
  updatedAt: string;
}

export type TrackerCardColorMode = "default" | "chat" | "custom";
export type TrackerCardPortraitStageBackground = "ambient" | "spotlight" | "soft" | "plain";

export interface TrackerCardColorConfig {
  mode?: TrackerCardColorMode;
  /** Whether the Display channel is allowed to contribute paint. */
  displayEnabled?: boolean;
  /** Tracker card display color/gradient. */
  nameColor?: string;
  /** Tracker card display paint opacity, 0-100. */
  nameColorOpacity?: number;
  /** Whether the Accent channel is allowed to contribute paint. */
  accentEnabled?: boolean;
  /** Tracker card dialogue/accent color. */
  dialogueColor?: string;
  /** Tracker card dialogue/accent paint opacity, 0-100. */
  dialogueColorOpacity?: number;
  /** Whether the Surface channel is allowed to contribute paint. */
  surfaceEnabled?: boolean;
  /** Tracker card surface tint color. */
  boxColor?: string;
  /** Tracker card surface paint opacity, 0-100. */
  boxColorOpacity?: number;
  /** Deprecated: old tracker material tint control. */
  tintIntensity?: number;
  /** Tracker card material brightness, 0 = nearly black, 50 = unchanged, 100 = nearly white. */
  materialBrightness?: number;
  /** How strongly selected colors affect glows, borders, and hairlines, 0-100. */
  glowIntensity?: number;
  /** How much neutral readability veil sits over the card, 0-100. */
  contrastIntensity?: number;
  /** Portrait stage background treatment behind transparent sprites. */
  portraitStageBackground?: TrackerCardPortraitStageBackground;
  /** Tracker portrait horizontal focus, 0 = left, 100 = right. */
  portraitFocusX?: number;
  /** Tracker portrait vertical focus, 0 = top, 100 = bottom; expression sprites may exceed 100 to dip below the frame. */
  portraitFocusY?: number;
  /** Tracker portrait zoom multiplier. */
  portraitZoom?: number;
}

/** Avatar crop — current source-rectangle format. A square region of the source
 *  image (`srcWidth * sourceW === srcHeight * sourceH` in editor-enforced data),
 *  expressed in coordinates normalized to the source's intrinsic dimensions.
 *  Mirror of the client `AvatarCrop` declared in `client/src/lib/utils.ts`,
 *  duplicated here so the shared package doesn't depend on client code. */
export interface PersonaAvatarCrop {
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
}

/** Avatar crop — legacy zoom + offset format. Render-only compatibility path so
 *  previously saved crops display unchanged until the user re-edits them. */
export interface LegacyPersonaAvatarCrop {
  zoom: number;
  offsetX: number;
  offsetY: number;
  fullImage?: boolean;
}

/** A single persona status bar definition. */
export interface PersonaStatBar {
  name: string;
  value: number;
  max: number;
  /** Hex color for the stat bar */
  color: string;
}

/** Configuration for persona status bars (needs/physical state). */
export interface PersonaStatsConfig {
  /** Whether persona stat tracking is enabled */
  enabled: boolean;
  /** The stat bars to track */
  bars: PersonaStatBar[];
}

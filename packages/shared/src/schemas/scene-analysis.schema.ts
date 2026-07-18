import { z } from "zod";
import type { GameNpc, HudWidget } from "../types/game.js";
import type { GameActiveState } from "../types/game.js";
import type { SceneSpotifyTrackCandidate } from "../types/sidecar.js";

export const SCENE_ANALYSIS_NARRATION_MAX_CHARS = 50_000;
export const SIDECAR_SCENE_ANALYSIS_NARRATION_BUDGET_CHARS = 16_000;

const gameActiveStateSchema = z.enum(["exploration", "dialogue", "combat", "travel_rest"]);

export const sceneSpotifyTrackCandidateSchema = z.object({
  uri: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  artist: z.string().min(1).max(300),
  album: z.string().max(300).nullable().optional(),
  position: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
}) satisfies z.ZodType<SceneSpotifyTrackCandidate>;

export const sceneAnalysisContextSchema = z.object({
  currentState: gameActiveStateSchema satisfies z.ZodType<GameActiveState>,
  turnNumber: z.number().int().positive().optional(),
  availableBackgrounds: z.array(z.string()).max(2_000),
  availableSfx: z.array(z.string()).max(2_000),
  activeWidgets: z.array(z.custom<HudWidget>()).max(100),
  trackedNpcs: z.array(z.custom<GameNpc>()).max(200),
  characterNames: z.array(z.string().max(200)).max(100),
  currentBackground: z.string().nullable(),
  currentMusic: z.string().nullable(),
  recentMusic: z.array(z.string().max(500)).max(20).optional().default([]),
  useSpotifyMusic: z.boolean().optional().default(false),
  availableSpotifyTracks: z.array(sceneSpotifyTrackCandidateSchema).max(50).optional().default([]),
  currentSpotifyTrack: z.string().max(300).nullable().optional().default(null),
  recentSpotifyTracks: z.array(z.string().max(300)).max(20).optional().default([]),
  currentAmbient: z.string().nullable().optional().default(null),
  currentLocation: z.string().nullable().optional().default(null),
  currentWeather: z.string().nullable(),
  currentTimeOfDay: z.string().nullable(),
  genre: z.string().nullable().optional().default(null),
  setting: z.string().nullable().optional().default(null),
  worldOverview: z.string().nullable().optional().default(null),
  canGenerateBackgrounds: z.boolean().optional(),
  canGenerateIllustrations: z.boolean().optional(),
  artStylePrompt: z.string().nullable().optional(),
  imagePromptInstructions: z.string().max(5_000).nullable().optional(),
});

export const sceneAnalysisRequestSchema = z.object({
  narration: z.string().min(1).max(SCENE_ANALYSIS_NARRATION_MAX_CHARS),
  playerAction: z.string().max(5_000).optional(),
  context: sceneAnalysisContextSchema,
  debugMode: z.boolean().optional().default(false),
});

export type SceneAnalysisContextRequest = z.input<typeof sceneAnalysisContextSchema>;
export type SceneAnalysisRequest = z.input<typeof sceneAnalysisRequestSchema>;

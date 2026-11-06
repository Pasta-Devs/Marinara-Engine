import { clipVerbatimVideoSource } from "./prompt-context.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { tryParseJsonRecord } from "../../lib/json-repair.js";
import { loadPrompt, ROLEPLAY_CLIP_DIRECTOR, ROLEPLAY_GALLERY_VIDEO_DIRECTOR } from "../prompt-overrides/index.js";
import {
  appendGoverningVideoPromptInstructions,
  normalizeVideoPromptInstructionsText,
  withGoverningVideoFormat,
} from "../generation/image-prompt-instructions.js";

const ROLEPLAY_VIDEO_DIRECTION_MAX_LENGTH = 6_000;

export interface RoleplayVideoDirectionContext {
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  sourceExchange: string;
  referenceImagePrompt: string;
  characterNames: string[];
  setting: string;
  /** The video connection's Video Prompting Instructions. */
  videoPromptInstructions?: string | null;
  /** The clip has no picture of this moment (text to video, or starting from an avatar): describe the scene. */
  withoutPicture?: boolean;
  /** Attach Card Appearance for videos: the people's appearance details to build in (formatVideoAppearanceDetails). */
  appearanceDetails?: string;
}

export type RoleplayVideoDirectionMessages = [{ role: "system"; content: string }, { role: "user"; content: string }];

export function buildRoleplayVideoDirectionUserPrompt(ctx: RoleplayVideoDirectionContext): string {
  const characterLine =
    ctx.characterNames.length > 0 ? ctx.characterNames.join(", ") : "Use only people visible in the scene.";
  const referenceImagePrompt = clipVerbatimVideoSource(ctx.referenceImagePrompt, 2_000);
  const prompt = [
    `<clip_duration_seconds>${ctx.durationSeconds}</clip_duration_seconds>`,
    `<aspect_ratio>${ctx.aspectRatio}</aspect_ratio>`,
    `<scene_characters>${characterLine}</scene_characters>`,
    `<scene_setting>${clipVerbatimVideoSource(ctx.setting, 1_000)}</scene_setting>`,
    `<source_exchange>\n${clipVerbatimVideoSource(ctx.sourceExchange, 8_000)}\n</source_exchange>`,
    referenceImagePrompt
      ? `<first_frame_generation_context>\n${referenceImagePrompt}\n</first_frame_generation_context>`
      : "",
    ctx.appearanceDetails?.trim() ?? "",
    normalizeVideoPromptInstructionsText(ctx.videoPromptInstructions)
      ? "Write the clip's video prompt exactly as the video prompting instructions below say; it may be returned as plain text instead of JSON."
      : ctx.withoutPicture
        ? "Write one duration-aware narrationBeat that describes the scene and its action."
        : "Write one duration-aware narrationBeat. Use the first-frame generation context only to understand the starting pose and scene; do not repeat it in the output.",
  ]
    .filter(Boolean)
    .join("\n\n");
  // Next to the request, so they still apply when the director's system prompt is overridden.
  return appendGoverningVideoPromptInstructions(prompt, ctx.videoPromptInstructions);
}

export async function buildRoleplayVideoDirectionMessages(
  storage: PromptOverridesStorage,
  ctx: RoleplayVideoDirectionContext,
): Promise<RoleplayVideoDirectionMessages> {
  const systemPrompt = await loadPrompt(
    storage,
    ctx.withoutPicture ? ROLEPLAY_CLIP_DIRECTOR : ROLEPLAY_GALLERY_VIDEO_DIRECTOR,
    {
      durationSeconds: ctx.durationSeconds,
    },
  );
  return [
    { role: "system", content: withGoverningVideoFormat(systemPrompt, ctx.videoPromptInstructions) },
    { role: "user", content: buildRoleplayVideoDirectionUserPrompt(ctx) },
  ];
}

function unwrapJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  return fenced?.[1]?.trim() ?? trimmed;
}

export function resolveRoleplayVideoDirection(
  value: unknown,
  maxLength: number | null,
  videoPromptInstructions?: unknown,
): string {
  if (typeof value !== "string") return "";
  const unwrapped = unwrapJsonFence(value);
  // A JSON shape the video prompting instructions ask for (they name JSON or show an object) is the prompt itself, not
  // a missing narrationBeat. Any other object, such as an error payload, is no prompt.
  const instructions = normalizeVideoPromptInstructionsText(videoPromptInstructions);
  const otherJson = /\bjson\b|\{/iu.test(instructions) ? unwrapped : "";
  let narrationBeat: string;
  try {
    const parsed = JSON.parse(unwrapped) as unknown;
    if (typeof parsed === "string") {
      narrationBeat = parsed;
    } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const candidate = (parsed as Record<string, unknown>).narrationBeat;
      narrationBeat = typeof candidate === "string" ? candidate : otherJson;
    } else {
      narrationBeat = Array.isArray(parsed) ? otherJson : "";
    }
  } catch {
    // A JSON answer with a slip (an unescaped quote) is repaired; plain text, such as a format the video
    // connection's instructions ask for, is used as written.
    const repaired = unwrapped.startsWith("{") ? tryParseJsonRecord(unwrapped)?.narrationBeat : undefined;
    narrationBeat = typeof repaired === "string" ? repaired : unwrapped.replace(/^narration\s*beat\s*:\s*/iu, "");
  }
  const maxChars =
    maxLength && maxLength > 0
      ? Math.min(maxLength, ROLEPLAY_VIDEO_DIRECTION_MAX_LENGTH)
      : ROLEPLAY_VIDEO_DIRECTION_MAX_LENGTH;
  // Line breaks stay: a format the video connection's instructions ask for (one field per line) must survive.
  const tidy = narrationBeat
    .split("\n")
    .map((line) => line.replace(/[ \t]+/gu, " ").trim())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return tidy.length <= maxChars ? tidy : `${tidy.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

import { clipVerbatimVideoSource, compactVideoPromptText } from "./prompt-context.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, ROLEPLAY_GALLERY_VIDEO_DIRECTOR } from "../prompt-overrides/index.js";

const ROLEPLAY_VIDEO_DIRECTION_MAX_LENGTH = 6_000;

export interface RoleplayVideoDirectionContext {
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  sourceExchange: string;
  referenceImagePrompt: string;
  characterNames: string[];
  setting: string;
}

export type RoleplayVideoDirectionMessages = [{ role: "system"; content: string }, { role: "user"; content: string }];

export function buildRoleplayVideoDirectionUserPrompt(ctx: RoleplayVideoDirectionContext): string {
  const characterLine =
    ctx.characterNames.length > 0 ? ctx.characterNames.join(", ") : "Use only people visible in the scene.";
  const referenceImagePrompt = clipVerbatimVideoSource(ctx.referenceImagePrompt, 2_000);
  return [
    `<clip_duration_seconds>${ctx.durationSeconds}</clip_duration_seconds>`,
    `<aspect_ratio>${ctx.aspectRatio}</aspect_ratio>`,
    `<scene_characters>${characterLine}</scene_characters>`,
    `<scene_setting>${clipVerbatimVideoSource(ctx.setting, 1_000)}</scene_setting>`,
    `<source_exchange>\n${clipVerbatimVideoSource(ctx.sourceExchange, 8_000)}\n</source_exchange>`,
    referenceImagePrompt
      ? `<first_frame_generation_context>\n${referenceImagePrompt}\n</first_frame_generation_context>`
      : "",
    "Write one duration-aware narrationBeat. Use the first-frame generation context only to understand the starting pose and scene; do not repeat it in the output.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function buildRoleplayVideoDirectionMessages(
  storage: PromptOverridesStorage,
  ctx: RoleplayVideoDirectionContext,
): Promise<RoleplayVideoDirectionMessages> {
  const systemPrompt = await loadPrompt(storage, ROLEPLAY_GALLERY_VIDEO_DIRECTOR, {
    durationSeconds: ctx.durationSeconds,
  });
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildRoleplayVideoDirectionUserPrompt(ctx) },
  ];
}

function unwrapJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  return fenced?.[1]?.trim() ?? trimmed;
}

export function resolveRoleplayVideoDirection(value: unknown, maxLength: number | null): string {
  if (typeof value !== "string") return "";
  const unwrapped = unwrapJsonFence(value);
  let narrationBeat = unwrapped;
  try {
    const parsed = JSON.parse(unwrapped) as unknown;
    if (typeof parsed === "string") {
      narrationBeat = parsed;
    } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const candidate = (parsed as Record<string, unknown>).narrationBeat;
      narrationBeat = typeof candidate === "string" ? candidate : "";
    } else {
      narrationBeat = "";
    }
  } catch {
    narrationBeat = unwrapped.replace(/^narration\s*beat\s*:\s*/iu, "");
  }
  return compactVideoPromptText(
    narrationBeat,
    maxLength && maxLength > 0
      ? Math.min(maxLength, ROLEPLAY_VIDEO_DIRECTION_MAX_LENGTH)
      : ROLEPLAY_VIDEO_DIRECTION_MAX_LENGTH,
  );
}

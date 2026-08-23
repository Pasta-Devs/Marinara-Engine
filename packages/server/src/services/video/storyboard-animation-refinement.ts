import { normalizeAgentPromptTemplateOptions, type StoryboardAnimationSuitability } from "@marinara-engine/shared";
import type { ChatMessage } from "../llm/base-provider.js";
import { renderTemplate } from "../prompt-overrides/index.js";
import { compactVideoPromptText } from "./prompt-context.js";
import type { VideoReferenceImage } from "./video-generation.js";

export const STORYBOARD_ANIMATION_PROMPT_MAX_CHARS = 6_000;
const MAX_RENDERED_PROMPT_CHARS = 18_000;

const STORYBOARD_ANIMATION_REFINEMENT_VARIABLES = [
  "title",
  "motionIntent",
  "imagePrompt",
  "sourceSections",
  "characters",
  "durationSeconds",
  "aspectRatio",
] as const;

export interface StoryboardAnimationRefinement {
  classification: StoryboardAnimationSuitability;
  narrationBeat: string;
}

function imageDataUrl(image: VideoReferenceImage): string {
  const base64 = image.base64.replace(/^data:[^,]+,/iu, "");
  return `data:${image.mimeType};base64,${base64}`;
}

function unwrapJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  return fenced?.[1]?.trim() ?? trimmed;
}

function resolveTemplate(rawTemplates: unknown, selectedId: unknown): string {
  const templates = normalizeAgentPromptTemplateOptions(rawTemplates);
  const requestedId = typeof selectedId === "string" ? selectedId.trim() : "";
  const selected = (requestedId ? templates.find((template) => template.id === requestedId) : null) ?? templates[0];
  return selected?.promptTemplate.trim() ?? "";
}

function segmentCount(value: string): number | null {
  const segments = value.split("|").map((segment) => segment.trim());
  return segments.every(Boolean) ? segments.length : null;
}

export function compactStoryboardAnimationPrompt(value: unknown): string {
  return compactVideoPromptText(value, STORYBOARD_ANIMATION_PROMPT_MAX_CHARS);
}

export function buildStoryboardAnimationRefinementMessages(args: {
  templates: unknown;
  templateId: unknown;
  title: string;
  motionIntent: string;
  imagePrompt: string;
  sourceSections: string;
  characters: string[];
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  referenceImage: VideoReferenceImage;
}): ChatMessage[] {
  const template = resolveTemplate(args.templates, args.templateId);
  if (!template) throw new Error("The Storyboard Agent has no image-aware shot planner prompt configured.");
  const prompt = compactVideoPromptText(
    renderTemplate(
      template,
      {
        title: compactVideoPromptText(args.title, 300),
        motionIntent: compactVideoPromptText(args.motionIntent, 4_000),
        imagePrompt: compactVideoPromptText(args.imagePrompt, 2_000),
        sourceSections: compactVideoPromptText(args.sourceSections, 6_000),
        characters: compactVideoPromptText(args.characters.join(", "), 1_200),
        durationSeconds: args.durationSeconds,
        aspectRatio: args.aspectRatio,
      },
      [...STORYBOARD_ANIMATION_REFINEMENT_VARIABLES],
    ),
    MAX_RENDERED_PROMPT_CHARS,
  );
  if (!prompt) throw new Error("The Storyboard Agent image-aware shot planner prompt rendered empty.");
  return [{ role: "user", content: prompt, images: [imageDataUrl(args.referenceImage)] }];
}

export function resolveStoryboardAnimationRefinement(
  value: unknown,
  motionIntent: string,
): StoryboardAnimationRefinement | null {
  if (typeof value !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJsonFence(value));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const classification = record.classification;
  if (
    classification !== "suitable" &&
    classification !== "simplify" &&
    classification !== "subtle" &&
    classification !== "regenerate"
  ) {
    return null;
  }
  const candidate = record.narrationBeat ?? record.animationPrompt ?? record.videoPrompt ?? record.prompt;
  const narrationBeat = compactStoryboardAnimationPrompt(candidate);
  const expectedSegments = segmentCount(motionIntent);
  if (!narrationBeat || expectedSegments === null || segmentCount(narrationBeat) !== expectedSegments) return null;
  return { classification, narrationBeat };
}

export async function executeStoryboardImageAwareAnimation<T>(args: {
  referenceImage: VideoReferenceImage;
  motionIntent: string;
  refinementEnabled?: boolean;
  refine: (referenceImage: VideoReferenceImage) => Promise<StoryboardAnimationRefinement>;
  formatPrompt: (narrationBeat: string) => Promise<string>;
  persistPrompt: (value: { prompt: string; classification: StoryboardAnimationSuitability | "" }) => Promise<void>;
  generateVideo: (value: { prompt: string; referenceImage: VideoReferenceImage }) => Promise<T>;
  onRefinementError?: (error: unknown) => void;
}): Promise<{
  generated: T;
  prompt: string;
  narrationBeat: string;
  classification: StoryboardAnimationSuitability | "";
}> {
  let refinement: StoryboardAnimationRefinement | null = null;
  if (args.refinementEnabled !== false) {
    try {
      refinement = await args.refine(args.referenceImage);
    } catch (error) {
      args.onRefinementError?.(error);
    }
  }
  const narrationBeat = refinement?.narrationBeat ?? args.motionIntent;
  const classification = refinement?.classification ?? "";
  const prompt = await args.formatPrompt(narrationBeat);
  await args.persistPrompt({ prompt, classification });
  const generated = await args.generateVideo({ prompt, referenceImage: args.referenceImage });
  return { generated, prompt, narrationBeat, classification };
}

export function redactStoryboardAnimationRefinementMessages(messages: readonly ChatMessage[]) {
  return messages.map((message) => ({
    ...message,
    ...(message.images
      ? {
          images: message.images.map((image) => ({
            mediaType:
              image.startsWith("data:") && image.indexOf(",") > 5
                ? image.slice(5, image.indexOf(",")).split(";")[0]
                : "unknown",
            encodedCharacters: image.length,
          })),
        }
      : {}),
  }));
}

import type { GameTurnStoryboardKeyframe, Message } from "@marinara-engine/shared";
import {
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_DEFAULT,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
  GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT,
  GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
} from "@marinara-engine/shared";
import type { GenerateGameTurnStoryboardInput } from "../../hooks/use-game-storyboards";
import type { GameSegmentEdit } from "../../lib/game-segment-edits";
import { parseNarrationSegments, type NarrationSegment } from "./GameNarration";

export type StoryboardViewerSize = "small" | "medium" | "large";
export type StoryboardViewerPosition = { x: number; y: number };
type GameStoryboardSourceSection = NonNullable<GenerateGameTurnStoryboardInput["sections"]>[number];

const STORYBOARD_VIEWER_PRESET_WIDTH: Record<StoryboardViewerSize, number> = {
  small: 288,
  medium: 368,
  large: 544,
};
const STORYBOARD_VIEWER_VERTICAL_CHROME = 116;
const EMPTY_GAME_SPEAKER_COLORS = new Map<string, string>();

function formatNarrationSegmentForContext(segment: NarrationSegment, edit?: GameSegmentEdit): string {
  const content =
    segment.type === "readable"
      ? (edit?.readableContent ?? edit?.content ?? segment.readableContent ?? segment.content)
      : (edit?.content ?? segment.content);
  const trimmed = content.trim();
  if (!trimmed) return "";

  if (segment.type === "dialogue") {
    const speaker = edit?.speaker?.trim() || segment.speaker?.trim();
    return speaker ? `${speaker}: ${trimmed}` : trimmed;
  }

  if (segment.type === "readable") {
    const type = edit?.readableType ?? segment.readableType;
    if (type === "book") return `Book: ${trimmed}`;
    if (type === "note") return `Note: ${trimmed}`;
  }

  return trimmed;
}

export function buildStoryboardVisibleNarration(
  message: Message | null,
  segmentEdits: Map<string, GameSegmentEdit>,
  segmentDeletes: Set<string>,
): string {
  if (!message?.id || !message.content) return "";
  const visibleText: string[] = [];
  const segments = parseNarrationSegments(message, EMPTY_GAME_SPEAKER_COLORS);
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    const sourceIndex = segment.sourceSegmentIndex ?? index;
    if (segmentDeletes.has(`${message.id}:${sourceIndex}`)) continue;
    if (segment.partyType === "side" || segment.partyType === "extra") continue;
    const text = formatNarrationSegmentForContext(segment, segmentEdits.get(`${message.id}:${sourceIndex}`));
    if (text) visibleText.push(text);
  }
  return visibleText.join("\n").trim();
}

export function buildStoryboardSectionsFromMessage(
  message: Message | null,
  segmentEdits: Map<string, GameSegmentEdit>,
  segmentDeletes: Set<string>,
): GameStoryboardSourceSection[] {
  if (!message?.id || !message.content) return [];
  return parseNarrationSegments(message, EMPTY_GAME_SPEAKER_COLORS)
    .map((segment, fallbackIndex): GameStoryboardSourceSection | null => {
      const sourceIndex = segment.sourceSegmentIndex ?? fallbackIndex;
      if (segmentDeletes.has(`${message.id}:${sourceIndex}`)) return null;
      const content = formatNarrationSegmentForContext(segment, segmentEdits.get(`${message.id}:${sourceIndex}`));
      if (!content) return null;
      return {
        index: sourceIndex,
        kind: segment.type,
        speaker: segment.speaker?.trim() || null,
        content: content.slice(0, 6000),
      };
    })
    .filter((section): section is GameStoryboardSourceSection => Boolean(section));
}

export function normalizeGameStoryboardKeyframeCount(value: unknown): number {
  if (value == null || value === "") return GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return GAME_STORYBOARD_KEYFRAME_COUNT_DEFAULT;
  return Math.max(
    GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
    Math.min(GAME_STORYBOARD_KEYFRAME_COUNT_MAX, Math.trunc(numeric)),
  );
}

export function hasGameStoryboardAnimationDuration(value: unknown): boolean {
  if (value == null || value === "") return false;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric);
}

export function normalizeGameStoryboardAnimationDuration(value: unknown): number {
  if (!hasGameStoryboardAnimationDuration(value)) return GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_DEFAULT;
  const numeric = typeof value === "number" ? value : Number(value);
  return Math.max(
    GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
    Math.min(GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX, Math.trunc(numeric)),
  );
}

export function nextStoryboardViewerSize(size: StoryboardViewerSize): StoryboardViewerSize {
  if (size === "small") return "medium";
  if (size === "medium") return "large";
  return "small";
}

export function clampStoryboardViewerWidth(width: number): number {
  const { minWidth, maxWidth } = getStoryboardViewerWidthBounds();
  return Math.max(minWidth, Math.min(width, maxWidth));
}

export function getStoryboardViewerWidthBounds(): { minWidth: number; maxWidth: number } {
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const minWidth = viewportWidth < 640 ? 180 : 240;
  return { minWidth, maxWidth: Math.max(minWidth, viewportWidth - 24) };
}

export function getStoryboardViewerPresetWidth(size: StoryboardViewerSize): number {
  return clampStoryboardViewerWidth(STORYBOARD_VIEWER_PRESET_WIDTH[size]);
}

function getStoryboardViewerViewport(): { width: number; height: number } {
  return {
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  };
}

function estimateStoryboardViewerHeight(width: number): number {
  return Math.min(getStoryboardViewerViewport().height - 16, width * (9 / 16) + STORYBOARD_VIEWER_VERTICAL_CHROME);
}

export function clampStoryboardViewerPosition(pos: StoryboardViewerPosition, width: number): StoryboardViewerPosition {
  const viewport = getStoryboardViewerViewport();
  const height = estimateStoryboardViewerHeight(width);
  return {
    x: Math.max(8, Math.min(pos.x, Math.max(8, viewport.width - width - 8))),
    y: Math.max(8, Math.min(pos.y, Math.max(8, viewport.height - height - 8))),
  };
}

export function getInitialStoryboardViewerPosition(width: number): StoryboardViewerPosition {
  const viewport = getStoryboardViewerViewport();
  const mobile = viewport.width < 640;
  return clampStoryboardViewerPosition(
    {
      x: mobile ? (viewport.width - width) / 2 : viewport.width - width - 16,
      y: mobile ? 76 : 72,
    },
    width,
  );
}

export function shouldIgnoreStoryboardViewerDragTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest("button,a,video,input,textarea,select,[data-storyboard-viewer-no-drag]")
  );
}

export function formatStoryboardSectionLabel(frame: GameTurnStoryboardKeyframe): string {
  const start = frame.sectionStartIndex ?? frame.sectionEndIndex;
  const end = frame.sectionEndIndex ?? frame.sectionStartIndex;
  if (start == null || end == null) return `Keyframe ${frame.index + 1}`;
  if (start === end) return `Section ${start + 1}`;
  return `Sections ${Math.min(start, end) + 1}-${Math.max(start, end) + 1}`;
}

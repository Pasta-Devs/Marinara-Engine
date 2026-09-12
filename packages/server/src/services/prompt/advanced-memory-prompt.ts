import { randomUUID } from "node:crypto";
import type { MarkerType, PromptRole, WrapFormat } from "@marinara-engine/shared";
import { pruneEmptyPromptWrappers } from "../generation/runtime-agent-sections.js";
import { wrapContent } from "./format-engine.js";
import { sanitizePromptLeaf } from "./prompt-escaping.js";

/** Already audience-filtered, format-neutral memory. An empty object enables the placement slots. */
export interface AdvancedMemoryPromptParts {
  chatSummary?: string | null;
  currentSceneSummary?: string | null;
  recalledScenes?: string | null;
  recalledMessages?: string | null;
}

const MEMORY_COMPONENTS = {
  chat_summary: {
    key: "chatSummary",
    name: "Chat Summary",
    introduction: "Below is a summary of earlier events known to this character.",
  },
  current_scene_summary: {
    key: "currentSceneSummary",
    name: "Current Scene Summary",
    introduction: "Below is a summary of the earlier part of the current scene; the scene is still ongoing.",
  },
  recalled_scenes: {
    key: "recalledScenes",
    name: "Recalled Scenes",
    introduction: "Below are earlier scenes relevant to the current situation.",
  },
  recalled_messages: {
    key: "recalledMessages",
    name: "Recalled Messages",
    introduction: "Below is a small excerpt from earlier chat history, included for context.",
  },
} as const;

export type AdvancedMemoryMarkerType = keyof typeof MEMORY_COMPONENTS;
export const ADVANCED_MEMORY_MARKER_TYPES = Object.keys(MEMORY_COMPONENTS) as AdvancedMemoryMarkerType[];

export interface AdvancedMemoryPlacement {
  key: keyof AdvancedMemoryPromptParts;
  markerType: AdvancedMemoryMarkerType;
  sectionId: string | null;
  sectionName: string;
  role: PromptRole;
  format: WrapFormat;
  token: string;
  /** Keep an otherwise-empty group out of the prompt after late audience selection. */
  groupTokens?: { start: string; end: string };
}

export function isAdvancedMemoryMarker(type: MarkerType): type is AdvancedMemoryMarkerType {
  return Object.prototype.hasOwnProperty.call(MEMORY_COMPONENTS, type);
}

export function advancedMemoryMarkerContent(type: AdvancedMemoryMarkerType, parts: AdvancedMemoryPromptParts): string {
  const component = MEMORY_COMPONENTS[type];
  const text = parts[component.key]?.trim();
  return text ? `${component.introduction}\n\n${text}` : "";
}

export function createAdvancedMemoryPlacement(
  markerType: AdvancedMemoryMarkerType,
  format: WrapFormat,
  section?: { id: string; name: string; role: string },
): AdvancedMemoryPlacement {
  const component = MEMORY_COMPONENTS[markerType];
  return {
    key: component.key,
    markerType,
    sectionId: section?.id ?? null,
    sectionName: section?.name ?? component.name,
    role: (section?.role ?? "system") as PromptRole,
    format,
    token: `__MARINARA_ADVANCED_MEMORY_${randomUUID()}__`,
  };
}

/** Group guards survive merging/scoping while leaving ordinary group text visible to those passes. */
export function guardAdvancedMemoryGroup<T extends { content: string }>(
  messages: T[],
  placements: AdvancedMemoryPlacement[],
): T[] {
  return messages.map((message) => {
    const members = placements.filter((placement) => message.content.includes(placement.token));
    if (members.length === 0) return message;
    const nonce = randomUUID();
    const groupTokens = {
      start: `__MARINARA_ADVANCED_MEMORY_GROUP_${nonce}_START__`,
      end: `__MARINARA_ADVANCED_MEMORY_GROUP_${nonce}_END__`,
    };
    for (const member of members) member.groupTokens = groupTokens;
    return { ...message, content: `${groupTokens.start}\n${message.content}\n${groupTokens.end}` };
  });
}

/** Report effective per-responder placement without changing the reusable assembly snapshot. */
export function describeAdvancedMemoryPlacements(
  messages: readonly { content: string }[],
  placements: readonly AdvancedMemoryPlacement[],
) {
  return placements.map(({ token, groupTokens: _groupTokens, ...placement }) => {
    const missing = !messages.some((message) => message.content.includes(token));
    return {
      ...placement,
      ...(missing
        ? { sectionId: null, sectionName: MEMORY_COMPONENTS[placement.markerType].name, role: "system" as const }
        : {}),
      fallback: missing || placement.sectionId === null,
    };
  });
}

/**
 * Pure finalization: call on the prepared per-responder snapshot before counting/sending.
 * Callers resolve any user-authored conditional macros in parts before passing them here.
 * Empty parts also provide a side-effect-free estimate of the fixed prompt overhead.
 */
export function resolveAdvancedMemoryPrompt<T extends { content: string }>(
  messages: readonly T[],
  placements: readonly AdvancedMemoryPlacement[],
  parts: AdvancedMemoryPromptParts,
): T[] {
  const result = messages.map((message) => ({ ...message }));
  const fallbackMessages: T[] = [];
  for (const placement of placements) {
    const content = sanitizePromptLeaf(advancedMemoryMarkerContent(placement.markerType, parts), placement.format);
    const rendered = wrapContent(content, placement.sectionName, placement.format);
    let emitted = false;
    const pattern = new RegExp(`(^[ \\t]*)?${placement.token}`, "gm");
    for (const message of result) {
      message.content = message.content.replace(pattern, (_match, indent: string | undefined) => {
        if (emitted || !rendered) return "";
        emitted = true;
        return rendered
          .split("\n")
          .map((line) => (line ? `${indent ?? ""}${line}` : ""))
          .join("\n");
      });
    }
    if (rendered && !emitted) {
      // Character scoping may remove an authored group; its memory still needs one safe placement.
      fallbackMessages.push({
        role: "system",
        contextKind: "prompt",
        content: wrapContent(content, MEMORY_COMPONENTS[placement.markerType].name, placement.format),
      } as unknown as T);
    }
  }
  const historyIndex = result.findIndex((message) => (message as { contextKind?: string }).contextKind === "history");
  const firstTurnIndex = result.findIndex((message) =>
    ["user", "assistant"].includes((message as { role?: string }).role ?? ""),
  );
  result.splice(
    historyIndex >= 0 ? historyIndex : firstTurnIndex >= 0 ? firstTurnIndex : result.length,
    0,
    ...fallbackMessages,
  );
  const groups = new Map(
    placements.flatMap((placement) =>
      placement.groupTokens ? [[placement.groupTokens.start, placement.groupTokens] as const] : [],
    ),
  );
  for (const tokens of groups.values()) {
    for (const message of result) {
      const pattern = new RegExp(`${tokens.start}([\\s\\S]*?)${tokens.end}`, "g");
      message.content = message.content
        .replace(pattern, (_match, content: string) => {
          const group = [{ content }];
          pruneEmptyPromptWrappers(group);
          return group[0]?.content ?? "";
        })
        .split(tokens.start)
        .join("")
        .split(tokens.end)
        .join("");
    }
  }
  pruneEmptyPromptWrappers(result);
  return result;
}

/**
 * Slice 79: what every omnibar row shows in its media slot and which part of its
 * text is bold. One resolver for all row builders, so none of them can forget it.
 *
 * - A row about a record shows that record's own picture (portrait, artwork, a
 *   chat's faces) and colour. A row derived from a record ("Add Eliza to…",
 *   "Start a chat with…", a message, a lorebook entry, a Fix row) finds it
 *   through the record its action already names, in the plain entity rows.
 * - Mari's own rows show her face.
 * - Everything else shows its type icon.
 * - The highlight comes from the search's own match when it ran; any other row
 *   is matched against the same queries the search uses.
 */
import type { CSSProperties } from "react";
import { Search, SlidersHorizontal, type LucideIcon } from "lucide-react";

import type { CommandCenterMediaKind } from "../components/command-center/CommandCenterMedia";
import type { CommandCenterPreviewData } from "../components/command-center/command-result-preview.types";
import type { CommandIcon, CommandKind } from "./command-center";
import { chatResultType, getCommandIcon, RESULT_TYPE_ICONS, type ResultType } from "./command-icons";
import {
  findOmnibarMatchRange,
  type OmnibarCategory,
  type OmnibarMatchRange,
  type OmnibarResult,
} from "./omnibar-search";

/** Mari's tall portrait, cropped to her face in a row's square media slot. */
export const MARI_FACE_CROP: CSSProperties = { objectPosition: "50% 8%" };

const CATEGORY_RESULT_TYPE: Partial<Record<OmnibarCategory, ResultType>> = {
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  connection: "connection",
  agent: "agent",
  settings: "setting",
  docs: "doc",
};

const RECORD_CATEGORIES = new Set<OmnibarCategory>([
  "chat",
  "character",
  "persona",
  "lorebook",
  "preset",
  "connection",
  "agent",
]);

/** Rows whose title quotes the query back ("Ask Mari: “eli”", "Create character “Bob”"): bolding it says nothing. */
const QUERY_ECHO_ROWS = new Set(["ask-professor-mari", "global-search:see-all"]);

/** Try rows that name a way of using the omnibar, not a kind of thing. */
const ROW_ICONS: Record<string, LucideIcon> = { "try:search": Search, "try:command": SlidersHorizontal };

type VisualRow = OmnibarResult & { command?: { icon?: CommandIcon; kind: CommandKind } };

/** The plain entity row (`character:<id>`, `chat:<id>`, …) a row is about, if any. */
export function omnibarRecordRowId(result: Pick<OmnibarResult, "id" | "category" | "action">): string | undefined {
  const action = result.action;
  switch (action?.kind) {
    case "add-to-chat":
    case "detach-from-chat":
      return `${action.resource}:${action.resourceId}`;
    case "start-character-chat":
      return `character:${action.characterId}`;
    case "goto-message":
      return `chat:${action.chatId}`;
    case "open-lorebook-entry":
      return `lorebook:${action.lorebookId}`;
  }
  return RECORD_CATEGORIES.has(result.category) && result.id.startsWith(`${result.category}:`) ? result.id : undefined;
}

function omnibarRowType(
  result: VisualRow,
  chatModeById: ReadonlyMap<string, string | undefined>,
): ResultType | undefined {
  const prefix = result.id.split(":")[0];
  if (prefix === "message") return "message";
  if (prefix === "mari-chat") return "mari-chat";
  if (prefix === "lorebook-entry") return "lorebook-entry";
  if (result.action?.kind === "start-chat") return chatResultType(result.action.mode);
  if (result.action?.kind === "start-character-chat") return "chat";
  if (result.category === "chat") {
    const mode = chatModeById.get(result.id);
    return mode ? chatResultType(mode) : undefined;
  }
  return CATEGORY_RESULT_TYPE[result.category];
}

function isMariRow(result: VisualRow) {
  return (
    Boolean(result.now) ||
    result.id === "try:mari" ||
    result.category === "professor" ||
    result.id.startsWith("mari-chat:")
  );
}

export type OmnibarRowVisualContext = {
  /** The plain entity rows by id: where a derived row finds its record's picture. */
  recordById: ReadonlyMap<string, OmnibarResult>;
  /** Chat modes by row id (`chat:<id>`), so a chat row shows its mode. */
  chatModeById: ReadonlyMap<string, string | undefined>;
  /** From `omnibarMatchQueries`; omitted while the field is empty. */
  matchQueries?: readonly string[];
  mariPortrait?: string;
};

export type OmnibarRowVisual = {
  type?: ResultType;
  icon: LucideIcon;
  src?: string;
  kind?: CommandCenterMediaKind;
  avatarCropStyle?: CSSProperties;
  faces?: CommandCenterPreviewData["participants"];
  faceCount?: number;
  accent?: string;
  titleMatch: OmnibarMatchRange | null;
  descriptionMatch: OmnibarMatchRange | null;
};

function firstMatch(queries: readonly string[] | undefined, text: string | undefined) {
  if (!queries || !text) return null;
  for (const query of queries) {
    const range = findOmnibarMatchRange(query, text);
    if (range) return range;
  }
  return null;
}

export function resolveOmnibarRowVisual(
  result: VisualRow,
  context: OmnibarRowVisualContext,
  preview: CommandCenterPreviewData | undefined = result.preview?.(),
): OmnibarRowVisual {
  const type = omnibarRowType(result, context.chatModeById);
  const icon =
    ROW_ICONS[result.id] ??
    (type && type !== "setting" && type !== "doc"
      ? RESULT_TYPE_ICONS[type]
      : getCommandIcon(result.command?.icon ?? result.icon, result.command?.kind ?? result.kind ?? "resource"));
  // `undefined` means the search never matched this row; `null` means it did and found no literal span.
  const echoesQuery = QUERY_ECHO_ROWS.has(result.id) || result.action?.kind === "create-named";
  const queries = echoesQuery ? undefined : context.matchQueries;
  const titleMatch = result.titleMatch !== undefined ? result.titleMatch : firstMatch(queries, result.title);
  const descriptionMatch =
    result.descriptionMatch !== undefined ? result.descriptionMatch : firstMatch(queries, result.description);
  const base = { type, icon, titleMatch, descriptionMatch };
  if (context.mariPortrait && isMariRow(result)) {
    return { ...base, src: context.mariPortrait, kind: "avatar", avatarCropStyle: MARI_FACE_CROP };
  }
  const record = context.recordById.get(omnibarRecordRowId(result) ?? "");
  const ownPicture = Boolean(preview?.media || preview?.participants?.length);
  // A derived row (or a row whose own preview replaced the record's, like the Fix row) borrows the record's picture.
  const source = !ownPicture && record?.preview && record.preview !== result.preview ? record.preview() : preview;
  return {
    ...base,
    src: source?.media?.src,
    kind: source?.media?.kind,
    avatarCropStyle: source?.media?.avatarCropStyle,
    faces: source?.participants,
    faceCount: source?.participantCount,
    accent: preview?.accent ?? source?.accent,
  };
}

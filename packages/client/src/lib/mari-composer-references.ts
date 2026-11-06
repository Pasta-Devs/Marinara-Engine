// Pure logic behind Professor Mari's `@` reference picker: which rows exist, how a query ranks them, how a
// pick is written into the draft, and which picked references are still in the text.
import type { MariComposerReference, ProfessorMariContextResource } from "@marinara-engine/shared";
import type { CSSProperties } from "react";
import { buildCharacterPreviewModel } from "./character-preview";
import { getCharacterDisplayIdentity } from "./character-display";
import { chatResultType } from "./command-icons";
import { buildLorebookPreviewModel } from "./lorebook-preview";
import { resolvePresetArtwork } from "./preset-artwork";
import { filterOmnibarFuzzyFallback, scoreOmnibarText } from "./omnibar-search";
import { normalizeProfessorMariNavigationQuery } from "./professor-mari-navigation";
import { getAvatarCropStyle } from "./utils";
import { formatReferenceToken, type ActiveComposerToken } from "./composer-triggers";
import type { MariCommandId } from "./mari-commands";

/** The server resolves at most this many references per message. */
export const MAX_COMPOSER_REFERENCES = 8;
/** Rows shown per group before the query narrows them. */
const ROWS_PER_GROUP = 8;
const ENTRY_ROWS = 30;

export type ReferenceGroupId =
  | "open"
  | "character"
  | "persona"
  | "lorebook"
  | "preset"
  | "skill"
  | "memory"
  | "chat"
  | "agent"
  | "doc"
  | "lorebookEntry";

export const REFERENCE_GROUP_ORDER: readonly ReferenceGroupId[] = [
  "open",
  "character",
  "persona",
  "lorebook",
  "preset",
  "skill",
  "memory",
  "chat",
  "agent",
  "doc",
  "lorebookEntry",
];

/** Whether a skill or memory is used on every turn, or on only when switched on. */
export type ReferenceState = "always" | "on" | "off";

export type ReferenceItem = {
  key: string;
  group: ReferenceGroupId;
  ref: MariComposerReference;
  /** A skill's or memory's switch, shown as the row's fact. */
  state?: ReferenceState;
  /** A doc's path, shown as the row's fact. */
  detail?: string;
  /** The row's face, read the way the omnibar and her reply rows read it; no face shows the kind's icon. */
  media?: ReferenceMedia;
};

export type ReferenceFace = { src?: string; avatarCropStyle?: CSSProperties };
/** An image (avatar or artwork), or for a chat the faces of who is in it with its mode as the badge. */
export type ReferenceMedia = ReferenceFace & {
  faces?: readonly ReferenceFace[];
  chatMode?: ReturnType<typeof chatResultType>;
};

type NamedRecord = {
  id?: unknown;
  name?: unknown;
  data?: unknown;
  comment?: unknown;
  origin?: unknown;
  enabled?: unknown;
  persistent?: unknown;
  avatarPath?: unknown;
  avatarCrop?: unknown;
  imagePath?: unknown;
  author?: unknown;
  mode?: unknown;
  characterIds?: unknown;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

function referenceMedia(
  group: ReferenceGroupId,
  raw: unknown,
  faceById: ReadonlyMap<string, ReferenceFace>,
): ReferenceMedia | undefined {
  const record = raw as NamedRecord;
  switch (group) {
    case "character": {
      const character = buildCharacterPreviewModel(raw);
      return character?.avatarSrc
        ? { src: character.avatarSrc, avatarCropStyle: character.avatarCropStyle }
        : undefined;
    }
    case "persona": {
      const src = text(record.avatarPath);
      return src
        ? { src, avatarCropStyle: getAvatarCropStyle(record.avatarCrop as Parameters<typeof getAvatarCropStyle>[0]) }
        : undefined;
    }
    case "lorebook": {
      const src = buildLorebookPreviewModel(raw as Parameters<typeof buildLorebookPreviewModel>[0]).imageSrc;
      return src ? { src } : undefined;
    }
    case "preset": {
      const src = resolvePresetArtwork({
        name: text(record.name) ?? "",
        author: text(record.author) ?? null,
        imagePath: text(record.imagePath) ?? null,
      });
      return src ? { src } : undefined;
    }
    case "agent": {
      const src = text(record.imagePath);
      return src ? { src } : undefined;
    }
    case "chat": {
      // Who is in it, like her reply rows: stacked faces, the first one standing in when there is one.
      const ids = Array.isArray(record.characterIds) ? record.characterIds : [];
      const faces = ids.flatMap((id) => {
        const face = typeof id === "string" ? faceById.get(id) : undefined;
        return face ? [face] : [];
      });
      return { ...faces[0], faces, chatMode: chatResultType(text(record.mode)) };
    }
    default:
      return undefined;
  }
}

/** Only skills and memories are linkable from `/`; the other kinds are `@` picks. */
export function isSlashLinkable(item: Pick<ReferenceItem, "group">): boolean {
  return item.group === "skill" || item.group === "memory";
}

/** The picker's rows once a `/` token is open: a command (no reference) or a ranked reference. */
export type CommandRow = { key: string; group: "command"; command: MariCommandId; score: number };
/** A field of the editor she is docked beside: picking it makes it her field, not a link. */
export type FieldRow = { key: string; group: "field"; field: { id: string; label: string }; score: number };
export type PickerRow = RankedReferenceItem | CommandRow | FieldRow;

export function isCommandRow(row: PickerRow | undefined): row is CommandRow {
  return row?.group === "command";
}

export function isFieldRow(row: PickerRow | undefined): row is FieldRow {
  return row?.group === "field";
}

/** A row that links a record (not a command or a field). */
export function isLinkRow(row: PickerRow | undefined): row is RankedReferenceItem {
  return row !== undefined && !isCommandRow(row) && !isFieldRow(row);
}

export function fieldRow(field: { id: string; label: string }, score: number): FieldRow {
  return { key: `field:${field.id}`, group: "field", field, score };
}

/** The docked editor's fields matching a typed query, best first; none until something is typed (the
 * open editor's row lists them all). */
export function rankFieldRows(fields: readonly { id: string; label: string }[], query: string): FieldRow[] {
  if (!maskReferenceQuery(query).trim()) return [];
  const scored: Array<FieldRow & { index: number }> = [];
  fields.forEach((field, index) => {
    const score = referenceMatchScore(field.label, query);
    if (score !== null) scored.push({ ...fieldRow(field, score), index });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, ROWS_PER_GROUP)
    .map(({ index: _index, ...row }) => row);
}

/** The picker's rows from the lists the composer already loads for its ghost completion. */
export function buildReferenceItems(sources: {
  characters?: readonly unknown[];
  personas?: readonly unknown[];
  lorebooks?: readonly unknown[];
  presets?: readonly unknown[];
  skills?: readonly unknown[];
  memories?: readonly unknown[];
  chats?: readonly unknown[];
  agents?: readonly unknown[];
  /** The canonical docs: `path` is the id, `title` the label. */
  docs?: readonly unknown[];
}): ReferenceItem[] {
  const items: ReferenceItem[] = [];
  const faceById = new Map<string, ReferenceFace>();
  const add = (
    group: Exclude<ReferenceGroupId, "open" | "lorebookEntry" | "doc">,
    list: readonly unknown[] | undefined,
  ) => {
    for (const raw of list ?? []) {
      const record = raw as NamedRecord;
      if (typeof record.id !== "string") continue;
      const label = (
        group === "character"
          ? getCharacterDisplayIdentity({ data: record.data, comment: record.comment as string | null | undefined })
          : typeof record.name === "string"
            ? record.name
            : ""
      ).trim();
      if (!label) continue;
      const item: ReferenceItem = { key: `${group}:${record.id}`, group, ref: { kind: group, id: record.id, label } };
      const media = referenceMedia(group, raw, faceById);
      if (media) item.media = media;
      // Every character is a face, a placeholder when it has no avatar, as in her reply rows.
      if (group === "character") faceById.set(record.id, media ?? {});
      if (group === "skill") item.state = record.origin === "builtin" ? "always" : record.enabled ? "on" : "off";
      if (group === "memory") item.state = record.enabled ? "on" : "off";
      items.push(item);
    }
  };
  add("character", sources.characters);
  add("persona", sources.personas);
  add("lorebook", sources.lorebooks);
  add("preset", sources.presets);
  add("skill", sources.skills);
  // A persistent memory is in every turn already; only the others are worth linking.
  add(
    "memory",
    sources.memories?.filter((memory) => (memory as NamedRecord).persistent !== true),
  );
  add("chat", sources.chats);
  add("agent", sources.agents);
  for (const raw of sources.docs ?? []) {
    const { path, title } = raw as { path?: unknown; title?: unknown };
    if (typeof path !== "string" || !path) continue;
    const label = (typeof title === "string" ? title : "").trim() || path;
    items.push({ key: `doc:${path}`, group: "doc", ref: { kind: "doc", id: path, label }, detail: path });
  }
  return items;
}

/** A lorebook's entries as rows (one drill-down level). */
export function buildEntryItems(lorebook: { id: string }, entries: readonly unknown[] | undefined): ReferenceItem[] {
  const items: ReferenceItem[] = [];
  for (const raw of entries ?? []) {
    const record = raw as NamedRecord;
    const label = typeof record.name === "string" ? record.name.trim() : "";
    if (typeof record.id !== "string" || !label) continue;
    items.push({
      key: `entry:${record.id}`,
      group: "lorebookEntry",
      ref: { kind: "lorebookEntry", id: record.id, label, parentId: lorebook.id },
    });
  }
  return items;
}

const OPENABLE_KINDS = new Set<MariComposerReference["kind"]>(["character", "persona", "lorebook", "preset"]);

/** The open editor's resource as a reference, or null when the resolver cannot read that kind. */
export function referenceFromResource(resource: ProfessorMariContextResource | null | undefined): ReferenceItem | null {
  if (!resource || !OPENABLE_KINDS.has(resource.kind as MariComposerReference["kind"])) return null;
  const label = (resource.label ?? "").trim();
  if (!resource.id || !label) return null;
  const kind = resource.kind as MariComposerReference["kind"];
  return { key: `open:${kind}:${resource.id}`, group: "open", ref: { kind, id: resource.id, label } };
}

export function sameReference(a: MariComposerReference, b: MariComposerReference): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** The query without its `@` / `@"` opener and closing quote: the picker and the ghost read the same text. */
export function maskReferenceQuery(raw: string): string {
  return raw.replace(/^@"?/, "").replace(/"$/, "").trimStart();
}

/**
 * The omnibar's score for a label (higher is better; under 100 is a typo or initials match), 0 for an empty
 * query so every row lists, and null when the label does not match.
 */
export function referenceMatchScore(label: string, query: string): number | null {
  const needle = maskReferenceQuery(query);
  if (!needle.trim()) return 0;
  // The omnibar folds everything but letters and digits away, so "★" or "!!" would match nothing.
  if (!normalizeProfessorMariNavigationQuery(needle) || !normalizeProfessorMariNavigationQuery(label)) {
    return label.toLocaleLowerCase().includes(needle.trim().toLocaleLowerCase()) ? 100 : null;
  }
  const score = scoreOmnibarText(needle, [label]);
  return score < 0 ? null : score;
}

export type RankedReferenceItem = ReferenceItem & { score: number };

/** Like the omnibar, a typo match is shown only when nothing matches literally. */
export function withoutFuzzyNoise<T extends { key: string; score: number }>(rows: readonly T[]): T[] {
  return filterOmnibarFuzzyFallback(
    rows.map((row) => ({
      id: row.key,
      score: row.score,
      matchKind: row.score > 0 && row.score < 100 ? ("fuzzy" as const) : ("literal" as const),
      row,
    })),
  ).map(({ row }) => row);
}

/** Matching rows, grouped in `REFERENCE_GROUP_ORDER`; best match first inside a group, list order on ties. */
export function rankReferenceItems(
  items: readonly ReferenceItem[],
  query: string,
  limit = ROWS_PER_GROUP,
): RankedReferenceItem[] {
  const scored: Array<RankedReferenceItem & { index: number }> = [];
  items.forEach((item, index) => {
    const score = referenceMatchScore(item.ref.label, query);
    if (score !== null) scored.push({ ...item, score, index });
  });
  const matched = withoutFuzzyNoise(scored);
  const out: RankedReferenceItem[] = [];
  for (const group of REFERENCE_GROUP_ORDER) {
    const cap = group === "lorebookEntry" ? ENTRY_ROWS : group === "open" ? 1 : limit;
    matched
      .filter((item) => item.group === group)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, cap)
      .forEach(({ index: _index, ...item }) => out.push(item));
  }
  return out;
}

/** The row to highlight first: the best match anywhere, the earliest row on a tie (the open editor's row leads). */
export function defaultActiveIndex(rows: readonly { score: number }[]): number {
  let best = 0;
  rows.forEach((row, index) => {
    if (row.score > rows[best]!.score) best = index;
  });
  return best;
}

/** Writes the picked token over the live `@` token and returns the new text and where the caret goes. */
export function applyReferencePick(
  draft: string,
  token: Pick<ActiveComposerToken, "start" | "end">,
  ref: MariComposerReference,
): { value: string; caret: number } {
  const text = formatReferenceToken(ref.label);
  const after = draft.slice(token.end);
  const space = /^\s/.test(after) ? "" : " ";
  return {
    value: draft.slice(0, token.start) + text + space + after,
    // Past the space, so the caret leaves the token and the picker does not reopen on it.
    caret: token.start + text.length + 1,
  };
}

const OPENERS = "([{\"'";

function boundaryBefore(text: string, index: number): boolean {
  return index === 0 || /\s/.test(text[index - 1]!) || OPENERS.includes(text[index - 1]!);
}

/**
 * The label the draft already ends with, as a name the ghost just completed: the draft's last word, or its
 * last two or three words joined ("Alice in Wonderland"). Case-insensitive; the longest wins.
 */
export function completedNameAt(draft: string, labels: readonly string[]): { start: number; label: string } | null {
  const tail = draft.trimEnd();
  const lowerTail = tail.toLowerCase();
  let best: { start: number; label: string } | null = null;
  for (const raw of labels) {
    const label = raw.trim();
    if (label.length <= 2) continue;
    const start = lowerTail.length - label.length;
    if (start < 0 || !lowerTail.endsWith(label.toLowerCase()) || !boundaryBefore(tail, start)) continue;
    if (!best || label.length > best.label.length) best = { start, label };
  }
  return best;
}

/**
 * The pick the second Tab makes on a just-completed name. The ghost inserts the label's suffix, so the draft
 * always ends with a full label; the object it names is the row with that label.
 */
export function linkCompletedReference(
  draft: string,
  labels: readonly string[],
  refs: readonly MariComposerReference[],
): { value: string; caret: number; ref: MariComposerReference } | null {
  const found = completedNameAt(draft, labels);
  if (!found) return null;
  const lower = found.label.trim().toLowerCase();
  const ref = refs.find((item) => item.label.trim().toLowerCase() === lower);
  if (!ref) return null;
  // The reference's own token, not the typed casing: the draft is searched for exactly this text.
  const token = formatReferenceToken(ref.label);
  return {
    value: `${draft.slice(0, found.start)}${token}${draft.slice(found.start + found.label.length)}`,
    caret: found.start + token.length,
    ref,
  };
}

/** Where each reference's token still sits in the draft, in order (one slot per reference, null when its
 * text was edited or removed). The same token twice takes its occurrences in turn.
 */
export function locateReferenceTokens(
  draft: string,
  refs: readonly MariComposerReference[],
): Array<{ start: number; end: number } | null> {
  const used = new Set<number>();
  return refs.map((ref) => {
    const token = formatReferenceToken(ref.label);
    for (let at = draft.indexOf(token); at !== -1; at = draft.indexOf(token, at + 1)) {
      const end = at + token.length;
      // A bare token may hold spaces, so only its start must be a boundary; its end must too, unless the
      // draft simply goes on with more words of the same name.
      const after = draft[end];
      const endsClean =
        end >= draft.length || after === undefined || /[\s.,;:!?)\]}"']/u.test(after) || /["<>]/u.test(after);
      if (used.has(at) || !boundaryBefore(draft, at) || !endsClean) continue;
      used.add(at);
      return { start: at, end };
    }
    return null;
  });
}

/** Keeps only references whose token is still in the draft. Returns `refs` itself when none dropped. */
export function pruneReferences(
  draft: string,
  refs: readonly MariComposerReference[],
): readonly MariComposerReference[] {
  const spots = locateReferenceTokens(draft, refs);
  const kept = refs.filter((_, index) => spots[index]);
  return kept.length === refs.length ? refs : kept;
}

/** Adds `ref` unless it is already there or the server cap is reached. */
export function addReference(refs: readonly MariComposerReference[], ref: MariComposerReference) {
  if (refs.some((item) => sameReference(item, ref)) || refs.length >= MAX_COMPOSER_REFERENCES) return refs;
  return [...refs, ref];
}

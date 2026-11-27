/**
 * Slice 74: the change receipt. When Professor Mari applies a change, the server keeps a small record of
 * it on her message - per field a short before/after excerpt or the names a list gained and lost, her
 * reason, the undo deadline - so the card under her answer stays full after Keep, Undo or a reload. The
 * undo record holds the whole rows but is deleted on Keep / Undo; this record is what survives.
 */
import type {
  MariChangeExcerpt,
  MariChangeListItem,
  MariDbRowChange,
  MariWorkspaceActionResult,
} from "../types/professor-mari-workspace.js";

export const MARI_RECEIPT_LIMITS = {
  // ponytail: per-record caps keep a message extra under ~60 KB per record; raise if users hit them.
  /** Fields per record. */
  changes: 40,
  /** Characters per side of a text excerpt, when the whole text is not kept. */
  text: 600,
  /** Characters per side kept whole, so the card can show the full old and new text. */
  fullText: 8000,
  /** Characters of whole text (both sides, every field and entry) one record keeps; past it, excerpts. */
  recordText: 24000,
  /** Characters of a switch, enum or number. */
  value: 40,
  /** Names per list group (added / edited / removed), and entries per list's items. */
  names: 25,
  /** Changed keys shown per nested object (an extension's settings, interactive onboarding). */
  nestedKeys: 12,
  /** Characters per list name. */
  name: 60,
  /** Characters of a lorebook entry's text, shown under its name, when the whole text is not kept. */
  entryText: 300,
  /** Records per message. */
  records: 12,
  /** Characters of her reason. */
  reason: 160,
} as const;

// Editor order for the fields a card usually changes; anything else follows in row order.
const FIELD_ORDER = [
  "name",
  "title",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "alternate_greetings",
  "mes_example",
  "system_prompt",
  "post_history_instructions",
  "creator_notes",
  "tags",
  "character_book",
  "content",
  "keys",
];
const NOISE_FIELDS = new Set(["id", "createdAt", "updatedAt", "created_at", "updated_at", "embedding"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Her reason as the user reads it; the prompt's old boilerplate ("User asked to…") says nothing. */
export function mariReceiptReason(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.replace(/\s+/gu, " ").trim();
  if (!text) return undefined;
  if (/^(?:the )?user(?:'s)? (?:asked|requested|request|wants|wanted|said|told)\b/iu.test(text)) return undefined;
  if (/^(?:update|change|edit) requested by (?:the )?user\b/iu.test(text)) return undefined;
  if (/^quick mari edit proposal\b/iu.test(text)) return undefined;
  return clip(text, MARI_RECEIPT_LIMITS.reason);
}

/**
 * The same window of both texts, starting a little before the first difference, so a small edit in a
 * long field shows the edit and not the field's first 200 characters.
 */
export function excerptTextPair(before: string, after: string, max: number = MARI_RECEIPT_LIMITS.text) {
  let prefix = 0;
  const shorter = Math.min(before.length, after.length);
  while (prefix < shorter && before[prefix] === after[prefix]) prefix += 1;
  let start = prefix > 80 ? prefix - 60 : 0;
  // Start on a word: the shared prefix is identical in both texts, so one cut fits both.
  if (start > 0) {
    const space = before.indexOf(" ", start);
    if (space !== -1 && space < prefix) start = space + 1;
  }
  const cut = (text: string) => {
    if (!text) return "";
    const end = start + max;
    return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
  };
  return { before: cut(before), after: cut(after) };
}

// The whole-text allowance of the record being built. buildMariChangeExcerpts is synchronous and sets it
// for its own call, so one record's long fields cannot crowd out another's.
let wholeTextLeft = 0;

/** Keep both sides whole when they fit the record's allowance; `false` means use excerpts. */
function takeWholeText(...texts: string[]): boolean {
  const size = texts.reduce((sum, text) => sum + text.length, 0);
  if (texts.some((text) => text.length > MARI_RECEIPT_LIMITS.fullText) || size > wholeTextLeft) return false;
  wholeTextLeft -= size;
  return true;
}

function isJsonText(value: string): boolean {
  if (!/^\s*[[{]/u.test(value)) return false;
  try {
    return typeof JSON.parse(value) === "object";
  } catch {
    return false;
  }
}

function itemKey(item: unknown): string {
  if (typeof item === "string") return item;
  if (isRecord(item)) {
    const id = item.id ?? item.uid ?? item.name ?? item.comment;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return JSON.stringify(item);
}

function itemName(item: unknown): string {
  if (typeof item === "string") return clip(item, 40);
  if (isRecord(item)) {
    const keys = Array.isArray(item.keys) ? item.keys : Array.isArray(item.key) ? item.key : [];
    for (const value of [item.name, item.comment, item.title, keys[0], item.content]) {
      if (typeof value === "string" && value.trim()) return clip(value, MARI_RECEIPT_LIMITS.name);
    }
  }
  return clip(typeof item === "number" ? String(item) : (JSON.stringify(item) ?? ""), MARI_RECEIPT_LIMITS.name);
}

function listExcerpt(
  field: string,
  added: string[],
  edited: string[],
  removed: string[],
  items: MariChangeListItem[] = [],
): Extract<MariChangeExcerpt, { kind: "list" }> | null {
  if (added.length + edited.length + removed.length === 0) return null;
  const names = (values: string[]) => [...new Set(values)].slice(0, MARI_RECEIPT_LIMITS.names);
  return {
    field,
    kind: "list",
    added: names(added),
    edited: names(edited),
    removed: names(removed),
    count: { added: added.length, edited: edited.length, removed: removed.length },
    ...(items.length ? { items: items.slice(0, MARI_RECEIPT_LIMITS.names) } : {}),
  };
}

/**
 * A lorebook entry's (or preset section's) keys and text, so the card shows what the entry does, not only
 * its name. An edited entry also keeps its old text, so the card can show what changed in it.
 */
function itemDetail(item: unknown, previous?: unknown): MariChangeListItem {
  const name = itemName(item);
  if (!isRecord(item)) return { name };
  const content = typeof item.content === "string" ? item.content : "";
  const oldContent = isRecord(previous) && typeof previous.content === "string" ? previous.content : undefined;
  const edited = oldContent !== undefined && oldContent !== content;
  const rawKeys = Array.isArray(item.keys) ? item.keys : Array.isArray(item.key) ? item.key : [];
  const keys = rawKeys
    .filter((key): key is string => typeof key === "string" && key.trim() !== "")
    .slice(0, MARI_RECEIPT_LIMITS.names)
    .map((key) => clip(key, MARI_RECEIPT_LIMITS.name));
  const whole = content || edited ? takeWholeText(content, edited ? oldContent : "") : false;
  // `full` marks text longer than an excerpt; short text is whole either way and keeps the older shape.
  const long = (...texts: string[]) => texts.some((text) => text.length > MARI_RECEIPT_LIMITS.entryText);
  if (edited && whole) {
    return {
      name,
      ...(keys.length ? { keys } : {}),
      text: content,
      before: oldContent,
      ...(long(content, oldContent) ? { full: true as const } : {}),
    };
  }
  if (edited) {
    const pair = excerptTextPair(oldContent, content, MARI_RECEIPT_LIMITS.entryText);
    return { name, ...(keys.length ? { keys } : {}), ...(pair.after ? { text: pair.after } : {}), before: pair.before };
  }
  const text = whole && long(content) ? content : content ? clip(content, MARI_RECEIPT_LIMITS.entryText) : "";
  return {
    name,
    ...(keys.length ? { keys } : {}),
    ...(text ? { text } : {}),
    ...(whole && long(content) ? { full: true as const } : {}),
  };
}

function diffList(field: string, before: unknown[], after: unknown[]) {
  const old = new Map(before.map((item) => [itemKey(item), item]));
  const now = new Map(after.map((item) => [itemKey(item), item]));
  const added: string[] = [];
  const edited: string[] = [];
  const removed: string[] = [];
  const items: MariChangeListItem[] = [];
  for (const [key, item] of now) {
    if (!old.has(key)) added.push(itemName(item));
    else if (JSON.stringify(old.get(key)) !== JSON.stringify(item)) edited.push(itemName(item));
    else continue;
    items.push(itemDetail(item, old.get(key)));
  }
  for (const [key, item] of old) if (!now.has(key)) removed.push(itemName(item));
  return listExcerpt(field, added, edited, removed, items);
}

/** A list held in an object (a character's lorebook: `{ entries: [...] }`). */
function entriesOf(value: unknown): unknown[] | null {
  return isRecord(value) && Array.isArray(value.entries) ? value.entries : null;
}

/** JSON text (an extensions blob) reads as the object it holds; other text stays text. */
function parsedJson(value: unknown): unknown {
  if (typeof value !== "string" || !isJsonText(value)) return value;
  return JSON.parse(value);
}

function primitiveExcerpt(field: string, before: unknown, after: unknown): MariChangeExcerpt {
  if (typeof before === "string" || typeof after === "string") {
    const oldText = typeof before === "string" ? before : before == null ? "" : String(before);
    const newText = typeof after === "string" ? after : after == null ? "" : String(after);
    const long = oldText.length > MARI_RECEIPT_LIMITS.text || newText.length > MARI_RECEIPT_LIMITS.text;
    // Text that fits an excerpt is whole either way and keeps the older shape; longer text is kept whole
    // while the record's allowance lasts.
    if (long && takeWholeText(oldText, newText)) {
      return { field, kind: "text", before: oldText, after: newText, full: true };
    }
    return { field, kind: "text", ...excerptTextPair(oldText, newText) };
  }
  const show = (value: unknown) => clip(value == null ? "" : String(value), MARI_RECEIPT_LIMITS.value);
  return { field, kind: "value", before: show(before), after: show(after) };
}

/**
 * Interactive onboarding (`data.extensions.onboarding`): the facts the card can say in words. Absent
 * or malformed keeps it a plain nested object; a removed onboarding reads as off with no questions.
 */
function onboardingFacts(
  after: unknown,
): { enabled: boolean; personaQuestions: number; characterQuestions: number } | undefined {
  if (after === undefined || after === null) return { enabled: false, personaQuestions: 0, characterQuestions: 0 };
  if (!isRecord(after) || (!Array.isArray(after.variables) && !Array.isArray(after.cardVariables))) return undefined;
  const questions = (key: string) => (Array.isArray(after[key]) ? after[key].length : 0);
  return {
    enabled: after.enabled === true,
    personaQuestions: questions("variables"),
    characterQuestions: questions("cardVariables"),
  };
}

/**
 * A nested object the card cannot draw in full: its changed keys by name, so onboarding or an
 * extension's settings are visible instead of only counted.
 */
function nestedExcerpt(field: string, before: unknown, after: unknown): Extract<MariChangeExcerpt, { kind: "nested" }> {
  const onboarding = field === "extensions.onboarding" ? onboardingFacts(after) : undefined;
  const oldObject = isRecord(before) ? before : {};
  const newObject = isRecord(after) ? after : {};
  // A key empty on both sides says nothing: a written onboarding's untouched prose fields must not
  // read as changed just because the whole object is new.
  const empty = (value: unknown) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.keys(value).length === 0);
  const changed = [...new Set([...Object.keys(oldObject), ...Object.keys(newObject)])]
    .filter((key) => !NOISE_FIELDS.has(key))
    .filter((key) => !(empty(oldObject[key]) && empty(newObject[key])))
    .filter((key) => JSON.stringify(oldObject[key]) !== JSON.stringify(newObject[key]))
    // The onboarding state word says whether it is on; the key would only repeat it.
    .filter((key) => !(onboarding && key === "enabled"));
  return {
    field,
    kind: "nested",
    // Uncapped and unclipped, so two runs on the same object merge into the exact distinct union.
    keys: changed,
    count: changed.length,
    ...(onboarding ? { onboarding } : {}),
  };
}

/**
 * The excerpts of one changed field. A nested object (a preset's `parameters`, an extension's settings)
 * is read one level: each changed setting becomes its own `field.key` excerpt. A deeper object becomes
 * one `nested` excerpt with its changed keys, and a deeper list becomes a list excerpt. A child change
 * the card cannot draw at all (a list whose only difference is its order) is counted in `undrawn`.
 */
function fieldExcerpts(
  field: string,
  rawBefore: unknown,
  rawAfter: unknown,
  undrawn: { count: number } = { count: 0 },
): MariChangeExcerpt[] {
  const before = parsedJson(rawBefore);
  const after = parsedJson(rawAfter);
  // JSON text swapped for plain text is a rewrite of the text, not a change of its keys.
  if (typeof before !== typeof after && (typeof before === "string" || typeof after === "string")) {
    return [primitiveExcerpt(field, before, after)];
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    const list = diffList(field, Array.isArray(before) ? before : [], Array.isArray(after) ? after : []);
    return list ? [list] : [];
  }
  if (isRecord(before) || isRecord(after)) {
    const oldEntries = entriesOf(before);
    const newEntries = entriesOf(after);
    if (oldEntries || newEntries) {
      const list = diffList(field, oldEntries ?? [], newEntries ?? []);
      return list ? [list] : [];
    }
    const oldObject = isRecord(before) ? before : {};
    const newObject = isRecord(after) ? after : {};
    const excerpts: MariChangeExcerpt[] = [];
    for (const key of new Set([...Object.keys(oldObject), ...Object.keys(newObject)])) {
      const nestedBefore = oldObject[key];
      const nestedAfter = newObject[key];
      if (JSON.stringify(nestedBefore) === JSON.stringify(nestedAfter)) continue;
      if (Array.isArray(nestedBefore) || Array.isArray(nestedAfter)) {
        const list = diffList(
          `${field}.${key}`,
          Array.isArray(nestedBefore) ? nestedBefore : [],
          Array.isArray(nestedAfter) ? nestedAfter : [],
        );
        if (list) excerpts.push(list);
        else undrawn.count += 1;
      } else if (isRecord(nestedBefore) || isRecord(nestedAfter)) {
        const nested = nestedExcerpt(`${field}.${key}`, nestedBefore, nestedAfter);
        // Only noisy keys changed inside it (an id): nothing to draw, but the change still counts.
        if (nested.count === 0 && !nested.onboarding) undrawn.count += 1;
        else excerpts.push(nested);
      } else {
        excerpts.push(primitiveExcerpt(`${field}.${key}`, nestedBefore, nestedAfter));
      }
    }
    return excerpts;
  }
  return [primitiveExcerpt(field, before, after)];
}

function rowFields(row: Record<string, unknown> | null | undefined, nested: boolean) {
  if (!row) return null;
  return nested && isRecord(row.data) ? row.data : row;
}

/**
 * The excerpts of one record: its own row's changed fields, plus its child rows (lorebook entries,
 * preset sections) as one list per kind. `children` carries each child row with the field its list
 * goes under.
 */
export function buildMariChangeExcerpts(input: {
  direct?: MariDbRowChange | null;
  children?: ReadonlyArray<{ field: string; change: MariDbRowChange }>;
}): { changes: MariChangeExcerpt[]; moreChanges: number } {
  wholeTextLeft = MARI_RECEIPT_LIMITS.recordText;
  const changes: MariChangeExcerpt[] = [];
  let unshown = 0;
  const direct = input.direct;
  if (direct?.after) {
    const nested = isRecord(direct.after.data);
    const before = rowFields(direct.before, nested);
    const after = rowFields(direct.after, nested) ?? {};
    const keys = Object.keys(after)
      // A preset's section order is ids, not words; the sections list says what moved.
      .filter((key) => !NOISE_FIELDS.has(key) && !/Order$/u.test(key))
      .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]));
    const rank = (key: string) => (FIELD_ORDER.includes(key) ? FIELD_ORDER.indexOf(key) : FIELD_ORDER.length);
    keys.sort((a, b) => rank(a) - rank(b));
    for (const key of keys) {
      const undrawn = { count: 0 };
      const excerpts = fieldExcerpts(key, before?.[key], after[key], undrawn);
      // A change the card cannot draw (a list whose only difference is its order) still counts, so
      // the field never disappears from an applied receipt.
      unshown += excerpts.length === 0 ? Math.max(1, undrawn.count) : undrawn.count;
      changes.push(...excerpts);
    }
  }
  const lists = new Map<
    string,
    { added: string[]; edited: string[]; removed: string[]; items: MariChangeListItem[] }
  >();
  for (const { field, change } of input.children ?? []) {
    const list = lists.get(field) ?? { added: [], edited: [], removed: [], items: [] };
    lists.set(field, list);
    const row = change.after ?? change.before;
    const name = itemName(row);
    if (change.action === "insert") list.added.push(name);
    else if (change.action === "delete") list.removed.push(name);
    else list.edited.push(name);
    if (change.action !== "delete")
      list.items.push(itemDetail(row, change.action === "insert" ? undefined : change.before));
  }
  for (const [field, list] of lists) {
    const excerpt = listExcerpt(field, list.added, list.edited, list.removed, list.items);
    if (excerpt) changes.push(excerpt);
  }
  // A created record leads with its text and lists (what it is), then its switches and numbers.
  if (!direct?.before) changes.sort((a, b) => Number(a.kind === "value") - Number(b.kind === "value"));
  return capChanges(changes, unshown);
}

function capChanges(changes: MariChangeExcerpt[], moreChanges: number) {
  const overflow = Math.max(0, changes.length - MARI_RECEIPT_LIMITS.changes);
  return { changes: changes.slice(0, MARI_RECEIPT_LIMITS.changes), moreChanges: moreChanges + overflow };
}

/** The reviews a record can still Keep or Undo, old messages included. */
export function mariReceiptReviewIds(result: Pick<MariWorkspaceActionResult, "reviewId" | "reviewIds">): string[] {
  return result.reviewIds?.length ? result.reviewIds : result.reviewId ? [result.reviewId] : [];
}

/**
 * One item per entry: an entry edited twice in a run shows once, from the text the run found to the text
 * it left. An entry added earlier in the run (no old text) keeps the later item as it is.
 */
function mergeListItems(older: MariChangeListItem[], newer: MariChangeListItem[]): MariChangeListItem[] {
  const byName = new Map(older.map((item) => [item.name, item]));
  for (const next of newer) {
    const prev = byName.get(next.name);
    // Without old text from earlier in the run (an entry added in it), the later item stands as it is. A later
    // keys-only edit has no old text of its own; the entry still starts from where the run found it.
    if (prev?.before === undefined) {
      byName.set(next.name, next);
      continue;
    }
    const { full: _full, before: _before, ...rest } = next;
    const long = [prev.before, next.text ?? ""].some((text) => text.length > MARI_RECEIPT_LIMITS.entryText);
    byName.set(next.name, { ...rest, before: prev.before, ...(prev.full && next.full && long ? { full: true } : {}) });
  }
  return [...byName.values()];
}

/**
 * A merged record holds the whole text of every command in its run; it keeps the same allowance as one
 * command's record. Past it, the later fields and entries fall back to excerpts.
 */
function fitWholeText(changes: MariChangeExcerpt[]): MariChangeExcerpt[] {
  let left = MARI_RECEIPT_LIMITS.recordText;
  const fits = (...texts: string[]) => {
    const size = texts.reduce((sum, text) => sum + text.length, 0);
    if (size > left) return false;
    left -= size;
    return true;
  };
  return changes.map((change) => {
    if (change.kind === "text" && change.full) {
      if (fits(change.before, change.after)) return change;
      const { full: _full, ...rest } = change;
      return { ...rest, ...excerptTextPair(change.before, change.after) };
    }
    if (change.kind !== "list" || !change.items?.some((item) => item.full)) return change;
    const items = change.items.map((item): MariChangeListItem => {
      if (!item.full || fits(item.before ?? "", item.text ?? "")) return item;
      const { full: _full, ...rest } = item;
      if (item.before === undefined) return { ...rest, text: clip(item.text ?? "", MARI_RECEIPT_LIMITS.entryText) };
      const pair = excerptTextPair(item.before, item.text ?? "", MARI_RECEIPT_LIMITS.entryText);
      return { ...rest, text: pair.after, before: pair.before };
    });
    return { ...change, items };
  });
}

function mergeExcerpts(older: MariChangeExcerpt[], newer: MariChangeExcerpt[]): MariChangeExcerpt[] {
  const merged = [...older];
  for (const next of newer) {
    const index = merged.findIndex((change) => change.field === next.field && change.kind === next.kind);
    const prev = merged[index];
    if (!prev) merged.push(next);
    else if (prev.kind === "list" && next.kind === "list") {
      const added = [...prev.added, ...next.added];
      const listed = listExcerpt(
        next.field,
        added,
        [...prev.edited, ...next.edited].filter((name) => !added.includes(name)),
        [...prev.removed, ...next.removed],
        mergeListItems(prev.items ?? [], next.items ?? []),
      );
      if (listed) {
        merged[index] = {
          ...listed,
          count: {
            added: prev.count.added + next.count.added,
            edited: prev.count.edited + next.count.edited,
            removed: prev.count.removed + next.count.removed,
          },
        };
      }
    } else if (prev.kind === "nested" && next.kind === "nested") {
      // Both runs changed the same nested object: every key either of them touched, said once. The
      // union is the exact count; the card decides how many of them to show.
      const keys = [...new Set([...prev.keys, ...next.keys])];
      merged[index] = { ...next, keys, count: Math.max(prev.count, next.count, keys.length) };
    } else if (prev.kind !== "list" && prev.kind !== "nested" && next.kind !== "list" && next.kind !== "nested") {
      // First before, last after: the field from where the run found it to where it left it.
      const { full: _full, ...rest } = prev as Extract<MariChangeExcerpt, { kind: "text" }>;
      const whole = prev.kind === "text" && next.kind === "text" && prev.full && next.full;
      merged[index] = { ...rest, after: next.after, ...(whole ? { full: true } : {}) } as MariChangeExcerpt;
    }
  }
  return merged;
}

/**
 * One record per thing a run changed: two commands on the same lorebook (two entries) become one
 * receipt with both entries and both reviews. Order is first appearance; at most `records` records.
 */
export function mergeMariActionResults(results: readonly MariWorkspaceActionResult[]): MariWorkspaceActionResult[] {
  const byRecord = new Map<string, MariWorkspaceActionResult>();
  for (const result of results) {
    const key = `${result.resource.kind}:${result.resource.id}`;
    const prev = byRecord.get(key);
    if (!prev) {
      byRecord.set(key, { ...result });
      continue;
    }
    const reviewIds = [...new Set([...mariReceiptReviewIds(prev), ...mariReceiptReviewIds(result)])];
    const changes =
      prev.changes || result.changes ? mergeExcerpts(prev.changes ?? [], result.changes ?? []) : undefined;
    const capped = changes
      ? capChanges(fitWholeText(changes), (prev.moreChanges ?? 0) + (result.moreChanges ?? 0))
      : null;
    const undoUntil = [prev.undoUntil, result.undoUntil].filter((value): value is string => !!value).sort()[0];
    const { outcome: _outcome, moreChanges: _more, ...base } = prev;
    const merged: MariWorkspaceActionResult = {
      ...base,
      status: prev.status === "created" || result.status === "created" ? "created" : "updated",
      resource: { ...prev.resource, label: prev.resource.label ?? result.resource.label },
      changedFields: [...new Set([...prev.changedFields, ...result.changedFields])],
      ...(reviewIds.length > 0 ? { reviewId: reviewIds[0], reviewIds } : {}),
      ...(prev.reason || result.reason ? { reason: prev.reason ?? result.reason } : {}),
      ...(capped ? { changes: capped.changes } : {}),
      ...(capped?.moreChanges ? { moreChanges: capped.moreChanges } : {}),
      ...(undoUntil ? { undoUntil } : {}),
      ...(prev.outcome && prev.outcome === result.outcome ? { outcome: prev.outcome } : {}),
    };
    byRecord.set(key, merged);
  }
  return [...byRecord.values()].slice(0, MARI_RECEIPT_LIMITS.records);
}

/**
 * Keep / Undo answered `reviewId`: the results with that review get the outcome. Null when no result
 * holds it (the message is not the one that made the change).
 */
export function withMariReceiptOutcome(
  results: unknown,
  reviewId: string,
  outcome: "kept" | "undone",
): MariWorkspaceActionResult[] | null {
  if (!Array.isArray(results)) return null;
  let found = false;
  const next = results.map((result) => {
    if (!isRecord(result)) return result;
    const ids = mariReceiptReviewIds(result as { reviewId?: string; reviewIds?: string[] });
    if (!ids.includes(reviewId)) return result;
    found = true;
    // ponytail: a record merged from several reviews takes the outcome of the last one answered; the
    // card answers them together, so they only differ if one was answered from the omnibar list.
    return { ...result, outcome };
  });
  return found ? (next as MariWorkspaceActionResult[]) : null;
}

/**
 * What the receipt says about Keep / Undo: `open` while a review can still be answered, the answer
 * (live first, then the one saved on the message), `closed` when the undo record is gone unanswered
 * (14 days, the newest-50 cap), `saved` when there never was an undo (Accept edits mode), and `old`
 * for a message saved before receipts - its state is unknown.
 */
export type MariReceiptState = "open" | "kept" | "undone" | "closed" | "saved" | "old";

export function mariReceiptState(
  result: MariWorkspaceActionResult,
  pendingIds: ReadonlySet<string>,
  answered?: ReadonlyMap<string, "kept" | "undone">,
): MariReceiptState {
  const ids = mariReceiptReviewIds(result);
  if (ids.some((id) => pendingIds.has(id))) return "open";
  const live = ids.map((id) => answered?.get(id)).find(Boolean);
  if (live) return live;
  if (result.outcome) return result.outcome;
  if (!result.changes) return "old";
  return ids.length > 0 ? "closed" : "saved";
}

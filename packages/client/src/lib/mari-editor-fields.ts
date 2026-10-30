// Links Prof. Mari to real editor fields. An editor field carries `data-mari-field="<id>"`, where the
// id is the key `fieldLabel` takes (`description`, `first_mes`, `extensions.backstory`) and the server's
// quick edit reads as `fieldId`. A change-card path is the same id under the row's `data.` column.

/** The anchored fields under `root` in page order, once each, named by `label` (her change cards' `fieldLabel`;
 * passed in so this module stays free of the diff code). */
export function listMariFields(root: ParentNode, label: (id: string) => string): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const fields: Array<{ id: string; label: string }> = [];
  for (const element of root.querySelectorAll<HTMLElement>("[data-mari-field]")) {
    const id = element.dataset.mariField;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    fields.push({ id, label: label(id) });
  }
  return fields;
}

/** A field's current text (unsaved edits included), for a handoff that names it without focusing it. */
export function mariFieldText(root: ParentNode, id: string): string | null {
  const field = findMariField(root, id);
  const input = field?.matches("textarea, input") ? field : field?.querySelector("textarea, input");
  return input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement ? input.value : null;
}

/** `data.extensions.backstory` -> `extensions.backstory`. */
export function editorFieldId(path: string): string {
  return path.replace(/^data\./, "");
}

// List and block fields: the focused input is one tag, greeting or onboarding question, not the field's
// content. The server reads the onboarding block itself (`character.onboarding.get`).
const LIST_FIELD_IDS = new Set(["tags", "alternate_greetings", "extensions.onboarding"]);

/** Capture the focused field's current text and selected text for a Prof. Mari handoff; null for list fields. */
export function mariFieldDraft(
  fieldId: string,
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { fieldId: string; value: string; selection?: string } | null {
  if (LIST_FIELD_IDS.has(fieldId)) return null;
  const selection =
    selectionStart !== null && selectionEnd !== null && selectionEnd > selectionStart
      ? value.slice(selectionStart, selectionEnd).slice(0, 4_000)
      : undefined;
  // Same limits as the route schema (professor-mari-workspace.routes.ts), so a long field never fails the send.
  return { fieldId, value: value.slice(0, 20_000), ...(selection ? { selection } : {}) };
}

/** The field for an id, or its closest anchored parent (`extensions.depth_prompt.role` -> the depth prompt). */
export function findMariField(root: ParentNode, path: string): HTMLElement | null {
  const parts = editorFieldId(path).split(".");
  for (let end = parts.length; end > 0; end--) {
    const id = parts.slice(0, end).join(".");
    const field = root.querySelector<HTMLElement>(`[data-mari-field="${CSS.escape(id)}"]`);
    if (field) return field;
  }
  return null;
}

// `character.update` patch keys the server accepts (normalizeCharacterActionData) that are not plain card keys.
const CHARACTER_PATCH_ALIASES: Record<string, string> = {
  first_message: "first_mes",
  greeting: "first_mes",
  backstory: "extensions.backstory",
  appearance: "extensions.appearance",
};
// The Character editor's `data-mari-field` ids.
const CHARACTER_FIELD_IDS = new Set([
  "name",
  "summary",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "character_version",
  "alternate_greetings",
  "tags",
  "creator",
  "extensions.backstory",
  "extensions.appearance",
  "extensions.depth_prompt",
  "extensions.onboarding",
]);

/** A change-card path whose field the Character editor anchors (itself or its parent field). */
export function hasMariField(path: string): boolean {
  const parts = editorFieldId(path).split(".");
  return parts.some((_, end) => CHARACTER_FIELD_IDS.has(parts.slice(0, end + 1).join(".")));
}

/** The server's app_data action aliases (normalizeAppDataActionName): `Characters_Update` -> `character.update`. */
export function appDataAction(action: unknown): string {
  if (typeof action !== "string") return "";
  return action
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "")
    .replace(/^characters\./, "character.");
}

/** A `character.update` patch key (`firstMes`, `backstory`) as its editor field id, or null for other keys. */
export function characterPatchFieldId(key: string): string | null {
  const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const id = CHARACTER_PATCH_ALIASES[snake] ?? snake;
  return CHARACTER_FIELD_IDS.has(id) ? id : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The character field a running `app_data` step writes, from its tool input. */
export function mariWorkingFieldFromTool(name: string, input: unknown): { characterId: string; path: string } | null {
  const args = asRecord(input);
  if (!args || name !== "app_data" || appDataAction(args.action) !== "character.update") return null;
  const characterId = args.characterId ?? args.id;
  if (typeof characterId !== "string" || !characterId) return null;
  for (const key of Object.keys(characterPatchValues(args))) {
    const path = characterPatchFieldId(key);
    if (path) return { characterId, path };
  }
  return null;
}

/** The patch a `character.update` sends. The server reads fields top-level or inside one of
 * these wrappers; an `extensions` object counts as `extensions.<key>` fields. */
function characterPatchValues(args: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    ...args,
    ...asRecord(args.character),
    ...asRecord(args.card),
    ...asRecord(args.data),
    ...asRecord(args.patch),
  };
  for (const [key, value] of Object.entries(asRecord(fields.extensions) ?? {})) fields[`extensions.${key}`] = value;
  return fields;
}

/** Text fields the in-field review shows, in editor order (Metadata, Card, Dialogue, Advanced). */
export const MARI_REVIEW_FIELD_ORDER = [
  "creator_notes",
  "summary",
  "description",
  "personality",
  "extensions.backstory",
  "extensions.appearance",
  "scenario",
  "first_mes",
  "mes_example",
  "system_prompt",
  "post_history_instructions",
] as const;

const reviewRank = (fieldId: string) => (MARI_REVIEW_FIELD_ORDER as readonly string[]).indexOf(fieldId);

export interface MariReviewField {
  characterId: string;
  fieldId: string;
}

/** Her change to a character as the editor shows it in the fields: waiting for Keep, or kept
 * with Undo. Her open chat publishes it and owns the replies. */
export type MariFieldReview =
  /** She is working on a reply. */
  | { mode: "busy" }
  | {
      mode: "waiting";
      /** The held message id. */
      key: string;
      /** Text fields she proposes, full values, in editor order. */
      fields: Array<MariReviewField & { value: string }>;
      /** Fields the whole change sets, for "Keep all N". */
      total: number;
      /** Held changes to other records that Keep also applies. */
      others: number;
      /** False when nothing was sent. */
      keep: () => boolean;
      /** Decline the whole change and ask her to propose it again without this field. */
      decline: (fieldId: string) => boolean;
    }
  | {
      mode: "kept";
      /** The review ids Undo answers. */
      key: string;
      fields: MariReviewField[];
      undoUntil: string | null;
      undo: () => void;
    };

/** The text fields a held turn's raw calls (`mariHeldCalls`) would write, full values, editor
 * order. The card's `mariHeldChanges` cut values to 400 characters, so the diff reads these. */
export function heldCharacterFields(heldCalls: unknown): Array<MariReviewField & { value: string }> {
  if (!Array.isArray(heldCalls)) return [];
  const fields: Array<MariReviewField & { value: string }> = [];
  for (const raw of heldCalls) {
    const call = asRecord(raw);
    const args = asRecord(call?.arguments);
    if (call?.name !== "app_data" || !args || appDataAction(args.action) !== "character.update") continue;
    const characterId = args.characterId ?? args.id;
    if (typeof characterId !== "string" || !characterId) continue;
    for (const [key, value] of Object.entries(characterPatchValues(args))) {
      const fieldId = characterPatchFieldId(key);
      if (!fieldId || typeof value !== "string" || reviewRank(fieldId) < 0) continue;
      const known = fields.findIndex((field) => field.characterId === characterId && field.fieldId === fieldId);
      // A later call to the same field wins, as it would when the calls run in order.
      if (known >= 0) fields.splice(known, 1);
      fields.push({ characterId, fieldId, value });
    }
  }
  return fields.sort((a, b) => reviewRank(a.fieldId) - reviewRank(b.fieldId));
}

/** The text fields of an applied character change that can still be undone (a review of it is
 * still pending), from her turn's action results. */
export function keptCharacterFields(
  results: ReadonlyArray<{
    resource: { kind: string; id: string };
    status: string;
    changedFields: string[];
    reviewId?: string;
    reviewIds?: string[];
    undoUntil?: string;
  }>,
  pendingIds: ReadonlySet<string>,
): { reviewIds: string[]; fields: MariReviewField[]; undoUntil: string | null } {
  const reviewIds: string[] = [];
  const fields: MariReviewField[] = [];
  const deadlines: string[] = [];
  for (const result of results) {
    const ids = (result.reviewIds?.length ? result.reviewIds : result.reviewId ? [result.reviewId] : []).filter((id) =>
      pendingIds.has(id),
    );
    if (result.resource.kind !== "character" || result.status !== "updated" || ids.length === 0) continue;
    reviewIds.push(...ids);
    if (result.undoUntil) deadlines.push(result.undoUntil);
    for (const changed of result.changedFields) {
      const fieldId = editorFieldId(changed);
      if (reviewRank(fieldId) < 0 || fields.some((field) => field.fieldId === fieldId)) continue;
      fields.push({ characterId: result.resource.id, fieldId });
    }
  }
  fields.sort((a, b) => reviewRank(a.fieldId) - reviewRank(b.fieldId));
  return { reviewIds, fields, undoUntil: deadlines.sort()[0] ?? null };
}

/** A field's value in a character card (`description`, `extensions.backstory`), as text. */
export function characterFieldValue(data: unknown, fieldId: string): string {
  let value: unknown = data;
  for (const part of fieldId.split(".")) value = asRecord(value)?.[part];
  return typeof value === "string" ? value : "";
}

export function withCharacterFieldValue<T>(data: T, fieldId: string, value: unknown): T {
  const [head, ...rest] = fieldId.split(".");
  const record = asRecord(data) ?? {};
  return {
    ...record,
    [head!]: rest.length ? withCharacterFieldValue(record[head!], rest.join("."), value) : value,
  } as T;
}

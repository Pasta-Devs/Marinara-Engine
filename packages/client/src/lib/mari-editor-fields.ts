// Links Prof. Mari to real editor fields. An editor field carries `data-mari-field="<id>"`, where the
// id is the key `fieldLabel` takes (`description`, `first_mes`, `extensions.backstory`) and the server's
// quick edit reads as `fieldId`. A change-card path is the same id under the row's `data.` column.

import {
  MARI_EDITOR_KINDS,
  appDataAction,
  isMariEditorKind,
  mariEditorKindForAction,
  mariEditorKindForTable,
  editorFieldId,
  mariFieldPath,
  mariPatchFieldId,
  mariUpdateCall,
  type MariDeclinedField,
  type MariEditorKind,
} from "@marinara-engine/shared";

export {
  appDataAction,
  editorFieldId,
  isMariEditorKind,
  mariEditorKindForAction,
  mariEditorKindForTable,
  mariFieldPath,
  mariPatchFieldId,
};
export type { MariEditorKind };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

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

// List and block fields: the focused input is one tag, greeting or onboarding question, not the field's
// content. The server reads the onboarding block itself (`character.onboarding.get`).
const LIST_FIELD_IDS = new Set(["tags", "alternate_greetings", "extensions.onboarding", "keys", "secondaryKeys"]);

/** Capture the focused field's current text and selected text for a Prof. Mari handoff; null for list fields. */
export function mariFieldDraft(
  fieldId: string,
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { fieldId: string; value: string; selection?: string } | null {
  if (LIST_FIELD_IDS.has(fieldId.replace(/^entries\.[^.]+\./, ""))) return null;
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

/** A change-card path whose field the kind's editor anchors (itself or its parent field). */
export function hasMariField(path: string, kind: MariEditorKind = "character"): boolean {
  const parts = editorFieldId(path).split(".");
  return parts.some((_, end) => MARI_EDITOR_KINDS[kind].fieldIds.has(parts.slice(0, end + 1).join(".")));
}

/** The editor field a running `app_data` step writes, from its tool input. */
export function mariWorkingFieldFromTool(name: string, input: unknown): { entityId: string; path: string } | null {
  const call = mariUpdateCall(name, input);
  if (!call) return null;
  for (const key of Object.keys(call.patch)) {
    const path = mariPatchFieldId(call.kind, key);
    if (path) return { entityId: call.entityId, path: mariFieldPath(call.kind, call.entityId, path) };
  }
  return null;
}

export const reviewRank = (kind: MariEditorKind, fieldId: string) =>
  (MARI_EDITOR_KINDS[kind].reviewOrder as readonly string[]).indexOf(fieldId);

export interface MariReviewField {
  entityId: string;
  fieldId: string;
}

/** Her change to a record as its editor shows it in the fields: waiting for Keep, or kept
 * with Undo. Her open chat publishes it and owns the replies. */
export type MariFieldReview =
  /** She is working on a reply. */
  | { mode: "busy" }
  | {
      mode: "waiting";
      /** The held message id. */
      key: string;
      /** Text fields she proposes, full values, editor order. */
      fields: Array<MariReviewField & { value: string }>;
      /** Fields the whole change sets, for "Keep all N". */
      total: number;
      /** Held changes to other records that Keep also applies. */
      others: number;
      /** Every held call only rewrites text fields an editor shows, so Edit can take the whole change over. */
      editorTextOnly: boolean;
      /** The user took over every field with Edit and saved their own text: the held change `key` is answered, nothing is sent. */
      settle: (key: string) => Promise<boolean>;
      /** Accept the change; the declined fields in the UI store stay out. False when nothing was sent. */
      keep: () => boolean;
      /** Decline the whole change. False when nothing was sent. */
      reject: () => boolean;
    }
  | {
      mode: "kept";
      /** The review ids Undo answers. */
      key: string;
      fields: MariReviewField[];
      undoUntil: string | null;
      undo: () => void;
      /** The send that started her run saved the user's unsaved text first (see appliesWithoutReview). */
      savedUnsaved?: boolean;
    };

/**
 * The user took over every field of her held change with Edit and saved their own text: it answers her change.
 * `before` is each taken-over field's text at Edit; a field still unsaved, or saved back to that text, keeps it waiting.
 */
export function heldChangeSettledByUser(
  review: { fields: readonly MariReviewField[]; editorTextOnly: boolean },
  here: (entityId: string) => boolean,
  before: Readonly<Record<string, string>>,
  unsaved: (fieldId: string) => boolean,
  current: (fieldId: string) => string,
) {
  const takenOver = Object.keys(before);
  return (
    review.editorTextOnly &&
    takenOver.length > 0 &&
    review.fields.every((field) => here(field.entityId) && takenOver.includes(field.fieldId)) &&
    takenOver.every((fieldId) => !unsaved(fieldId) && current(fieldId) !== before[fieldId])
  );
}

/** Every held call is an update whose patch is only text fields an editor shows (see `heldEditorFields`). */
export function heldCallsAreEditorText(heldCalls: unknown) {
  return (
    Array.isArray(heldCalls) &&
    heldCalls.length > 0 &&
    heldCalls.every((raw) => {
      const call = asRecord(raw);
      const update = mariUpdateCall(call?.name, call?.arguments);
      if (!update) return false;
      // Keys the server writes for this kind; ids, the action, wrappers and the `extensions` parent map to no field.
      const { idArgs, wrappers } = MARI_EDITOR_KINDS[update.kind];
      const written: Array<{ fieldId: string; value: unknown }> = [];
      for (const [key, value] of Object.entries(update.patch)) {
        const fieldId = mariPatchFieldId(update.kind, key);
        if (fieldId) written.push({ fieldId, value });
        else if (key !== "action" && key !== "extensions" && !idArgs.includes(key) && !wrappers.includes(key))
          return false;
      }
      return (
        written.length > 0 &&
        written.every(({ fieldId, value }) => typeof value === "string" && reviewRank(update.kind, fieldId) >= 0)
      );
    })
  );
}

/** The fields the user declined on the change that waits now: what every Accept leaves out. */
export function declinedForHeldChange(
  review: MariFieldReview | null,
  declined: { key: string; fields: MariDeclinedField[] },
): MariDeclinedField[] {
  return review?.mode === "waiting" && review.key === declined.key ? declined.fields : [];
}

/** The text fields a held turn's raw calls (`mariHeldCalls`) would write, full values, editor
 * order. The card's `mariHeldChanges` cut values to 400 characters, so the diff reads these. */
export function heldEditorFields(heldCalls: unknown): Array<MariReviewField & { value: string }> {
  if (!Array.isArray(heldCalls)) return [];
  const fields: Array<MariReviewField & { value: string; rank: number }> = [];
  for (const raw of heldCalls) {
    const call = asRecord(raw);
    const update = mariUpdateCall(call?.name, call?.arguments);
    if (!update) continue;
    for (const [key, value] of Object.entries(update.patch)) {
      const fieldId = mariPatchFieldId(update.kind, key);
      const rank = fieldId ? reviewRank(update.kind, fieldId) : -1;
      if (!fieldId || typeof value !== "string" || rank < 0) continue;
      const path = mariFieldPath(update.kind, update.entityId, fieldId);
      const known = fields.findIndex((field) => field.entityId === update.entityId && field.fieldId === path);
      // A later call to the same field wins, as it would when the calls run in order.
      if (known >= 0) fields.splice(known, 1);
      fields.push({ entityId: update.entityId, fieldId: path, value, rank });
    }
  }
  return fields.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...field }) => field);
}

/** Permission modes where her writes apply without a review, so unsaved editor text is saved first. */
export function appliesWithoutReview(mode: string): boolean {
  return mode === "bypass" || mode === "accept-edits";
}

/** A send saved the user's unsaved text first while `presavedAfter` was the newest message id ("" for
 * none); a kept change on a later message is that run's, so its line says the text was saved too. */
export function keptAfterPresave(presavedAfter: string | null, messageId: string): boolean {
  return presavedAfter !== null && presavedAfter !== messageId;
}

/** The text fields of an applied change that can still be undone (a review of it is
 * still pending), from her turn's action results. */
export function keptEditorFields(
  results: ReadonlyArray<{
    resource: { kind: string; id: string };
    status: string;
    changedFields: string[];
    reviewId?: string;
    reviewIds?: string[];
    undoUntil?: string;
  }>,
  pending: ReadonlyArray<{
    id: string;
    diffPreview?: ReadonlyArray<{ table: string; id: string; action: string; before?: unknown; after?: unknown }>;
  }>,
): { reviewIds: string[]; fields: MariReviewField[]; undoUntil: string | null } {
  const pendingById = new Map(pending.map((review) => [review.id, review]));
  const reviewIds: string[] = [];
  const fields: Array<MariReviewField & { rank: number }> = [];
  const deadlines: string[] = [];
  for (const result of results) {
    const ids = (result.reviewIds?.length ? result.reviewIds : result.reviewId ? [result.reviewId] : []).filter((id) =>
      pendingById.has(id),
    );
    const kind = result.resource.kind;
    if (!isMariEditorKind(kind) || result.status !== "updated" || ids.length === 0) continue;
    reviewIds.push(...ids);
    if (result.undoUntil) deadlines.push(result.undoUntil);
    // A lorebook result names only the book, also for an entry edit: its reviews' rows name the records.
    const records =
      kind === "lorebook"
        ? ids.flatMap((id) =>
            (pendingById.get(id)?.diffPreview ?? []).flatMap((change) => {
              const rowKind = change.action === "update" ? mariEditorKindForTable(change.table) : null;
              const before = asRecord(change.before) ?? {};
              const after = asRecord(change.after) ?? {};
              const changed = Object.keys(after).filter(
                (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
              );
              return rowKind ? [{ kind: rowKind, entityId: change.id, changed }] : [];
            }),
          )
        : [{ kind, entityId: result.resource.id, changed: result.changedFields }];
    for (const record of records) {
      for (const changed of record.changed) {
        const fieldId = editorFieldId(changed);
        const rank = reviewRank(record.kind, fieldId);
        const path = mariFieldPath(record.kind, record.entityId, fieldId);
        if (rank < 0 || fields.some((field) => field.entityId === record.entityId && field.fieldId === path)) continue;
        fields.push({ entityId: record.entityId, fieldId: path, rank });
      }
    }
  }
  fields.sort((a, b) => a.rank - b.rank);
  return {
    reviewIds,
    fields: fields.map(({ rank: _rank, ...field }) => field),
    undoUntil: deadlines.sort()[0] ?? null,
  };
}

/** A field's value in an editor form (`description`, `extensions.backstory`), as text. */
export function formFieldValue(data: unknown, fieldId: string): string {
  let value: unknown = data;
  for (const part of fieldId.split(".")) value = asRecord(value)?.[part];
  return typeof value === "string" ? value : "";
}

export function withFormFieldValue<T>(data: T, fieldId: string, value: unknown): T {
  const [head, ...rest] = fieldId.split(".");
  const record = asRecord(data) ?? {};
  return {
    ...record,
    [head!]: rest.length ? withFormFieldValue(record[head!], rest.join("."), value) : value,
  } as T;
}

/** For a record stored whole (an agent's `settings`): a key the user left alone takes the record's newer value. */
export function rebaseUntouchedKeys(
  sent: Record<string, unknown>,
  sentAtLoad: Record<string, unknown>,
  before: Record<string, unknown>,
  now: Record<string, unknown>,
): Record<string, unknown> {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const out = { ...sent };
  for (const key of new Set([...Object.keys(before), ...Object.keys(now)])) {
    if (same(before[key], now[key]) || !same(sent[key], sentAtLoad[key])) continue;
    if (now[key] === undefined) delete out[key];
    else out[key] = now[key];
  }
  return out;
}

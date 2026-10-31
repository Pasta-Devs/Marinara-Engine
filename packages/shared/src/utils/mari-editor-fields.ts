// Prof. Mari's editor fields as the client and the server both read them: which patch keys name which
// editor field, and how a held update call splits into per-field edits.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** `data.extensions.backstory` -> `extensions.backstory`. */
export function editorFieldId(path: string): string {
  return path.replace(/^data\./, "");
}

// Prof. Mari's editors, one entry per record kind. A kind lists the app_data action that edits it,
// the change-card table, the id argument, its editor's `data-mari-field` ids, the patch keys the
// server accepts under another name (snake_case key -> field id), and the text fields in-field
// review shows, in editor order. Lorebook and preset join with one entry each.
export const MARI_EDITOR_KINDS = {
  character: {
    action: "character.update",
    table: "characters",
    idArgs: ["id", "characterId"],
    // The wrappers the server reads a patch from, besides the top level (normalizeCharacterActionData).
    wrappers: ["character", "card", "data", "patch"],
    fieldIds: new Set([
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
    ]),
    // `character.update` keys that are not plain card keys (normalizeCharacterActionData).
    aliases: {
      first_message: "first_mes",
      greeting: "first_mes",
      backstory: "extensions.backstory",
      appearance: "extensions.appearance",
    } as Record<string, string>,
    reviewOrder: [
      "name",
      "creator",
      "character_version",
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
    ],
  },
  persona: {
    action: "persona.update",
    table: "personas",
    idArgs: ["id", "personaId"],
    wrappers: ["persona", "data", "patch"],
    fieldIds: new Set([
      "name",
      "comment",
      "phoneticName",
      "creator",
      "tags",
      "creatorNotes",
      "summary",
      "description",
      "personality",
      "backstory",
      "appearance",
      "imageAppearance",
      "scenario",
      "mes_example",
    ]),
    // `persona.update` columns are camelCase; a snake_case key names the same column.
    aliases: {
      phonetic_name: "phoneticName",
      creator_notes: "creatorNotes",
      image_appearance: "imageAppearance",
    } as Record<string, string>,
    reviewOrder: [
      "name",
      "comment",
      "phoneticName",
      "creator",
      "creatorNotes",
      "summary",
      "description",
      "personality",
      "backstory",
      "appearance",
      // ponytail: no in-field review for imageAppearance; its field is not rendered while its toggle
      // is off, so a review there could never show. Her card still lists it; add it back with a
      // toggle-aware review list if users ask.
      "scenario",
      "mes_example",
    ],
  },
  lorebook: {
    action: "lorebook.update",
    table: "lorebooks",
    idArgs: ["id", "lorebookId"],
    wrappers: ["patch", "data", "lorebook"],
    fieldIds: new Set(["name", "description", "tags"]),
    aliases: {} as Record<string, string>,
    reviewOrder: ["name", "description"],
  },
  // Entry fields anchor as `entries.<entryId>.<key>` in the lorebook editor (`mariFieldPath`).
  lorebookEntry: {
    action: "lorebook.updateentry",
    table: "lorebook_entries",
    // The server reads `entryId` first here.
    idArgs: ["entryId", "id"],
    wrappers: ["patch", "data", "entry"],
    fieldIds: new Set(["name", "description", "keys", "secondaryKeys", "content"]),
    aliases: {} as Record<string, string>,
    reviewOrder: ["name", "description", "content"],
  },
  // Prompt sections are their own records (`preset.updateSection`) and are not covered here.
  preset: {
    action: "preset.update",
    table: "prompt_presets",
    idArgs: ["id", "presetId", "promptPresetId"],
    wrappers: ["patch", "data", "preset", "promptPreset"],
    fieldIds: new Set(["name", "description", "author", "conversationPrompt", "gamePrompt"]),
    aliases: { conversation_prompt: "conversationPrompt", game_prompt: "gamePrompt" } as Record<string, string>,
    reviewOrder: ["description", "conversationPrompt", "gamePrompt"],
  },
  agent: {
    action: "agent.update",
    table: "agent_configs",
    idArgs: ["id", "agentId", "agentConfigId"],
    wrappers: ["patch", "data", "agent"],
    fieldIds: new Set(["description", "promptTemplate"]),
    aliases: { prompt_template: "promptTemplate", prompt: "promptTemplate" } as Record<string, string>,
    reviewOrder: ["description", "promptTemplate"],
  },
};

export type MariEditorKind = keyof typeof MARI_EDITOR_KINDS;

export const isMariEditorKind = (kind: unknown): kind is MariEditorKind =>
  typeof kind === "string" && Object.hasOwn(MARI_EDITOR_KINDS, kind);

/** The editor kind an app_data action edits (`character.update` -> character), or null. */
export function mariEditorKindForAction(action: unknown): MariEditorKind | null {
  const name = appDataAction(action);
  return (
    (Object.keys(MARI_EDITOR_KINDS) as MariEditorKind[]).find((kind) => MARI_EDITOR_KINDS[kind].action === name) ?? null
  );
}

/** The editor kind of a change-card table (`personas` -> persona), or null. */
export function mariEditorKindForTable(table: unknown): MariEditorKind | null {
  return (
    (Object.keys(MARI_EDITOR_KINDS) as MariEditorKind[]).find((kind) => MARI_EDITOR_KINDS[kind].table === table) ?? null
  );
}

/** A record's field as its editor's `data-mari-field` id: a lorebook entry's sit under `entries.<entryId>.`. */
export function mariFieldPath(kind: MariEditorKind, entityId: string, path: string): string {
  return kind === "lorebookEntry" ? `entries.${entityId}.${editorFieldId(path)}` : path;
}

/** The server's app_data action aliases (normalizeAppDataActionName): `Characters.Update` -> `character.update`. */
export function appDataAction(action: unknown): string {
  if (typeof action !== "string") return "";
  return action
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "")
    .replace(/^promptpresets?\./, "preset.")
    .replace(/^(character|persona|lorebook|preset|agent)s\./, "$1.")
    .replace(/^lorebook\.entr(?:y|ies)\.update$/, "lorebook.updateentry");
}

/** An update patch key (`firstMes`, `backstory`) as its editor field id, or null for other keys. */
export function mariPatchFieldId(kind: MariEditorKind, key: string): string | null {
  const { aliases, fieldIds } = MARI_EDITOR_KINDS[kind];
  if (fieldIds.has(key)) return key;
  const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const id = aliases[snake] ?? snake;
  return fieldIds.has(id) ? id : null;
}

/** The record an update app_data call edits, with the patch it sends; null for other calls. */
export function mariUpdateCall(name: unknown, input: unknown) {
  const args = asRecord(input);
  if (!args || name !== "app_data") return null;
  const kind = mariEditorKindForAction(args.action);
  if (!kind) return null;
  // The first id argument the server reads, in its order.
  const entityId = MARI_EDITOR_KINDS[kind].idArgs.map((key) => args[key]).find((id) => typeof id === "string" && id);
  if (typeof entityId !== "string") return null;
  return { kind, entityId, patch: patchValues(args, MARI_EDITOR_KINDS[kind].wrappers) };
}

/** The patch an update sends. The server reads fields top-level or inside the kind's
 * wrappers; an `extensions` object counts as `extensions.<key>` fields. */
function patchValues(args: Record<string, unknown>, wrappers: readonly string[]): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...args };
  for (const wrapper of wrappers) Object.assign(fields, asRecord(args[wrapper]));
  for (const [key, value] of Object.entries(asRecord(fields.extensions) ?? {})) fields[`extensions.${key}`] = value;
  return fields;
}

/** A field of one record: `fieldId` is its `mariFieldPath` id. */
export interface MariDeclinedField {
  entityId: string;
  fieldId: string;
}

/** Held calls without the declined fields. A declined field leaves its patch wherever
 * the patch carries it; a call left with no editor field to write is dropped. */
export function withoutDeclinedMariFields<T extends { name: unknown; arguments: Record<string, unknown> }>(
  calls: readonly T[],
  declined: ReadonlyArray<MariDeclinedField>,
): T[] {
  if (declined.length === 0) return [...calls];
  return calls.flatMap((call) => {
    const update = mariUpdateCall(call.name, call.arguments);
    if (!update) return [call];
    const { kind, entityId } = update;
    const isDeclined = (key: string) => {
      const id = mariPatchFieldId(kind, key);
      return (
        id !== null &&
        declined.some((field) => field.entityId === entityId && field.fieldId === mariFieldPath(kind, entityId, id))
      );
    };
    if (!Object.keys(update.patch).some(isDeclined)) return [call];
    const strip = (record: Record<string, unknown>) => {
      const next = { ...record };
      for (const key of Object.keys(next)) if (isDeclined(key)) delete next[key];
      const extensions = asRecord(next.extensions);
      if (extensions) {
        next.extensions = Object.fromEntries(
          Object.entries(extensions).filter(([key]) => !isDeclined(`extensions.${key}`)),
        );
      }
      return next;
    };
    const args = strip(call.arguments);
    for (const wrapper of MARI_EDITOR_KINDS[kind].wrappers as readonly string[]) {
      const inner = asRecord(args[wrapper]);
      if (inner) args[wrapper] = strip(inner);
    }
    // A call still runs while it writes anything besides the action, the record id and the wrappers (`aboutMe`, `comment`...).
    const { idArgs, wrappers } = MARI_EDITOR_KINDS[kind];
    const meta = new Set<string>(["action", "apply", "reason", "dryRun", ...idArgs, ...wrappers]);
    const left = Object.keys(patchValues(args, wrappers)).some(
      (key) => !meta.has(key) && !(key === "extensions" && Object.keys(asRecord(args[key]) ?? {}).length === 0),
    );
    return left ? [{ ...call, arguments: args }] : [];
  });
}

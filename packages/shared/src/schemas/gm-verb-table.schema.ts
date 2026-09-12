import { z } from "zod";

// Package-declared Game Master verbs (#5798). An Experience package ships its closed verb
// vocabulary as a hash-pinned asset; the Engine renders one prompt line per verb into the GM
// format reminder, scans the finished narration for exactly those tags, and either writes a
// STATE verb's arguments wholesale under the package's own chat-metadata key or delivers an
// EVENT verb to the package live. This file is the declaration contract only — the reader, the
// prompt render and the executor land with the runtime.

/** Reserved filename a package ships its verb table under. Discovery is by convention rather
 *  than by a manifest key — the first convention-discovered file in the package pipeline, since
 *  `entrypoints` are declared paths read by name — so an older Engine sees an ordinary JSON asset
 *  and ignores it instead of refusing the whole manifest. The file must still be declared in
 *  `contributions.assets.paths` and hash-pinned in `files[]`; shipped in `files[]` alone it is
 *  silent in both directions. */
export const GM_VERB_TABLE_ASSET_PATH = "gm-verbs.json";

/** Byte ceiling checked against the manifest's declared `files[].bytes` BEFORE the asset is read.
 *  `files[].bytes` permits up to 100 MB and nothing else caps an asset ahead of a read, so a verb
 *  table is refused on its declared size rather than after the bytes are already in memory. */
export const GM_VERB_TABLE_MAX_BYTES = 64 * 1024;

/** Bracket-tag names the Engine already owns, case-folded, so a package verb can never shadow a
 *  built-in tag — the GM would emit one name for two consumers and the tag would be stripped by
 *  whichever path matched first. `whisper` is the sharpest of them: a package verb by that name
 *  would have `[whisper:Tam]` cut out of a dialogue line before save, and the line stops matching
 *  the dialogue grammar for good.
 *
 *  Derived from two kinds of source, all of them swept by `capability-gm-verbs.regression.ts` so
 *  the pin cannot rot silently:
 *    1. The prompt renders — every `[name:` the GM format reminder
 *       (`packages/server/src/services/game/gm-prompts.ts`) and the party/VN reminder
 *       (`party-prompts.ts`) can emit across all of their branches (`reputation`, `skill_check`,
 *       `state`, `whisper`, `[Note:`/`[Book:` and the rest).
 *    2. The narration parsers — every bracket name the Engine matches back out of a finished turn.
 *       There are five. Two of them carry names nothing else does: the client tag parser
 *       (`packages/client/src/lib/game-tag-parser.ts`), whose set is wider than any reminder
 *       renders (`ambient`, `direction`, `music`, `element_attack`, …) and the only source of
 *       `party-chat`/`party-turn`, and the client narration formatter
 *       (`packages/client/src/components/game/game-narration-format.ts`), the only source of
 *       `qte_bonus`/`qte_result`, which it renders as command badges mid-stream. Which name is
 *       unique to which source shifts as the list grows: `element_attack` held the tag parser's
 *       half of that pin until the narration formatter — which matches it too — joined, so
 *       uniqueness is re-audited whenever a source is added rather than assumed to survive.
 *       The other three — the server's segment editor
 *       (`packages/server/src/services/game/segment-edits.ts`), the sidecar scene analyzer
 *       (`packages/server/src/services/sidecar/scene-analyzer.ts`) and the generate route's
 *       dialogue rewriter (`packages/server/src/routes/generate/generate-route-utils.ts`) — add no
 *       name the first two do not already yield today, and are swept so that a token arriving in
 *       one of them first cannot become shadowable unnoticed.
 *  The four that carry the dialogue tokens spell them as a regex alternation
 *  (`\[(main|side|extra|action|thought|whisper…)\]`), so the sweep walks alternation groups instead
 *  of reading one name per bracket. Those tokens are pinned from the parsers on purpose: the
 *  reminder renders them inside an alternation (`[main|side|whisper:Target|thought]`) that a
 *  `[name:` scan cannot see, and a bare-bracket scan of a prompt file would collect the example
 *  speaker names and expressions standing next to them. A shadowed name does its damage where the
 *  Engine parses it, so that is where the pin is derived.
 *  Case-folding is load-bearing: the reminder renders `[Note:`/`[Book:` capitalized and the shipped
 *  parse regex is case-insensitive, so a lowercase `note` verb would shadow the journal tag.
 *  `party-chat`/`party-turn` cannot collide anyway — a verb name may not contain a hyphen — and are
 *  kept so the pin matches its sources exactly, which is also what leaves them free to serve as the
 *  tag parser's canary. */
export const RESERVED_GM_TAG_NAMES = Object.freeze([
  "action",
  "ambient",
  "bg",
  "book",
  "choices",
  "combat",
  "combat_result",
  "dialogue",
  "dice",
  "direction",
  "element_attack",
  "extra",
  "inventory",
  "main",
  "map_update",
  "music",
  "note",
  "party-chat",
  "party-turn",
  "party_add",
  "party_change",
  "qte",
  "qte_bonus",
  "qte_result",
  "reputation",
  "session_end",
  "sfx",
  "side",
  "skill_check",
  "state",
  "status",
  "tag",
  "thought",
  "whisper",
  "widget",
] as const);

const reservedGmTagNames = new Set<string>(RESERVED_GM_TAG_NAMES);

/** Chat-metadata namespaces the Engine reads and writes itself. A package whose normalized id is
 *  one of these — or extends one at an uppercase boundary, which is exactly where a colliding key
 *  is minted — may not own metadata keys at all.
 *
 *  Derived, and pinned by `capability-gm-verbs.regression.ts`, from:
 *    1. every top-level key of `ChatMetadata` (`packages/shared/src/types/chat.ts`), reduced to its
 *       leading lowercase run: `gameSetupConfig` → `game`, `lorebookTokenBudget` → `lorebook`;
 *    2. every engine-owned `*_METADATA_KEY` constant in the server, reduced the same way — these
 *       are keys no interface declares (`metadataWriteOrdinals`, the write-ordinal mirror);
 *    3. the keys that live in the interface's `[key: string]: unknown` index signature instead of
 *       in its declaration. A large share of the Engine's real chat metadata is undeclared this way
 *       (`encounterActive`, `internalAssistant`, `professorMariActive`, `imageGenConnectionId`,
 *       `authorNotes`), and sources 1 and 2 are structurally blind to all of it — a package
 *       squatting one of those namespaces could overwrite an Engine key from model output. It takes
 *       seven sub-sources, because no single one covers the vocabulary: the object literal a
 *       `patchMetadata`/`updateMetadata` call passes; the object literal an updater callback
 *       RETURNS, a shape the Engine reaches for about as often as the first; the client's own
 *       `useUpdateChatMetadata()` mutation and its `onMetadataChange` prop, which PATCH chat
 *       metadata without going near `patchMetadata`; the client's DIRECT `PATCH
 *       /chats/:id/metadata` calls, which skip that hook as well (`GameSurface.tsx` writes combat,
 *       scene and narration keys this way); the `chatMetadata.key` / `chat.metadata.key` property
 *       reads; property reads off a `parseChatMetadata(…)` result, the idiom the Engine actually
 *       uses most and the only one that reaches `scenario`; and
 *       `CHAT_PRESET_EXCLUDED_METADATA_KEYS` (`packages/shared/src/types/chat-preset.ts`), which is
 *       not a sweep at all but the list the Engine already hand-maintains of the keys that belong
 *       to a chat rather than to a reusable settings profile. That list is the only source that
 *       reaches `spatialContext`, and it reaches it precisely because the six sweeps cannot.
 *  Plus `persona`, an engine namespace no current key happens to start with; it is floored
 *  explicitly rather than left to appear the day something claims it.
 *
 *  What the derivation CANNOT see, stated plainly, in two shapes. A write whose payload is a
 *  variable or a helper's return value (`patchMetadata(id, hydratedMeta)`, or the same shape on the
 *  metadata route) commits keys no static sweep in this repository can read; there are twenty such
 *  calls, and the regression pins that count, so a twenty-first fails until someone reads it by
 *  hand. And a read that happens INSIDE a helper, off a parameter rather than off a name a sweep
 *  recognizes, is interprocedural and out of reach of every read arm here: `spatialContext` is
 *  written into chat metadata by the hierarchical-maps package's own client — code that ships from
 *  the Agents repository, so no write site here names it — and read back by
 *  `hasUsableHierarchicalWorldMap(current)` off a `patchMetadata` updater's parameter and by a
 *  file-local `parseMetadata()` in the capability migration. Widening a sweep does not close that
 *  shape; source 7 does, which is why a curated Engine list sits beside six derivations here.
 *  Everything else is derived. */
export const ENGINE_OWNED_METADATA_KEY_PREFIXES = Object.freeze([
  "active",
  "agent",
  "applied",
  "archived",
  "attach",
  "author",
  "auto",
  "automatic",
  "autonomous",
  "background",
  "branch",
  "card",
  "character",
  "chat",
  "context",
  "conversation",
  "cross",
  "custom",
  "day",
  "discord",
  "dm",
  "embedding",
  "enable",
  "encounter",
  "entry",
  "exclude",
  "excluded",
  "expression",
  "extended",
  "force",
  "full",
  "game",
  "generation",
  "group",
  "haptic",
  "hide",
  "illustrator",
  "image",
  "impersonate",
  "import",
  "inactive",
  "intent",
  "internal",
  "knowledge",
  "last",
  "lorebook",
  "macro",
  "manual",
  "mari",
  "metadata",
  "narrative",
  "noodle",
  "past",
  "persona",
  "preset",
  "professor",
  "prompt",
  "prose",
  "roleplay",
  "scenario",
  "scene",
  "schedule",
  "scoped",
  "selfie",
  "semantic",
  "show",
  "spatial",
  "spotify",
  "sprite",
  "storyboard",
  "summary",
  "tags",
  "tracker",
  "translate",
  "translation",
  "week",
] as const);

/** The package id as it appears at the head of a metadata key: `hierarchical-maps` →
 *  `hierarchicalMaps`. Manifest ids are already `^[a-z0-9]+(?:-[a-z0-9]+)*$`, so this only has to
 *  fold the hyphens. */
export function camelCaseCapabilityPackageId(packageId: string): string {
  return packageId
    .split("-")
    .map((segment, index) => (index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)))
    .join("");
}

/** True when `prefix` is an engine-owned namespace, or extends one at an uppercase boundary.
 *  The boundary case is not hypothetical: the shipped `conversation-calls` package normalizes to
 *  `conversationCalls`, and `conversationCalls` + `Enabled` is `conversationCallsEnabled` — a real
 *  `ChatMetadata` key. A bare set-membership test would let that package overwrite it. */
function extendsEngineOwnedPrefix(prefix: string): boolean {
  return ENGINE_OWNED_METADATA_KEY_PREFIXES.some(
    (owned) => prefix === owned || (prefix.startsWith(owned) && /^[A-Z]/.test(prefix.charAt(owned.length))),
  );
}

/** The three key-ownership rules (#5798 decision D1), as one reusable check: the key is the
 *  package's normalized id followed by a non-empty suffix starting at an uppercase boundary, and
 *  the normalized id is not an engine-owned namespace. Returns the refusal reason, or `null` when
 *  the key is the package's to write. Keys are flat and top-level because that is what the shipped
 *  reconciler already reads; an engine-owned subtree stays the recorded alternative. */
export function gmVerbMetadataKeyIssue(packageId: string, metadataKey: string): string | null {
  const prefix = camelCaseCapabilityPackageId(packageId);
  if (!prefix) return "A verb table needs an owning package id to check metadata key ownership";
  if (extendsEngineOwnedPrefix(prefix)) {
    return `Package "${packageId}" normalizes to the engine-owned metadata namespace "${prefix}" and cannot own chat metadata keys`;
  }
  if (!metadataKey.startsWith(prefix)) {
    return `metadataKey must start with "${prefix}" so the key belongs to package "${packageId}"`;
  }
  const suffix = metadataKey.slice(prefix.length);
  if (!suffix) return `metadataKey must add a name after the "${prefix}" prefix`;
  if (!/^[A-Z]/.test(suffix)) {
    return `metadataKey must continue with an uppercase letter after the "${prefix}" prefix`;
  }
  return null;
}

export const gmVerbEffectSchema = z.enum(["state", "event"]);

const gmVerbArgBaseSchema = z
  .object({
    /** Becomes a key of the flat JSON payload the GM writes into the tag. */
    name: z
      .string()
      .regex(/^[a-z][a-zA-Z0-9_]*$/)
      .max(32),
    type: z.enum(["string", "number", "boolean"]),
    /** Closed value set. Strings only — an enum of numbers or booleans is a type, not a vocabulary. */
    enum: z.array(z.string().min(1).max(80)).min(1).max(16).optional(),
    /** Required for an un-enum'd string. The executor's scoped parse inherits no ceiling from the
     *  conversation-command registry's 2000-character default, so a free-text argument without a cap
     *  would invite a narration fragment into the package. */
    maxLength: z.number().int().min(1).max(500).optional(),
    optional: z.boolean().default(false),
  })
  .strict();

export const gmVerbArgSchema = gmVerbArgBaseSchema.superRefine((arg, ctx) => {
  if (arg.enum && arg.type !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["enum"],
      message: "Only a string argument can declare an enum",
    });
  }
  if (arg.type !== "string" && arg.maxLength !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxLength"],
      message: "maxLength applies to string arguments only",
    });
  }
  if (arg.type === "string" && arg.enum && arg.maxLength !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxLength"],
      message: "An enum already bounds the value; drop maxLength",
    });
  }
  if (arg.type === "string" && !arg.enum && arg.maxLength === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxLength"],
      message: "A string argument without an enum must declare maxLength",
    });
  }
  // The other closed lists here — verb names, argument names, metadata keys — all refuse a repeat,
  // and a value set is no different: membership is a set, so a duplicate buys the vocabulary
  // nothing and reads as a typo in the one place a package spells its argument's values out.
  if (arg.enum) {
    const values = new Set<string>();
    for (const [index, value] of arg.enum.entries()) {
      if (values.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["enum", index],
          message: `Duplicate enum value "${value}"`,
        });
      }
      values.add(value);
    }
  }
});

const gmVerbBaseSchema = z
  .object({
    /** The bracket tag the GM emits. A subset of the shipped tag grammar's own name pattern
     *  (`[a-z][a-z0-9_-]*`) — no hyphens, so a verb can never take the shape of the hyphenated
     *  built-ins. */
    name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .max(32),
    /** Rendered verbatim as the verb's line in the GM format reminder's COMMANDS block. */
    description: z.string().min(1).max(200),
    effect: gmVerbEffectSchema,
    /** Where a state verb's arguments are written, wholesale, on the chat's metadata row.
     *  Ownership is checked separately against the declaring package (`gmVerbMetadataKeyIssue`). */
    metadataKey: z
      .string()
      .regex(/^[a-z0-9][a-zA-Z0-9]*$/)
      .max(64)
      .optional(),
    args: z.array(gmVerbArgSchema).max(6).default([]),
  })
  .strict();

function refineGmVerb(verb: z.infer<typeof gmVerbBaseSchema>, ctx: z.RefinementCtx): void {
  if (reservedGmTagNames.has(verb.name.toLowerCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: `"${verb.name}" is a built-in Game Master tag and cannot be a package verb`,
    });
  }
  // The description is a prompt line. A line break or a bracket would split the COMMANDS block or
  // take the shape of another tag, so both are refused at declaration rather than rendered.
  // CR and LF are not the whole break vocabulary: NEL (U+0085) and the Unicode line and paragraph
  // separators (U+2028, U+2029) end a line for anything that reads the rendered block back, and the
  // C0 controls reshape it without ending a line at all — a tab is the one a package is likeliest to
  // reach for, and it walks the next verb's line out of the column the block is read in.
  if (/[\r\n\u0085\u2028\u2029]/.test(verb.description)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["description"],
      message: "A verb description is one prompt line and cannot contain line breaks",
    });
  }
  if (/[\u0000-\u001F\u007F]/.test(verb.description)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["description"],
      message: "A verb description cannot contain control characters",
    });
  }
  if (/[[\]]/.test(verb.description)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["description"],
      message: "A verb description cannot contain square brackets",
    });
  }
  // Two-sided, so an event verb cannot squat a metadata key it never writes.
  if (verb.effect === "state" && !verb.metadataKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["metadataKey"],
      message: "A state verb must declare the metadataKey its arguments are written under",
    });
  }
  if (verb.effect === "event" && verb.metadataKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["metadataKey"],
      message: "An event verb writes nothing and must not declare a metadataKey",
    });
  }
  const argNames = new Set<string>();
  for (const [index, arg] of verb.args.entries()) {
    if (argNames.has(arg.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["args", index, "name"],
        message: `Duplicate argument name "${arg.name}"`,
      });
    }
    argNames.add(arg.name);
  }
}

/** One verb, checked for everything that does not depend on who declared it. */
export const gmVerbSchema = gmVerbBaseSchema.superRefine(refineGmVerb);

/** One verb, plus the key-ownership rules for the package that ships it. */
export function createGmVerbSchema(packageId: string) {
  return gmVerbBaseSchema.superRefine((verb, ctx) => {
    refineGmVerb(verb, ctx);
    if (verb.effect !== "state" || !verb.metadataKey) return;
    const issue = gmVerbMetadataKeyIssue(packageId, verb.metadataKey);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["metadataKey"], message: issue });
  });
}

function refineGmVerbTable(table: { verbs: z.infer<typeof gmVerbBaseSchema>[] }, ctx: z.RefinementCtx): void {
  const names = new Set<string>();
  const metadataKeys = new Set<string>();
  for (const [index, verb] of table.verbs.entries()) {
    // Folded, because the shipped tag parse is case-insensitive.
    const name = verb.name.toLowerCase();
    if (names.has(name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verbs", index, "name"],
        message: `Duplicate verb name "${verb.name}"`,
      });
    }
    names.add(name);
    if (!verb.metadataKey) continue;
    if (metadataKeys.has(verb.metadataKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verbs", index, "metadataKey"],
        message: `Two verbs write the same metadataKey "${verb.metadataKey}"`,
      });
    }
    metadataKeys.add(verb.metadataKey);
  }
}

/** The whole `gm-verbs.json` document, checked without an owning package. */
export const gmVerbTableSchema = z
  .object({
    schemaVersion: z.literal(1),
    verbs: z.array(gmVerbSchema).min(1).max(16),
  })
  .strict()
  .superRefine(refineGmVerbTable);

/** The whole document, plus the key-ownership rules for the package that ships it. */
export function createGmVerbTableSchema(packageId: string) {
  return z
    .object({
      schemaVersion: z.literal(1),
      verbs: z.array(createGmVerbSchema(packageId)).min(1).max(16),
    })
    .strict()
    .superRefine(refineGmVerbTable);
}

export type GmVerbEffect = z.infer<typeof gmVerbEffectSchema>;
export type GmVerbArg = z.infer<typeof gmVerbArgSchema>;
export type GmVerb = z.infer<typeof gmVerbSchema>;
export type GmVerbTable = z.infer<typeof gmVerbTableSchema>;

/** Envelope-only table shape, derived from the real schema so the two cannot drift: entries stay
 *  unparsed so one verb from a NEWER Engine cannot fail the whole table — within the cap, which
 *  the envelope carries too, so a table of MORE than sixteen verbs is refused whole rather than
 *  degrading per verb — and `.strip()` rather than `.strict()`, so a newer TOP-LEVEL field does not
 *  reject the envelope. Nothing leaks whichever of the two tolerant modes is chosen: the result is
 *  rebuilt field by field below (`{ schemaVersion: envelope.schemaVersion, verbs: deduped }`), so
 *  `.passthrough()` here would behave identically and `.strip()` states the intent rather than
 *  supplying the guarantee. Same shape as `parseCapabilityCatalogWithCompat`'s envelope, for the
 *  same reason. */
const gmVerbTableEnvelopeSchema = z
  .object({ schemaVersion: z.literal(1), verbs: z.array(z.unknown()).min(1).max(16) })
  .strip();

/** What the tolerant parse yields: the document shape WITHOUT the schema's `min(1)` guarantee.
 *  Every entry can drop — a table declared by the wrong package drops all of them — so this is a
 *  separate name from `GmVerbTable` on purpose. A caller must check `verbs.length` rather than
 *  reason off the one-verb minimum the validating schema enforces. */
export type ParsedGmVerbTable = { schemaVersion: GmVerbTable["schemaVersion"]; verbs: GmVerb[] };

export type GmVerbTableParseResult = {
  /** Possibly empty — see `ParsedGmVerbTable`. */
  table: ParsedGmVerbTable;
  /** Verbs this Engine could not understand — a newer effect, a shape it cannot represent, or a
   *  declaration this Engine refuses. They are dropped rather than failing the table, so one bad
   *  verb never costs a package its whole vocabulary. */
  droppedEntries: number;
  /** Best-effort names of what vanished, so an operator can be told which verb went missing. */
  droppedNames: string[];
};

function bestEffortVerbName(entry: unknown): string {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const name = (entry as Record<string, unknown>).name;
    if (typeof name === "string" && name) return name.slice(0, 32);
  }
  return "(unidentifiable verb)";
}

/** Parse a package's verb table, tolerating individual verbs this Engine cannot understand.
 *  THROWS when the envelope itself is unusable — a wrong `schemaVersion`, a missing or empty
 *  `verbs` array, a non-object document. The caller turns that into its own degradation (an empty
 *  table plus one log line); the turn always survives either way. */
export function parseGmVerbTableWithCompat(input: unknown, packageId: string): GmVerbTableParseResult {
  const envelope = gmVerbTableEnvelopeSchema.parse(input);
  const verbSchema = createGmVerbSchema(packageId);
  const verbs: GmVerb[] = [];
  const droppedNames: string[] = [];
  for (const entry of envelope.verbs) {
    const parsed = verbSchema.safeParse(entry);
    if (parsed.success) verbs.push(parsed.data);
    else droppedNames.push(bestEffortVerbName(entry));
  }
  // The table-level collision checks have to run over what SURVIVED: two verbs that collide are
  // still a collision when a third was dropped between them. Here the later duplicate is dropped
  // rather than failing the table, which is the whole point of this parse path.
  const seenNames = new Set<string>();
  const seenKeys = new Set<string>();
  const deduped: GmVerb[] = [];
  for (const verb of verbs) {
    const name = verb.name.toLowerCase();
    if (seenNames.has(name) || (verb.metadataKey && seenKeys.has(verb.metadataKey))) {
      droppedNames.push(verb.name);
      continue;
    }
    seenNames.add(name);
    if (verb.metadataKey) seenKeys.add(verb.metadataKey);
    deduped.push(verb);
  }
  return {
    table: { schemaVersion: envelope.schemaVersion, verbs: deduped },
    droppedEntries: droppedNames.length,
    droppedNames,
  };
}

import type { FastifyReply } from "fastify";
import {
  GM_VERB_TABLE_ASSET_PATH,
  gmVerbMetadataKeyIssue,
  parseGmVerbTableWithCompat,
  RESERVED_GM_TAG_NAMES,
  type GmVerb,
  type GmVerbArg,
} from "@marinara-engine/shared";
import { isSseReplyWritable, sendSseEvent } from "../../routes/generate/sse.js";
import { logger } from "../../lib/logger.js";
import { capabilityPackageManager } from "./package-manager.service.js";
import { createCapabilityCommandTagRegex } from "./capability-command-registry.service.js";

// Package-declared Game Master verbs (#5798) — the RUNTIME half. The declaration contract, the
// schema and both pinned guard lists live in `packages/shared/src/schemas/gm-verb-table.schema.ts`.
//
// Per game turn: resolve the chat's Experience package to its verb table ONCE, render one prompt
// line per verb into the GM format reminder's COMMANDS block, then scan the finished narration for
// exactly those tags. A verb carrying a `metadataKey` is a STATE verb — its arguments are written
// wholesale under that key. A verb without one is an EVENT verb — it is delivered to the package
// live over SSE and nothing is persisted.
//
// The same resolved table has to reach both the prompt and the parse. If it did not, a verb the
// reminder advertised but the parser did not know would be emitted by the GM and left in the saved
// prose as a raw bracket tag, which is why the resolution is threaded rather than repeated.

const reservedGmTagNames = new Set<string>(RESERVED_GM_TAG_NAMES);

/** A chat's verb vocabulary for this turn, with the package that owns it. */
export type ResolvedGmVerbTable = {
  packageId: string;
  verbs: GmVerb[];
};

export type GmVerbArgValue = string | number | boolean;
export type GmVerbArgs = Record<string, GmVerbArgValue>;

/** One tag the GM emitted that named a verb in this chat's table and validated. */
export type GmVerbCall = {
  verb: GmVerb;
  args: GmVerbArgs;
};

export type GmVerbParseResult = {
  /** The narration with every NAME-MATCHED verb tag removed — including the ones that failed
   *  validation. Stripping on the name rather than on success is deliberate: a tag the model got
   *  slightly wrong is still a command it meant for the engine, and leaving it in the prose shows
   *  the player machinery instead of a story. */
  content: string;
  /** Validated calls, at most one per verb name. */
  calls: GmVerbCall[];
  /** True when anything was stripped, so the caller knows the content changed. */
  matched: boolean;
};

/** The narrow slice of the chats store a state verb needs. Structural on purpose: `patchMetadata` is
 *  the ONLY write shape a verb may use. `updateMetadata` and the capability persistence host both
 *  read-modify-write a whole metadata object, so a concurrent turn's write can be lost between their
 *  read and their write; `patchMetadata` merges under the per-chat metadata queue. */
export type GmVerbMetadataStore = {
  patchMetadata(
    id: string,
    patch: Record<string, unknown>,
    opts?: { touchUpdatedAt?: boolean; metadataQueueHeld?: boolean },
  ): Promise<unknown>;
};

/** The narrow slice of the chats store the provenance claim needs. */
export type GmVerbClaimStore = {
  claimMessageExtraForSwipe(id: string, swipeIndex: number, key: string, value: unknown): Promise<boolean>;
};

/** The generation this verb came out of. `messageId` can be empty — a saved message is not
 *  guaranteed to have an id on every path — and an empty one costs the claim, never the effect. */
export type GmVerbTurnRef = {
  chatId: string;
  messageId: string;
  swipeIndex: number;
};

/** Resolve the verb vocabulary for a chat, once per turn.
 *
 *  Returns null for the overwhelmingly common case: a chat with no Experience package, or one whose
 *  package declares no verbs. Every refusal below the package-manager gate is logged there; what is
 *  logged HERE is a table that parsed but whose entries this Engine will not act on.
 *
 *  The reserved-name and key-ownership guards run again over the parsed table even though the schema
 *  already enforced both. They are the two rules that decide whether model output may overwrite an
 *  Engine-owned tag or an Engine-owned metadata key, so they are re-checked at the point of use
 *  rather than trusted to have been checked upstream — a table that reached here through a future
 *  second reader, or a schema that loosens, both fail closed. */
export async function resolveGmVerbTable(chatMeta: Record<string, unknown>): Promise<ResolvedGmVerbTable | null> {
  const packageId = typeof chatMeta.gameExperienceId === "string" ? chatMeta.gameExperienceId : "";
  if (!packageId) return null;

  const source = await capabilityPackageManager.gmVerbTableSource(packageId);
  if (!source) return null;

  let parsed;
  try {
    parsed = parseGmVerbTableWithCompat(JSON.parse(source.toString("utf8")), packageId);
  } catch (error) {
    // A malformed document or an envelope this Engine cannot read at all. The package loses its
    // verbs for the turn; the turn itself is unaffected.
    logger.warn(error, "[capability/gm-verbs] Package %s ships an unreadable %s", packageId, GM_VERB_TABLE_ASSET_PATH);
    return null;
  }
  if (parsed.droppedEntries > 0) {
    logger.warn(
      "[capability/gm-verbs] Package %s: %d verb(s) dropped as unusable (%s)",
      packageId,
      parsed.droppedEntries,
      parsed.droppedNames.join(", "),
    );
  }

  const verbs = parsed.table.verbs.filter((verb) => {
    if (reservedGmTagNames.has(verb.name.toLowerCase())) {
      logger.warn(
        "[capability/gm-verbs] Package %s declares reserved verb name %s; refused at runtime",
        packageId,
        verb.name,
      );
      return false;
    }
    if (verb.effect !== "state") return true;
    if (!verb.metadataKey) {
      logger.warn("[capability/gm-verbs] Package %s state verb %s has no metadataKey", packageId, verb.name);
      return false;
    }
    const issue = gmVerbMetadataKeyIssue(packageId, verb.metadataKey);
    if (issue) {
      logger.warn("[capability/gm-verbs] Package %s verb %s: %s", packageId, verb.name, issue);
      return false;
    }
    return true;
  });
  if (verbs.length === 0) return null;

  logger.debug("[capability/gm-verbs] Resolved %d verb(s) for package %s", verbs.length, packageId);
  return { packageId, verbs };
}

/** One COMMANDS line per verb, in the shape the conversation-command registry already renders
 *  (`capability-command-registry.service.ts:74`), so the GM sees one consistent grammar rather than
 *  two: a schematic payload, the description, then a copyable example.
 *
 *  The two payload slots do different jobs and both are load-bearing. The SCHEMATIC teaches the
 *  vocabulary — every argument, which ones are optional, and for an enum argument the whole closed
 *  set — while the EXAMPLE is one concrete, parseable instance. Collapsing them, as this renderer
 *  first did, leaves the enum untaught: the example can only show one member, so a GM told to set
 *  the weather reaches for "sunny" or "clear", the validator refuses a word that was never shown to
 *  it, and the failure is silent — the tag is stripped on the name match, so the narration reads
 *  clean and the world simply never changed.
 *
 *  Deriving the vocabulary here rather than asking a package to spell it in its description is what
 *  keeps the two from drifting: the prompt and the validator now read the same parsed table, so an
 *  enum that changes changes both, and a description cannot promise a value the validator refuses.
 *
 *  One line per verb, never wrapped — the convention every built-in in the block already follows
 *  (`gm-prompts.ts:768` runs past 700 characters on one line). The render needs no length budget of
 *  its own: every enum member it prints is a verbatim substring of the table file, which is refused
 *  above 64 KB on its declared bytes before it is ever read. */
export function renderGmVerbInstructions(table: ResolvedGmVerbTable): string[] {
  return table.verbs.map(
    (verb) =>
      `- [${verb.name}:${verbArgumentSchema(verb)}] — ${verb.description} Example: [${verb.name}:${verbExamplePayload(verb)}]`,
  );
}

/** The schematic payload: every declared argument in order, optional ones marked `"name"?:` — the
 *  one marker that cannot be mistaken for part of the value, since it sits outside the JSON string.
 *  An argless verb renders `{}` rather than a bare tag, so the grammar never varies. */
function verbArgumentSchema(verb: GmVerb): string {
  const fields = verb.args.map(
    (arg) => `${JSON.stringify(arg.name)}${arg.optional ? "?" : ""}:${verbArgumentValueSchema(arg)}`,
  );
  return `{${fields.join(",")}}`;
}

/** What one argument accepts, in the alternation grammar the built-in commands already use for their
 *  own closed sets (`[state: exploration|dialogue|combat|travel_rest]`) and that `validateGmVerbArgs`
 *  already speaks when it refuses a value. Numbers and booleans render unquoted on purpose: the
 *  validator rejects `"3"` for a number argument rather than coercing it, so the schematic has to
 *  show the difference the example alone would hide. */
function verbArgumentValueSchema(arg: GmVerbArg): string {
  if (arg.enum?.length) return JSON.stringify(arg.enum.join("|"));
  if (arg.type === "number") return "<number>";
  if (arg.type === "boolean") return "<true|false>";
  // The schema requires `maxLength` on an un-enum'd string; the fallback covers a future loosening
  // rather than any table this Engine accepts today.
  return JSON.stringify(arg.maxLength === undefined ? "<text>" : `<text up to ${arg.maxLength} chars>`);
}

/** A payload the model can copy: every required argument, with the first enum value or a named
 *  placeholder. Kept concrete and parseable — the regression round-trips this exact string back
 *  through the parser, so an example the reminder shows is always one the Engine accepts. */
function verbExamplePayload(verb: GmVerb): string {
  const fields = verb.args
    .filter((arg) => !arg.optional)
    .map((arg) => {
      if (arg.enum?.length) return `${JSON.stringify(arg.name)}:${JSON.stringify(arg.enum[0])}`;
      if (arg.type === "number") return `${JSON.stringify(arg.name)}:1`;
      if (arg.type === "boolean") return `${JSON.stringify(arg.name)}:true`;
      return `${JSON.stringify(arg.name)}:${JSON.stringify(`<${arg.name}>`)}`;
    });
  return `{${fields.join(",")}}`;
}

/** Validate one tag's payload against its verb's declared arguments. Returns the refusal reason
 *  rather than throwing, because a refusal is a log line and a stripped tag — never a failed turn. */
export function validateGmVerbArgs(
  verb: GmVerb,
  rawPayload: string | null,
): { ok: true; args: GmVerbArgs } | { ok: false; reason: string } {
  let payload: unknown = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return { ok: false, reason: "payload is not JSON" };
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "payload is not a JSON object" };
  }
  const supplied = payload as Record<string, unknown>;
  const declared = new Set(verb.args.map((arg) => arg.name));
  for (const key of Object.keys(supplied)) {
    if (!declared.has(key)) return { ok: false, reason: `unknown argument "${key}"` };
  }
  const args: GmVerbArgs = {};
  for (const arg of verb.args) {
    const value = supplied[arg.name];
    if (value === undefined || value === null) {
      if (arg.optional) continue;
      return { ok: false, reason: `missing required argument "${arg.name}"` };
    }
    if (arg.type === "number") {
      // Rejected rather than coerced: a model that wrote "3" meant a string, and a package reading a
      // number would get one it never validated.
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, reason: `argument "${arg.name}" must be a finite number` };
      }
      args[arg.name] = value;
      continue;
    }
    if (arg.type === "boolean") {
      if (typeof value !== "boolean") return { ok: false, reason: `argument "${arg.name}" must be a boolean` };
      args[arg.name] = value;
      continue;
    }
    if (typeof value !== "string") return { ok: false, reason: `argument "${arg.name}" must be a string` };
    if (arg.enum) {
      if (!arg.enum.includes(value)) {
        return { ok: false, reason: `argument "${arg.name}" is not one of ${arg.enum.join("|")}` };
      }
    } else if (arg.maxLength !== undefined && value.length > arg.maxLength) {
      return { ok: false, reason: `argument "${arg.name}" is longer than ${arg.maxLength} characters` };
    }
    args[arg.name] = value;
  }
  return { ok: true, args };
}

/** Scan a finished narration for this chat's verbs, stripping every name match and returning the
 *  ones that validated. At most one call per verb name per message — the same ceiling the shipped
 *  conversation-command parser applies, and a real one: a repeated event verb is meaningful prose
 *  ("two coins, then two more") that this cut collapses to one. */
export function parseAndStripGmVerbCalls(content: string, table: ResolvedGmVerbTable): GmVerbParseResult {
  const verbsByName = new Map(table.verbs.map((verb) => [verb.name.toLowerCase(), verb]));
  const seen = new Set<string>();
  const calls: GmVerbCall[] = [];
  let matched = false;

  const stripped = content.replace(createCapabilityCommandTagRegex(), (match, name: string, payload?: string) => {
    // `toLowerCase`, matching the map built above and the schema's own folds — deliberately NOT
    // `toLocaleLowerCase`, which folds "I" to a dotless "ı" under a Turkish/Azeri runtime locale.
    // The two would then disagree, the lookup would miss, and the verb the reminder advertised would
    // be left in the player's prose as a raw bracket tag.
    const verb = verbsByName.get(name.toLowerCase());
    // Not one of this package's verbs — leave it exactly as the model wrote it. It may be a built-in
    // tag another parser owns, or ordinary prose in brackets.
    if (!verb) return match;
    matched = true;
    if (seen.has(verb.name)) {
      logger.debug("[capability/gm-verbs] Ignoring repeat of verb %s in one message", verb.name);
      return "";
    }
    seen.add(verb.name);
    const validated = validateGmVerbArgs(verb, payload?.trim() || null);
    if (!validated.ok) {
      logger.warn("[capability/gm-verbs] Verb %s refused: %s", verb.name, validated.reason);
      return "";
    }
    calls.push({ verb, args: validated.args });
    return "";
  });

  return { content: stripped, calls, matched };
}

/** Write a state verb's arguments wholesale under its package's metadata key.
 *
 *  `patchMetadata` merges with a top-level shallow spread, so the key's whole value is REPLACED.
 *  That absoluteness is the entire safety story: a duplicate apply writes the same value again and
 *  the ordinal stamp notices nothing moved, so nothing accumulates. It is also why a relative verb
 *  ("add 5 gold") cannot be expressed here — by construction, not by policy.
 *
 *  `touchUpdatedAt: false` because a GM verb is not the player touching the chat; letting it bump
 *  the row would reorder the chat list on a weather change. */
export async function applyGmVerbWrite(
  store: GmVerbMetadataStore,
  chatId: string,
  verb: GmVerb,
  args: GmVerbArgs,
): Promise<void> {
  if (!verb.metadataKey) throw new Error(`GM verb ${verb.name} has no metadataKey to write`);
  await store.patchMetadata(chatId, { [verb.metadataKey]: args }, { touchUpdatedAt: false });
}

/** Deliver an event verb to its package, live. Nothing is persisted and nothing is replayed: one SSE
 *  frame, re-dispatched client-side as one synchronous DOM event.
 *
 *  `packageId` rides the envelope explicitly. The turn-game bridge addresses its package through a
 *  `gameType` field inside the payload, a convention nothing enforces; the executor already holds
 *  the resolved package id — it is how the verb table was found — so there is no reason to make the
 *  client infer it. */
export function emitGmVerbEvent(
  reply: FastifyReply,
  packageId: string,
  verb: GmVerb,
  args: GmVerbArgs,
  turn: GmVerbTurnRef,
): boolean {
  const delivered = sendSseEvent(reply, {
    type: "gm_verb",
    data: {
      packageId,
      verb: verb.name,
      args,
      chatId: turn.chatId,
      messageId: turn.messageId,
      swipeIndex: turn.swipeIndex,
    },
  });
  if (delivered) return true;
  // `write()` also returns false under ordinary backpressure, where the frame IS queued and will
  // flush — so the two are separated rather than warned about together. Only an unwritable reply
  // means the effect is gone, and this warn is the only trace a lost event verb ever leaves.
  if (!isSseReplyWritable(reply)) {
    logger.warn(
      "[capability/gm-verbs] Event verb %s for package %s was not delivered — the client stream is gone (chat %s)",
      verb.name,
      packageId,
      turn.chatId,
    );
    return false;
  }
  logger.debug("[capability/gm-verbs] Event verb %s queued behind backpressure", verb.name);
  return true;
}

/** Record which verb ran on which swipe.
 *
 *  The key is a stable field name so it can be found; the generation triple goes in the VALUE,
 *  mirroring the shipped conversation-command claim. The value must be a truthy object or the
 *  storage guard treats the slot as unclaimed forever, which is why an argless verb still stores a
 *  record rather than `true`.
 *
 *  Read this for what it is: the claim buys PROVENANCE, not dedupe. It is written after the effect,
 *  a regenerate mints a new swipe index whose extra starts empty, and on the event half the frame
 *  may already have been lost by the time the claim lands. Idempotency comes from the writes being
 *  absolute, never from this record. */
export async function claimGmVerb(
  store: GmVerbClaimStore,
  verb: GmVerb,
  args: GmVerbArgs,
  turn: GmVerbTurnRef,
): Promise<boolean> {
  if (!turn.messageId) {
    logger.warn(
      "[capability/gm-verbs] Verb %s ran without a saved message id; provenance not recorded (chat %s)",
      verb.name,
      turn.chatId,
    );
    return false;
  }
  return store.claimMessageExtraForSwipe(turn.messageId, turn.swipeIndex, `gmVerb:${verb.name}`, {
    verb: verb.name,
    args,
    at: new Date().toISOString(),
  });
}

/** Run every validated call from one turn: state verbs write, event verbs emit, both then claim.
 *
 *  One verb's failure never costs the others theirs, and none of them can cost the player the turn —
 *  the message is already saved by the time this runs. */
export async function executeGmVerbCalls(options: {
  calls: GmVerbCall[];
  table: ResolvedGmVerbTable;
  turn: GmVerbTurnRef;
  store: GmVerbMetadataStore & GmVerbClaimStore;
  reply: FastifyReply;
  onMetadataWritten?: () => void;
}): Promise<void> {
  const { calls, table, turn, store, reply } = options;
  for (const call of calls) {
    try {
      if (call.verb.effect === "state") {
        await applyGmVerbWrite(store, turn.chatId, call.verb, call.args);
        // Flagged the instant the row is committed, BEFORE the claim: the claim is provenance and
        // may fail on its own, and a committed write the client is never told to refetch would leave
        // the package showing a stale world until the chat is reopened.
        options.onMetadataWritten?.();
        logger.info(
          "[capability/gm-verbs] Package %s verb %s wrote chat metadata key %s",
          table.packageId,
          call.verb.name,
          call.verb.metadataKey,
        );
        await claimGmVerb(store, call.verb, call.args, turn);
        continue;
      }
      const delivered = emitGmVerbEvent(reply, table.packageId, call.verb, call.args, turn);
      // Claimed even when the frame was lost: the claim records that the Engine executed this verb
      // on this swipe, which is true either way, and it is not what makes delivery at-most-once.
      await claimGmVerb(store, call.verb, call.args, turn);
      if (delivered) {
        logger.info("[capability/gm-verbs] Package %s verb %s delivered", table.packageId, call.verb.name);
      }
    } catch (error) {
      logger.error(error, "[capability/gm-verbs] Verb %s failed for package %s", call.verb.name, table.packageId);
    }
  }
}

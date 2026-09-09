// Package-declared Game Master verbs (#5798) — the RUNTIME half.
//
// The declaration half is pinned by `capability-gm-verbs.regression.ts`. This one drives the parts
// that can actually change a chat: the gated read of a package's verb table off disk, the narration
// scan, and the executor. Everything below runs against a REAL installed-package registry in a
// temporary DATA_DIR and a REAL chats store, because the three claims worth pinning are all claims
// about persisted state:
//
//   1. A state verb's write is ABSOLUTE and lands through `patchMetadata` — the key's whole value is
//      replaced, the write ordinal is stamped, `updatedAt` is not touched, and applying the same
//      verb twice moves nothing. That absoluteness, not the claim record, is the entire reason a
//      duplicate dispatch is harmless.
//   2. An event verb emits exactly one `gm_verb` frame carrying an explicit packageId and the
//      chatId:messageId:swipeIndex triple, and leaves nothing behind.
//   3. Every refusal tier — no table, no permission, oversized, tampered, malformed, not ready,
//      wrong owner — yields no verbs and never throws, because none of them may cost a player a turn.
//
// Plus the coherence pins that no single-function test can make: the prompt render and the
// narration parse agree on every verb (a verb advertised but unmatchable leaks a raw bracket tag
// into the player's prose), both client SSE switches handle the events the server emits, and the
// two turn shapes that are not a GM writing prose —
//
//   4. An IMPERSONATED turn is taught nothing. It is the player writing, no parser runs over it, so
//      a taught verb could only surface as a raw bracket tag in the player's own message.
//   5. A VERB-ONLY turn keeps its turn. Its narration strips to empty, and the hidden-anchor gate it
//      then meets counted only Conversation commands — both zero in game mode — so the turn errored
//      and its already-validated writes were discarded before the executor was ever reached.
//   6. A MIXED turn does both. The verb executes and the skill check resolves over one narration, in
//      that order — the verb pass deletes text, the check pass only rewrites a tag in place — and the
//      surviving check keeps the turn off the anchor path entirely.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-gm-verb-runtime-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const previousMarinaraFileStorageDir = process.env.MARINARA_FILE_STORAGE_DIR;

const fileStorageDir = join(dataDir, "file-storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

const packagesRoot = join(dataDir, "capability-packages");
const registryPath = join(packagesRoot, "installed.json");

const PACKAGE_ID = "pixelforge";
const OTHER_PACKAGE_ID = "chess";
const TABLE_PATH = "gm-verbs.json";
const OTHER_ASSET_PATH = "tilemap.json";

/** The two proving verbs: one of each effect, shaped exactly as the plan's first declarations. */
const verbTable = {
  schemaVersion: 1,
  verbs: [
    {
      name: "weather",
      description: "Set the world's weather when the sky visibly changes.",
      effect: "state",
      metadataKey: "pixelforgeWeather",
      args: [
        { name: "word", type: "string", enum: ["fair", "overcast", "rain", "storm", "snow"] },
        { name: "intensity", type: "string", enum: ["light", "heavy"], optional: true },
      ],
    },
    {
      name: "standing",
      description: "Record how an NPC now regards the player.",
      effect: "event",
      args: [
        { name: "npc", type: "string", maxLength: 40 },
        { name: "stance", type: "string", enum: ["none", "known", "friend", "close", "hostile"] },
        { name: "line", type: "string", maxLength: 80, optional: true },
      ],
    },
  ],
};

type ManifestOverrides = {
  packageId?: string;
  permissions?: string[];
  assetPaths?: string[];
  declaredBytes?: number;
  status?: string;
  tableJson?: string;
};

/** Install one fixture package, hash-pinned the way a real install leaves it on disk. */
function installFixture(overrides: ManifestOverrides = {}) {
  const packageId = overrides.packageId ?? PACKAGE_ID;
  const version = "1.0.0";
  const versionRoot = join(packagesRoot, "versions", packageId, version);
  mkdirSync(versionRoot, { recursive: true });
  const tableJson = overrides.tableJson ?? JSON.stringify(verbTable);
  writeFileSync(join(versionRoot, TABLE_PATH), tableJson);
  writeFileSync(join(versionRoot, "client.js"), "x");
  // An unrelated JSON asset, so the "declares assets but not a verb table" case can be built out of
  // a manifest that is otherwise completely valid.
  writeFileSync(join(versionRoot, OTHER_ASSET_PATH), "{}");
  const tableBytes = Buffer.byteLength(tableJson);
  const manifest = {
    // `contributions.assets` — the delivery surface a verb table rides on — needs schemaVersion 2
    // and capabilityApi 1.10, so the fixture is shaped the way any package shipping one must be.
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 10 },
    builtAgainst: { engineVersion: "2.4.5", engineCommit: "0".repeat(40) },
    id: packageId,
    name: packageId,
    version,
    description: "GM verb runtime regression fixture.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["turn-game"],
    entrypoints: { client: "client.js" },
    contributions: { assets: { paths: overrides.assetPaths ?? [TABLE_PATH] } },
    files: [
      { path: TABLE_PATH, sha256: createHash("sha256").update(tableJson).digest("hex"), bytes: tableBytes },
      { path: "client.js", sha256: createHash("sha256").update("x").digest("hex"), bytes: 1 },
      { path: OTHER_ASSET_PATH, sha256: createHash("sha256").update("{}").digest("hex"), bytes: 2 },
    ],
    permissions: overrides.permissions ?? ["chat-write"],
    restartRequired: false,
  };
  // The byte ceiling is checked against what the MANIFEST declares, so the two are separable on
  // purpose: an inflated declaration must refuse a file that is perfectly readable.
  if (overrides.declaredBytes !== undefined) manifest.files[0]!.bytes = overrides.declaredBytes;
  mkdirSync(packagesRoot, { recursive: true });
  writeFileSync(
    registryPath,
    JSON.stringify({
      schemaVersion: 1,
      packages: [
        {
          id: packageId,
          version,
          manifest,
          installedAt: "2026-09-06T00:00:00.000Z",
          status: overrides.status ?? "active",
          error: null,
          legacy: false,
        },
      ],
    }),
  );
  return { versionRoot, tableJson };
}

installFixture();

const [
  { capabilityPackageManager },
  gmVerbRuntime,
  { createChatsStorage },
  { getDB, closeDB },
  { supportedCapabilityApi },
  { GM_VERB_TABLE_MAX_BYTES },
  { logger },
  { buildGmFormatReminder },
  { shouldSaveHiddenGenerationAnchor },
  { resolveSkillCheckTagsInContent },
  { parseSkillCheckTagBody },
] = await Promise.all([
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../packages/server/src/services/capability-packages/capability-gm-verb-runtime.service.js"),
  import("../../packages/server/src/services/storage/chats.storage.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/shared/src/schemas/capability-package.schema.js"),
  import("../../packages/shared/src/schemas/gm-verb-table.schema.js"),
  import("../../packages/server/src/lib/logger.js"),
  import("../../packages/server/src/services/game/gm-prompts.js"),
  import("../../packages/server/src/routes/generate/spatial-transition-request.js"),
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/shared/src/utils/skill-check-tag.js"),
]);

const {
  applyGmVerbWrite,
  claimGmVerb,
  executeGmVerbCalls,
  parseAndStripGmVerbCalls,
  renderGmVerbInstructions,
  resolveGmVerbTable,
  validateGmVerbArgs,
} = gmVerbRuntime;

type ResolvedTable = NonNullable<Awaited<ReturnType<typeof resolveGmVerbTable>>>;

/** A FastifyReply stand-in that records the frames the real `sendSseEvent` writes to it. The real
 *  serializer runs — only the socket is fake — so the envelope shape asserted below is the shape a
 *  browser would receive. */
function createReplyDouble(options: { writable?: boolean } = {}) {
  const frames: Array<{ type: string; data: Record<string, unknown> }> = [];
  const raw = {
    destroyed: options.writable === false,
    writableEnded: false,
    writableFinished: false,
    write(chunk: string) {
      const payload = chunk.replace(/^data: /, "").trim();
      frames.push(JSON.parse(payload));
      return true;
    },
  };
  return { reply: { raw } as never, frames };
}

/** Capture the Pino warn lines one call produces. The service under test imports this same logger
 *  module instance, so swapping the method is enough to see its output, and it is swapped back in a
 *  `finally` so a failure here cannot silence the rest of the run. Format specifiers are left
 *  unexpanded on purpose: what has to survive a refactor is the format string. */
async function captureWarnings(run: () => Promise<void>): Promise<string[]> {
  const warnings: string[] = [];
  const original = logger.warn;
  (logger as unknown as Record<string, unknown>).warn = (...args: unknown[]) => {
    warnings.push(args.map((arg) => (typeof arg === "string" ? arg : String(arg))).join(" "));
  };
  try {
    await run();
  } finally {
    (logger as unknown as Record<string, unknown>).warn = original;
  }
  return warnings;
}

const db = await getDB();
const chats = createChatsStorage(db);
const createdChatIds: string[] = [];

async function createGameChat() {
  const chat = await chats.create({ name: "GM verb runtime", mode: "game", characterIds: [] } as Parameters<
    typeof chats.create
  >[0]);
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.patchMetadata(chat.id, { gameExperienceId: PACKAGE_ID });
  return chat.id;
}

async function readMetadata(chatId: string): Promise<Record<string, unknown>> {
  const row = await chats.getById(chatId);
  assert.ok(row);
  return JSON.parse((row.metadata as string) ?? "{}");
}

try {
  // ── The gated read, tier by tier ───────────────────────────────────────────

  const table = await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID });
  assert.ok(table, "a ready package declaring a hash-pinned table with chat-write resolves its verbs");
  assert.equal(table.packageId, PACKAGE_ID);
  assert.deepEqual(
    table.verbs.map((verb) => verb.name),
    ["weather", "standing"],
  );

  // A chat with no Experience package never reaches the package manager at all.
  assert.equal(await resolveGmVerbTable({}), null);
  assert.equal(await resolveGmVerbTable({ gameExperienceId: 42 }), null);
  assert.equal(await resolveGmVerbTable({ gameExperienceId: "not-installed" }), null);

  // Shipped in files[] but never declared as an asset: silent in both directions everywhere else in
  // the pipeline, and no verbs here.
  installFixture({ assetPaths: [OTHER_ASSET_PATH] });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);

  // The permission gate. This is the first place a declared capability permission is enforced
  // anywhere in the Engine, so its refusal is worth pinning rather than assuming.
  installFixture({ permissions: ["ui"] });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);

  // The byte ceiling. The fixture has to be GENUINELY oversized — a real >64 KB document with a
  // truthful sha256 and a truthful `files[].bytes` — or the assertion proves nothing: a manifest that
  // merely inflates `bytes` over a small file is refused by the integrity tier the moment the read
  // happens, so deleting the ceiling precheck outright would leave such a pin green.
  //
  // Oversized but otherwise perfectly valid: the envelope is `.strip()`, so an extra top-level field
  // parses fine and every verb below it survives. With the precheck removed this table RESOLVES,
  // which is exactly what makes the refusal below attributable to the ceiling and nothing else.
  const oversizeTableJson = JSON.stringify({ ...verbTable, padding: "p".repeat(GM_VERB_TABLE_MAX_BYTES) });
  assert.ok(Buffer.byteLength(oversizeTableJson) > GM_VERB_TABLE_MAX_BYTES, "the oversize fixture must be oversize");
  installFixture({ tableJson: oversizeTableJson });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);

  // The mirror, sitting exactly ON the ceiling: the same document shape, one padding field and all,
  // still resolves. Without this the refusal above could be coming from the padding field rather than
  // from the size, and the ceiling would not be shown to be a ceiling.
  const emptyPaddingBytes = Buffer.byteLength(JSON.stringify({ ...verbTable, padding: "" }));
  const atCeilingTableJson = JSON.stringify({
    ...verbTable,
    padding: "p".repeat(GM_VERB_TABLE_MAX_BYTES - emptyPaddingBytes),
  });
  assert.equal(Buffer.byteLength(atCeilingTableJson), GM_VERB_TABLE_MAX_BYTES, "the mirror must sit ON the ceiling");
  installFixture({ tableJson: atCeilingTableJson });
  const atCeiling = await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID });
  assert.ok(atCeiling, "a table exactly at the ceiling is accepted — the refusal above is the size");
  assert.equal(atCeiling.verbs.length, 2);

  // A separate tier, named for what it is: a manifest that lies about a small file's size is caught
  // by the integrity verification inside the read, not by the ceiling. Kept under the ceiling on
  // purpose so the two cannot be confused for each other.
  installFixture({ declaredBytes: Buffer.byteLength(JSON.stringify(verbTable)) + 1 });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);
  installFixture();
  assert.ok(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }));

  // Tampering: the bytes on disk are no longer the bytes that were installed. Loud in the log, and
  // no verbs — but still not an exception, because the turn survives every tier.
  const { versionRoot } = installFixture();
  writeFileSync(join(versionRoot, TABLE_PATH), JSON.stringify({ ...verbTable, schemaVersion: 1, tampered: true }));
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);

  // Malformed content that IS the installed content: a hash-valid file that is not JSON.
  installFixture({ tableJson: "{ not json" });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);

  // An update that needs a restart stops the verbs until one — readiness, not servability, so the
  // previous version's vocabulary is never served to a running Engine that no longer matches it.
  installFixture({ status: "restart-required" });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID }), null);

  // Key ownership is checked against the INSTALLING package, not against whoever authored the JSON.
  // The identical bytes that give Pixelforge two verbs give a package that does not own
  // `pixelforgeWeather` only the verb that writes nothing.
  //
  // What actually drops the verb here is the per-entry parse — `parseGmVerbTableWithCompat` builds
  // `createGmVerbSchema(packageId)` from the installing id — so this pins the schema reached THROUGH
  // the resolver, not the resolver's own re-check. That re-check exists as defense-in-depth against a
  // future second reader and is deliberately unreachable today; deleting it would not fail this.
  installFixture({ packageId: OTHER_PACKAGE_ID });
  const foreign = await resolveGmVerbTable({ gameExperienceId: OTHER_PACKAGE_ID });
  assert.ok(foreign);
  assert.deepEqual(
    foreign.verbs.map((verb) => verb.name),
    ["standing"],
    "a state verb whose metadataKey belongs to another package is dropped, and the rest of the table still runs",
  );

  // A table of nothing but refusable verbs resolves as no table at all rather than as an empty one.
  installFixture({
    packageId: OTHER_PACKAGE_ID,
    tableJson: JSON.stringify({ schemaVersion: 1, verbs: [verbTable.verbs[0]] }),
  });
  assert.equal(await resolveGmVerbTable({ gameExperienceId: OTHER_PACKAGE_ID }), null);

  // A reserved built-in tag name can never become a package verb. `state` is the sharpest: it drives
  // the combat transition, so a package verb by that name would have the engine's own tag stripped.
  // Same shape as the ownership case above: the drop happens in the per-entry parse, and the
  // resolver's matching re-check is unreachable defense-in-depth rather than the mechanism pinned.
  installFixture({
    tableJson: JSON.stringify({
      schemaVersion: 1,
      verbs: [{ ...verbTable.verbs[0], name: "state" }, verbTable.verbs[1]],
    }),
  });
  const reservedFiltered = await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID });
  assert.ok(reservedFiltered);
  assert.deepEqual(
    reservedFiltered.verbs.map((verb) => verb.name),
    ["standing"],
    "a reserved tag name is refused and the rest of the table still runs",
  );

  installFixture();
  const live = (await resolveGmVerbTable({ gameExperienceId: PACKAGE_ID })) as ResolvedTable;
  assert.ok(live);
  const weatherVerb = live.verbs.find((verb) => verb.name === "weather")!;
  const standingVerb = live.verbs.find((verb) => verb.name === "standing")!;

  // ── The prompt render and the parse agree ──────────────────────────────────

  const instructions = renderGmVerbInstructions(live);
  assert.equal(instructions.length, 2);
  // Two payload slots, both load-bearing: the schematic teaches the vocabulary, the example is one
  // concrete instance. Enums render as the alternation the built-in commands already use, optional
  // arguments are marked outside the JSON string, and an un-enum'd string advertises its cap.
  assert.equal(
    instructions[0],
    '- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — ' +
      'Set the world\'s weather when the sky visibly changes. Example: [weather:{"word":"fair"}]',
  );
  assert.equal(
    instructions[1],
    '- [standing:{"npc":"<text up to 40 chars>","stance":"none|known|friend|close|hostile",' +
      '"line"?:"<text up to 80 chars>"}] — Record how an NPC now regards the player. ' +
      'Example: [standing:{"npc":"<npc>","stance":"none"}]',
  );

  /** Split one rendered line back into the slot that teaches and the slot that is copyable. A
   *  description carries no square bracket (the schema refuses one), so the schematic always ends at
   *  the first `] — `; the example is last, so it is found from the right. */
  function splitVerbLine(line: string): { schematic: string; example: string } {
    const schematicEnd = line.indexOf("] — ");
    const exampleStart = line.lastIndexOf(" Example: [");
    assert.ok(schematicEnd > 0, `a rendered verb line must carry a schematic payload: ${line}`);
    assert.ok(exampleStart > schematicEnd, `a rendered verb line must carry an example: ${line}`);
    return {
      schematic: line.slice(0, schematicEnd + 1),
      example: line.slice(exampleStart + " Example: ".length),
    };
  }

  // The line has to TEACH the closed vocabulary, not merely show one member of it. An example can
  // only ever carry a single enum value, so a GM whose only channel is the example reaches for a
  // word that was never on the list — "sunny" for "fair", "friendly" for "friend" — the validator
  // refuses it, and the failure is SILENT: the tag is stripped on the name match rather than on
  // validation success, so the narration reads clean and the world simply never changed.
  //
  // Both sides of every assertion below come from the same parsed table the renderer read, which is
  // what makes the lane discriminate in both directions. Drop the enum render and the members stop
  // appearing in the line. Change an enum in the table without changing the render — a stale line —
  // and the expectation moves while the line does not. Neither failure can be papered over by a
  // literal copied into this file, because there is no literal to update.
  let enumArgsChecked = 0;
  for (const [index, verb] of live.verbs.entries()) {
    const line = instructions[index]!;
    assert.ok(line.startsWith(`- [${verb.name}:`), `instruction ${index} must belong to ${verb.name}: ${line}`);
    const { schematic, example } = splitVerbLine(line);
    for (const arg of verb.args) {
      // Asserted against the schematic alone: the example omits optional arguments entirely, and a
      // required one would otherwise be satisfied by the example's copy of the same key.
      const key = `${JSON.stringify(arg.name)}${arg.optional ? "?" : ""}:`;
      assert.ok(
        schematic.includes(key),
        `${verb.name} must declare ${arg.name}${arg.optional ? " as optional" : ""}: ${schematic}`,
      );
      if (!arg.enum) {
        // An un-enum'd string is bounded instead, and the cap is the only thing worth teaching.
        if (arg.type === "string") {
          assert.ok(
            schematic.includes(`up to ${arg.maxLength} chars`),
            `${verb.name}.${arg.name} must advertise its cap: ${schematic}`,
          );
        }
        continue;
      }
      enumArgsChecked += 1;
      assert.ok(arg.enum.length > 1, `fixture ${verb.name}.${arg.name} needs >1 enum member to prove anything`);
      // The whole closed set, verbatim, in declaration order, attached to its own argument.
      assert.ok(
        schematic.includes(`${key}${JSON.stringify(arg.enum.join("|"))}`),
        `${verb.name}.${arg.name} must render its whole enum: ${schematic}`,
      );
      for (const member of arg.enum) {
        assert.ok(schematic.includes(member), `${verb.name}.${arg.name} must name ${member} verbatim: ${schematic}`);
      }
      // And the reason the schematic exists at all: it carries members the example cannot.
      assert.ok(
        arg.enum.some((member) => !example.includes(member)),
        `${verb.name}.${arg.name} proves nothing if the example already shows every member: ${line}`,
      );
    }
  }
  assert.equal(enumArgsChecked, 3, "the enum lane must have actually run over the fixture's three enum arguments");

  // D9, the pin that matters most: every example the reminder shows the GM must parse back out as a
  // real call. A verb advertised but unmatchable would be emitted and left in the saved prose. The
  // schematic is deliberately NOT parseable — it is a grammar, not a payload — so this reads the
  // example slot, which is the half the model is told to copy.
  for (const line of instructions) {
    const { example } = splitVerbLine(line);
    const round = parseAndStripGmVerbCalls(`The scene shifts. ${example}`, live);
    assert.equal(round.calls.length, 1, `the reminder's own example must parse: ${example}`);
    assert.equal(round.content.trim(), "The scene shifts.");
  }

  // ── An impersonated turn is taught nothing ─────────────────────────────────
  //
  // The route decides this (the value it hands the reminder is gated on `!input.impersonate`, pinned
  // below); what is driven here is the half that decision rests on — that the rendered lines are the
  // ONLY thing the reminder gains from a verb table, so withholding them on an impersonated turn
  // withholds the whole vocabulary and nothing else. An impersonated turn is the player writing, and
  // no parser runs over it, so a taught verb could only ever surface as a raw bracket tag in the
  // player's own message: the built-in GM tags carry that same wart, but the client strips those by
  // name, and it does not know a package's.
  const reminderCtx = {
    gameActiveState: "exploration" as const,
    sessionNumber: 1,
    partyNames: ["Mira"],
    playerName: "Alyssa",
    map: null,
  };
  const reminderWithVerbs = buildGmFormatReminder({ ...reminderCtx, experienceGmVerbs: instructions });
  const reminderWithoutVerbs = buildGmFormatReminder({ ...reminderCtx, experienceGmVerbs: undefined });
  for (const line of instructions) {
    assert.ok(reminderWithVerbs.includes(line), `a non-impersonated reminder must carry ${line}`);
    assert.equal(reminderWithoutVerbs.includes(line), false, `an impersonated reminder must not carry ${line}`);
  }
  // Byte-identical, not merely verb-free: the gate must cost the impersonated turn its verbs and
  // nothing else about the reminder it would otherwise get.
  assert.equal(
    reminderWithoutVerbs,
    buildGmFormatReminder(reminderCtx),
    "withholding the verbs must leave the rest of the reminder untouched",
  );
  // And the verb names themselves are gone, not just the rendered lines — a partial render that
  // leaked a bare name would still teach a vocabulary nothing will hear.
  for (const verb of live.verbs) {
    assert.equal(
      reminderWithoutVerbs.includes(`[${verb.name}:`),
      false,
      `an impersonated reminder must not name ${verb.name} at all`,
    );
  }

  // ── A verb-only turn keeps its turn ────────────────────────────────────────
  //
  const anchorGateBase = { impersonate: false, hasActionableOutput: false, spatialDirectiveDetected: false };
  assert.equal(
    shouldSaveHiddenGenerationAnchor({ ...anchorGateBase, hasActionableOutput: true }),
    true,
    "any successfully parsed command-only turn gets a hidden anchor, including Game verbs and tools",
  );
  assert.equal(shouldSaveHiddenGenerationAnchor(anchorGateBase), false, "empty and unrecognized output still errors");
  assert.equal(
    shouldSaveHiddenGenerationAnchor({ ...anchorGateBase, impersonate: true, hasActionableOutput: true }),
    false,
    "impersonation never executes assistant commands",
  );

  // ── Narration scan ─────────────────────────────────────────────────────────

  const clean = parseAndStripGmVerbCalls('Rain sheets down. [weather:{"word":"storm","intensity":"heavy"}]', live);
  assert.equal(clean.matched, true);
  assert.equal(clean.content.trim(), "Rain sheets down.");
  assert.deepEqual(
    clean.calls.map((call) => call.args),
    [{ word: "storm", intensity: "heavy" }],
  );

  // A tag is stripped on the NAME match, never on validation success — a command the model got
  // slightly wrong is still a command, and leaving it in shows the player machinery.
  for (const bad of [
    '[weather:{"word":"apocalypse"}]', // out of enum
    "[weather:{not json}]", // unparseable payload
    '[weather:{"word":"fair","unknown":1}]', // undeclared argument
    "[weather:{}]", // missing a required argument
    '[weather:{"word":3}]', // wrong type
    '[standing:{"npc":"Mira","stance":"friend","line":"' + "x".repeat(81) + '"}]', // over maxLength
  ]) {
    const refused = parseAndStripGmVerbCalls(`Before. ${bad} After.`, live);
    assert.equal(refused.calls.length, 0, `must refuse ${bad}`);
    assert.equal(refused.matched, true);
    assert.equal(refused.content.replace(/\s+/g, " ").trim(), "Before. After.", `must still strip ${bad}`);
  }

  // A tag this chat's package does not declare is left exactly as written — it may belong to another
  // parser, or be ordinary prose in brackets.
  const untouched = '[inventory: action="add" item="Rope"] and [state: combat]';
  assert.equal(parseAndStripGmVerbCalls(untouched, live).content, untouched);
  assert.equal(parseAndStripGmVerbCalls(untouched, live).matched, false);

  // The shared grammar is case-insensitive, so an uppercase spelling is the same verb. (The fold
  // itself must also be locale-INDEPENDENT — `toLowerCase`, never `toLocaleLowerCase`, which maps
  // "I" to a dotless "ı" under a Turkish/Azeri runtime locale and would miss the lookup map. That
  // divergence is not observable from inside this process, so it is a code rule, not this assertion.)
  const shouted = parseAndStripGmVerbCalls('[WEATHER:{"word":"fair"}] The sky clears.', live);
  assert.equal(shouted.calls.length, 1, "a verb tag the GM shouted is the same verb");
  assert.deepEqual(shouted.calls[0]!.args, { word: "fair" });

  // Why the tag pattern is EXPORTED from the conversation-command registry rather than rewritten
  // here: a JSON payload may itself contain `]`, and the shared grammar matches a `{…}` brace run
  // before falling back to bracket-free text. A private `[^\]]*` parse would stop at the inner
  // bracket, match nothing, and leave the tag in the player's prose.
  const bracketPayload = parseAndStripGmVerbCalls('[standing:{"npc":"Mira]Tam","stance":"friend"}] Then.', live);
  assert.equal(bracketPayload.calls.length, 1, "a `]` inside a JSON payload must not end the tag");
  assert.deepEqual(bracketPayload.calls[0]!.args, { npc: "Mira]Tam", stance: "friend" });
  assert.equal(bracketPayload.content.trim(), "Then.");

  // One call per verb name per message. Both tags go, one call survives — a real ceiling, not a
  // formality: a repeated event verb is meaningful prose this cut collapses.
  const repeated = parseAndStripGmVerbCalls('[weather:{"word":"rain"}] then [weather:{"word":"fair"}]', live);
  assert.equal(repeated.calls.length, 1);
  assert.deepEqual(repeated.calls[0]!.args, { word: "rain" });
  assert.equal(repeated.content.trim(), "then");

  // ── A MIXED turn: a verb tag and a skill check in one narration ────────────
  //
  // The sixth turn shape, and the one where the two Game-mode post-processing passes meet. Their
  // order is load-bearing rather than incidental: the verb pass DELETES text — a matched tag leaves
  // the narration entirely — while the check pass only REWRITES a `[skill_check:]` in place. Strip
  // first and the roller sees exactly the text that survives into the saved turn; roll first and a
  // check the strip was about to carry off has already thrown a real die and read the chat's
  // modifier snapshot to write numbers nothing will ever display.
  const mixedNarration =
    'Rain sheets down. [weather:{"word":"storm","intensity":"heavy"}] You press flat against the crates. ' +
    '[skill_check: skill="Stealth" dc="15"]';
  const mixedStrip = parseAndStripGmVerbCalls(mixedNarration, live);
  assert.equal(mixedStrip.calls.length, 1, "the verb still parses out of a turn that also asks for a check");
  assert.deepEqual(mixedStrip.calls[0]!.args, { word: "storm", intensity: "heavy" });
  assert.ok(
    mixedStrip.content.includes('[skill_check: skill="Stealth" dc="15"]'),
    "the verb strip must leave the check tag alone — it belongs to the roller, and it is content",
  );

  // …and what survives the strip is exactly what the roller is handed.
  const mixedRolled = await resolveSkillCheckTagsInContent(mixedStrip.content, {
    loadContext: async () => ({ skills: { Stealth: 2 }, attributes: null, sheetAttributes: { dex: 14 } }),
    rollD20: () => 12,
    chatId: "mixed-turn",
  });
  assert.equal(mixedRolled.resolved, 1, "the check in a mixed turn is rolled like any other");
  const mixedTag = parseSkillCheckTagBody(mixedRolled.content.match(/\[skill_check:\s*([^\]]+)\]/u)![1]!);
  assert.equal(mixedTag?.resolvedResult?.usedRoll, 12, "the engine's own die");
  assert.equal(mixedTag?.resolvedResult?.total, 16, "12, plus Stealth's +2 and DEX 14's +2");
  assert.ok(mixedRolled.content.includes("Rain sheets down."), "the prose either pass left alone survives both");
  assert.ok(mixedRolled.content.includes("You press flat against the crates."));
  assert.doesNotMatch(mixedRolled.content, /\[weather:/u, "the verb tag is gone; the player never sees the machinery");

  // The turn-shape consequence: a resolved check is content, so a mixed turn is never empty and
  // never reaches the hidden-anchor branch. It takes the ordinary saved-message path and executes
  // its verbs there, which is why the anchor gate above can stay scoped to the verb-only shape.
  assert.ok(mixedRolled.content.trim().length > 0, "a mixed turn always has a message of its own to claim against");

  // An optional argument may simply be absent; it is never defaulted into the payload.
  assert.deepEqual(validateGmVerbArgs(weatherVerb, '{"word":"snow"}'), { ok: true, args: { word: "snow" } });
  // A number argument is rejected rather than coerced from its string spelling.
  assert.equal(validateGmVerbArgs(standingVerb, '{"npc":"Mira","stance":"friend"}').ok, true);
  assert.equal(validateGmVerbArgs(standingVerb, '{"npc":5,"stance":"friend"}').ok, false);
  assert.equal(validateGmVerbArgs(standingVerb, "[]").ok, false);

  // ── The executor, against a real chat row ──────────────────────────────────

  const chatId = await createGameChat();
  const message = await chats.createMessage({ chatId, role: "assistant", content: "The sky turns." });
  assert.ok(message?.id);
  const turn = { chatId, messageId: message.id, swipeIndex: 0 };

  const before = await chats.getById(chatId);
  assert.ok(before);
  const updatedAtBefore = before.updatedAt;

  const stateReply = createReplyDouble();
  await executeGmVerbCalls({
    calls: [{ verb: weatherVerb, args: { word: "storm" } }],
    table: live,
    turn,
    store: chats,
    reply: stateReply.reply,
  });

  const afterWrite = await readMetadata(chatId);
  assert.deepEqual(afterWrite.pixelforgeWeather, { word: "storm" }, "a state verb writes its args wholesale");
  const ordinals = afterWrite.metadataWriteOrdinals as Record<string, number>;
  assert.ok(typeof ordinals?.pixelforgeWeather === "number", "the write draws from the chat's write ordinal");
  const firstOrdinal = ordinals.pixelforgeWeather;
  // A GM verb is not the player touching the chat; bumping the row would reorder the chat list.
  assert.equal((await chats.getById(chatId))!.updatedAt, updatedAtBefore, "a verb write must not touch updatedAt");
  // A state verb emits nothing itself — props re-delivery after the route's metadata_patch is the
  // whole delivery mechanism.
  assert.deepEqual(stateReply.frames, []);

  // Provenance: a truthy OBJECT, or the storage guard treats the slot as unclaimed forever.
  const claimedSwipes = await chats.getSwipes(message.id);
  const claim = JSON.parse(
    (claimedSwipes.find((swipe: { index: number }) => swipe.index === 0)!.extra as string) ?? "{}",
  );
  assert.equal(typeof claim["gmVerb:weather"], "object");
  assert.equal(claim["gmVerb:weather"].verb, "weather");
  assert.deepEqual(claim["gmVerb:weather"].args, { word: "storm" });

  // THE safety property. The same verb applied again replaces the same value, so nothing accumulates
  // and the ordinal does not move — this, not the claim, is why a duplicate dispatch is harmless.
  await executeGmVerbCalls({
    calls: [{ verb: weatherVerb, args: { word: "storm" } }],
    table: live,
    turn,
    store: chats,
    reply: createReplyDouble().reply,
  });
  const afterDuplicate = await readMetadata(chatId);
  assert.deepEqual(afterDuplicate.pixelforgeWeather, { word: "storm" });
  assert.equal((afterDuplicate.metadataWriteOrdinals as Record<string, number>).pixelforgeWeather, firstOrdinal);

  // A second, different apply replaces the whole value rather than merging into it, so a payload can
  // never accumulate stale keys from an earlier turn.
  await executeGmVerbCalls({
    calls: [{ verb: weatherVerb, args: { word: "fair", intensity: "light" } }],
    table: live,
    turn,
    store: chats,
    reply: createReplyDouble().reply,
  });
  assert.deepEqual((await readMetadata(chatId)).pixelforgeWeather, { word: "fair", intensity: "light" });

  // ── The event half ─────────────────────────────────────────────────────────

  const eventReply = createReplyDouble();
  await executeGmVerbCalls({
    calls: [{ verb: standingVerb, args: { npc: "Mira", stance: "hostile" } }],
    table: live,
    turn,
    store: chats,
    reply: eventReply.reply,
  });
  assert.equal(eventReply.frames.length, 1, "one validated event verb emits exactly one frame");
  assert.deepEqual(eventReply.frames[0], {
    type: "gm_verb",
    data: {
      packageId: PACKAGE_ID,
      verb: "standing",
      args: { npc: "Mira", stance: "hostile" },
      chatId,
      messageId: message.id,
      swipeIndex: 0,
    },
  });
  // The package is addressed explicitly on the envelope rather than through a convention field
  // inside the payload, which is the one thing this channel improves on the turn-game bridge.
  assert.equal(eventReply.frames[0]!.data.packageId, PACKAGE_ID);
  // Nothing durable: the event verb wrote no metadata key of its own.
  assert.equal("standing" in (await readMetadata(chatId)), false);

  // A stream the client has already dropped. Three things at once, and all three are the design: no
  // frame, no throw, and one warn — the ONLY trace a lost event verb ever leaves, so it is asserted
  // rather than described — plus a claim that still records the Engine executed the verb, which is
  // true whether or not anyone heard it. Claiming only on delivery would be the tempting change, and
  // it is what this pins against.
  const deadReply = createReplyDouble({ writable: false });
  const deadMessage = await chats.createMessage({ chatId, role: "assistant", content: "Lost turn." });
  const lostWarnings = await captureWarnings(() =>
    executeGmVerbCalls({
      calls: [{ verb: standingVerb, args: { npc: "Tam", stance: "friend" } }],
      table: live,
      turn: { chatId, messageId: deadMessage!.id, swipeIndex: 0 },
      store: chats,
      reply: deadReply.reply,
    }),
  );
  assert.deepEqual(deadReply.frames, [], "an unwritable reply delivers nothing");
  assert.equal(
    lostWarnings.filter((line) => line.includes("was not delivered")).length,
    1,
    "a lost event verb must leave exactly one warn — nothing else records that the effect vanished",
  );
  const deadSwipes = await chats.getSwipes(deadMessage!.id);
  const deadExtra = deadSwipes.find((swipe: { index: number }) => swipe.index === 0)!.extra as string | null;
  assert.equal(
    typeof JSON.parse(deadExtra ?? "{}")["gmVerb:standing"],
    "object",
    "the claim records execution, not delivery, so it is written even when the frame was lost",
  );

  // ── Isolation, and the paths with no message to claim against ──────────────

  // One verb's failure never costs another verb its effect.
  const mixedReply = createReplyDouble();
  const throwingStore = {
    ...chats,
    patchMetadata: async () => {
      throw new Error("storage is down");
    },
  } as unknown as typeof chats;
  await executeGmVerbCalls({
    calls: [
      { verb: weatherVerb, args: { word: "snow" } },
      { verb: standingVerb, args: { npc: "Mira", stance: "known" } },
    ],
    table: live,
    turn,
    store: throwingStore,
    reply: mixedReply.reply,
  });
  assert.equal(mixedReply.frames.length, 1, "a failed state verb must not stop the event verb behind it");
  assert.deepEqual((await readMetadata(chatId)).pixelforgeWeather, { word: "fair", intensity: "light" });

  // The committed-write signal must not ride on the claim. The claim is provenance and can fail on
  // its own; a write the client is never told to refetch leaves the package showing a stale world
  // until the chat is reopened, which is the one failure the player would actually see.
  let notifiedDespiteClaimFailure = false;
  await executeGmVerbCalls({
    calls: [{ verb: weatherVerb, args: { word: "snow" } }],
    table: live,
    turn,
    store: {
      ...chats,
      claimMessageExtraForSwipe: async () => {
        throw new Error("claim storage is down");
      },
    } as unknown as typeof chats,
    reply: createReplyDouble().reply,
    onMetadataWritten: () => {
      notifiedDespiteClaimFailure = true;
    },
  });
  assert.equal(notifiedDespiteClaimFailure, true, "a committed write is announced even when its claim fails");
  assert.deepEqual((await readMetadata(chatId)).pixelforgeWeather, { word: "snow" });

  // A mixed turn: both halves run, and each does its own thing.
  const bothReply = createReplyDouble();
  await executeGmVerbCalls({
    calls: [
      { verb: weatherVerb, args: { word: "overcast" } },
      { verb: standingVerb, args: { npc: "Tam", stance: "close" } },
    ],
    table: live,
    turn,
    store: chats,
    reply: bothReply.reply,
  });
  assert.equal(bothReply.frames.length, 1);
  assert.deepEqual((await readMetadata(chatId)).pixelforgeWeather, { word: "overcast" });

  // The verb-only turn's own message: a hidden, empty, command-only anchor, shaped exactly as the
  // route saves it. This is the message the writes now claim against, and the point of the anchor —
  // before it, this turn produced no message at all and the executor was never reached. Both halves
  // run against it, the metadata callback fires (the route turns that into `metadata_patch`), and
  // the only frame on the wire is the event verb's: no error frame anywhere in the turn.
  const anchorMessage = await chats.createMessage({ chatId, role: "assistant", content: "" });
  assert.ok(anchorMessage?.id);
  await chats.updateMessageExtra(anchorMessage.id, {
    hiddenFromUser: true,
    hiddenFromAI: true,
    commandOnly: true,
    isGenerated: true,
  });
  const anchorReply = createReplyDouble();
  let anchorMetadataWritten = false;
  await executeGmVerbCalls({
    calls: [
      { verb: weatherVerb, args: { word: "snow", intensity: "heavy" } },
      { verb: standingVerb, args: { npc: "Tam", stance: "hostile" } },
    ],
    table: live,
    turn: { chatId, messageId: anchorMessage.id, swipeIndex: anchorMessage.activeSwipeIndex ?? 0 },
    store: chats,
    reply: anchorReply.reply,
    onMetadataWritten: () => {
      anchorMetadataWritten = true;
    },
  });
  assert.equal(anchorMetadataWritten, true, "a verb-only turn's state write must announce itself for refetch");
  assert.deepEqual(
    (await readMetadata(chatId)).pixelforgeWeather,
    { word: "snow", intensity: "heavy" },
    "a verb-only turn's state write lands through patchMetadata like any other",
  );
  assert.deepEqual(
    anchorReply.frames.map((frame) => frame.type),
    ["gm_verb"],
    "a verb-only turn sends its event verb and nothing else — no error frame",
  );
  const anchorSwipes = await chats.getSwipes(anchorMessage.id);
  const anchorExtra = anchorSwipes.find((swipe: { index: number }) => swipe.index === 0)!.extra as string | null;
  const anchorClaim = JSON.parse(anchorExtra ?? "{}");
  assert.equal(anchorClaim["gmVerb:weather"]?.verb, "weather", "the anchor carries the claim the prose turn would");
  assert.equal(anchorClaim.hiddenFromUser, true, "the claim must not clobber what makes the anchor an anchor");

  // An empty messageId costs the CLAIM, never the write or the emit. The claim buys provenance, not
  // dedupe, so losing it loses a record and nothing else.
  const anonymousReply = createReplyDouble();
  await executeGmVerbCalls({
    calls: [
      { verb: weatherVerb, args: { word: "rain" } },
      { verb: standingVerb, args: { npc: "Mira", stance: "none" } },
    ],
    table: live,
    turn: { chatId, messageId: "", swipeIndex: 0 },
    store: chats,
    reply: anonymousReply.reply,
  });
  assert.deepEqual((await readMetadata(chatId)).pixelforgeWeather, { word: "rain" });
  assert.equal(anonymousReply.frames.length, 1);
  assert.equal(
    await claimGmVerb(chats, weatherVerb, { word: "rain" }, { chatId, messageId: "", swipeIndex: 0 }),
    false,
  );

  // The write shape is `patchMetadata` and nothing else, so a state verb can only ever replace its
  // own key — never read-modify-write a whole metadata object and lose a concurrent turn's write.
  await assert.rejects(
    () => applyGmVerbWrite(chats, chatId, standingVerb, { npc: "Mira", stance: "none" }),
    /no metadataKey/,
    "an event verb has no key and must never reach the write path",
  );

  // ── Wiring pins the unit tests above cannot see ────────────────────────────

  const generateRoute = readFileSync(join(repositoryRoot, "packages/server/src/routes/generate.routes.ts"), "utf8");
  // C4: the Conversation command surface is gated by one flag for the whole surface. The verb path
  // must never flip it — that would arm every registered conversation command on every game turn.
  assert.match(
    generateRoute,
    /const conversationCommandsEnabled = chatMode === "conversation" && chatMeta\.characterCommands !== false;/,
    "the conversation-command gate must stay conversation-only",
  );
  assert.match(
    generateRoute,
    /if \(chatMode === "game" && !input\.impersonate && fullResponse\) \{/,
    "the GM verb scan must run on its own game-mode-only path",
  );
  // The seam's ORDER, which the mixed-turn lane above drives but cannot see the route commit to.
  // The verb pass deletes text and the check pass only rewrites a tag in place, so the dependency
  // runs one way: strip, then roll. Reversed, a check the strip was about to carry off has already
  // thrown a real die and read the chat's modifiers to write numbers nothing will ever display.
  const verbScanAt = generateRoute.indexOf('if (chatMode === "game" && !input.impersonate && fullResponse) {');
  const checkRollAt = generateRoute.indexOf("resolveSkillCheckTagsInContent(fullResponse");
  assert.ok(verbScanAt > 0 && checkRollAt > 0, "both Game-mode post-processing passes must exist");
  assert.ok(verbScanAt < checkRollAt, "verbs are stripped before the turn's checks are rolled, never after");

  // The other side of that same predicate. Teach and parse must agree on WHO is speaking: a turn the
  // scan above skips must not be handed the vocabulary, or the model writes a tag nobody removes and
  // it lands raw in the player's own impersonated message.
  assert.match(
    generateRoute,
    /experienceGmVerbs:\s*\n?\s*gmVerbTableForPrompt && !input\.impersonate \?/,
    "the reminder must withhold the verb vocabulary on the same turns the scan skips",
  );

  // A verb-only turn strips to empty, and the anchor gate is what stands between it and the error
  // branch. The count has to be wired in from the scan, or the gate sees two zeros and says no.
  // Scoped to the gate's own call rather than the bare field: the same count also rides the warn
  // payload a few lines above, and a pin that either one satisfies proves nothing about the gate.
  const anchorGateCall = generateRoute.match(
    /shouldSaveHiddenGenerationAnchor\(\{[\s\S]*?hasActionableOutput:[\s\S]*?collectedGmVerbCalls\.length > 0[\s\S]*?\}\)/,
  );
  assert.ok(anchorGateCall, "the hidden-anchor gate must see how many verbs this turn parsed");
  // Saving the anchor is only half of it: the execution site sits past the early return that path
  // takes, so the anchor branch has to reach it explicitly or the writes are still discarded.
  assert.match(
    generateRoute,
    /await executeCollectedGmVerbCalls\(\{\s*\n?\s*messageId: anchoredMsg\?\.id/,
    "the hidden-anchor path must execute the turn's verbs before it returns",
  );
  assert.equal(
    (generateRoute.match(/await executeCollectedGmVerbCalls\(/g) ?? []).length,
    2,
    "both turn shapes — the saved message and the hidden anchor — execute the verbs, and only those two",
  );
  // Ordering, because the two live in one `if`/fallthrough: the gate must be consulted BEFORE the
  // empty-response error is sent, or a verb-only turn is told it produced nothing.
  assert.ok(
    generateRoute.indexOf(anchorGateCall[0]) < generateRoute.indexOf("The AI returned an empty response."),
    "the verb count must reach the anchor gate ahead of the empty-response error frame",
  );

  // The next three are SOURCE-TEXT pins, and named as such: the execution site lives inside a
  // several-thousand-line Fastify handler that no regression can drive, so a grep of the guard is the
  // honest option rather than a claim to have exercised it. Each one is a behavior that survives
  // being deleted otherwise.
  //
  // A stopped turn changes nothing. Policy for the state half; forced for the event half, where the
  // client has already dropped the stream and the frame would evaporate unlogged.
  assert.match(
    generateRoute,
    /collectedGmVerbCalls\.length > 0 && gmVerbTable && !abortController\.signal\.aborted/,
    "GM verb execution must be skipped on an aborted turn",
  );
  // The committed-write signal. Without this frame a state verb's write never reaches the package
  // until the chat is reopened — props re-delivery after the refetch IS the delivery mechanism, and
  // there is no second event carrying the value.
  assert.match(
    generateRoute,
    /data: \{ source: "gm_verb", packageId: gmVerbTable\.packageId \}/,
    "a committed GM verb write must emit metadata_patch so the package's props re-deliver",
  );
  // D9: one resolution per turn, threaded to both the prompt render and the post-save parse. Two
  // resolutions could disagree — a package updated mid-turn, a table that stops verifying — and the
  // reminder would then advertise a verb the parser no longer matches, leaving a raw tag in the prose.
  assert.match(
    generateRoute,
    /if \(gmVerbTableResolved\) return gmVerbTable;\s*\n\s*gmVerbTableResolved = true;/,
    "the verb table must resolve at most once per turn",
  );

  const useGenerate = readFileSync(join(repositoryRoot, "packages/client/src/hooks/use-generate.ts"), "utf8");
  // Both SSE switches, always. A case in one switch and not the other is a silent no-op on whichever
  // route was forgotten — which is exactly how `metadata_patch` came to be missing from the retry
  // twin while three server sites were emitting it.
  for (const [eventType, expected] of [
    ["gm_verb", 2],
    ["metadata_patch", 2],
  ] as const) {
    assert.equal(
      useGenerate.split(`case "${eventType}":`).length - 1,
      expected,
      `${eventType} must be handled in BOTH the main and retry SSE switches`,
    );
  }
  assert.equal(
    (generateRoute.match(/type: "gm_verb"/g) ?? []).length +
      (
        readFileSync(
          join(
            repositoryRoot,
            "packages/server/src/services/capability-packages/capability-gm-verb-runtime.service.ts",
          ),
          "utf8",
        ).match(/type: "gm_verb"/g) ?? []
      ).length,
    1,
    "the gm_verb envelope is built in exactly one place",
  );

  // The seam is advertised only now that the runtime behind it exists.
  assert.deepEqual({ ...supportedCapabilityApi }, { major: 1, minor: 16 });
  const manifestSchema = readFileSync(
    join(repositoryRoot, "packages/shared/src/schemas/capability-package.schema.ts"),
    "utf8",
  );
  assert.match(
    manifestSchema,
    /^\/\/ 1\.16: /m,
    "every capability API version carries its own line in the ladder — 1.9 is the counterexample nobody wants a second of",
  );

  console.log("Capability GM verb runtime regression passed.");
} finally {
  for (const chatId of createdChatIds) {
    await chats.remove(chatId).catch(() => undefined);
  }
  await closeDB().catch(() => undefined);
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  if (previousMarinaraFileStorageDir === undefined) delete process.env.MARINARA_FILE_STORAGE_DIR;
  else process.env.MARINARA_FILE_STORAGE_DIR = previousMarinaraFileStorageDir;
}

/**
 * Setting kits (worldgen W0): the words and scales a kind of setting is written in.
 *
 *   - Every starter kit reads as a kit, in the order the picker shows them, with ids of its own.
 *   - The first set is the approved eight, more than one of them not European, and a modern-day kit
 *     that is gentle by default (no crime, conflict or catastrophe, at a slow pace).
 *   - A kit that is not one is refused, with the reason: no settlements layer or two, a repeated id,
 *     an empty ladder, text that could break the Game Master's prompt, a kind of change the world
 *     model does not have.
 *   - The Game Master is told the kit in its own words, with the kinds of change the world does not
 *     have named as off-limits, in the system prompt and in world generation; a game without a kit
 *     gets neither block.
 *   - A word the player types gets an id it can always be stored under.
 *   - The model writes a kit from the player's kit and setting; a kit that does not hold together is
 *     sent back once with the reasons, then refused with them.
 *   - A new game stores the kit it was created with, and refuses one that does not hold together.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WORLD_CHANGE_KINDS,
  WORLD_STARTER_KITS,
  createConnectionSchema,
  gameWorldKitFromMetadata,
  parseWorldKit,
  worldKitEntries,
  worldKitPromptText,
  type WorldKitInput,
} from "../../packages/shared/src/index.js";

const kits = WORLD_STARTER_KITS.map((kit) => {
  const parsed = parseWorldKit(kit);
  assert.ok(parsed.ok, `${kit.id}: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.kit;
});
assert.deepEqual(
  kits.map((kit) => kit.id),
  [
    "high_fantasy",
    "wuxia_xianxia",
    "modern_day",
    "modern_supernatural",
    "the_1920s",
    "cyberpunk",
    "space_opera",
    "post_apocalyptic",
  ],
);
for (const kit of kits) {
  assert.deepEqual(Object.keys(kit.change.kinds), [...WORLD_CHANGE_KINDS], `${kit.id} names every kind of change`);
  assert.equal(kit.layers.filter((layer) => layer.settlements).length, 1);
  for (const key of ["groupKinds", "sizes", "travel"] as const) {
    for (const entry of kit[key]) assert.match(entry.id, /^[a-z][a-z0-9_]*$/, `${kit.id} ${entry.label}`);
  }
}
const byId = new Map(kits.map((kit) => [kit.id, kit]));
// Slice of life is gentle by default.
const modern = byId.get("modern_day")!;
assert.deepEqual(
  WORLD_CHANGE_KINDS.filter((kind) => !modern.change.kinds[kind].on),
  ["crime", "conflict", "catastrophe"],
);
assert.equal(modern.change.pace, "slow");
// A word that carries an accent keeps a plain id.
assert.ok(modern.groupKinds.some((group) => group.id === "cafe" && group.label === "café"));
// Wuxia: the empire's ladder, the jianghu's groups, its own calendar.
const wuxia = byId.get("wuxia_xianxia")!;
assert.deepEqual(
  wuxia.sizes.map((size) => size.label),
  ["village", "market town", "county seat", "prefecture city", "capital"],
);
assert.equal(wuxia.calendar.months?.length, 12);
assert.ok(wuxia.groupKinds.some((group) => group.id === "sect"));

// Refusals.
const base = WORLD_STARTER_KITS[0]!;
const refused = (edit: (kit: Record<string, any>) => void, pattern: RegExp, what: string) => {
  const kit = structuredClone(base) as Record<string, any>;
  edit(kit);
  const parsed = parseWorldKit(kit);
  assert.equal(parsed.ok, false, `${what}: should be refused`);
  if (!parsed.ok)
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: ${parsed.issues.join("; ")}`,
    );
};
refused((kit) => delete kit.layers[2].settlements, /layers: Exactly one layer holds the settlements/, "no settlements");
refused((kit) => (kit.layers[0].settlements = true), /Exactly one layer holds the settlements/, "two settlements");
refused((kit) => (kit.sizes[1].id = kit.sizes[0].id), /sizes\.1\.id: Repeats the id "hamlet"/, "a repeated size");
refused((kit) => (kit.cultures[1].id = kit.cultures[0].id), /cultures\.1\.id: Repeats the id/, "a repeated culture");
refused((kit) => (kit.sizes = []), /sizes/, "an empty ladder");
refused((kit) => (kit.label = "High [fantasy]"), /label: Text cannot contain square brackets/, "a GM tag's shape");
refused((kit) => (kit.summary = "Two\nlines"), /summary: Text cannot contain line breaks/, "a line break");
refused(
  (kit) => (kit.change.kinds.romance = { label: "romance", on: true }),
  /change\.kinds/,
  "a kind the model lacks",
);
refused((kit) => delete kit.change.kinds.crime, /change\.kinds\.crime/, "a kind left out");
refused((kit) => (kit.change.pace = "frantic"), /change\.pace/, "an unknown pace");
refused((kit) => (kit.scale = "galaxy"), /scale/, "an unknown scale");
refused(
  (kit) =>
    (kit.layers = Array.from({ length: 9 }, (_, i) => ({
      id: `l${i}`,
      label: `l${i}`,
      settlements: i === 0 || undefined,
    }))),
  /layers/,
  "nine layers",
);
refused((kit) => (kit.cultures[0].naming = "x".repeat(601)), /cultures\.0\.naming/, "a long naming note");
refused((kit) => (kit.id = "High Fantasy"), /id: An id is lowercase letters/, "an id");
refused((kit) => (kit.extra = true), /Unrecognized key/, "an unknown key");
const typed: WorldKitInput = base; // the starter kits are written as kit input
assert.equal(typed.schemaVersion, 1);

// ── What the Game Master is told ──
{
  const block = worldKitPromptText(modern);
  assert.ok(block.startsWith("<world>\n") && block.endsWith("\n</world>"));
  assert.ok(block.includes("The kind of setting: Modern day."));
  assert.ok(block.includes("A city is, from smallest: village, small town, town, city, metropolis."));
  assert.ok(block.includes("at a slow pace: seasons, festivals and school terms;"), block);
  assert.ok(
    block.includes(
      "This world does not have thefts, scams and trouble; violence and feuds; disasters and epidemics. Never bring them in",
    ),
    block,
  );
  assert.ok(!/at a slow pace:[^\n]*violence/.test(block), "a kind that is off is never listed as on");
  const fantasy = worldKitPromptText(byId.get("high_fantasy")!);
  assert.ok(!fantasy.includes("does not have"), "a kit with every kind on names nothing as off-limits");
  assert.ok(wuxia && worldKitPromptText(wuxia).includes(`a year is called "year of the reign"`));
  assert.ok(worldKitPromptText(wuxia).includes("years are counted by reign era"));
  assert.ok(worldKitPromptText(wuxia).includes("- Names (people of the Central Plains): Family name first"));
  const still = parseWorldKit({ ...structuredClone(base), change: { ...base.change, pace: "still" } });
  assert.ok(still.ok);
  assert.ok(worldKitPromptText(still.kit).includes("The world beyond the scene does not change on its own."));
}

// ── The stored kit, read back ──
assert.equal(gameWorldKitFromMetadata(null), null);
assert.equal(gameWorldKitFromMetadata({}), null);
assert.equal(gameWorldKitFromMetadata({ gameWorldKit: { id: "broken" } }), null, "a stored kit that broke is left out");
assert.equal(gameWorldKitFromMetadata({ gameWorldKit: modern })?.label, "Modern day");

// ── A word the player types always gets an id ──
assert.deepEqual(
  worldKitEntries(["thieves' guild", "café", "村", "1920s club", "x".repeat(80)]).map((entry) => entry.id),
  ["thieves_guild", "cafe", "entry_3", "n_1920s_club", "x".repeat(36)],
);
for (const entry of worldKitEntries(["город", "  ", "Ünïcödé Hall"])) assert.match(entry.id, /^[a-z][a-z0-9_]{0,39}$/);

// ── The server: the model writing a kit, a new game storing one, and the prompts that read it ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-kits-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

// A stand-in model that answers from a script, one reply per request.
const replies: string[] = [];
const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push(body);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "stand-in",
      model: body.model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: replies.shift() ?? "" } }],
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { buildGmSystemPrompt, buildSetupPrompt } = await import("../../packages/server/src/services/game/gm-prompts.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { injectGameGmPromptRuntime } =
  await import("../../packages/server/src/services/generation/game-gm-prompt-runtime.js");
const { errorHandler } = await import("../../packages/server/src/middleware/error-handler.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  const connection = await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Stand-in",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "stand-in",
      apiKey: "sk-stand-in",
    }),
  );
  const write = (start?: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/game/world-kit",
      payload: {
        connectionId: connection!.id,
        genre: "Slice of life",
        setting: "A harbor town where the ferry is late",
        tone: "Cozy",
        ...(start ? { start } : {}),
      },
    });
  const harbor = { ...structuredClone(modern), id: "harbor_life", label: "Harbor town life" } as Record<string, any>;

  // Written right the first time, from the player's kit; the Engine sets the schema version.
  {
    requests.length = 0;
    const { schemaVersion: _, ...unversioned } = harbor;
    replies.push(`\`\`\`json\n${JSON.stringify(unversioned)}\n\`\`\``);
    const response = await write(modern);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().kit.label, "Harbor town life");
    assert.equal(response.json().kit.schemaVersion, 1);
    assert.equal(response.json().kit.id, "written", "a written kit is the player's own, never a starter");
    assert.equal(requests.length, 1);
    const [system, user] = requests[0]!.messages;
    assert.ok(system!.content.includes(`Exactly one layer has "settlements": true`));
    assert.ok(user!.content.includes("Setting: A harbor town where the ferry is late"));
    assert.ok(user!.content.includes(`"id": "modern_day"`), "the model starts from the player's kit");
  }
  // Refused once: sent back with the reasons, then accepted.
  {
    requests.length = 0;
    const twoSettlements = structuredClone(harbor);
    twoSettlements.layers[0].settlements = true;
    replies.push(JSON.stringify(twoSettlements), JSON.stringify(harbor));
    const response = await write();
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(requests.length, 2);
    const retry = requests[1]!.messages;
    assert.equal(retry.length, 4);
    assert.equal(retry[2]!.role, "assistant");
    assert.ok(retry[3]!.content.includes("layers: Exactly one layer holds the settlements"), retry[3]!.content);
    assert.ok(requests[0]!.messages[1]!.content.includes(`"id": "high_fantasy"`), "no kit yet starts from the first");
  }
  // Refused twice: refused with the reasons, and nothing else is tried.
  {
    requests.length = 0;
    replies.push("Here is your kit!", JSON.stringify({ ...harbor, change: { ...harbor.change, pace: "frantic" } }));
    const response = await write(modern);
    assert.equal(response.statusCode, 422, response.body);
    assert.equal(requests.length, 2);
    assert.ok(requests[1]!.messages[3]!.content.includes("kit: The reply was not JSON"));
    assert.deepEqual(
      response.json().issues.filter((issue: string) => issue.startsWith("change.pace")).length,
      1,
      response.body,
    );
  }
  // A setting as long as a game accepts is never refused here.
  {
    requests.length = 0;
    replies.push(JSON.stringify(harbor));
    const response = await app.inject({
      method: "POST",
      url: "/api/game/world-kit",
      payload: { connectionId: connection!.id, genre: "Slice of life", setting: "a".repeat(25_000), tone: "Cozy" },
    });
    assert.equal(response.statusCode, 200, response.body.slice(0, 300));
  }
  // A start kit that is not one is refused before any model is asked.
  {
    requests.length = 0;
    const response = await write({ ...modern, layers: [] });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(requests.length, 0);
  }

  // A new game stores the kit it was created with; one without a kit carries nothing new.
  const baseConfig = {
    genre: "Slice of life",
    setting: "A harbor town",
    tone: "Cozy",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "",
    gmMode: "standalone",
    partyCharacterIds: [],
  };
  const create = (setupConfig: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/game/create", payload: { name: "Harbor", setupConfig } });
  {
    const withKit = await create({ ...baseConfig, worldKit: harbor });
    assert.equal(withKit.statusCode, 200, withKit.body);
    const meta = JSON.parse(withKit.json().sessionChat.metadata);
    assert.equal(meta.gameWorldKit.label, "Harbor town life");
    assert.deepEqual(gameWorldKitFromMetadata(meta), parseWorldKit(harbor).ok && parseWorldKit(harbor).kit);
    const withoutKit = await create(baseConfig);
    assert.equal(withoutKit.statusCode, 200, withoutKit.body);
    const metaWithout = JSON.parse(withoutKit.json().sessionChat.metadata);
    assert.ok(!("gameWorldKit" in metaWithout));

    // Every turn's Game Master prompt reads the stored kit.
    const turnPrompt = async (chatMetadata: Record<string, unknown>) => {
      const messages = [{ role: "system", content: "placeholder" }];
      await injectGameGmPromptRuntime({
        messages,
        chatId: "world-kit-regression",
        chat: {},
        chatMetadata,
        characterIds: [],
        chars: { getById: async () => null, getPersona: async () => null },
        chats: { getById: async () => null, updateMetadata: async () => undefined },
        selectedGameStateSnapshotPromise: Promise.resolve(null),
        mappedMessages: [],
        personaName: "Player",
        resolvePromptMacros: (value: string) => value,
      } as unknown as Parameters<typeof injectGameGmPromptRuntime>[0]);
      return messages.map((message) => message.content).join("\n");
    };
    assert.ok((await turnPrompt(meta)).includes("The kind of setting: Harbor town life."));
    assert.ok(!(await turnPrompt(metaWithout)).includes("<world>"));

    // World generation is asked in the kit's words (the stand-in's empty world is then refused,
    // which is not what this checks).
    const setupAsks = async (chatId: string) => {
      requests.length = 0;
      replies.length = 0;
      await app.inject({
        method: "POST",
        url: "/api/game/setup",
        payload: { chatId, connectionId: connection!.id, streaming: false },
      });
      assert.ok(requests.length > 0, "world generation reached the model");
      return requests[0]!.messages[0]!.content;
    };
    assert.ok((await setupAsks(withKit.json().sessionChat.id)).includes("The kind of setting: Harbor town life."));
    // The connection the setup ran on becomes the game's own, for the start screen and the turns after.
    assert.equal((await createChatsStorage(db).getById(withKit.json().sessionChat.id))!.connectionId, connection!.id);
    assert.ok(!(await setupAsks(withoutKit.json().sessionChat.id)).includes("<world>"));
    const broken = await create({ ...baseConfig, worldKit: { ...harbor, sizes: [] } });
    assert.equal(broken.statusCode, 400, broken.body);
  }

  // The Game Master's system prompt carries the block right after the game block, and world
  // generation designs in the kit's words; neither carries it without a kit.
  {
    const kit = parseWorldKit(harbor);
    assert.ok(kit.ok);
    const context = {
      gameActiveState: "exploration",
      storyArc: null,
      plotTwists: null,
      map: null,
      npcs: [],
      sessionSummaries: [],
      sessionNumber: 1,
      partyNames: [],
      playerName: "Player",
      gmCharacterCard: null,
      difficulty: "normal",
      genre: "Slice of life",
      setting: "A harbor town",
      tone: "Cozy",
    } as unknown as Parameters<typeof buildGmSystemPrompt>[0];
    const prompt = buildGmSystemPrompt({ ...context, worldKit: kit.kit });
    assert.ok(prompt.includes(`</game>\n${worldKitPromptText(kit.kit)}\n`), "the world block follows the game block");
    assert.ok(!buildGmSystemPrompt(context).includes("<world>"));
    const setup = buildSetupPrompt({ worldKit: kit.kit });
    assert.ok(setup.includes("Design the world in the words of the setting below"));
    assert.ok(setup.includes(worldKitPromptText(kit.kit)));
    assert.ok(!buildSetupPrompt({}).includes("<world>"));
  }
} finally {
  await app.close();
  await closeDB();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}

console.log(
  `World setting kits: ${kits.length} starter kits read as kits, every refusal holds, the Game Master reads the kit, and the model writes one.`,
);

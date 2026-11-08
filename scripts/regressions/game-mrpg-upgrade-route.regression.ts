/**
 * A stored Legacy game moved to MRPG through the real route (owner 2026-11-06: "Legacy games and character
 * sheets can be safely converted into MRPG without corrupting the save"):
 *   - Only the session the game carries on from can be upgraded; an older one is refused and left alone.
 *   - Two upgrades sent at once give one upgrade, and the other is refused.
 *   - The upgrade writes only the setup's MRPG switch, the party cards and the swapped gear: every other
 *     key of the save, every message and every other stack is as it was.
 *   - Each card keeps its Legacy sheet and everything the upgrade doesn't own.
 *   - A Legacy game nobody upgrades is untouched, and still offered the upgrade.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mrpg-upgrade-route-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [{ default: Fastify }, { gameRoutes }, { getDB, closeDB }, { createChatsStorage }, shared] = await Promise.all([
  import("../../packages/server/node_modules/fastify/fastify.js"),
  import("../../packages/server/src/routes/game.routes.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/services/storage/chats.storage.js"),
  import("../../packages/shared/src/index.js"),
]);
const { readMarinaraCardProgression, MARINARA_LEGACY_UPGRADE_LEVEL } = shared;

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });
const chats = createChatsStorage(db);

const legacyMeta = (session: number) => ({
  gameId: "g-upgrade",
  gameSessionNumber: session,
  gameSessionStatus: session === 1 ? "concluded" : "active",
  gameActiveState: "exploration",
  gameSetupConfig: { genre: "fantasy", setting: "A river delta", difficulty: "normal", partyCharacterIds: [] },
  gamePreviousSessionSummaries: session === 1 ? [] : [{ sessionNumber: 1, summary: "They crossed the delta." }],
  gameJournal: { entries: [{ id: "j1", text: "Met the ferryman." }] },
  gameWorldState: { time: "dusk", weather: "rain" },
  gameNpcs: [{ name: "Ferryman", reputation: 3 }],
  gameInventory: [
    { id: "s1", name: "Grandfather's Chain Mail", quantity: 1, holder: "Kara" },
    { id: "s2", name: "Healing Draught", quantity: 3, holder: "Kara" },
    { id: "s3", name: "Oak Staff", quantity: 1, holder: "Ossian" },
  ],
  gameCharacterCards: [
    {
      name: "Kara",
      class: "Knight",
      shortDescription: "A stern knight.",
      abilities: ["Shield Bash"],
      strengths: ["Brave"],
      temperament: "protective",
      temperamentInitial: "protective",
      rpgStats: { attributes: [{ name: "STR", value: 16 }], hp: { value: 30, max: 40 } },
      extra: { Oath: "Guard the delta" },
    },
    {
      name: "Ossian",
      class: "Wizard",
      shortDescription: "An old scholar.",
      temperament: "methodical",
      temperamentInitial: "methodical",
      rpgStats: { attributes: [{ name: "INT", value: 18 }], hp: { value: 20, max: 20 } },
    },
  ],
});

const newSession = async (name: string, groupId: string, meta: Record<string, unknown>) => {
  const chat = await chats.create({ name, mode: "game", characterIds: [], groupId });
  assert.ok(chat);
  await chats.updateMetadata(chat.id, meta);
  for (const [role, content] of [
    ["narrator", "The rain comes in off the water."],
    ["user", "I hail the ferryman."],
    ["assistant", "He poles toward you, slow."],
  ] as const) {
    await chats.createMessage({ chatId: chat.id, role, characterId: null, content });
  }
  return chat.id;
};
const read = async (chatId: string) => JSON.parse((await chats.getById(chatId))!.metadata) as Record<string, any>;
const upgrade = (chatId: string, body: Record<string, unknown> = {}) =>
  app.inject({
    method: "POST",
    url: "/api/game/marinara/upgrade-legacy",
    payload: { chatId, members: [{ name: "Kara", primary: "guard" }, { name: "Ossian" }], ...body },
  });

try {
  const older = await newSession("Delta — Session 1", "g-upgrade", legacyMeta(1));
  const latest = await newSession("Delta — Session 2", "g-upgrade", legacyMeta(2));
  const untouched = await newSession("Other — Session 1", "g-other", { ...legacyMeta(1), gameId: "g-other" });

  // An older session is refused, and left as it was.
  const olderBefore = await read(older);
  const refused = await upgrade(older);
  assert.equal(refused.statusCode, 409, refused.body);
  assert.match(refused.json().error, /latest session/);
  assert.deepEqual(await read(older), olderBefore);

  // Two at once: one upgrade, one refusal.
  const before = await read(latest);
  const messagesBefore = await chats.listMessages(latest);
  const [a, b] = await Promise.all([upgrade(latest, { gear: ["s1"] }), upgrade(latest, { gear: ["s1"] })]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409], `${a.body} / ${b.body}`);
  const ok = a.statusCode === 200 ? a.json() : b.json();
  assert.deepEqual(
    ok.upgraded.map((one: { name: string; level: number }) => [one.name, one.level]),
    [
      ["Kara", MARINARA_LEGACY_UPGRADE_LEVEL],
      ["Ossian", MARINARA_LEGACY_UPGRADE_LEVEL],
    ],
  );
  assert.equal(ok.temperamentReadFailed, undefined, "kept temperaments need no model call");

  const after = await read(latest);
  // The switch, and nothing else of the setup.
  assert.deepEqual(after.gameSetupConfig, { ...before.gameSetupConfig, marinaraClasses: true });
  // The upgrade's own record says who moved, and when.
  assert.deepEqual(
    after.gameMarinaraLegacyUpgrade.members.map((one: { name: string }) => one.name),
    ["Kara", "Ossian"],
  );
  // Every key the upgrade doesn't own is as it was.
  const owned = new Set(["gameSetupConfig", "gameCharacterCards", "gameInventory", "gameMarinaraLegacyUpgrade"]);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (owned.has(key)) continue;
    // The inventory's and the store's own bookkeeping move with any write; nothing else may.
    if (/^gameInventory/.test(key) || key === "metadataWriteOrdinals") continue;
    assert.deepEqual(after[key], before[key], `metadata key ${key} unchanged`);
  }
  // Messages untouched.
  assert.deepEqual(
    (await chats.listMessages(latest)).map((m) => [m.id, m.role, m.content]),
    messagesBefore.map((m) => [m.id, m.role, m.content]),
  );
  // The accepted mail became an MRPG piece under its old name; the draught and the declined staff didn't move.
  const stacks = after.gameInventory as Array<Record<string, any>>;
  assert.equal(stacks.length, 3);
  const mail = stacks.find((stack) => stack.id === "s1")!;
  assert.equal(mail.nickname, "Grandfather's Chain Mail");
  assert.notEqual(mail.name, "Grandfather's Chain Mail");
  assert.deepEqual(
    stacks.find((stack) => stack.id === "s2"),
    before.gameInventory.find((stack: { id: string }) => stack.id === "s2"),
  );
  assert.equal(stacks.find((stack) => stack.id === "s3")!.name, "Oak Staff");

  // Each card: an MRPG progression at the upgrade's level, its Legacy sheet and own fields kept.
  for (const card of after.gameCharacterCards as Array<Record<string, any>>) {
    const was = before.gameCharacterCards.find((one: { name: string }) => one.name === card.name);
    const progression = readMarinaraCardProgression(card.marinara);
    assert.ok(progression, `${card.name} has an MRPG progression`);
    assert.equal(progression!.level, MARINARA_LEGACY_UPGRADE_LEVEL);
    assert.deepEqual(card.rpgStats, was.rpgStats, `${card.name}'s Legacy sheet stays on the card`);
    assert.equal(card.shortDescription, was.shortDescription);
    assert.equal(card.temperamentInitial, was.temperamentInitial);
    for (const [key, value] of Object.entries(was.extra ?? {})) assert.equal(card.extra[key], value);
  }
  assert.ok(readMarinaraCardProgression(after.gameCharacterCards[0].marinara)!.equipment?.armor, "Kara wears the mail");

  // Asked again: refused, and nothing moves.
  const again = await upgrade(latest);
  assert.equal(again.statusCode, 409);
  assert.deepEqual(await read(latest), after);

  // The older session and another game stay Legacy; the other game is still offered the upgrade.
  assert.deepEqual(await read(older), olderBefore);
  const other = await read(untouched);
  assert.equal(other.gameSetupConfig.marinaraClasses, undefined);
  assert.ok(other.gameCharacterCards.every((card: Record<string, unknown>) => card.marinara === undefined));
  const preview = await app.inject({
    method: "GET",
    url: `/api/game/marinara/upgrade-legacy/preview?chatId=${encodeURIComponent(untouched)}`,
  });
  assert.equal(preview.statusCode, 200, preview.body);
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("A stored Legacy game upgrades once, from its latest session, and nothing else of the save moves.");

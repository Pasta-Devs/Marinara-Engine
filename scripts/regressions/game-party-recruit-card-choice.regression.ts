/**
 * #7324: promoting an NPC to the party must never import an unrelated library card. A card is only
 * matched by its exact name, and when the NPC and a card (or several cards) share the name, nothing
 * changes until the player picks one or keeps the game's own character.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-party-recruit-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  const characters = createCharactersStorage(db);
  const chats = createChatsStorage(db);
  const card = async (name: string, avatarPath?: string, title?: string, description?: string) => {
    const row = await characters.create({ name, description, extensions: {} } as never, avatarPath, null, title);
    assert.ok(row?.id);
    return row.id;
  };
  const emmaCard = await card("Emma", "/api/avatars/file/emma.png", "The baker's daughter");
  const samanthaCard = await card("Samantha");
  const kaelCard = await card("Kael Stormborn");
  const bramCard = await card("Bram");
  const firstLena = await card("Lena", undefined, undefined, "  A quiet\n  lighthouse keeper.  ");
  const secondLena = await card("Lena", undefined, "Pirate captain");
  const miraCard = await card("Mira");

  const created = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: {
      name: "Party recruits",
      setupConfig: {
        genre: "Fantasy",
        setting: "A quiet harbor",
        tone: "Hopeful",
        difficulty: "normal",
        rating: "sfw",
        playerGoals: "Find my lost friend",
        gmMode: "standalone",
        partyCharacterIds: [kaelCard],
      },
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const chatId = created.json().sessionChat.id as string;
  const npc = (name: string) => ({ id: `npc-${name}`, name, description: `${name}, an NPC of this game.`, notes: [] });
  await chats.patchMetadata(chatId, {
    gameNpcs: [npc("Emma"), npc("Sam"), npc("Danielle")],
    // Mira was met this session: only the journal knows her so far.
    gameJournal: {
      entries: [],
      quests: [],
      locations: [],
      npcLog: [{ npcName: "Mira", interactions: ["Encountered"] }],
      inventoryLog: [],
    },
  });

  const recruit = (payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/game/party/recruit", payload: { chatId, ...payload } });
  const party = async () => {
    const meta = JSON.parse((await chats.getById(chatId))!.metadata as string);
    return meta.gamePartyCharacterIds as string[];
  };

  // A partial name never matches: Sam is the game's NPC, not the library's Samantha.
  const sam = await recruit({ characterName: "Sam" });
  assert.equal(sam.statusCode, 200, sam.body);
  assert.equal(sam.json().added, true);
  assert.equal(sam.json().cardChoices, undefined);
  assert.ok((await party()).includes("npc:sam"));
  assert.equal((await party()).includes(samanthaCard), false, "a similarly named card is never imported");

  // Nor a similarly named NPC: Dan is not the game's Danielle.
  const dan = await recruit({ characterName: "Dan" });
  assert.equal(dan.statusCode, 200, dan.body);
  assert.ok((await party()).includes("npc:dan"));
  assert.equal((await party()).includes("npc:danielle"), false, "a similarly named NPC never joins instead");

  // An NPC the game met this session counts too: her one same-name card is asked about, not imported.
  const mira = await recruit({ characterName: "Mira" });
  assert.equal(mira.statusCode, 200, mira.body);
  assert.deepEqual(
    (mira.json().cardChoices as Array<{ id: string }>).map((choice) => choice.id),
    [miraCard],
  );
  assert.equal((await party()).includes(miraCard), false);

  // The NPC and a library card share the name: the player is asked, and nothing changes yet.
  const before = await party();
  const emma = await recruit({ characterName: "Emma" });
  assert.equal(emma.statusCode, 200, emma.body);
  assert.equal(emma.json().added, false);
  assert.deepEqual(emma.json().cardChoices, [
    {
      id: emmaCard,
      name: "Emma",
      title: "The baker's daughter",
      avatarPath: "/api/avatars/file/emma.png",
      avatarCrop: null,
      summary: null,
    },
  ]);
  assert.deepEqual(await party(), before, "asking changes nothing");

  // A choice that is not one of those cards is refused.
  const stray = await recruit({ characterName: "Emma", characterId: samanthaCard });
  assert.notEqual(stray.statusCode, 200);
  assert.deepEqual(await party(), before);

  // Keeping the game's own character (also what closing the window sends) adds the NPC, not the card.
  const keepNpc = await recruit({ characterName: "Emma", characterId: null });
  assert.equal(keepNpc.statusCode, 200, keepNpc.body);
  assert.equal(keepNpc.json().added, true);
  assert.ok((await party()).includes("npc:emma"));
  assert.equal((await party()).includes(emmaCard), false);
  // Once she is in the party, asking for her again is quiet.
  const again = await recruit({ characterName: "Emma" });
  assert.equal(again.json().cardChoices, undefined);
  assert.equal(again.json().added, false);

  // Two cards with the same name: the player picks, and gets exactly that card.
  const lena = await recruit({ characterName: "lena" });
  assert.deepEqual(
    (lena.json().cardChoices as Array<{ id: string; title: string | null }>).map((choice) => choice.id).sort(),
    [firstLena, secondLena].sort(),
  );
  // A card without a title still shows what tells it apart: its library preview text.
  const untitledLena = (
    lena.json().cardChoices as Array<{ id: string; title: string | null; summary: string | null }>
  ).find((choice) => choice.id === firstLena);
  assert.equal(untitledLena?.title, null);
  assert.equal(untitledLena?.summary, "A quiet lighthouse keeper.");
  const pickedLena = await recruit({ characterName: "lena", characterId: secondLena });
  assert.equal(pickedLena.json().added, true);
  assert.ok((await party()).includes(secondLena));
  assert.equal((await party()).includes(firstLena), false);
  // A late answer to an old window never adds a second Lena.
  const staleLena = await recruit({ characterName: "lena", characterId: null });
  assert.equal(staleLena.statusCode, 200, staleLena.body);
  assert.equal(staleLena.json().added, false);
  assert.equal((await party()).includes("npc:lena"), false);

  // One card and no NPC of that name: the card joins, as before.
  const bram = await recruit({ characterName: "Bram" });
  assert.equal(bram.json().added, true);
  assert.ok((await party()).includes(bramCard));

  // A shortened name for a party member is that member, never a new stand-in.
  const partyBeforeKael = await party();
  const kael = await recruit({ characterName: "Kael" });
  assert.equal(kael.statusCode, 200, kael.body);
  assert.equal(kael.json().added, false);
  assert.deepEqual(await party(), partyBeforeKael);

  console.info("game party recruit card choice regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}

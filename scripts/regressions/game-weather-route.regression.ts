/**
 * POST /game/weather/update reads the weather from the world where the party is (world-weather.service).
 *
 *   - A drawn world: the climate comes from the map, and a blizzard asked for at midsummer in the
 *     lowlands gets the nearest weather that fits.
 *   - A weather that was set holds for a while, then the sky takes over.
 *   - A game with no map reads the place's name: snow asked for in a desert at noon in summer is refused.
 *   - The weather follows the clock without random rerolls: two reads at the same time agree.
 */
import assert from "node:assert/strict";

import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  parseWorldKit,
  worldBriefSchema,
} from "../../packages/shared/src/index.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";

const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsed.ok);
const kit = parsed.kit;

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });
const made: string[] = [];

type Weather = {
  type: string;
  temperature: number;
  climate?: { zone: string; seasonLabel: string };
  note?: string;
  forced?: { type: string; asked: string; until: number };
};
const update = async (chatId: string, payload: Record<string, unknown>) => {
  const response = await app.inject({
    method: "POST",
    url: "/api/game/weather/update",
    payload: { chatId, ...payload },
  });
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(response.body) as { changed: boolean; weather: Weather };
};
const meta = async (chatId: string) => JSON.parse((await chats.getById(chatId))!.metadata) as Record<string, unknown>;

try {
  // ── A drawn world ──
  {
    const chat = await chats.create({ name: "Weather", mode: "game", characterIds: [] });
    made.push(chat.id);
    await chats.patchMetadata(chat.id, {
      gameWorldKit: kit,
      gameWorld: {
        seed: 5,
        generatorVersion: WORLD_GENERATOR_VERSION,
        grounding: "expand",
        brief: worldBriefSchema.parse({ briefVersion: 1, premise: "A quiet year.", places: [] }),
      },
      gameTime: { day: 135, hour: 13, minute: 0 },
    });
    const natural = await update(chat.id, { action: "explore" });
    assert.ok(natural.weather.climate, "the climate comes from the map");
    assert.equal(natural.weather.climate?.seasonLabel, "summer");
    assert.notEqual(natural.weather.type, "snow", "no snow at midsummer noon in a temperate realm");
    assert.equal((await update(chat.id, { action: "explore" })).weather.type, natural.weather.type, "no reroll");
    const blizzard = await update(chat.id, { action: "set", type: "blizzard" });
    assert.notEqual(blizzard.weather.type, "blizzard", "no midsummer blizzard in the lowlands");
    assert.equal(blizzard.weather.forced?.asked, "blizzard");
    const storm = await update(chat.id, { action: "set", type: "storm" });
    assert.equal(storm.weather.type, "storm");
    assert.equal((await update(chat.id, { action: "explore" })).weather.type, "storm", "a set weather holds a while");
    await chats.patchMetadata(chat.id, { gameTime: { day: 136, hour: 13, minute: 0 } });
    assert.equal((await update(chat.id, { action: "explore" })).weather.forced, undefined, "then the sky takes over");
  }

  // ── A game with no map ──
  {
    const chat = await chats.create({ name: "Weather, no map", mode: "game", characterIds: [] });
    made.push(chat.id);
    await chats.patchMetadata(chat.id, { gameTime: { day: 135, hour: 13, minute: 0 } });
    const snow = await update(chat.id, { action: "set", type: "snow", location: "The Desert of Bones" });
    assert.notEqual(snow.weather.type, "snow");
    assert.equal(snow.weather.climate?.zone, "hot_desert");
    const winter = await chats.patchMetadata(chat.id, { gameTime: { day: 300, hour: 8, minute: 0 } });
    assert.ok(winter);
    const mountain = await update(chat.id, { action: "set", type: "snow", location: "Mountain pass" });
    assert.equal(mountain.weather.type, "snow", "a mountain pass in winter can snow");
  }
  // ── A city the Game Master holds in endless night and rain ──
  {
    const chat = await chats.create({ name: "Weather, held", mode: "game", characterIds: [] });
    made.push(chat.id);
    await chats.patchMetadata(chat.id, { gameTime: { day: 135, hour: 13, minute: 0 } });
    await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: 'The Court\'s curse falls. [environment: place="Gotham" light="dark" weather="snow" note="the Court"]',
    });
    const held = await update(chat.id, { action: "explore", location: "Gotham, the Narrows" });
    assert.equal(held.weather.type, "snow", "held weather beats a summer noon");
    assert.equal((held.weather as { light?: string }).light, "dark");
    assert.match(
      held.weather.note ?? "",
      /Held here \(Gotham\), by the Court: the weather is always snow; it is always night/,
    );
    const asked = await update(chat.id, { action: "set", type: "clear", location: "Gotham, the Narrows" });
    assert.equal(asked.weather.type, "snow", "the scene cannot lift a hold");
    const elsewhere = await update(chat.id, { action: "explore", location: "Metropolis" });
    assert.equal((elsewhere.weather as { light?: string }).light, undefined, "outside the city the sky is its own");
    await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: 'Dawn breaks at last. [environment: place="Gotham" release]',
    });
    const released = await update(chat.id, { action: "explore", location: "Gotham, the Narrows" });
    assert.equal((released.weather as { light?: string }).light, undefined, "released");
  }
  console.log("Game weather route regression passed.");
} finally {
  for (const id of made) await chats.remove(id).catch(() => {});
  await app.close();
  await closeDB();
}

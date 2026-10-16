// A Conversation video is filed under the characters it shows: in a group chat, a clip Aster sends that
// names Bob appears in Aster's and Bob's gallery clips but not Carol's, and in the persona's gallery only when it
// names the persona. Older videos, which were never tagged, keep appearing for every character and the persona
// of their chat.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-convo-video-galleries-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createGameSceneVideosStorage } =
  await import("../../packages/server/src/services/storage/game-scene-videos.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
// What the fake prompt writer says the clip shows.
let writerReply = "Aster pulls Bob into the frame";
const provider = createServer(async (request, response) => {
  for await (const _chunk of request) void _chunk;
  const url = request.url ?? "";
  response.setHeader("content-type", "application/json");
  if (url.endsWith("/prompt")) return response.end(JSON.stringify({ prompt_id: "job" }));
  if (url.includes("/history/")) {
    return response.end(
      JSON.stringify({
        job: {
          status: { completed: true, status_str: "success" },
          outputs: { "9": { gifs: [{ filename: "clip.mp4", subfolder: "", type: "output" }] } },
        },
      }),
    );
  }
  if (url.startsWith("/view")) {
    response.setHeader("content-type", "video/mp4");
    return response.end(mp4);
  }
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: writerReply }, finish_reason: "stop" }],
      usage: { total_tokens: 20 },
    }),
  );
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });
await app.register(charactersRoutes, { prefix: "/api/characters" });

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text",
    provider: "custom",
    baseUrl: `${baseUrl}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const video = await connections.create({
    name: "ComfyUI video",
    provider: "video_generation",
    baseUrl,
    model: "fixture-video",
    videoService: "comfyui",
    videoGenerationSource: "comfyui",
    comfyuiWorkflow: JSON.stringify({ "1": { inputs: { text: "%prompt%" } } }),
    apiKey: "",
  });
  const characters = createCharactersStorage(db);
  const [aster, bob, carol, lena, turner, al] = await Promise.all(
    ["Aster", "Bob", "Carol Kowalski", "Dr. Lena Kowalski", "Will Turner", "Al Rivers"].map((name) =>
      characters.create(characterDataSchema.parse({ name })),
    ),
  );
  assert.ok(aster && bob && carol && lena && turner && al);
  const jamie = await characters.createPersona("Jamie", "The player.");
  assert.ok(jamie);

  const chats = createChatsStorage(db);
  const group = await chats.create({
    name: "Group",
    mode: "conversation",
    characterIds: [aster.id, bob.id, carol.id, lena.id, turner.id, al.id],
    connectionId: text.id,
    personaId: jamie.id,
  });
  assert.ok(group);
  await chats.patchMetadata(group.id, { sceneVideoConnectionId: video.id, sceneVideoFirstFrame: "prompt_only" });

  const sent = await app.inject({
    method: "POST",
    url: `/api/gallery/${group.id}/video`,
    payload: { characterId: aster.id },
  });
  assert.equal(sent.statusCode, 200, sent.body);
  const videoId = (sent.json() as { video: { id: string } }).video.id;

  // An older, untagged video in the same chat.
  const legacy = await createGameSceneVideosStorage(db).create({
    chatId: group.id,
    filePath: `${group.id}/legacy.mp4`,
    prompt: "Old clip",
    provider: "comfyui",
    model: "m",
    durationSeconds: 5,
    aspectRatio: "16:9",
  });
  assert.ok(legacy);

  const clipIds = async (characterId: string) => {
    const response = await app.inject({ method: "GET", url: `/api/characters/${characterId}/gallery/clips` });
    assert.equal(response.statusCode, 200, response.body);
    return (response.json() as { clips: Array<{ id: string }> }).clips.map((clip) => clip.id);
  };
  const asterClips = await clipIds(aster.id);
  const bobClips = await clipIds(bob.id);
  const carolClips = await clipIds(carol.id);
  assert.ok(asterClips.includes(`scene:${videoId}`), "the sender keeps the clip");
  assert.ok(bobClips.includes(`scene:${videoId}`), "a named character gets the clip");
  assert.ok(!carolClips.includes(`scene:${videoId}`), "an unnamed character does not");
  for (const clips of [asterClips, bobClips, carolClips]) {
    assert.ok(clips.includes(`scene:${legacy.id}`), "an untagged video still belongs to everyone in the chat");
  }

  // The persona's gallery lists a Conversation clip only when the clip shows the persona.
  writerReply = "Aster films Jamie dancing badly in the kitchen";
  const withPersona = await app.inject({
    method: "POST",
    url: `/api/gallery/${group.id}/video`,
    payload: { characterId: aster.id },
  });
  assert.equal(withPersona.statusCode, 200, withPersona.body);
  const personaVideoId = (withPersona.json() as { video: { id: string } }).video.id;
  const personaResponse = await app.inject({
    method: "GET",
    url: `/api/characters/personas/${jamie.id}/gallery/clips`,
  });
  assert.equal(personaResponse.statusCode, 200, personaResponse.body);
  const personaClips = (personaResponse.json() as { clips: Array<{ id: string }> }).clips.map((clip) => clip.id);
  assert.ok(
    !personaClips.includes(`scene:${videoId}`),
    "a clip that doesn't show the persona stays out of its gallery",
  );
  assert.ok(personaClips.includes(`scene:${personaVideoId}`), "a clip that names the persona is in its gallery");
  assert.ok(personaClips.includes(`scene:${legacy.id}`), "an untagged video still belongs to the persona's chat");
  assert.ok(!(await clipIds(bob.id)).includes(`scene:${personaVideoId}`), "naming the persona doesn't add Bob");

  // Prompts call people by first name: a name part no one else in the chat shares counts ("Lena" for
  // "Dr. Lena Kowalski"), while a shared one ("Kowalski", also Carol's) names no one.
  const sendClip = async (reply: string) => {
    writerReply = reply;
    const response = await app.inject({
      method: "POST",
      url: `/api/gallery/${group.id}/video`,
      payload: { characterId: aster.id },
    });
    assert.equal(response.statusCode, 200, response.body);
    return `scene:${(response.json() as { video: { id: string } }).video.id}`;
  };
  const lenaClip = await sendClip("Aster dances while Lena waves a glow stick");
  assert.ok((await clipIds(lena.id)).includes(lenaClip), "a unique first name counts");
  assert.ok(!(await clipIds(carol.id)).includes(lenaClip));
  const surnameClip = await sendClip("Aster dances while Kowalski watches");
  assert.ok(!(await clipIds(lena.id)).includes(surnameClip), "a shared surname names no one");
  assert.ok(!(await clipIds(carol.id)).includes(surnameClip));

  // Possessives name their owner; lowercase everyday words and spoken lines name no one.
  const possessiveClip = await sendClip("Aster dances with Lena's arm around her");
  assert.ok((await clipIds(lena.id)).includes(possessiveClip), "a possessive names its owner");
  const speechClip = await sendClip('Aster waves and says "Hey Jamie, Bob says hi!"');
  assert.ok(!(await clipIds(bob.id)).includes(speechClip), "a name inside quoted speech names no one");
  assert.ok(
    !(await app.inject({ method: "GET", url: `/api/characters/personas/${jamie.id}/gallery/clips` }))
      .json<{ clips: Array<{ id: string }> }>()
      .clips.some((clip) => clip.id === speechClip),
    "nor the persona",
  );
  const lowercaseClip = await sendClip("Aster smiles, her will to dance clear");
  assert.ok(!(await clipIds(turner.id)).includes(lowercaseClip), "a lowercase word is not a name");
  const capitalClip = await sendClip("Aster laughs as Will joins in");
  assert.ok((await clipIds(turner.id)).includes(capitalClip), "a capitalised name part is");
  const singleQuoted = await sendClip("Aster grins and says 'I'm here, Bob!' while Lena's hat falls");
  assert.ok(!(await clipIds(bob.id)).includes(singleQuoted), "a name inside single-quoted speech names no one");
  assert.ok((await clipIds(lena.id)).includes(singleQuoted), "a possessive is not a quote");
  const wrapped = await sendClip('Aster says "Hi,\nBob!" and waves');
  assert.ok(!(await clipIds(bob.id)).includes(wrapped), "a quote that wraps onto the next line is still speech");
  const strayQuote = await sendClip('Aster is 5\'10" tall.\n\nBob walks in');
  assert.ok((await clipIds(bob.id)).includes(strayQuote), "a stray quote mark doesn't hide the next paragraph");
  const twoLetter = await sendClip("Aster and Al share a milkshake");
  assert.ok((await clipIds(al.id)).includes(twoLetter), "a two-letter first name counts");
  const bobLowercase = await sendClip("Aster smiles, a bob of hair swaying");
  assert.ok(!(await clipIds(bob.id)).includes(bobLowercase), "a one-word name in lowercase is not a name either");

  // A persona with a two-part name is found by its first name, by id, without borrowing a character's name.
  const alex = await characters.createPersona("Alex Smith", "Another player.");
  assert.ok(alex);
  const duo = await chats.create({
    name: "Duo",
    mode: "conversation",
    characterIds: [aster.id],
    connectionId: text.id,
    personaId: alex.id,
  });
  assert.ok(duo);
  await chats.patchMetadata(duo.id, { sceneVideoConnectionId: video.id, sceneVideoFirstFrame: "prompt_only" });
  writerReply = "Aster hugs Alex";
  const duoSent = await app.inject({
    method: "POST",
    url: `/api/gallery/${duo.id}/video`,
    payload: { characterId: aster.id },
  });
  assert.equal(duoSent.statusCode, 200, duoSent.body);
  const duoVideoId = (duoSent.json() as { video: { id: string } }).video.id;
  const alexClips = await app.inject({ method: "GET", url: `/api/characters/personas/${alex.id}/gallery/clips` });
  assert.ok(
    alexClips.json<{ clips: Array<{ id: string }> }>().clips.some((clip) => clip.id === `scene:${duoVideoId}`),
    "a persona's first name files the clip under it",
  );
  console.log("convo-video-character-galleries regression passed");
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}

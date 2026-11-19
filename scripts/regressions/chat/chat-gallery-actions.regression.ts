// The chat gallery's actions: scene videos delete through the chat-scoped route, and batch select, download and
// delete, with a guard against a second batch while one runs, and Conversation's custom image-agent illustrate. Reads
// component source until a test can drive these.
// The scene-video delete route itself runs for real at the end.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const chatGallerySource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatGallery.tsx", import.meta.url),
  "utf8",
);
const galleryHooksSource = readFileSync(
  new URL("../../../packages/client/src/hooks/use-gallery.ts", import.meta.url),
  "utf8",
);
assert.match(galleryHooksSource, /api\.delete\(`\/gallery\/scene-videos\/\$\{chatId\}\/\$\{videoId\}`\)/u);
assert.match(chatGallerySource, /handleDeleteVideo\(video\)/u);
assert.match(chatGallerySource, /ui\.chat\.chatgallery\.deleteSceneVideo/u);
assert.match(chatGallerySource, /const \[selectingImages, setSelectingImages\] = useState\(false\)/u);
assert.match(chatGallerySource, /const selectableImageIds = useMemo/u);
assert.match(chatGallerySource, /handleBatchDownload/u);
assert.match(chatGallerySource, /handleBatchDelete/u);
assert.match(chatGallerySource, /ui\.gallery\.batch\.deletePartial/u);
assert.match(chatGallerySource, /batchOperationPendingRef\.current/u);
assert.equal(
  chatGallerySource.match(/disabled=\{selectedImages\.length === 0 \|\| batchOperationPending\}/gu)?.length,
  2,
  "both chat Gallery batch actions remain disabled while an operation is pending",
);
assert.match(chatGallerySource, /ui\.gallery\.batch\.toggleImageNamed/u);
assert.match(chatGallerySource, /asset\.id\.startsWith\("chat-gallery:"\)[\s\S]{0,120}: asset\.id/u);
assert.doesNotMatch(chatGallerySource, /bg-red-500/u);
assert.match(chatGallerySource, /ui\.chat\.chatgallery\.deleteGalleryImage[\s\S]{0,180}mari-chrome-accent-surface/u);
assert.match(
  chatGallerySource,
  /handleDeleteVideo\(video\)[\s\S]{0,240}ui\.chat\.chatgallery\.deleteSceneVideo[\s\S]{0,240}mari-chrome-accent-surface/u,
);
assert.match(
  chatGallerySource,
  /onClick=\{\(\) => handleDelete\(confirmDeleteId\)\}[\s\S]{0,180}mari-chrome-accent-surface/u,
);

// The scene-video delete route, on the runner's throwaway data folder: a video is deleted only through its own
// chat (#5611), and deleting it removes both its row and its file.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const dataDir = process.env.DATA_DIR!;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");
const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../../packages/server/src/routes/gallery.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createGameSceneVideosStorage } =
  await import("../../../packages/server/src/services/storage/game-scene-videos.storage.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });
try {
  const chats = createChatsStorage(db);
  const owner = (await chats.create({ name: "Owner", mode: "game", characterIds: [] } as never))!;
  const other = (await chats.create({ name: "Other", mode: "game", characterIds: [] } as never))!;
  const sceneVideos = createGameSceneVideosStorage(db);
  const video = (await sceneVideos.create({
    chatId: owner.id,
    filePath: `${owner.id}/scene.mp4`,
    prompt: "A scene.",
    provider: "fixture",
    model: "fixture",
    durationSeconds: 4,
    aspectRatio: "16:9",
  }))!;
  const file = join(dataDir, "game-scene-videos", owner.id, "scene.mp4");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "video");

  const throughOther = await app.inject({ method: "DELETE", url: `/api/gallery/scene-videos/${other.id}/${video.id}` });
  assert.equal(throughOther.statusCode, 404, throughOther.body);
  assert.ok(await sceneVideos.getById(video.id), "another chat cannot delete the video");
  assert.ok(existsSync(file), "nor its file");

  const deleted = await app.inject({ method: "DELETE", url: `/api/gallery/scene-videos/${owner.id}/${video.id}` });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(await sceneVideos.getById(video.id), null, "the row is gone");
  assert.equal(existsSync(file), false, "the file is gone");
} finally {
  await app.close();
  await closeDB();
}

// #4940-#4942: Conversation's Gallery can ask a custom image agent to illustrate, through the actions the drawer reads.
{
  const chatAreaSource = readFileSync(
    new URL("../../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
    "utf8",
  );
  const conversationSurfaceSource = readFileSync(
    new URL("../../../packages/client/src/components/chat/ChatConversationSurface.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    chatAreaSource,
    /const handleIllustrateWithAgent = useCallback\([\s\S]*?forceImageGeneration: true/u,
    "Illustrate with an agent must force the image",
  );
  // Look inside the Conversation surface's element only: the Roleplay surface below it takes the same prop.
  const conversationSurfaceStart = chatAreaSource.indexOf("<ChatConversationSurface");
  const roleplaySurfaceStart = chatAreaSource.indexOf("<ChatRoleplaySurface", conversationSurfaceStart);
  assert.ok(
    conversationSurfaceStart >= 0 && roleplaySurfaceStart > conversationSurfaceStart,
    "ChatArea must render the Conversation surface before the Roleplay surface",
  );
  assert.match(
    chatAreaSource.slice(conversationSurfaceStart, roleplaySurfaceStart),
    /onIllustrateWithAgent=\{handleIllustrateWithAgent\}/u,
    "Conversation Gallery must forward custom image-agent illustration requests",
  );
  // The Gallery drawer in Chat Settings reads the actions the conversation surface provides, so the action must be in
  // the actions it hands over, not only in its props. End at the object's close, before the dependency list.
  const galleryActionsStart = conversationSurfaceSource.indexOf("const galleryActions = useMemo(");
  const galleryActionsEnd = conversationSurfaceSource.indexOf("\n    }),\n", galleryActionsStart);
  assert.ok(
    galleryActionsStart >= 0 && galleryActionsEnd > galleryActionsStart,
    "Conversation's Gallery actions object must be found",
  );
  assert.match(
    conversationSurfaceSource.slice(galleryActionsStart, galleryActionsEnd),
    /\(\) => \(\{[\s\S]*?\bonIllustrateWithAgent,/u,
    "Conversation's Gallery actions must include illustrate with an agent",
  );
}
console.info("Chat gallery actions and the scene-video delete route passed.");

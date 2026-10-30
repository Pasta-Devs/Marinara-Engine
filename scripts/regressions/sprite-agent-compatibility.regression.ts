import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const root = mkdtempSync(join(tmpdir(), "marinara-sprite-agents-"));
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "files");
try {
  const { writeSpriteCatalog, listSpriteCatalog, readSpriteCatalog } =
    await import("../../packages/server/src/services/sprites/sprite-catalog.js");
  const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
  const { listAvatarSourceSprites, readAvatarSourceSprite } =
    await import("../../packages/server/src/services/avatars/generation/generation-context.js");
  const { spriteBuiltPngtuber, savePngtuberVariants } =
    await import("../../packages/server/src/services/avatars/generation/pngtuber-variants.js");
  const { buildPngtuberLayersFromSprites } =
    await import("../../packages/client/src/features/avatars/renderers/pngtuber/pngtuber-layers.js");
  const { resolveAvatarImage } = await import("../../packages/client/src/features/avatars/stage/avatar-stage-logic.js");
  const { readAvatarConfig } = await import("../../packages/server/src/services/avatars/storage.js");
  const { listPartySprites } = await import("../../packages/server/src/services/game/sprite.service.js");
  const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
  const { resolveSpriteExpression } = await import("../../packages/client/src/lib/sprite-expression-match.js");
  const owner = { ownerType: "character" as const, ownerId: "sprite-agent-compatibility" };
  const directory = join(root, "sprites", owner.ownerId);
  mkdirSync(directory, { recursive: true });
  const sharp = await getSharp();
  const image = await sharp({
    create: { width: 32, height: 48, channels: 4, background: { r: 90, g: 120, b: 140, alpha: 1 } },
  })
    .png()
    .toBuffer();
  for (const handle of ["neutral", "neutral_talk", "sad", "full_neutral"])
    writeFileSync(join(directory, `${handle}.png`), image);
  const before = listSpriteCatalog(owner.ownerId).sprites;
  assert.deepEqual(
    spriteBuiltPngtuber(listAvatarSourceSprites(owner.ownerId, { all: true })),
    buildPngtuberLayersFromSprites(before),
  );
  const folder = randomUUID();
  const fullFolder = randomUUID();
  await writeSpriteCatalog(owner.ownerId, {
    version: 1,
    defaultFolderId: folder,
    folders: [
      { id: folder, name: "Faces", category: "expressions", description: "" },
      { id: fullFolder, name: "Poses", category: "full-body", description: "" },
    ],
    sprites: {
      neutral: { id: "base", label: "happy", folderId: folder },
      neutral_talk: { id: "talk", label: "happy_talk", folderId: folder },
      full_neutral: { id: "body", label: "full_delighted", folderId: fullFolder },
    },
  });
  const catalog = listSpriteCatalog(owner.ownerId);
  const aliases = new Map(catalog.sprites.map((sprite) => [sprite.expression, sprite.label]));
  const server = spriteBuiltPngtuber(listAvatarSourceSprites(owner.ownerId, { all: true }), aliases)!;
  const client = buildPngtuberLayersFromSprites(catalog.sprites)!;
  assert.deepEqual(server, client, "server and client build the same renamed portrait and talk layers");
  assert.equal(server.layers.happy?.mouthOpen?.source, "sprite");
  assert(!server.layers.delighted, "full-body stays outside the portrait family");
  assert.equal(
    resolveAvatarImage(owner, { updatedAt: "" }, catalog.sprites, server.layers.happy!.base),
    catalog.sprites.find((sprite) => sprite.expression === "neutral")!.url,
  );
  assert.equal(
    resolveAvatarImage(owner, { updatedAt: "" }, catalog.sprites, { source: "sprite", label: "neutral" }),
    catalog.sprites.find((sprite) => sprite.expression === "neutral")!.url,
    "an older saved sprite reference still resolves after rename",
  );
  const saved = await savePngtuberVariants({
    owner,
    images: [
      {
        label: "neutral",
        variant: "mouth-open",
        image: `data:image/png;base64,${image.toString("base64")}`,
        sourceHash: createHash("sha256").update(image).digest("hex"),
      },
    ],
  });
  assert(
    saved.config.kinds.pngtuber?.layers.happy?.mouthOpen,
    "real save uses the current expression as its layer key",
  );
  assert(!saved.config.kinds.pngtuber?.layers.neutral, "real save doesn't reintroduce the filename as an expression");
  assert(saved.config.kinds.pngtuber?.layers.sad, "loose sprites remain in the saved setup");
  const metadata = readSpriteCatalog(owner.ownerId);
  await writeSpriteCatalog(owner.ownerId, {
    ...metadata,
    sprites: { ...metadata.sprites, sad: { id: "other", label: "happy", folderId: null } },
  });
  await assert.rejects(
    savePngtuberVariants({
      owner,
      images: ["neutral", "sad"].map((label) => ({
        label,
        variant: "eyes-closed",
        image: `data:image/png;base64,${image.toString("base64")}`,
        sourceHash: createHash("sha256").update(image).digest("hex"),
      })),
    }),
    /Keep pictures from one sprite per expression/u,
  );
  assert.deepEqual(
    await readAvatarConfig(owner),
    saved.config,
    "a duplicate-label conflict cannot overwrite the saved setup",
  );
  await writeSpriteCatalog(owner.ownerId, metadata);
  assert.equal(
    (await readAvatarSourceSprite(owner.ownerId, "neutral")).hash,
    createHash("sha256").update(image).digest("hex"),
    "generation continues reading the stable source file",
  );
  const reminder = buildGmFormatReminder({
    characterSprites: listPartySprites([{ id: owner.ownerId, name: "Owner" }]),
  });
  assert.match(reminder, /Owner \(expressions\):[^\n]*happy \(sprite: neutral\)/);
  assert.match(reminder, /Owner \(full-body\): delighted \(sprite: neutral\)/);
  assert.match(reminder, /put NAME in the expression bracket/);
  assert.equal(
    resolveSpriteExpression(
      catalog.sprites.filter((sprite) => !sprite.expression.startsWith("full_")),
      "neutral",
    )?.label,
    "happy",
    "the GM's returned stable name selects its intended renamed picture",
  );
  const legacyReminder = buildGmFormatReminder({
    characterSprites: [
      { name: "Legacy", expressions: ["neutral"], expressionChoices: ["neutral"], fullBody: [], automaticFullBody: [] },
    ],
  });
  assert.match(legacyReminder, /Legacy \(expressions\): neutral/);
  assert(
    !legacyReminder.includes("For a renamed entry"),
    "unchanged libraries retain the existing prompt instructions",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

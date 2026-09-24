// server-hunt batch 13:
// 1. AVIF emojis/stickers were exported but always skipped on import, because
//    readImageDimensionsFromBuffer had no AVIF (ISO-BMFF ispe) parser.
// 2. A null entry in an emoji/sticker import bundle threw a TypeError (500)
//    after earlier entries had already been imported.
// 3. Renaming a custom tool left agents' enabledTools pointing at the old name.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length + 8, 0);
  header.write(type, 4, "ascii");
  return Buffer.concat([header, body]);
}

function ispe(width: number, height: number): Buffer {
  const data = Buffer.alloc(12);
  data.writeUInt32BE(width, 4);
  data.writeUInt32BE(height, 8);
  return box("ispe", data);
}

// Minimal AVIF container: ftyp + meta(full box) > iprp > ipco > ispe. A grid
// image carries a per-tile ispe plus a canvas ispe, so include both.
function makeAvif(width: number, height: number): Buffer {
  const ftyp = box("ftyp", Buffer.from("avif", "ascii"), Buffer.alloc(4), Buffer.from("avifmif1miaf", "ascii"));
  const meta = box("meta", Buffer.alloc(4), box("iprp", box("ipco", ispe(8, 8), ispe(width, height))));
  // Trailing mdat whose payload happens to contain "ispe" bytes that must not be parsed.
  const mdat = box("mdat", Buffer.from("xxxxispeÿÿÿÿÿÿÿÿÿÿÿÿ", "latin1"));
  return Buffer.concat([ftyp, meta, mdat]);
}

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const storageRoot = await mkdtemp(join(tmpdir(), "marinara-server-hunt-b13-"));
const saved = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR, LOG_LEVEL: process.env.LOG_LEVEL };
process.env.DATA_DIR = storageRoot;
process.env.FILE_STORAGE_DIR = join(storageRoot, "storage");
process.env.LOG_LEVEL = "silent";

try {
  const { readImageDimensionsFromBuffer } = await import("../../packages/server/src/utils/image-metadata.js");
  assert.deepEqual(readImageDimensionsFromBuffer(makeAvif(48, 32)), { width: 48, height: 32 }, "AVIF ispe is read");
  assert.deepEqual(readImageDimensionsFromBuffer(PNG_1x1), { width: 1, height: 1 }, "PNG still parses");
  assert.equal(
    readImageDimensionsFromBuffer(Buffer.concat([box("ftyp", Buffer.from("isom", "ascii"), Buffer.alloc(4))])),
    null,
    "non-AVIF ISO-BMFF is not treated as an image",
  );

  const [{ getDB, closeDB }, { agentConfigs }, { createCustomToolsStorage }, { customEmojisRoutes }, { customStickersRoutes }] =
    await Promise.all([
      import("../../packages/server/src/db/connection.js"),
      import("../../packages/server/src/db/schema/index.js"),
      import("../../packages/server/src/services/storage/custom-tools.storage.js"),
      import("../../packages/server/src/routes/custom-emojis.routes.js"),
      import("../../packages/server/src/routes/custom-stickers.routes.js"),
    ]);
  const db = await getDB();
  const app = Fastify({ bodyLimit: 10 * 1024 * 1024 });
  app.decorate("db", db);
  try {
    await app.register(customEmojisRoutes, { prefix: "/api/custom-emojis" });
    await app.register(customStickersRoutes, { prefix: "/api/custom-stickers" });
    await app.ready();

    const avifUrl = `data:image/avif;base64,${makeAvif(48, 32).toString("base64")}`;
    const pngUrl = `data:image/png;base64,${PNG_1x1.toString("base64")}`;
    for (const [kind, key] of [
      ["custom-emojis", "emojis"],
      ["custom-stickers", "stickers"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: `/api/${kind}/import`,
        payload: { [key]: [{ name: "first_png", dataUrl: pngUrl }, null, { name: "an_avif", dataUrl: avifUrl }] },
      });
      assert.equal(res.statusCode, 200, `${kind} import with a null entry must not 500: ${res.body}`);
      assert.deepEqual(
        { imported: res.json().imported, skipped: res.json().skipped },
        { imported: 2, skipped: 1 },
        `${kind} import keeps the PNG and the AVIF and skips only the null entry`,
      );
      const list = (await app.inject({ method: "GET", url: `/api/${kind}/` })).json() as Array<{
        name: string;
        width: number | null;
        height: number | null;
      }>;
      const avif = list.find((row) => row.name === "an_avif");
      assert.ok(avif, `${kind} AVIF entry was imported`);
      assert.equal(avif.width, 48);
      assert.equal(avif.height, 32);
    }

    // Custom tool rename carries into agent enabledTools.
    const tools = createCustomToolsStorage(db);
    const tool = await tools.create({ name: "lookup_price", description: "", parametersSchema: {}, executionType: "static", staticResult: "1" });
    assert.ok(tool);
    const stamp = new Date(0).toISOString();
    await db.insert(agentConfigs).values([
      {
        id: "agent-a",
        type: "custom",
        name: "A",
        phase: "parallel",
        settings: JSON.stringify({ enabledTools: ["lookup_price", "other_tool"], keep: 1 }),
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "agent-b",
        type: "custom",
        name: "B",
        phase: "parallel",
        settings: JSON.stringify({ enabledTools: ["other_tool"] }),
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]);
    const renamed = await tools.update(tool.id, { name: "price_lookup" });
    assert.equal(renamed?.name, "price_lookup");
    const rows = await db.select().from(agentConfigs);
    const a = rows.find((row) => row.id === "agent-a")!;
    const b = rows.find((row) => row.id === "agent-b")!;
    assert.deepEqual(JSON.parse(a.settings), { enabledTools: ["price_lookup", "other_tool"], keep: 1 });
    assert.notEqual(a.updatedAt, stamp, "renamed agent row is touched");
    assert.deepEqual(JSON.parse(b.settings), { enabledTools: ["other_tool"] });
    assert.equal(b.updatedAt, stamp, "unrelated agent row is untouched");

    // Non-rename updates leave agents alone.
    await tools.update(tool.id, { description: "changed", name: "price_lookup" });
    const after = (await db.select().from(agentConfigs)).find((row) => row.id === "agent-a")!;
    assert.deepEqual(JSON.parse(after.settings).enabledTools, ["price_lookup", "other_tool"]);
  } finally {
    await app.close();
    await closeDB();
  }
  console.log("server-hunt-b13 regression passed");
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(storageRoot, { recursive: true, force: true });
}

// Character import uploads are bounded by their shape, through the real import routes:
// - a single card upload takes a handful of short option fields;
// - a .marinara package takes one option field, and may be larger than other uploads, with a data.json or avatar
//   of any size;
// - inspecting or importing several cards takes at most 128 files, a few option fields and 256 MiB in all.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const dataDir = process.env.DATA_DIR!;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { default: multipart } = await import("../../../packages/server/node_modules/@fastify/multipart/index.js");
const { default: AdmZip } = await import("../../../packages/server/node_modules/adm-zip/adm-zip.js");
const { characterDataSchema } = await import("../../../packages/shared/src/index.ts");
const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
const { errorHandler } = await import("../../../packages/server/src/middleware/error-handler.js");
const { importRoutes } = await import("../../../packages/server/src/routes/import.routes.js");
const { IMPORT_BODY_LIMIT_BYTES } =
  await import("../../../packages/server/src/services/import/st-character.importer.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
// The same app-wide multipart limit as app.ts.
await app.register(multipart, { limits: { fileSize: 256 * 1024 * 1024 } });
await app.register(importRoutes, { prefix: "/api/import" });
const characters = createCharactersStorage(db);

const boundary = "marinara-import-limits";
type Part = { name: string; filename?: string; data: Buffer | string };
const head = (part: Part) =>
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"` +
      (part.filename ? `; filename="${part.filename}"\r\nContent-Type: application/octet-stream` : "") +
      "\r\n\r\n",
  );
const form = (parts: Part[]) =>
  Buffer.concat([
    ...parts.flatMap((part) => [head(part), Buffer.from(part.data), Buffer.from("\r\n")]),
    Buffer.from(`--${boundary}--\r\n`),
  ]);
// A multipart body whose files are mostly filler, sent in pieces so the test never holds it whole.
const streamedForm = (files: Array<{ filename: string; start: string; filler: number; fill: number }>) =>
  Readable.from(
    (async function* () {
      for (const file of files) {
        yield head({ name: file.filename.endsWith(".json") ? "file" : "files", ...file, data: "" });
        yield Buffer.from(file.start);
        const piece = Buffer.alloc(1024 * 1024, file.fill);
        for (let left = file.filler; left > 0; left -= piece.length)
          yield piece.subarray(0, Math.min(left, piece.length));
        yield Buffer.from("\r\n");
      }
      yield Buffer.from(`--${boundary}--\r\n`);
    })(),
  );
const post = (url: string, payload: Buffer | Readable) =>
  app.inject({
    method: "POST",
    url,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  });
const card = (name: string) =>
  JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name, description: "Upload limits." } });
const cardFiles = (count: number): Part[] =>
  Array.from({ length: count }, (_, index) => ({
    name: "files",
    filename: `card-${index}.json`,
    data: card(`${index}`),
  }));
const fields = (count: number): Part[] =>
  Array.from({ length: count }, (_, index) => ({ name: `option${index}`, data: "x" }));
const nativeEnvelope = (data: Record<string, unknown>) =>
  JSON.stringify({ type: "marinara_character", version: 1, data: { data: characterDataSchema.parse(data) } });
const refused = { error: "The request body is larger than this endpoint accepts." };

try {
  // A single card upload takes up to 8 option fields.
  const single = (parts: Part[]) => post("/api/import/st-character", form(parts));
  const singleCard = (name: string): Part => ({ name: "file", filename: `${name}.json`, data: card(name) });
  const eightFields = await single([...fields(8), singleCard("Eight")]);
  assert.equal(eightFields.statusCode, 200, eightFields.body);
  assert.equal(eightFields.json().success, true, eightFields.body);
  const nineFields = await single([...fields(9), singleCard("Nine")]);
  assert.equal(nineFields.statusCode, 413, nineFields.body);
  assert.deepEqual(nineFields.json(), refused);

  // Its option fields are cut off past 64 KiB, so a padded timestamp field no longer reads as timestamps.
  const createdAt = async (timestamps: string) => {
    const response = await single([{ name: "timestampOverrides", data: timestamps }, singleCard("Dated")]);
    assert.equal(response.statusCode, 200, response.body);
    return (await characters.getById(response.json().characterId))!.createdAt;
  };
  const dated = new Date(1700000000000).toISOString();
  assert.equal(await createdAt('{"createdAt":1700000000000,"updatedAt":1700000000000}'), dated);
  assert.notEqual(
    await createdAt(`{"createdAt":1700000000000,${" ".repeat(64 * 1024)}"updatedAt":1700000000000}`),
    dated,
    "a field over 64 KiB is cut off",
  );

  // A .marinara package takes one option field.
  const nativeFile = (name: string): Part => ({
    name: "file",
    filename: `${name}.marinara.json`,
    data: nativeEnvelope({ name }),
  });
  const oneField = await post("/api/import/marinara-package", form([...fields(1), nativeFile("One")]));
  assert.equal(oneField.statusCode, 200, oneField.body);
  assert.equal(oneField.json().success, true, oneField.body);
  const twoFields = await post("/api/import/marinara-package", form([...fields(2), nativeFile("Two")]));
  assert.equal(twoFields.statusCode, 413, twoFields.body);
  assert.deepEqual(twoFields.json(), refused);

  // A .marinara package's data.json and avatar have no size limit of their own.
  const avatar = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(21 * 1024 * 1024, 7),
  ]);
  const zip = new AdmZip();
  zip.addFile("data.json", Buffer.from(nativeEnvelope({ name: "Large", description: "x".repeat(6 * 1024 * 1024) })));
  zip.addFile("avatar.png", avatar);
  const zipped = await post(
    "/api/import/marinara-package",
    form([{ name: "file", filename: "Large.marinara", data: zip.toBuffer() }]),
  );
  assert.equal(zipped.statusCode, 200, zipped.body);
  assert.equal(zipped.json().success, true, zipped.body);
  const large = (await characters.getById(zipped.json().id))!;
  assert.equal(JSON.parse(large.data).description.length, 6 * 1024 * 1024, "a data.json over 5 MiB imports");
  assert.deepEqual(
    readFileSync(join(dataDir, "avatars", large.avatarPath!.split("/").at(-1)!)),
    avatar,
    "an avatar over 20 MiB imports",
  );

  // A .marinara package may be larger than the 256 MiB other uploads are held to.
  const overUploadLimit = await post(
    "/api/import/marinara-package",
    streamedForm([
      {
        filename: "Huge.marinara.json",
        start: nativeEnvelope({ name: "Huge" }),
        filler: 257 * 1024 * 1024,
        fill: 0x20,
      },
    ]),
  );
  assert.equal(overUploadLimit.statusCode, 200, overUploadLimit.body);
  assert.equal(overUploadLimit.json().success, true, overUploadLimit.body);

  // Inspecting or importing several cards takes up to 128 files and 8 option fields, and 256 MiB in all.
  for (const url of ["/api/import/st-character/inspect", "/api/import/st-character/batch"]) {
    const most = await post(url, form([...fields(8), ...cardFiles(128)]));
    assert.equal(most.statusCode, 200, most.body);
    assert.equal(most.json().results.length, 128, `${url} takes 128 files`);
    assert.ok(
      most.json().results.every((result: { success: boolean }) => result.success),
      most.body,
    );
    for (const parts of [cardFiles(129), [...fields(9), ...cardFiles(128)]]) {
      const tooMany = await post(url, form(parts));
      assert.equal(tooMany.statusCode, 413, `${url}, ${parts.length} parts: ${tooMany.body}`);
      assert.deepEqual(tooMany.json(), refused);
    }
    const half = IMPORT_BODY_LIMIT_BYTES / 2 + 1024 * 1024;
    const overTotal = await post(
      url,
      streamedForm([0, 1].map((index) => ({ filename: `big-${index}.png`, start: "", filler: half, fill: 0 }))),
    );
    assert.equal(overTotal.statusCode, 413, `${url}: ${overTotal.body}`);
    assert.deepEqual(overTotal.json(), {
      success: false,
      error: "Import exceeds the total upload limit",
      results: [],
    });
  }
  console.info("Character import uploads keep their field, file, part and size limits.");
} finally {
  await app.close();
  await closeDB();
}

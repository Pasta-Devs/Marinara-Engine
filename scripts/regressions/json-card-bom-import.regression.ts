// Windows editors can save a JSON card with a UTF-8 byte order mark. The browser reads past it, so the
// server must too: such a card is inspected and imported like any other.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../packages/server/node_modules/@fastify/multipart/index.js";
import { closeDB, getDB } from "../../packages/server/src/db/connection.js";
import { errorHandler } from "../../packages/server/src/middleware/error-handler.js";
import { importRoutes } from "../../packages/server/src/routes/import.routes.js";

const AdmZip = createRequire(new URL("../../packages/server/package.json", import.meta.url))("adm-zip");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(multipart);
await app.register(importRoutes, { prefix: "/api/import" });

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const withBom = (value: unknown) => Buffer.concat([BOM, Buffer.from(JSON.stringify(value))]);
const upload = async (url: string, filename: string, bytes: Buffer) => {
  const boundary = "marinara-json-card-bom";
  const response = await app.inject({
    method: "POST",
    url,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json().results[0] as { success: boolean; name?: string; error?: string };
};

try {
  const card = withBom({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "Notepad card" } });
  const preview = await upload("/api/import/st-character/inspect", "notepad.json", card);
  assert.deepEqual([preview.success, preview.name], [true, "Notepad card"], preview.error);
  const imported = await upload("/api/import/st-character/batch", "notepad.json", card);
  assert.equal(imported.success, true, imported.error);

  const zip = new AdmZip();
  zip.addFile("card.json", withBom({ spec: "chara_card_v3", spec_version: "3.0", data: { name: "Zipped card" } }));
  const charx = await upload("/api/import/st-character/inspect", "zipped.charx", zip.toBuffer());
  assert.deepEqual([charx.success, charx.name], [true, "Zipped card"], charx.error);
} finally {
  await app.close();
  await closeDB();
}

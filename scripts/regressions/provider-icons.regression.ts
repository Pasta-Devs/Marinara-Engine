// Provider icons, decision 34b: a site's icon is fetched once and cached in DATA_DIR; a failure is cached too and not
// retried until "Refresh icon" (force); the setting turns every fetch off; only image bytes from the site's own host
// are kept (a redirect to another host, a non-image type and an oversized body all fail).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-provider-icons-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const icons = await import("../../packages/server/src/services/connections/provider-icons.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { providerIconSite } = await import("../../packages/shared/src/index.js");

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cf00000301010018dd8db00000000049454e44ae426082",
  "hex",
);
const hits: string[] = [];
const server = createServer((req, res) => {
  hits.push(req.url ?? "");
  const [, kind] = (req.url ?? "").split("/");
  if (kind === "good" && req.url?.endsWith("/apple-touch-icon.png")) {
    res.writeHead(200, { "Content-Type": "image/png" }).end(PNG);
  } else if (kind === "away") {
    res.writeHead(302, { Location: `http://localhost:${port}/good/apple-touch-icon.png` }).end();
  } else if (kind === "html") {
    res.writeHead(200, { "Content-Type": "text/html" }).end("<html></html>");
  } else if (kind === "lying") {
    res.writeHead(200, { "Content-Type": "image/png" }).end("<html>not an image</html>");
  } else if (kind === "huge") {
    res.writeHead(200, { "Content-Type": "image/png" }).end(Buffer.concat([PNG, Buffer.alloc(300 * 1024)]));
  } else {
    res.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
const db = await getDB();
// Paths stand for sites here; the service appends the icon paths to them.
const site = (kind: string) => `http://127.0.0.1:${port}/${kind}`;
const count = (kind: string) => hits.filter((hit) => hit.startsWith(`/${kind}/`)).length;

try {
  assert.equal(providerIconSite("openai"), "https://openai.com", "a service uses its own site");
  assert.equal(providerIconSite("custom", "http://127.0.0.1:18080/v1"), "http://127.0.0.1:18080", "custom: the host");
  assert.equal(providerIconSite("custom", ""), null);

  // ── Fetch once ──
  assert.equal(await icons.ensureProviderIcon(db, site("good")), true);
  assert.equal(count("good"), 1);
  assert.equal(await icons.ensureProviderIcon(db, site("good")), true, "a cached icon is served");
  assert.equal(count("good"), 1, "and never fetched again");
  const listed = await icons.listProviderIcons(db);
  assert.match(listed[site("good")]!, /^[0-9a-f]{16}$/);
  const read = await icons.readProviderIcon(site("good"));
  assert.equal(read?.type, "image/png");
  assert.ok(read?.buffer.equals(PNG));

  // ── A failure is cached ──
  assert.equal(await icons.ensureProviderIcon(db, site("missing")), false);
  assert.equal(count("missing"), 2, "both icon paths were tried");
  assert.equal(await icons.ensureProviderIcon(db, site("missing")), false);
  assert.equal(count("missing"), 2, "a known failure is not retried");
  assert.equal(await icons.ensureProviderIcon(db, site("missing"), true), false);
  assert.equal(count("missing"), 4, "Refresh icon asks again");
  assert.equal(await icons.ensureProviderIcon(db, site("good"), true), true);
  assert.equal(count("good"), 2, "Refresh icon refetches a cached icon too");

  // ── Safety ──
  for (const kind of ["away", "html", "lying", "huge"]) {
    assert.equal(await icons.ensureProviderIcon(db, site(kind)), false, `${kind} is refused`);
    assert.equal(await icons.readProviderIcon(site(kind)), null);
  }
  assert.equal(count("good"), 2, "a redirect to another host is never followed");

  // ── The setting ──
  await createAppSettingsStorage(db).set(icons.PROVIDER_ICONS_ENABLED_SETTINGS_KEY, "false");
  assert.equal(await icons.ensureProviderIcon(db, site("other"), true), false);
  assert.equal(count("other"), 0, "nothing is fetched while the setting is off");
  assert.deepEqual(await icons.listProviderIcons(db), {}, "and no icon is shown");

  console.log("provider-icons regression passed");
} finally {
  server.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}

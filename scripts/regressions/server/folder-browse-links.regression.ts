import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";

// Browse and folder tokens stay inside the home folder even when a folder inside it is a link to elsewhere.
const base = mkdtempSync(join(tmpdir(), "marinara-folder-browse-"));
const home = join(base, "home");
const outside = join(base, "outside");
mkdirSync(join(home, "SillyTavern", "data"), { recursive: true });
mkdirSync(join(outside, "secret-folder"), { recursive: true });
writeFileSync(join(outside, "secret-folder", "note.txt"), "x");
symlinkSync(outside, join(home, "elsewhere"));

const previousHome = process.env.HOME;
const previousRoots = process.env.IMPORT_ALLOWED_ROOTS;
process.env.HOME = home;
delete process.env.IMPORT_ALLOWED_ROOTS;

const { importRoutes } = await import("../../../packages/server/src/routes/import.routes.js");
const app = Fastify();
await app.register(importRoutes);
await app.ready();

async function list(path: string) {
  const res = await app.inject({
    method: "POST",
    url: "/list-directory",
    headers: { host: "localhost" },
    remoteAddress: "127.0.0.1",
    payload: { path },
  });
  assert.equal(res.statusCode, 200, res.body);
  return res.json() as { success: boolean; folders?: string[]; folderToken?: string; error?: string };
}

try {
  const inside = await list(home);
  assert.equal(inside.success, true, inside.error);
  assert.deepEqual(inside.folders, ["SillyTavern"]);

  const nested = await list(join(home, "SillyTavern"));
  assert.equal(nested.success, true);
  assert.ok(nested.folderToken);

  const viaLink = await list(join(home, "elsewhere"));
  assert.equal(viaLink.success, false, "a link inside home must not list a folder outside it");
  assert.equal(viaLink.folders, undefined);

  const viaLinkChild = await list(join(home, "elsewhere", "secret-folder"));
  assert.equal(viaLinkChild.success, false);

  const plainOutside = await list(outside);
  assert.equal(plainOutside.success, false);

  // A folder token is checked again when used: a listed folder swapped for a link no longer passes.
  const scan = async (folderToken: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/st-bulk/scan",
      headers: { host: "localhost" },
      remoteAddress: "127.0.0.1",
      payload: { folderToken },
    });
    return res.json() as { success?: boolean; error?: string };
  };
  const okScan = await scan(nested.folderToken!);
  assert.doesNotMatch(okScan.error ?? "", /can only read folders inside/);
  renameSync(join(home, "SillyTavern"), join(base, "moved"));
  symlinkSync(outside, join(home, "SillyTavern"));
  const swapped = await scan(nested.folderToken!);
  assert.equal(swapped.success, false);
  assert.match(
    swapped.error ?? "",
    /can only read folders inside/,
    "a swapped folder token must not reach outside home",
  );

  console.log("folder-browse-links regression passed");
} finally {
  await app.close();
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  if (previousRoots !== undefined) process.env.IMPORT_ALLOWED_ROOTS = previousRoots;
  rmSync(base, { recursive: true, force: true });
}

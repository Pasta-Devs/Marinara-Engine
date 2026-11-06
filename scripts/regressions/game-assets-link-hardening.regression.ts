// Professor Mari's shell can make links inside the data dir when it sits in her workspace. The game-assets folder is
// held to its own real path (a game-assets folder that is itself a link, e.g. to another disk, still works): the
// default assets seed and the asset manifest build (startup, uploads, `mari images` background assign/delete) and the
// game-assets routes create, scan, copy, rename, write, read and delete only inside it, a link that leads out is
// skipped or refused and its target is never touched, a folder link that stays inside is listed, a link cycle ends, a
// folder reached under another spelling is entered through a link once, and manifest.json, meta.json and the seed's
// hash are written as new files, never through a link, and read only when they are plain files (a FIFO would block the
// server). Image previews are cached only in the real thumbnail folder (a refused one serves originals and logs once),
// and a link at a preview's name is never served.
// The shared avatar cleanup used by the app's own deletes keeps a file whose avatar folder's real path is outside the
// data dir. A category folder is never deleted through a trailing slash, dot or other case. Normal work still runs with
// DATA_DIR behind a link and with game-assets behind a link, and a dangling link (game-assets on an unplugged disk
// included) or a manifest that cannot be written never blocks boot. Every case runs and the failures are reported
// together.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";

const root = realpathSync(mkdtempSync(join(tmpdir(), "marinara-game-assets-links-")));
const dataDir = join(root, "data");
const outside = join(root, "outside");
mkdirSync(join(dataDir, "storage"), { recursive: true });
mkdirSync(outside);
symlinkSync(dataDir, join(root, "data-link"), "dir");
process.env.DATA_DIR = join(root, "data-link");
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { default: multipart } = await import("../../packages/server/node_modules/@fastify/multipart/index.js");
const { buildAssetManifest, ensureAssetDirs, getAssetManifest } =
  await import("../../packages/server/src/services/game/asset-manifest.service.js");
const { gameAssetsRoutes } = await import("../../packages/server/src/routes/game-assets.routes.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { deleteAbandonedAvatarFiles, mutateAvatarReferencesAndCleanup, removeUnattachedAvatarFile } =
  await import("../../packages/server/src/services/image/avatar-file-lifecycle.js");
const { seedDefaultGameAssets } = await import("../../packages/server/src/db/seed-game-assets.js");
const { BUNDLED_GAME_ASSETS_DIR } = await import("../../packages/server/src/services/game/native-game-assets.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { resetRateLimitedLogs } = await import("../../packages/server/src/lib/log-rate-limit.js");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const BAIT = "outside-file-the-app-must-not-touch";
let gameAssets = join(dataDir, "game-assets");

const failures: string[] = [];
async function check(name: string, run: () => unknown) {
  try {
    await run();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
}

// Every entry under a folder, links recorded as links, so "untouched" means no file moved, changed, added or removed.
function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      const rel = relative(dir, full);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) result[rel] = `link:${readlinkSync(full)}`;
      else if (stat.isDirectory()) {
        result[rel] = "dir";
        walk(full);
      } else result[rel] = readFileSync(full).toString("base64");
    }
  };
  if (existsSync(dir)) walk(dir);
  return result;
}
async function untouched(dir: string, run: () => unknown, label: string) {
  const before = snapshot(dir);
  await run();
  assert.deepEqual(snapshot(dir), before, `${label}: ${dir} is untouched`);
}
function bait(dir: string, files: Record<string, string | Buffer>) {
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}
// Swaps an entry (in game-assets unless absolute) for a link and returns a function that puts the real entry back.
function link(rel: string, target: string) {
  const path = isAbsolute(rel) ? rel : join(gameAssets, rel);
  const aside = `${path}.real-${Math.random().toString(36).slice(2)}`;
  if (lstatSync(path, { throwIfNoEntry: false })) renameSync(path, aside);
  mkdirSync(join(path, ".."), { recursive: true });
  symlinkSync(target, path);
  return () => {
    rmSync(path, { recursive: true, force: true }); // removes a link itself, never what it leads to
    if (existsSync(aside)) renameSync(aside, path);
  };
}
// A FIFO at `path` whose writer waits for a reader: true once something opened it to read, which would block the server
// for as long as no writer comes. The writer then reads once too, so code that writes the FIFO next cannot hang either.
async function fifoOpened(path: string, run: () => unknown): Promise<boolean> {
  const aside = `${path}.aside`;
  if (lstatSync(path, { throwIfNoEntry: false })) renameSync(path, aside);
  execFileSync("mkfifo", [path]);
  const opened = `${path}.opened`;
  const script = 'printf "{}" > "$1" && : > "$2" && cat "$1" > /dev/null';
  const writer = spawn("sh", ["-c", script, "sh", path, opened], { stdio: "ignore" });
  try {
    await run();
    for (let wait = 0; wait < 10 && !existsSync(opened); wait++) await new Promise((done) => setTimeout(done, 30));
    return existsSync(opened);
  } finally {
    writer.kill("SIGKILL");
    rmSync(path, { force: true });
    rmSync(opened, { force: true });
    if (existsSync(aside)) renameSync(aside, path);
  }
}
const manifestText = () => JSON.stringify(buildAssetManifest());
const listed = (manifest: string, ...names: string[]) => names.filter((name) => manifest.includes(name));

const app = Fastify();
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
await app.register(gameAssetsRoutes, { prefix: "/api/game-assets" });
const inject = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
  app.inject({
    method,
    url: `/api/game-assets${url}`,
    ...(payload === undefined ? {} : { payload: payload as never }),
  });
const BOUNDARY = "----marinara-game-assets-links";
const multipartUpload = (subcategory: string, filename: string, content: Buffer, category = "sprites") =>
  app.inject({
    method: "POST",
    url: "/api/game-assets/upload",
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="category"\r\n\r\n${category}\r\n` +
          `--${BOUNDARY}\r\nContent-Disposition: form-data; name="subcategory"\r\n\r\n${subcategory}\r\n` +
          `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      content,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
    ]),
  });
const jsonUpload = (subcategory: string, filename: string, content = PNG, category = "sprites") =>
  inject("POST", "/upload", { category, subcategory, filename, data: content.toString("base64") });
const status = async <T extends { statusCode: number; body: string }>(
  response: Promise<T>,
  expected: number,
  label: string,
) => {
  const result = await response;
  assert.equal(result.statusCode, expected, `${label}: ${result.body}`);
  return result;
};

// The normal flows, run with DATA_DIR behind a link and again with game-assets behind a link.
async function normalFlows(label: string, track: string) {
  await check(`${label}: legacy flat music migrates and the manifest is a plain file`, () => {
    bait(join(gameAssets, "music", "combat"), { [`${track}.mp3`]: "drums" });
    ensureAssetDirs();
    const manifest = buildAssetManifest();
    assert.equal(
      readFileSync(join(gameAssets, "music", "combat", "fantasy", "intense", `${track}.mp3`), "utf8"),
      "drums",
    );
    assert.ok(manifest.assets[`music:combat:fantasy:intense:${track}`], "the migrated track is listed");
    for (const dir of ["sfx/ui", "ambient/urban", "sprites/generic-scifi", "backgrounds/fantasy"])
      assert.ok(lstatSync(join(gameAssets, dir)).isDirectory(), `${dir} is created`);
    assert.ok(lstatSync(join(gameAssets, "manifest.json")).isFile(), "manifest.json is a plain file");
    assert.equal(getAssetManifest().count, manifest.count, "the written manifest reads back");
    assert.deepEqual(
      readdirSync(gameAssets).filter((name) => name.endsWith(".tmp")),
      [],
      "no temporary file is left behind",
    );
  });
  await check(`${label}: upload, rename, move, copy, edit and delete`, async () => {
    await status(jsonUpload("generic-fantasy", "hero.png"), 200, "JSON upload");
    await status(multipartUpload("exploration/fantasy/calm", "song.mp3", Buffer.from("la"), "music"), 200, "upload");
    assert.equal(readFileSync(join(gameAssets, "music/exploration/fantasy/calm/song.mp3"), "utf8"), "la");
    await status(
      inject("POST", "/rename", { path: "sprites/generic-fantasy/hero.png", newName: "hero-2.png" }),
      200,
      "rename",
    );
    await status(
      inject("POST", "/move", { path: "sprites/generic-fantasy/hero-2.png", targetFolder: "sprites/heroes" }),
      200,
      "move",
    );
    await status(
      inject("POST", "/copy", { path: "sprites/heroes/hero-2.png", targetFolder: "sprites/generic-scifi" }),
      200,
      "copy",
    );
    assert.deepEqual(readFileSync(join(gameAssets, "sprites/generic-scifi/hero-2.png")), PNG);
    await status(inject("PUT", "/file-content/sprites/heroes/notes.md", { content: "# Heroes" }), 200, "edit");
    assert.equal(JSON.parse((await inject("GET", "/file-content/sprites/heroes/notes.md")).body).content, "# Heroes");
    await status(inject("GET", "/file-info/sprites/heroes/hero-2.png"), 200, "file info");
    await status(
      inject("PATCH", "/folders/description", { path: "sprites/heroes", description: "Heroes" }),
      200,
      "note",
    );
    assert.match((await inject("GET", "/tree")).body, /"description":"Heroes"/u);
    await status(inject("POST", "/folders", { path: "sprites/empty" }), 200, "new folder");
    await status(inject("DELETE", "/folders/sprites/empty"), 200, "delete folder");
    await status(inject("DELETE", "/file/sprites/generic-scifi/hero-2.png"), 200, "delete");
    const bulk = JSON.parse(
      (await inject("POST", "/delete-bulk", { paths: ["sprites/heroes/hero-2.png", "sprites/heroes/notes.md"] })).body,
    ) as { succeeded: string[] };
    assert.equal(bulk.succeeded.length, 2, "bulk delete");
    await status(inject("DELETE", "/folders/sprites/heroes"), 200, "delete emptied folder");
    assert.ok(!existsSync(join(gameAssets, "sprites/heroes")));
    assert.ok(getAssetManifest().assets["music:exploration:fantasy:calm:song"], "the upload is in the manifest");
    await status(inject("DELETE", "/file/music/exploration/fantasy/calm/song.mp3"), 200, "delete upload");
  });
  await check(`${label}: bulk move and copy, and a link that stays inside`, async () => {
    bait(join(gameAssets, "sprites/generic-fantasy"), { "knight.png": PNG, "mage.png": PNG });
    const restore = link(
      "sprites/generic-fantasy/knight-alias.png",
      join(gameAssets, "sprites/generic-fantasy/knight.png"),
    );
    try {
      const tree = (await inject("GET", "/tree")).body;
      assert.ok(tree.includes("knight-alias.png") && tree.includes("mage.png"), "the tree lists both");
      assert.ok(buildAssetManifest().assets["sprites:generic-fantasy:knight-alias"], "a link inside is still listed");
    } finally {
      restore();
    }
    const moved = JSON.parse(
      (
        await inject("POST", "/move-bulk", {
          paths: ["sprites/generic-fantasy/knight.png", "sprites/generic-fantasy/mage.png"],
          targetFolder: "sprites/party",
        })
      ).body,
    ) as { succeeded: string[] };
    assert.equal(moved.succeeded.length, 2, "bulk move");
    const copied = JSON.parse(
      (
        await inject("POST", "/copy-bulk", {
          paths: ["sprites/party/knight.png", "sprites/party/mage.png"],
          targetFolder: "sprites/generic-scifi",
        })
      ).body,
    ) as { succeeded: string[] };
    assert.equal(copied.succeeded.length, 2, "bulk copy");
    assert.deepEqual(readFileSync(join(gameAssets, "sprites/generic-scifi/mage.png")), PNG);
    await status(inject("DELETE", "/folders/sprites/party?recursive=true"), 200, "delete folder with files");
    for (const name of ["knight.png", "mage.png"]) rmSync(join(gameAssets, "sprites/generic-scifi", name));
  });
}

// The default assets seed (startup), on a normal folder and through links that lead out.
const SEED_MARKER = ".default-assets-seeded.sha256";
const bundledFiles = (function list(dir: string, rel = ""): string[] {
  return readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .flatMap((name) =>
      lstatSync(join(dir, name)).isDirectory() ? list(join(dir, name), join(rel, name)) : [join(rel, name)],
    );
})(BUNDLED_GAME_ASSETS_DIR);
// The link cases run once: they share realGameAssetPath with the manifest and route cases that run in both passes.
async function seedCases(label: string, linkCases: boolean) {
  await check(`${label}: the default assets seed installs the bundle and records its hash`, async () => {
    rmSync(join(gameAssets, SEED_MARKER), { force: true });
    rmSync(join(gameAssets, "sfx"), { recursive: true, force: true });
    await seedDefaultGameAssets();
    assert.ok(lstatSync(join(gameAssets, SEED_MARKER)).isFile(), "the hash is a plain file");
    assert.match(readFileSync(join(gameAssets, SEED_MARKER), "utf8"), /^[0-9a-f]{64}\n$/u, "the hash is recorded");
    for (const file of bundledFiles) assert.ok(lstatSync(join(gameAssets, file)).isFile(), `${file} is installed`);
    assert.ok(lstatSync(join(gameAssets, "sfx", "ui", ".native")).isFile(), "native markers are written");
  });
  if (!linkCases) return;
  await check(`${label}: the seed never copies into a linked folder`, async () => {
    const target = join(outside, `${label}-seed-sfx`);
    mkdirSync(target);
    const restore = link("sfx", target);
    rmSync(join(gameAssets, SEED_MARKER), { force: true });
    try {
      await untouched(target, () => seedDefaultGameAssets(), "seed");
    } finally {
      restore();
    }
  });
  await check(`${label}: the seed never writes its hash or a native marker through a link`, async () => {
    const target = bait(join(outside, `${label}-seed-marker`), { "hash.txt": BAIT });
    const restores = [link(SEED_MARKER, join(target, "hash.txt")), link("music/.native", join(target, "native-made"))];
    try {
      await untouched(target, () => seedDefaultGameAssets(), "seed");
    } finally {
      for (const restore of restores) restore();
    }
  });
  await check(
    `${label}: a dangling link never stops the seed, and the skipped folder is seeded once it is back`,
    async () => {
      const missing = join(outside, `${label}-unplugged-ambient`);
      const restore = link("ambient", missing);
      rmSync(join(gameAssets, SEED_MARKER), { force: true });
      try {
        await seedDefaultGameAssets();
        assert.ok(!existsSync(missing), "nothing is created at the link's target");
        assert.ok(!existsSync(join(gameAssets, SEED_MARKER)), "a skipped folder leaves the hash unrecorded");
      } finally {
        restore();
      }
      rmSync(join(gameAssets, "ambient"), { recursive: true, force: true });
      await seedDefaultGameAssets();
      for (const file of bundledFiles.filter((path) => path.startsWith(`ambient${sep}`)))
        assert.ok(lstatSync(join(gameAssets, file)).isFile(), `${file} is installed on the next run`);
      assert.ok(lstatSync(join(gameAssets, SEED_MARKER)).isFile(), "and the hash is recorded then");
    },
  );
  await check(`${label}: a FIFO at the seed's hash is never read`, async () => {
    rmSync(join(gameAssets, SEED_MARKER), { force: true });
    assert.equal(await fifoOpened(join(gameAssets, SEED_MARKER), () => seedDefaultGameAssets()), false, "read");
  });
  await check(`${label}: a FIFO at meta.json is never read`, async () => {
    const tree = () => status(inject("GET", "/tree"), 200, "tree");
    assert.equal(await fifoOpened(join(gameAssets, "meta.json"), tree), false, "read");
  });
}

// Image previews of game assets (shared with backgrounds and the gallery), cached in data/backgrounds-thumbs.
async function thumbnailCases(label: string) {
  const thumbs = join(dataDir, "backgrounds-thumbs");
  const image = join(gameAssets, "sprites/generic-fantasy/thumb-source.png");
  const url = "/file/sprites/generic-fantasy/thumb-source.png?w=320";
  const key = () => createHash("sha1").update(realpathSync(image)).digest("hex").slice(0, 16);
  const previewName = () => `v3-320-${statSync(image).mtimeMs}-${key()}.webp`;
  bait(join(gameAssets, "sprites/generic-fantasy"), { "thumb-source.png": PNG });
  await check(`${label}: a preview is cached in the real thumbnail folder`, async () => {
    const response = await status(inject("GET", url), 200, "preview");
    assert.equal(response.headers["content-type"], "image/webp");
    assert.ok(lstatSync(join(thumbs, previewName())).isFile(), "the preview is cached");
    assert.deepEqual((await inject("GET", url)).rawPayload, readFileSync(join(thumbs, previewName())), "cache hit");
  });
  await check(`${label}: previews are never written into a linked thumbnail folder, and that logs once`, async () => {
    const target = join(outside, `${label}-thumbs`);
    mkdirSync(target);
    const restore = link(thumbs, target);
    const originalWarn = logger.warn;
    const warnings: unknown[] = [];
    logger.warn = ((...args: unknown[]) => void warnings.push(args)) as typeof logger.warn;
    resetRateLimitedLogs();
    try {
      await untouched(
        target,
        async () => {
          for (let request = 0; request < 5; request++)
            assert.deepEqual((await status(inject("GET", url), 200, "original")).rawPayload, PNG);
        },
        "preview",
      );
      assert.equal(warnings.length, 1, "five previews from a refused cache folder log one warning");
      assert.ok(String(warnings[0]).includes("backgrounds-thumbs"), "the warning names the preview folder");
    } finally {
      logger.warn = originalWarn;
      resetRateLimitedLogs();
      restore();
    }
  });
  await check(`${label}: a link at a preview's name is never served`, async () => {
    const secret = bait(join(outside, `${label}-preview`), { "secret.webp": BAIT });
    const restore = link(join(thumbs, previewName()), join(secret, "secret.webp"));
    try {
      await untouched(
        secret,
        async () => assert.ok(!(await inject("GET", url)).body.includes(BAIT), "the outside file is served"),
        "preview",
      );
    } finally {
      restore();
    }
  });
  rmSync(image);
}

// Links in game-assets that lead out, each against its own outside folder.
async function linkedCases(label: string) {
  await check(`${label}: a linked music/<state> folder is not migrated`, async () => {
    const flat = bait(join(outside, `${label}-flat-music`), { "battle-theme.mp3": BAIT, "town-square.ogg": BAIT });
    const restore = link("music/dialogue", flat);
    try {
      await untouched(flat, () => buildAssetManifest(), "manifest build");
    } finally {
      restore();
    }
  });
  await check(`${label}: folders are not created through a linked folder`, async () => {
    const target = join(outside, `${label}-ambient`);
    mkdirSync(target);
    const restore = link("ambient", target);
    try {
      await untouched(target, () => buildAssetManifest(), "manifest build");
    } finally {
      restore();
    }
  });
  await check(`${label}: a linked folder or file is not listed`, async () => {
    const art = bait(join(outside, `${label}-art`), { "secret-face.png": PNG });
    const file = bait(join(outside, `${label}-file`), { "leaked-name.png": PNG });
    const restores = [
      link("sprites/secret-art", art),
      link("sprites/generic-fantasy/leaked-link.png", join(file, "leaked-name.png")),
      link(join(dataDir, "backgrounds", "linked-background.png"), join(file, "leaked-name.png")),
    ];
    try {
      await untouched(
        outside,
        async () => {
          assert.deepEqual(listed(manifestText(), "secret-face", "leaked-link", "linked-background"), [], "manifest");
          assert.deepEqual(listed((await inject("GET", "/tree")).body, "secret-face", "leaked-link"), [], "tree");
        },
        "scan",
      );
    } finally {
      for (const restore of restores) restore();
    }
  });
  await check(`${label}: a music/<state> folder linked inside game-assets is listed with its tracks`, async () => {
    const shared = bait(join(gameAssets, "shared-music"), { "fantasy/calm/linked-track.mp3": "calm" });
    const escape = bait(join(outside, `${label}-escape-music`), { "fantasy/calm/escaped-track.mp3": BAIT });
    symlinkSync(escape, join(shared, "escape"));
    const restore = link("music/dialogue", shared);
    try {
      await untouched(
        outside,
        async () => {
          const manifest = JSON.stringify(buildAssetManifest());
          assert.ok(manifest.includes('"music:dialogue:fantasy:calm:linked-track"'), "the manifest lists its track");
          const tree = (await status(inject("GET", "/tree"), 200, "tree")).body;
          assert.ok(tree.includes('"path":"music/dialogue/fantasy/calm/linked-track.mp3"'), "the tree lists its track");
          assert.deepEqual(listed(manifest + tree, "escaped-track"), [], "a link in it that leads out stays unlisted");
        },
        "scan",
      );
    } finally {
      restore();
      rmSync(shared, { recursive: true });
    }
  });
  await check(`${label}: a link cycle ends with the scan complete`, async () => {
    bait(join(gameAssets, "sfx/ui"), { "cycle-click.mp3": "click" });
    // One link to the folder it sits in, one to game-assets, and a cycle through two links.
    mkdirSync(join(gameAssets, "cycle-hop"));
    const restores = [
      link("sfx/ui/loop", join(gameAssets, "sfx")),
      link("sprites/all", gameAssets),
      link("music/combat", join(gameAssets, "cycle-hop")),
      link("cycle-hop/back", join(gameAssets, "music")),
    ];
    try {
      const manifest = buildAssetManifest();
      assert.ok(manifest.assets["sfx:ui:cycle-click"], "the manifest lists the folder a cycle leads to");
      const tree = (await status(inject("GET", "/tree"), 200, "tree")).body;
      assert.ok(tree.includes('"path":"sfx/ui/cycle-click.mp3"'), "the tree lists it");
      const followed = Object.keys(manifest.assets).filter((tag) => /:(loop|all):/u.test(tag));
      assert.deepEqual(followed, [], "a link to its own folder is not entered");
      // Without one walk-wide set, the walk would go around until the path holds too many links (ELOOP).
      const twice = /back[/:]combat[/:]back/u;
      assert.ok(!twice.test(tree), "the tree goes around a cycle through two links at most once");
      assert.ok(!Object.keys(manifest.assets).some((tag) => twice.test(tag)), "and so does the manifest");
    } finally {
      for (const restore of restores.reverse()) restore();
      rmSync(join(gameAssets, "cycle-hop"), { recursive: true });
      rmSync(join(gameAssets, "sfx/ui/cycle-click.mp3"));
    }
  });
  await check(`${label}: a folder reached under another spelling is entered once`, async () => {
    // On a disk that ignores case (macOS, Windows), a link written in another case reaches the same folder under a new
    // path. Each folder in a chain holds a track, its child and a link to that child in upper case, and the first one
    // also links to itself and to sfx in upper case. Told apart by path, the chain alone listed 2^(n+1) - 2 tracks for n
    // links; by identity, each folder is entered through a link once. On a case-sensitive disk these links dangle.
    const depth = 5;
    const top = join(gameAssets, "sfx/chain");
    for (let i = 1, dir = top; i <= depth; i++) {
      const child = bait(join(dir, `c${i}`), { [`chain-${i}.mp3`]: "x" });
      symlinkSync(`C${i}`, join(dir, `s${i}`));
      dir = child;
    }
    symlinkSync(join(top, "C1"), join(top, "c1/self-upper"));
    symlinkSync(join(gameAssets, "SFX"), join(top, "c1/sfx-upper"));
    try {
      const tags = Object.keys(buildAssetManifest().assets).filter((tag) => tag.includes(":chain-"));
      const tree = (await status(inject("GET", "/tree"), 200, "tree")).body;
      const bound = depth + (depth * (depth + 1)) / 2;
      assert.ok(tags.length <= bound, `the manifest lists ${tags.length} chain tracks, at most ${bound}`);
      const inTree = tree.split('"name":"chain-').length - 1;
      assert.ok(inTree <= bound, `the tree lists ${inTree} chain tracks, at most ${bound}`);
      assert.deepEqual(
        tags.filter((tag) => /self-upper|sfx-upper/u.test(tag)),
        [],
        "a link in another case to its own folder or one above it is not entered",
      );
      if (existsSync(join(gameAssets, "SFX"))) {
        assert.ok(tags.includes("sfx:chain:s1:chain-1"), "a link in another case to a child folder is entered");
      }
    } finally {
      rmSync(top, { recursive: true });
    }
  });
  await check(`${label}: manifest.json is never written or read through a link`, async () => {
    const target = bait(join(outside, `${label}-manifest`), { "target.json": JSON.stringify({ bait: BAIT }) });
    const restore = link("manifest.json", join(target, "target.json"));
    try {
      await untouched(target, () => buildAssetManifest(), "manifest build");
      assert.ok(!JSON.stringify(getAssetManifest()).includes(BAIT), "getAssetManifest never reads the target");
      assert.ok(!(await inject("GET", "/manifest")).body.includes(BAIT), "GET /manifest never reads the target");
    } finally {
      restore();
    }
    const dangling = join(outside, `${label}-dangling-manifest.json`);
    const restoreDangling = link("manifest.json", dangling);
    try {
      buildAssetManifest();
      assert.ok(!existsSync(dangling), "a dangling manifest link creates no outside file");
    } finally {
      restoreDangling();
    }
    buildAssetManifest();
    assert.ok(lstatSync(join(gameAssets, "manifest.json")).isFile(), "the manifest is written again once unlinked");
  });
  await check(`${label}: meta.json is never read through a link`, async () => {
    const target = bait(join(outside, `${label}-meta`), { "meta.json": JSON.stringify({ "": { description: BAIT } }) });
    const restore = link("meta.json", join(target, "meta.json"));
    try {
      await untouched(
        target,
        async () => {
          assert.ok(!(await inject("GET", "/tree")).body.includes(BAIT), "the tree never shows the target");
          await inject("PATCH", "/folders/description", { path: "sprites", description: "Sprites" });
        },
        "folder note",
      );
    } finally {
      restore();
    }
  });
  // Each request gets fresh links and outside files, so every one is proven on its own.
  const ownFolders = ["sprites/generic-fantasy", "sprites/generic-scifi"].map((dir) => join(gameAssets, dir));
  const routeLinks = () => {
    const kept = ownFolders.map((dir) => new Set(existsSync(dir) ? readdirSync(dir) : []));
    const art = bait(join(outside, `${label}-route-art`), {
      "secret-face.png": PNG,
      "readme.txt": BAIT,
      "inner/deep.png": PNG,
    });
    const notes = bait(join(outside, `${label}-route-notes`), { "notes.txt": BAIT, "picture.png": PNG });
    bait(join(gameAssets, "sprites/generic-fantasy"), { "own.png": PNG });
    const restores = [
      link("sprites/secret-art", art),
      link("sprites/generic-fantasy/notes.txt", join(notes, "notes.txt")),
      link("sprites/generic-fantasy/picture.png", join(notes, "picture.png")),
    ];
    // A request the old code let through can leave a copy or a renamed link behind; it is removed, so that the next
    // case (and the next pass) starts from the same folders.
    const restore = () => {
      for (const restoreLink of restores) restoreLink();
      ownFolders.forEach((dir, index) => {
        for (const name of readdirSync(dir)) if (!kept[index]!.has(name)) rmSync(join(dir, name), { recursive: true });
      });
    };
    return { art, restore };
  };
  for (const [what, request] of [
    ["JSON upload into a linked folder", () => jsonUpload("secret-art", "new.png")],
    ["JSON upload below a linked folder", () => jsonUpload("secret-art/deeper", "new.png")],
    ["multipart upload into a linked folder", () => multipartUpload("secret-art", "new.png", PNG)],
    [
      "rename in a linked folder",
      () => inject("POST", "/rename", { path: "sprites/secret-art/secret-face.png", newName: "x.png" }),
    ],
    [
      "rename of a link that leads out",
      () => inject("POST", "/rename", { path: "sprites/generic-fantasy/picture.png", newName: "x.png" }),
    ],
    [
      "move out of a linked folder",
      () =>
        inject("POST", "/move", { path: "sprites/secret-art/secret-face.png", targetFolder: "sprites/generic-scifi" }),
    ],
    [
      "move into a linked folder",
      () => inject("POST", "/move", { path: "sprites/generic-fantasy/own.png", targetFolder: "sprites/secret-art" }),
    ],
    [
      "copy out of a linked folder",
      () =>
        inject("POST", "/copy", { path: "sprites/secret-art/secret-face.png", targetFolder: "sprites/generic-scifi" }),
    ],
    [
      "copy into a linked folder",
      () => inject("POST", "/copy", { path: "sprites/generic-fantasy/own.png", targetFolder: "sprites/secret-art" }),
    ],
    [
      "copy of a link that leads out",
      () =>
        inject("POST", "/copy", { path: "sprites/generic-fantasy/picture.png", targetFolder: "sprites/generic-scifi" }),
    ],
    [
      "move-bulk out of a linked folder",
      () =>
        inject("POST", "/move-bulk", {
          paths: ["sprites/secret-art/secret-face.png"],
          targetFolder: "sprites/generic-scifi",
        }),
    ],
    [
      "move-bulk into a linked folder",
      () =>
        inject("POST", "/move-bulk", {
          paths: ["sprites/generic-fantasy/own.png"],
          targetFolder: "sprites/secret-art",
        }),
    ],
    [
      "copy-bulk out of a linked folder",
      () =>
        inject("POST", "/copy-bulk", {
          paths: ["sprites/secret-art/secret-face.png"],
          targetFolder: "sprites/generic-scifi",
        }),
    ],
    [
      "copy-bulk into a linked folder",
      () =>
        inject("POST", "/copy-bulk", {
          paths: ["sprites/generic-fantasy/own.png"],
          targetFolder: "sprites/secret-art/inner",
        }),
    ],
    ["delete in a linked folder", () => inject("DELETE", "/file/sprites/secret-art/secret-face.png")],
    ["delete of a link that leads out", () => inject("DELETE", "/file/sprites/generic-fantasy/picture.png")],
    [
      "delete-bulk in a linked folder",
      () => inject("POST", "/delete-bulk", { paths: ["sprites/secret-art/secret-face.png"] }),
    ],
    ["folder delete below a linked folder", () => inject("DELETE", "/folders/sprites/secret-art/inner?recursive=true")],
    ["folder delete of a linked folder", () => inject("DELETE", "/folders/sprites/secret-art?recursive=true")],
    ["new folder in a linked folder", () => inject("POST", "/folders", { path: "sprites/secret-art/made" })],
    [
      "folder note on a linked folder",
      () => inject("PATCH", "/folders/description", { path: "sprites/secret-art", description: "x" }),
    ],
    [
      "edit of a linked file",
      () => inject("PUT", "/file-content/sprites/generic-fantasy/notes.txt", { content: "overwritten" }),
    ],
    [
      "edit in a linked folder",
      () => inject("PUT", "/file-content/sprites/secret-art/readme.txt", { content: "overwritten" }),
    ],
    [
      "new file in a linked folder",
      () => inject("PUT", "/file-content/sprites/secret-art/made/new.md", { content: "x" }),
    ],
    ["read in a linked folder", () => inject("GET", "/file-content/sprites/secret-art/readme.txt")],
    ["read of a linked file", () => inject("GET", "/file-content/sprites/generic-fantasy/notes.txt")],
    ["file info in a linked folder", () => inject("GET", "/file-info/sprites/secret-art/secret-face.png")],
  ] as const) {
    await check(`${label}: ${what}`, async () => {
      const { restore } = routeLinks();
      try {
        await untouched(
          outside,
          async () => {
            const response = await request();
            const result = JSON.parse(response.body) as { failed?: unknown[]; succeeded?: unknown[] };
            const refused = response.statusCode >= 400 || (result.succeeded?.length === 0 && result.failed?.length);
            assert.ok(refused, `refused: ${response.statusCode} ${response.body}`);
            assert.ok(!response.body.includes(BAIT), "the outside file is never shown");
          },
          what,
        );
        assert.ok(lstatSync(join(gameAssets, "sprites/secret-art")).isSymbolicLink(), "the linked folder stays");
        assert.ok(
          lstatSync(join(gameAssets, "sprites/generic-fantasy/picture.png")).isSymbolicLink(),
          "the link stays",
        );
        assert.deepEqual(readFileSync(join(gameAssets, "sprites/generic-fantasy/own.png")), PNG, "own file stays");
      } finally {
        restore();
      }
    });
  }
}

const db = await getDB();
try {
  // A fresh install, as startup builds it: folders, the legacy flat-music migration and a plain manifest file.
  await normalFlows("data dir behind a link", "war-drums");
  await seedCases("data dir behind a link", true);
  await linkedCases("data dir behind a link");
  // Images are served only from inside the real data dir, so previews are proven here and not with game-assets moved out.
  await thumbnailCases("data dir behind a link");

  // The avatar cleanup the app's own deletes use: an avatar folder whose real path is outside keeps its files.
  await check("avatar deletes through a linked avatar folder keep the outside file", async () => {
    const avatars = join(dataDir, "avatars");
    mkdirSync(avatars, { recursive: true });
    const target = bait(join(outside, "avatars"), {
      "character-linked.png": PNG,
      "persona-linked.png": PNG,
      "character-old.png": PNG,
    });
    utimesSync(join(target, "character-old.png"), new Date(0), new Date(0));
    renameSync(avatars, `${avatars}.real`);
    symlinkSync(target, avatars, "dir");
    try {
      await untouched(
        target,
        async () => {
          await mutateAvatarReferencesAndCleanup({
            db,
            collectAvatarPaths: async () => ["/api/avatars/file/character-linked.png"],
            mutateReferences: async () => undefined,
          });
          await removeUnattachedAvatarFile({ avatarPath: "/api/avatars/file/persona-linked.png" });
          await deleteAbandonedAvatarFiles({ db, minimumAgeMs: 0 });
        },
        "avatar cleanup",
      );
    } finally {
      rmSync(avatars);
      renameSync(`${avatars}.real`, avatars);
    }
  });
  await check("avatar deletes still remove files in the real avatar folder", async () => {
    const avatars = join(dataDir, "avatars");
    bait(avatars, { "character-own.png": PNG, "persona-own.png": PNG });
    const { filesDeleted } = await mutateAvatarReferencesAndCleanup({
      db,
      collectAvatarPaths: async () => ["/api/avatars/file/character-own.png"],
      mutateReferences: async () => undefined,
    });
    assert.equal(filesDeleted, 1);
    await removeUnattachedAvatarFile({ avatarPath: "/api/avatars/file/persona-own.png" });
    assert.deepEqual(readdirSync(avatars), [], "both avatar files are removed");
  });

  // game-assets itself behind a link, as when it is moved to another disk: still followed, links inside still held.
  const otherDisk = join(root, "other-disk", "game-assets");
  mkdirSync(join(otherDisk, ".."), { recursive: true });
  renameSync(gameAssets, otherDisk);
  symlinkSync(otherDisk, gameAssets, "dir");
  gameAssets = otherDisk;
  await normalFlows("game-assets behind a link", "siege-drums");
  await seedCases("game-assets behind a link", false);
  await linkedCases("game-assets behind a link");

  await check("a category folder is never deleted through a trailing slash, a dot or another case", async () => {
    bait(join(gameAssets, "sprites/mine"), { "hero.png": PNG });
    for (const path of ["sprites/", "sprites/.", "Sprites"]) {
      const response = await inject("DELETE", `/folders/${path}?recursive=true`);
      assert.ok(response.statusCode >= 400, `${path}: ${response.statusCode} ${response.body}`);
      assert.ok(existsSync(join(gameAssets, "sprites/mine/hero.png")), `${path}: the category's files stay`);
    }
    rmSync(join(gameAssets, "sprites/mine"), { recursive: true });
  });

  // Boot: the startup manifest build runs the legacy migration, and neither a dangling link (the seed creates folders
  // first) nor a manifest that cannot be written stops it.
  const { buildApp } = await import("../../packages/server/src/app.js");
  await check("boot continues through a dangling link and a manifest that cannot be written", async () => {
    bait(join(gameAssets, "music", "travel_rest"), { "quiet-rest.mp3": "rest" });
    rmSync(join(gameAssets, "manifest.json"), { force: true });
    mkdirSync(join(gameAssets, "manifest.json"));
    rmSync(join(gameAssets, SEED_MARKER), { force: true });
    const restore = link("ambient", join(outside, "boot-unplugged-ambient"));
    const booted = await buildApp().finally(restore);
    try {
      await booted.ready();
      assert.equal(
        readFileSync(join(gameAssets, "music/travel_rest/fantasy/calm/quiet-rest.mp3"), "utf8"),
        "rest",
        "startup migrates the legacy flat track",
      );
      rmSync(join(gameAssets, "manifest.json"), { recursive: true });
      const rescan = await booted.inject({ method: "POST", url: "/api/game-assets/rescan" });
      assert.equal(rescan.statusCode, 200, rescan.body);
      assert.ok(lstatSync(join(gameAssets, "manifest.json")).isFile(), "rescan writes the manifest");
    } finally {
      await booted.close();
    }
  });
  await check("boot continues with game-assets linked to an unplugged disk", async () => {
    renameSync(otherDisk, `${otherDisk}.unplugged`);
    try {
      const booted = await buildApp();
      await booted.ready();
      await booted.close();
      assert.ok(!existsSync(otherDisk), "nothing is created on the missing disk");
    } finally {
      rmSync(otherDisk, { recursive: true, force: true });
      renameSync(`${otherDisk}.unplugged`, otherDisk);
    }
  });

  assert.deepEqual(failures, [], `game-assets link hardening:\n  ${failures.join("\n  ")}`);
  console.info("Game assets link hardening regression passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(root, { recursive: true, force: true });
}

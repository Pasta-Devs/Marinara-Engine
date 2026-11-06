// Regression: Agent Organizer store sidecar (store.json beside catalog.json).
// Store data is decoration, like the release notes: a missing or broken document
// must leave the catalog intact; a bad entry drops only itself; image paths resolve
// against the sidecar URL and may never leave its https origin.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-store-sidecar-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_GIT_BRANCH = "main";

const ROOT = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main";

const entry = (id: string) => ({
  manifest: {
    schemaVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    description: "Store sidecar regression fixture.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    files: [{ path: "server.mjs", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: true,
  },
  category: "misc" as const,
  artifact: { url: `${ROOT}/artifacts/${id}-1.0.0.zip`, sha256: "1".repeat(64), bytes: 1 },
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const notFound = () => new Response("404: Not Found", { status: 404, headers: { "content-type": "text/plain" } });

try {
  const { capabilityPackageManager, resetCapabilityReleaseNotesCache } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const catalog = {
    schemaVersion: 1,
    generatedAt: "2026-08-01T00:00:00.000Z",
    packages: [entry("chess"), entry("poker")],
  };
  const serve = (store: () => Response) =>
    (async (url: string | URL) => (String(url).endsWith("/store.json") ? store() : json(catalog))) as never;

  const read = async (store: () => Response) => {
    resetCapabilityReleaseNotesCache();
    const result = await capabilityPackageManager.catalog(serve(store), null);
    return Object.fromEntries(result.packages.map((item) => [item.manifest.id, item.store]));
  };

  const listings = await read(() =>
    json({
      schemaVersion: 1,
      packages: {
        chess: {
          section: "games",
          tagline: "Play chess.",
          featured: 1,
          iconPath: "../../store/icons/chess.webp",
          bannerPath: "../../store/banners/chess.webp",
          previews: ["https://evil.example/x.webp", "../../store/previews/chess-1.webp"],
          futureField: true,
        },
        poker: { section: "not-a-section", tagline: "Bad entry." },
      },
    }),
  );
  assert.deepEqual(listings.chess, {
    section: "games",
    tagline: "Play chess.",
    featured: 1,
    iconUrl: `${ROOT}/store/icons/chess.webp`,
    bannerUrl: `${ROOT}/store/banners/chess.webp`,
    bannerSmallUrl: undefined,
    previewUrls: [`${ROOT}/store/previews/chess-1.webp`],
  });
  assert.equal(listings.poker, undefined, "A bad entry drops only itself");

  resetCapabilityReleaseNotesCache();
  const withKits = await capabilityPackageManager.catalog(
    serve(() =>
      json({
        schemaVersion: 1,
        packages: { chess: { section: "games", tagline: "Play chess." } },
        kits: [
          { id: "starter", name: "Starter", packages: ["chess", "ghost"] },
          { id: "broken" },
          { id: "unknown", name: "Unknown", packages: ["ghost"] },
        ],
      }),
    ),
    null,
  );
  assert.deepEqual(
    withKits.kits,
    [{ id: "starter", name: "Starter", tagline: "", packages: ["chess"] }],
    "Kits keep only catalog packages; bad or empty kits drop",
  );
  assert.equal(
    withKits.packages.find((item) => item.manifest.id === "chess")?.store?.section,
    "games",
    "Kits leave the listings intact",
  );

  for (const broken of [notFound, () => json({ nope: true }), () => new Response("{", { status: 200 })]) {
    const result = await read(broken);
    assert.deepEqual(Object.keys(result), ["chess", "poker"], "The catalog survives a broken store sidecar");
    assert.equal(result.chess, undefined);
  }
  console.log("capability store sidecar: OK");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

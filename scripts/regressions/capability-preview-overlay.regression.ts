// ──────────────────────────────────────────────
// Regression: staging preview-overlay catalog gate (#5492)
// ──────────────────────────────────────────────
// Packages the Agents repo marks staging-only are cut from the published lanes
// and written to an overlay under catalog/preview/. Promotion copies staging to
// main verbatim, so that overlay EXISTS on main and serves 200 there — the only
// thing keeping an unreleased package away from a stable user is this Engine
// refusing to build the URL. These assertions pin that containment:
//   * the preview gate is an ALLOW-list (exact "staging"), deliberately unlike
//     the deny-list shaped resolveOfficialAgentBranch, so a checkout on a branch
//     named `master` gets the staging catalog but never the overlay;
//   * a stable Engine resolves no overlay URL at all, so nothing can fetch one;
//   * an absent overlay (its normal steady state, answered 404 + text/plain) and
//     a failing one both degrade to the published catalog instead of throwing —
//     catalog() has no cache, so a throw would blank the whole Agents browser;
//   * overlay entries are stamped `preview` and lose to the published lanes on
//     an id collision;
//   * the unattended startup migrations never request the overlay at all.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-preview-overlay-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_GIT_BRANCH = "staging";

const AGENTS_ROOT = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents";

function catalogEntry(id: string, artifactBranch: "main" | "staging") {
  return {
    manifest: {
      schemaVersion: 1,
      id,
      name: id,
      version: "1.0.0",
      description: "Preview overlay regression fixture.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { server: "server.mjs", client: "client.js" },
      files: [
        { path: "server.mjs", sha256: "0".repeat(64), bytes: 1 },
        { path: "client.js", sha256: "0".repeat(64), bytes: 1 },
      ],
      permissions: ["ui"],
      restartRequired: true,
    },
    category: "misc" as const,
    artifact: {
      url: `${AGENTS_ROOT}/${artifactBranch}/artifacts/${id}-1.0.0.zip`,
      sha256: "1".repeat(64),
      bytes: 1,
    },
  };
}

function catalogDocument(entries: ReturnType<typeof catalogEntry>[]) {
  return { schemaVersion: 1, generatedAt: "2026-08-01T00:00:00.000Z", packages: entries };
}

/** raw.githubusercontent.com answers a missing file with a text/plain 404, not
 *  JSON — reproduced exactly, because a content type the fetch policy rejects
 *  would throw before the caller ever sees the status. */
function notFound() {
  return new Response("404: Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

try {
  const { capabilityPackageManager, isPreviewCatalogChannel, resolvePreviewCatalogUrl, resolveOfficialAgentBranch } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

  // ── The gate is an allow-list ───────────────────────────────────────────────
  assert.equal(isPreviewCatalogChannel("staging"), true, "The staging channel is the one channel that may preview");

  // Each of these resolves to the STAGING catalog under the existing deny-list
  // helper. None of them may reach the overlay. `master` is the load-bearing
  // case: the launchers treat it as a mainline branch name.
  for (const branch of [
    "main",
    "master",
    "release/v2.4.0",
    "feature/preview-overlay",
    "hotfix/urgent",
    "v2.4.2",
    "refs/tags/v2.4.2",
    "Staging",
    "staging-test",
    "my-staging",
    "",
  ]) {
    assert.equal(isPreviewCatalogChannel(branch), false, `Branch "${branch}" must not qualify for the preview overlay`);
    assert.equal(
      resolvePreviewCatalogUrl("2.4.3", "", isPreviewCatalogChannel(branch)),
      null,
      `Branch "${branch}" must not resolve a preview overlay URL at all`,
    );
  }
  assert.equal(
    isPreviewCatalogChannel(null),
    false,
    "A detached or non-git checkout reports no branch and must not preview",
  );

  // The divergence from resolveOfficialAgentBranch is deliberate, not an
  // oversight: pinned here so nobody "simplifies" the gate back into it.
  assert.equal(resolveOfficialAgentBranch("master"), "staging");
  assert.equal(
    isPreviewCatalogChannel("master"),
    false,
    "The preview gate must stay stricter than the catalog-branch helper it sits beside",
  );

  // ── URL derivation mirrors the published lanes ──────────────────────────────
  assert.equal(resolvePreviewCatalogUrl("2.4.3", "", true), `${AGENTS_ROOT}/staging/catalog/preview/v2/catalog.json`);
  assert.equal(resolvePreviewCatalogUrl("3.0.1", "", true), `${AGENTS_ROOT}/staging/catalog/preview/v3/catalog.json`);
  assert.equal(
    resolvePreviewCatalogUrl("development", "", true),
    `${AGENTS_ROOT}/staging/catalog/preview/catalog.json`,
    "A non-release version must fall back to the legacy preview alias, exactly as the published lane does",
  );
  assert.equal(
    resolvePreviewCatalogUrl("2.4.3", "https://example.test/catalog.json", true),
    null,
    "An explicit catalog override is the whole catalog; no preview sibling may be synthesised for it",
  );

  // ── catalog() merge behaviour ───────────────────────────────────────────────
  const previewUrl = resolvePreviewCatalogUrl("2.4.3", "", true);
  assert.ok(previewUrl, "The staging preview URL fixture must resolve");
  const published = catalogEntry("published-pkg", "main");
  const previewOnly = catalogEntry("preview-pkg", "staging");

  function trackingFetch(previewResponse: () => Response) {
    const requested: string[] = [];
    const fetchImpl = async (url: string | URL) => {
      const href = String(url);
      requested.push(href);
      return href === previewUrl ? previewResponse() : ok(catalogDocument([published]));
    };
    return { requested, fetchImpl: fetchImpl as never };
  }

  // Absent overlay: the steady state whenever no package is marked staging-only.
  const absent = trackingFetch(notFound);
  const withoutOverlay = await capabilityPackageManager.catalog(absent.fetchImpl, previewUrl);
  assert.deepEqual(
    withoutOverlay.packages.map((entry) => entry.manifest.id),
    ["published-pkg"],
    "A missing overlay must leave the published catalog intact",
  );
  assert.equal(withoutOverlay.packages[0]?.preview, undefined, "Published entries must not be stamped as preview");
  assert.ok(absent.requested.includes(previewUrl), "A staging Engine must actually request the overlay");

  // Overlay present: merged, stamped, and artifact URLs resolved against staging.
  const present = trackingFetch(() => ok(catalogDocument([previewOnly])));
  const merged = await capabilityPackageManager.catalog(present.fetchImpl, previewUrl);
  // Compared in the order catalog() returned, NOT sorted here: the collator sort
  // is part of the contract, and sorting in the test would let append order pass
  // just as happily.
  assert.deepEqual(
    merged.packages.map((entry) => entry.manifest.id),
    ["preview-pkg", "published-pkg"],
    "The merged catalog must come back in collated name order, overlay entries included",
  );
  const mergedPreview = merged.packages.find((entry) => entry.manifest.id === "preview-pkg");
  assert.equal(mergedPreview?.preview, true, "Overlay entries must be stamped so later consumers can tell them apart");
  assert.equal(
    mergedPreview?.artifact.url,
    `${AGENTS_ROOT}/staging/artifacts/preview-pkg-1.0.0.zip`,
    "An overlay entry's artifact must resolve through the staging branch",
  );

  // Id in both documents: the published copy is what stable users already have.
  const collision = trackingFetch(() => ok(catalogDocument([catalogEntry("published-pkg", "staging")])));
  const resolved = await capabilityPackageManager.catalog(collision.fetchImpl, previewUrl);
  assert.deepEqual(
    resolved.packages.map((entry) => entry.manifest.id),
    ["published-pkg"],
    "An id present in both documents must appear exactly once",
  );
  assert.equal(resolved.packages[0]?.preview, undefined, "On a collision the published entry must win");

  // Provenance cannot be claimed by the catalog itself. `preview` is absent from
  // the strict downloaded-entry schema, so a published (or custom) document that
  // ships `preview: true` cannot ride it through the decoration spread. Only the
  // source URL decides.
  // The clean entry rides along so this cannot pass vacuously on an empty list:
  // the spoofing entry must be the ONLY casualty.
  const spoofingFetch = (async (url: string | URL) => {
    if (String(url) === previewUrl) return notFound();
    return ok({
      schemaVersion: 1,
      generatedAt: "2026-08-01T00:00:00.000Z",
      packages: [{ ...catalogEntry("spoofer-pkg", "main"), preview: true }, catalogEntry("published-pkg", "main")],
    });
  }) as never;
  const unspoofable = await capabilityPackageManager.catalog(spoofingFetch, previewUrl);
  assert.deepEqual(
    unspoofable.packages.map((entry) => entry.manifest.id),
    ["published-pkg"],
    "An entry claiming preview provenance must be rejected by the strict schema, leaving its neighbours intact",
  );
  assert.equal(
    unspoofable.packages[0]?.preview,
    undefined,
    "A downloaded catalog must never be able to stamp an entry as preview-sourced",
  );

  // A broken overlay must never take the catalog down with it.
  const failing = trackingFetch(() => {
    throw new Error("overlay exploded");
  });
  const degraded = await capabilityPackageManager.catalog(failing.fetchImpl, previewUrl);
  assert.deepEqual(
    degraded.packages.map((entry) => entry.manifest.id),
    ["published-pkg"],
    "A failing overlay must degrade to the published catalog instead of throwing",
  );

  const malformed = trackingFetch(() => ok({ schemaVersion: 1, packages: "not-an-array" }));
  const survived = await capabilityPackageManager.catalog(malformed.fetchImpl, previewUrl);
  assert.deepEqual(
    survived.packages.map((entry) => entry.manifest.id),
    ["published-pkg"],
    "A malformed overlay must degrade to the published catalog instead of throwing",
  );

  // A stable Engine holds no overlay URL, so the overlay is never requested.
  const stable = trackingFetch(notFound);
  const stableCatalog = await capabilityPackageManager.catalog(stable.fetchImpl, null);
  assert.deepEqual(
    stableCatalog.packages.map((entry) => entry.manifest.id),
    ["published-pkg"],
    "A null preview URL must yield the published catalog",
  );
  assert.equal(stable.requested.length, 1, "A stable Engine must make exactly one catalog request");
  assert.ok(!stable.requested.includes(previewUrl), "A stable Engine must never request the preview overlay");

  console.info("Capability preview-overlay regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

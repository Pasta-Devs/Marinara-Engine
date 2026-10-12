// ──────────────────────────────────────────────
// Regression: Agent release-notes sidecar
// ──────────────────────────────────────────────
// Release notes are published as notes.json BESIDE the catalog.json they
// describe, never as a key on a catalog entry and never inside a package
// manifest. capabilityCatalogPackageSchema is strict and the catalog parser
// DROPS entries carrying keys it does not know, so a new entry key would empty
// the Agents browser on every already-shipped Engine that predates it — not
// merely hide the notes. A sibling document those Engines never fetch has no
// such blast radius. These assertions pin that containment and the degradation
// guarantees that make the feature safe to ship ahead of the catalog:
//   * the sidecar URL is DERIVED from the catalog URL and only ever by swapping
//     a trailing catalog.json, so a configured catalog pointing anywhere else
//     yields no URL and nothing is fetched from a path nobody named;
//   * absent (404), unreachable, malformed, and over-cap documents all degrade
//     to "no notes" without throwing, leaving pending updates byte-identical to
//     what an Engine without this feature returns;
//   * each version's `highlight` is passed through as published and never
//     recomputed here, so the publisher's "the user will notice this" marker
//     cannot drift from the changelog it was generated from; an update is
//     marked notable when any version it installs is;
//   * an update carries the notes of every version it installs — above the
//     installed version, up to and including the target — newest first.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-release-notes-"));
process.env.DATA_DIR = dataDir;
process.env.MARINARA_GIT_BRANCH = "staging";

const AGENTS_ROOT = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents";

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** raw.githubusercontent.com answers a missing file with a text/plain 404, not
 *  JSON — reproduced exactly, because a content type the fetch policy rejects
 *  would throw before the caller ever sees the status. */
function notFound() {
  return new Response("404: Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function update(id: string, version: string, installedVersion = "1.0.0") {
  return {
    id,
    name: id,
    installedVersion,
    version,
    artifactSha256: "0".repeat(64),
    restartRequired: false,
  };
}

try {
  const {
    attachCapabilityReleaseNotes,
    capabilityPackageManager,
    resolveCapabilityReleaseNotesUrl,
    resetCapabilityReleaseNotesCache,
  } = await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

  // ── URL derivation ──────────────────────────────────────────────────────────
  assert.equal(
    resolveCapabilityReleaseNotesUrl(`${AGENTS_ROOT}/main/catalog/v2/catalog.json`),
    `${AGENTS_ROOT}/main/catalog/v2/notes.json`,
    "Notes are the sibling of the lane catalog they describe",
  );
  assert.equal(
    resolveCapabilityReleaseNotesUrl(`${AGENTS_ROOT}/staging/catalog/preview/v3/catalog.json`),
    `${AGENTS_ROOT}/staging/catalog/preview/v3/notes.json`,
    "The preview overlay carries its own sidecar",
  );
  // A configured catalog that is not a catalog.json gets NO derived URL. Appending
  // notes.json to an arbitrary operator-supplied path would fetch somewhere the
  // operator never pointed this Engine.
  assert.equal(resolveCapabilityReleaseNotesUrl("https://example.test/agents/index.json"), null);
  assert.equal(resolveCapabilityReleaseNotesUrl("https://example.test/catalog.json.txt"), null);
  assert.equal(resolveCapabilityReleaseNotesUrl(null), null);

  // ── Decoration is additive and never destructive ────────────────────────────
  const pending = [update("background", "1.1.0"), update("chess", "1.0.3")];
  assert.deepEqual(
    attachCapabilityReleaseNotes(pending, null),
    pending,
    "No notes document leaves the update list exactly as it was",
  );
  assert.deepEqual(
    attachCapabilityReleaseNotes(pending, { schemaVersion: 1, packages: {} }),
    pending,
    "An empty notes document leaves the update list exactly as it was",
  );

  const decorated = attachCapabilityReleaseNotes(pending, {
    schemaVersion: 1,
    packages: {
      background: {
        versions: [
          { version: "1.1.0", date: "2026-09-01", notes: "Handles flashbacks.", highlight: true },
          { version: "1.0.0", date: "2026-08-01", notes: "First release.", highlight: false },
        ],
      },
      // A note for a version nobody is updating TO must not leak onto the update.
      chess: { versions: [{ version: "9.9.9", date: "2026-09-01", notes: "Unrelated.", highlight: true }] },
    },
  });
  assert.deepEqual(
    decorated[0].releaseNotes?.map((note) => note.notes),
    ["Handles flashbacks."],
    "The installed version's own note is not part of the update",
  );
  assert.equal(decorated[0].releaseHighlight, true, "A version's highlight is passed through as published");
  assert.equal(decorated[1].releaseNotes, undefined, "A note above the target version never leaks onto the update");
  assert.equal(decorated[1].releaseHighlight, undefined);

  // ── An update several versions behind carries every version it skips ────────
  const memoryNote = (version: string, highlight = false) => ({
    version,
    date: "2026-09-01",
    notes: `Notes for ${version}.`,
    highlight,
  });
  const [skipped] = attachCapabilityReleaseNotes([update("memory", "1.4.28", "1.4.24")], {
    schemaVersion: 1,
    packages: {
      memory: {
        versions: [
          // Deliberately unordered: the range and its order are imposed here, not trusted from the document.
          memoryNote("1.4.26", true),
          memoryNote("1.4.9"), // below the installed 1.4.24 — only a text sort would let it through
          memoryNote("1.4.28"),
          memoryNote("1.4.24"), // the installed version itself
          memoryNote("1.4.29"), // newer than the target
          memoryNote("1.4.25"),
          memoryNote("1.4.28-rc.1"), // a prerelease of the target sorts just below it
          memoryNote("1.4.27"),
        ],
      },
    },
  });
  assert.deepEqual(
    skipped.releaseNotes?.map((note) => note.version),
    ["1.4.28", "1.4.28-rc.1", "1.4.27", "1.4.26", "1.4.25"],
    "Every version above the installed one up to the target is listed, newest first",
  );
  assert.equal(
    skipped.releaseHighlight,
    true,
    "A notable change in a skipped version marks the update even when the newest release is routine",
  );

  const routine = update("memory", "1.4.28", "1.4.24");
  const [routineResult] = attachCapabilityReleaseNotes([routine], {
    schemaVersion: 1,
    packages: { memory: { versions: [memoryNote("1.4.27"), memoryNote("1.4.28")] } },
  });
  assert.equal(routineResult.releaseHighlight, false, "No notable version in range leaves the dot off");

  // Notes exist for the package, but none falls in this update's range: byte-identical, as with no document.
  const outOfRange = update("maps", "2.0.1", "2.0.0");
  assert.deepEqual(
    attachCapabilityReleaseNotes([outOfRange], {
      schemaVersion: 1,
      packages: { maps: { versions: [memoryNote("1.9.0"), memoryNote("2.0.0"), memoryNote("2.0.2")] } },
    }),
    [outOfRange],
    "Notes that all fall outside the update's range leave the update exactly as it was",
  );

  // ── Fetch degradation ───────────────────────────────────────────────────────
  const notesUrl = resolveCapabilityReleaseNotesUrl(`${AGENTS_ROOT}/staging/catalog/v2/catalog.json`);
  assert.ok(notesUrl);

  const served = (respond: () => Response) => {
    let calls = 0;
    const fetchNotes = (async () => {
      calls += 1;
      return respond();
    }) as unknown as Parameters<typeof capabilityPackageManager.releaseNotes>[1];
    return { fetchNotes, calls: () => calls };
  };

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes("background", served(notFound).fetchNotes),
    [],
    "An absent sidecar is the normal steady state and must not throw",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() => {
        // The fetch itself rejecting — DNS failure, refused connection, timeout —
        // is a different path from any HTTP status and must not surface as a
        // failed update prompt.
        throw new Error("network unavailable");
      }).fetchNotes,
    ),
    [],
    "An unreachable sidecar degrades to no notes",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() => new Response("upstream is down", { status: 500, headers: { "content-type": "text/plain" } }))
        .fetchNotes,
    ),
    [],
    "A server error is not a 404 and still degrades to no notes",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() => new Response("{not json", { status: 200, headers: { "content-type": "application/json" } }))
        .fetchNotes,
    ),
    [],
    "A malformed sidecar degrades to no notes",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() =>
        ok({
          schemaVersion: 1,
          packages: {
            background: {
              // Over the published per-note cap: rejected as a document rather than
              // silently truncated into a modal.
              versions: [{ version: "1.1.0", date: "2026-09-01", notes: "x".repeat(1001), highlight: false }],
            },
          },
        }),
      ).fetchNotes,
    ),
    [],
    "A note over the shared cap fails the whole document instead of being truncated",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() =>
        ok({
          schemaVersion: 1,
          packages: {
            // Shape-valid but not a real day. A plain regex would let this reach
            // the history sheet as a date that does not exist.
            background: { versions: [{ version: "1.1.0", date: "2026-02-30", notes: "Impossible." }] },
          },
        }),
      ).fetchNotes,
    ),
    [],
    "A calendar date that does not exist fails the document",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() =>
        ok({
          schemaVersion: 1,
          packages: {
            // The update prompt takes the first match and the history sheet shows
            // every one, so a repeat would make the two surfaces disagree.
            background: {
              versions: [
                { version: "1.1.0", date: "2026-09-01", notes: "One." },
                { version: "1.1.0", date: "2026-09-02", notes: "Two." },
              ],
            },
          },
        }),
      ).fetchNotes,
    ),
    [],
    "A version listed twice fails the document",
  );

  resetCapabilityReleaseNotesCache();
  const unordered = await capabilityPackageManager.releaseNotes(
    "background",
    served(() =>
      ok({
        schemaVersion: 1,
        packages: {
          background: {
            versions: [
              { version: "1.0.0", date: "2026-08-01", notes: "First release." },
              { version: "1.10.0", date: "2026-09-01", notes: "Tenth minor." },
              { version: "1.2.0", date: "2026-08-15", notes: "Second minor." },
            ],
          },
        },
      }),
    ).fetchNotes,
  );
  assert.deepEqual(
    unordered.map((note) => note.version),
    ["1.10.0", "1.2.0", "1.0.0"],
    "Order is imposed by version, not trusted from the document and not sorted as text",
  );

  resetCapabilityReleaseNotesCache();
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes(
      "background",
      served(() =>
        ok({
          schemaVersion: 1,
          packages: {
            // Beyond Number.MAX_SAFE_INTEGER these two components compare equal
            // through the shared numeric comparator, so newest-first ordering
            // would silently stop holding. The schema refuses them instead.
            background: {
              versions: [
                { version: "9007199254740993.0.0", date: "2026-09-02", notes: "Newer." },
                { version: "9007199254740992.0.0", date: "2026-09-01", notes: "Older." },
              ],
            },
          },
        }),
      ).fetchNotes,
    ),
    [],
    "Version components too large to order exactly fail the document",
  );

  // Same precondition, one level down: the comparator turns numeric prerelease
  // identifiers into Numbers too, so a non-canonical or oversized identifier
  // breaks ordering just as quietly.
  for (const version of [
    "1.0.0-01",
    "1.0.0-1.007",
    "1.0.0-9007199254740993",
    "1.0.0-1.9007199254740993",
    // Ten digits, still under Number.MAX_SAFE_INTEGER: pins the nine-digit bound
    // itself rather than only the safe-integer limit behind it.
    "1.0.0-1000000000",
    // Leading zeros in a core component: equal to 1.2.3 numerically, different as
    // a string, so ordering and lookup would disagree.
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "0100000000.0.0",
  ]) {
    resetCapabilityReleaseNotesCache();
    assert.deepEqual(
      await capabilityPackageManager.releaseNotes(
        "background",
        served(() =>
          ok({
            schemaVersion: 1,
            packages: { background: { versions: [{ version, date: "2026-09-01", notes: "Prerelease." }] } },
          }),
        ).fetchNotes,
      ),
      [],
      `A non-canonical or oversized prerelease identifier fails the document: ${version}`,
    );
  }

  // Canonical prereleases still work: the bound must not cost real releases.
  for (const version of [
    "1.0.0-rc.1",
    "1.0.0-0",
    "1.0.0-alpha.10",
    "1.0.0-1",
    // The largest values the bound allows, so tightening it further fails here.
    "1.0.0-999999999",
    "999999999.999999999.999999999",
    "0.0.0",
  ]) {
    resetCapabilityReleaseNotesCache();
    const accepted = await capabilityPackageManager.releaseNotes(
      "background",
      served(() =>
        ok({
          schemaVersion: 1,
          packages: { background: { versions: [{ version, date: "2026-09-01", notes: "Prerelease." }] } },
        }),
      ).fetchNotes,
    );
    assert.equal(accepted.length, 1, `A canonical prerelease is accepted: ${version}`);
  }

  resetCapabilityReleaseNotesCache();
  const good = served(() =>
    ok({
      schemaVersion: 1,
      packages: {
        background: { versions: [{ version: "1.1.0", date: "2026-09-01", notes: "Handles flashbacks." }] },
      },
    }),
  );
  const notes = await capabilityPackageManager.releaseNotes("background", good.fetchNotes);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].highlight, false, "highlight defaults to false when the publisher omits it");
  // Second read inside the TTL is served from cache: the prompt and the catalog
  // detail sheet must not each pay for their own request. The first read costs
  // more than one request on a staging Engine, which also reads the preview
  // overlay's own sidecar — what matters is that the second read costs none.
  const afterFirstRead = good.calls();
  await capabilityPackageManager.releaseNotes("background", good.fetchNotes);
  assert.equal(good.calls(), afterFirstRead, "The notes document is fetched once per TTL, not once per consumer");
  assert.deepEqual(
    await capabilityPackageManager.releaseNotes("not-installed", good.fetchNotes),
    [],
    "A package the sidecar does not mention has no notes",
  );

  resetCapabilityReleaseNotesCache();
  console.info("Capability release-notes regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

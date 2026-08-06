import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanTrackerCardColorConfig } from "../../packages/client/src/lib/tracker-card-colors.js";

const legacyTrackerColors = {
  mode: "custom",
  nameColorOpacity: "41.6",
  boxColorOpacity: 80,
  tintIntensity: 50,
  portraitFocusY: 999,
  portraitZoom: "5",
};
assert.deepEqual(cleanTrackerCardColorConfig(JSON.stringify(legacyTrackerColors)), {
  mode: "custom",
  nameColorOpacity: 42,
  boxColorOpacity: 40,
  portraitFocusY: 140,
  portraitZoom: 2.35,
});
assert.deepEqual(
  cleanTrackerCardColorConfig(legacyTrackerColors),
  cleanTrackerCardColorConfig(JSON.stringify(legacyTrackerColors)),
  "decoded and serialized tracker colors must share one normalization path",
);
assert.deepEqual(cleanTrackerCardColorConfig("{bad"), { mode: "chat" });

// ── Bounded PersonaEditor read/write boundary guard ──
// The editor must hydrate from the shared decoded Persona (no private
// serialized-row adapter, no JSON.parse of raw row fields) and must keep the
// Part 2 PATCH/storage boundary serialized. These source-level assertions fail
// fast if the stale serialized-row read adapter is reintroduced or the write
// boundary stops serializing JSON-backed values.
const personaEditorSource = readFileSync(
  new URL("../../packages/client/src/components/personas/PersonaEditor.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  /allPersonas\s+as\s+PersonaRow/.test(personaEditorSource),
  false,
  "PersonaEditor must not cast the decoded usePersonas list to PersonaRow[]",
);
assert.equal(
  /JSON\.parse\(\s*rawPersona\./.test(personaEditorSource),
  false,
  "PersonaEditor must hydrate from decoded Persona values instead of JSON.parse on raw row fields",
);
assert.match(personaEditorSource, /personaStats:\s*rawPersona\.personaStats\s*\?\?\s*null/);
assert.match(personaEditorSource, /tags:\s*rawPersona\.tags\s*\?\?\s*\[\]/);
assert.match(personaEditorSource, /savedStatusOptions:\s*rawPersona\.savedStatusOptions\s*\?\?\s*\[\]/);
assert.match(personaEditorSource, /convoBehavior:\s*rawPersona\.convoBehavior\s*\?\?\s*null/);
assert.match(personaEditorSource, /tags:\s*JSON\.stringify\(tags\)/);
assert.match(personaEditorSource, /personaStats:\s*personaStats\s*\?\s*JSON\.stringify\(personaStats\)\s*:\s*""/);
assert.match(personaEditorSource, /savedStatusOptions:\s*JSON\.stringify\(savedStatusOptions\)/);
assert.match(personaEditorSource, /avatarCrop:\s*avatarCrop\s*\?\s*JSON\.stringify\(avatarCrop\)\s*:\s*""/);
assert.match(
  personaEditorSource,
  /convoBehavior:\s*convoBehavior\s*&&\s*convoBehavior\.instruction\?\.trim\(\)\s*\?\s*JSON\.stringify\(convoBehavior\)\s*:\s*""/,
);

const dataDir = mkdtempSync(join(tmpdir(), "marinara-persona-decoded-reads-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{
    statusCode: number;
    json(): unknown;
  }>;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";

  const [{ buildApp }, { getDB }, { personas }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/db/schema/index.js"),
  ]);

  app = await buildApp();
  await app.ready();
  const db = await getDB();

  async function requestJson(method: string, url: string, payload?: unknown) {
    const response = await app!.inject({
      method,
      url,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(response.statusCode, 200, `${method} ${url}`);
    return response.json() as Record<string, unknown>;
  }

  function assertDecodedPersona(value: Record<string, unknown>, expectedId?: string) {
    if (expectedId) assert.equal(value.id, expectedId);
    assert.equal(typeof value.isActive, "boolean");
    assert.equal(Array.isArray(value.tags), true);
    assert.equal(Array.isArray(value.savedStatusOptions), true);
    assert.equal(value.avatarCrop === null || (typeof value.avatarCrop === "object" && !Array.isArray(value.avatarCrop)), true);
    assert.equal(
      value.personaStats == null || (typeof value.personaStats === "object" && !Array.isArray(value.personaStats)),
      true,
    );
    assert.equal(
      value.convoBehavior == null || (typeof value.convoBehavior === "object" && !Array.isArray(value.convoBehavior)),
      true,
    );
    assert.equal(
      value.trackerCardColors !== null &&
        typeof value.trackerCardColors === "object" &&
        !Array.isArray(value.trackerCardColors),
      true,
    );
  }

  /** Exact valid decoded fixture values for the seeded "decoded-read-active" persona. */
  function assertExactActivePersona(value: Record<string, unknown>) {
    assert.equal(value.isActive, true);
    assert.deepEqual(value.avatarCrop, { srcX: 0.1, srcY: 0.2, srcWidth: 0.5, srcHeight: 0.5 });
    assert.deepEqual(value.trackerCardColors, { mode: "custom", nameColorOpacity: 42 });
    assert.deepEqual(value.personaStats, {
      enabled: true,
      bars: [{ name: "Energy", value: 4, max: 10, color: "#0c0" }],
    });
    assert.deepEqual(value.tags, ["decoded"]);
    assert.deepEqual(value.savedStatusOptions, ["Available"]);
    assert.deepEqual(value.convoBehavior, {
      instruction: "Stay in character.",
      insertionStrategy: "constant_after",
    });
  }

  const activeId = "decoded-read-active";
  const malformedId = "decoded-read-malformed";
  const timestamps = {
    createdAt: "2099-01-01T00:00:00.000Z",
    updatedAt: "2099-01-02T00:00:00.000Z",
  };
  await db.insert(personas).values([
    {
      id: activeId,
      name: "Active Persona",
      avatarCrop: JSON.stringify({ srcX: 0.1, srcY: 0.2, srcWidth: 0.5, srcHeight: 0.5 }),
      isActive: "true",
      trackerCardColors: JSON.stringify({ mode: "custom", nameColorOpacity: 42 }),
      personaStats: JSON.stringify({
        enabled: true,
        bars: [{ name: "Energy", value: 4, max: 10, color: "#0c0" }],
      }),
      tags: JSON.stringify(["decoded"]),
      savedStatusOptions: JSON.stringify(["Available"]),
      convoBehavior: JSON.stringify({ instruction: "Stay in character.", insertionStrategy: "constant_after" }),
      ...timestamps,
    },
    {
      id: malformedId,
      name: "Malformed Persona",
      avatarCrop: "{bad",
      isActive: "false",
      trackerCardColors: "{bad",
      personaStats: "{bad",
      tags: "{bad",
      savedStatusOptions: "{bad",
      convoBehavior: "{bad",
      ...timestamps,
    },
  ]);

  const list = (await requestJson("GET", "/api/characters/personas/list")) as unknown as Array<Record<string, unknown>>;
  const listedActive = list.find((persona) => persona.id === activeId)!;
  assertDecodedPersona(listedActive, activeId);
  assertExactActivePersona(listedActive);
  const malformed = list.find((persona) => persona.id === malformedId)!;
  assertDecodedPersona(malformed, malformedId);
  assert.equal(malformed.avatarCrop, null);
  assert.deepEqual(malformed.tags, []);
  assert.deepEqual(malformed.trackerCardColors, { mode: "chat" });

  const page = await requestJson("GET", "/api/characters/personas/list?limit=100");
  const pageActive = (page.items as Array<Record<string, unknown>>).find((persona) => persona.id === activeId)!;
  assertDecodedPersona(pageActive, activeId);

  const detail = await requestJson("GET", `/api/characters/personas/${activeId}`);
  assertDecodedPersona(detail, activeId);

  const activeEndpointPersona = await requestJson("GET", "/api/characters/personas/active");
  assertDecodedPersona(activeEndpointPersona, activeId);

  const created = await requestJson("POST", "/api/characters/personas", {
    name: "Serialized Writer",
    tags: JSON.stringify(["created"]),
  });
  assertDecodedPersona(created);
  assert.deepEqual(created.tags, ["created"]);

  const createdId = created.id as string;
  const updated = await requestJson("PATCH", `/api/characters/personas/${createdId}`, {
    tags: JSON.stringify(["updated"]),
  });
  assertDecodedPersona(updated, createdId);
  assert.deepEqual(updated.tags, ["updated"]);

  const painted = await requestJson("PATCH", `/api/characters/personas/${createdId}/tracker-card-colors`, {
    paint: { mode: "custom", nameColor: "#c00" },
  });
  assertDecodedPersona(painted, createdId);
  assert.deepEqual(painted.trackerCardColors, { mode: "custom", nameColor: "#c00" });

  const duplicate = await requestJson("POST", `/api/characters/personas/${activeId}/duplicate`, {});
  assertDecodedPersona(duplicate);
  assert.equal(duplicate.isActive, false);

  const versions = (await requestJson("GET", `/api/characters/personas/${createdId}/versions`)) as unknown as Array<
    Record<string, unknown>
  >;
  const restorableVersion = versions.find((version) => !String(version.id).startsWith("current:"));
  assert.ok(restorableVersion, "updating a Persona must create a restorable version");
  const restored = await requestJson(
    "POST",
    `/api/characters/personas/${createdId}/versions/${encodeURIComponent(restorableVersion.id as string)}/restore`,
    {},
  );
  assertDecodedPersona(restored, createdId);
  const reset = await requestJson("POST", `/api/characters/personas/${createdId}/versions/reset`, {});
  assertDecodedPersona(reset, createdId);

  const onePixelPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const avatar = await requestJson("POST", `/api/characters/personas/${activeId}/avatar`, {
    avatar: onePixelPng,
  });
  assertDecodedPersona(avatar, activeId);
} finally {
  await app?.close();
  for (const [key, previous] of [
    ["DATA_DIR", previousDataDir],
    ["FILE_STORAGE_DIR", previousFileStorageDir],
  ] as const) {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Persona API decoded-read regression passed.");

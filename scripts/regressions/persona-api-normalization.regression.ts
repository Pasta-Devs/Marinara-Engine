import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { personaCreateInputSchema } from "../../packages/shared/src/schemas/persona.schema.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-persona-api-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const previousMarinaraFileStorageDir = process.env.MARINARA_FILE_STORAGE_DIR;

const inactivePersonaId = "persona-api-inactive";
const legacyAvatarCropPersonaId = "persona-api-legacy-avatar-crop";
const missingPersonaId = "persona-api-missing";
const serializedLegacyAvatarCrop = { zoom: 1.5, offsetX: 10, offsetY: -5, fullImage: true };
const serializedTrackerCardColors = {
  mode: "custom",
  nameColor: "#c00",
  nameColorOpacity: "41.6",
  glowIntensity: "Infinity",
  portraitFocusY: "121.4",
  portraitZoom: "1.237",
  statIcons: [
    { name: "Health", occurrence: 0, icon: "HeartPulse" },
    { name: "Hidden", occurrence: 0, icon: null },
  ],
};
const validTrackerCardColors = {
  mode: "custom",
  nameColor: "#c00",
  nameColorOpacity: 42,
  portraitFocusY: 121,
  portraitZoom: 1.24,
  statIcons: [
    { name: "Health", occurrence: 0, icon: "heart-pulse" },
    { name: "Hidden", occurrence: 0, icon: null },
  ],
};
const validPersonaStats = {
  enabled: true,
  bars: [{ name: "Energy", value: 4, max: 10, color: "#0c0" }],
};
let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<any>;
} | null = null;

// Failures still close the app, restore storage overrides, and remove the temp directory.
try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
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

  // Parse response bodies only when assertions need them.
  async function request(method: string, url: string, expectedStatus: number, payload?: Record<string, unknown>) {
    const response = await app!.inject({
      method,
      url,
      ...(payload === undefined ? {} : { payload }),
    });
    const payloadSummary = payload === undefined ? "" : ` with ${Object.keys(payload).join(", ")}`;
    assert.equal(response.statusCode, expectedStatus, `${method} ${url}${payloadSummary}`);
    return response;
  }

  async function requestStatus(method: string, url: string, expectedStatus: number, payload?: Record<string, unknown>) {
    await request(method, url, expectedStatus, payload);
  }

  async function requestJson(method: string, url: string, expectedStatus: number, payload?: Record<string, unknown>) {
    return (await request(method, url, expectedStatus, payload)).json();
  }

  async function rawPersonaRow(id: string) {
    return (await db.select().from(personas)).find((row) => row.id === id)!;
  }

  const baseRawPersona = {
    isActive: "false",
    createdAt: "2099-01-01T00:00:00.000Z",
  };
  await db.insert(personas).values([
    {
      ...baseRawPersona,
      id: inactivePersonaId,
      name: "Existing Persona",
      updatedAt: "2099-01-03T00:00:00.000Z",
    },
    {
      ...baseRawPersona,
      id: legacyAvatarCropPersonaId,
      name: "Legacy avatar crop",
      avatarCrop: JSON.stringify(serializedLegacyAvatarCrop),
      trackerCardColors: JSON.stringify(serializedTrackerCardColors),
      updatedAt: "2098-12-31T00:00:00.000Z",
    },
  ]);

  // Each invalid known-field shape must reject without mutating any part of the raw row.
  const rawInactiveBeforeRejectedPatches = await rawPersonaRow(inactivePersonaId);
  for (const { label, payload, expectedError } of [
    { label: "null persona version", payload: { personaVersion: null } },
    {
      label: "decoded legacy stat icon",
      payload: {
        trackerCardColors: { mode: "custom", statIcons: [{ name: "Health", occurrence: 0, icon: "HeartPulse" }] },
      },
    },
    {
      label: "timestamp metadata",
      payload: { createdAt: "2099-01-01T00:00:00.000Z", updatedAt: "2099-01-01T00:00:00.000Z" },
      expectedError: "Invalid persona update",
    },
    { label: "invalid known plus unknown field", payload: { description: null, ignoredByPersonaApi: "unknown" } },
  ]) {
    const error = await requestJson("PATCH", `/api/characters/personas/${inactivePersonaId}`, 400, payload);
    if (expectedError) assert.equal(error.error, expectedError, label);
  }
  assert.deepEqual(
    await rawPersonaRow(inactivePersonaId),
    rawInactiveBeforeRejectedPatches,
    "rejected Persona PATCH payloads must not mutate the raw row",
  );

  // Plain JSON imports use this same strict create boundary instead of
  // repairing malformed known fields in the client.
  const personaCountBeforeInvalidCreate = (await db.select().from(personas)).length;
  await requestStatus("POST", "/api/characters/personas", 400, {
    name: "Invalid tracker colors",
    trackerCardColors: { mode: "invalid" },
  });
  assert.equal(
    (await db.select().from(personas)).length,
    personaCountBeforeInvalidCreate,
    "an invalid Persona create must not insert a row",
  );

  // Create/import accepts the timestamp overrides that PATCH rejects.
  const decodedPersona = await requestJson("POST", "/api/characters/personas", 200, {
    name: "Decoded Persona",
    trackerCardColors: { mode: "chat" },
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
  });
  assert.deepEqual(decodedPersona.trackerCardColors, { mode: "chat" });
  assert.equal(decodedPersona.createdAt, "2023-11-14T22:13:20.000Z");
  assert.equal(decodedPersona.updatedAt, "2023-11-14T22:13:21.000Z");
  for (const timestamp of [Number.NaN, Infinity, -Infinity]) {
    assert.equal(
      personaCreateInputSchema.safeParse({ name: "Invalid numeric timestamp", createdAt: timestamp }).success,
      false,
      "the strict schema must reject non-finite numeric timestamps",
    );
  }

  const legacyStructured = await requestJson("PATCH", `/api/characters/personas/${decodedPersona.id}`, 200, {
    trackerCardColors: JSON.stringify({
      mode: "custom",
      nameColorOpacity: "41.6",
      statIcons: [{ name: "Health", occurrence: 0, icon: "HeartPulse" }],
    }),
    convoBehavior: JSON.stringify({ instruction: "Legacy fallback", insertionStrategy: "invalid" }),
    avatarCrop: JSON.stringify(serializedLegacyAvatarCrop),
    tags: JSON.stringify(["serialized", "accepted"]),
  });
  assert.equal(legacyStructured.id, decodedPersona.id);
  assert.deepEqual(legacyStructured.trackerCardColors, {
    mode: "custom",
    nameColorOpacity: 42,
    statIcons: [{ name: "Health", occurrence: 0, icon: "heart-pulse" }],
  });
  assert.deepEqual(legacyStructured.convoBehavior, {
    instruction: "Legacy fallback",
    insertionStrategy: "constant_after",
  });
  assert.deepEqual(legacyStructured.avatarCrop, serializedLegacyAvatarCrop, "serialized legacy crop must decode");
  const rawDecodedPersona = await rawPersonaRow(decodedPersona.id);
  assert.equal(rawDecodedPersona.trackerCardColors, JSON.stringify(legacyStructured.trackerCardColors));
  assert.equal(
    rawDecodedPersona.convoBehavior,
    JSON.stringify({ instruction: "Legacy fallback", insertionStrategy: "constant_after" }),
  );
  assert.equal(rawDecodedPersona.avatarCrop, JSON.stringify(serializedLegacyAvatarCrop));
  assert.equal(rawDecodedPersona.tags, JSON.stringify(["serialized", "accepted"]));

  const statIconsClearPatch = await requestJson("PATCH", `/api/characters/personas/${decodedPersona.id}`, 200, {
    trackerCardColors: { mode: "custom", statIcons: [] },
  });
  assert.deepEqual(statIconsClearPatch.trackerCardColors.statIcons, []);
  const rawStatIconsClearedPersona = await rawPersonaRow(decodedPersona.id);
  assert.deepEqual(JSON.parse(rawStatIconsClearedPersona.trackerCardColors).statIcons, []);

  // Compatible export canonicalizes structured fields through the projector so
  // the export is strict-reimportable, while preserving unknown extension metadata.
  const compatibleExport = await requestJson(
    "GET",
    `/api/characters/personas/${legacyAvatarCropPersonaId}/export?format=compatible`,
    200,
  );
  assert.equal(compatibleExport.avatarCrop, JSON.stringify(serializedLegacyAvatarCrop));
  assert.deepEqual(
    JSON.parse(compatibleExport.trackerCardColors),
    validTrackerCardColors,
    "compatible export must canonicalize structured fields for strict reimport compatibility",
  );

  // Compatible import canonicalizes legacy fields in both response and storage.
  const compatibleImport = await requestJson("POST", "/api/characters/personas", 200, {
    name: "Compatible crop import",
    avatarCrop: JSON.stringify(serializedLegacyAvatarCrop),
    trackerCardColors: JSON.stringify({
      mode: "custom",
      statIcons: [{ name: "Health", occurrence: 0, icon: "HeartPulse" }],
    }),
  });
  assert.deepEqual(compatibleImport.avatarCrop, serializedLegacyAvatarCrop);
  assert.deepEqual(compatibleImport.trackerCardColors.statIcons, [
    { name: "Health", occurrence: 0, icon: "heart-pulse" },
  ]);
  const rawCompatibleImport = await rawPersonaRow(compatibleImport.id);
  assert.equal(rawCompatibleImport.avatarCrop, JSON.stringify(serializedLegacyAvatarCrop));
  assert.deepEqual(
    JSON.parse(rawCompatibleImport.trackerCardColors).statIcons,
    [{ name: "Health", occurrence: 0, icon: "heart-pulse" }],
    "the compatible import must store the canonicalized icon",
  );

  const rawBeforeUnknownIconPatch = await rawPersonaRow(decodedPersona.id);
  await requestStatus("PATCH", `/api/characters/personas/${decodedPersona.id}`, 400, {
    trackerCardColors: JSON.stringify({
      mode: "custom",
      statIcons: [{ name: "Health", occurrence: 0, icon: "not-a-real-icon" }],
    }),
  });
  assert.deepEqual(
    await rawPersonaRow(decodedPersona.id),
    rawBeforeUnknownIconPatch,
    "an unknown serialized stat icon must be rejected without mutating the row",
  );

  // An unknown-only PATCH is a projected no-op and must not advance updatedAt.
  const rawInactiveBeforeUnknownPatch = await rawPersonaRow(inactivePersonaId);
  const inactiveDetailBeforeUnknownPatch = await requestJson(
    "GET",
    `/api/characters/personas/${inactivePersonaId}`,
    200,
  );
  const unknownPatch = await requestJson("PATCH", `/api/characters/personas/${inactivePersonaId}`, 200, {
    ignoredByPersonaApi: "unknown",
  });
  assert.equal("ignoredByPersonaApi" in unknownPatch, false);
  assert.deepEqual(
    unknownPatch,
    inactiveDetailBeforeUnknownPatch,
    "an unknown-only PATCH must return the unchanged projected Persona",
  );
  const rawInactiveAfterUnknownPatch = await rawPersonaRow(inactivePersonaId);
  assert.deepEqual(
    rawInactiveAfterUnknownPatch,
    rawInactiveBeforeUnknownPatch,
    "an unknown-only PATCH must not mutate the raw Persona row, including updatedAt",
  );

  await requestStatus("PATCH", `/api/characters/personas/${missingPersonaId}`, 404, { ignoredByPersonaApi: "unknown" });

  // Native imports explicitly map and canonicalize every historical structured field.
  const nativeLegacyImport = await requestJson("POST", "/api/import/marinara", 200, {
    type: "marinara_persona",
    version: 1,
    data: {
      name: "Native legacy canonicalization",
      phoneticName: "Nat-iv Foh-net-ik",
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      avatarCrop: JSON.stringify(serializedLegacyAvatarCrop),
      trackerCardColors: JSON.stringify({ mode: "custom", nameColorOpacity: "41.6" }),
      personaStats: JSON.stringify(validPersonaStats),
      tags: JSON.stringify(["legacy", "decoded"]),
      savedStatusOptions: JSON.stringify(["Available"]),
      convoBehavior: JSON.stringify({ instruction: "Legacy import", insertionStrategy: "invalid" }),
    },
  });
  assert.equal(nativeLegacyImport.success, true, "a valid historical native Persona export must import");
  const nativeLegacyRow = await rawPersonaRow(nativeLegacyImport.id);
  assert.equal(nativeLegacyRow.phoneticName, "Nat-iv Foh-net-ik");
  assert.equal(nativeLegacyRow.createdAt, "2023-11-14T22:13:20.000Z");
  assert.equal(nativeLegacyRow.updatedAt, "2023-11-14T22:13:21.000Z");
  assert.equal(nativeLegacyRow.avatarCrop, JSON.stringify(serializedLegacyAvatarCrop));
  assert.equal(nativeLegacyRow.trackerCardColors, JSON.stringify({ mode: "custom", nameColorOpacity: 42 }));
  assert.equal(nativeLegacyRow.personaStats, JSON.stringify(validPersonaStats));
  assert.equal(nativeLegacyRow.tags, JSON.stringify(["legacy", "decoded"]));
  assert.equal(nativeLegacyRow.savedStatusOptions, JSON.stringify(["Available"]));
  assert.equal(
    nativeLegacyRow.convoBehavior,
    JSON.stringify({ instruction: "Legacy import", insertionStrategy: "constant_after" }),
  );
  const nativeLegacyProjected = await requestJson("GET", `/api/characters/personas/${nativeLegacyImport.id}`, 200);
  assert.equal(nativeLegacyProjected.phoneticName, "Nat-iv Foh-net-ik");
  assert.deepEqual(nativeLegacyProjected.trackerCardColors, { mode: "custom", nameColorOpacity: 42 });
  assert.deepEqual(nativeLegacyProjected.tags, ["legacy", "decoded"]);

  const nonObjectNativeImport = await requestJson("POST", "/api/import/marinara", 200, {
    type: "marinara_persona",
    version: 1,
    data: "not a Persona object",
  });
  assert.equal(nonObjectNativeImport.success, false, "a non-object native Persona payload may still fail");

  // #7053: export -> import must round-trip the image-appearance override. The
  // native importer builds its payload from an explicit field allow-list, so a
  // field missing from it is dropped silently even though the export carried it.
  const overrideText = "1boy, caucasian, tall male, muscular, black hair, green eyes";
  const nativeOverrideImport = await requestJson("POST", "/api/import/marinara", 200, {
    type: "marinara_persona",
    version: 1,
    data: {
      name: "Native override round-trip",
      appearance: "Prose appearance that image models should not receive.",
      imageAppearanceEnabled: true,
      imageAppearance: overrideText,
    },
  });
  assert.equal(nativeOverrideImport.success, true, "a Persona export carrying the override must import");
  const nativeOverrideRow = await rawPersonaRow(nativeOverrideImport.id);
  assert.equal(
    nativeOverrideRow.imageAppearanceEnabled,
    "true",
    "the persona override toggle must survive export -> import",
  );
  assert.equal(nativeOverrideRow.imageAppearance, overrideText, "the persona override text must survive export -> import");
  assert.equal(nativeOverrideRow.appearance, "Prose appearance that image models should not receive.");

  // Exports from before this feature carry neither field; those must still import
  // and land on the documented disabled/empty defaults.
  const nativeNoOverrideImport = await requestJson("POST", "/api/import/marinara", 200, {
    type: "marinara_persona",
    version: 1,
    data: { name: "Native without override", appearance: "Older export prose." },
  });
  const nativeNoOverrideRow = await rawPersonaRow(nativeNoOverrideImport.id);
  assert.equal(nativeNoOverrideRow.imageAppearanceEnabled, "false", "an older export imports as override-disabled");
  assert.equal(nativeNoOverrideRow.imageAppearance, "", "an older export imports with no override text");

  // ── F6: specialized tracker writes validate recognized fields through the shared contract. ──

  const rawBeforeRejectedTrackerWrites = await rawPersonaRow(decodedPersona.id);
  for (const payload of [
    { paint: { statIcons: [{ name: "Health", occurrence: 0, icon: "not-a-real-icon" }] } },
    { portrait: { portraitFocusX: "50", portraitFocusY: 60, portraitZoom: 1 } },
    { paint: { mode: "chat" }, portrait: { portraitFocusX: 50, portraitFocusY: 60, portraitZoom: 1 } },
  ])
    await requestStatus("PATCH", `/api/characters/personas/${decodedPersona.id}/tracker-card-colors`, 400, payload);
  assert.deepEqual(
    await rawPersonaRow(decodedPersona.id),
    rawBeforeRejectedTrackerWrites,
    "invalid tracker paint, portrait, or mixed writes must not mutate the raw Persona row",
  );

  const trackerPaint = await requestJson(
    "PATCH",
    `/api/characters/personas/${decodedPersona.id}/tracker-card-colors`,
    200,
    {
      paint: {
        mode: "custom",
        nameColor: "#c00",
        nameColorOpacity: 41.6,
        glowIntensity: 7,
        unknownExtensionKey: { keep: "me" },
      },
    },
  );
  assert.equal(trackerPaint.id, decodedPersona.id);
  assert.equal(trackerPaint.trackerCardColors.mode, "custom");
  assert.equal(
    trackerPaint.trackerCardColors.nameColorOpacity,
    42,
    "recognized tracker numerics must be clamped into the contract range before storage",
  );
  assert.equal(trackerPaint.trackerCardColors.glowIntensity, 7);
  assert.deepEqual(
    trackerPaint.trackerCardColors.unknownExtensionKey,
    { keep: "me" },
    "unknown tracker extension keys must survive the specialized write",
  );
  assert.deepEqual(
    JSON.parse((await rawPersonaRow(decodedPersona.id)).trackerCardColors),
    trackerPaint.trackerCardColors,
    "the specialized tracker write must persist exactly what projection returns",
  );

  const trackerPaintWithoutExtensions = await requestJson(
    "PATCH",
    `/api/characters/personas/${decodedPersona.id}/tracker-card-colors`,
    200,
    { paint: { nameColorOpacity: 55 } },
  );
  assert.equal(trackerPaintWithoutExtensions.trackerCardColors.mode, "chat");
  assert.deepEqual(
    trackerPaintWithoutExtensions.trackerCardColors.unknownExtensionKey,
    { keep: "me" },
    "a later paint update must retain existing extension keys",
  );

  const trackerPortraitOverpost = await requestJson(
    "PATCH",
    `/api/characters/personas/${decodedPersona.id}/tracker-card-colors`,
    200,
    {
      portrait: {
        portraitFocusX: 50,
        portraitFocusY: 60,
        portraitZoom: 1,
        mode: "default",
        statIcons: [{ name: "Health", occurrence: 0, icon: "heart-pulse" }],
        unknownExtensionKey: null,
      },
    },
  );
  assert.equal(trackerPortraitOverpost.trackerCardColors.mode, "chat");
  assert.deepEqual(trackerPortraitOverpost.trackerCardColors.statIcons, []);
  assert.deepEqual(
    trackerPortraitOverpost.trackerCardColors.unknownExtensionKey,
    { keep: "me" },
    "portrait writes must ignore non-portrait fields",
  );

  const trackerPortrait = await requestJson(
    "PATCH",
    `/api/characters/personas/${decodedPersona.id}/tracker-card-colors`,
    200,
    {
      portrait: { portraitFocusX: 200, portraitFocusY: 500, portraitZoom: 5 },
    },
  );
  assert.deepEqual(
    {
      portraitFocusX: trackerPortrait.trackerCardColors.portraitFocusX,
      portraitFocusY: trackerPortrait.trackerCardColors.portraitFocusY,
      portraitZoom: trackerPortrait.trackerCardColors.portraitZoom,
    },
    { portraitFocusX: 100, portraitFocusY: 140, portraitZoom: 2.35 },
    "portrait values must clamp to their contract maxima",
  );
  assert.deepEqual(
    JSON.parse((await rawPersonaRow(decodedPersona.id)).trackerCardColors),
    trackerPortrait.trackerCardColors,
    "the clamped portrait must be what is stored and projected",
  );
  assert.equal(trackerPortrait.id, decodedPersona.id);

  // ── R2b: Legacy malformed Persona self-export round-trip ───────────────────

  // Insert a raw row with over-max pools (tolerated by projection but rejected
  // by the strict create schema) so the export path must canonicalize it.
  const legacyExportId = "persona-legacy-export";
  await db.insert(personas).values([
    {
      ...baseRawPersona,
      id: legacyExportId,
      name: "Legacy Export Row",
      // #7053: the image-appearance toggle is a TEXT column in storage but a
      // BOOLEAN in the public export contract. The export path spreads the raw
      // row, so this is the regression that catches "true"/"false" leaking into
      // a payload the strict create schema then rejects.
      imageAppearanceEnabled: "true",
      imageAppearance: "1girl, silver hair, green eyes",
      personaStats: JSON.stringify({
        enabled: true,
        bars: [{ name: "Energy", value: 4, max: 10, color: "#0c0" }],
        rpgStats: {
          enabled: true,
          attributes: [{ name: "STR", value: 10 }],
          hp: { value: 100, max: 100 },
          pools: [{ name: "HP", value: 150, max: 100, color: "#f00" }],
        },
      }),
      updatedAt: "2099-01-04T00:00:00.000Z",
    },
  ]);

  // Native export canonicalizes the row so re-import succeeds.
  const nativeExportLegacy = await requestJson("GET", `/api/characters/personas/${legacyExportId}/export`, 200);
  assert.equal(
    nativeExportLegacy.data.imageAppearanceEnabled,
    true,
    "the native export must publish the boolean contract, not the storage text flag",
  );
  assert.equal(nativeExportLegacy.data.imageAppearance, "1girl, silver hair, green eyes");
  const nativeReimportLegacy = await requestJson("POST", "/api/import/marinara", 200, {
    type: "marinara_persona",
    version: 1,
    data: nativeExportLegacy.data,
  });
  assert.equal(nativeReimportLegacy.success, true, "a canonicalized native export must be strict-reimportable");
  assert.ok(nativeReimportLegacy.id, "the reimported persona must have an id");
  const nativeReimportRow = await rawPersonaRow(nativeReimportLegacy.id);
  assert.deepEqual(
    JSON.parse(nativeReimportRow.personaStats).rpgStats.pools[0],
    { name: "HP", value: 100, max: 100, color: "#f00" },
    "the reimported persona must store the canonicalized (clamped) pool",
  );

  // Compatible export also canonicalizes.
  const compatibleExportLegacy = await requestJson(
    "GET",
    `/api/characters/personas/${legacyExportId}/export?format=compatible`,
    200,
  );
  const compatibleReimportLegacy = await requestJson("POST", "/api/characters/personas", 200, {
    name: "Compatible reimport",
    ...compatibleExportLegacy,
  });
  assert.equal(
    compatibleReimportLegacy.imageAppearanceEnabled,
    true,
    "the compatible export must round-trip the enabled toggle as a boolean",
  );
  assert.equal(compatibleReimportLegacy.imageAppearance, "1girl, silver hair, green eyes");
  assert.deepEqual(
    compatibleReimportLegacy.personaStats.rpgStats.pools[0],
    { name: "HP", value: 100, max: 100, color: "#f00" },
    "a canonicalized compatible export must reimport with clamped pools",
  );

  // Unknown extension metadata in trackerCardColors is preserved through export canonicalization.
  const extensionExportId = "persona-extension-export";
  await db.insert(personas).values([
    {
      ...baseRawPersona,
      id: extensionExportId,
      name: "Extension Export Row",
      trackerCardColors: JSON.stringify({
        mode: "custom",
        nameColor: "#c00",
        unknownExtensionKey: { keep: "me" },
      }),
      updatedAt: "2099-01-05T00:00:00.000Z",
    },
  ]);
  const extensionExport = await requestJson("GET", `/api/characters/personas/${extensionExportId}/export`, 200);
  const extensionReimport = await requestJson("POST", "/api/import/marinara", 200, {
    type: "marinara_persona",
    version: 1,
    data: extensionExport.data,
  });
  assert.equal(extensionReimport.success, true, "export with unknown extension must reimport");
  const extensionReimportRow = await rawPersonaRow(extensionReimport.id);
  assert.deepEqual(
    JSON.parse(extensionReimportRow.trackerCardColors).unknownExtensionKey,
    { keep: "me" },
    "unknown extension metadata must survive export canonicalization",
  );

  // ── R2b: Recoverable Persona self-export normalization ───────────────────

  const blankNameExportId = "persona-blank-name-export";
  await db.insert(personas).values([
    {
      ...baseRawPersona,
      id: blankNameExportId,
      name: "   ",
      trackerCardColors: JSON.stringify({
        mode: "custom",
        dialogueColor: "#0c0",
        unknownExtensionKey: { keep: "me" },
      }),
      updatedAt: "2099-01-07T00:00:00.000Z",
    },
  ]);
  const rawBlankNameBeforeExports = await rawPersonaRow(blankNameExportId);

  // A blank name uses a safe native-copy fallback without mutating the historical stored row.
  const normalizedNativeResponse = await request("GET", `/api/characters/personas/${blankNameExportId}/export`, 200);
  const normalizedNative = normalizedNativeResponse.json();
  assert.equal(normalizedNative.data.name, "Unnamed Persona");
  const normalizedNativeTrackerCardColors = JSON.parse(normalizedNative.data.trackerCardColors);
  assert.equal(normalizedNativeTrackerCardColors.dialogueColor, "#0c0");
  assert.deepEqual(normalizedNativeTrackerCardColors.unknownExtensionKey, { keep: "me" });
  assert.match(
    String(normalizedNativeResponse.headers["content-disposition"]),
    /unnamed-persona\.marinara\.json/,
    "a blank Persona name must use the safe fallback filename",
  );
  const normalizedNativeReimport = await requestJson("POST", "/api/import/marinara", 200, normalizedNative);
  assert.equal(normalizedNativeReimport.success, true, "the normalized native copy must remain strict-reimportable");
  assert.deepEqual(
    await rawPersonaRow(blankNameExportId),
    rawBlankNameBeforeExports,
    "single native export must not mutate the raw stored Persona row",
  );

  const normalizedCompatible = await requestJson(
    "GET",
    `/api/characters/personas/${blankNameExportId}/export?format=compatible`,
    200,
  );
  assert.equal(normalizedCompatible.name, "Unnamed Persona");
  const normalizedCompatibleTrackerCardColors = JSON.parse(normalizedCompatible.trackerCardColors);
  assert.equal(normalizedCompatibleTrackerCardColors.dialogueColor, "#0c0");
  const normalizedCompatibleReimport = await requestJson("POST", "/api/characters/personas", 200, normalizedCompatible);
  assert.equal(normalizedCompatibleReimport.name, "Unnamed Persona");
  assert.deepEqual(
    await rawPersonaRow(blankNameExportId),
    rawBlankNameBeforeExports,
    "single compatible export must not mutate the raw stored Persona row",
  );

  // A mixed selection remains complete when a Persona needs name normalization.
  const rawLegacyBeforeBulkExport = await rawPersonaRow(legacyExportId);
  const normalizedBulkResponse = await request("POST", "/api/characters/personas/export-bulk", 200, {
    ids: [legacyExportId, blankNameExportId],
    format: "native",
  });
  const normalizedBulk = new AdmZip(Buffer.from(normalizedBulkResponse.rawPayload));
  const normalizedBulkEntries = normalizedBulk.getEntries();
  assert.equal(normalizedBulkEntries.length, 2, "mixed bulk export must include every found Persona");
  assert.ok(
    normalizedBulkEntries.some((entry) => entry.entryName === "unnamed-persona-2.marinara.json"),
    "bulk export must retain the blank-name Persona under a safe fallback name",
  );
  assert.deepEqual(
    await rawPersonaRow(legacyExportId),
    rawLegacyBeforeBulkExport,
    "bulk export must not mutate valid stored Personas",
  );
  assert.deepEqual(
    await rawPersonaRow(blankNameExportId),
    rawBlankNameBeforeExports,
    "bulk export must not mutate normalized stored Personas",
  );

  // ── R3: Validation failures identify the field ──────────────────────────────

  // Strict PATCH rejection includes issues with path+message.
  const poolOverMaxError = await requestJson("PATCH", `/api/characters/personas/${decodedPersona.id}`, 400, {
    personaStats: {
      enabled: true,
      bars: [],
      rpgStats: {
        enabled: true,
        attributes: [],
        hp: { value: 100, max: 100 },
        pools: [{ name: "HP", value: 200, max: 100, color: "#f00" }],
      },
    },
  });
  assert.ok(Array.isArray(poolOverMaxError.issues), "a strict PATCH rejection must include issues");
  const firstPoolIssue = poolOverMaxError.issues[0];
  assert.ok(
    Array.isArray(firstPoolIssue?.path) && firstPoolIssue.path.includes("value"),
    "the first issue must identify the offending pool value path",
  );
  assert.ok(
    typeof firstPoolIssue?.message === "string" && firstPoolIssue.message.length > 0,
    "the first issue must have a message",
  );

} finally {
  await app?.close();
  if (previousFileStorageDir === undefined) {
    delete process.env.FILE_STORAGE_DIR;
  } else {
    process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  }
  if (previousMarinaraFileStorageDir === undefined) {
    delete process.env.MARINARA_FILE_STORAGE_DIR;
  } else {
    process.env.MARINARA_FILE_STORAGE_DIR = previousMarinaraFileStorageDir;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Persona API normalization regression passed.");

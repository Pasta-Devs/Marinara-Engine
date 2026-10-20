// Reported to the maintainer: past 21 image style profiles, Clone renamed the last profile (adding "Custom")
// instead of adding one. Each copy's id was its source's id plus "-custom", ids are cut at 80 characters, and
// two cut ids collided, so the merge by id replaced the older profile. Through the real id helper, normalizer,
// settings route and server loader: every copy is added and distinct, there is no count cap, and 300 profiles
// save and load.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ImageStyleProfile, ImageStyleProfileSettings } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-style-profile-ids-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.MARINARA_FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

type TestApp = {
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): any; body: string }>;
  ready(): Promise<void>;
  db: unknown;
};
let app: TestApp | null = null;

try {
  const {
    DEFAULT_IMAGE_STYLE_PROFILES,
    MAX_APP_SETTINGS_VALUE_LENGTH,
    createImageStyleProfileId,
    findImageStyleProfile,
    normalizeImageStyleProfileSettings,
  } = await import("../../packages/shared/src/index.js");
  const builtInCount = DEFAULT_IMAGE_STYLE_PROFILES.length;

  const summary = (profiles: ImageStyleProfile[]) =>
    profiles.map(({ id, name, styleText, positiveTags, negativeTags }) => ({
      id,
      name,
      styleText,
      positiveTags,
      negativeTags,
    }));

  // What the editor's Clone button does (ImageStyleProfilesEditor.cloneSelected in SettingsPanel.tsx).
  const clone = (settings: ImageStyleProfileSettings, sourceId: string) => {
    const source = settings.profiles.find((profile) => profile.id === sourceId);
    assert.ok(source, `clone source ${sourceId} exists`);
    const id = createImageStyleProfileId(source.id, settings.profiles);
    const copy = { ...source, id, name: `${source.name} Custom`, builtIn: false };
    const next = normalizeImageStyleProfileSettings({
      ...settings,
      profiles: [...settings.profiles, copy],
      defaultProfileId: id,
    });
    assert.equal(next.profiles.length, settings.profiles.length + 1, `cloning ${sourceId} adds a profile`);
    assert.deepEqual(
      summary(next.profiles.slice(0, -1)),
      summary(settings.profiles),
      `cloning ${sourceId} leaves every profile alone`,
    );
    assert.equal(next.profiles.at(-1)?.id, id, "the copy is stored under the id it was given");
    assert.equal(next.defaultProfileId, id, "the copy stays selected instead of falling back to Auto");
    assert.ok(id.length <= 80, `copy id ${id} fits the id limit`);
    return { settings: next, id };
  };
  const assertDistinct = (settings: ImageStyleProfileSettings) =>
    assert.equal(new Set(settings.profiles.map((profile) => profile.id)).size, settings.profiles.length);

  // The reported flow: keep cloning the newest profile, starting from Auto. It used to stop at 21.
  let settings = normalizeImageStyleProfileSettings(null);
  let newestId = "auto";
  for (let copy = 0; copy < 40; copy += 1) ({ settings, id: newestId } = clone(settings, newestId));
  assert.equal(settings.profiles.length, builtInCount + 40);
  assertDistinct(settings);
  assert.ok(
    settings.profiles.every((profile) => profile.id.length < 20),
    "copies of copies keep short ids instead of growing by -custom each time",
  );

  // Cloning the same profile over and over.
  settings = normalizeImageStyleProfileSettings(null);
  for (let copy = 0; copy < 30; copy += 1) ({ settings } = clone(settings, "anime"));
  assert.equal(settings.profiles.length, builtInCount + 30);
  assertDistinct(settings);

  // Create, delete some (the newest among them), then create more: freed ids may be reused, never live ones.
  settings = normalizeImageStyleProfileSettings(null);
  newestId = "danbooru";
  for (let copy = 0; copy < 35; copy += 1) ({ settings, id: newestId } = clone(settings, newestId));
  const deleted = new Set([newestId, settings.profiles[builtInCount + 3]!.id, settings.profiles[builtInCount + 20]!.id]);
  settings = normalizeImageStyleProfileSettings({
    ...settings,
    profiles: settings.profiles.filter((profile) => !deleted.has(profile.id)),
    defaultProfileId: "auto",
  });
  newestId = settings.profiles.at(-1)!.id;
  for (let copy = 0; copy < 10; copy += 1) ({ settings, id: newestId } = clone(settings, newestId));
  for (let copy = 0; copy < 5; copy += 1) ({ settings } = clone(settings, settings.profiles[builtInCount + 7]!.id));
  assert.equal(settings.profiles.length, builtInCount + 35 - 3 + 15);
  assertDistinct(settings);

  // Profiles saved by older builds carry ids already cut at 80 characters; copying them adds new ones too.
  const legacyId = `auto${"-custom".repeat(12)}`.slice(0, 80);
  const legacy: ImageStyleProfile = { ...DEFAULT_IMAGE_STYLE_PROFILES[1]!, id: legacyId, name: "Old", builtIn: false };
  settings = normalizeImageStyleProfileSettings({ defaultProfileId: legacyId, profiles: [legacy] });
  for (let copy = 0; copy < 3; copy += 1) ({ settings } = clone(settings, legacyId));
  assert.equal(settings.profiles.find((profile) => profile.id === legacyId)?.name, "Old");
  assertDistinct(settings);

  // No count cap: 300 profiles survive normalization (it used to keep only the first 100 stored ones).
  const extraTags = "detailed background, soft rim light, ".repeat(80);
  const many: ImageStyleProfile[] = Array.from({ length: 300 }, (_, index) => ({
    ...DEFAULT_IMAGE_STYLE_PROFILES[3]!,
    id: `bulk-${index + 1}`,
    name: `Bulk ${index + 1}`,
    positiveTags: `bulk ${index + 1}, ${extraTags}`.slice(0, 4000),
    builtIn: false,
  }));
  const manySettings = normalizeImageStyleProfileSettings({ defaultProfileId: "bulk-250", profiles: many });
  assert.equal(manySettings.profiles.length, builtInCount + 300);
  assert.equal(manySettings.defaultProfileId, "bulk-250");
  assert.equal(findImageStyleProfile(manySettings, "bulk-300").name, "Bulk 300");

  // Those 300 heavily edited profiles save through the real settings route and load again after a restart,
  // and the server's image generation reads every one of them.
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { closeDB } = await import("../../packages/server/src/db/connection.js");
  const { loadImageGenerationUserSettings } =
    await import("../../packages/server/src/services/image/image-generation-settings.js");
  const uiValue = JSON.stringify({ imageStyleProfiles: manySettings, __updatedAt: Date.now() });
  assert.ok(uiValue.length > 1_000_000, "the sample is larger than the old settings limit");
  assert.ok(uiValue.length < MAX_APP_SETTINGS_VALUE_LENGTH / 2, "300 heavy profiles sit far below the limit");

  app = (await buildApp()) as unknown as TestApp;
  await app.ready();
  const saved = await app.inject({ method: "PUT", url: "/api/app-settings/ui", payload: { value: uiValue } });
  assert.equal(saved.statusCode, 200, saved.body);
  const tooLarge = await app.inject({
    method: "PUT",
    url: "/api/app-settings/ui",
    payload: { value: "x".repeat(MAX_APP_SETTINGS_VALUE_LENGTH + 1) },
  });
  assert.equal(tooLarge.statusCode, 400, "past the limit the server refuses; the client says so before sending");
  await (app.db as { _fileStore: { flush(): Promise<void> } })._fileStore.flush();
  await app.close();
  app = null;
  await closeDB();

  app = (await buildApp()) as unknown as TestApp;
  await app.ready();
  const loaded = await app.inject({ method: "GET", url: "/api/app-settings/ui" });
  assert.equal(loaded.statusCode, 200, loaded.body);
  const reloaded = normalizeImageStyleProfileSettings(JSON.parse(loaded.json().value).imageStyleProfiles);
  assert.equal(reloaded.defaultProfileId, "bulk-250");
  assert.deepEqual(summary(reloaded.profiles), summary(manySettings.profiles), "all 300 profiles load back unchanged");
  const serverSettings = await loadImageGenerationUserSettings(app.db as never);
  assert.equal(serverSettings.styleProfiles.profiles.length, builtInCount + 300);
  assert.equal(findImageStyleProfile(serverSettings.styleProfiles, "bulk-250").name, "Bulk 250");

  console.log("image style profile ids regression passed");
} finally {
  await app?.close();
  const { closeDB } = await import("../../packages/server/src/db/connection.js");
  await closeDB().catch(() => undefined);
  rmSync(dataDir, { recursive: true, force: true });
}

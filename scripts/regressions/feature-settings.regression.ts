import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Settings > Advanced > Features: the `features` app setting, its routes, the cached server helper
// (absent = the registry default, which is OFF for every switch; refreshed on every storage write)
// and env precedence for the switches that also have an environment variable.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-feature-settings-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
delete process.env.LOREBOOK_STABLE_GROUP_WINNERS;
delete process.env.PROVIDER_RETRY_TRANSIENT_ERRORS;
delete process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR;
delete process.env.MARINARA_CONSOLE_TRAY;

type TestApp = {
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): any; body: string }>;
  ready(): Promise<void>;
};
let app: TestApp | null = null;
try {
  const shared = await import("../../packages/shared/src/index.js");
  const { FEATURE_SETTINGS_KEY, FEATURE_SWITCH_NAMES, FEATURE_SWITCH_DEFAULTS, normalizeFeatureSettings } = shared;
  const features = await import("../../packages/server/src/services/features/feature-settings.js");
  const { isFeatureEnabled, getFeatureNumber, resetFeatureSettingsForTests, onFeatureSettingsChange } = features;

  // ── the registry: exactly these switches, every one off by default ──
  assert.deepEqual([...FEATURE_SWITCH_NAMES].sort(), [
    "backgroundCallCap",
    "cacheFriendlyPromptLayout",
    "chatgptHistoryReplay",
    "consoleTray",
    "generationJobTracking",
    "providerRetry",
    "stableLorebookGroupPicks",
  ]);
  for (const name of FEATURE_SWITCH_NAMES) assert.equal(FEATURE_SWITCH_DEFAULTS[name], false, `${name} defaults off`);

  // ── shared normalization: bad values fall back to the default ──
  assert.deepEqual(normalizeFeatureSettings(null), {});
  assert.deepEqual(normalizeFeatureSettings([]), {});
  assert.deepEqual(
    normalizeFeatureSettings({ consoleTray: true, providerRetry: "yes", backgroundCallsPerHour: 0, other: true }),
    { consoleTray: true },
    "only well-formed known keys survive",
  );
  assert.deepEqual(normalizeFeatureSettings({ backgroundCallsPerHour: 42 }), { backgroundCallsPerHour: 42 });

  // ── absent = OFF, numbers default ──
  resetFeatureSettingsForTests();
  for (const name of FEATURE_SWITCH_NAMES) assert.equal(isFeatureEnabled(name), false, `${name} is off by default`);
  assert.equal(getFeatureNumber("backgroundCallsPerHour"), 600);

  // ── env precedence: set wins both ways, unset or blank falls through ──
  resetFeatureSettingsForTests({ stableLorebookGroupPicks: false, providerRetry: true });
  assert.equal(isFeatureEnabled("providerRetry"), true, "a saved on applies");
  process.env.LOREBOOK_STABLE_GROUP_WINNERS = "true";
  assert.equal(isFeatureEnabled("stableLorebookGroupPicks"), true, "env on beats a saved off");
  process.env.PROVIDER_RETRY_TRANSIENT_ERRORS = "false";
  assert.equal(isFeatureEnabled("providerRetry"), false, "env off beats a saved on");
  process.env.PROVIDER_RETRY_TRANSIENT_ERRORS = "  ";
  assert.equal(isFeatureEnabled("providerRetry"), true, "a blank env var counts as unset");
  assert.deepEqual(features.featureEnvOverrides(), { stableLorebookGroupPicks: "LOREBOOK_STABLE_GROUP_WINNERS" });
  delete process.env.LOREBOOK_STABLE_GROUP_WINNERS;
  delete process.env.PROVIDER_RETRY_TRANSIENT_ERRORS;
  resetFeatureSettingsForTests();

  // ── platform-only switches ──
  assert.deepEqual(features.featureUnavailable("linux"), { consoleTray: "windowsOnly" });
  assert.deepEqual(features.featureUnavailable("win32"), {});

  // ── change listeners: run on every change, a throwing one does not break the writer ──
  let notified = 0;
  const stopThrowing = onFeatureSettingsChange(() => {
    throw new Error("listener failure fixture");
  });
  const stop = onFeatureSettingsChange(() => {
    notified += 1;
  });
  resetFeatureSettingsForTests({ consoleTray: true });
  assert.equal(notified, 1);
  stop();
  stopThrowing();
  resetFeatureSettingsForTests();
  assert.equal(notified, 1, "an unsubscribed listener is not called");

  // ── routes + storage invalidation ──
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createAppSettingsStorage } =
    await import("../../packages/server/src/services/storage/app-settings.storage.js");
  const db = await getDB();
  const storage = createAppSettingsStorage(db);
  // A value saved before startup is loaded when the routes register.
  await storage.set(FEATURE_SETTINGS_KEY, JSON.stringify({ chatgptHistoryReplay: true }));
  resetFeatureSettingsForTests();
  assert.equal(isFeatureEnabled("chatgptHistoryReplay"), false);

  const fastify = Fastify();
  fastify.decorate("db", db);
  await fastify.register(appSettingsRoutes, { prefix: "/api/app-settings" });
  app = fastify as unknown as TestApp;
  await app.ready();
  assert.equal(isFeatureEnabled("chatgptHistoryReplay"), true, "startup primes the cache");

  const read = await app.inject({ method: "GET", url: "/api/app-settings/features" });
  assert.equal(read.statusCode, 200);
  assert.deepEqual(read.json(), {
    settings: { chatgptHistoryReplay: true },
    envOverrides: {},
    effective: {},
    unavailable: process.platform === "win32" ? {} : { consoleTray: "windowsOnly" },
  });

  const saved = await app.inject({
    method: "PUT",
    url: "/api/app-settings/features",
    payload: { backgroundCallCap: true, backgroundCallsPerHour: 120 },
  });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.json().settings, { backgroundCallCap: true, backgroundCallsPerHour: 120 });
  assert.equal(isFeatureEnabled("backgroundCallCap"), true, "a save takes effect at once");
  assert.equal(isFeatureEnabled("chatgptHistoryReplay"), false, "omitted keys return to the default (off)");
  assert.equal(getFeatureNumber("backgroundCallsPerHour"), 120);
  assert.equal(JSON.parse((await storage.get(FEATURE_SETTINGS_KEY))!).backgroundCallCap, true, "persisted");

  const bad = await app.inject({ method: "PUT", url: "/api/app-settings/features", payload: { consoleTray: "on" } });
  // The app error handler maps the ZodError to 400; this bare Fastify answers 500. Either way it is refused.
  assert.ok(bad.statusCode >= 400, "invalid values are rejected");
  const unknown = await app.inject({ method: "PUT", url: "/api/app-settings/features", payload: { surprise: true } });
  assert.ok(unknown.statusCode >= 400, "unknown keys are rejected");
  const range = await app.inject({
    method: "PUT",
    url: "/api/app-settings/features",
    payload: { backgroundCallsPerHour: 0 },
  });
  assert.ok(range.statusCode >= 400, "out-of-range numbers are rejected");
  assert.equal(isFeatureEnabled("backgroundCallCap"), true, "a rejected save keeps the old value");

  process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR = "90";
  const locked = await app.inject({ method: "GET", url: "/api/app-settings/features" });
  assert.equal(locked.json().envOverrides.backgroundCallsPerHour, "MARINARA_BACKGROUND_CALLS_PER_HOUR");
  assert.equal(locked.json().envOverrides.backgroundCallCap, "MARINARA_BACKGROUND_CALLS_PER_HOUR");
  delete process.env.MARINARA_BACKGROUND_CALLS_PER_HOUR;

  // A switch pinned by an on/off env var reports the value in effect, so the locked toggle shows it.
  await app.inject({ method: "PUT", url: "/api/app-settings/features", payload: { providerRetry: true } });
  process.env.PROVIDER_RETRY_TRANSIENT_ERRORS = "false";
  const pinned = (await app.inject({ method: "GET", url: "/api/app-settings/features" })).json();
  assert.equal(pinned.settings.providerRetry, true, "the saved value is kept");
  assert.equal(pinned.effective.providerRetry, false, "the env value is what is in effect");
  assert.equal(pinned.envOverrides.providerRetry, "PROVIDER_RETRY_TRANSIENT_ERRORS");
  delete process.env.PROVIDER_RETRY_TRANSIENT_ERRORS;

  // Any writer through app-settings storage refreshes the cache; removing the key restores defaults.
  await storage.set(FEATURE_SETTINGS_KEY, "not json");
  assert.equal(isFeatureEnabled("providerRetry"), false, "bad JSON falls back to defaults");
  await storage.set(FEATURE_SETTINGS_KEY, JSON.stringify({ providerRetry: true }));
  assert.equal(isFeatureEnabled("providerRetry"), true);
  await storage.remove(FEATURE_SETTINGS_KEY);
  assert.equal(isFeatureEnabled("providerRetry"), false);
  await storage.set(FEATURE_SETTINGS_KEY, "{}");
  for (const name of FEATURE_SWITCH_NAMES) assert.equal(isFeatureEnabled(name), false, `${name}: empty object is off`);

  // A raw row write that bypasses app-settings storage (Professor Mari's generic DB commands) is
  // picked up by reloadFeatureSettingsIfTouched; unrelated rows leave the cache alone.
  const { appSettings } = await import("../../packages/server/src/db/schema/index.js");
  const raw = JSON.stringify({ generationJobTracking: true });
  await db
    .insert(appSettings)
    .values({ key: FEATURE_SETTINGS_KEY, value: raw, updatedAt: "x" })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: raw } });
  assert.equal(isFeatureEnabled("generationJobTracking"), false, "a raw write alone does not reach the cache");
  assert.equal(await features.reloadFeatureSettingsIfTouched([{ table: "chats", id: "features" }], storage), false);
  assert.equal(isFeatureEnabled("generationJobTracking"), false);
  assert.equal(
    await features.reloadFeatureSettingsIfTouched([{ table: "app_settings", id: FEATURE_SETTINGS_KEY }], storage),
    true,
  );
  assert.equal(isFeatureEnabled("generationJobTracking"), true, "Mari-style writes refresh the cache");
  await storage.remove(FEATURE_SETTINGS_KEY);

  // The generic key route does not expose it (the typed route validates).
  const generic = await app.inject({ method: "PUT", url: "/api/app-settings/other", payload: { value: "{}" } });
  assert.equal(generic.statusCode, 404);

  console.log("feature-settings regression passed");
} finally {
  await app?.close();
  const { closeDB } = await import("../../packages/server/src/db/connection.js");
  await closeDB().catch(() => undefined);
  rmSync(dataDir, { recursive: true, force: true });
}

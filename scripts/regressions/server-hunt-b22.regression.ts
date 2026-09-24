/**
 * Server hunt batch 22:
 *  1. Personal extension storage patches are serialized per extension, so concurrent
 *     patches cannot read the same stale value and drop each other's keys.
 *  2. A stale approve hash is a 409 and an unknown rollback revision is a 404, not a 500.
 *  3. Deleting a Whisper model waits for an in-flight download before removing the cache.
 *  4. Only one sidecar setup SSE stream may own the process-wide download/install work.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "server-hunt-b22-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

const { createPersonalExtensionSettingsStorage } =
  await import("../../packages/server/src/services/extensions/personal-extension-settings.service.js");
const { createPersonalExtensionsStorage } =
  await import("../../packages/server/src/services/extensions/personal-extension-storage.service.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { SIDECAR_SPEECH_MODELS } = await import("../../packages/server/node_modules/@marinara-engine/shared/dist/index.js");

try {
  // 1. Concurrent storage patches keep every key.
  {
    const values = new Map<string, string>();
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    // A store whose writes wait a macrotask, like a write queued behind a DB flush.
    const fakeAppSettings = {
      async get(key: string) {
        return values.get(key) ?? null;
      },
      async set(key: string, value: string) {
        await tick();
        values.set(key, value);
      },
      async remove(key: string) {
        await tick();
        values.delete(key);
      },
    };
    const settings = createPersonalExtensionSettingsStorage(fakeAppSettings as never);
    await Promise.all([settings.patch("ext", { a: 1 }), settings.patch("ext", { b: 2 }), settings.patch("ext", { c: 3 })]);
    assert.deepEqual(await settings.get("ext"), { a: 1, b: 2, c: 3 }, "concurrent patches must not drop keys");

    await Promise.all([settings.patch("ext", { d: 4 }), settings.remove("ext")]);
    assert.deepEqual(await settings.get("ext"), {}, "remove queued after a patch must win");

    // A failing write does not wedge the lock for later patches.
    const failing = createPersonalExtensionSettingsStorage({
      ...fakeAppSettings,
      set: async (key: string, value: string) => {
        if (value.includes("boom")) throw new Error("write failed");
        await fakeAppSettings.set(key, value);
      },
    } as never);
    await assert.rejects(failing.patch("ext2", { boom: true }));
    assert.deepEqual(await failing.patch("ext2", { ok: true }), { ok: true });
  }

  // 2. Approve and rollback conflicts carry HTTP status codes.
  {
    const fileDb = await createFileNativeDB();
    try {
      const storage = createPersonalExtensionsStorage(fileDb as never);
      const draft = await storage.create({ name: "B22 draft", runtime: "client", js: "void 0;" });
      assert.ok(draft);
      await assert.rejects(storage.approve(draft.id, "stale-hash"), (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 409);
        return true;
      });
      await assert.rejects(storage.rollback(draft.id, "missing-revision"), (error: unknown) => {
        assert.equal((error as { statusCode?: number }).statusCode, 404);
        return true;
      });
    } finally {
      await fileDb._fileStore.close();
    }
  }

  // 3. deleteModel waits for an in-flight speech model load.
  {
    const { sidecarSpeechService } = await import("../../packages/server/src/services/sidecar/sidecar-speech.service.js");
    const model = SIDECAR_SPEECH_MODELS[0]!;
    const cacheDir = join(dataDir, "models", ...model.repoId.split("/"));
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "config.json"), "{}");

    let finishLoad!: () => void;
    const service = sidecarSpeechService as unknown as {
      loadingPromise: Promise<unknown> | null;
      activeModelId: string | null;
    };
    // A real load sets activeModelId before loadingPromise, and deleteModel only
    // waits for a load of the model it is deleting, so fake exactly that state.
    service.activeModelId = model.id;
    service.loadingPromise = new Promise<unknown>((resolve) => {
      finishLoad = () => resolve({});
    });
    let deleted = false;
    const deletion = sidecarSpeechService.deleteModel(model.id).then(() => {
      deleted = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(deleted, false, "deleteModel must wait for the in-flight load");
    assert.ok(existsSync(cacheDir), "cache must not be removed while the download is still writing");
    service.loadingPromise = null;
    finishLoad();
    await deletion;
    assert.equal(existsSync(cacheDir), false, "cache is removed once the load settles");
  }

  // 4. Setup SSE streams have a single owner (route wiring checked by source).
  {
    const source = readFileSync(
      new URL("../../packages/server/src/routes/sidecar.routes.ts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("async function handleDownloadSse(");
    assert.ok(start > 0);
    const body = source.slice(start, source.indexOf("async function handleSpeechDownloadSse(", start));
    const guard = body.indexOf("if (activeSetupStream)");
    assert.ok(guard > 0 && guard < body.indexOf("reply.hijack()"), "second stream is rejected before hijack");
    assert.match(body, /status\(409\)/);
    assert.match(body.slice(body.indexOf("const cancelActiveWork")), /releaseSetupStream\(\)/);
    assert.match(body.slice(body.indexOf("} finally {")), /releaseSetupStream\(\)/);
  }

  console.log("server-hunt-b22 regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

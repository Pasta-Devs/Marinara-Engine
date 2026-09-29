import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv[2] !== "--child") {
  for (const value of ["missing", "false", "invalid", "true"]) {
    const result = spawnSync(
      process.execPath,
      [...process.execArgv, fileURLToPath(import.meta.url), "--child", value],
      {
        encoding: "utf8",
        timeout: 15_000,
      },
    );
    assert.equal(result.status, 0, `${value} environment: ${result.stdout}\n${result.stderr}`);
  }
  console.info(
    "multiplayer controls: fresh-process opt-in, normal authentication/CSRF/Host guards, native denial, strict bodies and no restart hosting passed",
  );
} else {
  const directory = mkdtempSync(join(tmpdir(), "marinara-multiplayer-controls-"));
  const value = process.argv[3];
  if (value === "missing") delete process.env.MULTIPLAYER_ENABLED;
  else process.env.MULTIPLAYER_ENABLED = value;
  Object.assign(process.env, {
    DATA_DIR: directory,
    FILE_STORAGE_DIR: join(directory, "store"),
    MARINARA_ENV_FILE: join(directory, "unused.env"),
    BASIC_AUTH_USER: "fixture",
    BASIC_AUTH_PASS: "fixture-password",
    ADMIN_SECRET: "fixture-admin-secret",
    MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK: "true",
    CSRF_TRUSTED_ORIGINS: "",
    MARINARA_LITE: "true",
    LOG_LEVEL: "silent",
  });
  const { multiplayerAvailable } = await import("../../packages/server/src/config/runtime-config.js");
  const expected = value === "true";
  assert.equal(multiplayerAvailable, expected);
  process.env.MULTIPLAYER_ENABLED = expected ? "false" : "true";
  assert.equal(
    (await import("../../packages/server/src/config/runtime-config.js")).multiplayerAvailable,
    expected,
    "changing the environment after module initialization cannot hot-enable or hot-disable the networking feature",
  );
  const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createAppSettingsStorage } =
    await import("../../packages/server/src/services/storage/app-settings.storage.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { MultiplayerService } = await import("../../packages/server/src/services/multiplayer/service.js");
  const { multiplayerRoutes } = await import("../../packages/server/src/routes/multiplayer.routes.js");
  const { hostValidationHook } = await import("../../packages/server/src/middleware/host-validation.js");
  const { basicAuthHook } = await import("../../packages/server/src/middleware/basic-auth.js");
  const { csrfProtectionHook } = await import("../../packages/server/src/middleware/csrf-protection.js");
  const { androidLocalAuthHook } = await import("../../packages/server/src/middleware/android-local-auth.js");
  const { CSRF_HEADER, CSRF_HEADER_VALUE } = await import("../../packages/server/src/utils/security.js");
  const db = await createFileNativeDB();
  await createAppSettingsStorage(db).set("multiplayer", "true");
  const service = new MultiplayerService({
    db,
    available: multiplayerAvailable,
    tls: () => null,
    abortGeneration() {},
  });
  await service.initialize();
  const app = Fastify();
  app.addHook("onRequest", hostValidationHook);
  app.addHook("onRequest", basicAuthHook);
  app.addHook("onRequest", csrfProtectionHook);
  app.addHook("onRequest", androidLocalAuthHook);
  await app.register(multiplayerRoutes, { prefix: "/api/multiplayer", service });
  const headers = {
    host: "127.0.0.1",
    authorization: `Basic ${Buffer.from("fixture:fixture-password").toString("base64")}`,
    "x-admin-secret": "fixture-admin-secret",
    [CSRF_HEADER]: CSRF_HEADER_VALUE,
  };
  try {
    const status = await app.inject({ method: "GET", url: "/api/multiplayer/status", headers });
    assert.equal(status.statusCode, 200);
    assert.deepEqual(status.json(), {
      available: expected,
      enabled: expected,
      hosting: false,
      joined: false,
      tlsAvailable: false,
    });
    const settings = {
      method: "PUT" as const,
      url: "/api/multiplayer/settings",
      payload: { enabled: true, consent: true },
    };
    assert.equal((await app.inject({ ...settings, headers: { ...headers, host: "evil.invalid" } })).statusCode, 421);
    const { authorization: _auth, ...withoutAuth } = headers;
    assert.equal(
      (await app.inject({ ...settings, headers: withoutAuth, remoteAddress: "203.0.113.45" })).statusCode,
      401,
    );
    const crossSite = await app.inject({
      ...settings,
      headers: { ...headers, origin: "https://evil.invalid", "sec-fetch-site": "cross-site" },
    });
    assert.equal(crossSite.statusCode, 403);
    const { [CSRF_HEADER]: _csrf, ...withoutCsrf } = headers;
    assert.equal(
      (await app.inject({ ...settings, headers: { ...withoutCsrf, "sec-fetch-site": "same-site" } })).statusCode,
      403,
    );
    const normalSettings = await app.inject({ ...settings, headers });
    assert.equal(normalSettings.statusCode, expected ? 200 : 404);
    if (!expected) {
      for (const path of ["/host", "/guest", "/guest-view"])
        assert.equal((await app.inject({ method: "GET", url: `/api/multiplayer${path}`, headers })).statusCode, 404);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/multiplayer/prepare",
            headers,
            payload: { mode: "game", name: "Room" },
          })
        ).statusCode,
        404,
      );
    } else {
      const { "x-admin-secret": _admin, ...withoutAdmin } = headers;
      assert.equal((await app.inject({ ...settings, headers: withoutAdmin })).statusCode, 403);
      assert.equal(
        (await app.inject({ ...settings, headers, payload: { enabled: true, consent: true, unsafe: "extra" } }))
          .statusCode,
        400,
      );
      assert.equal(
        (await app.inject({ ...settings, headers, payload: { enabled: true, consent: false } })).statusCode,
        400,
      );
      for (const payload of [
        { type: "add-character", characterId: "fixture_character", role: "character" },
        { type: "remove-character", characterId: "fixture_character" },
      ]) {
        const localControl = await app.inject({
          method: "POST",
          url: "/api/multiplayer/host/actions",
          headers,
          payload,
        });
        assert.deepEqual(
          localControl.json(),
          { error: "room-ended" },
          "local roster actions parse, then require a current hosted room",
        );
        const peerAction = await app.inject({ method: "POST", url: "/api/multiplayer/guest/action", headers, payload });
        assert.deepEqual(
          peerAction.json(),
          { error: "invalid-message" },
          "the guest action contract contains no local library or roster controls",
        );
      }
      const injectedControl = await app.inject({
        method: "POST",
        url: "/api/multiplayer/host/actions",
        headers,
        payload: {
          type: "add-character",
          characterId: "fixture_character",
          role: "character",
          metadata: { unsafe: true },
        },
      });
      assert.deepEqual(injectedControl.json(), { error: "invalid-message" });
      const prepared = await app.inject({
        method: "POST",
        url: "/api/multiplayer/prepare",
        headers,
        payload: { mode: "game", name: "Room" },
      });
      assert.equal(prepared.statusCode, 200);
      const nativeHeaders = { ...headers, "user-agent": "MarinaraEngine/Android" };
      assert.equal(
        (await app.inject({ method: "GET", url: "/api/multiplayer/guest-view", headers: nativeHeaders })).statusCode,
        400,
      );
      assert.equal(
        (await app.inject({ method: "POST", url: "/api/multiplayer/join", headers: nativeHeaders, payload: {} }))
          .statusCode,
        400,
      );
      const document = await app.inject({ method: "GET", url: "/api/multiplayer/guest-view", headers });
      assert.equal(document.statusCode, 200, "built trusted guest document is available only after both gates");
      assert.match(document.headers["content-security-policy"]!, /sandbox allow-scripts/u);
      assert.match(document.headers["content-security-policy"]!, /connect-src 'none'/u);
      assert.ok(!document.headers["content-security-policy"]!.includes("allow-same-origin"));
      const chats = createChatsStorage(db);
      await chats.patchMetadata(prepared.json().chatId, {
        multiplayer: {
          version: 1,
          role: "host",
          roomId: "room_restart",
          epoch: "epoch_restart",
          status: "active",
          generation: "running",
          round: { phase: "resolving" },
        },
      });
      const restarted = new MultiplayerService({
        db,
        available: multiplayerAvailable,
        tls: () => null,
        abortGeneration() {},
      });
      await restarted.initialize();
      assert.equal(restarted.status().enabled, true);
      assert.equal(restarted.status().hosting, false, "saved settings never start a listener after restart");
      assert.equal(restarted.status().joined, false);
      assert.equal(await restarted.hostState(), null);
      const metadata = (await chats.getById(prepared.json().chatId))!.metadata;
      const room = (typeof metadata === "string" ? JSON.parse(metadata) : metadata).multiplayer;
      assert.equal(room.status, "ended");
      assert.equal(room.round.phase, "interrupted");
      await restarted.close();
      await app.inject({ ...settings, headers, payload: { enabled: false, consent: true } });
      assert.equal((await app.inject({ method: "GET", url: "/api/multiplayer/guest-view", headers })).statusCode, 404);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/multiplayer/prepare",
            headers,
            payload: { mode: "roleplay", name: "Late action" },
          })
        ).statusCode,
        404,
      );
    }
  } finally {
    await app.close();
    await service.close();
    await db._fileStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

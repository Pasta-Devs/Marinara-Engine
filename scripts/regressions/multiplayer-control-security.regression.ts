import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv[2] !== "--child") {
  // Security/Node CI builds shared code only; exercise the real guest document
  // without depending on a previous full client build in the checkout.
  const guestBuild = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../../packages/client/scripts/build-multiplayer-guest.mjs", import.meta.url))],
    { encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(guestBuild.status, 0, `guest build: ${guestBuild.stdout}\n${guestBuild.stderr}`);
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
  delete process.env.MARINARA_E2E_DISABLE_RATE_LIMIT;
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
  const { rateLimitHook, MULTIPLAYER_GUEST_VIEW_RATE_LIMIT } =
    await import("../../packages/server/src/middleware/rate-limit.js");
  const { CSRF_HEADER, CSRF_HEADER_VALUE } = await import("../../packages/server/src/utils/security.js");
  const db = await createFileNativeDB();
  await createAppSettingsStorage(db).set("multiplayer", "true");
  let tlsReads = 0;
  const service = new MultiplayerService({
    db,
    available: multiplayerAvailable,
    tls: () => {
      tlsReads++;
      return null;
    },
    abortGeneration() {},
  });
  await service.initialize();
  const app = Fastify();
  app.addHook("onRequest", hostValidationHook);
  app.addHook("onRequest", rateLimitHook);
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
      const beforeControls = tlsReads;
      for (let attempt = 0; attempt < 10; attempt++) {
        assert.equal((await app.inject({ method: "GET", url: "/api/multiplayer/status", headers })).statusCode, 200);
      }
      assert.equal(tlsReads, beforeControls, "status requests reuse the short-lived certificate availability result");
      assert.equal((await app.inject({ method: "GET", url: "/api/multiplayer/host", headers })).statusCode, 200);
      assert.equal((await app.inject({ method: "GET", url: "/api/multiplayer/guest", headers })).statusCode, 200);
      assert.equal(tlsReads, beforeControls, "ordinary control gates do not inspect TLS certificates");
      for (const [payload, contentType, expectedCode] of [
        ["{", "application/json", 400],
        [JSON.stringify({ enabled: true, consent: true, padding: "x".repeat(1100) }), "application/json", 413],
        ["unused", "application/x-unknown", 415],
      ] as const) {
        const invalid = await app.inject({
          ...settings,
          headers: { ...headers, "content-type": contentType },
          payload,
        });
        assert.equal(invalid.statusCode, expectedCode);
        assert.deepEqual(invalid.json(), { error: "invalid-message" });
      }
      const hostState = service.hostState;
      service.hostState = async () => {
        throw new Error("private-storage-error");
      };
      try {
        const failed = await app.inject({ method: "GET", url: "/api/multiplayer/host", headers });
        assert.equal(failed.statusCode, 500);
        assert.deepEqual(failed.json(), { error: "unavailable" }, "unexpected failures stay sanitized");
      } finally {
        service.hostState = hostState;
      }
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
      const frameRequest = {
        method: "GET" as const,
        url: "/api/multiplayer/guest-view",
        headers,
        remoteAddress: "203.0.113.46",
      };
      for (let attempt = 0; attempt < MULTIPLAYER_GUEST_VIEW_RATE_LIMIT.max; attempt++) {
        const admitted = await app.inject({ ...frameRequest, url: `${frameRequest.url}?mount=${attempt}` });
        assert.equal(admitted.statusCode, 200);
        assert.equal(admitted.headers["ratelimit-limit"], String(MULTIPLAYER_GUEST_VIEW_RATE_LIMIT.max));
      }
      for (const request of [
        { ...frameRequest, url: "/api/multiplayer/guest-vi%65w?mount=next" },
        { ...frameRequest, method: "HEAD" as const },
      ]) {
        const throttled = await app.inject(request);
        assert.equal(throttled.statusCode, 429, "frame reads share one bounded bucket across query, encoding and HEAD");
        assert.ok(Number(throttled.headers["retry-after"]) > 0);
      }
      assert.equal(
        (await app.inject({ ...frameRequest, remoteAddress: "203.0.113.47" })).statusCode,
        200,
        "another browser address has its own frame budget",
      );
      const ordinaryStatus = await app.inject({ ...frameRequest, url: "/api/multiplayer/status" });
      assert.equal(ordinaryStatus.statusCode, 200, "frame reloads do not consume the ordinary polling bucket");
      assert.equal(ordinaryStatus.headers["ratelimit-limit"], "600");
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

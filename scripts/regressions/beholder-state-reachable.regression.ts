// Correcting a Beholder slot has to work when the browser is not on loopback.
//
// It did not. `PUT /api/agents/beholder-state/:chatId` was wrapped in
// requirePrivilegedAccess, which admits a request only from loopback or with an
// X-Admin-Secret header. A browser cannot send that header — the shipped package
// contains the string zero times — so behind a reverse proxy, on a LAN, or through a
// tunnel, every slot edit and the entire "start over" action returned 403, and no
// setting could change that. The gate does not log and the panel's error toast was
// invisible until 1.3.9, so it failed silently at both ends and read as the whole
// feature being broken.
//
// This drives the real route through the real app rather than reading the source. An
// earlier version of this file matched source text, and it could have passed while the
// route still returned 403 — one of its assertions was even satisfied by a comment
// explaining the fix rather than by the code doing it.
//
// The app-wide Basic Auth hook is deliberately satisfied here, by allowing
// unauthenticated private-network access, so that what is being measured is the ROUTE's
// own authorization and not the product-wide lockdown that guards every endpoint.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-beholder-state-reachable-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
  NODE_ENV: process.env.NODE_ENV,
  MARINARA_LITE: process.env.MARINARA_LITE,
  ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK: process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK,
  ADMIN_SECRET: process.env.ADMIN_SECRET,
};

/** A LAN address: what a reverse proxy or another machine looks like to the server. */
const REMOTE = "192.168.1.50";
const MESSAGE = "beholder-reachable-message";

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; body: string }>;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";
  // Satisfies the app-wide hook only. The route gate under test is separate.
  process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK = "true";
  delete process.env.ADMIN_SECRET;

  const [{ buildApp }, { getDB }, { createAgentsStorage }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/services/storage/agents.storage.js"),
  ]);

  app = await buildApp();
  await app.ready();

  // A real chat, created through the API. agent_runs are stored per chat, so a run
  // seeded against an id no chat owns is written somewhere the lookup never reads — and
  // the route then answers 404, which looks exactly like the fix not working.
  const created = await app.inject({
    method: "POST",
    url: "/api/chats",
    remoteAddress: REMOTE,
    headers: { host: "127.0.0.1:7860", "content-type": "application/json" },
    payload: { name: "Beholder reachability", mode: "roleplay" },
  });
  assert.equal(created.statusCode, 200, `could not create the chat to test against: ${created.body}`);
  const CHAT = JSON.parse(created.body).id as string;
  assert.ok(CHAT, "the created chat should have an id");

  const agents = createAgentsStorage(await getDB());
  // Created directly rather than through ensureBuiltinConfig. BUILT_IN_AGENTS is filled
  // from installed capability package manifests, and Beholder is a downloadable package
  // now, so in a bare test app that list is empty and the built-in path yields nothing.
  // The route's lookup joins on the config TYPE, which is all this needs to satisfy.
  const config = await agents.create({
    type: "beholder",
    name: "Beholder",
    description: "seeded for this regression",
    phase: "post",
    enabled: true,
    connectionId: null,
    imagePath: null,
    promptTemplate: "",
    settings: {},
  } as never);
  assert.ok(config?.id, "a Beholder agent config should exist to hang the run off");
  assert.equal(config.type, "beholder", "and it must keep the type the route looks up");
  await agents.saveRun({
    agentConfigId: config!.id,
    chatId: CHAT,
    messageId: MESSAGE,
    result: {
      type: "beholder",
      data: { characters: [{ name: "Maggie", body: { waist: { worn: [{ item: "belt" }] } } }] },
      tokensUsed: 0,
      durationMs: 1,
      success: true,
      error: null,
    },
  });

  // Confirm the seed is findable the same way the route finds it, so a seeding problem
  // cannot masquerade as the route refusing the write.
  const seeded = await agents.getLastSuccessfulRunByType("beholder", CHAT);
  assert.ok(seeded, "the seeded Beholder run should be findable before the route is exercised");

  const put = (chatId: string, state: unknown) =>
    app!.inject({
      method: "PUT",
      url: `/api/agents/beholder-state/${chatId}`,
      remoteAddress: REMOTE,
      headers: { host: "127.0.0.1:7860", "content-type": "application/json" },
      payload: { state },
    });

  // ── The correction the bug report could not make ──────────────────────────
  const corrected = {
    characters: [{ name: "Maggie", body: { waist: { worn: [{ item: "black belt" }] } } }],
  };
  const write = await put(CHAT, corrected);
  assert.notEqual(
    write.statusCode,
    403,
    "a correction from a non-loopback address must not be refused — a browser behind a " +
      "reverse proxy can offer neither loopback nor an X-Admin-Secret header",
  );
  assert.equal(write.statusCode, 200, `expected the correction to be accepted, got ${write.body}`);

  // ── and it has to actually persist ────────────────────────────────────────
  const read = await app.inject({
    method: "GET",
    url: `/api/agents/beholder-state/${CHAT}`,
    remoteAddress: REMOTE,
    headers: { host: "127.0.0.1:7860" },
  });
  assert.equal(read.statusCode, 200, "reading the state back must work from the same address");
  assert.match(read.body, /black belt/u, "the correction must survive the round trip, not merely be accepted");

  // ── the protections that replace the gate still work ──────────────────────
  const malformed = await put(CHAT, { characters: "not a list" });
  assert.equal(malformed.statusCode, 400, "a malformed body must still be refused");

  const unknownChat = await put("chat-with-no-beholder-run", corrected);
  assert.equal(unknownChat.statusCode, 404, "a chat with no run to correct must still say so");

  // ── the neighbouring administrative routes keep their gate ────────────────
  // The point is that this route was miscategorised, not that the gate is wrong. Driven
  // rather than read, for the same reason as above.
  const adminRoute = await app.inject({
    method: "PATCH",
    url: "/api/agents/import-policy",
    remoteAddress: REMOTE,
    headers: { host: "127.0.0.1:7860", "content-type": "application/json" },
    payload: { enabled: true },
  });
  assert.equal(
    adminRoute.statusCode,
    403,
    "changing the Custom Agent import policy is genuinely administrative and must stay " + "behind the privileged gate",
  );

  console.log("beholder state route reachable behind a proxy: OK");
} finally {
  await app?.close().catch(() => {});
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

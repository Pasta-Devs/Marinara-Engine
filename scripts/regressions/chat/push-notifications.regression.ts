// Push notifications through ntfy (#9752): what a notice carries, when a saved reply sends one, and the
// owner-only settings routes. A local HTTP server stands in for ntfy, as a self-hosted one on the LAN would.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_PUSH_NOTIFICATION_SETTINGS,
  normalizePushHttpUrl,
  parsePushNotificationSettings,
  type PushNotificationSettings,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-push-notifications-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { appSettingsRoutes } = await import("../../../packages/server/src/routes/app-settings.routes.js");
const push = await import("../../../packages/server/src/services/push-notifications.js");

// ── Addresses and stored values ──
assert.equal(normalizePushHttpUrl(" https://ntfy.example.com/ "), "https://ntfy.example.com");
assert.equal(normalizePushHttpUrl("http://192.168.1.20:8080/ntfy/"), "http://192.168.1.20:8080/ntfy");
for (const bad of [
  "ftp://ntfy.sh",
  "https://user:pass@ntfy.sh",
  "https://ntfy.sh/?x=1",
  "https://ntfy.sh/#a",
  "ntfy.sh",
  "",
]) {
  assert.equal(normalizePushHttpUrl(bad), null, `${bad} is refused`);
}
assert.deepEqual(parsePushNotificationSettings(null), DEFAULT_PUSH_NOTIFICATION_SETTINGS);
const tampered = parsePushNotificationSettings({
  enabled: true,
  topic: "bad topic!",
  serverUrl: "javascript:alert(1)",
});
assert.equal(tampered.topic, "", "a malformed topic is dropped");
assert.equal(tampered.enabled, false, "without a topic nothing can send");
assert.equal(tampered.serverUrl, "https://ntfy.sh");

// ── What a notice carries ──
assert.equal(
  push.cleanPushPreview("**Hi** _there_,\n\n*waves* `code`  [link](https://x.y) # done"),
  "Hi there, waves code link done",
);
const long = push.cleanPushPreview("word ".repeat(100));
assert.equal(long.length, push.PUSH_PREVIEW_MAX_CHARS);
assert.ok(long.endsWith("…"));

const settings: PushNotificationSettings = {
  ...DEFAULT_PUSH_NOTIFICATION_SETTINGS,
  enabled: true,
  serverUrl: "https://ntfy.sh",
  topic: "marinara-abc_DEF-123",
  clickUrl: "https://home.example:7860",
};
const event = { chatId: "chat 1/x", title: "New message from Aria", content: "*She smiles.* Hello **there**." };
const generic = push.buildNtfyPublishRequest(settings, event);
assert.deepEqual(generic, {
  url: "https://ntfy.sh",
  body: {
    topic: "marinara-abc_DEF-123",
    title: "New message from Aria",
    message: push.PUSH_GENERIC_BODY,
    tags: ["speech_balloon"],
    priority: 3,
    click: "https://home.example:7860/?chat=chat%201%2Fx",
  },
});
assert.ok(!generic!.url.includes(settings.topic), "the topic stays out of the request URL");
assert.equal(
  push.buildNtfyPublishRequest({ ...settings, previews: true }, event)!.body.message,
  "She smiles. Hello there.",
);
assert.equal(push.buildNtfyPublishRequest({ ...settings, clickUrl: "" }, event)!.body.click, undefined);
assert.equal(push.buildNtfyPublishRequest({ ...settings, topic: "" }, event), null);

// ── When a saved reply sends one ──
const reply = { autonomous: false, clientDisconnected: false, regenerate: false, impersonate: false, content: "Hi" };
assert.equal(push.shouldPublishReplyPush(settings, reply), false, "a reply the open app is still streaming");
assert.equal(push.shouldPublishReplyPush(settings, { ...reply, clientDisconnected: true }), true, "the app was closed");
assert.equal(
  push.shouldPublishReplyPush(settings, { ...reply, autonomous: true }),
  true,
  "characters writing on their own",
);
assert.equal(
  push.shouldPublishReplyPush({ ...settings, notifyAutonomous: false }, { ...reply, autonomous: true }),
  false,
);
assert.equal(
  push.shouldPublishReplyPush({ ...settings, notifyReplies: false }, { ...reply, clientDisconnected: true }),
  false,
);
for (const skipped of [{ regenerate: true }, { impersonate: true }, { content: "  " }]) {
  assert.equal(push.shouldPublishReplyPush(settings, { ...reply, clientDisconnected: true, ...skipped }), false);
}
assert.equal(push.shouldPublishReplyPush({ ...settings, enabled: false }, { ...reply, autonomous: true }), false);

// ── A local ntfy server ──
const received: Array<Record<string, unknown>> = [];
let answer: { status: number; body: string } = { status: 200, body: '{"id":"x"}' };
const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
const ntfy = createServer(async (req, res) => {
  const body = await readBody(req);
  received.push({ method: req.method, url: req.url, ...(JSON.parse(body) as Record<string, unknown>) });
  res.writeHead(answer.status, { "Content-Type": "application/json" });
  res.end(answer.body);
});
await new Promise<void>((resolve) => ntfy.listen(0, "127.0.0.1", resolve));
const localServer = `http://127.0.0.1:${(ntfy.address() as AddressInfo).port}`;
const waitFor = async (count: number) => {
  for (let i = 0; i < 100 && received.length < count; i += 1) await new Promise((r) => setTimeout(r, 20));
};

const app = Fastify();
try {
  const local = { ...settings, serverUrl: localServer };
  push.publishPushNotification(local, { ...event, title: "Nachricht von Ärya 🌸" });
  await waitFor(1);
  assert.equal(received.length, 1, "a self-hosted server on this machine is reached");
  assert.deepEqual(
    { method: received[0]!.method, url: received[0]!.url, topic: received[0]!.topic, title: received[0]!.title },
    { method: "POST", url: "/", topic: settings.topic, title: "Nachricht von Ärya 🌸" },
  );
  push.publishPushNotification(local, event);
  push.publishPushNotification(local, { ...event, chatId: "other" });
  await waitFor(3);
  assert.equal(received.length, 2, "a second notice for the same chat inside the cooldown is skipped");
  assert.equal(received[1]!.click, "https://home.example:7860/?chat=other");

  answer = { status: 403, body: '{"code":40301,"http":403,"error":"forbidden"}' };
  await assert.rejects(push.sendTestPushNotification(local), /answered 403: forbidden/);
  answer = { status: 200, body: "{}" };

  // ── Owner-only settings routes ──
  app.decorate("db", await getDB());
  await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });
  await app.ready();
  const route = "/api/app-settings/push-notifications";
  const remote = await app.inject({ method: "GET", url: route, remoteAddress: "192.168.1.50" });
  assert.equal(remote.statusCode, 403, "another device without the admin secret cannot read the topic");
  const generic404 = await app.inject({ method: "GET", url: "/api/app-settings/push-notifications-x" });
  assert.equal(generic404.statusCode, 404);

  const enabled = await app.inject({
    method: "PUT",
    url: route,
    payload: { enabled: true, serverUrl: `${localServer}/`, clickUrl: "https://home.example:7860" },
  });
  assert.equal(enabled.statusCode, 200);
  const saved = enabled.json() as PushNotificationSettings;
  assert.match(saved.topic, /^marinara-[A-Za-z0-9_-]{24}$/, "turning it on makes a random topic");
  assert.equal(saved.serverUrl, localServer);
  const rotated = (await app.inject({ method: "POST", url: `${route}/topic` })).json() as PushNotificationSettings;
  assert.notEqual(rotated.topic, saved.topic, "New topic replaces it");
  const refused = await app.inject({ method: "PUT", url: route, payload: { serverUrl: "ftp://ntfy.sh" } });
  assert.equal(refused.statusCode, 400);
  const topicWrite = await app.inject({ method: "PUT", url: route, payload: { topic: "mine" } });
  assert.equal(topicWrite.statusCode >= 400, true, "the topic cannot be set from outside");
  const tested = await app.inject({ method: "POST", url: `${route}/test` });
  assert.equal(tested.statusCode, 200);
  await waitFor(3);
  assert.equal(received.at(-1)!.topic, rotated.topic);
  assert.equal(received.at(-1)!.click, "https://home.example:7860");
  console.info("Push notification regressions passed.");
} finally {
  await app.close();
  await new Promise<void>((resolve) => ntfy.close(() => resolve()));
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

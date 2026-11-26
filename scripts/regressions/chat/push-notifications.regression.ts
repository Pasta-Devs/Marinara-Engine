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
import { runNamedCases } from "../fixtures/named-cases.js";

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

const settings: PushNotificationSettings = {
  ...DEFAULT_PUSH_NOTIFICATION_SETTINGS,
  enabled: true,
  serverUrl: "https://ntfy.sh",
  topic: "marinara-abc_DEF-123",
  clickUrl: "https://home.example:7860",
};
const event = { chatId: "chat 1/x", title: "New message from Aria", content: "*She smiles.* Hello **there**." };
const reply = { autonomous: false, clientDisconnected: false, regenerate: false, impersonate: false, content: "Hi" };

// A local HTTP server stands in for ntfy.
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
const waitFor = async (count: number, ms = 2_000) => {
  for (let waited = 0; waited < ms && received.length < count; waited += 20) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

const app = Fastify();
app.decorate("db", await getDB());
await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });
await app.ready();
const route = "/api/app-settings/push-notifications";

try {
  await runNamedCases([
    {
      name: "addresses and stored values are checked",
      run: () => {
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
      },
    },
    {
      name: "a notice carries a title, the generic line or a cleaned preview, and a link to the chat",
      run: () => {
        assert.equal(
          push.cleanPushPreview("**Hi** _there_,\n\n*waves* `code`  [link](https://x.y) # done"),
          "Hi there, waves code link done",
        );
        const long = push.cleanPushPreview("word ".repeat(100));
        assert.equal(long.length, push.PUSH_PREVIEW_MAX_CHARS);
        assert.ok(long.endsWith("…"));
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
      },
    },
    {
      name: "a saved reply notifies when a character wrote on its own or the app had closed",
      run: () => {
        assert.equal(push.shouldPublishReplyPush(settings, reply), false, "a reply the open app received");
        assert.equal(push.shouldPublishReplyPush(settings, { ...reply, clientDisconnected: true }), true);
        assert.equal(push.shouldPublishReplyPush(settings, { ...reply, autonomous: true }), true);
        assert.equal(
          push.shouldPublishReplyPush({ ...settings, notifyAutonomous: false }, { ...reply, autonomous: true }),
          false,
        );
        assert.equal(
          push.shouldPublishReplyPush({ ...settings, notifyReplies: false }, { ...reply, clientDisconnected: true }),
          false,
        );
        for (const skipped of [{ regenerate: true }, { impersonate: true }, { content: "  " }]) {
          assert.equal(
            push.shouldPublishReplyPush(settings, { ...reply, clientDisconnected: true, ...skipped }),
            false,
          );
        }
        assert.equal(
          push.shouldPublishReplyPush({ ...settings, enabled: false }, { ...reply, autonomous: true }),
          false,
        );
      },
    },
    {
      name: "a server on this machine gets each chat's notice once per cooldown",
      run: async () => {
        const local = { ...settings, serverUrl: localServer };
        const start = received.length;
        push.publishPushNotification(local, { ...event, chatId: "cooldown-a", title: "Nachricht von Ärya 🌸" });
        await waitFor(start + 1);
        assert.deepEqual(
          { method: received[start]?.method, url: received[start]?.url, topic: received[start]?.topic },
          { method: "POST", url: "/", topic: settings.topic },
        );
        assert.equal(received[start]!.title, "Nachricht von Ärya 🌸", "a title in any script");
        push.publishPushNotification(local, { ...event, chatId: "cooldown-a" });
        push.publishPushNotification(local, { ...event, chatId: "cooldown-b" });
        await waitFor(start + 3);
        assert.equal(received.length, start + 2, "a second notice for the same chat inside the cooldown is skipped");
        assert.equal(received.at(-1)!.click, "https://home.example:7860/?chat=cooldown-b");
      },
    },
    {
      name: "the test send reports ntfy's own error",
      run: async () => {
        answer = { status: 403, body: '{"code":40301,"http":403,"error":"forbidden"}' };
        try {
          await assert.rejects(
            push.sendTestPushNotification({ ...settings, serverUrl: localServer }),
            /answered 403: forbidden/,
          );
        } finally {
          answer = { status: 200, body: "{}" };
        }
      },
    },
    {
      name: "the settings routes are owner-only and make, rotate and hide the topic",
      run: async () => {
        const remote = await app.inject({ method: "GET", url: route, remoteAddress: "192.168.1.50" });
        assert.equal(remote.statusCode, 403, "another device without the admin secret cannot read the topic");
        const otherKey = await app.inject({ method: "GET", url: "/api/app-settings/push-notifications-x" });
        assert.equal(otherKey.statusCode, 404);
        const enabled = await app.inject({
          method: "PUT",
          url: route,
          payload: { enabled: true, serverUrl: `${localServer}/`, clickUrl: "https://home.example:7860" },
        });
        assert.equal(enabled.statusCode, 200);
        const saved = enabled.json() as PushNotificationSettings;
        assert.match(saved.topic, /^marinara-[A-Za-z0-9_-]{24}$/, "turning it on makes a random topic");
        assert.equal(saved.serverUrl, localServer);
        const rotated = (
          await app.inject({ method: "POST", url: `${route}/topic` })
        ).json() as PushNotificationSettings;
        assert.notEqual(rotated.topic, saved.topic, "New topic replaces it");
        const refused = await app.inject({ method: "PUT", url: route, payload: { serverUrl: "ftp://ntfy.sh" } });
        assert.equal(refused.statusCode, 400);
        const topicWrite = await app.inject({ method: "PUT", url: route, payload: { topic: "mine" } });
        assert.ok(topicWrite.statusCode >= 400, "the topic cannot be set from outside");
        const start = received.length;
        const tested = await app.inject({ method: "POST", url: `${route}/test` });
        assert.equal(tested.statusCode, 200);
        await waitFor(start + 1);
        assert.equal(received.at(-1)!.topic, rotated.topic);
        assert.equal(received.at(-1)!.click, "https://home.example:7860");
      },
    },
    {
      name: "a notice still queued when the topic is replaced never reaches the old topic",
      run: async () => {
        const current = (await app.inject({ method: "GET", url: route })).json() as PushNotificationSettings;
        const start = received.length;
        // The first goes out at once; the second waits its turn in the queue.
        push.publishPushNotification(current, { ...event, chatId: "rotate-a" });
        push.publishPushNotification(current, { ...event, chatId: "rotate-b" });
        await app.inject({ method: "POST", url: `${route}/topic` });
        await waitFor(start + 2, 2_500);
        assert.equal(received.length, start + 1, "only the notice sent before New topic went out");
        assert.equal(received.at(-1)!.click, "https://home.example:7860/?chat=rotate-a");
      },
    },
  ]);
  console.info("Push notification regressions passed.");
} finally {
  await app.close();
  await new Promise<void>((resolve) => ntfy.close(() => resolve()));
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

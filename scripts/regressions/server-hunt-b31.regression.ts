// Discord webhook mirror: a 429 answer must re-send the message (bounded) instead of dropping it.
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";

process.env.LOG_LEVEL = "silent";

// No real network: stub DNS (for the SSRF check) and fetch.
(dns as unknown as { lookup: unknown }).lookup = async () => [{ address: "162.159.135.232", family: 4 }];

const bodies: string[] = [];
let responses: Array<() => Response> = [];
(globalThis as unknown as { fetch: unknown }).fetch = async (_url: unknown, init: { body?: string }) => {
  bodies.push(String(init?.body ?? ""));
  const next = responses.shift();
  return next ? next() : new Response("", { status: 204 });
};

const rateLimited = () => new Response("", { status: 429, headers: { "Retry-After": "0.01" } });

const { postToDiscordWebhook } = await import("../../packages/server/src/services/discord-webhook.js");

async function waitFor(pred: () => boolean, ms = 5000) {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

const url = "https://discord.com/api/webhooks/123/abc-def";

// One 429 then success: the same message is sent twice.
responses = [rateLimited];
postToDiscordWebhook(url, { content: "hello there" });
await waitFor(() => bodies.length >= 2);
await new Promise((r) => setTimeout(r, 100));
assert.equal(bodies.length, 2, "429 must trigger exactly one re-send when the retry succeeds");
assert.equal(JSON.parse(bodies[0]!).content, "hello there");
assert.equal(bodies[1], bodies[0]);

// Persistent 429: attempts are bounded.
bodies.length = 0;
responses = [rateLimited, rateLimited, rateLimited, rateLimited, rateLimited];
postToDiscordWebhook(url, { content: "second" });
await waitFor(() => bodies.length >= 3);
await new Promise((r) => setTimeout(r, 300));
assert.equal(bodies.length, 3, "rate-limit retries must be bounded to 3 attempts");

// Non-429 failure is not retried.
bodies.length = 0;
responses = [() => new Response("bad", { status: 400 })];
postToDiscordWebhook(url, { content: "third" });
await waitFor(() => bodies.length >= 1);
await new Promise((r) => setTimeout(r, 200));
assert.equal(bodies.length, 1);

console.log("server-hunt-b31 regression passed");

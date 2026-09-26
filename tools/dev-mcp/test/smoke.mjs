// Read-only smoke test: starts the server over stdio, lists its tools, and calls the read tools.
// Nothing here writes to the engine, builds, or restarts anything. edit_character and set_chat_metadata are only
// called with dryRun, and api_request is only checked for refusing a write without confirm.
//
// Usage: node test/smoke.mjs [chat name or id]
//   With no chat, the most recently updated chat is used. Online tools are skipped when the engine is down.
//   The server's usual environment variables apply (MARINARA_DEV_REPO, MARINARA_DEV_STATE, MARINARA_DEV_PORT, ...).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { pickChat } from "../lib/api.mjs";

const EXPECTED_TOOLS = [
  "engine_status", "activity_log", "sandbox_refresh", "sandbox_stop", "list_chats", "read_messages", "get_prompt",
  "cache_report", "diff_prompts", "chat_settings", "logs", "lookup_error", "list_connections",
  "find_characters", "get_character", "edit_character", "set_chat_metadata", "git_status", "typecheck",
  "run_regressions", "build", "restart_engine", "api_request",
];

const client = new Client({ name: "dev-mcp-smoke", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../server.mjs", import.meta.url))],
    env: { ...process.env, MARINARA_DEV_AGENT: process.env.MARINARA_DEV_AGENT || "smoke-test" },
    stderr: "inherit",
  }),
);

const failures = [];

// Offline: a write never picks one of several chats that match a name fragment.
{
  const chats = [
    { id: "c1", name: "Session one", updatedAt: "2026-01-02" },
    { id: "c2", name: "Session two", updatedAt: "2026-01-03" },
    { id: "c3", name: "Session", updatedAt: "2026-01-01" },
  ];
  const expect = (label, ok) => {
    console.log(`pickChat: ${label} ${ok ? "ok" : "<-- UNEXPECTED"}`);
    if (!ok) failures.push(`pickChat: ${label}`);
  };
  expect("a read takes the newest partial match", pickChat(chats, "session t").id === "c2");
  expect("a read of an ambiguous fragment takes the newest", pickChat(chats, "sess").id === "c2");
  expect("a write takes an id", pickChat(chats, "c1", { write: true }).id === "c1");
  expect("a write takes a unique partial match", pickChat(chats, "two", { write: true }).id === "c2");
  expect("a write takes an exact name among partial matches", pickChat(chats, "session", { write: true }).id === "c3");
  let refused = false;
  try {
    pickChat(chats, "sess", { write: true });
  } catch (error) {
    refused = /ambiguous/.test(error.message);
  }
  expect("a write refuses an ambiguous fragment", refused);
}
try {
  const { tools } = await client.listTools();
  console.log(`tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);
  const missing = EXPECTED_TOOLS.filter((name) => !tools.some((t) => t.name === name));
  if (missing.length) failures.push(`missing tools: ${missing.join(", ")}`);

  async function call(name, args = {}, { expectError = false, show = 600 } = {}) {
    const started = Date.now();
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.[0]?.text ?? "";
    const ok = expectError === null || Boolean(result.isError) === expectError;
    console.log(`\n== ${name} ${result.isError ? "ERROR" : "ok"}${ok ? "" : "  <-- UNEXPECTED"} (${Date.now() - started} ms, ${text.length} chars)`);
    console.log(text.slice(0, show));
    if (!ok) failures.push(`${name}: ${text.slice(0, 200)}`);
    return { text, isError: result.isError, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
  }

  const statusResult = await call("engine_status", {}, { show: 1500 });
  const online = statusResult.json?.online === true;
  await call("activity_log", { limit: 3 });
  await call("git_status");
  const logs = await call("logs", { minutes: 60 * 24 * 3, limit: 5 });
  const ref = logs.json?.find((g) => g.lastErrorId)?.lastErrorId ?? logs.json?.find((g) => g.lastRequestId)?.lastRequestId;
  if (ref) await call("lookup_error", { reference: ref }, { show: 1200 });
  else console.log("\n(no errorId or requestId in recent logs; lookup_error skipped)");

  if (online) {
    const chats = await call("list_chats", { limit: 5 });
    const chat = process.argv[2] ?? chats.json?.[0]?.id;
    if (chat) {
      await call("chat_settings", { chat });
      await call("read_messages", { chat, last: 2, maxCharsEach: 200 });
      await call("cache_report", { chat, last: 5 });
      await call("get_prompt", { chat, which: "next", grep: "the" }, { show: 800 });
      await call("diff_prompts", { chat, mode: "next" }, { expectError: null });
      await call("set_chat_metadata", { chat, reason: "smoke test dry run", set: { smokeTestDryRun: true }, dryRun: true });
    }
    const connections = await call("list_connections");
    if (/apiKey|baseUrl/i.test(connections.text)) failures.push("list_connections leaked a key or base URL field");
    const found = await call("find_characters", { query: "the", limit: 2 });
    const character = found.json?.[0]?.id;
    if (character) {
      const card = await call("get_character", { character, fields: ["name", "personality"] });
      const personality = card.json?.data?.personality;
      await call("edit_character", {
        character,
        reason: "smoke test dry run",
        set: { personality: typeof personality === "string" ? personality : "" },
        dryRun: true,
      }, { show: 200 });
    }
    await call("api_request", { path: "/health" }, { show: 300 });
    // /health has no POST route, so even a broken guard could not write anything; the refusal must be the guard's.
    const refused = await call("api_request", { path: "/health", method: "POST", body: {} }, { expectError: true });
    if (!refused.text.includes("need confirm: true")) failures.push(`api_request: expected the confirm refusal, got ${refused.text.slice(0, 200)}`);
  } else {
    console.log("\n(engine offline: online tools skipped)");
  }

} finally {
  await client.close();
}
console.log(failures.length ? `\nSMOKE FAILED:\n- ${failures.join("\n- ")}` : "\nSMOKE PASSED");
process.exitCode = failures.length ? 1 : 0;

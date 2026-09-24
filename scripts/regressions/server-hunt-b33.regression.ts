import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-hunt-b33-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.LOG_LEVEL = "silent";

const readSource = (relativePath: string) =>
  readFileSync(join(repositoryRoot, relativePath), "utf8").replace(/\r\n/gu, "\n");

try {
  // ── 1. Built-in fallback must not re-run a configured agent that the main loop skipped ──
  // The registry starts empty; hydrate it through the same shared module instance the server resolves.
  // Follow the server package's own link to the shared package (packages/shared in a normal checkout,
  // another tree when node_modules is shared by a worktree) so both sides load one dist/index.js.
  const sharedPackageDir = realpathSync(join(repositoryRoot, "packages/server/node_modules/@marinara-engine/shared"));
  const { replaceBuiltInAgentDefinitions } = (await import(
    pathToFileURL(join(sharedPackageDir, "dist/index.js")).href
  )) as typeof import("../../packages/shared/dist/index.js");
  replaceBuiltInAgentDefinitions([
    {
      id: "world-state",
      name: "World State",
      description: "Regression fixture.",
      phase: "post_processing",
      enabledByDefault: false,
      category: "tracker",
    },
  ]);
  const { resolveAgentPipelineAgents } = await import(
    "../../packages/server/src/services/generation/agent-resolution.js"
  );
  type ResolveArgs = Parameters<typeof resolveAgentPipelineAgents>[0];
  const chatProvider = { chatComplete: async () => ({ content: "", toolCalls: [], finishReason: "stop" }) };
  const baseArgs = {
    connections: {
      getDefaultForAgents: async () => null,
      getFallbackForAgents: async () => null,
      // Every explicit connection is gone.
      getWithKey: async () => null,
    } as unknown as ResolveArgs["connections"],
    chatId: "hunt-b33-agents",
    chatEnableAgents: true,
    hasPerChatAgentList: true,
    perChatAgentSet: new Set<string>(["world-state"]),
    agentPromptTemplateSelections: {},
    chatProvider: chatProvider as unknown as ResolveArgs["chatProvider"],
    chatConnectionId: "paid-chat-connection",
    chatModel: "paid-model",
    chatCustomParameters: {},
    chatTemperature: 0.7,
    chatEnabledParameters: { temperature: true },
    chatSuppressModelParameters: false,
    chatMaxOutputTokens: null,
    chatMaxParallelJobs: 1,
    chatEnableCaching: false,
    chatAnthropicExtendedCacheTtl: false,
    chatCachingAtDepth: 5,
    resolveBaseUrl: (connection: { baseUrl?: string | null }) => connection.baseUrl ?? "",
  } as unknown as Omit<ResolveArgs, "configuredAgents">;

  const skipped = await resolveAgentPipelineAgents({
    ...baseArgs,
    configuredAgents: [
      {
        id: "world-state-row",
        type: "world-state",
        name: "World State",
        phase: "post_processing",
        promptTemplate: "custom world-state prompt",
        connectionId: "deleted-connection",
        settings: {},
      },
    ],
  } as ResolveArgs);
  assert.equal(
    skipped.resolvedAgents.some((agent) => agent.type === "world-state"),
    false,
    "a configured built-in skipped for an unavailable connection must not be re-run on the chat connection",
  );
  assert.ok(skipped.agentConnectionWarnings.length > 0, "the skip still warns");

  const unconfigured = await resolveAgentPipelineAgents({ ...baseArgs, configuredAgents: [] } as ResolveArgs);
  assert.equal(
    unconfigured.resolvedAgents.some((agent) => agent.type === "world-state"),
    true,
    "a per-chat built-in with no config row still falls back to defaults",
  );

  // ── 3. schedule_update goes through the metadata patch queue ──
  const { handleConversationScheduleCommand } = await import(
    "../../packages/server/src/services/generation/conversation-schedule-command-runtime.js"
  );
  const days = Object.fromEntries(
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => [
      day,
      [{ time: "00:00-24:00", activity: "reading", status: "online" }],
    ]),
  );
  const originalSchedules = { "char-1": { days } };
  let stored: Record<string, unknown> = { conversationSchedulesEnabled: true, characterSchedules: originalSchedules };
  let patchCalls = 0;
  const chatsStub = {
    async patchMetadata(
      _id: string,
      updater: (current: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>,
    ) {
      patchCalls += 1;
      // A concurrent writer landed first; the queued updater must see and keep it.
      stored = { ...stored, concurrentKey: "kept" };
      const patch = await updater({ ...stored });
      stored = { ...stored, ...patch };
      return stored;
    },
  };
  const updates: Array<Record<string, unknown>> = [];
  const handled = await handleConversationScheduleCommand({
    command: { type: "schedule_update", status: "dnd", activity: "sleeping" } as never,
    characterId: "char-1",
    chatId: "hunt-b33-schedule",
    chats: chatsStub as never,
    sendUpdated: (data) => updates.push(data),
  });
  assert.equal(handled, true);
  assert.equal(patchCalls, 1, "schedule_update must write through patchMetadata");
  assert.equal(stored.concurrentKey, "kept", "a concurrent metadata change must survive the schedule update");
  const storedSchedules = stored.characterSchedules as typeof originalSchedules;
  const today = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
    (new Date().getDay() + 6) % 7
  ]!;
  assert.equal(storedSchedules["char-1"].days[today]![0]!.status, "dnd");
  assert.equal(originalSchedules["char-1"].days[today]![0]!.status, "online", "the pre-updater snapshot is not mutated");
  assert.equal(updates.length, 1);

  // ── 4. Selfie command honours the generation abort signal ──
  const { handleConversationSelfieCommand } = await import(
    "../../packages/server/src/services/generation/conversation-selfie-command-runtime.js"
  );
  const aborted = new AbortController();
  aborted.abort();
  const selfieEvents: Array<Record<string, unknown>> = [];
  const selfieHandled = await handleConversationSelfieCommand({
    command: { type: "selfie" } as never,
    characterId: "char-1",
    chatId: "hunt-b33-selfie",
    chatMeta: { imageGenConnectionId: "img-conn" },
    charInfo: [],
    persona: null,
    promptConnection: {} as never,
    promptConnectionId: "prompt-conn",
    serviceTier: null,
    db: {} as never,
    chars: { getById: async () => ({ data: JSON.stringify({ name: "Mira" }) }) } as never,
    chats: {} as never,
    connections: {
      getWithKey: async () => {
        throw new Error("request aborted");
      },
    } as never,
    sendEvent: (payload) => selfieEvents.push(payload),
    signal: aborted.signal,
  });
  assert.equal(selfieHandled, true);
  assert.equal(
    selfieEvents.some((event) => event.type === "selfie_error"),
    false,
    "a cancelled selfie must not report selfie_error",
  );

  const selfieSource = readSource("packages/server/src/services/generation/conversation-selfie-command-runtime.ts");
  assert.match(selfieSource, /anthropicExtendedCacheTtl: promptRuntime\.anthropicExtendedCacheTtl,\n\s*signal: args\.signal,/u);
  assert.match(selfieSource, /onFallback: reportFallback,\n\s*signal: args\.signal,/u);
  assert.match(
    selfieSource,
    /for \(const \[variantIndex, imageResult\] of imageResults\.entries\(\)\) \{\n\s*if \(args\.signal\?\.aborted\) return;/u,
  );
  const routeSource = readSource("packages/server/src/routes/generate.routes.ts");
  assert.match(
    routeSource,
    /of collectedCommands\) \{\n[^\n]*\n\s*if \(abortController\.signal\.aborted\) break;/u,
    "the command loop stops after a Stop press",
  );
  assert.match(
    routeSource,
    /handleConversationSelfieCommand\(\{[\s\S]{0,1600}signal: abortController\.signal,\n\s*\}\);/u,
    "the route passes the abort signal to the selfie command",
  );

  console.log("server-hunt-b33 regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

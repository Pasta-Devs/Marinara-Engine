import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-completion-frames-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { ProfessorMariWorkspaceService, professorMariWorkspaceResponseFormat } =
    await import("../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const mariDb = new MariDbService(db);
  const created = await mariDb.executeAction({
    action: "character.create",
    data: { name: "Frame regression", description: "Original" },
    apply: true,
  });
  assert.equal(created.ok, true);
  const characterId = String((created.summary?.preview?.[0] as { id?: string })?.id);
  const chats = createChatsStorage(db);

  for (const mode of ["auto", "manual", "plan"] as const) {
    const chat = await chats.create({ name: `Mixed frame ${mode}`, mode: "conversation", characterIds: [] });
    const calls: ChatMessage[][] = [];
    const tokens: string[] = [];
    const action = {
      action: "character.update",
      characterId,
      patch: { description: `Updated in ${mode}` },
      apply: true,
    };
    const service = new ProfessorMariWorkspaceService({ db } as never);
    Object.assign(service, {
      ensureMariCliShim: async () => {},
      resolveConnection: async () => ({
        id: "regression",
        name: "Regression",
        provider: "custom",
        model: "test",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "",
        maxContext: 8192,
      }),
      resolvePermissionsMode: async () => ({ mode, defaultMode: mode, source: "chat" }),
      buildPromptMessages: async () => ({
        messages: [{ role: "user", content: "Update the description." }],
        manualApprovalArmed: false,
      }),
      baseChatOptions: () => ({ model: "test" }),
      chatCompleteWorkspace: async (_provider: unknown, messages: ChatMessage[]) => {
        calls.push(structuredClone(messages));
        return {
          content: JSON.stringify(
            calls.length === 1
              ? {
                  say: "I've updated the description.",
                  commands: [{ name: "app_data", arguments: action }],
                  stop: false,
                }
              : { say: "The requested operation has been reviewed.", commands: [], stop: true },
          ),
          toolCalls: [],
          finishReason: "stop",
        };
      },
    });
    await service.prompt({
      chatId: chat.id,
      text: "Update the description.",
      onEvent: (event) => {
        if (event.type === "token") tokens.push(String(event.data));
      },
    });
    const current = await mariDb.executeAction({ action: "character.get", characterId });
    assert.equal(current.ok, true);
    if (mode === "auto") {
      assert.match(
        JSON.stringify(current),
        /Updated in auto/u,
        "a command sharing its frame with a completion claim must actually persist",
      );
      assert.match(tokens.join(""), /I've updated/u);
      assert.equal(calls.length, 2);
      assert.match(
        JSON.stringify(calls[1]),
        /Readback: store-verified/u,
        "the next round receives the same frame's executed result",
      );
    } else {
      assert.doesNotMatch(
        JSON.stringify(current),
        new RegExp(`Updated in ${mode}`, "u"),
        `${mode} still prevents the edit`,
      );
    }
  }
  // Exercise the actual Gemini adapter and Mari repair loop, with no external requests.
  const originalFetch = globalThis.fetch;
  try {
    for (const provider of ["google", "google_vertex"] as const) {
      for (const stream of [false, true]) {
        for (const scenario of ["recover", "persistent", "safety", "abort", "after-command", "visible"] as const) {
          const chat = (await chats.create({
            name: `Gemini ${provider} ${scenario}`,
            mode: "conversation",
            characterIds: [],
          }))!;
          const requests: Array<{ url: string; body: Record<string, any> }> = [];
          const events: Array<{ type: string; data: unknown }> = [];
          let executedCommands = 0;
          const service = new ProfessorMariWorkspaceService({ db } as never);
          const executor = (service as any).executeWorkspaceCommandBatch.bind(service);
          Object.assign(service, {
            ensureMariCliShim: async () => {},
            resolveConnection: async () => ({
              id: `gemini-${provider}-${stream}-${scenario}`,
              name: "Gemini fixture",
              provider,
              model: "gemini-3.8-flash",
              baseUrl:
                provider === "google"
                  ? "https://generativelanguage.googleapis.com"
                  : "https://aiplatform.googleapis.com/v1/projects/fixture/locations/global",
              apiKey: "synthetic-test-key",
              maxContext: 8192,
            }),
            resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "chat" }),
            buildPromptMessages: async () => ({
              messages: [
                {
                  role: "system",
                  content: "Return JSON with say, commands and stop. Commands are text, not native function calls.",
                },
                { role: "user", content: "Check the workspace." },
              ],
              manualApprovalArmed: false,
            }),
            baseChatOptions: (_connection: unknown, signal: AbortSignal) => ({
              model: "gemini-3.8-flash",
              maxTokens: 2048,
              maxContext: 8192,
              stream,
              enabledParameters: { reasoningEffort: false },
              responseFormat: professorMariWorkspaceResponseFormat(provider),
              signal,
            }),
            executeWorkspaceCommandBatch: async (...args: any[]) => {
              executedCommands += args[0].length;
              return executor(...args);
            },
          });
          globalThis.fetch = async (input, init) => {
            const url = String(input);
            assert.match(url, /^https:\/\/(?:generativelanguage|aiplatform)\.googleapis\.com\//u);
            requests.push({ url, body: JSON.parse(String(init?.body)) });
            const index = requests.length;
            assert.ok(index <= 4, "The existing protocol repair cap must stop repeated empty failures");
            const malformed =
              scenario === "persistent" ||
              scenario === "abort" ||
              (scenario === "after-command" ? index === 2 : index === 1);
            const firstCommand = scenario === "after-command" && index === 1;
            const frame = firstCommand
              ? {
                  say: "",
                  commands: [
                    {
                      name: "app_data",
                      arguments: {
                        action: "character.update",
                        characterId,
                        patch: { description: `Gemini ${provider} ${stream}` },
                        apply: true,
                      },
                    },
                  ],
                  stop: false,
                }
              : { say: "Workspace response recovered.", commands: [], stop: true };
            const payload = {
              usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 5, totalTokenCount: 105 },
              candidates: [
                {
                  finishReason:
                    scenario === "safety"
                      ? "SAFETY"
                      : malformed || scenario === "visible"
                        ? "MALFORMED_FUNCTION_CALL"
                        : "STOP",
                  ...((!malformed || scenario === "visible") && scenario !== "safety"
                    ? { content: { parts: [{ text: JSON.stringify(frame) }] } }
                    : {}),
                },
              ],
            };
            if (scenario === "abort") await service.abort();
            return new Response(stream ? `data: ${JSON.stringify(payload)}\n\n` : JSON.stringify(payload), {
              headers: { "content-type": stream ? "text/event-stream" : "application/json" },
            });
          };
          let failure: unknown;
          try {
            await service.prompt({
              chatId: chat.id,
              text: "Check the workspace.",
              onEvent: (event) => events.push(event),
            });
          } catch (error) {
            failure = error;
          }
          if (scenario === "safety") assert.match(String(failure), /SAFETY/u);
          else assert.equal(failure, undefined, `${provider}/${stream}/${scenario}: ${String(failure)}`);
          const visible = events
            .filter((event) => event.type === "token")
            .map((event) => String(event.data))
            .join("");
          if (scenario === "recover" || scenario === "after-command" || scenario === "visible") {
            assert.match(visible, /Workspace response recovered/u, JSON.stringify(events));
            assert.equal(requests.length, scenario === "recover" ? 2 : scenario === "visible" ? 1 : 3);
            assert.equal(
              executedCommands,
              scenario === "after-command" ? 1 : 0,
              "A retry cannot replay the preceding completed command",
            );
            if (scenario === "after-command") {
              assert.match(JSON.stringify(requests.at(-1)?.body.contents), /Readback: store-verified/u);
              assert.match(
                JSON.stringify(await mariDb.executeAction({ action: "character.get", characterId })),
                new RegExp(`Gemini ${provider} ${stream}`, "u"),
              );
            }
          } else {
            assert.equal(executedCommands, 0);
            assert.equal(requests.length, scenario === "persistent" ? 3 : 1);
            if (scenario === "persistent") assert.match(visible, /kept returning invalid workspace command frames/u);
            if (scenario === "abort") assert.match(JSON.stringify(events), /cancelled/u);
          }
          if (scenario !== "safety" && scenario !== "abort") {
            const assistant = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant")!;
            const usage = JSON.parse(assistant.extra).generationInfo.usage;
            assert.equal(
              usage.promptTokens,
              requests.length * 100,
              "Malformed but billed attempts retain their reported usage",
            );
            assert.equal(usage.completionTokens, requests.length * 5);
          }
          for (const request of requests) {
            assert.deepEqual(
              request.body.generationConfig,
              { maxOutputTokens: 2048, responseMimeType: "application/json" },
              "Uncatalogued Gemini keeps the explicit JSON protocol without inferred sampler or thinking fields",
            );
            assert.equal(
              request.body.tools,
              undefined,
              "Mari's command envelope must remain text JSON, not native tools",
            );
            assert.ok(request.url.includes(stream ? ":streamGenerateContent?alt=sse" : ":generateContent"));
          }
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("Mari mixed completion frames preserve edits and permission boundaries.");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}

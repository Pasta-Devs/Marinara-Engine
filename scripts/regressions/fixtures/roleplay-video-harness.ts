// Shared setup for the Roleplay video regressions: the real routes on a temporary data directory, with one fake
// server standing in for the text model, the image service and ComfyUI. Tests set the replies on `replies` and
// read what each part was asked on the request lists.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function startRoleplayVideoHarness(name: string) {
  const fixtureDir = mkdtempSync(join(tmpdir(), `marinara-${name}-`));
  // Undone in reverse by close(), or right away when setup itself fails, so a failed setup leaks nothing.
  const teardown: Array<() => unknown> = [() => rmSync(fixtureDir, { recursive: true, force: true })];
  // Every step runs even if an earlier one fails; the first failure is reported afterwards.
  const runTeardown = async () => {
    const failures: unknown[] = [];
    for (const step of teardown.splice(0).reverse()) {
      try {
        await step();
      } catch (err) {
        failures.push(err);
      }
    }
    if (failures.length) throw failures[0];
  };
  try {
    process.env.DATA_DIR = fixtureDir;
    process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
    process.env.NODE_ENV = "test";
    process.env.MARINARA_LITE = "true";
    process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
    process.env.LOG_LEVEL = "silent";

    const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
    const Fastify = requireServer("fastify") as typeof import("fastify").default;
    const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
    const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
    const { chatsRoutes } = await import("../../../packages/server/src/routes/chats.routes.js");
    const { galleryRoutes } = await import("../../../packages/server/src/routes/gallery.routes.js");
    const { agentsRoutes } = await import("../../../packages/server/src/routes/agents.routes.js");
    const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
    const { createAgentsStorage } = await import("../../../packages/server/src/services/storage/agents.storage.js");
    const { createConnectionsStorage } =
      await import("../../../packages/server/src/services/storage/connections.storage.js");
    const { createCharactersStorage } =
      await import("../../../packages/server/src/services/storage/characters.storage.js");
    const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
    const { characterDataSchema, replaceBuiltInAgentDefinitions } =
      await import("../../../packages/shared/dist/index.js");

    replaceBuiltInAgentDefinitions([
      {
        id: "illustrator",
        name: "Illustrator",
        description: "Roleplay video fixture",
        phase: "post_processing",
        enabledByDefault: true,
        category: "utility",
        defaultTools: [],
        defaultSettings: { contextSize: 2 },
        defaultPromptTemplate: 'AGENT_WRITER Return JSON {"shouldGenerate":true,"prompt":"..."}.',
      },
    ]);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    // Each avatar is a different file from Illustrator's picture, so a clip's first frame shows which it started from.
    const avatarPng = Buffer.concat([png, Buffer.from("avatar")]);
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);

    const replies = {
      main: "",
      agent: { shouldGenerate: false } as Record<string, unknown>,
      planner: { prompt: "Aster by the rainy window" } as Record<string, unknown>,
      /** Set to make the clip director answer differently once (for example out of budget). */
      director: null as { content: string; finishReason: string } | null,
    };
    const requests = {
      planner: [] as string[],
      director: [] as string[],
      directorMaxTokens: [] as number[],
      reply: [] as string[],
      agent: [] as string[],
      comfy: [] as string[],
      images: 0,
    };
    const provider = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      const url = request.url ?? "";
      const json = (value: unknown) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(value));
      };
      if (url.endsWith("/prompt")) {
        requests.comfy.push(body);
        return json({ prompt_id: "job" });
      }
      if (url.includes("/history/")) {
        return json({
          job: {
            status: { completed: true, status_str: "success" },
            outputs: { "9": { gifs: [{ filename: "clip.mp4", subfolder: "", type: "output" }] } },
          },
        });
      }
      if (url.startsWith("/view")) {
        response.setHeader("content-type", "video/mp4");
        return response.end(mp4);
      }
      if (url.endsWith("/images/generations")) {
        requests.images++;
        return json({ data: [{ b64_json: png.toString("base64") }] });
      }
      const messages = JSON.stringify(JSON.parse(body).messages ?? []);
      let content = replies.main;
      if (messages.includes("<source_exchange>")) {
        requests.director.push(messages);
        requests.directorMaxTokens.push(Number(JSON.parse(body).max_tokens ?? JSON.parse(body).max_completion_tokens));
        if (replies.director) {
          const once = replies.director;
          replies.director = null;
          return json({
            choices: [{ message: { role: "assistant", content: once.content }, finish_reason: once.finishReason }],
          });
        }
        content = JSON.stringify({ narrationBeat: "Bottles burst across the lab floor" });
      } else if (messages.includes("manual_gallery_illustration_request")) {
        requests.planner.push(messages);
        content = JSON.stringify(replies.planner);
      } else if (messages.includes("AGENT_WRITER")) {
        requests.agent.push(messages);
        content = JSON.stringify(replies.agent);
      } else if (messages.includes("video prompt writer")) {
        content = "Aster waves at the camera";
      } else if (messages.includes("hidden commands") || messages.includes("user-hidden commands")) {
        requests.reply.push(messages);
      } else if (messages.includes("selfie")) {
        content = "Aster smiling, close-up selfie";
      } else {
        requests.reply.push(messages);
      }
      json({
        choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { total_tokens: 20 },
      });
    });

    const db = await getDB();
    teardown.push(() => closeDB());
    const app = Fastify();
    teardown.push(() => app.close());
    app.decorate("db", db);
    await app.register(generateRoutes, { prefix: "/api/generate" });
    await app.register(chatsRoutes, { prefix: "/api/chats" });
    await app.register(galleryRoutes, { prefix: "/api/gallery" });
    await app.register(agentsRoutes, { prefix: "/api/agents" });
    const chats = createChatsStorage(db);
    const characters = createCharactersStorage(db);

    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    teardown.push(() => new Promise<void>((resolve) => provider.close(() => resolve())));
    const address = provider.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const connections = createConnectionsStorage(db);
    const text = await connections.create({
      name: "Text",
      provider: "custom",
      baseUrl: `${baseUrl}/v1`,
      model: "fixture",
      apiKey: "fixture",
    });
    const image = await connections.create({
      name: "Image",
      provider: "image_generation",
      baseUrl: `${baseUrl}/v1`,
      model: "dall-e-3",
      imageService: "openai",
      imageGenerationSource: "openai",
      apiKey: "fixture",
    });
    const video = await connections.create({
      name: "ComfyUI video",
      provider: "video_generation",
      baseUrl,
      model: "fixture-video",
      videoService: "comfyui",
      videoGenerationSource: "comfyui",
      comfyuiWorkflow: JSON.stringify({ "1": { inputs: { text: "%prompt%", image: "%reference_image%" } } }),
      apiKey: "",
    });
    await createAgentsStorage(db).create({
      type: "illustrator",
      name: "Illustrator",
      phase: "post_processing",
      connectionId: text.id,
      settings: { imageConnectionId: image.id, contextSize: 2, enabledTools: [] },
    });
    mkdirSync(join(fixtureDir, "avatars"), { recursive: true });
    writeFileSync(join(fixtureDir, "avatars", "aster.png"), avatarPng);
    const aster = await characters.create(characterDataSchema.parse({ name: "Aster" }), "/api/avatars/file/aster.png");
    assert.ok(aster);
    const prompts = createPromptsStorage(db);
    const preset = await prompts.create({ name: "Fixture", parameters: {}, wrapFormat: "xml" });
    assert.ok(preset);
    await prompts.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });

    /** A persona and a second character, each with an avatar file of its own and an appearance. */
    const addPersonaAndBram = async () => {
      const personaPng = Buffer.concat([png, Buffer.from("persona")]);
      const bramPng = Buffer.concat([png, Buffer.from("bram")]);
      writeFileSync(join(fixtureDir, "avatars", "james.png"), personaPng);
      writeFileSync(join(fixtureDir, "avatars", "bram.png"), bramPng);
      const james = await characters.createPersona("James", "The player.", "/api/avatars/file/james.png", {
        appearance: "James stands 6'3 with dark blue eyes",
      });
      const bram = await characters.create(
        characterDataSchema.parse({ name: "Bram", extensions: { appearance: "Bram wears a red scarf" } }),
        "/api/avatars/file/bram.png",
      );
      assert.ok(james && bram);
      return { james, bram, personaPng, bramPng };
    };

    return {
      app,
      db,
      chats,
      characters,
      replies,
      requests,
      png,
      avatarPng,
      text,
      image,
      video,
      aster,
      preset,
      addPersonaAndBram,
      /** Settings are saved through Chat Settings' own route; returns what the chat now holds. */
      saveChatSettings: async (chatId: string, patch: Record<string, unknown>) => {
        const response = await app.inject({ method: "PATCH", url: `/api/chats/${chatId}/metadata`, payload: patch });
        assert.equal(response.statusCode, 200, response.body);
        const raw = (await chats.getById(chatId))?.metadata;
        return (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
      },
      /** Illustrator's Agent Budget context size, set through the agents route. */
      setIllustratorContext: async (contextSize: number) => {
        const response = await app.inject({
          method: "PATCH",
          url: "/api/agents/type/illustrator",
          payload: { settings: { imageConnectionId: image.id, contextSize, enabledTools: [] } },
        });
        assert.equal(response.statusCode, 200, response.body);
      },
      attachments: async (chatId: string, type: "video" | "image") =>
        (await chats.listMessages(chatId)).flatMap((message) => {
          const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
          return ((extra as { attachments?: Array<{ type?: string; galleryId?: string }> }).attachments ?? []).filter(
            (attachment) => attachment.type === type,
          );
        }),
      lastComfyInputs: () =>
        (JSON.parse(requests.comfy.at(-1) ?? "{}") as { prompt?: Record<string, { inputs: Record<string, string> }> })
          .prompt?.["1"]?.inputs,
      generate: async (chatId: string, userMessage: string) => {
        const response = await app.inject({
          method: "POST",
          url: "/api/generate",
          payload: { chatId, userMessage, streaming: false },
        });
        assert.equal(response.statusCode, 200, response.body);
        return response.body;
      },
      /** A Roleplay chat with Aster, Illustrator on and the fixture's video connection. */
      createRoleplay: async (chatName: string, extra: Record<string, unknown> = {}) => {
        const chat = await chats.create({
          name: chatName,
          mode: "roleplay",
          characterIds: [aster.id],
          connectionId: text.id,
          promptPresetId: preset.id,
          ...extra,
        });
        assert.ok(chat);
        return chat;
      },
      close: runTeardown,
    };
  } catch (err) {
    await runTeardown().catch(() => undefined);
    throw err;
  }
}

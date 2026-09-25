import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function createChat(request: APIRequestContext, name: string) {
  const created = await request.post("/api/chats", {
    data: { name, mode: "roleplay", characterIds: [], connectionId: "synthetic-recovery-connection" },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const saved = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: `Saved narration for ${name}.` },
  });
  expect(saved.ok()).toBeTruthy();
  return { chatId: chat.id, messageId: ((await saved.json()) as { id: string }).id };
}

async function openFreshChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    messagesPerPage: 20,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    },
    { id: chatId, appVersion: version },
  );
  await page.goto("/");
}

test("a reopened chat receives a saved illustration after orphaned server work finishes", async ({
  page,
  request,
}, testInfo) => {
  const { chatId, messageId } = await createChat(request, "Reopened image generation");
  let serverActive = true;
  let statusReads = 0;
  await page.route(`**/api/generate/status/${chatId}`, (route) => {
    statusReads += 1;
    return route.fulfill({ json: { active: serverActive } });
  });
  try {
    await openFreshChat(page, chatId);
    const message = page.locator(`[data-message-id="${messageId}"]`);
    await expect(message).toBeVisible();
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options", exact: true }).click();
    }
    await page.getByRole("button", { name: "Gallery", exact: true }).filter({ visible: true }).click();
    const gallery = page.locator(".mari-chat-gallery-drawer");
    await expect(gallery.getByText("No images yet", { exact: true })).toBeVisible();
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 200;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#164e63";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#e0f2fe";
      context.font = "20px sans-serif";
      context.fillText("Saved illustration fixture", 32, 100);
      return canvas.toDataURL("image/png").split(",")[1]!;
    });
    const upload = await request.post(`/api/gallery/${chatId}/upload`, {
      multipart: {
        prompt: "Recovered illustration fixture",
        file: { name: "recovered-illustration.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") },
      },
    });
    expect(upload.ok()).toBeTruthy();
    const image = (await upload.json()) as { url: string };
    const patched = await request.patch(`/api/chats/${chatId}/messages/${messageId}/extra`, {
      data: { attachments: [{ type: "image", url: image.url, filename: "Recovered illustration fixture" }] },
    });
    expect(patched.ok()).toBeTruthy();
    // The previous browser process is gone: no illustration or done SSE is delivered.
    serverActive = false;
    await expect(gallery.getByRole("img", { name: "Recovered illustration fixture", exact: true })).toBeVisible();
    await gallery.getByRole("button", { name: "Close gallery", exact: true }).click();
    const recovered = message.getByRole("img", { name: "Recovered illustration fixture", exact: true });
    await expect(recovered).toBeVisible();
    await expect.poll(() => recovered.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(320);
    expect(statusReads).toBeGreaterThanOrEqual(2);
    await testInfo.attach("recovered-illustration", {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

test("idle chats do not poll and navigating away stops orphan recovery", async ({ page, request }) => {
  const first = await createChat(request, "Active orphan");
  const second = await createChat(request, "Idle chat");
  const reads = { active: 0, idle: 0 };
  await page.route(`**/api/generate/status/${first.chatId}`, (route) => {
    reads.active += 1;
    return route.fulfill({ json: { active: true } });
  });
  await page.route(`**/api/generate/status/${second.chatId}`, (route) => {
    reads.idle += 1;
    return route.fulfill({ json: { active: false } });
  });
  try {
    await openFreshChat(page, first.chatId);
    await expect.poll(() => reads.active).toBeGreaterThanOrEqual(2);
    await page.evaluate(async (chatId) => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      useChatStore.getState().setActiveChatId(chatId);
    }, second.chatId);
    await expect(page.locator(`[data-message-id="${second.messageId}"]`)).toBeVisible();
    await expect.poll(() => reads.idle).toBe(1);
    const afterNavigation = { ...reads };
    await page.waitForTimeout(2_200);
    expect(reads).toEqual(afterNavigation);
  } finally {
    await request.delete(`/api/chats/${first.chatId}`);
    await request.delete(`/api/chats/${second.chatId}`);
  }
});

test("orphan recovery yields to a resumed local stream and its typewriter", async ({ page, request }) => {
  const { chatId, messageId } = await createChat(request, "Local stream ownership");
  let serverActive = true;
  let statusReads = 0;
  let messageReads = 0;
  await page.route(`**/api/generate/status/${chatId}`, (route) => {
    statusReads += 1;
    return route.fulfill({ json: { active: serverActive } });
  });
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === `/api/chats/${chatId}/messages`) messageReads += 1;
  });
  try {
    await openFreshChat(page, chatId);
    await expect(page.locator(`[data-message-id="${messageId}"]`)).toBeVisible();
    await expect.poll(() => statusReads).toBeGreaterThanOrEqual(2);
    await page.evaluate(async (id) => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      const state = useChatStore.getState();
      state.setAbortController(id, new AbortController());
      state.setStreaming(true, id);
      state.setStreamBuffer("The local typewriter still owns this reply.", id);
    }, chatId);
    serverActive = false;
    const readsWithLocalOwner = { statusReads, messageReads };
    await page.waitForTimeout(1_200);
    expect({ statusReads, messageReads }).toEqual(readsWithLocalOwner);
    // Cleanup releases the network controller before the visible typewriter settles.
    await page.evaluate(async (id) => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      useChatStore.getState().setAbortController(id, null);
    }, chatId);
    await page.waitForTimeout(1_200);
    expect({ statusReads, messageReads }).toEqual(readsWithLocalOwner);
    await page.evaluate(async (id) => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as PageChatStoreModule;
      const { useAgentStore } = (await import("/src/stores/agent.store.ts" as string)) as PageAgentStoreModule;
      useAgentStore.getState().setProcessingRun("local-illustrator-tail", true, id);
      useChatStore.getState().setStreaming(false, id);
      useChatStore.getState().clearStreamBuffer(id);
    }, chatId);
    // The durable reply may release the composer while its local agent SSE lives on.
    await page.waitForTimeout(1_200);
    expect({ statusReads, messageReads }).toEqual(readsWithLocalOwner);
    await page.evaluate(async (id) => {
      const { useAgentStore } = (await import("/src/stores/agent.store.ts" as string)) as PageAgentStoreModule;
      useAgentStore.getState().setProcessingRun("local-illustrator-tail", false, id);
    }, chatId);
    await expect.poll(() => statusReads).toBeGreaterThan(readsWithLocalOwner.statusReads);
    await page.waitForTimeout(1_200);
    expect(messageReads).toBe(readsWithLocalOwner.messageReads);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});

for (const stage of ["assistant-ready", "transport-done", "live-provider", "partial-save"] as const) {
  test(`Roleplay Stop releases buffered text and the composer (${stage})`, async ({ page, request }, testInfo) => {
    const replyText = "The lantern lights the quiet path. ".repeat(30).trim();
    const holdsProvider = stage === "live-provider" || stage === "partial-save";
    const nextReplyText = "The second generation keeps its own live reply.";
    let releasePartialSave = () => {};
    const partialSaveGate = new Promise<void>((resolve) => {
      releasePartialSave = resolve;
    });
    let partialSaveHeld = false;
    const openResponses = new Set<ServerResponse>();
    let providerCalls = 0;
    const provider = createServer((incoming, response) => {
      incoming.resume();
      incoming.on("end", () => {
        if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
          return;
        }
        providerCalls += 1;
        openResponses.add(response);
        response.on("close", () => openResponses.delete(response));
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        const content = stage === "partial-save" && providerCalls > 1 ? nextReplyText : replyText;
        response.write(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`,
        );
        if (!holdsProvider) {
          response.end(
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
          );
        }
      });
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    let connectionId = "";
    let characterId = "";
    let chatId = "";
    try {
      const address = provider.address();
      if (!address || typeof address === "string") throw new Error("Stop fixture provider did not bind");
      const connection = await request.post("/api/connections", {
        data: {
          name: "Stop fixture",
          provider: "custom",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "fixture",
          model: "fixture",
          maxContext: 32768,
        },
      });
      expect(connection.ok()).toBeTruthy();
      connectionId = (await connection.json()).id;
      const character = await request.post("/api/characters", {
        data: { data: { name: "Stop fixture", first_mes: "" } },
      });
      expect(character.ok()).toBeTruthy();
      characterId = (await character.json()).id;
      const chat = await request.post("/api/chats", {
        data: { name: `Stop at ${stage}`, mode: "roleplay", characterIds: [characterId], connectionId },
      });
      expect(chat.ok()).toBeTruthy();
      chatId = (await chat.json()).id;
      expect(
        (await request.patch(`/api/chats/${chatId}/metadata`, { data: { enableAgents: false } })).ok(),
      ).toBeTruthy();
      if (stage === "transport-done") {
        // The ready event is optional: also cover draining after the reader has
        // already finished, where aborting fetch alone cannot interrupt it.
        await page.route("**/api/generate", async (route) => {
          const response = await route.fetch();
          const body = (await response.text())
            .split("\n")
            .filter((line) => {
              if (!line.startsWith("data: ") || line === "data: [DONE]") return true;
              return JSON.parse(line.slice(6)).type !== "assistant_message_ready";
            })
            .join("\n");
          await route.fulfill({ response, body });
        });
      }
      if (stage === "partial-save") {
        // An empty Retry generates without a new user row, so Stop persists the
        // partial assistant reply in its normal client cleanup path.
        expect(
          (
            await request.post(`/api/chats/${chatId}/messages`, {
              data: { role: "user", content: "Tell me about the path." },
            })
          ).ok(),
        ).toBeTruthy();
        await page.route(`**/api/chats/${chatId}/messages`, async (route) => {
          if (route.request().method() !== "POST" || route.request().postDataJSON()?.role !== "assistant") {
            await route.continue();
            return;
          }
          const response = await route.fetch();
          expect(response.ok()).toBeTruthy();
          partialSaveHeld = true;
          await partialSaveGate;
          await route.fulfill({ response });
        });
      }
      await openFreshChat(page, chatId);
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.setState({ enableStreaming: true, streamingSpeed: 1, reduceAmbientEffects: false });
      });
      const send = page.locator("button.mari-chat-send-btn");
      const pause = send.locator("svg.lucide-circle-stop");
      const input = page.locator("textarea.mari-chat-input-textarea");
      if (stage === "partial-save") {
        await page.evaluate((id) => {
          const completed: string[] = [];
          Object.assign(window, { stoppedGenerationCompletions: completed });
          window.addEventListener("marinara:generation-complete", (event) => {
            if ((event as CustomEvent).detail?.chatId === id) completed.push(id);
          });
        }, chatId);
      }
      if (stage !== "partial-save") await input.fill("Tell me about the path.");
      await send.click();
      await expect.poll(() => providerCalls).toBe(1);
      await expect(pause).toBeVisible();
      const readState = () =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          const state = useChatStore.getState();
          return {
            streaming: state.isStreaming,
            owned: state.abortControllers.has(id),
            length: state.streamBuffer.length,
          };
        }, chatId);
      await expect.poll(async () => (await readState()).length).toBeGreaterThan(0);
      expect((await readState()).length).toBeLessThan(replyText.length - 200);
      const readReplies = async () =>
        (await (await request.get(`/api/chats/${chatId}/messages`)).json()) as Array<{
          id: string;
          role: string;
          content: string;
        }>;
      if (!holdsProvider) {
        await expect
          .poll(async () =>
            (await readReplies()).filter((message) => message.role === "assistant").map((message) => message.content),
          )
          .toEqual([replyText]);
      } else {
        expect(openResponses.size).toBe(1);
      }
      await page.screenshot({ path: testInfo.outputPath("before-stop.png") });
      const aborted = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/generate/abort" && response.request().method() === "POST",
      );
      await send.click();
      expect((await aborted).ok()).toBeTruthy();
      if (stage === "partial-save") {
        await expect.poll(() => partialSaveHeld).toBe(true);
        await expect.poll(async () => (await readState()).owned).toBe(false);
        await expect.poll(() => openResponses.size).toBe(0);
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setActiveChatId(null);
        });
        await expect(pause).toHaveCount(0);
        await page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useChatStore.getState().setActiveChatId(id);
          useUIStore.setState({ streamingSpeed: 100 });
        }, chatId);
        await input.fill("Continue with a second reply.");
        await send.click();
        await expect.poll(() => providerCalls).toBe(2);
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
              return useUIStore.getState().streamingSpeed;
            }),
          )
          .toBe(100);
        await expect.poll(readState).toMatchObject({ streaming: true, owned: true });
        await expect.poll(async () => (await readState()).length).toBeGreaterThan(0);
        const visibleLengthBeforeSave = (await readState()).length;
        const partialSaveResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === `/api/chats/${chatId}/messages` &&
            response.request().method() === "POST",
        );
        releasePartialSave();
        expect((await partialSaveResponse).ok()).toBeTruthy();
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as unknown as { stoppedGenerationCompletions: string[] }).stoppedGenerationCompletions.length,
            ),
          )
          .toBe(1);
        await expect.poll(readState, { timeout: 2_000 }).toMatchObject({ streaming: true, owned: true });
        expect((await readState()).length).toBeGreaterThanOrEqual(visibleLengthBeforeSave);
        await expect(pause).toBeVisible();
        await send.click();
        await expect.poll(() => openResponses.size).toBe(0);
        return;
      }
      await expect(pause).toHaveCount(0, { timeout: 2_000 });
      await expect.poll(readState, { timeout: 2_000 }).toEqual({ streaming: false, owned: false, length: 0 });
      await expect.poll(() => openResponses.size).toBe(0);
      if (!holdsProvider) {
        await expect
          .poll(async () =>
            (await readReplies()).filter((message) => message.role === "assistant").map((message) => message.content),
          )
          .toEqual([replyText]);
      }
      await input.fill("I can write the next turn.");
      await expect(send).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath("after-stop.png") });
    } finally {
      releasePartialSave();
      await page.close().catch(() => undefined);
      for (const response of openResponses) response.end();
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
      if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
      if (characterId) await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    }
  });
}

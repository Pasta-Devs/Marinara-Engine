import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

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
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            messagesPerPage: 20,
            chatHelpSeenModes: ["conversation", "roleplay", "game"],
          },
          version: 65,
        }),
      );
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

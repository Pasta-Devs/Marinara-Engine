import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const extra = (value: unknown): Record<string, any> => (typeof value === "string" ? JSON.parse(value) : (value ?? {}));
const contentOf = (body: any) => body.messages.map((message: any) => message.content).join("\n");

async function openChat(page: Page, chatId: string) {
  page.setDefaultTimeout(10_000);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["roleplay"],
    debugMode: false,
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { id: chatId, version },
  );
  await page.goto("/");
}

async function createFixture(request: APIRequestContext, baseUrl: string, names: string[]) {
  const resources: string[] = [];
  const create = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const value = await response.json();
    resources.unshift(`${path}/${value.id}`);
    return value;
  };
  const connection = await create("/api/connections", {
    name: "Roleplay command fixture",
    provider: "custom",
    baseUrl,
    apiKey: "synthetic-test-key",
    model: "roleplay-fixture",
    maxContext: 32768,
    treatAsLocalEndpoint: true,
  });
  const characters = [];
  for (const name of names) characters.push(await create("/api/characters", { data: { name } }));
  const chat = await create("/api/chats", {
    name: "Roleplay command proof",
    mode: "roleplay",
    characterIds: characters.map((character) => character.id),
    connectionId: connection.id,
  });
  const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: false, enableTools: false, groupChatMode: "individual", groupResponseOrder: "manual" },
  });
  expect(metadataResponse.ok(), await metadataResponse.text()).toBeTruthy();
  const seedResponse = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "user", content: "Begin the scene." },
  });
  expect(seedResponse.ok(), await seedResponse.text()).toBeTruthy();
  return {
    chat,
    characters,
    resources,
    cleanup: async () => {
      for (const path of resources) await request.delete(path).catch(() => undefined);
    },
  };
}

test("Roleplay commands default off, scope private notes, and follow swipes and branches", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const requests: any[] = [];
  const sequence: string[] = [];
  let output =
    'She smiles. [notes: content="OFF_SECRET"] [document: title="Off document", content="Hidden while disabled"]';
  const provider = createServer(async (incoming, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: sequence.shift() ?? output }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  const fixture = await createFixture(request, `http://127.0.0.1:${address.port}/v1`, ["Alice", "Bob", "Narrator"]);
  const { chat, characters } = fixture;
  const alice = characters[0]!.id,
    bob = characters[1]!.id,
    narrator = characters[2]!.id;
  const rows = async () => (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as any[];
  const generate = async (characterId: string, options = {}) => {
    const response = await request.post("/api/generate", {
      data: { chatId: chat.id, forCharacterId: characterId, ...options },
    });
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).not.toContain("event: error\n");
    return (await rows()).filter((message) => message.role === "assistant").at(-1);
  };
  const preview = async (characterId: string, chatId = chat.id) => {
    const response = await request.post("/api/generate/dryRun", {
      data: { chatId, forCharacterId: characterId, returnPrompt: true },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return contentOf((await response.json()).prompt);
  };
  try {
    const off = await generate(alice);
    expect(off.content).not.toContain("OFF_SECRET");
    expect(extra(off.extra).roleplayPrivateCommands).toBeNull();
    expect(extra(off.extra).roleplayDocuments).toEqual([]);
    expect(contentOf(requests.at(-1))).not.toContain("<commands>");
    await openChat(page, chat.id);
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const section = page.locator('[data-chat-settings-section="roleplay-agents"]');
    const header = section.locator('[role="button"][aria-expanded]').first();
    if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
    const commands = page.locator("[data-roleplay-commands]");
    await commands.getByRole("button", { name: "Expand Commands", exact: true }).click();
    await expect(commands.getByRole("checkbox", { name: /^Commands\b/u })).not.toBeChecked();
    await commands
      .locator("label")
      .filter({ hasText: /^Commands$/u })
      .click();
    for (const label of [
      "Illustrations",
      "Documents",
      "Sound Cues",
      "Soundtrack",
      "Personal Notes",
      "Reminders",
      "Rolls",
      "Direct Messages",
    ]) {
      await expect(commands.getByRole("checkbox", { name: new RegExp(`^${label}\\b`, "u") })).not.toBeChecked();
    }
    for (const label of ["Personal Notes", "Reminders", "Documents"]) {
      await expect(commands.getByRole("checkbox", { name: new RegExp(`^${label}\\b`, "u") })).toBeEnabled();
      await commands
        .locator("label")
        .filter({ hasText: new RegExp(`^${label}$`, "u") })
        .click();
      await expect(commands.getByRole("checkbox", { name: new RegExp(`^${label}\\b`, "u") })).toBeChecked();
    }
    const narratorSelect = commands.getByRole("combobox", { name: /^Narrator with access to personal notes/u });
    await narratorSelect.selectOption(narrator);
    await expect
      .poll(
        async () =>
          extra((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).roleplayCommandNarratorId,
      )
      .toBe(narrator);
    await expect(commands).not.toContainText("Scene Break");
    await testInfo.attach(`roleplay-commands-${testInfo.project.name}.png`, {
      body: await commands.screenshot({ animations: "disabled", path: testInfo.outputPath("roleplay-commands.png") }),
      contentType: "image/png",
    });
    const bounds = await commands.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);

    output =
      'She hands you a letter. [notes: content="ALICE_SECRET: I lied; the key is in my coat."] [memory: id="key", content="ALICE_REMINDER: retrieve it tonight"] [document: title="Invitation", kind="letter", content="Meet at dawn."]';
    const noteMessage = await generate(alice);
    expect(contentOf(requests.at(-1))).toContain("<commands>");
    expect(noteMessage.content).not.toContain("ALICE_SECRET");
    expect(extra(noteMessage.extra).roleplayPrivateCommands).toHaveLength(2);
    await page.reload();
    const document = page.locator("[data-roleplay-command-results]");
    await expect(document).toContainText("Invitation");
    await document.getByLabel("Read Invitation", { exact: true }).click();
    await expect(document).toContainText("Meet at dawn.");
    await expect(page.locator("body")).not.toContainText("ALICE_SECRET");
    await expect(page.locator("body")).not.toContainText("ALICE_REMINDER");

    output = "Bob watches the door.";
    await generate(bob);
    expect(contentOf(requests.at(-1))).not.toContain("ALICE_SECRET");
    expect(contentOf(requests.at(-1))).not.toContain("ALICE_REMINDER");
    expect(contentOf(requests.at(-1))).toContain("Meet at dawn.");
    output = "A carriage passes outside.";
    await generate(narrator);
    expect(contentOf(requests.at(-1))).toContain("ALICE_SECRET");
    expect(contentOf(requests.at(-1))).toContain("ALICE_REMINDER");
    expect(await preview(alice)).toContain("ALICE_SECRET");
    expect(await preview(bob)).not.toContain("ALICE_SECRET");
    expect(await preview(narrator)).toContain("ALICE_SECRET");

    output = 'She corrects her story. [notes: content="REPLACEMENT_SECRET"]';
    await generate(alice, { regenerateMessageId: noteMessage.id });
    // A regenerated turn cannot read notes created by itself or later messages.
    expect(contentOf(requests.at(-1))).not.toContain("ALICE_SECRET");
    expect(await preview(alice)).toContain("REPLACEMENT_SECRET");
    expect(await preview(alice)).not.toContain("ALICE_REMINDER");
    const switched = await request.put(`/api/chats/${chat.id}/messages/${noteMessage.id}/active-swipe`, {
      data: { index: 0 },
    });
    expect(switched.ok()).toBeTruthy();
    expect(await preview(alice)).toContain("ALICE_SECRET");
    expect(await preview(alice)).toContain("ALICE_REMINDER");
    const branch = await request.post(`/api/chats/${chat.id}/branch`, { data: { upToMessageId: noteMessage.id } });
    expect(branch.ok(), await branch.text()).toBeTruthy();
    const branched = await branch.json();
    fixture.resources.unshift(`/api/chats/${branched.id}`);
    expect(await preview(alice, branched.id)).toContain("ALICE_SECRET");
    output = '[notes: content="CONTINUED_SECRET"]';
    await generate(alice, { continueMessageId: noteMessage.id });
    expect(contentOf(requests.at(-1))).toContain("ALICE_SECRET");
    expect(await preview(alice)).toContain("CONTINUED_SECRET");
    expect(await preview(alice)).toContain("ALICE_REMINDER");
    const continued = (await rows()).find((message) => message.id === noteMessage.id);
    expect(extra(continued.extra).roleplayDocuments).toHaveLength(1);
    expect(extra(continued.extra).hiddenFromUser).not.toBe(true);
    output = '[dismiss_notes] [dismiss_memory: id="key"]';
    const dismissed = await generate(alice);
    expect(extra(dismissed.extra).hiddenFromUser).toBe(true);
    expect(await preview(alice)).not.toContain("ALICE_SECRET");
    expect(await preview(alice)).not.toContain("ALICE_REMINDER");
    expect(await preview(alice)).not.toContain("CONTINUED_SECRET");
    expect(await preview(alice, branched.id)).toContain("ALICE_SECRET");
    output = "She speaks instead.";
    const visibleSwipe = await generate(alice, { regenerateMessageId: dismissed.id });
    expect(extra(visibleSwipe.extra).hiddenFromUser).toBe(false);
    expect(await preview(alice)).toContain("CONTINUED_SECRET");
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { groupResponseOrder: "sequential" } });
    const beforeBatch = requests.length;
    sequence.push(
      '[notes: content="BATCH_SECRET"] [document: title="Clue", content="BATCH_DOCUMENT"]',
      "Bob listens.",
      "The narrator describes the street.",
    );
    const batch = await request.post("/api/generate", { data: { chatId: chat.id } });
    expect(batch.ok()).toBeTruthy();
    expect(requests.length - beforeBatch).toBe(3);
    expect(contentOf(requests[beforeBatch + 1])).not.toContain("BATCH_SECRET");
    expect(contentOf(requests[beforeBatch + 1])).toContain("BATCH_DOCUMENT");
    expect(contentOf(requests[beforeBatch + 2])).toContain("BATCH_SECRET");
  } finally {
    await fixture.cleanup();
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

test("Roleplay sound commands reuse cached audio and play the attachment URL", async ({ page, request }, testInfo) => {
  const description = `A clear bell rings for ${testInfo.project.name}`;
  const hash = createHash("sha256").update(`sfx\0${description.toLowerCase()}`).digest("hex");
  const relativePath = `sfx/generated/${hash}.mp3`;
  const audioUrl = `/api/game-assets/file/${relativePath}`;
  const cacheDirectory = resolve(
    ".tmp/playwright-data",
    testInfo.project.name.includes("mobile") ? "mobile" : "desktop",
    "game-assets/sfx/generated",
  );
  mkdirSync(cacheDirectory, { recursive: true });
  // A short PCM tone exercises browser playback from the cached file. No audio
  // provider is contacted; the synthetic connection also uses a reserved domain.
  const wave = Buffer.alloc(44 + 1600);
  wave.write("RIFF");
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8000, 24);
  wave.writeUInt32LE(16000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(1600, 40);
  for (let sample = 0; sample < 800; sample++)
    wave.writeInt16LE(Math.round(Math.sin((sample * Math.PI) / 8) * 2000), 44 + sample * 2);
  const cachePath = resolve(cacheDirectory, `${hash}.mp3`);
  writeFileSync(cachePath, wave);
  const provider = createServer(async (incoming, response) => {
    for await (const _chunk of incoming) {
      /* drain the local model request */
    }
    const content = `The bell rings. [sound: description="${description}"]`;
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  const fixture = await createFixture(request, `http://127.0.0.1:${address.port}/v1`, ["Alice"]);
  try {
    const audio = await request.post("/api/connections", {
      data: {
        name: "Cached sound fixture",
        provider: "audio",
        audioSource: "elevenlabs",
        apiKey: "synthetic-test-key",
        baseUrl: "https://audio-fixture.invalid",
        audioSoundEffects: true,
      },
    });
    expect(audio.ok()).toBeTruthy();
    const audioId = (await audio.json()).id;
    fixture.resources.unshift(`/api/connections/${audioId}`);
    await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
      data: {
        roleplayCommandsEnabled: true,
        roleplayCommandToggles: { sound: true },
        roleplaySoundConnectionId: audioId,
      },
    });
    await openChat(page, fixture.chat.id);
    const playbackRequest = page.waitForRequest((outgoing) => outgoing.url().endsWith(audioUrl));
    await page.locator("textarea[data-chat-composer]").fill("Ring the bell.");
    await page.locator(".mari-chat-send-btn").click();
    await playbackRequest;
    await expect(page.locator(`[data-roleplay-command-results] audio[src="${audioUrl}"]`)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("[sound:");
    const messages = await (await request.get(`/api/chats/${fixture.chat.id}/messages`)).json();
    const message = messages.filter((row: any) => row.role === "assistant").at(-1);
    expect(extra(message.extra).attachments).toMatchObject([{ roleplaySound: true, url: audioUrl }]);
    const swipes = await (await request.get(`/api/chats/${fixture.chat.id}/messages/${message.id}/swipes`)).json();
    expect(extra(swipes[0].extra).attachments).toMatchObject([{ roleplaySound: true, url: audioUrl }]);
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const section = page.locator('[data-chat-settings-section="roleplay-agents"]');
    const header = section.locator('[role="button"][aria-expanded]').first();
    if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
    const commands = page.locator("[data-roleplay-commands]");
    await commands.getByRole("button", { name: "Expand Commands", exact: true }).click();
    const soundConnection = commands.getByRole("combobox", { name: /^Sound effects connection/u });
    await expect(soundConnection).toHaveValue(audioId);
    await expect(soundConnection.locator(`option[value="${audioId}"]`)).toHaveText("Cached sound fixture");
  } finally {
    await fixture.cleanup();
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
    rmSync(cachePath, { force: true });
  }
});

for (const native of [true, false]) {
  test(`Roleplay resolves a ${native ? "native" : "textual"} roll before continuing the streamed reply`, async ({
    page,
    request,
  }, testInfo) => {
    let finishFollowup: (() => void) | undefined;
    let total = 0;
    let requestCount = 0;
    let firstStreamClosed = false;
    let firstRequestTools: string[] = [];
    let resultMessageFound = false;
    let followupPrompt = "";
    const provider = createServer(async (incoming, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requestCount++;
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      const write = (delta: unknown, finishReason: string | null = null) =>
        response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
      if (requestCount === 1) {
        firstRequestTools = (body.tools ?? []).map((tool: any) => tool.function?.name);
        write({ content: "I attempt the lock." });
        if (native) {
          write(
            {
              tool_calls: [
                {
                  index: 0,
                  id: "real-roll",
                  type: "function",
                  function: { name: "roll_dice", arguments: JSON.stringify({ notation: "1d6+3" }) },
                },
              ],
            },
            "tool_calls",
          );
          response.end("data: [DONE]\n\n");
        } else {
          // Keep the provider streaming indefinitely. The engine must interrupt
          // as soon as the command is complete, discard invented outcomes, and resume.
          response.on("close", () => {
            firstStreamClosed = true;
          });
          write({ content: " [ro" });
          write({ content: 'll: notation="1d6+3", reason="Need four"] INVENTED_OUTCOME' });
        }
      } else {
        const resultMessage = body.messages.find((message: any) =>
          native
            ? message.role === "tool"
            : message.role === "user" &&
              typeof message.content === "string" &&
              message.content.includes("The engine resolved your roll request:"),
        );
        resultMessageFound = Boolean(resultMessage);
        followupPrompt = contentOf(body);
        try {
          const result = native
            ? JSON.parse(resultMessage?.content ?? "{}")
            : JSON.parse(resultMessage?.content?.split("\n")[1] ?? "{}");
          total = result.total ?? 0;
        } catch {
          total = 0; // Assert malformed results in the test body so its cleanup can finish the response.
        }
        response.flushHeaders();
        finishFollowup = () => {
          write({ content: ` The engine rolled ${total}; the lock opens.` }, "stop");
          response.end("data: [DONE]\n\n");
        };
      }
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Fixture did not bind");
    const fixture = await createFixture(request, `http://127.0.0.1:${address.port}/v1`, ["Alice"]);
    try {
      const metadataResponse = await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
        data: { roleplayCommandsEnabled: true, roleplayCommandToggles: { roll: true } },
      });
      expect(metadataResponse.ok(), await metadataResponse.text()).toBeTruthy();
      await openChat(page, fixture.chat.id);
      await page.locator("textarea[data-chat-composer]").fill("Try the lock.");
      await page.locator(".mari-chat-send-btn").click();
      await expect.poll(() => Boolean(finishFollowup)).toBe(true);
      expect(firstRequestTools).toEqual(["roll_dice"]);
      expect(resultMessageFound).toBe(true);
      expect(followupPrompt).not.toContain("INVENTED_OUTCOME");
      expect(total).toBeGreaterThanOrEqual(4);
      expect(total).toBeLessThanOrEqual(9);
      if (!native) await expect.poll(() => firstStreamClosed).toBe(true);
      await expect(page.getByText(`1d6+3: ${total}`, { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
            return { streaming: useChatStore.getState().isStreaming, text: useChatStore.getState().streamBuffer };
          }),
        )
        .toEqual({ streaming: true, text: native ? "I attempt the lock." : "I attempt the lock. " });
      await expect(page.locator("body")).not.toContainText("INVENTED_OUTCOME");
      await testInfo.attach(`roleplay-roll-${native}-${testInfo.project.name}.png`, {
        body: await page.screenshot({ animations: "disabled", path: testInfo.outputPath("roleplay-roll.png") }),
        contentType: "image/png",
      });
      finishFollowup!();
      finishFollowup = undefined;
      await expect(page.getByText(new RegExp(`The engine rolled ${total}; the lock opens\\.`, "u"))).toBeVisible();
      const messages = await (await request.get(`/api/chats/${fixture.chat.id}/messages`)).json();
      const saved = messages.filter((message: any) => message.role === "assistant").at(-1);
      expect(saved.content).not.toContain("[roll");
      expect(saved.content).not.toContain("INVENTED_OUTCOME");
      expect(extra(saved.extra).diceRollResult.total).toBe(total);
      expect(requestCount).toBe(2);
    } finally {
      finishFollowup?.();
      await request.post("/api/generate/abort", { data: { chatId: fixture.chat.id } });
      await fixture.cleanup();
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
    }
  });
}

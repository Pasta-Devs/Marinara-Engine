import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const extra = (value: unknown): Record<string, any> => (typeof value === "string" ? JSON.parse(value) : (value ?? {}));
const contentOf = (body: any) => body.messages.map((message: any) => message.content).join("\n");
const sharp = createRequire(new URL("../packages/server/package.json", import.meta.url))("sharp");

async function openChat(page: Page, chatId: string, state = {}) {
  page.setDefaultTimeout(10_000);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["roleplay"],
    debugMode: false,
    streamingSpeed: 100,
    appAccentPulseMode: false,
    ...state,
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

test("Roleplay command settings stay interactive during slow saves and preserve rapid changes", async ({
  page,
  request,
}, testInfo) => {
  const fixture = await createFixture(request, "http://127.0.0.1:9/v1", ["Alice", "Narrator"]);
  const { chat, characters } = fixture;
  let releaseSave!: () => void;
  const pendingSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const patches: any[] = [];
  try {
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
    await page.route(`**/api/chats/${chat.id}/metadata`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      patches.push(route.request().postDataJSON());
      if (patches.length === 1) await pendingSave;
      await route.continue();
    });
    const toggle = async (label: string) => {
      await commands
        .locator("label")
        .filter({ hasText: new RegExp(`^${label}$`, "u") })
        .click();
    };
    const started = Date.now();
    await toggle("Commands");
    const documents = commands.getByRole("checkbox", { name: /^Documents\b/u });
    await expect(documents).toBeVisible();
    await expect.poll(() => patches.length).toBe(1);
    await testInfo.attach("pending-save-controls", {
      body: JSON.stringify({
        elapsedMs: Date.now() - started,
        networkSavePending: true,
        documentsDisabled: await documents.isDisabled(),
      }),
      contentType: "application/json",
    });
    await page.screenshot({ path: testInfo.outputPath("pending-save.png"), animations: "disabled" });
    await expect(documents).toBeEnabled({ timeout: 300 });
    for (const label of ["Documents", "Personal Notes", "Rolls", "Personal Notes", "Personal Notes"]) {
      await toggle(label);
    }
    const audience = commands.getByRole("combobox", { name: "Who can create documents", exact: true });
    await expect(audience).toHaveValue("all");
    await audience.selectOption("narrator");
    await expect(audience).toHaveAccessibleDescription("Choose a Narrator character below to allow this command.");
    await commands.getByRole("combobox", { name: /^Narrator character/u }).selectOption(characters[1]!.id);
    await expect(audience).not.toHaveAttribute("aria-describedby");
    await expect(documents).toBeChecked();
    await expect(commands.getByRole("checkbox", { name: /^Personal Notes\b/u })).toBeChecked();
    expect(patches).toHaveLength(1);
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.setState({ theme });
      }, theme);
      await audience.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`command-settings-${theme}.png`), animations: "disabled" });
    }
    const bounds = await commands.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    releaseSave();
    const stored = async () => extra((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata);
    await expect.poll(stored).toMatchObject({
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { document: true, notes: true, roll: true },
      roleplayDocumentAudience: "narrator",
      roleplayCommandNarratorId: characters[1]!.id,
    });
    await page.unrouteAll({ behavior: "wait" });
    let failedSaves = 0;
    let releaseFailure!: () => void;
    const pendingFailure = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    await page.route(`**/api/chats/${chat.id}/metadata`, async (route) => {
      if (route.request().postDataJSON()?.roleplayCommandToggles) {
        failedSaves++;
        await pendingFailure;
        return route.fulfill({ status: 500, json: { error: "Synthetic save failure" } });
      }
      await route.continue();
    });
    try {
      await toggle("Personal Notes");
      await expect.poll(() => failedSaves).toBe(1);
      await toggle("Documents");
      await commands.getByRole("combobox", { name: "Who can roll dice", exact: true }).selectOption("narrator");
    } finally {
      releaseFailure();
    }
    await expect.poll(() => failedSaves).toBe(2);
    await expect(documents).toBeChecked();
    await expect(commands.getByRole("checkbox", { name: /^Personal Notes\b/u })).toBeChecked();
    await expect.poll(stored).toMatchObject({
      roleplayRollAudience: "narrator",
      roleplayCommandToggles: { document: true, notes: true, roll: true },
    });
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return useChatStore.getState().activeChat?.metadata;
        }),
      )
      .toMatchObject({
        roleplayCommandToggles: { document: true, notes: true, roll: true },
        roleplayDocumentAudience: "narrator",
      });
  } finally {
    releaseSave();
    await page.unrouteAll({ behavior: "wait" });
    await fixture.cleanup();
  }
});

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
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(404).end();
      return;
    }
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
    expect(extra(off.extra).roleplayCommandActivity).toEqual([]);
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
      "Combat",
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
    const narratorSelect = commands.getByRole("combobox", { name: /^Narrator character/u });
    await narratorSelect.selectOption(narrator);
    await expect
      .poll(
        async () =>
          extra((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).roleplayCommandNarratorId,
      )
      .toBe(narrator);
    await expect(commands).not.toContainText("Scene Break");
    await expect(commands.getByRole("checkbox", { name: /^Combat\b/u })).toBeDisabled();
    await expect(commands.getByRole("checkbox", { name: /^Illustrations\b/u })).toBeDisabled();
    await commands
      .locator("label")
      .filter({ hasText: /^Rolls$/u })
      .click();
    const rollAudience = commands.getByRole("combobox", { name: "Who can roll dice", exact: true });
    await expect(rollAudience).toHaveValue("all");
    await rollAudience.selectOption("narrator");
    await expect
      .poll(
        async () => extra((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).roleplayRollAudience,
      )
      .toBe("narrator");
    await narratorSelect.selectOption("");
    await expect(rollAudience).toHaveAccessibleName("Who can roll dice");
    await expect(rollAudience).toHaveAccessibleDescription("Choose a Narrator character below to allow this command.");
    await narratorSelect.selectOption(narrator);
    await expect(rollAudience).not.toHaveAttribute("aria-describedby");
    expect(await preview(alice)).not.toContain("roll_dice");
    expect(await preview(alice)).not.toContain("[roll:");
    expect(await preview(narrator)).toContain("[roll:");
    await testInfo.attach(`roleplay-commands-${testInfo.project.name}.png`, {
      body: await page.screenshot({ animations: "disabled", path: testInfo.outputPath("roleplay-commands.png") }),
      contentType: "image/png",
    });
    const bounds = await commands.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);

    output =
      'She hands you a letter. [notes: content="ALICE_SECRET: I lied; the key is in my coat."] [memory: id="key", content="ALICE_REMINDER: retrieve it tonight"] [document: title="Invitation", kind="letter", content="Meet at dawn."]';
    const noteMessage = await generate(alice);
    expect(contentOf(requests.at(-1))).toContain("<commands>");
    expect(noteMessage.content).not.toContain("ALICE_SECRET");
    expect(extra(noteMessage.extra).roleplayCommandActivity).toHaveLength(3);
    await page.reload();
    const document = page.locator("[data-roleplay-command-results]");
    await expect(document.getByRole("article", { name: "Invitation", exact: true })).toContainText("Meet at dawn.");
    await document.getByRole("button", { name: "Alice used document command!", exact: true }).click();
    await expect(document).toContainText("Meet at dawn.");
    await testInfo.attach(`roleplay-document-${testInfo.project.name}.png`, {
      body: await page.screenshot({ animations: "disabled", path: testInfo.outputPath("roleplay-document.png") }),
      contentType: "image/png",
    });
    await expect(page.locator("body")).not.toContainText("ALICE_SECRET");
    await expect(page.locator("body")).not.toContainText("ALICE_REMINDER");

    output = "Bob watches the door.";
    await generate(bob);
    expect(contentOf(requests.at(-1))).not.toContain("ALICE_SECRET");
    expect(contentOf(requests.at(-1))).not.toContain("ALICE_REMINDER");
    expect(contentOf(requests.at(-1))).toContain("Meet at dawn.");
    output = 'A carriage passes outside. [document: title="Future letter" content="FUTURE_DOCUMENT"]';
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
    expect(contentOf(requests.at(-1))).not.toContain("ALICE_REMINDER");
    expect(contentOf(requests.at(-1))).not.toContain("Meet at dawn.");
    expect(contentOf(requests.at(-1))).not.toContain("FUTURE_DOCUMENT");
    expect(
      extra((await rows()).find((message) => message.id === noteMessage.id).extra).roleplayCommandActivity,
    ).toHaveLength(1);
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
    expect(contentOf(requests.at(-1))).toContain("Meet at dawn.");
    expect(contentOf(requests.at(-1))).not.toContain("FUTURE_DOCUMENT");
    expect(await preview(alice)).toContain("CONTINUED_SECRET");
    expect(await preview(alice)).toContain("ALICE_REMINDER");
    const continued = (await rows()).find((message) => message.id === noteMessage.id);
    expect(
      extra(continued.extra).roleplayCommandActivity.filter((item: any) => item.command.type === "document"),
    ).toHaveLength(1);
    expect(extra(continued.extra).hiddenFromUser).not.toBe(true);
    output = '[dismiss_notes] [dismiss_memory: id="key"]';
    const dismissed = await generate(alice);
    expect(extra(dismissed.extra).hiddenFromUser).not.toBe(true);
    expect(await preview(alice)).not.toContain("ALICE_SECRET");
    expect(await preview(alice)).not.toContain("ALICE_REMINDER");
    expect(await preview(alice)).not.toContain("CONTINUED_SECRET");
    expect(await preview(alice, branched.id)).toContain("ALICE_SECRET");
    output = "She speaks instead.";
    const visibleSwipe = await generate(alice, { regenerateMessageId: dismissed.id });
    expect(extra(visibleSwipe.extra).hiddenFromUser).not.toBe(true);
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

    await page.reload();
    const note = page.locator('[data-roleplay-command="notes"]').last();
    await expect(note).not.toContainText("BATCH_SECRET");
    await note.getByRole("button", { name: "Alice used notes command!", exact: true }).click();
    await note.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = page.locator('[data-component="ExpandedTextarea"]');
    await editor.locator("textarea").fill("EDITED_BATCH_SECRET");
    const editUrl = `**/api/chats/${chat.id}/messages/*/extra?swipeIndex=*`;
    await page.route(editUrl, (route) => route.fulfill({ status: 500, json: { error: "Synthetic save failure" } }), {
      times: 1,
    });
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText("Could not save this change. Please try again.");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toBeHidden();
    expect(await preview(alice)).toContain("EDITED_BATCH_SECRET");
    expect(await preview(narrator)).toContain("EDITED_BATCH_SECRET");
    expect(await preview(bob)).not.toContain("EDITED_BATCH_SECRET");
    await expect(note).toContainText('[notes: content="BATCH_SECRET"]');
    await testInfo.attach(`roleplay-command-edit-${testInfo.project.name}.png`, {
      body: await page.screenshot({ animations: "disabled", path: testInfo.outputPath("roleplay-command-edit.png") }),
      contentType: "image/png",
    });
    for (const command of ["notes", "document", "memory"]) {
      const notice = page.locator(`[data-roleplay-command="${command}"]`).last();
      const disclosure = notice.getByRole("button", { name: `Alice used ${command} command!`, exact: true });
      if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
      await notice.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
      await expect(notice).toContainText("Removed from future context.");
    }
    // The notice updates optimistically; verify the persisted prompt after the PATCH completes.
    await expect
      .poll(() => preview(alice))
      .not.toMatch(/BATCH_SECRET|CONTINUED_SECRET|ALICE_SECRET|ALICE_REMINDER|BATCH_DOCUMENT/u);
    expect(await preview(alice)).not.toContain("used notes command!");
    // A delayed edit must stay on the original swipe, even after another swipe is selected.
    const beforeSwitch = (await rows()).find((message) => message.id === noteMessage.id);
    await request.put(`/api/chats/${chat.id}/messages/${noteMessage.id}/active-swipe`, { data: { index: 1 } });
    const delayed = await request.patch(`/api/chats/${chat.id}/messages/${noteMessage.id}/extra?swipeIndex=0`, {
      data: { roleplayCommandActivity: extra(beforeSwitch.extra).roleplayCommandActivity },
    });
    expect(delayed.ok(), await delayed.text()).toBeTruthy();
    const active = (await rows()).find((message) => message.id === noteMessage.id);
    expect(active.activeSwipeIndex).toBe(1);
    expect(JSON.stringify(extra(active.extra).roleplayCommandActivity)).toContain("REPLACEMENT_SECRET");
    expect(
      (
        await request.patch(`/api/chats/${branched.id}/messages/${noteMessage.id}/extra?swipeIndex=0`, { data: {} })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/messages/${noteMessage.id}/extra?swipeIndex=-1`, { data: {} })
      ).status(),
    ).toBe(400);
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
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(404).end();
      return;
    }
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
    await page.getByRole("button", { name: "Alice used sound command!", exact: true }).click();
    await expect(page.locator(`[data-roleplay-command-results] audio[src="${audioUrl}"]`)).toBeVisible();
    await expect(page.locator("body")).toContainText("[sound:");
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
      if (incoming.method !== "POST") {
        incoming.resume();
        response.writeHead(404).end();
        return;
      }
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
                  function: {
                    name: "roll_dice",
                    arguments: JSON.stringify({ notation: "1d6+3", character: "Alice", attribute: "Strength" }),
                  },
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
          write({
            content: 'll: character="Alice" notation="1d6+3" attribute="Strength" reason="Need four"] INVENTED_OUTCOME',
          });
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
      const stats = await request.patch(`/api/characters/${fixture.characters[0].id}`, {
        data: {
          data: {
            name: "Alice",
            extensions: {
              rpgStats: { enabled: true, attributes: [{ name: "STR", value: 12 }], hp: { value: 10, max: 10 } },
            },
          },
        },
      });
      expect(stats.ok(), await stats.text()).toBeTruthy();
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
      expect(total).toBeGreaterThanOrEqual(5);
      expect(total).toBeLessThanOrEqual(10);
      if (!native) await expect.poll(() => firstStreamClosed).toBe(true);
      await expect(page.getByText(`1d6+3: ${total}`, { exact: true })).not.toBeVisible();
      // WebKit can buffer these tiny SSE frames until the 15-second keepalive
      // while the synthetic follow-up deliberately sends no more content.
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return { streaming: useChatStore.getState().isStreaming, text: useChatStore.getState().streamBuffer };
            }),
          { timeout: 20_000 },
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
      expect(extra(saved.extra).diceRollResult).toBeNull();
      const activity = extra(saved.extra).roleplayCommandActivity;
      expect(activity).toHaveLength(1);
      expect(JSON.parse(activity[0].result).total).toBe(total);
      expect(JSON.parse(activity[0].result).modifier).toBe(4);
      const notice = page.locator('[data-roleplay-command="roll"]');
      await expect(notice).not.toContainText("1d6+3");
      await notice.getByRole("button", { name: "Alice used roll command!", exact: true }).click();
      await expect(notice).toContainText("1d6+3");
      await expect(notice).toContainText(String(total));
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

test("Roleplay commands require attached agents, enforce combat audience, and forward Illustrator settings and named avatars", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  let output = '[combat] [illustrate: subject="A duel" characters="Alice"]';
  const chatRequests: any[] = [],
    combatRequests: any[] = [],
    automaticIllustrations: any[] = [],
    illustrationPlans: any[] = [];
  const imageRequests: { url: string; data: Buffer }[] = [];
  const portrait: Buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#cc4477" } })
    .png()
    .toBuffer();
  const provider = createServer(async (incoming, response) => {
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const data = Buffer.concat(chunks);
    if (incoming.url?.includes("/images/")) {
      imageRequests.push({ url: incoming.url, data });
      // Finish the automatic image after the command image to exercise the complete SSE tail.
      if (data.toString("utf8").includes("The quiet courtyard"))
        await new Promise((resolve) => setTimeout(resolve, 300));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ b64_json: portrait.toString("base64") }] }));
      return;
    }
    const body = JSON.parse(data.toString("utf8"));
    const prompt = contentOf(body);
    let content: string;
    if (prompt.includes("You are the Illustrator prompt writer")) {
      illustrationPlans.push(body);
      content = JSON.stringify({
        prompt: "Alice at the gate",
        style: "ink sketch",
        characters: ["Narrator"],
        aspectRatio: "square",
      });
    } else if (prompt.includes("CHAT_ILLUSTRATOR_MODE")) {
      automaticIllustrations.push(body);
      content = JSON.stringify({
        shouldGenerate: true,
        prompt: "The quiet courtyard",
        characters: [],
        aspectRatio: "square",
      });
    } else if (prompt.includes("COMBAT_FIXTURE")) {
      combatRequests.push(body);
      content = JSON.stringify({
        encounterActive: true,
        event: "start",
        combatants: [{ name: "Alice", hp: 10, maxHp: 10 }],
        roundNumber: 1,
      });
    } else {
      chatRequests.push(body);
      content = output;
    }
    if (body.stream) {
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
    } else {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const fixture = await createFixture(request, baseUrl, ["Alice", "Narrator"]);
  const alice = fixture.characters[0].id,
    narrator = fixture.characters[1].id;
  const avatarDirectory = resolve(
    ".tmp/playwright-data",
    testInfo.project.name.includes("mobile") ? "mobile" : "desktop",
    "avatars",
  );
  const avatarName = `roleplay-command-${alice}.png`;
  mkdirSync(avatarDirectory, { recursive: true });
  writeFileSync(resolve(avatarDirectory, avatarName), portrait);
  const create = async (path: string, data: unknown) => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const row = await response.json();
    fixture.resources.unshift(`${path}/${row.id}`);
    return row;
  };
  const metadata = async (data: unknown) => {
    const response = await request.patch(`/api/chats/${fixture.chat.id}/metadata`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  const generate = async (characterId: string) => {
    const response = await request.post("/api/generate", {
      data: { chatId: fixture.chat.id, forCharacterId: characterId },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(await response.text()).not.toContain("event: error\n");
    const messages = await (await request.get(`/api/chats/${fixture.chat.id}/messages`)).json();
    return messages.filter((message: any) => message.role === "assistant").at(-1);
  };
  try {
    const connection = await create("/api/connections", {
      name: "Local image fixture",
      provider: "custom",
      model: "gpt-image-2",
      baseUrl,
      apiKey: "synthetic-test-key",
      treatAsLocalEndpoint: true,
      imageGenerationSource: "openai",
      imageService: "openai",
      imagePromptInstructions: "IMAGE_CONNECTION_OVERRIDE",
    });
    const chatConnection = fixture.chat.connectionId;
    let illustrator: any;
    for (const type of ["combat", "illustrator"]) {
      const agent = await create("/api/agents", {
        type,
        name: type,
        phase: "post_processing",
        connectionId: chatConnection,
        promptTemplate: type === "combat" ? "COMBAT_FIXTURE: Track the encounter as JSON." : "DEFAULT_ILLUSTRATOR_MODE",
        settings: {
          runInterval: 0,
          enabledTools: [],
          customCapabilities: { edit_trackers: true, trigger_image_generation: true },
          promptTemplates: [
            { id: "chat-mode", name: "Chat mode", promptTemplate: "CHAT_ILLUSTRATOR_MODE: Draw an ink sketch." },
          ],
          imagePositivePrompt: "POSITIVE_OVERRIDE",
          imageNegativePrompt: "NEGATIVE_OVERRIDE",
        },
      });
      if (type === "illustrator") illustrator = agent;
    }
    const avatarUpdate = await request.patch(`/api/characters/${alice}`, {
      data: { data: { name: "Alice" }, avatarPath: `/api/avatars/file/${avatarName}` },
    });
    expect(avatarUpdate.ok(), await avatarUpdate.text()).toBeTruthy();
    expect((await avatarUpdate.json()).avatarPath).toBe(`/api/avatars/file/${avatarName}`);
    expect((await request.get(`/api/avatars/file/${avatarName}`)).ok()).toBeTruthy();
    await metadata({
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { combat: true, illustrate: true },
      roleplayCommandNarratorId: narrator,
      roleplayCombatAudience: "narrator",
      activeAgentIds: [],
      encounterActive: false,
    });
    await generate(alice);
    expect(combatRequests).toHaveLength(0);
    expect(illustrationPlans).toHaveLength(0);
    expect(contentOf(chatRequests.at(-1))).not.toMatch(/\[combat\]|\[illustrate:/u);
    await metadata({
      activeAgentIds: ["combat", "illustrator"],
      illustratorImageConnectionId: connection.id,
      illustratorUseAvatarReferences: false,
      agentPromptTemplateIds: { illustrator: "chat-mode" },
    });
    output = "She waits. [combat]";
    await generate(alice);
    expect(combatRequests).toHaveLength(0);
    expect(contentOf(chatRequests.at(-1))).not.toContain("[combat]");
    await generate(narrator);
    expect(combatRequests).toHaveLength(1);
    expect(contentOf(combatRequests[0])).toContain("Combat starts now.");
    expect(extra((await (await request.get(`/api/chats/${fixture.chat.id}`)).json()).metadata).encounterActive).toBe(
      true,
    );
    await metadata({ encounterActive: false, roleplayCombatAudience: "all" });
    await generate(alice);
    expect(combatRequests).toHaveLength(2);
    await metadata({ encounterActive: false });
    output = 'She lifts her sword. [illustrate: subject="A duel" characters="Alice"]';
    const illustrated = await generate(alice);
    expect(illustrationPlans).toHaveLength(1);
    expect(contentOf(illustrationPlans[0])).toContain("CHAT_ILLUSTRATOR_MODE");
    expect(contentOf(illustrationPlans[0])).toContain("IMAGE_CONNECTION_OVERRIDE");
    expect(contentOf(illustrationPlans[0])).toContain("Involved characters: Alice");
    expect(imageRequests).toHaveLength(1);
    expect(imageRequests[0]!.url, imageRequests[0]!.data.toString("utf8")).toContain("/images/edits");
    expect(imageRequests[0]!.data.includes(portrait)).toBe(true);
    const multipart = imageRequests[0]!.data.toString("utf8");
    expect(multipart).toContain("POSITIVE_OVERRIDE");
    expect(multipart).toContain("NEGATIVE_OVERRIDE");
    expect(extra(illustrated.extra).attachments).toHaveLength(1);
    expect(extra(illustrated.extra).roleplayCommandActivity[0].raw).toBe(
      '[illustrate: subject="A duel" characters="Alice"]',
    );

    const interval = async (runInterval: number) => {
      const response = await request.patch(`/api/agents/${illustrator.id}`, {
        data: { settings: { ...extra(illustrator.settings), runInterval } },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    };
    await metadata({ enableAgents: true });
    await interval(3);
    output = "The courtyard falls quiet.";
    await generate(alice);
    await generate(alice);
    expect(automaticIllustrations).toHaveLength(0);
    await generate(alice);
    expect(automaticIllustrations).toHaveLength(1);
    await expect.poll(() => imageRequests.length).toBe(2);

    // A requested image bypasses the interval, and a due automatic image still runs on the same turn.
    output = 'She lifts her sword. [illustrate: subject="A duel" characters="Alice"]';
    await generate(alice);
    expect(automaticIllustrations).toHaveLength(1);
    expect(illustrationPlans).toHaveLength(2);
    await interval(1);
    const combined = await generate(alice);
    expect(automaticIllustrations).toHaveLength(2);
    expect(illustrationPlans).toHaveLength(3);
    await expect.poll(() => imageRequests.length).toBe(5);
    expect(extra(combined.extra).attachments).toHaveLength(2);

    await interval(0);
    output = "She lowers her sword.";
    await generate(alice);
    expect(automaticIllustrations).toHaveLength(2);
    expect(imageRequests).toHaveLength(5);

    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: ["combat", "illustrator"].map((id) => ({
          id,
          name: id,
          description: "Fixture",
          author: "Fixture",
          phase: "post_processing",
          execution: "host",
          enabledByDefault: false,
          category: "misc",
          modeAllowlist: ["roleplay"],
          defaultPromptTemplate: "Fixture",
        })),
      }),
    );
    await openChat(page, fixture.chat.id);
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const section = page.locator('[data-chat-settings-section="roleplay-agents"]');
    const header = section.locator('[role="button"][aria-expanded]').first();
    if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
    const commands = page.locator("[data-roleplay-commands]");
    await commands.getByRole("button", { name: "Expand Commands", exact: true }).click();
    await expect(commands).toContainText(
      "Let characters request extra Illustrator images. Automatic runs still follow the agent's Run Interval.",
    );
    await expect(commands.getByRole("checkbox", { name: /^Combat\b/u })).toBeChecked();
    await expect(commands.getByRole("checkbox", { name: /^Illustrations\b/u })).toBeChecked();
    const combatAudience = commands.getByRole("combobox", { name: "Who can start combat", exact: true });
    await combatAudience.selectOption("narrator");
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      await combatAudience.scrollIntoViewIfNeeded();
      await testInfo.attach(`roleplay-command-agents-${theme}-${testInfo.project.name}.png`, {
        body: await page.screenshot({
          animations: "disabled",
          path: testInfo.outputPath(`roleplay-command-agents-${theme}.png`),
        }),
        contentType: "image/png",
      });
    }
  } finally {
    await fixture.cleanup();
    rmSync(resolve(avatarDirectory, avatarName), { force: true });
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

test("Roleplay gates Soundtrack and Documents and uses the selected Music DJ source", async ({ page, request }) => {
  const mainRequests: any[] = [],
    musicRequests: any[] = [];
  let agentEvents: any[] = [];
  const provider = createServer(async (incoming, response) => {
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const music = contentOf(body).includes("You are the Music DJ agent using");
    (music ? musicRequests : mainRequests).push(body);
    const content = music
      ? JSON.stringify({ action: "none", mood: "Fixture silence" })
      : 'The scene continues. [music: mood="COMMAND_MOOD"] [document: title="Letter" content="COMMAND_DOCUMENT"]';
    response.writeHead(200, { "content-type": body.stream ? "text/event-stream" : "application/json" });
    response.end(
      body.stream
        ? `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
        : JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  const fixture = await createFixture(request, `http://127.0.0.1:${address.port}/v1`, ["Alice", "Narrator"]);
  const { chat, characters } = fixture;
  const metadata = async (data: unknown) => {
    const response = await request.patch(`/api/chats/${chat.id}/metadata`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  const generate = async (characterId: string, musicPlayerSource = "spotify") => {
    const response = await request.post("/api/generate", {
      data: { chatId: chat.id, forCharacterId: characterId, musicPlayerSource, musicPlayerEnabled: true },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const stream = await response.text();
    const events = stream
      .split("\n")
      .filter((line) => line.startsWith("data: {"))
      .map((line) => JSON.parse(line.slice(6)));
    expect(events.filter((event) => event.type === "error")).toEqual([]);
    agentEvents = events.filter((event) => event.type === "agent_result" && event.data.agentType === "spotify");
    const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
    return extra(messages.filter((message: any) => message.role === "assistant").at(-1).extra).roleplayCommandActivity;
  };
  try {
    const agentResponse = await request.post("/api/agents", {
      data: {
        type: "spotify",
        name: "Music DJ fixture",
        phase: "post_processing",
        connectionId: chat.connectionId,
        promptTemplate: 'Return JSON with action "none" and a mood.',
        settings: {
          runInterval: 0,
          musicProvider: "spotify",
          enabledTools: [],
          customCapabilities: { control_media: true },
        },
      },
    });
    expect(agentResponse.ok(), await agentResponse.text()).toBeTruthy();
    fixture.resources.unshift(`/api/agents/${(await agentResponse.json()).id}`);
    await metadata({
      roleplayCommandsEnabled: true,
      roleplayCommandToggles: { music: true, document: true },
      roleplayDocumentAudience: "narrator",
      roleplayCommandNarratorId: characters[1]!.id,
    });
    for (const settings of [
      { enableAgents: false, activeAgentIds: ["spotify"] },
      { enableAgents: true, activeAgentIds: [] },
    ]) {
      await metadata(settings);
      expect(await generate(characters[0]!.id)).toEqual([]);
      expect(contentOf(mainRequests.at(-1))).not.toContain("[music:");
      expect(contentOf(mainRequests.at(-1))).not.toContain("[document:");
      expect(musicRequests).toHaveLength(0);
    }
    await metadata({ enableAgents: true, activeAgentIds: ["spotify"] });
    for (const [source, label, resultType] of [
      ["spotify", "Spotify", "spotify_control"],
      ["youtube", "YouTube", "youtube_control"],
      ["custom", "Custom local music", "local_music_control"],
    ]) {
      const before = musicRequests.length;
      const activity = await generate(characters[1]!.id, source);
      expect(activity.map((item: any) => item.command.type)).toEqual(["music", "document"]);
      expect(musicRequests).toHaveLength(before + 1);
      const prompt = contentOf(musicRequests.at(-1));
      expect(prompt).toContain(`You are the Music DJ agent using ${label}`);
      expect(prompt).toContain("COMMAND_MOOD");
      expect(activity[0].error).toBeUndefined();
      expect(agentEvents.at(-1)?.data).toMatchObject({ resultType, success: true, data: { action: "none" } });
    }
    await metadata({ roleplayDocumentAudience: "all", enableAgents: false });
    expect((await generate(characters[0]!.id)).map((item: any) => item.command.type)).toEqual(["document"]);

    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "spotify",
            name: "Music DJ",
            description: "Fixture",
            author: "Fixture",
            phase: "post_processing",
            execution: "host",
            enabledByDefault: false,
            category: "misc",
            modeAllowlist: ["roleplay"],
            defaultPromptTemplate: "Fixture",
          },
        ],
      }),
    );
    await openChat(page, chat.id);
    const openCommands = async () => {
      await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setShouldOpenSettings(true);
      });
      const header = page
        .locator('[data-chat-settings-section="roleplay-agents"] [role="button"][aria-expanded]')
        .first();
      if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
      const expand = page.getByRole("button", { name: "Expand Commands", exact: true });
      if (await expand.isVisible()) await expand.click();
    };
    for (const [enabled, activeAgentIds] of [
      [false, ["spotify"]],
      [true, []],
      [true, ["spotify"]],
    ] as const) {
      await metadata({ enableAgents: enabled, activeAgentIds });
      await page.reload();
      await openCommands();
      const commands = page.locator("[data-roleplay-commands]");
      const soundtrack = commands.getByRole("checkbox", { name: /^Soundtrack\b/u });
      if (enabled && activeAgentIds.length) await expect(soundtrack).toBeChecked();
      else {
        await expect(soundtrack).toBeDisabled();
        await expect(soundtrack).not.toBeChecked();
        await expect(commands).toContainText("Add the Music DJ agent to this Roleplay chat and enable agents");
      }
      await expect(commands).toContainText("Add the Combat agent to this Roleplay chat");
    }
  } finally {
    await fixture.cleanup();
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`Roleplay documents use safe built-in styles in Classic and Visual Novel (${theme})`, async ({
    page,
    request,
  }, info) => {
    const fixture = await createFixture(request, "http://127.0.0.1:9/v1", ["Alice"]);
    const kinds = ["note", "letter", "journal", "report", "poster", "terminal", "unknown"];
    const content = "Dear traveller,\n\nThe archive opens at dawn. Bring the brass key.\n\n— The keeper";
    const literalHtml = '<img src=x onerror="window.documentCommandExecuted=true"><style>body{display:none}</style>';
    const activity = kinds.map((kind) => ({
      command: {
        type: "document",
        documentType: kind,
        title: `Archive ${kind}`,
        content: kind === "terminal" ? literalHtml + "\n" + "0123456789".repeat(50) : content,
      },
      raw: `[document: kind="${kind}" title="Archive ${kind}" content="Original text"]`,
    }));
    try {
      const legacy = await request.post(`/api/chats/${fixture.chat.id}/messages`, {
        data: {
          role: "assistant",
          characterId: fixture.characters[0].id,
          content: "An earlier letter.",
          extra: {
            roleplayDocuments: [{ type: "letter", title: "Saved letter", content: "A letter from an older save." }],
          },
        },
      });
      expect(legacy.ok(), await legacy.text()).toBeTruthy();
      const response = await request.post(`/api/chats/${fixture.chat.id}/messages`, {
        data: {
          role: "assistant",
          characterId: fixture.characters[0].id,
          content: "She places the papers on the desk.",
          extra: {
            roleplayCommandActivity: [
              ...activity,
              { ...activity[0], deleted: true },
              { ...activity[0], error: "Synthetic rejected document" },
            ],
          },
        },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      await openChat(page, fixture.chat.id, { theme });
      await expect(page.getByRole("article", { name: "Saved letter", exact: true })).toContainText(
        "A letter from an older save.",
      );
      for (const kind of kinds) {
        const article = page.getByRole("article", { name: `Archive ${kind}`, exact: true });
        await expect(article).toHaveCount(1);
        await expect(article).toHaveAttribute("data-roleplay-document-kind", kind === "unknown" ? "document" : kind);
        expect(await article.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      }
      const terminal = page.getByRole("article", { name: "Archive terminal", exact: true });
      await expect(terminal).toContainText(literalHtml);
      await expect(terminal.locator("img, style, script")).toHaveCount(0);
      const letter = page.getByRole("article", { name: "Archive letter", exact: true });
      await expect(letter.locator(".mari-roleplay-document-content")).toHaveCSS("white-space", "pre-wrap");
      await letter.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`document-classic-${theme}.png`), animations: "disabled" });
      await terminal.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`document-terminal-${theme}.png`), animations: "disabled" });

      const notice = page.locator('[data-roleplay-command="document"]').filter({ has: letter });
      await notice.getByRole("button", { name: "Alice used document command!", exact: true }).click();
      await notice.getByRole("button", { name: "Edit", exact: true }).click();
      const editor = page.locator('[data-component="ExpandedTextarea"]');
      await editor.locator("textarea").fill("The archive now opens at noon.\nBring the silver key.");
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect(editor).toBeHidden();
      await page.reload();
      await expect(letter).toContainText("The archive now opens at noon.");

      expect(
        (
          await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
            data: { roleplayDisplayStyle: "visual-novel" },
          })
        ).ok(),
      ).toBeTruthy();
      await page.reload();
      const paragraph = page.getByRole("region", { name: "Current paragraph" });
      await expect(paragraph.getByRole("article")).toHaveCount(kinds.length);
      await expect(paragraph.getByRole("article", { name: "Archive letter", exact: true })).toContainText(
        "Bring the silver key.",
      );
      await paragraph.getByRole("article", { name: "Archive letter", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`document-vn-${theme}.png`), animations: "disabled" });
      await expect(page.locator(".mari-chat-input textarea")).toBeInViewport();
      await notice.getByRole("button", { name: "Alice used document command!", exact: true }).click();
      await notice.getByRole("button", { name: "Delete", exact: true }).click();
      const saved = page.waitForResponse(
        (res) => res.request().method() === "PATCH" && res.url().includes("/extra?swipeIndex="),
      );
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
      expect((await saved).ok()).toBeTruthy();
      await page.reload();
      await expect(paragraph.getByRole("article")).toHaveCount(kinds.length - 1);
      await expect(paragraph.getByRole("article", { name: "Archive letter", exact: true })).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });
}

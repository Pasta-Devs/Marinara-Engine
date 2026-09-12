import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AdvancedMemoryStatus, Message } from "@marinara-engine/shared";
import { DEFAULT_ADVANCED_MEMORY_SETTINGS } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
test.use({ actionTimeout: 10_000 });

async function captureThemes(page: Page, info: TestInfo, name: string) {
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(async (theme) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setTheme(theme);
      useUIStore.getState().setAppAccentColor("#3b9fe8");
    }, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({ path: info.outputPath(`${name}-${theme}.png`), animations: "disabled" });
  }
}

async function createFixture(request: APIRequestContext) {
  const characters: Array<{ id: string }> = [];
  for (const name of ["Dottore", "Narrator"]) {
    const response = await request.post("/api/characters", { data: { data: { name, first_mes: "" } } });
    expect(response.ok()).toBeTruthy();
    characters.push(await response.json());
  }
  const [character, narrator] = characters;
  if (!character || !narrator) throw new Error("Expected both fixture characters");
  const response = await request.post("/api/chats", {
    data: {
      name: "Advanced memory UI proof",
      mode: "roleplay",
      characterIds: characters.map(({ id }) => id),
      connectionId: "synthetic-advanced-memory-ui-connection",
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  expect(
    (
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { groupChatMode: "individual", enableAgents: false, enableMemoryRecall: false },
      })
    ).ok(),
  ).toBeTruthy();
  const messages: Message[] = [];
  for (const [role, content] of [
    ["user", "Keep the laboratory promise."],
    ["assistant", "I will remember the blue notebook."],
  ] as const) {
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role, content, characterId: role === "assistant" ? character.id : null },
    });
    expect(message.ok()).toBeTruthy();
    messages.push(await message.json());
  }
  const [firstMessage, lastMessage] = messages;
  if (!firstMessage || !lastMessage) throw new Error("Expected both fixture messages");
  return {
    chat,
    characters,
    character,
    narrator,
    messages,
    firstMessage,
    lastMessage,
    cleanup: async () => {
      await request.delete(`/api/chats/${chat.id}?force=true`);
      for (const character of characters) await request.delete(`/api/characters/${character.id}`);
    },
  };
}

async function openChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    appAccentPulseMode: false,
    reduceAmbientEffects: false,
    chatSettingsExpandedSections: { "roleplay-memory-recall": false },
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
  await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
  await page.evaluate(async () => {
    const module = await import("/src/stores/chat.store.ts" as string);
    module.useChatStore.getState().setShouldOpenSettings(true);
  });
}

test("Advanced Memory stays in Chat Settings with confirmed knowledge, resumable progress and editable scenes", async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const fixture = await createFixture(request);
  const { character, narrator, firstMessage, lastMessage } = fixture;
  const knowledgeMessages = [
    ...Array.from({ length: 102 }, (_, index) => ({
      ...firstMessage,
      id: `historical-${index}`,
      createdAt: new Date(Date.UTC(2020, 0, 1, 0, index)).toISOString(),
      content: `Historical message ${index + 1}`,
    })),
    ...fixture.messages,
  ].map((message, index) => ({ ...message, rowid: index + 1 }));
  const knowledgeRequests: URL[] = [];
  await page.route(`**/api/chats/${fixture.chat.id}/messages?limit=50*`, async (route) => {
    const url = new URL(route.request().url());
    knowledgeRequests.push(url);
    const before = url.searchParams.get("before");
    const beforeId = before ? decodeURIComponent(before.split("|")[1] ?? "") : null;
    const end = beforeId ? knowledgeMessages.findIndex(({ id }) => id === beforeId) : knowledgeMessages.length;
    expect(end).toBeGreaterThanOrEqual(0);
    return route.fulfill({ json: knowledgeMessages.slice(Math.max(0, end - 50), end) });
  });
  const status: AdvancedMemoryStatus = {
    settings: {
      enabled: false,
      maxContextTokens: 65_000,
      summaryBudgetTokens: 4096,
      helperConnectionId: null,
      initialProcessingModel: "helper",
      retrieveMinMessages: 3,
      retrieveMaxMessages: 10,
      narratorCharacterId: null,
      knowledgeStarts: { [narrator.id]: "historical-0" },
      knowledgeConfirmed: false,
    },
    job: { status: "idle", stage: "idle", completed: 0, total: 4, error: null },
    missingKnowledgeCharacterIds: [character.id],
    records: [],
    helperModel: "Mock helper",
    summaryModel: "Mock summaries",
    warnings: [],
  };
  const initializeBodies: Array<{ settings?: Record<string, unknown> }> = [];
  let reindexRequests = 0;
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (pathname.endsWith("/sources")) return route.fulfill({ json: fixture.messages });
    if (method === "PATCH" && pathname.endsWith("/settings")) {
      Object.assign(status.settings, route.request().postDataJSON());
    } else if (method === "POST" && pathname.endsWith("/initialize")) {
      const body = route.request().postDataJSON();
      initializeBodies.push(body);
      Object.assign(status.settings, body.settings);
      status.missingKnowledgeCharacterIds = [];
      status.job = {
        ...status.job,
        id: "memory-job",
        blocking: true,
        status: "running",
        stage: "summarizing",
        completed: Math.max(1, status.job.completed),
      };
    } else if (method === "POST" && pathname.endsWith("/cancel")) {
      status.job.status = "cancelled";
    } else if (method === "PATCH" && pathname.includes("/records/")) {
      const patch = route.request().postDataJSON();
      const record = status.records[0];
      if (!record) throw new Error("Expected the initialized scene fixture");
      Object.assign(record, patch, {
        manualOverride: patch.content !== undefined || record.manualOverride,
      });
    } else if (method === "POST" && pathname.endsWith("/reindex")) {
      reindexRequests += 1;
      const record = status.records[0];
      if (!record) throw new Error("Expected the initialized scene fixture");
      record.embeddingStatus = "vectorized";
    }
    return route.fulfill({ json: status });
  });
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openChat(page, fixture.chat.id);
    const drawer = page.locator(".mari-chat-settings-drawer");
    const settings = drawer.locator('[data-component="AdvancedMemorySettings"]');
    const memorySection = drawer.locator('[data-chat-settings-section="roleplay-memory-recall"]');
    const memoryHeader = memorySection.locator(':scope > [role="button"]');
    await expect(memoryHeader).toHaveAttribute("aria-expanded", "false");
    await page.evaluate((chatId) => {
      window.dispatchEvent(new CustomEvent("marinara:advanced-memory-settings", { detail: { chatId } }));
    }, fixture.chat.id);
    await expect(memoryHeader).toHaveAttribute("aria-expanded", "true");
    await memoryHeader.click();
    await expect(memoryHeader).toHaveAttribute("aria-expanded", "false");
    await expect(settings).toHaveCount(0);
    await memoryHeader.click();
    const advancedToggle = settings.getByRole("checkbox", { name: /^Advanced Memory Recall \(Alpha\)/ });
    await expect(advancedToggle).not.toBeChecked();
    await settings.getByText("Advanced Memory Recall (Alpha)", { exact: true }).click();
    await expect(advancedToggle).toBeChecked();
    await expect(settings.getByLabel("Maximum context (tokens)")).toHaveValue("65000");
    await expect(settings.getByLabel("Preferred minimum messages")).toHaveValue("3");
    await expect(settings.getByLabel("Maximum messages per excerpt")).toHaveValue("10");
    await expect(settings.getByLabel("Narrator", { exact: true })).toHaveValue("");
    await expect(settings).toContainText("Mock helper");
    await settings.getByLabel("Initial scene processing model").selectOption("main");
    await settings.getByRole("button", { name: "Prepare existing history", exact: true }).click();
    const confirmation = drawer.getByRole("region", { name: "Confirm character knowledge", exact: true });
    await expect(confirmation).toBeVisible();
    const confirm = confirmation.getByRole("button", { name: "Confirm ranges and prepare history" });
    await expect(confirm).toBeDisabled();
    await expect(confirmation).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirmation.getByRole("combobox", { name: "Dottore", exact: true })).toBeFocused();
    await confirmation.getByRole("combobox", { name: "Dottore", exact: true }).selectOption("beginning");
    await expect(confirmation).toContainText("Showing messages 55–104");
    await expect(confirmation.getByRole("option", { name: "#55 — Historical message 55", exact: true })).toHaveCount(1);
    await expect(confirmation.locator("option")).toHaveCount(52);
    await confirmation.getByRole("button", { name: "Older messages", exact: true }).click();
    await expect(confirmation).toContainText("Showing messages 5–54");
    await confirmation.getByRole("button", { name: "Older messages", exact: true }).click();
    await expect(confirmation).toContainText("Showing messages 1–4");
    await expect(confirmation.getByRole("button", { name: "Older messages", exact: true })).toBeDisabled();
    await confirmation.getByRole("combobox", { name: "Dottore", exact: true }).selectOption("historical-2");
    await confirmation.getByRole("button", { name: "Newer messages", exact: true }).click();
    await expect(confirmation.getByRole("combobox", { name: "Dottore", exact: true })).toHaveValue("historical-2");
    await expect(confirmation.getByRole("option", { name: "Saved selection (outside this page)" })).toHaveCount(1);
    expect(knowledgeRequests.every((url) => url.searchParams.get("limit") === "50")).toBe(true);
    expect(knowledgeRequests.some((url) => url.searchParams.has("before"))).toBe(true);
    await confirm.click();
    await expect.poll(() => initializeBodies.length).toBe(1);
    expect(initializeBodies[0]?.settings).toMatchObject({
      knowledgeConfirmed: true,
      knowledgeStarts: { [character.id]: "historical-2", [narrator.id]: "historical-0" },
    });
    expect(status.settings.initialProcessingModel).toBe("main");

    const progress = drawer.locator('[data-component="AdvancedMemoryProgress"]');
    await expect(progress).toContainText("This may take a while.");
    await expect(progress.getByRole("progressbar")).toHaveAttribute("value", "1");
    await expect(progress).toContainText("1 of 4 work units completed");
    const wheel = progress.locator(".mari-memory-wheel");
    await expect(wheel).toHaveCSS("animation-name", "mari-memory-wheel-run");
    await expect(wheel).toHaveCSS("background-image", /professor-mari-memory-wheel\.png/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(wheel).toHaveCSS("animation-name", "none");
    await progress.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-progress");
    await progress.getByRole("button", { name: "Cancel processing", exact: true }).click();
    await expect(progress).toContainText("Memory processing paused");
    await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
    await expect(drawer).toBeHidden();
    await page.evaluate(async () => {
      const module = await import("/src/stores/chat.store.ts" as string);
      module.useChatStore.getState().setShouldOpenSettings(true);
    });
    await expect(progress).toContainText("Memory processing paused");
    await progress.getByRole("button", { name: "Resume processing", exact: true }).click();
    await expect.poll(() => initializeBodies.length).toBe(2);
    await expect(progress.getByRole("progressbar")).toHaveAttribute("value", "1");
    status.job = { ...status.job, total: 1 };
    await expect(progress).toContainText("1 of 1 work unit completed");
    status.job = { ...status.job, status: "ready", stage: "ready", completed: 4, total: 4 };
    status.records = [
      {
        id: "scene-proof",
        chatId: fixture.chat.id,
        sceneId: "scene-proof",
        kind: "scene",
        status: "closed",
        startMessageId: firstMessage.id,
        endMessageId: lastMessage.id,
        startIndex: 1,
        endIndex: 2,
        messageIds: fixture.messages.map(({ id }) => id),
        audienceCharacterIds: [character.id],
        content: "The laboratory promise concerns a blue notebook.",
        title: "The laboratory promise",
        timeline: "Before the experiment",
        enabled: true,
        manualOverride: false,
        sourceFingerprint: "proof",
        dependencies: [],
        embeddingStatus: "stale",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await expect(progress).toContainText("Memory is ready");
    await settings.getByRole("button", { name: "Review character knowledge", exact: true }).click();
    await expect(confirmation.getByRole("combobox", { name: "Dottore", exact: true })).toHaveValue("historical-2");
    await expect(confirmation.getByRole("combobox", { name: "Narrator", exact: true })).toHaveValue("historical-0");
    await confirmation.getByRole("combobox", { name: "Dottore", exact: true }).selectOption(lastMessage.id);
    await confirm.click();
    await expect.poll(() => initializeBodies.length).toBe(3);
    expect(status.settings.knowledgeStarts[character.id]).toBe(lastMessage.id);
    status.job = { ...status.job, status: "ready", stage: "ready", completed: 4 };
    await expect(progress).toContainText("Memory is ready");

    await drawer.getByRole("button", { name: "Access memories for this chat", exact: true }).click();
    const inspector = drawer.locator('[data-component="AdvancedMemoryInspector"]');
    await expect(inspector).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Memories for This Chat", exact: true })).toHaveCount(0);
    await expect(drawer.getByText("memory chunks", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText(/No recall memories have been created for this chat/)).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Re-vectorize All Memories", exact: true })).toHaveCount(0);
    await inspector.getByRole("button").filter({ hasText: "The laboratory promise" }).click();
    await inspector
      .getByRole("textbox", { name: "Summary text", exact: true })
      .fill("Correction: the notebook is green.");
    await inspector.getByRole("button", { name: "Save correction", exact: true }).click();
    await expect.poll(() => status.records[0]?.content).toBe("Correction: the notebook is green.");
    await inspector.getByText("Include in recall", { exact: true }).click();
    await expect(inspector.getByRole("checkbox", { name: "Include in recall", exact: true })).not.toBeChecked();
    await expect.poll(() => status.records[0]?.enabled).toBe(false);
    await inspector.getByRole("button", { name: "Inspect source messages", exact: true }).click();
    await expect(inspector).toContainText("I will remember the blue notebook.");
    await inspector.getByRole("button", { name: "Back to scenes", exact: true }).click();
    await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
    await expect.poll(() => reindexRequests).toBe(1);
    expect(status.records[0]?.enabled).toBe(false);
    await inspector.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-inspector");
    await settings.getByRole("button", { name: "Review character knowledge", exact: true }).click();
    await expect(confirmation).toBeVisible();
    await settings.getByText("Advanced Memory Recall (Alpha)", { exact: true }).click();
    await expect(advancedToggle).not.toBeChecked();
    await expect(confirmation).toHaveCount(0);
    await expect(settings.getByLabel("Maximum context (tokens)")).toHaveCount(0);
    await expect(inspector).toHaveCount(0);
    await expect(drawer.getByRole("checkbox", { name: /^Enable Memory Recall/ })).not.toBeChecked();
    await drawer.getByRole("button", { name: "Access memories for this chat", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Memories for This Chat", exact: true })).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test("Advanced Memory keeps background errors quiet and opens the drawer for errors without a blocking flag", async ({
  page,
  request,
}) => {
  const fixture = await createFixture(request);
  const status: AdvancedMemoryStatus = {
    settings: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true },
    job: { status: "idle", stage: "idle", completed: 0, total: 0, error: null },
    missingKnowledgeCharacterIds: [],
    records: [],
    helperModel: "Mock helper",
    summaryModel: "Mock summaries",
    warnings: [],
  };
  let generationRequests = 0;
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory`, (route) => route.fulfill({ json: status }));
  await page.route("**/api/generate", (route) => {
    generationRequests += 1;
    status.job = {
      id: `error-${generationRequests}`,
      status: "error",
      stage: "idle",
      completed: 0,
      total: 0,
      error: "Synthetic memory preparation failed",
      ...(generationRequests === 1 ? { blocking: false } : {}),
    };
    return route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "advanced_memory_status", data: { chatId: fixture.chat.id, job: status.job } },
        { type: "done", data: {} },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });
  try {
    await openChat(page, fixture.chat.id);
    const drawer = page.locator(".mari-chat-settings-drawer");
    await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
    const composer = page.locator("textarea[data-chat-composer]");
    await composer.fill("Check the background memory job");
    await page.locator("button.mari-chat-send-btn").click();
    await expect.poll(() => generationRequests).toBe(1);
    await expect(drawer).toBeHidden();
    await expect(page.locator("button.mari-chat-send-btn .lucide-send")).toBeVisible();
    await composer.fill("Check the blocking memory job");
    await page.locator("button.mari-chat-send-btn").click();
    await expect.poll(() => generationRequests).toBe(2);
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-component="AdvancedMemoryProgress"]')).toContainText(
      "Synthetic memory preparation failed",
    );
  } finally {
    await fixture.cleanup();
  }
});

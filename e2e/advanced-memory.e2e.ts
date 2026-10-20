import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AdvancedMemoryStatus, Message } from "@marinara-engine/shared";
import {
  ADVANCED_MEMORY_SCENE_AUDIENCE,
  DEFAULT_ADVANCED_MEMORY_SETTINGS,
  createChatSummaryEntry,
} from "@marinara-engine/shared";
import { chooseConnection } from "./connection-picker.js";
import { seedUIState } from "./ui-state-fixture.js";
import { closeChatSettings, drawerToggle, openChatSettings, openChatSettingsTool } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
test.use({ actionTimeout: 10_000 });

async function captureThemes(page: Page, info: TestInfo, name: string, target?: Locator) {
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(async (theme) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setTheme(theme);
      useUIStore.getState().setAppAccentColor("#3b9fe8");
    }, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await (target ?? page).screenshot({ path: info.outputPath(`${name}-${theme}.png`), animations: "disabled" });
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

async function openChat(page: Page, chatId: string, openSettings = true) {
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
  if (openSettings) await openChatSettings(page);
}

test("Memory Recall switches modes in both directions and preserves the choice after reload", async ({
  page,
  request,
}) => {
  const fixture = await createFixture(request);
  const section = page.locator('[data-chat-settings-section="roleplay-memory-recall"]');
  const normal = section.getByRole("checkbox", { name: /^Enable Memory Recall/ });
  const advanced = section.getByRole("checkbox", { name: /^Advanced Memory Recall/ });
  const readMetadata = async () => {
    const response = await request.get(`/api/chats/${fixture.chat.id}`);
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    return typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
  };
  let releaseBasicSave: (() => void) | undefined;
  let failBasicSave = true;
  let failStatus = false;
  let failedStatusRequests = 0;
  try {
    expect(
      (await request.patch(`/api/chats/${fixture.chat.id}/metadata`, { data: { enableMemoryRecall: true } })).ok(),
    ).toBeTruthy();
    await openChat(page, fixture.chat.id);
    await section.getByRole("button", { name: "Memory Recall", exact: true }).click();
    await expect(normal).toBeChecked();
    await expect(advanced).not.toBeChecked();
    await section.getByText("Advanced Memory Recall", { exact: true }).click();
    await expect(advanced).toBeChecked();
    await expect(normal).not.toBeChecked();
    await expect.poll(async () => (await readMetadata()).enableMemoryRecall).toBe(false);

    await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory`, (route) => {
      if (!failStatus) return route.continue();
      failedStatusRequests += 1;
      return route.fulfill({ status: 503, json: { error: "Synthetic status failure" } });
    });
    await page.route(`**/api/chats/${fixture.chat.id}/metadata`, async (route) => {
      if (route.request().method() !== "PATCH" || route.request().postDataJSON().enableMemoryRecall !== true)
        return route.continue();
      await new Promise<void>((resolve) => {
        releaseBasicSave = resolve;
      });
      releaseBasicSave = undefined;
      if (failBasicSave) return route.fulfill({ status: 500, json: { error: "Synthetic metadata save failure" } });
      return route.continue();
    });
    await section.getByText("Enable Memory Recall", { exact: true }).click();
    await expect(normal).toBeChecked();
    await expect(advanced).not.toBeChecked();
    await expect.poll(() => releaseBasicSave !== undefined).toBe(true);
    expect((await readMetadata()).advancedMemory.enabled).toBe(true);
    failStatus = true;
    releaseBasicSave?.();
    await expect.poll(() => failedStatusRequests).toBeGreaterThan(0);
    await expect(advanced).toBeChecked();
    await expect(normal).not.toBeChecked();

    failBasicSave = false;
    failStatus = false;
    await section.getByText("Enable Memory Recall", { exact: true }).click();
    await expect(normal).toBeChecked();
    await expect(advanced).not.toBeChecked();
    await expect.poll(() => releaseBasicSave !== undefined).toBe(true);
    releaseBasicSave?.();
    await expect.poll(async () => (await readMetadata()).advancedMemory.enabled).toBe(false);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openChatSettings(page);
    if (!(await normal.isVisible())) await section.getByRole("button", { name: "Memory Recall", exact: true }).click();
    await expect(normal).toBeChecked();
    await expect(advanced).not.toBeChecked();

    await section.getByText("Advanced Memory Recall", { exact: true }).click();
    await expect(advanced).toBeChecked();
    await expect(normal).not.toBeChecked();
    await section.getByText("Advanced Memory Recall", { exact: true }).click();
    await expect(advanced).not.toBeChecked();
    await expect(normal).not.toBeChecked();
    const transcript = await request.get(`/api/chats/${fixture.chat.id}/messages`);
    expect(transcript.ok()).toBeTruthy();
    expect((await transcript.json()).map((message: Message) => message.id)).toEqual(
      fixture.messages.map((message) => message.id),
    );
  } finally {
    releaseBasicSave?.();
    await fixture.cleanup();
  }
});

for (const state of ["running", "status unavailable"] as const) {
  test(`Advanced Memory can be disabled while ${state}`, async ({ page, request }, info) => {
    const fixture = await createFixture(request);
    const endpoint = `/api/chats/${fixture.chat.id}/advanced-memory`;
    try {
      expect((await request.patch(`${endpoint}/settings`, { data: { enabled: true } })).ok()).toBeTruthy();
      if (state === "status unavailable") {
        await page.route(`**/api/chats/${fixture.chat.id}`, async (route) => {
          const response = await route.fetch();
          const chat = await response.json();
          const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
          if (metadata.advancedMemory?.enabled) metadata.enableMemoryRecall = true; // Legacy conflicting flags.
          return route.fulfill({ json: { ...chat, metadata } });
        });
      }
      await page.route(`**${endpoint}`, async (route) => {
        if (state === "status unavailable") {
          return route.fulfill({ status: 503, json: { error: "Synthetic status failure" } });
        }
        const response = await route.fetch();
        const status = (await response.json()) as AdvancedMemoryStatus;
        if (status.settings.enabled) {
          status.job = { status: "running", stage: "summarizing", completed: 1, total: 10, error: null };
        }
        return route.fulfill({ json: status });
      });
      await openChat(page, fixture.chat.id);
      const section = page.locator('[data-chat-settings-section="roleplay-memory-recall"]');
      await section.getByRole("button", { name: "Memory Recall", exact: true }).click();
      const settings = section.locator('[data-component="AdvancedMemorySettings"]');
      const toggle = settings.getByRole("checkbox", { name: /^Advanced Memory Recall/ });
      if (state === "running")
        await expect(settings.getByRole("button", { name: "Pause processing", exact: true })).toBeEnabled();
      else await expect(settings.getByRole("alert")).toContainText("Synthetic status failure");
      await expect(toggle).toBeChecked();
      await settings.getByText("Advanced Memory Recall", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`memory-recovery-${state}-enabled.png`), animations: "disabled" });
      await expect(toggle).toBeEnabled();
      await expect(section.getByRole("checkbox", { name: /^Enable Memory Recall/ })).not.toBeChecked();
      await settings.getByText("Advanced Memory Recall", { exact: true }).click();
      await expect(toggle).not.toBeChecked();
      await expect
        .poll(async () => ((await (await request.get(endpoint)).json()) as AdvancedMemoryStatus).settings.enabled)
        .toBe(false);
      await page.screenshot({ path: info.outputPath(`memory-recovery-${state}-disabled.png`), animations: "disabled" });
    } finally {
      await fixture.cleanup();
    }
  });
}

for (const mode of ["roleplay", "conversation"] as const) {
  test(`${mode} message Peek Prompt keeps its saved request after background updates`, async ({
    page,
    request,
  }, info) => {
    const fixture = await createFixture(request);
    try {
      expect((await request.patch(`/api/chats/${fixture.chat.id}`, { data: { mode } })).ok()).toBeTruthy();
      const cachedPrompt = [
        { role: "system", content: "You are Dottore. SAVED_CONSTANT. Character-only commands: [note]." },
        { role: "user", content: "Keep the laboratory promise." },
      ];
      const savedExtra = {
        cachedPrompt,
        chatSummaryFingerprint: "summary-at-generation",
        generationInfo: { model: "saved-request-fixture", provider: "custom" },
      };
      expect(
        (
          await request.patch(`/api/chats/${fixture.chat.id}/messages/${fixture.lastMessage.id}/extra`, {
            data: savedExtra,
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
            data: { advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: mode === "roleplay" } },
          })
        ).ok(),
      ).toBeTruthy();
      await openChat(page, fixture.chat.id, false);
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) {
          expect(
            (
              await request.patch(`/api/chats/${fixture.chat.id}/messages/${fixture.lastMessage.id}/extra`, {
                data: { ...savedExtra, attachments: [{ type: "image", url: "/late-illustration.png" }] },
              })
            ).ok(),
          ).toBeTruthy();
          expect(
            (
              await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
                data: {
                  summary: "Changed after generation",
                  summaryEntries: [],
                  advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true, summaryBudgetTokens: 12000 },
                },
              })
            ).ok(),
          ).toBeTruthy();
        }
        const message = page.locator(`[data-message-id="${fixture.lastMessage.id}"]`).first();
        const peek = message.getByRole("button", { name: "Peek prompt", exact: true });
        const mobile = info.project.name.includes("mobile");
        // Touch actions remain pinned after closing Peek. Tapping the message
        // again would toggle them off; desktop actions follow the pointer.
        if (!mobile) await message.hover();
        else if (!attempt) await message.getByText("I will remember the blue notebook.", { exact: true }).tap();
        await expect(message.locator(".mari-message-actions")).toHaveCSS("opacity", "1");
        const responsePromise = page.waitForResponse((response) =>
          response.url().endsWith(`/chats/${fixture.chat.id}/peek-prompt`),
        );
        if (mobile) await peek.tap();
        else await peek.click();
        const response = await responsePromise;
        expect(response.request().postDataJSON()).toEqual({ messageId: fixture.lastMessage.id });
        expect(response.ok()).toBeTruthy();
        expect(await response.json()).toMatchObject({ exact: true, source: "cached", messages: cachedPrompt });
        await expect(page.getByText("Exact Text Model Request", { exact: true })).toBeVisible();
        if (attempt) await captureThemes(page, info, `${mode}-saved-message-prompt`);
        const close = page.getByRole("button", { name: "Close assembled prompt", exact: true });
        if (mobile) await close.tap();
        else await close.click();
        await expect(close).toBeHidden();
      }
    } finally {
      await fixture.cleanup();
    }
  });
}

test("preset editor offers one combined Recalled Scenes marker and reads the legacy alias", async ({
  page,
  request,
}, info) => {
  const fixture = await createFixture(request);
  let preset: { id: string } | undefined;
  try {
    const response = await request.post("/api/prompts", { data: { name: "Combined recalled scenes" } });
    expect(response.ok()).toBeTruthy();
    preset = (await response.json()) as { id: string };
    expect(
      (
        await request.post(`/api/prompts/${preset.id}/sections`, {
          data: {
            identifier: "recalled_messages",
            name: "Recalled Messages",
            isMarker: true,
            markerConfig: { type: "recalled_messages" },
          },
        })
      ).ok(),
    ).toBeTruthy();
    await openChat(page, fixture.chat.id, false);
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openPresetDetail(id);
    }, preset.id);
    const editor = page.locator(".mari-editor-shell");
    await expect(editor.locator(".mari-editor-title-input")).toBeVisible();
    const compact = editor.getByRole("button", { name: "Editor sections", exact: true });
    if (await compact.isVisible()) {
      await compact.click();
      await editor.getByRole("menuitemradio", { name: "Sections", exact: true }).click();
    } else {
      await editor
        .getByRole("navigation", { name: "Editor sections" })
        .getByRole("button", { name: "Sections", exact: true })
        .click();
    }
    await expect(editor.getByText("Recalled Scenes", { exact: true })).toBeVisible();
    await expect(editor.getByText("Recalled Messages", { exact: true })).toHaveCount(0);
    await editor.getByRole("button", { name: "Add Section", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Recalled Scenes", exact: true })).toHaveCount(1);
    await expect(editor.getByRole("button", { name: "Recalled Messages", exact: true })).toHaveCount(0);
    await captureThemes(
      page,
      info,
      "combined-memory-marker",
      editor.getByRole("button", { name: "Recalled Scenes", exact: true }).locator(".."),
    );
    await editor.getByRole("button", { name: "Recalled Scenes", exact: true }).click();
    await expect
      .poll(async () => {
        const saved = await (await request.get(`/api/prompts/${preset!.id}/full`)).json();
        return saved.sections.map(
          (section: { markerConfig: string | { type: string } }) =>
            (typeof section.markerConfig === "string" ? JSON.parse(section.markerConfig) : section.markerConfig)?.type,
        );
      })
      .toEqual(["recalled_messages", "recalled_scenes"]);
  } finally {
    if (preset?.id) await request.delete(`/api/prompts/${preset.id}`);
    await fixture.cleanup();
  }
});

test("Advanced Memory shared cutoffs can be removed with the existing All flag", async ({ page, request }, info) => {
  const fixture = await createFixture(request);
  const marker = page.locator('[data-advanced-memory-start="true"]');
  const update = async (contextStarts: NonNullable<AdvancedMemoryStatus["job"]["contextStarts"]>, enabled = true) => {
    const response = await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
      data: {
        advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled },
        advancedMemoryState: { status: "ready", stage: "ready", completed: 2, total: 2, error: null, contextStarts },
      },
    });
    expect(response.ok()).toBeTruthy();
  };
  try {
    await update([]);
    await openChat(page, fixture.chat.id, false);
    await expect(marker).toHaveCount(0);
    await captureThemes(page, info, "automatic-cutoff-before");
    await update([
      { messageId: fixture.firstMessage.id, sceneStartMessageId: fixture.firstMessage.id, audienceCharacterIds: [] },
    ]);
    await page.reload();
    await expect(marker).toHaveCount(1);
    await expect(page.locator(`[data-message-id="${fixture.firstMessage.id}"]`).locator(marker)).toBeVisible();
    await expect(marker).toContainText("New Start: All");
    await expect(marker).toHaveAttribute(
      "title",
      "Advanced Memory starts context here for all characters. Uncheck All in the flag menu to undo this cutoff.",
    );
    await captureThemes(page, info, "automatic-cutoff-shared");
    await page.getByText("Keep the laboratory promise.", { exact: true }).click();
    await page.getByRole("button", { name: "Change who starts context here", exact: true }).click();
    const all = page.getByRole("menuitemcheckbox", { name: "Start context here for all characters", exact: true });
    await expect(all).toHaveAttribute("aria-checked", "true");
    await captureThemes(page, info, "automatic-cutoff-selected", page.getByRole("menu"));
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "false");
    await expect(marker).toHaveCount(0);
    await expect
      .poll(async () => {
        const chat = await (await request.get(`/api/chats/${fixture.chat.id}`)).json();
        const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
        return metadata.advancedMemoryState.contextStarts;
      })
      .toEqual([]);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await expect(marker).toHaveCount(0);
    await captureThemes(page, info, "automatic-cutoff-cleared");
    await update([
      { messageId: fixture.lastMessage.id, audienceCharacterIds: [fixture.character.id, fixture.narrator.id] },
    ]);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await expect(marker).toHaveCount(0); // Legacy character-specific automatic starts are no longer active.
    await update([], false);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await expect(marker).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("Advanced Memory scene timeframes save independently, survive reloads and can be cleared", async ({
  page,
  request,
}, info) => {
  const fixture = await createFixture(request);
  const endpoint = `/api/chats/${fixture.chat.id}/advanced-memory`;
  const drawer = page.locator(".mari-chat-settings-drawer");
  const inspector = drawer.locator('[data-component="AdvancedMemoryInspector"]');
  const timeframe = inspector.getByRole("textbox", { name: "Story timeframe", exact: true });
  const save = inspector.getByRole("button", { name: "Save correction", exact: true });
  const back = inspector.getByRole("button", { name: "Back to scenes", exact: true });
  const openInspector = async () => {
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    await expect(drawer).toBeVisible();
    await page.evaluate((chatId) => {
      window.dispatchEvent(new CustomEvent("marinara:advanced-memory-settings", { detail: { chatId } }));
    }, fixture.chat.id);
    await drawer.getByRole("button", { name: "Access memories for this chat", exact: true }).click();
    await expect(inspector).toBeVisible();
  };
  const readRecord = async (id: string) => {
    const response = await request.get(endpoint);
    expect(response.ok()).toBeTruthy();
    return ((await response.json()) as AdvancedMemoryStatus).records.find((record) => record.id === id);
  };
  try {
    expect(
      (
        await request.patch(`${endpoint}/settings`, {
          data: {
            enabled: true,
            knowledgeConfirmed: true,
            knowledgeStarts: Object.fromEntries(fixture.characters.map(({ id }) => [id, null])),
          },
        })
      ).ok(),
    ).toBeTruthy();
    const exported = await request.get(`${endpoint}/export`);
    expect(exported.ok()).toBeTruthy();
    const envelope = await exported.json();
    const imported = await request.post(`${endpoint}/import`, {
      data: {
        ...envelope,
        records: fixture.messages.flatMap((message, index) => {
          const record = {
            id: `timeframe-summary-${index}`,
            chatId: fixture.chat.id,
            sceneId: `scene-${message.id}`,
            kind: "scene",
            status: index === 0 ? "closed" : "open",
            startMessageId: message.id,
            endMessageId: message.id,
            messageIds: [message.id],
            audienceCharacterIds: fixture.characters.map(({ id }) => id),
            content: index === 0 ? "Dottore promises to preserve the blue notebook." : "",
            title: index === 0 ? "The laboratory promise" : "The experiment",
            timeline: index === 0 ? "Before the experiment" : null,
            enabled: true,
            manualOverride: false,
            dependencies: [ADVANCED_MEMORY_SCENE_AUDIENCE],
          };
          return [
            { valid: true, record: { ...record, id: record.sceneId, content: "" } },
            { valid: true, record },
          ];
        }),
      },
    });
    expect(imported.ok()).toBeTruthy();
    const importedStatus = (await imported.json()) as AdvancedMemoryStatus & { imported: number };
    expect(importedStatus.imported).toBe(4);
    const record = importedStatus.records.find(
      (item) => item.startMessageId === fixture.firstMessage.id && item.id !== item.sceneId,
    );
    if (!record) throw new Error("Expected the imported scene summary");
    const emptyRecord = importedStatus.records.find(
      (item) => item.startMessageId === fixture.lastMessage.id && item.id !== item.sceneId,
    );
    if (!emptyRecord) throw new Error("Expected the imported open scene summary");
    expect(emptyRecord).toMatchObject({ content: "", status: "open", enabled: true });
    await openChat(page, fixture.chat.id);
    await openInspector();
    await inspector.getByRole("button", { name: /^Scene #1\b/ }).click();
    const selectedCard = inspector.getByRole("heading", { name: "Scene #1", exact: true }).locator("..");
    if (process.env.ADVANCED_MEMORY_TIMEFRAME_BASELINE === "true") {
      await expect(timeframe).toHaveCount(0);
      await expect(selectedCard).toContainText("Story timeframe: Before the experiment");
      await selectedCard
        .getByText("Story timeframe: Before the experiment", { exact: true })
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
      await captureThemes(page, info, "scene-timeframe-before");
      return;
    }
    await expect(timeframe).toHaveValue("Before the experiment");
    await expect(timeframe).toHaveAttribute("maxlength", "2000");
    await expect(save).toBeDisabled();
    await timeframe.fill("  Day 2, dawn — after the storm  ");
    await expect(save).toBeEnabled();
    const summaryText = inspector.getByRole("textbox", { name: "Summary text", exact: true });
    await summaryText.fill("");
    await expect(save).toBeDisabled();
    await summaryText.fill(record.content);
    await expect(save).toBeEnabled();
    await page.route(
      `**${endpoint}/records/${record.id}`,
      (route) => route.fulfill({ status: 500, json: { error: "Timeframe save failed; please retry." } }),
      { times: 1 },
    );
    await save.click();
    await expect(
      page.getByText("Advanced Memory: Timeframe save failed; please retry.", { exact: true }),
    ).toBeVisible();
    await expect(timeframe).toHaveValue("  Day 2, dawn — after the storm  ");
    await expect(save).toBeEnabled();
    expect((await readRecord(record.id))?.timeline).toBe("Before the experiment");
    const saved = page.waitForResponse(
      (response) => response.url().endsWith(`/records/${record.id}`) && response.request().method() === "PATCH",
    );
    await save.click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    expect(response.request().postDataJSON()).toEqual({ timeline: "Day 2, dawn — after the storm" });
    await expect(save).toBeDisabled();
    expect(await readRecord(record.id)).toMatchObject({
      timeline: "Day 2, dawn — after the storm",
      content: record.content,
      messageIds: record.messageIds,
      audienceCharacterIds: record.audienceCharacterIds,
    });
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openInspector();
    await inspector.getByRole("button", { name: /^Scene #1\b/ }).click();
    await expect(timeframe).toHaveValue("Day 2, dawn — after the storm");
    await timeframe.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await captureThemes(page, info, "scene-timeframe-after");
    await timeframe.fill("An unsaved draft for the first scene");
    await back.click();
    // The open scene's scaffold precedes its separately imported empty summary.
    await inspector
      .getByRole("button", { name: /^Scene #2\b/ })
      .last()
      .click();
    await expect(timeframe).toHaveValue("");
    await expect(timeframe).toHaveAttribute("placeholder", "Not specified in the story");
    await expect(summaryText).toHaveValue("");
    await expect(save).toBeDisabled();
    await timeframe.fill("The experiment begins at noon");
    await expect(save).toBeEnabled();
    const emptySaved = page.waitForResponse(
      (response) => response.url().endsWith(`/records/${emptyRecord.id}`) && response.request().method() === "PATCH",
    );
    await save.click();
    const emptyResponse = await emptySaved;
    expect(emptyResponse.ok()).toBeTruthy();
    expect(emptyResponse.request().postDataJSON()).toEqual({ timeline: "The experiment begins at noon" });
    await expect(save).toBeDisabled();
    expect(await readRecord(emptyRecord.id)).toMatchObject({
      timeline: "The experiment begins at noon",
      content: "",
      status: "open",
      enabled: true,
    });
    await back.click();
    await inspector.getByRole("button", { name: /^Scene #1\b/ }).click();
    await expect(timeframe).toHaveValue("Day 2, dawn — after the storm");
    await timeframe.fill("   ");
    await save.click();
    await expect(save).toBeDisabled();
    await expect.poll(async () => (await readRecord(record.id))?.timeline).toBe("");
    await back.click();
    await expect(inspector.getByRole("button", { name: /^Scene #1\b/ })).toContainText(
      "Story timeframe: Not specified in the story",
    );
    await inspector.getByRole("button", { name: /^Scene #1\b/ }).click();
    await expect(timeframe).toHaveValue("");
  } finally {
    await fixture.cleanup();
  }
});

test("Advanced Memory stays in Chat Settings with confirmed knowledge, resumable progress and editable scenes", async ({
  page,
  request,
}, info) => {
  // Setup/resume, deletion retries and both-theme captures share this scenario.
  test.setTimeout(150_000);
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
      decisionEnabled: false,
      decisionConnectionId: null,
      initialProcessingModel: "helper",
      sceneCheckInterval: 5,
      retrieveMaxScenes: 3,
      retrieveMinMessages: 3,
      retrieveMaxMessages: 10,
      narratorCharacterId: null,
      autoMessageVisibility: false,
      characterRecollections: false,
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
  let resetRequests = 0;
  let deleteSceneRequests = 0;
  let failSceneDelete = true;
  let watchRecordRefetches = false;
  const recordRefetches: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      watchRecordRefetches &&
      request.method() === "GET" &&
      (path === `/api/chats/${fixture.chat.id}` || path.endsWith("/sources"))
    )
      recordRefetches.push(path);
  });
  let releaseResume: (() => void) | undefined;
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === "DELETE" && pathname.includes("/records/")) {
      deleteSceneRequests += 1;
      if (failSceneDelete) {
        failSceneDelete = false;
        return route.fulfill({ status: 500, json: { error: "Scene deletion failed; please retry." } });
      }
      const record = status.records.find((item) => item.id === pathname.split("/").at(-1));
      if (!record) throw new Error("Expected the selected scene summary");
      status.records = status.records.filter((item) =>
        record.kind === "scene" ? item.kind !== "scene" || item.sceneId !== record.sceneId : item.id !== record.id,
      );
      if (status.job.status === "running") status.job.status = "cancelled";
      return route.fulfill({ json: status });
    }
    if (method === "DELETE") {
      resetRequests += 1;
      status.records = [];
      status.job = { status: "idle", stage: "idle", completed: 0, total: 0, error: null };
      delete status.latestReceipt;
      return route.fulfill({ json: status });
    }
    if (pathname.endsWith("/sources")) return route.fulfill({ json: fixture.messages });
    if (method === "PATCH" && pathname.endsWith("/settings")) {
      Object.assign(status.settings, route.request().postDataJSON());
    } else if (method === "POST" && pathname.endsWith("/initialize")) {
      const body = route.request().postDataJSON();
      initializeBodies.push(body);
      if (initializeBodies.length === 2)
        await new Promise<void>((resolve) => {
          releaseResume = resolve;
        });
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
        ...(patch.content !== undefined ? { embeddingStatus: "pending" } : {}),
      });
      if (status.job.status === "running") status.job.status = "cancelled";
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
    const memoryHeader = drawerToggle(memorySection);
    await expect(memoryHeader).toHaveAttribute("aria-expanded", "false");
    await page.evaluate((chatId) => {
      window.dispatchEvent(new CustomEvent("marinara:advanced-memory-settings", { detail: { chatId } }));
    }, fixture.chat.id);
    await expect(memoryHeader).toHaveAttribute("aria-expanded", "true");
    await memoryHeader.click();
    await expect(memoryHeader).toHaveAttribute("aria-expanded", "false");
    await expect(settings).toHaveCount(0);
    await memoryHeader.click();
    const advancedToggle = settings.getByRole("checkbox", { name: /^Advanced Memory Recall/ });
    await expect(advancedToggle).not.toBeChecked();
    await settings.getByText("Advanced Memory Recall", { exact: true }).click();
    await expect(advancedToggle).toBeChecked();
    await expect(settings.getByLabel("Maximum allowed context before compression (tokens)")).toHaveValue("65000");
    await expect(settings.getByLabel("Minimum messages per excerpt")).toHaveValue("3");
    await expect(settings.getByLabel("Maximum messages per excerpt")).toHaveValue("10");
    const sceneLimit = settings.getByLabel("Maximum recalled scenes", { exact: true });
    await expect(sceneLimit).toHaveValue("3");
    await sceneLimit.fill("2");
    await sceneLimit.press("Enter");
    await expect.poll(() => status.settings.retrieveMaxScenes).toBe(2);
    await expect(sceneLimit).toHaveValue("2");
    await sceneLimit.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-scene-limit", settings);

    await expect(settings.getByLabel("Narrator", { exact: true })).toHaveValue("");
    await expect(settings).toContainText("Moving context");
    const minimum = settings.getByLabel("Minimum messages per excerpt");
    const maximum = settings.getByLabel("Maximum messages per excerpt");
    await minimum.fill("0");
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith("/advanced-memory/settings") && response.request().method() === "PATCH",
      ),
      minimum.press("Tab"),
    ]);
    await expect(maximum).toBeEnabled();
    await expect.poll(() => status.settings.retrieveMinMessages).toBe(0);
    await maximum.fill("0");
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith("/advanced-memory/settings") && response.request().method() === "PATCH",
      ),
      maximum.press("Tab"),
    ]);
    await expect(maximum).toBeEnabled();
    await expect.poll(() => status.settings.retrieveMaxMessages).toBe(0);
    await expect(minimum).toHaveValue("0");
    await maximum.fill("5");
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith("/advanced-memory/settings") && response.request().method() === "PATCH",
      ),
      maximum.press("Tab"),
    ]);
    await expect(maximum).toBeEnabled();
    await expect.poll(() => status.settings.retrieveMaxMessages).toBe(5);
    await expect(minimum).toHaveValue("0");
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
    await expect(wheel).toHaveCSS(
      "background-image",
      /\/sprites\/mari\/generated\/professor-mari-memory-wheel-v2\.webp/,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(wheel).toHaveCSS("animation-name", "none");
    // Reduced motion runs no transitions. A theme change used to start one for every property of every
    // element, which made each switch below cost seconds on CI and ran this test out of time.
    const themeTransitions = await page.evaluate(async () => {
      let started = 0;
      const count = () => (started += 1);
      document.addEventListener("transitionrun", count);
      try {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        const ui = useUIStore.getState();
        const next = ui.theme === "dark" ? "light" : "dark";
        ui.setTheme(next);
        for (let frame = 0; frame < 60 && document.documentElement.dataset.theme !== next; frame++)
          await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        return document.documentElement.dataset.theme === next ? started : -1;
      } finally {
        document.removeEventListener("transitionrun", count);
      }
    });
    expect(themeTransitions).toBe(0);
    await progress.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-progress");
    await progress.getByRole("button", { name: "Pause processing", exact: true }).click();
    await expect(progress).toContainText("Memory processing paused");
    await expect(progress.getByRole("progressbar")).toHaveAttribute("value", "1");
    await expect(progress).toContainText("1 of 4 work units completed");
    await captureThemes(page, info, "advanced-memory-paused");
    await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
    await expect(drawer).toBeHidden();
    await openChatSettings(page);
    await expect(progress).toContainText("Memory processing paused");
    await expect(progress).toContainText("1 of 4 work units completed");
    await progress.getByRole("button", { name: "Resume processing", exact: true }).click();
    await expect.poll(() => initializeBodies.length).toBe(2);
    await expect(progress).toContainText("Starting memory processing…");
    await expect(progress).toHaveAttribute("aria-busy", "true");
    const resumeButton = progress.getByRole("button", { name: "Resume processing", exact: true });
    await expect(resumeButton).toBeDisabled();
    await resumeButton.evaluate((button: HTMLButtonElement) => button.click());
    expect(initializeBodies).toHaveLength(2);
    releaseResume?.();
    await expect(progress.getByRole("progressbar")).toHaveAttribute("value", "1");
    status.job = { ...status.job, total: 1 };
    await expect(progress).toContainText("1 of 1 work unit completed");
    status.job = { ...status.job, status: "ready", stage: "ready", completed: 4, total: 4 };
    status.records = [
      {
        id: "scene-summary-proof",
        chatId: fixture.chat.id,
        sceneId: "scene-proof",
        kind: "scene",
        status: "closed",
        startMessageId: firstMessage.id,
        endMessageId: lastMessage.id,
        startIndex: 1,
        endIndex: 2,
        messageIds: fixture.messages.map(({ id }) => id),
        audienceCharacterIds: [character.id, narrator.id],
        content: "The laboratory promise concerns a blue notebook. ".repeat(80),
        title: "The laboratory promise",
        timeline: "Before the experiment",
        enabled: true,
        manualOverride: true,
        sourceFingerprint: "proof",
        dependencies: [],
        embeddingStatus: "stale",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await expect(progress).toContainText("Memory is ready");
    const toggleWidth = await advancedToggle
      .locator("xpath=ancestor::div[1]")
      .evaluate((element) => element.getBoundingClientRect().width);
    const progressWidth = await progress.evaluate((element) => element.getBoundingClientRect().width);
    expect(Math.abs(toggleWidth - progressWidth)).toBeLessThan(2);
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
    status.records.push(
      {
        ...status.records[0]!,
        id: "excerpt-proof",
        kind: "excerpt",
        content: "Exact words from the notebook conversation.",
      },
      {
        ...status.records[0]!,
        id: "later-scene",
        sceneId: "later-scene",
        startIndex: 3,
        endIndex: 4,
        content: "A later experiment with a silver vial.",
        timeline: null,
      },
    );
    // Explicit actions refresh a ready archive; there is no idle polling.
    await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
    await expect(inspector.getByRole("button", { name: /Scene #2/ })).toBeVisible();
    await expect(inspector.getByRole("button", { name: /Scene #2/ })).toContainText(
      "Story timeframe: Not specified in the story",
    );
    const search = inspector.getByRole("searchbox", { name: "Search scenes and memories…" });
    await search.fill("silver vial");
    await expect(inspector.locator("ul > li")).toHaveCount(1);
    await expect(inspector.getByRole("button", { name: /Scene #2/ })).toBeVisible();
    await search.fill("not found anywhere");
    await expect(inspector).toContainText("No matching scenes or memories.");
    await search.fill("");
    await expect(inspector.locator("ul > li")).toHaveCount(2);
    await expect(inspector.getByRole("button", { name: /Scene #1/ })).toContainText("Dottore, Narrator");
    const cardBounds = await inspector.locator("ul > li > button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const { y, height } = button.getBoundingClientRect();
        const row = button.parentElement!.getBoundingClientRect();
        return { y, height, rowY: row.y, rowHeight: row.height };
      }),
    );
    await captureThemes(page, info, "advanced-memory-scene-spacing", inspector.locator("ul"));
    expect(cardBounds[0]!.height, "long summaries have a compact three-line preview").toBeLessThan(300);
    const topGap = cardBounds[0]!.y - cardBounds[0]!.rowY;
    const rowSlack = cardBounds[0]!.rowHeight - cardBounds[0]!.height;
    const cardGap = cardBounds[1]!.y - cardBounds[0]!.y - cardBounds[0]!.height;
    expect(topGap).toBeGreaterThanOrEqual(0);
    expect(topGap, "clamped text must not shift the button baseline down").toBeLessThan(2);
    expect(rowSlack).toBeGreaterThanOrEqual(0);
    expect(rowSlack, "the row fits its visible card").toBeLessThan(2);
    expect(cardGap).toBeGreaterThanOrEqual(0);
    expect(cardGap, "scene cards follow each other").toBeLessThan(20);
    await expect(inspector.getByText("Exact words from the notebook conversation.")).toHaveCount(0);
    await inspector.getByRole("button", { name: /Scene #1/ }).click();
    await expect(inspector.getByRole("textbox", { name: "Story timeframe", exact: true })).toHaveValue(
      "Before the experiment",
    );
    await inspector.getByRole("button", { name: "Back to scenes", exact: true }).scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-legacy-access");
    await expect(inspector.getByText(/Older memories used chat visibility/)).toHaveCount(0);
    await expect(inspector.getByText("Closed", { exact: true })).toBeVisible();
    await inspector.getByRole("button", { name: "Edit character access", exact: true }).click();
    const access = inspector.getByRole("group", { name: "Characters who can recall this scene" });
    await expect(access).toContainText("Select the characters who were present");
    await access.getByText("Narrator", { exact: true }).click();
    await expect(access.getByRole("checkbox", { name: "Narrator", exact: true })).not.toBeChecked();
    await inspector.getByRole("button", { name: "Save correction", exact: true }).click();
    await expect.poll(() => status.records[0]?.audienceCharacterIds).toEqual([character.id]);
    await captureThemes(page, info, "advanced-memory-scene-access", access);
    await access.getByText("Narrator", { exact: true }).click();
    await expect(access.getByRole("checkbox", { name: "Narrator", exact: true })).toBeChecked();
    await inspector.getByRole("button", { name: "Save correction", exact: true }).click();
    await expect.poll(() => status.records[0]?.audienceCharacterIds).toEqual([character.id, narrator.id]);
    expect(initializeBodies).toHaveLength(3);
    await access.getByText("Dottore", { exact: true }).click();
    await access.getByText("Narrator", { exact: true }).click();
    await expect(access).toContainText("No characters selected: only the narrator can recall this scene.");
    await inspector.getByRole("button", { name: "Save correction", exact: true }).click();
    await expect.poll(() => status.records[0]?.audienceCharacterIds).toEqual([]);
    await expect(inspector).toContainText("Messages 1–2 · Narrator only");
    // Capture the visible inspector without scrolling its tall container during theme changes.
    await captureThemes(page, info, "advanced-memory-narrator-only");
    await inspector
      .getByRole("textbox", { name: "Summary text", exact: true })
      .fill("Correction: the notebook is green.");
    await inspector.getByRole("button", { name: "Save correction", exact: true }).click();
    await expect.poll(() => status.records[0]?.content).toBe("Correction: the notebook is green.");
    status.records[0]!.embeddingStatus = "stale";
    await inspector.getByText("Include in recall", { exact: true }).click();
    await expect(inspector.getByRole("checkbox", { name: "Include in recall", exact: true })).not.toBeChecked();
    await expect.poll(() => status.records[0]?.enabled).toBe(false);
    const saveButton = inspector.getByRole("button", { name: "Save correction", exact: true });
    const sourceButton = inspector.getByRole("button", { name: "Inspect source messages", exact: true });
    await expect(
      inspector.getByText(/Check the source messages, the summary, and which characters know it/),
    ).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-review-correction");
    const correctionRequest = page.waitForRequest(
      (request) => request.method() === "PATCH" && request.url().includes("/advanced-memory/records/"),
    );
    await saveButton.click();
    expect((await correctionRequest).postDataJSON()).toEqual({ content: "Correction: the notebook is green." });
    await expect(saveButton).toBeDisabled();
    await expect(
      inspector.getByText(/Check the source messages, the summary, and which characters know it/),
    ).toHaveCount(0);
    const saveBounds = await saveButton.boundingBox();
    const sourceBounds = await sourceButton.boundingBox();
    expect(saveBounds).not.toBeNull();
    expect(sourceBounds).not.toBeNull();
    expect(Math.abs(saveBounds!.x - sourceBounds!.x)).toBeLessThan(1);
    expect(Math.abs(saveBounds!.width - sourceBounds!.width)).toBeLessThan(1);
    expect(sourceBounds!.y).toBeGreaterThanOrEqual(saveBounds!.y + saveBounds!.height);
    await sourceButton.click();
    await expect(inspector).toContainText("I will remember the blue notebook.");
    status.job = { ...status.job, status: "running", blocking: false, stage: "summarizing" };
    await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
    await expect(inspector.getByRole("button", { name: "Reindex", exact: true })).toBeDisabled();
    const recallToggle = inspector.getByRole("checkbox", { name: "Include in recall", exact: true });
    await expect(recallToggle).toBeEnabled();
    watchRecordRefetches = true;
    await inspector.getByText("Include in recall", { exact: true }).click();
    await expect(recallToggle).toBeChecked();
    await expect(recallToggle).toBeEnabled();
    await inspector.getByText("Include in recall", { exact: true }).click();
    await expect(recallToggle).not.toBeChecked();
    await expect(recallToggle).toBeEnabled();
    expect(recordRefetches, "a recall toggle must not refetch the chat or its inspected source messages").toEqual([]);
    watchRecordRefetches = false;
    await inspector.getByRole("button", { name: "Back to scenes", exact: true }).click();
    await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
    await expect.poll(() => reindexRequests).toBe(3);
    expect(status.records[0]?.enabled).toBe(false);
    for (let index = 0; index < 10; index++) {
      status.records.push({
        ...status.records[0]!,
        id: `long-scene-${index}`,
        sceneId: `long-scene-${index}`,
        startIndex: 5 + index * 2,
        endIndex: 6 + index * 2,
        content: "A long historical recap with several events and their outcomes. ".repeat(100),
      });
    }
    await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
    await expect(inspector.locator("ul > li")).toHaveCount(12);
    await inspector.locator("ul > li").last().scrollIntoViewIfNeeded();
    const longRows = await inspector.locator("ul > li").evaluateAll((rows) =>
      rows.map((row) => {
        const { y, height } = row.getBoundingClientRect();
        return { y, height };
      }),
    );
    for (let index = 1; index < longRows.length; index++) {
      expect(longRows[index]!.height).toBeLessThan(300);
      const gap = longRows[index]!.y - longRows[index - 1]!.y - longRows[index - 1]!.height;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThan(20);
    }
    await inspector.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "advanced-memory-inspector");
    await inspector.getByRole("button", { name: /^Scene #1\b/ }).click();
    const deleteSceneButton = inspector.getByRole("button", { name: "Delete summary", exact: true });
    await deleteSceneButton.click();
    const deleteSceneDialog = page.getByRole("dialog", { name: "Delete summary", exact: true });
    await expect(deleteSceneDialog).toContainText("Delete Scene #1 for Narrator only?");
    await expect(deleteSceneDialog).toContainText("Original chat messages stay intact.");
    await captureThemes(page, info, "advanced-memory-delete-confirm", deleteSceneDialog);
    await deleteSceneDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(deleteSceneRequests).toBe(0);
    await expect(inspector.getByRole("textbox", { name: "Summary text", exact: true })).toHaveValue(
      "Correction: the notebook is green.",
    );
    await deleteSceneButton.click();
    await deleteSceneDialog.getByRole("button", { name: "Delete summary", exact: true }).click();
    await expect(
      page.getByText("Advanced Memory: Scene deletion failed; please retry.", { exact: true }),
    ).toBeVisible();
    await expect(deleteSceneButton).toBeEnabled();
    status.job = { ...status.job, status: "running", blocking: false, stage: "summarizing" };
    await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
    await expect(inspector.getByRole("button", { name: "Reindex", exact: true })).toBeDisabled();
    await expect(deleteSceneButton).toBeEnabled();
    watchRecordRefetches = true;
    await deleteSceneButton.click();
    await deleteSceneDialog.getByRole("button", { name: "Delete summary", exact: true }).click();
    await expect.poll(() => deleteSceneRequests).toBe(2);
    await expect(inspector.locator("ul > li")).toHaveCount(11);
    expect(recordRefetches, "deleting a summary must not refetch the chat or its source messages").toEqual([]);
    watchRecordRefetches = false;
    expect(resetRequests).toBe(0);
    for (const kind of ["continuity", "temporary"] as const) {
      const legacy = {
        ...status.records[0]!,
        id: `old-${kind}`,
        sceneId: `old-${kind}-source`,
        kind,
        title: kind === "continuity" ? "Continuity" : "Ongoing scene",
        content: "Unwanted old summary",
      };
      status.records.push(legacy);
      await inspector.getByRole("button", { name: "Reindex", exact: true }).click();
      await expect(inspector.getByRole("button", { name: new RegExp(`^${legacy.title}`) })).toBeVisible();
      await inspector.getByRole("button", { name: new RegExp(`^${legacy.title}`) }).click();
      const remove = inspector.getByRole("button", { name: "Delete summary", exact: true });
      await remove.scrollIntoViewIfNeeded();
      await captureThemes(page, info, `delete-${kind}`);
      await remove.click();
      await deleteSceneDialog.getByRole("button", { name: "Delete summary", exact: true }).click();
      await expect(inspector.locator("ul > li")).toHaveCount(11);
      expect(status.records.some((record) => record.id === legacy.id)).toBe(false);
    }
    await inspector.getByRole("button", { name: "Delete all memories", exact: true }).click();
    const resetDialog = page.getByRole("dialog", { name: "Delete all memories", exact: true });
    await expect(resetDialog).toContainText("Original chat messages and your settings will stay intact.");
    await resetDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(resetRequests).toBe(0);
    await expect(inspector.locator("ul > li")).toHaveCount(11);
    await inspector.getByRole("button", { name: "Delete all memories", exact: true }).click();
    await resetDialog.getByRole("button", { name: "Delete all memories", exact: true }).click();
    await expect.poll(() => resetRequests).toBe(1);
    await expect(inspector).toContainText(
      "Prepared scene summaries appear here. Constant summaries are in Chat Summaries.",
    );
    await expect(settings.getByRole("button", { name: "Prepare existing history", exact: true })).toBeVisible();
    await settings.getByRole("button", { name: "Review character knowledge", exact: true }).click();
    await expect(confirmation).toBeVisible();
    await settings.getByText("Advanced Memory Recall", { exact: true }).click();
    await expect(advancedToggle).not.toBeChecked();
    await expect(confirmation).toHaveCount(0);
    await expect(settings.getByLabel("Maximum allowed context before compression (tokens)")).toHaveCount(0);
    await expect(inspector).toHaveCount(0);
    await expect(drawer.getByRole("checkbox", { name: /^Enable Memory Recall/ })).not.toBeChecked();
    await drawer.getByRole("button", { name: "Access memories for this chat", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Memories for This Chat", exact: true })).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test("Advanced Recall background activity appears without ordinary agents", async ({ page, request }, info) => {
  const fixture = await createFixture(request);
  const status: AdvancedMemoryStatus = {
    settings: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true },
    job: {
      id: "background-recall",
      status: "running",
      stage: "summarizing",
      blocking: false,
      completed: 1,
      total: 2,
      error: null,
    },
    missingKnowledgeCharacterIds: [],
    records: [],
    helperModel: "Mock helper",
    summaryModel: "Mock summaries",
    warnings: [],
  };
  expect(
    (await request.patch(`/api/chats/${fixture.chat.id}/metadata`, { data: { advancedMemory: status.settings } })).ok(),
  ).toBeTruthy();
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory`, (route) => route.fulfill({ json: status }));
  let resumed = 0;
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory/initialize`, (route) => {
    resumed += 1;
    status.job = { ...status.job, status: "running", stage: "indexing", error: null };
    return route.fulfill({ status: 202, json: status });
  });
  try {
    await openChat(page, fixture.chat.id, false);
    // Agent activity is a Chat Settings section below Agents.
    const activity = (await openChatSettingsTool(page, "agent-activity")).locator(
      '[data-component="AdvancedRecallActivity"]',
    );
    await expect(activity).toContainText("Advanced Recall");
    await expect(activity).toContainText("Summarizing scenes");
    await expect(activity.getByRole("progressbar")).toHaveAttribute("value", "1");
    await captureThemes(page, info, "advanced-recall-agents-menu", activity.locator(".."));
    status.job = { ...status.job, status: "error", error: "Synthetic archive failure" };
    await expect(activity).toContainText("Synthetic archive failure");
    await activity.getByRole("button", { name: "Resume processing", exact: true }).click();
    await expect.poll(() => resumed).toBe(1);
    await expect(activity).toContainText("Indexing messages and scenes");
    status.job = { ...status.job, status: "ready", stage: "ready", completed: 2 };
    await expect(activity).toContainText("Memory is ready");
  } finally {
    await fixture.cleanup();
  }
});

for (const work of ["scene-check", "summary"] as const)
  test(`Advanced Memory stays idle, streams OpenAI replies and reports post-generation ${work}`, async ({
    page,
    request,
  }, info) => {
    const fixture = await createFixture(request);
    const firstChunk = "The blue notebook is open on the laboratory table.";
    const lastChunk = " Its final page contains the answer.";
    const providerRequests: Array<{ stream?: boolean; model?: string }> = [];
    let pending: ServerResponse | undefined;
    let pendingMemory: ServerResponse | undefined;
    const provider = createServer(async (incoming, response) => {
      if (incoming.method !== "POST" || incoming.url !== "/v1/responses") {
        incoming.resume();
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ id: "gpt-6-astra" }] }));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      providerRequests.push(body);
      if (!body.stream) {
        pendingMemory = response;
        return;
      }
      pending = response;
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: firstChunk })}\n\n`);
    });
    let connectionId: string | undefined;
    try {
      await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
      const address = provider.address();
      if (!address || typeof address === "string") throw new Error("Streaming fixture did not bind");
      const connection = await request.post("/api/connections", {
        data: {
          name: "Memory streaming proof",
          provider: "openai",
          model: "gpt-6-astra",
          apiKey: "fixture",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          maxContext: 65_000,
          maxTokensOverride: 1024,
        },
      });
      expect(connection.ok()).toBeTruthy();
      connectionId = (await connection.json()).id;
      expect(
        (
          await request.patch(`/api/chats/${fixture.chat.id}`, {
            data: { connectionId, characterIds: [fixture.character.id] },
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.patch(`/api/chats/${fixture.chat.id}/metadata`, {
            data: {
              groupChatMode: "shared",
              advancedMemory: {
                ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
                enabled: true,
                sceneCheckInterval: work === "scene-check" ? 1 : 100,
              },
              ...(work === "summary"
                ? {
                    summaryEntries: [
                      createChatSummaryEntry({
                        content: "The blue notebook records the laboratory promise. ".repeat(800),
                        enabled: true,
                        rangeStartIndex: 1,
                        rangeEndIndex: 1,
                      }),
                    ],
                  }
                : {}),
              advancedMemoryState: { status: "ready", stage: "ready", sceneCheckMessageId: fixture.lastMessage.id },
            },
          })
        ).ok(),
      ).toBeTruthy();
      if (work === "summary")
        expect(
          (
            await request.patch(`/api/chats/${fixture.chat.id}/messages/${fixture.lastMessage.id}/extra`, {
              data: { isConversationStart: true },
            })
          ).ok(),
        ).toBeTruthy();
      let polls = 0;
      const statusRequests = new Set<Request>();
      page.on("request", (request) => {
        if (request.url().endsWith(`/chats/${fixture.chat.id}/advanced-memory`)) statusRequests.add(request);
      });
      page.on("requestfinished", (request) => statusRequests.delete(request));
      page.on("requestfailed", (request) => statusRequests.delete(request));
      page.on("response", (response) => {
        if (response.url().endsWith(`/chats/${fixture.chat.id}/advanced-memory`)) polls++;
      });
      await openChat(page, fixture.chat.id, false);
      // Agent activity, the Chat Settings section below Agents, shows Advanced Recall progress.
      const activity = (await openChatSettingsTool(page, "agent-activity")).locator(
        '[data-component="AdvancedRecallActivity"]',
      );
      await expect.poll(() => polls).toBeGreaterThan(0);
      const idlePolls = polls;
      // Observe beyond the former five-second interval: an idle archive must stay idle.
      await page.waitForTimeout(5500);
      expect(polls).toBe(idlePolls);
      expect(providerRequests).toHaveLength(0);
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.setState({ enableStreaming: true, streamingSpeed: 100 });
      });
      // On phones the Chat Settings sheet covers the send button, so close it like a user would.
      await closeChatSettings(page);
      await page.locator("textarea[data-chat-composer]").fill("Open the notebook.");
      await page.locator("button.mari-chat-send-btn").click();
      await expect(page.getByText(firstChunk, { exact: true })).toBeVisible();
      expect(providerRequests).toEqual([expect.objectContaining({ stream: true, model: "gpt-6-astra" })]);
      expect(pending?.writableEnded).toBe(false);
      expect((await request.get(`/api/chats/${fixture.chat.id}/advanced-memory`)).ok()).toBeTruthy();
      await expect(page.getByText(firstChunk, { exact: true })).toBeVisible();
      await expect(page.locator("button.mari-chat-send-btn .lucide-circle-stop")).toBeVisible();
      await page.screenshot({ path: info.outputPath("advanced-memory-openai-live-tokens.png") });
      pending!.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: lastChunk })}\n\n`);
      pending!.end(
        `data: ${JSON.stringify({ type: "response.completed", response: { id: "fixture", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: firstChunk + lastChunk }] }] } })}\n\n`,
      );
      await expect(page.getByText(firstChunk + lastChunk, { exact: true })).toBeVisible();
      await expect(page.locator("button.mari-chat-send-btn .lucide-send")).toBeVisible();
      await expect.poll(() => !!pendingMemory).toBe(true);
      // Reopen Chat Settings to follow the memory work after the reply.
      await openChatSettingsTool(page, "agent-activity");
      await expect(activity).toContainText(work === "scene-check" ? "Finding scene boundaries" : "Updating continuity");
      const sceneCheckRun = page.locator('[data-agent-activity="advanced-recall"]');
      await expect(sceneCheckRun).toContainText("Advanced Recall");
      await captureThemes(page, info, `live-${work}-activity`, activity.locator(".."));
      const activePolls = polls;
      await expect.poll(() => polls).toBeGreaterThan(activePolls);
      pendingMemory!.writeHead(200, { "content-type": "application/json" });
      pendingMemory!.end(
        JSON.stringify({
          id: "scene-check",
          status: "completed",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(
                    work === "scene-check"
                      ? { ends: [] }
                      : { summary: "The laboratory promise was recorded in the blue notebook." },
                  ),
                },
              ],
            },
          ],
        }),
      );
      await expect(activity).toContainText("Memory is ready");
      await expect(sceneCheckRun).toBeVisible();
      await expect.poll(() => statusRequests.size).toBe(0);
      const completedPolls = polls;
      await page.waitForTimeout(5500);
      expect(polls).toBe(completedPolls);
      expect(providerRequests).toHaveLength(2);
    } finally {
      pending?.destroy();
      pendingMemory?.destroy();
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
      await page.close();
      await fixture.cleanup();
      if (connectionId) await request.delete(`/api/connections/${connectionId}`);
    }
  });

test("Advanced Memory keeps routine normal and guided replies quiet while preserving settings actions", async ({
  page,
  request,
}, info) => {
  const fixture = await createFixture(request);
  const otherChat = await createFixture(request);
  const status: AdvancedMemoryStatus = {
    settings: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true },
    job: { status: "idle", stage: "idle", completed: 0, total: 0, error: null },
    missingKnowledgeCharacterIds: [],
    records: [],
    helperModel: "Mock helper",
    summaryModel: "Mock summaries",
    warnings: [],
  };
  const cases: Array<{ text: string; job: Partial<AdvancedMemoryStatus["job"]>; opens: boolean }> = [
    { text: "Remember the blue notebook.", job: { status: "running", blocking: true }, opens: false },
    { text: "/guided Keep the blue notebook in the scene.", job: { status: "running" }, opens: false },
    {
      text: "Check the background memory job",
      job: { status: "error", blocking: false, id: "legacy-job" },
      opens: false,
    },
    { text: "Background preparation recovered", job: { status: "ready", blocking: false }, opens: false },
    {
      text: "The background failure returns after recovery",
      job: { status: "error", blocking: false, id: "legacy-job" },
      opens: false,
    },
    { text: "Check the blocking memory job", job: { status: "error" }, opens: true },
    { text: "Check knowledge confirmation", job: { status: "needs_confirmation", blocking: true }, opens: true },
  ];
  let generationRequests = 0;
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory`, (route) => route.fulfill({ json: status }));
  await page.route("**/api/generate", async (route) => {
    const current = cases[generationRequests];
    if (!current) throw new Error("Unexpected memory fixture generation");
    const payload = route.request().postDataJSON();
    if (generationRequests === 1) {
      expect(payload.generationGuide).toContain("Keep the blue notebook in the scene.");
      expect(payload.generationGuideSource).toBe("narrator");
    } else {
      expect(payload.userMessage).toBe(current.text);
    }
    generationRequests += 1;
    status.job = {
      id: `memory-${generationRequests}`,
      status: "running",
      stage: "compacting",
      completed: 1,
      total: 2,
      error: current.job.status === "error" ? "Synthetic memory preparation failed" : null,
      ...current.job,
    };
    const saved = await request.post(`/api/chats/${fixture.chat.id}/messages`, {
      data: {
        role: "assistant",
        content: `Memory fixture reply ${generationRequests}.`,
        characterId: fixture.character.id,
      },
    });
    expect(saved.ok()).toBeTruthy();
    const message = await saved.json();
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "advanced_memory_status", data: { chatId: fixture.chat.id, job: status.job } },
        { type: "message_saved", data: message },
        { type: "assistant_message_ready", data: message },
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
    for (const [index, current] of cases.entries()) {
      await composer.fill(current.text);
      await page.locator("button.mari-chat-send-btn").click();
      await expect.poll(() => generationRequests).toBe(index + 1);
      await expect(page.locator("button.mari-chat-send-btn .lucide-send")).toBeVisible();
      if (index < 2) {
        await page.screenshot({ path: info.outputPath(`routine-memory-${index === 0 ? "normal" : "guided"}.png`) });
      }
      if (current.opens) {
        await expect(drawer).toBeVisible();
        if (current.job.status === "error") {
          await expect(drawer.locator('[data-component="AdvancedMemoryProgress"]')).toContainText(
            "Synthetic memory preparation failed",
          );
          await page.locator("[data-sonner-toast]").getByRole("button", { name: "Review memory", exact: true }).click();
        }
        await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
      } else {
        await expect(drawer).toBeHidden();
      }
      if (current.job.status === "error" && current.job.blocking === false) {
        const notice = page.locator("[data-sonner-toast]").filter({ hasText: "Advanced Memory stopped." });
        await expect(notice).toHaveCount(1);
        await page.evaluate(async (chatId) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setActiveChatId(chatId);
        }, otherChat.chat.id);
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return useChatStore.getState().activeChatId;
            }),
          )
          .toBe(otherChat.chat.id);
        await notice.getByRole("button", { name: "Review memory", exact: true }).click();
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return useChatStore.getState().activeChatId;
            }),
          )
          .toBe(fixture.chat.id);
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('[data-component="AdvancedMemoryProgress"]')).toContainText(
          "Synthetic memory preparation failed",
        );
        await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
      }
      if (index === 1) {
        // Quiet progress remains available through the normal settings action.
        await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
        const section = drawer.locator('[data-chat-settings-section="roleplay-memory-recall"]');
        const header = drawerToggle(section);
        if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
        const progress = section.locator('[data-component="AdvancedMemoryProgress"]');
        await expect(progress).toContainText("Updating continuity");
        await expect(progress.getByRole("progressbar")).toHaveAttribute("value", "1");
        await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
      }
    }
  } finally {
    await page.close().catch(() => undefined);
    await otherChat.cleanup();
    await fixture.cleanup();
  }
});

for (const deleted of [false, true])
  test(`${deleted ? "deleted" : "missing"} scene recovery identifies the blocked memory and prepares only its missing range`, async ({
    page,
    request,
  }, info) => {
    const fixture = await createFixture(request);
    const record = {
      id: "corrected-scene",
      chatId: fixture.chat.id,
      sceneId: "scene-943",
      kind: "scene" as const,
      status: "closed" as const,
      startMessageId: fixture.firstMessage.id,
      endMessageId: fixture.lastMessage.id,
      startIndex: 943,
      endIndex: 947,
      messageIds: fixture.messages.map(({ id }) => id),
      audienceCharacterIds: [fixture.character.id],
      content: "The saved correction stays intact.",
      title: "Saved scene",
      timeline: null,
      enabled: true,
      manualOverride: true,
      sourceFingerprint: "fixture",
      dependencies: [],
      embeddingStatus: "vectorized" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const status: AdvancedMemoryStatus = {
      settings: {
        ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
        enabled: true,
        knowledgeStarts: { [fixture.character.id]: null, [fixture.narrator.id]: null },
      },
      job: {
        status: "error",
        stage: "summarizing",
        completed: 52,
        total: 54,
        error:
          "The manually corrected memory for messages #943–#947 (Dottore) has changed sources or supporting summaries.",
        reviewRecordId: record.id,
      },
      missingKnowledgeCharacterIds: [],
      records: [record],
      helperModel: "Fixture helper",
      summaryModel: "Fixture helper",
      warnings: [],
      unpreparedScenes: [
        { sceneId: "scene-948", startIndex: 948, endIndex: 992, ...(deleted ? { deleted: true } : {}) },
      ],
    };
    const preparations: unknown[] = [];
    const corrections: unknown[] = [];
    const savedCorrection = record.content;
    await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory**`, async (route) => {
      if (route.request().method() === "PATCH") {
        corrections.push(route.request().postDataJSON());
        status.job = { ...status.job, status: "cancelled", error: null, reviewRecordId: null };
      }
      if (route.request().method() === "POST" && new URL(route.request().url()).pathname.endsWith("/initialize")) {
        preparations.push(route.request().postDataJSON());
        status.unpreparedScenes = [];
        status.records.push({
          ...record,
          id: "recovered-scene",
          sceneId: "scene-948",
          startIndex: 948,
          endIndex: 992,
          content: "Only the missing scene was prepared.",
          manualOverride: false,
          embeddingStatus: "vectorized",
        });
      }
      return route.fulfill({ json: status });
    });
    try {
      await openChat(page, fixture.chat.id);
      const drawer = page.locator(".mari-chat-settings-drawer");
      await drawerToggle(drawer.locator('[data-chat-settings-section="roleplay-memory-recall"]')).click();
      await drawer.getByRole("button", { name: "Access memories for this chat", exact: true }).click();
      const inspector = drawer.locator('[data-component="AdvancedMemoryInspector"]');
      await expect(inspector).toBeVisible();
      await captureThemes(page, info, "memory-recovery");
      const missingLabel = deleted
        ? "Deleted summary: Scene #2 · Messages 948–992"
        : "Missing scene summary: Messages 948–992";
      await expect(inspector.getByText(missingLabel, { exact: true })).toBeVisible();
      await expect(inspector).toContainText(
        deleted ? "Other scenes and corrections stay unchanged" : "Reindexing alone cannot create a missing summary.",
      );
      await inspector.getByRole("button", { name: "Review Scene #1: Messages 943–947 · Dottore", exact: true }).click();
      await expect(inspector.getByRole("textbox", { name: "Summary text", exact: true })).toHaveValue(savedCorrection);
      await expect(inspector.getByRole("button", { name: "Save correction", exact: true })).toBeEnabled();
      await inspector.getByRole("button", { name: "Save correction", exact: true }).click();
      await expect.poll(() => corrections).toEqual([{ content: savedCorrection }]);
      await expect(inspector.getByRole("button", { name: "Save correction", exact: true })).toBeDisabled();
      await inspector.getByRole("button", { name: "Back to scenes", exact: true }).click();
      await inspector
        .getByRole("button", { name: deleted ? "Regenerate scene" : "Prepare scene", exact: true })
        .click();
      await expect.poll(() => preparations).toEqual([{ sceneId: "scene-948" }]);
      await expect(inspector.getByText(missingLabel, { exact: true })).toHaveCount(0);
      await expect(inspector.getByRole("button", { name: /Scene #2/ })).toContainText("Messages 948–992");
      await expect(inspector.getByRole("button", { name: /^Scene #1\b/ })).toContainText(savedCorrection);
      await captureThemes(page, info, "memory-recovered");
    } finally {
      await fixture.cleanup();
    }
  });

test("Advanced Memory Decision connection is optional and persists for its chat", async ({ page, request }, info) => {
  const fixture = await createFixture(request);
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: "Jev memory proof",
      provider: "decision",
      decisionSource: "custom",
      model: "jev-fixture",
      baseUrl: "http://127.0.0.1:1",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const status = async () =>
    (await (await request.get(`/api/chats/${fixture.chat.id}/advanced-memory`)).json()) as AdvancedMemoryStatus;
  const openMemory = async () => {
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const section = page.locator('[data-chat-settings-section="roleplay-memory-recall"]');
    await expect(section).toBeVisible();
    if (!(await section.locator('[data-component="AdvancedMemorySettings"]').isVisible()))
      await drawerToggle(section).click();
    return section.locator('[data-component="AdvancedMemorySettings"]');
  };
  try {
    expect(
      (await request.patch(`/api/chats/${fixture.chat.id}/advanced-memory/settings`, { data: { enabled: true } })).ok(),
    ).toBeTruthy();
    await openChat(page, fixture.chat.id);
    let settings = await openMemory();
    await expect(settings.getByText("Advanced Memory Recall", { exact: true })).toBeVisible();
    const toggle = settings.getByRole("checkbox", { name: /^Use Decision model/ });
    await expect(toggle).not.toBeChecked();
    await expect(settings.getByRole("button", { name: /^Memory Decision connection/u })).toHaveCount(0);
    await captureThemes(page, info, "memory-decision-off");
    await settings.getByText("Use Decision model", { exact: true }).click();
    const picker = settings.getByRole("button", { name: /^Memory Decision connection/u });
    await expect(picker).toBeEnabled();
    await expect(picker).toHaveAttribute("data-connection-value", "");
    await expect(settings.getByText(/Choose a usable Decision connection/)).toBeVisible();
    await chooseConnection(page, picker, connection.id);
    await expect.poll(async () => (await status()).settings.decisionConnectionId).toBe(connection.id);
    await expect(settings.getByText(/Choose a usable Decision connection/)).toHaveCount(0);
    await captureThemes(page, info, "memory-decision-on");
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    settings = await openMemory();
    await expect(settings.getByRole("checkbox", { name: /^Use Decision model/ })).toBeChecked();
    await expect(settings.getByRole("button", { name: /^Memory Decision connection/u })).toHaveAttribute(
      "data-connection-value",
      connection.id,
    );
    expect((await request.delete(`/api/connections/${connection.id}`)).ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    settings = await openMemory();
    await expect(settings.getByText(/Choose a usable Decision connection/)).toBeVisible();
    await settings.getByText("Use Decision model", { exact: true }).click();
    await expect.poll(async () => (await status()).settings.decisionEnabled).toBe(false);
    await expect(settings.getByRole("button", { name: /^Memory Decision connection/u })).toHaveCount(0);
  } finally {
    await request.delete(`/api/connections/${connection.id}`);
    await fixture.cleanup();
  }
});

test("Advanced Memory offers automatic message visibility only in individual group chats", async ({
  page,
  request,
}, info) => {
  const fixture = await createFixture(request);
  const soloResponse = await request.post("/api/chats", {
    data: { name: "Solo visibility proof", mode: "roleplay", characterIds: [fixture.character.id] },
  });
  expect(soloResponse.ok()).toBeTruthy();
  const solo = (await soloResponse.json()) as { id: string };
  const status = async () =>
    (await (await request.get(`/api/chats/${fixture.chat.id}/advanced-memory`)).json()) as AdvancedMemoryStatus;
  const openMemory = async () => {
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const section = page.locator('[data-chat-settings-section="roleplay-memory-recall"]');
    await expect(section).toBeVisible();
    if (!(await section.locator('[data-component="AdvancedMemorySettings"]').isVisible()))
      await drawerToggle(section).click();
    return section.locator('[data-component="AdvancedMemorySettings"]');
  };
  const toggleName = /^Decide who sees new messages/;
  try {
    for (const chatId of [fixture.chat.id, solo.id]) {
      expect(
        (await request.patch(`/api/chats/${chatId}/metadata`, { data: { groupChatMode: "individual" } })).ok(),
      ).toBeTruthy();
      expect(
        (await request.patch(`/api/chats/${chatId}/advanced-memory/settings`, { data: { enabled: true } })).ok(),
      ).toBeTruthy();
    }
    await openChat(page, fixture.chat.id);
    let settings = await openMemory();
    const toggle = settings.getByRole("checkbox", { name: toggleName });
    await expect(toggle).not.toBeChecked();
    await settings.getByText("Decide who sees new messages", { exact: true }).click();
    await expect.poll(async () => (await status()).settings.autoMessageVisibility).toBe(true);
    await expect(toggle).toBeChecked();
    await captureThemes(page, info, "memory-message-visibility-on");

    expect(
      (await request.patch(`/api/chats/${fixture.chat.id}/metadata`, { data: { groupChatMode: "merged" } })).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    settings = await openMemory();
    await expect(settings.getByText("Advanced Memory Recall", { exact: true })).toBeVisible();
    await expect(settings.getByRole("checkbox", { name: toggleName })).toHaveCount(0);

    await openChat(page, solo.id, false);
    settings = await openMemory();
    await expect(settings.getByText("Advanced Memory Recall", { exact: true })).toBeVisible();
    await expect(settings.getByRole("checkbox", { name: toggleName })).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${solo.id}?force=true`);
    await fixture.cleanup();
  }
});

test("Character recollections switch saves for its chat and recollections are edited and deleted inside their scene", async ({
  page,
  request,
}, info) => {
  const fixture = await createFixture(request);
  const endpoint = `/api/chats/${fixture.chat.id}/advanced-memory`;
  const drawer = page.locator(".mari-chat-settings-drawer");
  const status = async () => (await (await request.get(endpoint)).json()) as AdvancedMemoryStatus;
  const summary = "Dottore promises to preserve the blue notebook.";
  const generated = "I remember the weight of that notebook and how carefully I wrote the promise down.";
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  // Its owner could read both scene messages when it was written.
  const access = { id: "recollection-access", revision: digest([true, true]) };
  try {
    expect(
      (
        await request.patch(`${endpoint}/settings`, {
          data: {
            enabled: true,
            knowledgeConfirmed: true,
            knowledgeStarts: Object.fromEntries(fixture.characters.map(({ id }) => [id, null])),
          },
        })
      ).ok(),
    ).toBeTruthy();
    const envelope = await (await request.get(`${endpoint}/export`)).json();
    const scene = {
      chatId: fixture.chat.id,
      sceneId: `scene-${fixture.firstMessage.id}`,
      status: "closed",
      startMessageId: fixture.firstMessage.id,
      endMessageId: fixture.lastMessage.id,
      messageIds: [fixture.firstMessage.id, fixture.lastMessage.id],
      timeline: null,
      enabled: true,
      manualOverride: false,
    };
    const imported = await request.post(`${endpoint}/import`, {
      data: {
        ...envelope,
        records: [
          {
            valid: true,
            record: {
              ...scene,
              id: scene.sceneId,
              kind: "scene",
              audienceCharacterIds: [],
              content: "",
              title: "Scene",
              dependencies: [],
            },
          },
          {
            valid: true,
            record: {
              ...scene,
              id: "recollection-proof-summary",
              kind: "scene",
              audienceCharacterIds: [fixture.character.id],
              content: summary,
              title: "Scene",
              dependencies: [ADVANCED_MEMORY_SCENE_AUDIENCE],
            },
          },
          {
            valid: true,
            record: {
              ...scene,
              id: "recollection-proof-dottore",
              kind: "recollection",
              audienceCharacterIds: [fixture.character.id],
              content: generated,
              title: "Recollection",
              // Written with this summary text and what Dottore could read, so it is current.
              dependencies: [{ id: "recollection-summary", revision: digest(summary) }, access],
            },
          },
          {
            valid: true,
            record: {
              ...scene,
              // In this chat "Narrator" is an ordinary character; the Helper wrote nothing for them.
              id: "recollection-proof-empty",
              kind: "recollection",
              audienceCharacterIds: [fixture.narrator.id],
              content: "",
              title: "Recollection",
              dependencies: [{ id: "recollection-summary", revision: digest(summary) }, access],
            },
          },
        ],
      },
    });
    expect(imported.ok()).toBeTruthy();
    expect(((await imported.json()) as { imported: number }).imported).toBe(4);
    const dottore = async () =>
      (await status()).records.find(
        (item) => item.kind === "recollection" && item.audienceCharacterIds[0] === fixture.character.id,
      );

    const section = page.locator('[data-chat-settings-section="roleplay-memory-recall"]');
    const openSettings = async (notice?: string) => {
      await openChat(page, fixture.chat.id, !notice);
      if (notice) {
        // On a phone this notice covers the Chat Settings button.
        const toast = page.locator("[data-sonner-toast]").filter({ hasText: notice });
        await toast.getByRole("button", { name: "Close toast", exact: true }).click();
        await openChatSettings(page);
      }
      await expect(section).toBeVisible();
      if (!(await section.locator('[data-component="AdvancedMemorySettings"]').isVisible()))
        await drawerToggle(section).click();
    };
    const inspector = drawer.locator('[data-component="AdvancedMemoryInspector"]');
    const openScene = async () => {
      await drawer.getByRole("button", { name: "Access memories for this chat", exact: true }).click();
      await expect(inspector).toBeVisible();
      // A recollection is not a scene card of its own.
      await expect(inspector.getByRole("button", { name: /^Scene #\d+\b/ })).toHaveCount(1);
      await inspector.getByRole("button", { name: /^Scene #1\b/ }).click();
      return inspector.locator('[data-component="AdvancedMemoryRecollections"]');
    };
    await openSettings();
    const settings = section.locator('[data-component="AdvancedMemorySettings"]');
    const toggle = settings.getByRole("checkbox", { name: /^Character recollections/ });
    await expect(toggle).not.toBeChecked();
    await expect(
      settings.getByText(
        "Adds each character's short memory of a scene, in their own voice, when that scene is recalled.",
        { exact: true },
      ),
    ).toBeVisible();
    await settings.getByText("Character recollections", { exact: true }).click();
    await expect.poll(async () => (await status()).settings.characterRecollections).toBe(true);
    await expect(toggle).toBeChecked();
    await captureThemes(page, info, "character-recollections-switch", settings);

    const recollections = await openScene();
    await expect(recollections.getByRole("heading", { name: "Character recollections" })).toBeVisible();
    const text = recollections.getByRole("textbox", { name: "Dottore's recollection", exact: true });
    await expect(text).toHaveValue(generated);
    await expect(recollections.getByText("Generated", { exact: true })).toBeVisible();
    // Nothing was written for the other character: an empty field to write one in.
    await expect(recollections.getByRole("textbox", { name: "Narrator's recollection", exact: true })).toHaveValue("");
    await expect(
      recollections.getByText("No recollection was written for this character. You can write one here.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      recollections.getByRole("button", { name: "Save Narrator's recollection", exact: true }),
    ).toBeDisabled();
    const save = recollections.getByRole("button", { name: "Save Dottore's recollection", exact: true });
    await expect(save).toBeDisabled();
    await text.fill("I wrote the promise in blue ink so I could never pretend I forgot it.");
    await expect(save).toBeEnabled();
    await save.click();
    await expect
      .poll(async () => {
        const record = await dottore();
        return [record?.content, record?.manualOverride];
      })
      .toEqual(["I wrote the promise in blue ink so I could never pretend I forgot it.", true]);
    await expect(recollections.getByText("Manually edited", { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    await captureThemes(page, info, "character-recollections-inspector", recollections);

    // Once Dottore can no longer read part of the scene, the edited recollection waits for a review: saving the
    // same text puts it back into prompts.
    expect(
      (
        await request.patch(`/api/chats/${fixture.chat.id}/messages/${fixture.lastMessage.id}/extra`, {
          data: { hiddenFromAICharacterIds: [fixture.character.id] },
        })
      ).ok(),
    ).toBeTruthy();
    await expect.poll(async () => (await dottore())?.embeddingStatus).toBe("stale");
    // The hidden message also asks for a check of the scene's summary.
    await openSettings("Advanced Memory found a problem in 1 scene.");
    const review = await openScene();
    await expect(
      review.getByText(
        "Manually edited · What this character could see in the scene changed. Check it and save it to use it again.",
        { exact: true },
      ),
    ).toBeVisible();
    const reviewSave = review.getByRole("button", { name: "Save Dottore's recollection", exact: true });
    await expect(reviewSave).toBeEnabled();
    await reviewSave.click();
    await expect.poll(async () => (await dottore())?.embeddingStatus).not.toBe("stale");
    await expect(review.getByText("Manually edited", { exact: true })).toBeVisible();
    await expect(reviewSave).toBeDisabled();

    // Delete asks first, and Cancel keeps the recollection.
    const content = async () => {
      const record = await dottore();
      return [record?.content, record?.manualOverride];
    };
    const deleteButton = review.getByRole("button", { name: "Delete Dottore's recollection", exact: true });
    await deleteButton.click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete Dottore's recollection", exact: true });
    await expect(deleteDialog).toContainText("It won't be used or written again, but you can write a new one here.");
    await captureThemes(page, info, "character-recollections-delete-confirm", deleteDialog);
    await deleteDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(deleteDialog).toHaveCount(0);
    expect(await content()).toEqual(["I wrote the promise in blue ink so I could never pretend I forgot it.", true]);
    // Deleted, it leaves an empty field to write a new one in, and nothing writes it again by itself.
    await deleteButton.click();
    await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(content).toEqual(["", true]);
    const reviewText = review.getByRole("textbox", { name: "Dottore's recollection", exact: true });
    await expect(reviewText).toHaveValue("");
    await expect(
      review.getByText("Deleted. It won't be written again, but you can write one here.", { exact: true }),
    ).toBeVisible();
    await expect(deleteButton).toHaveCount(0);
    await expect(reviewSave).toBeDisabled();
    await captureThemes(page, info, "character-recollections-deleted", review);
    await reviewText.fill("I keep the blue notebook closed now.");
    await reviewSave.click();
    await expect.poll(content).toEqual(["I keep the blue notebook closed now.", true]);
    await expect(review.getByText("Manually edited", { exact: true })).toBeVisible();
    await expect(deleteButton).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test("Advanced Memory lines up side-by-side fields and explains message excerpts", async ({ page, request }, info) => {
  const fixture = await createFixture(request);
  try {
    expect(
      (await request.patch(`/api/chats/${fixture.chat.id}/advanced-memory/settings`, { data: { enabled: true } })).ok(),
    ).toBeTruthy();
    await openChat(page, fixture.chat.id);
    const section = page.locator('[data-chat-settings-section="roleplay-memory-recall"]');
    await drawerToggle(section).click();
    const settings = section.locator('[data-component="AdvancedMemorySettings"]');
    const cap = settings.getByLabel("Maximum allowed context before compression (tokens)");
    const budget = settings.getByLabel("Summary and recall budget (tokens)");
    const minimum = settings.getByLabel("Minimum messages per excerpt");
    const maximum = settings.getByLabel("Maximum messages per excerpt");
    // One help line explains both message limits and is read with either field.
    const excerptHelp =
      "Choose how many exact messages from a selected scene summary recall get appended to it. Change both values to 0 to never include those.";
    await expect(settings.getByText(excerptHelp, { exact: true })).toBeVisible();
    await expect(minimum).toHaveAccessibleDescription(excerptHelp);
    await expect(maximum).toHaveAccessibleDescription(excerptHelp);
    if (info.project.name.includes("mobile")) return;
    // In the desktop window the context label wraps and the budget label doesn't; both inputs still share a row.
    const box = async (field: Locator) => {
      const bounds = await field.boundingBox();
      if (!bounds) throw new Error("Expected a visible field");
      return bounds;
    };
    await expect(cap).toBeVisible();
    expect((await box(budget)).x).toBeGreaterThan((await box(cap)).x);
    await expect
      .poll(async () => [
        Math.round((await box(budget)).y - (await box(cap)).y),
        Math.round((await box(maximum)).y - (await box(minimum)).y),
      ])
      .toEqual([0, 0]);
  } finally {
    await fixture.cleanup();
  }
});

test("Advanced Memory problems show a dot and one notice, Fix repairs them and lists changed scenes", async ({
  page,
  request,
}, info) => {
  const fixture = await createFixture(request);
  const now = new Date().toISOString();
  const scene = (
    sceneId: string,
    startIndex: number,
    patch: Partial<AdvancedMemoryStatus["records"][number]> = {},
  ) => ({
    id: `${sceneId}-summary`,
    chatId: fixture.chat.id,
    sceneId,
    kind: "scene" as const,
    status: "closed" as const,
    startMessageId: fixture.firstMessage.id,
    endMessageId: fixture.lastMessage.id,
    startIndex,
    endIndex: startIndex + 9,
    messageIds: fixture.messages.map(({ id }) => id),
    audienceCharacterIds: [fixture.character.id],
    content: `The ${sceneId} recap.`,
    title: "Scene",
    timeline: null,
    enabled: true,
    manualOverride: false,
    sourceFingerprint: "fixture",
    dependencies: [ADVANCED_MEMORY_SCENE_AUDIENCE] as Array<{ id: string; revision: string }>,
    embeddingStatus: "vectorized" as const,
    createdAt: now,
    updatedAt: now,
    ...patch,
  });
  const settings = {
    ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
    enabled: true,
    knowledgeStarts: { [fixture.character.id]: null, [fixture.narrator.id]: null },
    knowledgeConfirmed: true,
  };
  const status: AdvancedMemoryStatus = {
    settings,
    job: { id: "earlier-job", status: "ready", stage: "ready", completed: 2, total: 2, error: null },
    missingKnowledgeCharacterIds: [],
    records: [
      // Scene #1: the helper named someone who isn't in the chat.
      scene("scene-one", 1, {
        dependencies: [ADVANCED_MEMORY_SCENE_AUDIENCE, { id: "scene-audience-unmatched", revision: "Stranger" }],
      }),
      // Scene #2: a summary the user edited no longer matches its messages.
      scene("scene-two", 11, { manualOverride: true, embeddingStatus: "stale" }),
    ],
    helperModel: "Fixture helper",
    summaryModel: "Fixture helper",
    warnings: ["scene-audience-unmatched"],
    // Scene #3 has no summary yet.
    unpreparedScenes: [{ sceneId: "scene-three", startIndex: 21, endIndex: 30 }],
  };
  const fixRequests: unknown[] = [];
  expect(
    (await request.patch(`/api/chats/${fixture.chat.id}/metadata`, { data: { advancedMemory: settings } })).ok(),
  ).toBeTruthy();
  await page.route(`**/api/chats/${fixture.chat.id}/advanced-memory**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() === "POST" && pathname.endsWith("/initialize")) {
      fixRequests.push(route.request().postDataJSON());
      status.job = {
        id: "fix-job",
        blocking: true,
        status: "running",
        stage: "summarizing",
        completed: 1,
        total: 3,
        error: null,
      };
      return route.fulfill({ status: 202, json: status });
    }
    return route.fulfill({ json: status });
  });
  try {
    await openChat(page, fixture.chat.id, false);
    const bubble = page.locator("[data-chat-settings-button]");
    await expect(bubble.locator("[data-advanced-memory-attention]")).toBeVisible();
    await expect(bubble).toHaveAccessibleDescription(/Advanced Memory needs attention/);
    const notice = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Advanced Memory found problems in 3 scenes." });
    await expect(notice).toHaveCount(1);
    await captureThemes(page, info, "memory-fix-notice");

    // The same problems are not announced again; the dot stays until they are fixed.
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await expect(bubble.locator("[data-advanced-memory-attention]")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "found problems" })).toHaveCount(0);

    // Chat Settings lists the same problems with a Fix button and the scenes only the user can settle.
    const drawer = page.locator(".mari-chat-settings-drawer");
    const fix = drawer.locator('[data-component="AdvancedMemoryFix"]');
    await openChatSettings(page);
    await drawerToggle(drawer.locator('[data-chat-settings-section="roleplay-memory-recall"]')).click();
    await expect(fix.getByRole("status")).toContainText("2 scenes need fixing.");
    await expect(fix.getByRole("status")).toContainText("1 scene needs your review:");
    await expect(fix.getByRole("button", { name: "Open Scene #2", exact: true })).toBeVisible();
    await expect(fix.getByRole("button", { name: "Fix", exact: true })).toBeEnabled();
    await expect(drawer.getByText("couldn't confirm who was in some scenes")).toHaveCount(0);
    await fix.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "memory-fix-box", fix);
    await closeChatSettings(page);

    // A new problem scene is announced once more, and its Fix button starts the repair in Chat Settings.
    status.unpreparedScenes = [...status.unpreparedScenes!, { sceneId: "scene-four", startIndex: 31, endIndex: 40 }];
    await page.reload();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "Advanced Memory found problems in 4 scenes." }),
    ).toHaveCount(1);
    status.unpreparedScenes = status.unpreparedScenes.slice(0, 1);
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Fix", exact: true }).click();
    await expect.poll(() => fixRequests).toEqual([expect.objectContaining({ fixAll: true })]);
    const progress = drawer.locator('[data-component="AdvancedMemoryProgress"]');
    await expect(progress).toContainText("Summarizing scenes");
    await expect(progress.getByRole("button", { name: "Pause processing", exact: true })).toBeVisible();

    // Closing Chat Settings mid-run still reports the result once.
    await closeChatSettings(page);
    status.job = {
      id: "fix-job",
      status: "ready",
      stage: "ready",
      completed: 3,
      total: 3,
      error: null,
      fixResult: { jobId: "fix-job", fixedSceneIds: ["scene-one", "scene-three"], reviewSceneIds: ["scene-two"] },
    };
    status.records = [
      scene("scene-one", 1),
      status.records[1]!,
      scene("scene-three", 21, { content: "The prepared scene-three recap." }),
    ];
    status.unpreparedScenes = [];
    status.warnings = [];
    const done = page.locator("[data-sonner-toast]").filter({ hasText: "Advanced Memory fixed 2 scenes." });
    await expect(done).toContainText("1 scene still needs your review.");
    await done.getByRole("button", { name: "Show", exact: true }).click();

    await expect(fix.getByRole("status")).toContainText("Fixed 2 scenes:");
    await expect(fix.getByRole("status")).toContainText("1 scene needs your review:");
    await expect(fix.getByRole("button", { name: "Fix", exact: true })).toHaveCount(0);
    await expect(fix.getByRole("button", { name: /^Open Scene #/ })).toHaveText(["#1", "#3", "#2"]);
    await expect(
      drawer.getByRole("button", { name: "Access memories for this chat", exact: true }),
    ).toHaveAccessibleDescription("Some scenes need attention.");
    await fix.scrollIntoViewIfNeeded();
    await captureThemes(page, info, "memory-fix-result", fix);

    await fix.getByRole("button", { name: "Open Scene #3", exact: true }).click();
    const inspector = drawer.locator('[data-component="AdvancedMemoryInspector"]');
    const heading = inspector.getByRole("heading", { name: "Scene #3", exact: true });
    await expect(heading).toBeFocused();
    await expect(inspector.getByRole("textbox", { name: "Summary text", exact: true })).toHaveValue(
      "The prepared scene-three recap.",
    );
    await fix.getByRole("button", { name: "Open Scene #2", exact: true }).click();
    await expect(inspector.getByRole("heading", { name: "Scene #2", exact: true })).toBeFocused();
    await expect(inspector).toContainText("Check the source messages, the summary, and which characters know it");
    expect(fixRequests).toHaveLength(1);

    // A paused Fix resumes as Fix, so a hand-edited scene can't stop it.
    status.job = {
      id: "fix-job-2",
      blocking: true,
      status: "cancelled",
      stage: "summarizing",
      completed: 1,
      total: 3,
      error: null,
      fixResult: null,
    };
    status.unpreparedScenes = [{ sceneId: "scene-four", startIndex: 31, endIndex: 40 }];
    await closeChatSettings(page);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openChatSettings(page);
    const resume = drawer
      .locator('[data-component="AdvancedMemoryProgress"]')
      .getByRole("button", { name: "Resume processing", exact: true });
    if (!(await resume.isVisible()))
      await drawerToggle(drawer.locator('[data-chat-settings-section="roleplay-memory-recall"]')).click();
    await resume.click();
    await expect.poll(() => fixRequests).toHaveLength(2);
    expect(fixRequests[1]).toEqual(expect.objectContaining({ fixAll: true }));
  } finally {
    await fixture.cleanup();
  }
});
